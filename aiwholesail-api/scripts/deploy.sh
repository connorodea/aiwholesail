#!/bin/bash

# AIWholesail API Deployment Script for Hetzner VPS
# Run this script on your Hetzner VPS to deploy the API

set -e

echo "========================================="
echo "AIWholesail API Deployment Script"
echo "========================================="

# Configuration
# Note: this is the legacy interactive bootstrap script for first-time VPS setup.
# Routine deploys are now handled by systemd + the GitHub Actions workflow at
# .github/workflows/deploy.yml — do NOT use this script for ongoing deploys.
API_DIR="/var/www/aiwholesail-api"
DB_NAME="aiwholesail"
DB_USER="aiwholesail"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Step 1: Install dependencies
install_dependencies() {
    log_info "Installing system dependencies..."
    apt-get update
    apt-get install -y nodejs npm postgresql postgresql-contrib nginx certbot python3-certbot-nginx

    # Install PM2 globally
    npm install -g pm2

    log_info "Dependencies installed successfully"
}

# Step 2: Setup PostgreSQL
setup_database() {
    log_info "Setting up PostgreSQL database..."

    # Check if database exists
    if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
        log_warn "Database $DB_NAME already exists"
    else
        # Generate secure password
        DB_PASSWORD=$(openssl rand -base64 32)

        # Create user and database
        sudo -u postgres psql <<EOF
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE $DB_NAME OWNER $DB_USER;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
EOF

        log_info "Database created. Save this password: $DB_PASSWORD"
        echo "DB_PASSWORD=$DB_PASSWORD" >> /root/.aiwholesail_credentials
    fi
}

# Step 3: Run migrations
run_migrations() {
    log_info "Running database migrations..."

    if [ -f "$API_DIR/migrations/001_initial_schema.sql" ]; then
        sudo -u postgres psql -d $DB_NAME -f "$API_DIR/migrations/001_initial_schema.sql"
        log_info "Migrations completed successfully"
    else
        log_error "Migration file not found"
        exit 1
    fi
}

# Step 4: Setup application
setup_application() {
    log_info "Setting up application..."

    cd $API_DIR

    # Install npm dependencies
    npm install --production

    # Create .env file if not exists
    if [ ! -f ".env" ]; then
        log_warn ".env file not found. Please create it from .env.example"
        cp .env.example .env
        log_info "Created .env file from .env.example. Please update with your credentials."
    fi

    log_info "Application setup complete"
}

# Step 5: Setup Nginx
setup_nginx() {
    log_info "Setting up Nginx..."

    # Copy Nginx config
    if [ -f "$API_DIR/nginx/api.aiwholesail.com.conf" ]; then
        cp "$API_DIR/nginx/api.aiwholesail.com.conf" /etc/nginx/sites-available/api.aiwholesail.com

        # Create symlink if not exists
        if [ ! -L /etc/nginx/sites-enabled/api.aiwholesail.com ]; then
            ln -s /etc/nginx/sites-available/api.aiwholesail.com /etc/nginx/sites-enabled/
        fi

        # Test Nginx config
        nginx -t

        # Reload Nginx
        systemctl reload nginx

        log_info "Nginx configured successfully"
    else
        log_error "Nginx config file not found"
    fi
}

# Step 6: Setup SSL
setup_ssl() {
    log_info "Setting up SSL certificate..."

    # Check if certificate exists
    if [ -d "/etc/letsencrypt/live/api.aiwholesail.com" ]; then
        log_warn "SSL certificate already exists"
    else
        certbot --nginx -d api.aiwholesail.com --non-interactive --agree-tos -m your-email@example.com
        log_info "SSL certificate installed successfully"
    fi
}

# Step 7: Start application with PM2
start_application() {
    log_info "Starting application with PM2..."

    cd $API_DIR

    # Stop existing process if running
    pm2 delete aiwholesail-api 2>/dev/null || true

    # Start with ecosystem config
    pm2 start ecosystem.config.js --env production

    # Save PM2 process list
    pm2 save

    # Setup PM2 to start on boot
    pm2 startup systemd -u root --hp /root

    log_info "Application started successfully"
}

# Step 8: Create log directory
setup_logging() {
    log_info "Setting up logging..."

    mkdir -p /var/log/pm2
    chmod 755 /var/log/pm2

    log_info "Logging setup complete"
}

# Main deployment function
deploy() {
    log_info "Starting deployment..."

    install_dependencies
    setup_database
    run_migrations
    setup_application
    setup_logging
    setup_nginx
    # setup_ssl  # Uncomment after DNS is configured
    start_application

    log_info "========================================="
    log_info "Deployment complete!"
    log_info "========================================="
    log_info "API is running at: http://api.aiwholesail.com"
    log_info ""
    log_info "Next steps:"
    log_info "1. Update .env file with your API keys"
    log_info "2. Configure DNS to point to this server"
    log_info "3. Run: certbot --nginx -d api.aiwholesail.com"
    log_info "4. Test the API: curl http://localhost:3202/health"
    log_info ""
    log_info "Useful commands:"
    log_info "  pm2 status          - Check app status"
    log_info "  pm2 logs            - View logs"
    log_info "  pm2 restart all     - Restart app"
    log_info "  pm2 monit           - Monitor in real-time"
}

# Run deployment
deploy
