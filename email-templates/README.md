# SendGrid HTML Email Templates

This folder contains professionally designed HTML email templates for AI Wholesail that can be copied and pasted directly into SendGrid's Design Editor.

## Templates Included

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