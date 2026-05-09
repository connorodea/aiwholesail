const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const PDFDocument = require('pdfkit');
const {
  COLORS,
  PAGE,
  drawPageHeader,
  drawSectionHeader,
  drawCallout,
  drawFooter,
  formatCurrency: brandFormatCurrency,
  formatDate: brandFormatDate,
} = require('../lib/pdfBrand');

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
    // bufferPages required so footer can paint on every page after content
    const doc = new PDFDocument({ margin: 60, size: 'LETTER', bufferPages: true });
    const buffers = [];

    doc.on('data', chunk => buffers.push(chunk));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      resolve(pdfBuffer.toString('base64'));
    });
    doc.on('error', reject);

    const { propertyAddress, propertyLegalDescription, seller, buyer, assignee, terms } = data;
    const titleText = CONTRACT_TITLES[contractType] || 'CONTRACT';

    // ── Branded header ──
    drawPageHeader(doc, {
      subtitle: titleText,
      date: brandFormatDate(new Date().toISOString()),
    });

    // ── Document title (centered, large) ──
    doc.y = 90;
    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor(COLORS.ink)
      .text(titleText, PAGE.MARGIN, doc.y, {
        width: doc.page.width - PAGE.MARGIN * 2,
        align: 'center',
      });
    doc.moveDown(0.4);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text(`Executed ${brandFormatDate(new Date().toISOString())}`, {
        width: doc.page.width - PAGE.MARGIN * 2,
        align: 'center',
      });
    doc.moveDown(1.5);

    // ── Parties ──
    drawSectionHeader(doc, 'Parties');
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.text);

    doc.text(`SELLER: ${seller?.name || '_______________'}${seller?.entity ? ` (${seller.entity})` : ''}`);
    doc.text(`Address: ${seller?.address || '_______________'}`);
    doc.text(`Phone: ${seller?.phone || '_______________'}  ·  Email: ${seller?.email || '_______________'}`);
    doc.moveDown(0.6);

    doc.text(`BUYER: ${buyer?.name || '_______________'}${buyer?.entity ? ` (${buyer.entity})` : ''}`);
    doc.text(`Address: ${buyer?.address || '_______________'}`);
    doc.text(`Phone: ${buyer?.phone || '_______________'}  ·  Email: ${buyer?.email || '_______________'}`);
    doc.moveDown(0.6);

    if (contractType === 'assignment_agreement' && assignee?.name) {
      doc.text(`ASSIGNEE: ${assignee.name}${assignee.entity ? ` (${assignee.entity})` : ''}`);
      doc.text(`Address: ${assignee.address || '_______________'}`);
      doc.text(`Phone: ${assignee.phone || '_______________'}  ·  Email: ${assignee.email || '_______________'}`);
      doc.moveDown(0.6);
    }
    doc.moveDown(0.5);

    // ── Property ──
    drawSectionHeader(doc, 'Property');
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.text);
    doc.text(`Address: ${propertyAddress || '_______________'}`);
    if (propertyLegalDescription) {
      doc.text(`Legal Description: ${propertyLegalDescription}`);
    }
    doc.moveDown(1);

    // ── Terms ──
    drawSectionHeader(doc, 'Terms and Conditions');
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.text);

    doc.text(`1. Purchase Price: ${brandFormatCurrency(terms?.purchasePrice)}`);
    doc.text(`2. Earnest Money Deposit: ${brandFormatCurrency(terms?.earnestMoney)}`);

    if (contractType === 'assignment_agreement') {
      doc.text(`3. Assignment Fee: ${brandFormatCurrency(terms?.assignmentFee)}`);
    }

    doc.text(`${contractType === 'assignment_agreement' ? '4' : '3'}. Closing Date: ${brandFormatDate(terms?.closingDate)}`);
    doc.text(`${contractType === 'assignment_agreement' ? '5' : '4'}. Inspection Period: ${terms?.inspectionPeriod || 10} days from execution`);
    doc.moveDown(0.6);

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
    doc.moveDown(0.6);

    // ── Additional terms ──
    if (terms?.additionalTerms) {
      drawSectionHeader(doc, 'Additional Terms');
      doc.font('Helvetica').fontSize(10).fillColor(COLORS.text).text(terms.additionalTerms);
      doc.moveDown(1);
    }

    // ── Contract-type specific clause as a callout ──
    if (contractType === 'assignment_agreement') {
      drawCallout(doc,
        'Buyer hereby assigns all rights, title, and interest in this Purchase Agreement to the Assignee named above. ' +
        'Assignee agrees to assume all obligations of the Buyer under the original Purchase Agreement. ' +
        'The Assignment Fee shall be paid at closing.',
        { title: 'Assignment Clause', tone: 'cyan' }
      );
    } else if (contractType === 'letter_of_intent') {
      drawCallout(doc,
        'This Letter of Intent is not a binding agreement to purchase or sell the above-described property. ' +
        'It is intended to set forth the general terms upon which the parties may enter into a formal Purchase Agreement. ' +
        'Either party may withdraw from negotiations at any time without liability.',
        { title: 'Non-Binding Nature', tone: 'amber' }
      );
    }

    // ── Signature Lines ──
    doc.moveDown(1.5);
    drawSectionHeader(doc, 'Signatures');
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.text);
    doc.moveDown(0.5);

    const sigLine = '_______________________________________          _______________';

    doc.text(sigLine);
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted)
       .text(`Seller: ${seller?.name || ''}                                         Date`);
    doc.moveDown(1.5);

    doc.font('Helvetica').fontSize(10).fillColor(COLORS.text).text(sigLine);
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted)
       .text(`Buyer: ${buyer?.name || ''}                                          Date`);
    doc.moveDown(1.5);

    if (contractType === 'assignment_agreement' && assignee?.name) {
      doc.font('Helvetica').fontSize(10).fillColor(COLORS.text).text(sigLine);
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted)
         .text(`Assignee: ${assignee.name}                                       Date`);
    }

    // ── Closing legal-review nudge ──
    doc.moveDown(2);
    drawCallout(doc,
      'This document is a template generated by AIWholesail and should be reviewed by a qualified attorney licensed in the relevant jurisdiction before execution. AIWholesail does not provide legal advice.',
      { title: 'Attorney Review Recommended', tone: 'amber' }
    );

    // ── Branded footer (paints on every page) ──
    drawFooter(doc, { tagline: 'Contract template · attorney review recommended' });

    doc.end();
  });
}

module.exports = router;
