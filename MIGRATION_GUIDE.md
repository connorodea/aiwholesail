# AIWholesail.com - Supabase to Hetzner Migration Guide

## Overview

This guide details the steps to migrate AIWholesail.com from Supabase to a self-hosted solution on Hetzner VPS.

## What Was Created

### Backend API (`/aiwholesail-api/`)

```
aiwholesail-api/
├── index.js                    # Main Express app
├── package.json                # Dependencies
├── ecosystem.config.js         # PM2 configuration
├── .env.example                # Environment template
├── config/
│   └── database.js             # PostgreSQL connection pool
├── middleware/
│   ├── auth.js                 # JWT authentication
│   ├── rateLimit.js            # Rate limiting
│   └── errorHandler.js         # Error handling
├── routes/
│   ├── auth.js                 # Auth endpoints (signup, signin, etc.)
│   ├── leads.js                # Leads CRUD
│   ├── favorites.js            # Favorites CRUD
│   ├── alerts.js               # Property alerts CRUD
│   ├── stripe.js               # Stripe integration
│   ├── ai.js                   # AI analysis endpoints
│   ├── property.js             # Property/Zillow data
│   ├── communications.js       # Email/SMS/Call
│   └── utility.js              # Geocoding, PDF
├── services/
│   └── openai.js               # AI service helpers
├── migrations/
│   └── 001_initial_schema.sql  # Database schema
├── nginx/
│   └── api.aiwholesail.com.conf # Nginx configuration
└── scripts/
    └── deploy.sh               # Deployment script
```

### Frontend Updates (`/src/`)

```
src/
├── lib/
│   └── api-client.ts           # NEW: Replaces Supabase client
├── contexts/
│   ├── AuthContext.new.tsx     # Updated for JWT auth
│   └── SubscriptionContext.new.tsx # Updated for new API
└── hooks/
    ├── useFavorites.new.ts     # Updated hook
    └── useLeads.new.ts         # Updated hook
```

## Migration Steps

### Step 1: Deploy Backend to Hetzner VPS

1. **SSH into your Hetzner VPS:**
   ```bash
   ssh root@your-hetzner-ip
   ```

2. **Clone/Upload the API code:**
   ```bash
   mkdir -p /root/aiwholesail-api
   # Upload the aiwholesail-api folder contents
   ```

3. **Run the deployment script:**
   ```bash
   cd /root/aiwholesail-api
   chmod +x scripts/deploy.sh
   ./scripts/deploy.sh
   ```

4. **Configure environment variables:**
   ```bash
   nano /root/aiwholesail-api/.env
   ```

   Fill in all the required values:
   - Database credentials (auto-generated during deployment)
   - JWT_SECRET (generate a secure 32+ character secret)
   - STRIPE_SECRET_KEY
   - STRIPE_WEBHOOK_SECRET
   - OPENAI_API_KEY / ANTHROPIC_API_KEY
   - SENDGRID_API_KEY
   - RAPIDAPI_KEY
   - PLIVO credentials

5. **Restart the API:**
   ```bash
   pm2 restart aiwholesail-api
   ```

6. **Setup SSL (after DNS is configured):**
   ```bash
   certbot --nginx -d api.aiwholesail.com
   ```

### Step 2: Update Frontend

1. **Add new environment variable:**
   Add to your `.env` file:
   ```env
   VITE_API_URL=https://api.aiwholesail.com
   ```

2. **Replace the contexts and hooks:**
   ```bash
   # Backup originals
   cp src/contexts/AuthContext.tsx src/contexts/AuthContext.supabase.tsx
   cp src/contexts/SubscriptionContext.tsx src/contexts/SubscriptionContext.supabase.tsx
   cp src/hooks/useFavorites.ts src/hooks/useFavorites.supabase.ts
   cp src/hooks/useLeads.ts src/hooks/useLeads.supabase.ts

   # Use new versions
   mv src/contexts/AuthContext.new.tsx src/contexts/AuthContext.tsx
   mv src/contexts/SubscriptionContext.new.tsx src/contexts/SubscriptionContext.tsx
   mv src/hooks/useFavorites.new.ts src/hooks/useFavorites.ts
   mv src/hooks/useLeads.new.ts src/hooks/useLeads.ts
   ```

3. **Update components that use `supabase.functions.invoke()`:**

   Replace:
   ```typescript
   import { supabase } from '@/integrations/supabase/client';

   const { data, error } = await supabase.functions.invoke('function-name', {
     body: { ... }
   });
   ```

   With:
   ```typescript
   import { ai, property, communications } from '@/lib/api-client';

   const response = await ai.propertyAnalysis({ ... });
   // or
   const response = await property.skipTrace({ ... });
   ```

