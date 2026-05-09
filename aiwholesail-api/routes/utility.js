const express = require('express');
const axios = require('axios');
const PDFDocument = require('pdfkit');
const { body, validationResult } = require('express-validator');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { checkDatabaseRateLimit } = require('../middleware/rateLimit');
const {
  COLORS,
  PAGE: BRAND_PAGE,
  drawPageHeader,
  drawSectionHeader,
  drawMetricRow,
  drawFooter,
  drawDisclaimer,
  formatCurrency: brandFormatCurrency,
  formatNumber: brandFormatNumber,
  humanize,
} = require('../lib/pdfBrand');

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
    // bufferPages so footer can paint on every page after content done
    const doc = new PDFDocument({ margin: BRAND_PAGE.MARGIN, size: 'LETTER', bufferPages: true });
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
 * Generate property report PDF (branded)
 */
function generatePropertyReport(doc, data) {
  const property = data.property || {};

  drawPageHeader(doc, { subtitle: 'Property Report' });

  // Hero — address + city/state
  doc
    .font('Helvetica-Bold').fontSize(15).fillColor(COLORS.ink)
    .text(property.address || 'Address Not Available', BRAND_PAGE.MARGIN, doc.y);
  doc
    .font('Helvetica').fontSize(11).fillColor(COLORS.muted)
    .text(`${property.city || ''}, ${property.state || ''} ${property.zipcode || ''}`.replace(/^,\s*/, ''));
  doc.moveDown(1);

  drawSectionHeader(doc, 'Property Details');

  drawMetricRow(doc, 'Price', brandFormatCurrency(property.price), { bold: true });
  drawMetricRow(doc, 'Bedrooms', property.bedrooms != null ? String(property.bedrooms) : '—');
  drawMetricRow(doc, 'Bathrooms', property.bathrooms != null ? String(property.bathrooms) : '—');
  drawMetricRow(doc, 'Square Feet', property.livingArea ? brandFormatNumber(property.livingArea) : '—');
  drawMetricRow(doc, 'Year Built', property.yearBuilt ? String(property.yearBuilt) : '—');
  drawMetricRow(doc, 'Property Type', humanize(property.propertyType));
  drawMetricRow(doc, 'Zestimate', brandFormatCurrency(property.zestimate), { bold: true });

  if (data.analysis) {
    doc.moveDown(1);
    drawSectionHeader(doc, 'Wholesale Analysis');
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.text).text(data.analysis);
  }

  doc.moveDown(2);
  drawDisclaimer(doc);
  drawFooter(doc);
}

/**
 * Generate lead export PDF (branded)
 */
function generateLeadExport(doc, data) {
  const leads = data.leads || [];

  drawPageHeader(doc, { subtitle: `Lead Export · ${leads.length} ${leads.length === 1 ? 'lead' : 'leads'}` });

  drawSectionHeader(doc, `${leads.length} ${leads.length === 1 ? 'Lead' : 'Leads'}`);

  leads.forEach((lead, index) => {
    const property = lead.property_data || {};

    doc
      .font('Helvetica-Bold').fontSize(11).fillColor(COLORS.ink)
      .text(`${index + 1}. ${property.address || 'No Address'}`);
    doc
      .font('Helvetica').fontSize(9).fillColor(COLORS.muted)
      .text(`${property.city || ''}, ${property.state || ''}  ·  ${brandFormatCurrency(property.price)}`.replace(/^,\s*/, ''));

    if (lead.notes) {
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.text).text(`Notes: ${lead.notes}`);
    }

    doc.moveDown(0.6);
  });

  doc.moveDown(1);
  drawDisclaimer(doc);
  drawFooter(doc);
}

/**
 * Generate deal analysis PDF (branded)
 */
function generateDealAnalysis(doc, data) {
  drawPageHeader(doc, { subtitle: 'Deal Analysis Report' });

  if (data.property) {
    doc
      .font('Helvetica-Bold').fontSize(15).fillColor(COLORS.ink)
      .text(data.property.address || 'Property Address');
    doc.moveDown(0.8);
  }

  const metrics = data.metrics || {};

  drawSectionHeader(doc, 'Investment Metrics');

  const metricItems = [
    ['List Price', brandFormatCurrency(metrics.listPrice)],
    ['ARV (After Repair Value)', brandFormatCurrency(metrics.arv)],
    ['Repair Estimate', brandFormatCurrency(metrics.repairEstimate)],
    ['MAO (70% Rule)', brandFormatCurrency(metrics.mao)],
    ['Potential Profit', brandFormatCurrency(metrics.profit)],
    ['Investment Score', metrics.score != null ? `${metrics.score} / 100` : '—'],
  ];

  metricItems.forEach(([label, value]) => {
    drawMetricRow(doc, label, value, { bold: ['MAO (70% Rule)', 'Potential Profit', 'ARV (After Repair Value)'].includes(label) });
  });

  doc.moveDown(1);

  // Recommendation
  if (data.recommendation) {
    drawSectionHeader(doc, 'Recommendation');
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.text).text(data.recommendation);
    doc.moveDown(1);
  }

  // AI Analysis
  if (data.aiAnalysis) {
    drawSectionHeader(doc, 'AI Analysis');
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.text).text(data.aiAnalysis);
    doc.moveDown(1);
  }

  drawDisclaimer(doc);
  drawFooter(doc);
}

module.exports = router;
