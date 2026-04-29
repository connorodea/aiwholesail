const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const PDFDocument = require('pdfkit');

const router = express.Router();

/**
 * GET /api/contracts
 * List all contracts for the authenticated user
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT * FROM contracts WHERE user_id = $1 ORDER BY created_at DESC',
    [req.user.id]
  );

  res.json({ contracts: result.rows });
}));

/**
 * GET /api/contracts/:id
 * Get a specific contract
 */
router.get('/:id', authenticate, [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid contract ID' });
  }

  const result = await query(
    'SELECT * FROM contracts WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Contract not found' });
  }

  res.json(result.rows[0]);
}));

/**
 * GET /api/contracts/lead/:leadId
 * Get contracts for a specific lead
 */
router.get('/lead/:leadId', authenticate, [
  param('leadId').isUUID(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid lead ID' });
  }

  const result = await query(
    'SELECT * FROM contracts WHERE lead_id = $1 AND user_id = $2 ORDER BY created_at DESC',
    [req.params.leadId, req.user.id]
  );

  res.json({ contracts: result.rows });
}));

/**
 * POST /api/contracts/generate
 * Generate a contract PDF and save the record
 */
router.post('/generate', authenticate, [
  body('contractType').isIn(['assignment_agreement', 'purchase_agreement', 'letter_of_intent']).withMessage('Valid contract type required'),
  body('propertyAddress').notEmpty().withMessage('Property address required'),
  body('seller').isObject().withMessage('Seller data required'),
  body('buyer').isObject().withMessage('Buyer data required'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  const contractData = req.body;
  const { contractType, propertyAddress, seller, buyer, assignee, terms } = contractData;

  // Generate PDF
  const pdfBase64 = await generateContractPdf(contractType, contractData);

  const pdfFilename = `${contractType}_${Date.now()}.pdf`;

  // Save to database
  const result = await query(
    `INSERT INTO contracts (user_id, lead_id, contract_type, contract_data, pdf_filename)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      req.user.id,
      contractData.leadId || null,
      contractType,
      JSON.stringify(contractData),
      pdfFilename,
    ]
  );

  res.status(201).json({
    contract: result.rows[0],
    pdfBase64,
  });
}));

/**
 * DELETE /api/contracts/:id
 * Delete a contract
 */
router.delete('/:id', authenticate, [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid contract ID' });
  }

  const result = await query(
    'DELETE FROM contracts WHERE id = $1 AND user_id = $2 RETURNING id',
    [req.params.id, req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Contract not found' });
  }

  res.json({ message: 'Contract deleted', id: result.rows[0].id });
}));

// ============ PDF Generation ============

const CONTRACT_TITLES = {
  assignment_agreement: 'WHOLESALE ASSIGNMENT OF CONTRACT',
  purchase_agreement: 'REAL ESTATE PURCHASE AGREEMENT',
  letter_of_intent: 'LETTER OF INTENT TO PURCHASE',
};

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function formatDate(dateStr) {
  if (!dateStr) return '_______________';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

async function generateContractPdf(contractType, data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 60, size: 'LETTER' });
    const buffers = [];

    doc.on('data', chunk => buffers.push(chunk));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      resolve(pdfBuffer.toString('base64'));
    });
    doc.on('error', reject);

    const { propertyAddress, propertyLegalDescription, seller, buyer, assignee, terms } = data;

    // Title
    doc.fontSize(16).font('Helvetica-Bold').text(CONTRACT_TITLES[contractType] || 'CONTRACT', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').text(`Date: ${formatDate(new Date().toISOString())}`, { align: 'center' });
    doc.moveDown(1.5);

    // Parties
    doc.fontSize(12).font('Helvetica-Bold').text('PARTIES');
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica');

    doc.text(`SELLER: ${seller?.name || '_______________'}${seller?.entity ? ` (${seller.entity})` : ''}`);
    doc.text(`Address: ${seller?.address || '_______________'}`);
    doc.text(`Phone: ${seller?.phone || '_______________'}  Email: ${seller?.email || '_______________'}`);
    doc.moveDown(0.5);

    doc.text(`BUYER: ${buyer?.name || '_______________'}${buyer?.entity ? ` (${buyer.entity})` : ''}`);
    doc.text(`Address: ${buyer?.address || '_______________'}`);
    doc.text(`Phone: ${buyer?.phone || '_______________'}  Email: ${buyer?.email || '_______________'}`);
    doc.moveDown(0.5);

    if (contractType === 'assignment_agreement' && assignee?.name) {
      doc.text(`ASSIGNEE: ${assignee.name}${assignee.entity ? ` (${assignee.entity})` : ''}`);
      doc.text(`Address: ${assignee.address || '_______________'}`);
      doc.text(`Phone: ${assignee.phone || '_______________'}  Email: ${assignee.email || '_______________'}`);
      doc.moveDown(0.5);
    }

    // Property
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica-Bold').text('PROPERTY');
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Address: ${propertyAddress || '_______________'}`);
    if (propertyLegalDescription) {
      doc.text(`Legal Description: ${propertyLegalDescription}`);
    }
    doc.moveDown(1);

    // Terms
    doc.fontSize(12).font('Helvetica-Bold').text('TERMS AND CONDITIONS');
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica');

    doc.text(`1. Purchase Price: ${formatCurrency(terms?.purchasePrice)}`);
    doc.text(`2. Earnest Money Deposit: ${formatCurrency(terms?.earnestMoney)}`);

    if (contractType === 'assignment_agreement') {
      doc.text(`3. Assignment Fee: ${formatCurrency(terms?.assignmentFee)}`);
    }

    doc.text(`${contractType === 'assignment_agreement' ? '4' : '3'}. Closing Date: ${formatDate(terms?.closingDate)}`);
    doc.text(`${contractType === 'assignment_agreement' ? '5' : '4'}. Inspection Period: ${terms?.inspectionPeriod || 10} days from execution`);
    doc.moveDown(0.5);

    // Contingencies
    const contingencies = [];
    if (terms?.inspectionContingency) contingencies.push('Inspection');
    if (terms?.financingContingency) contingencies.push('Financing');
    if (terms?.appraisalContingency) contingencies.push('Appraisal');

    if (contingencies.length > 0) {
      doc.text(`Contingencies: ${contingencies.join(', ')}`);
    } else {
      doc.text('Contingencies: None (as-is sale)');
    }
    doc.moveDown(0.5);

    if (terms?.titleCompany) {
      doc.text(`Title Company: ${terms.titleCompany}`);
    }
    if (terms?.closingAgent) {
      doc.text(`Closing Agent: ${terms.closingAgent}`);
    }
    doc.moveDown(0.5);

    // Additional terms
    if (terms?.additionalTerms) {
      doc.fontSize(12).font('Helvetica-Bold').text('ADDITIONAL TERMS');
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica').text(terms.additionalTerms);
      doc.moveDown(1);
    }

    // Contract-type specific clauses
    if (contractType === 'assignment_agreement') {
      doc.fontSize(12).font('Helvetica-Bold').text('ASSIGNMENT CLAUSE');
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica');
      doc.text(
        'Buyer hereby assigns all rights, title, and interest in this Purchase Agreement to the Assignee named above. ' +
        'Assignee agrees to assume all obligations of the Buyer under the original Purchase Agreement. ' +
        'The Assignment Fee shall be paid at closing.'
      );
      doc.moveDown(1);
    } else if (contractType === 'letter_of_intent') {
      doc.fontSize(12).font('Helvetica-Bold').text('NON-BINDING NATURE');
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica');
      doc.text(
        'This Letter of Intent is not a binding agreement to purchase or sell the above-described property. ' +
        'It is intended to set forth the general terms upon which the parties may enter into a formal Purchase Agreement. ' +
        'Either party may withdraw from negotiations at any time without liability.'
      );
      doc.moveDown(1);
    }

    // Signature Lines
    doc.moveDown(2);
    doc.fontSize(12).font('Helvetica-Bold').text('SIGNATURES');
    doc.moveDown(1);
    doc.fontSize(10).font('Helvetica');

    // Seller signature
    doc.text('_______________________________________          _______________');
    doc.text(`Seller: ${seller?.name || ''}                                         Date`);
    doc.moveDown(1.5);

    // Buyer signature
    doc.text('_______________________________________          _______________');
    doc.text(`Buyer: ${buyer?.name || ''}                                          Date`);
    doc.moveDown(1.5);

    if (contractType === 'assignment_agreement' && assignee?.name) {
      doc.text('_______________________________________          _______________');
      doc.text(`Assignee: ${assignee.name}                                       Date`);
    }

    // Footer
    doc.moveDown(2);
    doc.fontSize(8).fillColor('#888888');
    doc.text('Generated by AIWholesail.com - This document is a template and should be reviewed by a qualified attorney before execution.', { align: 'center' });

    doc.end();
  });
}

module.exports = router;
