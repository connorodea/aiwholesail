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
  body('contractType').isIn(['assignment_agreement', 'purchase_agreement', 'letter_of_intent', 'proof_of_funds']).withMessage('Valid contract type required'),
  body('buyer').isObject().withMessage('Buyer data required'),
  // Property + seller required for everything except POF
  body('propertyAddress').custom((val, { req }) => {
    if (req.body.contractType === 'proof_of_funds') return true;
    if (!val) throw new Error('Property address required');
    return true;
  }),
  body('seller').custom((val, { req }) => {
    if (req.body.contractType === 'proof_of_funds') return true;
    if (!val || typeof val !== 'object') throw new Error('Seller data required');
    return true;
  }),
  // POF-specific: amount must be positive
  body('proofOfFunds.amount').custom((val, { req }) => {
    if (req.body.contractType !== 'proof_of_funds') return true;
    const n = Number(val);
    if (!Number.isFinite(n) || n <= 0) throw new Error('Proof-of-funds amount must be a positive number');
    return true;
  }),
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
  proof_of_funds: 'PROOF OF FUNDS',
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

function renderProofOfFunds(doc, data) {
  const { propertyAddress, buyer = {}, proofOfFunds = {} } = data;

  // Issuer falls back to buyer if not separately provided
  const issuer = {
    name: proofOfFunds.issuerName || buyer.name || '',
    entity: proofOfFunds.issuerEntity || buyer.entity || '',
    title: proofOfFunds.issuerTitle || '',
    address: proofOfFunds.issuerAddress || buyer.address || '',
    phone: proofOfFunds.issuerPhone || buyer.phone || '',
    email: proofOfFunds.issuerEmail || buyer.email || '',
  };

  const todayIso = new Date().toISOString();
  const expIso = proofOfFunds.expirationDate || '';
  const amountStr = brandFormatCurrency(proofOfFunds.amount);

  drawPageHeader(doc, {
    subtitle: 'PROOF OF FUNDS',
    date: brandFormatDate(todayIso),
  });

  // Title
  doc.y = 90;
  doc
    .font('Helvetica-Bold')
    .fontSize(22)
    .fillColor(COLORS.ink)
    .text('PROOF OF FUNDS LETTER', PAGE.MARGIN, doc.y, {
      width: doc.page.width - PAGE.MARGIN * 2,
      align: 'center',
    });
  doc.moveDown(0.3);
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(COLORS.muted)
    .text(`Issued ${brandFormatDate(todayIso)}`, {
      width: doc.page.width - PAGE.MARGIN * 2,
      align: 'center',
    });
  doc.moveDown(2);

  // Salutation
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(COLORS.ink)
    .text('TO WHOM IT MAY CONCERN:', PAGE.MARGIN, doc.y);
  doc.moveDown(1);

  // Attestation paragraph
  const buyerLabel = buyer.entity
    ? `${buyer.name} (${buyer.entity})`
    : (buyer.name || '_______________');

  const propertyClause = propertyAddress
    ? ` for the purchase of the property located at ${propertyAddress}`
    : '';

  doc
    .font('Helvetica')
    .fontSize(11)
    .fillColor(COLORS.text)
    .text(
      `This letter confirms that ${buyerLabel} has the financial resources readily available to ` +
      `complete a real estate transaction${propertyClause}. The funds are unencumbered, in good standing, ` +
      `and immediately accessible for closing.`,
      PAGE.MARGIN,
      doc.y,
      {
        width: doc.page.width - PAGE.MARGIN * 2,
        align: 'left',
        lineGap: 2,
      }
    );
  doc.moveDown(1.2);

  // Headline amount callout
  drawCallout(
    doc,
    `Funds available: ${amountStr}\n` +
    (proofOfFunds.fundsSource ? `Source: ${proofOfFunds.fundsSource}\n` : '') +
    (expIso ? `Letter valid through: ${brandFormatDate(expIso)}` : 'Letter valid for 30 days from issuance'),
    { title: 'Verified Funds', tone: 'cyan' }
  );

  // Verification block
  if (issuer.phone || issuer.email) {
    drawSectionHeader(doc, 'Verification');
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.text);
    doc.text(
      'For verification of these funds, please contact the issuer below directly:',
      { width: doc.page.width - PAGE.MARGIN * 2 }
    );
    doc.moveDown(0.4);
    if (issuer.phone) doc.text(`Phone: ${issuer.phone}`);
    if (issuer.email) doc.text(`Email: ${issuer.email}`);
    doc.moveDown(0.8);
  }

  // Sign-off
  doc.moveDown(1);
  doc
    .font('Helvetica')
    .fontSize(11)
    .fillColor(COLORS.text)
    .text('Sincerely,', PAGE.MARGIN, doc.y);
  doc.moveDown(2.5);

  // Signature line
  const sigLineW = 260;
  const sigStartY = doc.y;
  doc
    .save()
    .moveTo(PAGE.MARGIN, sigStartY)
    .lineTo(PAGE.MARGIN + sigLineW, sigStartY)
    .lineWidth(0.6)
    .strokeColor(COLORS.ink)
    .stroke()
    .restore();
  doc.y = sigStartY + 4;

  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(COLORS.ink)
    .text(issuer.name || '_______________', PAGE.MARGIN, doc.y);

  if (issuer.title || issuer.entity) {
    doc
      .font('Helvetica')
      .fontSize(9.5)
      .fillColor(COLORS.muted)
      .text(
        [issuer.title, issuer.entity].filter(Boolean).join(' · '),
        PAGE.MARGIN,
        doc.y
      );
  }
  if (issuer.address) {
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text(issuer.address, PAGE.MARGIN, doc.y);
  }
  doc.moveDown(2);

  // Disclaimer (POF is a self-attestation unless from a financial institution)
  drawCallout(
    doc,
    'This Proof of Funds is provided as a good-faith representation of available funds at the time of issuance ' +
    'and does not constitute a commitment to lend or guarantee of closing. Recipients are encouraged to verify ' +
    'directly with the issuer using the contact information above.',
    { title: 'Notice', tone: 'amber' }
  );

  drawFooter(doc, { tagline: 'Proof of Funds · verify directly with issuer' });
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

    if (contractType === 'proof_of_funds') {
      renderProofOfFunds(doc, data);
      doc.end();
      return;
    }

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
