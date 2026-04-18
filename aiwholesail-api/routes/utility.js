const express = require('express');
const axios = require('axios');
const PDFDocument = require('pdfkit');
const { body, validationResult } = require('express-validator');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { checkDatabaseRateLimit } = require('../middleware/rateLimit');

const router = express.Router();

/**
 * POST /api/geocoding
 * Geocode an address to coordinates
 */
router.post('/geocoding', optionalAuth, [
  body('address').notEmpty().withMessage('Address required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  const identifier = req.user?.id || req.ip;
  const rateLimit = await checkDatabaseRateLimit(identifier, 'geocoding', 60, 1);
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  const { address } = req.body;

  try {
    // Use Mapbox geocoding API
    const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;

    if (mapboxToken) {
      const response = await axios.get(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json`,
        {
          params: {
            access_token: mapboxToken,
            types: 'address',
            limit: 1
          }
        }
      );

      if (response.data.features && response.data.features.length > 0) {
        const feature = response.data.features[0];
        return res.json({
          success: true,
          coordinates: {
            longitude: feature.center[0],
            latitude: feature.center[1]
          },
          formattedAddress: feature.place_name,
          components: feature.context
        });
      }
    }

    // Fallback to Nominatim (OpenStreetMap)
    const nominatimResponse = await axios.get(
      'https://nominatim.openstreetmap.org/search',
      {
        params: {
          q: address,
          format: 'json',
          limit: 1
        },
        headers: {
          'User-Agent': 'AIWholesail/1.0'
        }
      }
    );

    if (nominatimResponse.data && nominatimResponse.data.length > 0) {
      const result = nominatimResponse.data[0];
      return res.json({
        success: true,
        coordinates: {
          longitude: parseFloat(result.lon),
          latitude: parseFloat(result.lat)
        },
        formattedAddress: result.display_name
      });
    }

    res.json({
      success: false,
      error: 'Address not found'
    });
  } catch (error) {
    console.error('[Utility] Geocoding error:', error.message);
    res.status(500).json({ error: 'Geocoding failed' });
  }
}));

/**
 * POST /api/pdf/generate
 * Generate a PDF document
 */
router.post('/pdf/generate', authenticate, [
  body('type').isIn(['property-report', 'lead-export', 'deal-analysis']).withMessage('Valid document type required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  const rateLimit = await checkDatabaseRateLimit(req.user.id, 'pdf-generate', 10, 1);
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  const { type, data } = req.body;

  try {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      const base64Pdf = pdfBuffer.toString('base64');

      res.json({
        success: true,
        pdf: base64Pdf,
        filename: `${type}-${Date.now()}.pdf`
      });
    });

    // Generate PDF based on type
    switch (type) {
      case 'property-report':
        generatePropertyReport(doc, data);
        break;
      case 'lead-export':
        generateLeadExport(doc, data);
        break;
      case 'deal-analysis':
        generateDealAnalysis(doc, data);
        break;
    }

    doc.end();
  } catch (error) {
    console.error('[Utility] PDF generation error:', error);
    res.status(500).json({ error: 'PDF generation failed' });
  }
}));

/**
 * Generate property report PDF
 */
function generatePropertyReport(doc, data) {
  const property = data.property || {};

  // Header
  doc.fontSize(24).fillColor('#1a365d').text('Property Report', { align: 'center' });
  doc.moveDown();
  doc.fontSize(10).fillColor('#666').text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
  doc.moveDown(2);

  // Property Address
  doc.fontSize(16).fillColor('#000').text(property.address || 'Address Not Available');
  doc.fontSize(12).fillColor('#666').text(`${property.city || ''}, ${property.state || ''} ${property.zipcode || ''}`);
  doc.moveDown(2);

  // Property Details
  doc.fontSize(14).fillColor('#1a365d').text('Property Details');
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#e2e8f0');
  doc.moveDown(0.5);

  const details = [
    ['Price', property.price ? `$${property.price.toLocaleString()}` : 'N/A'],
    ['Bedrooms', property.bedrooms || 'N/A'],
    ['Bathrooms', property.bathrooms || 'N/A'],
    ['Square Feet', property.livingArea ? property.livingArea.toLocaleString() : 'N/A'],
    ['Year Built', property.yearBuilt || 'N/A'],
    ['Property Type', property.propertyType || 'N/A'],
    ['Zestimate', property.zestimate ? `$${property.zestimate.toLocaleString()}` : 'N/A']
  ];

  details.forEach(([label, value]) => {
    doc.fontSize(11).fillColor('#000').text(`${label}: `, { continued: true });
    doc.fillColor('#333').text(value);
  });

  doc.moveDown(2);

  // Analysis Section
  if (data.analysis) {
    doc.fontSize(14).fillColor('#1a365d').text('Wholesale Analysis');
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#e2e8f0');
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#333').text(data.analysis);
  }

  // Footer
  doc.moveDown(2);
  doc.fontSize(9).fillColor('#999').text('Generated by AI Wholesail - aiwholesail.com', { align: 'center' });
}

/**
 * Generate lead export PDF
 */
function generateLeadExport(doc, data) {
  const leads = data.leads || [];

  doc.fontSize(24).fillColor('#1a365d').text('Lead Export', { align: 'center' });
  doc.moveDown();
  doc.fontSize(10).fillColor('#666').text(`${leads.length} leads - Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
  doc.moveDown(2);

  leads.forEach((lead, index) => {
    const property = lead.property_data || {};

    doc.fontSize(12).fillColor('#1a365d').text(`${index + 1}. ${property.address || 'No Address'}`);
    doc.fontSize(10).fillColor('#666').text(`${property.city || ''}, ${property.state || ''} | $${(property.price || 0).toLocaleString()}`);

    if (lead.notes) {
      doc.fontSize(9).fillColor('#333').text(`Notes: ${lead.notes}`);
    }

    doc.moveDown();
  });

  doc.fontSize(9).fillColor('#999').text('Generated by AI Wholesail', { align: 'center' });
}

/**
 * Generate deal analysis PDF
 */
function generateDealAnalysis(doc, data) {
  doc.fontSize(24).fillColor('#1a365d').text('Deal Analysis Report', { align: 'center' });
  doc.moveDown();
  doc.fontSize(10).fillColor('#666').text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
  doc.moveDown(2);

  // Property Info
  if (data.property) {
    doc.fontSize(16).fillColor('#000').text(data.property.address || 'Property Address');
    doc.moveDown();
  }

  // Metrics
  const metrics = data.metrics || {};

  doc.fontSize(14).fillColor('#1a365d').text('Investment Metrics');
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#e2e8f0');
  doc.moveDown(0.5);

  const metricItems = [
    ['List Price', metrics.listPrice ? `$${metrics.listPrice.toLocaleString()}` : 'N/A'],
    ['ARV (After Repair Value)', metrics.arv ? `$${metrics.arv.toLocaleString()}` : 'N/A'],
    ['Repair Estimate', metrics.repairEstimate ? `$${metrics.repairEstimate.toLocaleString()}` : 'N/A'],
    ['MAO (70% Rule)', metrics.mao ? `$${metrics.mao.toLocaleString()}` : 'N/A'],
    ['Potential Profit', metrics.profit ? `$${metrics.profit.toLocaleString()}` : 'N/A'],
    ['Investment Score', metrics.score ? `${metrics.score}/100` : 'N/A']
  ];

  metricItems.forEach(([label, value]) => {
    doc.fontSize(11).fillColor('#000').text(`${label}: `, { continued: true });
    doc.fillColor('#333').text(value);
  });

  doc.moveDown(2);

  // Recommendation
  if (data.recommendation) {
    doc.fontSize(14).fillColor('#1a365d').text('Recommendation');
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#e2e8f0');
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#333').text(data.recommendation);
  }

  // AI Analysis
  if (data.aiAnalysis) {
    doc.moveDown(2);
    doc.fontSize(14).fillColor('#1a365d').text('AI Analysis');
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#e2e8f0');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#333').text(data.aiAnalysis);
  }

  doc.moveDown(2);
  doc.fontSize(9).fillColor('#999').text('Generated by AI Wholesail - aiwholesail.com', { align: 'center' });
}

module.exports = router;
