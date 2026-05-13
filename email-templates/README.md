# AIWholesail HTML Email Templates

This folder contains email templates for AI Wholesail that can be copied into SendGrid, Resend, Postmark, or similar.

## Trial Lifecycle Templates (added 2026-05-12)

The 5-step trial-lifecycle sequence identified in `marketing/EMAIL_LIFECYCLE_AUDIT_2026-05-12.md` as the highest-revenue email gap (estimated 8–18 percentage point lift to trial-to-paid).

| File | Trigger | Suggested subject line |
|---|---|---|
| `_trial-base.html` | — | Template scaffold for new lifecycle emails |
| `trial-day-minus-2.html` | T-48h before trial expires | `{{first_name}}, 2 days left in your AIWholesail trial` |
| `trial-day-minus-1.html` | T-24h before expiration | `{{first_name}}, your AIWholesail trial ends tomorrow` |
| `trial-day-0.html` | At trial expiration | `Your AIWholesail trial just ended (saved deals still here)` |
| `trial-day-plus-3.html` | 3 days post-expiration, no plan | `30% off your first 2 months of AIWholesail` |
| `trial-day-plus-14.html` | 14 days post-expiration, no plan | `Heads up — we're closing your AIWholesail data in 16 days` |

### Trigger plan

Recommended infrastructure: **Stripe webhooks → Supabase edge function → Resend send**. The `subscription.trial_will_end` event fires 72h before expiration (configurable) — use it to schedule the day -2 and day -1 sends. For post-expiration sends, a Supabase cron checks daily for trials that hit T+0, T+3, T+14.

Variables expected in every lifecycle template:
- `{{first_name}}` (required)
- `{{primary_cta_url}}` (Stripe Checkout link with plan + UTM tags)
- `{{unsubscribe_url}}` (Resend / SendGrid auto-injects this in some flows)

Additional per-template variables:
- **Day -2:** `{{deals_scored}}`, `{{calculators_used}}`, `{{top_market}}`
- **Day -1:** `{{top_deal_score}}`, `{{top_deal_address}}`, `{{deals_above_80}}`
- **Day 0:** `{{saved_deals_count}}`
- **Day +14:** `{{saved_deals_count}}`

### Style guide for new lifecycle emails

Match the visual identity of these templates:
- 600px max width, table-based layout (Outlook compatibility)
- Dark background `#0a0a0a` with `#0f0f0f` card and `rgba(255,255,255,0.05)` borders
- Brand cyan `#06b6d4` for CTAs, links, accent text
- Founder signature with phone (248-881-4147) and email
- Plain-text fallback recommended for filter avoidance

### Subject-line patterns

Use these from `marketing/EMAIL_LIFECYCLE_AUDIT_2026-05-12.md`:
- Direct value: `{{first_name}}, your AIWholesail trial ends tomorrow`
- Specific number: `23 deals scored 80+ in {{user_city}} this week`
- Founder voice: `Quick note from Connor (founder)`
- Avoid: "Don't miss out", "Last chance", excessive emoji, all-caps anything

---

## Transactional Templates (existing)

### 1. Property Alert Template (`property-alert-template.html`)
- **Purpose**: Notify users when a new property matches their alert criteria
- **Features**: Property image, details, wholesale analysis, profit calculations
- **Variables to Replace**:
  - `{{property_image_url}}` - Property main image
  - `{{property_address}}` - Full property address
  - `{{property_price}}` - Listed price
  - `{{property_status}}` - Property status (For Sale, etc.)
  - `{{bedrooms}}` - Number of bedrooms
  - `{{bathrooms}}` - Number of bathrooms
  - `{{sqft}}` - Square footage
  - `{{estimated_arv}}` - After Repair Value estimate
  - `{{estimated_profit}}` - Calculated profit potential
  - `{{profit_margin}}` - Profit margin percentage
  - `{{view_property_url}}` - Link to view full property details
  - `{{skip_trace_url}}` - Link to skip trace owner
  - `{{alert_location}}` - Location where alert is set
  - `{{manage_alerts_url}}` - Link to manage alerts
  - `{{unsubscribe_url}}` - Unsubscribe link