4. **Update components that use `supabase.from()`:**

   Replace:
   ```typescript
   const { data, error } = await supabase
     .from('leads')
     .select('*')
     .eq('user_id', user.id);
   ```

   With:
   ```typescript
   import { leads } from '@/lib/api-client';

   const response = await leads.list();
   ```

### Step 3: Migrate Data

1. **Export data from Supabase:**
   ```sql
   -- Run in Supabase SQL Editor
   COPY (SELECT * FROM profiles) TO '/tmp/profiles.csv' CSV HEADER;
   COPY (SELECT * FROM subscribers) TO '/tmp/subscribers.csv' CSV HEADER;
   COPY (SELECT * FROM leads) TO '/tmp/leads.csv' CSV HEADER;
   COPY (SELECT * FROM favorites) TO '/tmp/favorites.csv' CSV HEADER;
   -- ... repeat for all tables
   ```

2. **Import to Hetzner PostgreSQL:**
   ```bash
   psql -U aiwholesail -d aiwholesail -c "\COPY profiles FROM '/tmp/profiles.csv' CSV HEADER"
   # ... repeat for all tables
   ```

   Note: You'll need to handle user authentication data separately since Supabase auth.users contains hashed passwords in a specific format.

### Step 4: Configure DNS

1. Point `api.aiwholesail.com` to your Hetzner VPS IP address
2. Wait for DNS propagation
3. Install SSL certificate

### Step 5: Testing

1. **Test API health:**
   ```bash
   curl https://api.aiwholesail.com/health
   ```

2. **Test authentication:**
   ```bash
   curl -X POST https://api.aiwholesail.com/api/auth/signin \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"password"}'
   ```

3. **Test frontend locally:**
   ```bash
   npm run dev
   # Try login, search, favorites, etc.
   ```

## API Endpoint Mapping

| Supabase Function | New API Endpoint |
|-------------------|------------------|
| `check-subscription` | `GET /api/stripe/subscription` |
| `create-checkout` | `POST /api/stripe/checkout` |
| `customer-portal` | `POST /api/stripe/portal` |
| `ai-property-analysis` | `POST /api/ai/property-analysis` |
| `ai-lead-scoring` | `POST /api/ai/lead-scoring` |
| `ai-wholesale-analyzer` | `POST /api/ai/wholesale-analyzer` |
| `advanced-damage-detection` | `POST /api/ai/damage-detection` |
| `analyze-deal` | `POST /api/ai/deal-analysis` |
| `enhanced-skip-trace` | `POST /api/property/skip-trace` |
| `secure-property-intelligence` | `POST /api/property/intelligence` |
| `off-market-discovery` | `POST /api/property/off-market` |
| `send-sendgrid-email` | `POST /api/communications/email/send` |
| `send-plivo-sms` | `POST /api/communications/sms/send` |
| `make-call` | `POST /api/communications/call/make` |
| `geocoding` | `POST /api/geocoding` |
| `generate-pdf-document` | `POST /api/pdf/generate` |

## Monitoring

```bash
# View PM2 status
pm2 status

# View logs
pm2 logs aiwholesail-api

# Monitor in real-time
pm2 monit

# View Nginx logs
tail -f /var/log/nginx/api.aiwholesail.com.access.log
tail -f /var/log/nginx/api.aiwholesail.com.error.log
```

## Rollback

To rollback to Supabase:

1. Restore original files:
   ```bash
   mv src/contexts/AuthContext.supabase.tsx src/contexts/AuthContext.tsx
   mv src/contexts/SubscriptionContext.supabase.tsx src/contexts/SubscriptionContext.tsx
   mv src/hooks/useFavorites.supabase.ts src/hooks/useFavorites.ts
   mv src/hooks/useLeads.supabase.ts src/hooks/useLeads.ts
   ```

2. Remove the `VITE_API_URL` from `.env`

3. Deploy frontend

## Security Checklist

- [ ] Strong JWT_SECRET (32+ characters)
- [ ] Database password secured
- [ ] SSL certificate installed
- [ ] Rate limiting enabled
- [ ] Firewall configured (only ports 22, 80, 443 open)
- [ ] PM2 running with non-root user (optional but recommended)
- [ ] Regular backups configured
- [ ] Monitoring/alerting setup
