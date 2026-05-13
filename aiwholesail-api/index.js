require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

// Import routes
const authRoutes = require('./routes/auth');
const execRoutes = require('./routes/exec');
const leadsRoutes = require('./routes/leads');
const favoritesRoutes = require('./routes/favorites');
const alertsRoutes = require('./routes/alerts');
const stripeRoutes = require('./routes/stripe');
const aiRoutes = require('./routes/ai');
const aiAgentRoutes = require('./routes/aiAgent');
const mcpRoutes = require('./routes/mcp');
const eventsRoutes = require('./routes/events');
const offmarketSearchLogRoutes = require('./routes/offmarketSearchLog');
const zillowRoutes = require('./routes/zillow');
const propertyRoutes = require('./routes/property');
const communicationsRoutes = require('./routes/communications');
const buyersRoutes = require('./routes/buyers');
const sequencesRoutes = require('./routes/sequences');
const contractsRoutes = require('./routes/contracts');
const contactRoutes = require('./routes/contact');
const utilityRoutes = require('./routes/utility');
const skipTraceRoutes = require('./routes/skipTrace');
const webhookRoutes = require('./routes/webhooks');
const propdataRoutes = require('./routes/propdata');
const usHousingRoutes = require('./routes/usHousing');
const flagsRoutes = require('./routes/flags');
const healthIntegrationsRoutes = require('./routes/healthIntegrations');
const unsubscribeRoutes = require('./routes/unsubscribe');
const adminRoutes = require('./routes/admin');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');
const { rateLimiter } = require('./middleware/rateLimit');

const app = express();
const PORT = process.env.PORT || 3202;

// Trust exactly one proxy hop (nginx). Required so req.ip resolves to the
// real client behind the LB instead of 127.0.0.1, which would otherwise
// make every IP-keyed rate limit (signin, exec login) effectively unlimited.
// Value `1` (not `true`) is deliberate — `true` trusts all hops and can be
// spoofed by a client that controls any header X-Forwarded-For prefix.
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  frameguard: false, // Handled by Nginx global config
  xContentTypeOptions: false // Handled by Nginx global config
}));

// CORS configuration — locked to known origins.
//
// WHY: chunks are served with cache-control: max-age=31536000, immutable.
// A stale bundle that still calls https://api.aiwholesail.com/* cross-origin
// would previously get a silent 200/drop on Facebook/Instagram in-app WebKit.
// By rejecting unknown origins with an explicit 403 + CORS error, DevTools
// surfaces the breakage immediately instead of silently dropping the request.
//
// Vary: Origin is added below so shared caches never serve a response intended
// for one origin to a different origin.
const ALLOWED_CORS_ORIGINS = new Set([
  'https://aiwholesail.com',
  'https://www.aiwholesail.com', // user reached login here on 2026-05-13 → CORS preflight 403
  'https://staging.aiwholesail.com',
  'http://localhost:5173', // Vite dev server
]);

function buildCorsOptions() {
  return {
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, server-to-server, Stripe webhooks).
      // The Stripe webhook path also validates the signature, so this is safe.
      if (!origin) return callback(null, true);

      if (ALLOWED_CORS_ORIGINS.has(origin)) {
        callback(null, true);
      } else {
        const err = new Error('Not allowed by CORS');
        err.status = 403;
        callback(err);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // x-api-key is sent by VITE_ZILLOW_API_KEY in the browser bundle.
    // Without it here the preflight returns 204 but the actual request
    // is blocked by the browser — a separate silent-failure vector.
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'X-Client-Info',
      'x-api-key',
    ],
  };
}

const corsMiddleware = cors(buildCorsOptions());

// Attach Vary: Origin so HTTP caches (CDN, nginx proxy_cache) never serve
// a response for one origin to a different origin.
app.use((req, res, next) => {
  res.vary('Origin');
  next();
});

app.use(corsMiddleware);

// Preflight: use the same tightened config — NOT a bare cors() call, which
// would accept any origin and undo the lock above.
app.options('*', corsMiddleware);

// Request parsing — skip JSON body parsing for the Stripe webhook so the route
// handler can verify the raw body signature. Stripe's constructEvent() needs
// the unmodified Buffer; if express.json() has already consumed it, signature
// verification will fail with "no signatures found matching the expected signature".
app.use((req, res, next) => {
  if (req.originalUrl === '/api/stripe/webhook') return next();
  return express.json({ limit: '10mb' })(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Apply rate limiting to all routes
app.use(rateLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/ai/agent', aiAgentRoutes);
app.use('/mcp', mcpRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/offmarket-search-log', offmarketSearchLogRoutes);
app.use('/api/property', propertyRoutes);
app.use('/api/zillow', zillowRoutes);
app.use('/api/communications', communicationsRoutes);
app.use('/api/buyers', buyersRoutes);
app.use('/api/sequences', sequencesRoutes);
app.use('/api/contracts', contractsRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/skip-trace', skipTraceRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/propdata', propdataRoutes);
app.use('/api/us-housing', usHousingRoutes);
app.use('/api/flags', flagsRoutes);
app.use('/api/health', healthIntegrationsRoutes);
// Public unsubscribe endpoint — no auth, accessible from any email client.
// Mounted before the catch-all utility routes so /api/unsubscribe/:token
// resolves to its own handler.
app.use('/api/unsubscribe', unsubscribeRoutes);
// Admin-only endpoints (operator allowlist; see routes/admin.js for auth).
// Mounted before the catch-all utility routes so /api/admin/* resolves here.
app.use('/api/admin', adminRoutes);
app.use('/api', utilityRoutes);

// Exec dashboard at /exec/* — served via the nginx vhost for
// exec.aiwholesail.com which proxies `/foo` → `/exec/foo` here.
// The route handles its own auth (single-user JWT cookie) AND
// restricts itself to the exec vhost so /exec/* on api.aiwholesail.com
// 404s instead of exposing the dashboard publicly.
app.use('/exec', execRoutes);

// Handle 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`[Server] AIWholesail API running on port ${PORT}`);
  console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[Server] CORS origins: ${[...ALLOWED_CORS_ORIGINS].join(', ')}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = app;