### 2. Analysis Complete Template (`analysis-complete-template.html`)
- **Purpose**: Notify users when property analysis is complete
- **Features**: Analysis summary, key metrics, AI insights, recommended actions
- **Variables to Replace**:
  - `{{user_name}}` - User's first name
  - `{{property_address}}` - Property address
  - `{{estimated_profit}}` - Estimated profit
  - `{{roi_percentage}}` - Return on investment percentage
  - `{{arv_estimate}}` - After Repair Value
  - `{{confidence_score}}` - AI confidence score
  - `{{insight_1}}`, `{{insight_2}}`, `{{insight_3}}` - AI-generated insights
  - `{{action_item_1}}`, `{{action_item_2}}`, `{{action_item_3}}` - Recommended actions
  - `{{view_full_analysis_url}}` - Link to full analysis
  - `{{schedule_walkthrough_url}}` - Link to schedule walkthrough
  - `{{contact_owner_url}}` - Link to contact owner
  - `{{processing_time}}` - How long analysis took
  - `{{dashboard_url}}` - Link to dashboard
  - `{{support_url}}` - Support link

### 3. Welcome Template (`welcome-template.html`)
- **Purpose**: Welcome new users and guide them through platform features
- **Features**: Onboarding steps, feature highlights, support resources
- **Variables to Replace**:
  - `{{user_name}}` - User's first name
  - `{{get_started_url}}` - Link to start using platform
  - `{{setup_alerts_url}}` - Link to set up alerts
  - `{{search_properties_url}}` - Link to property search
  - `{{skip_trace_url}}` - Link to skip trace feature
  - `{{help_center_url}}` - Link to help center
  - `{{contact_support_url}}` - Support contact link
  - `{{unsubscribe_url}}` - Unsubscribe link
  - `{{privacy_policy_url}}` - Privacy policy link

## SendGrid Setup Instructions

### Step 1: Copy Template HTML
1. Open the desired template file
2. Copy the entire HTML content
3. Go to SendGrid Design Editor
4. Create a new template
5. Paste the HTML into the code editor

### Step 2: Configure Dynamic Content
1. Replace template variables (e.g., `{{property_address}}`) with SendGrid substitution tags
2. Use SendGrid's dynamic template syntax: `{{property_address}}`
3. Test with sample data to ensure proper rendering

### Step 3: Update Branding
- Replace `https://your-domain.com/logo-white.png` with your actual logo URL
- Replace `https://your-domain.com/logo-small.png` with your small logo URL
- Update footer links and contact information
- Customize colors if needed (current design uses purple/blue gradient theme)

### Step 4: Test Templates
1. Send test emails to verify rendering across different email clients
2. Test mobile responsiveness
3. Verify all links work correctly
4. Check dynamic content substitution

## Design Features

### Mobile Responsive
- Table-based layout for maximum email client compatibility
- Responsive breakpoints for mobile devices
- Optimized typography and spacing for small screens

### Email Client Compatibility
- Tested for Outlook, Gmail, Apple Mail, and other major clients
- Inline CSS for maximum compatibility
- Fallback styles for older email clients

### Professional Design
- Modern gradient backgrounds
- Clean typography using system fonts
- Consistent color scheme
- Interactive buttons and elements
- Proper spacing and visual hierarchy

## Color Scheme
- Primary: Purple/Blue gradients (#667eea to #764ba2)
- Success: Green (#10b981 to #059669)
- Warning: Yellow/Orange (#f59e0b to #fbbf24)
- Info: Blue (#0ea5e9 to #0c4a6e)
- Background: Light gray (#f8fafc)

## Support
If you need help customizing these templates or setting up SendGrid integration, please contact our support team.