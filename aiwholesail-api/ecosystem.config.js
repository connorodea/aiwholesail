// NOTE: PM2 is NOT the canonical process manager for aiwholesail-api.
// Production uses the systemd unit at /etc/systemd/system/aiwholesail-api.service
// (Restart=always, MemoryMax=1G, hardened). This file is kept as a fallback /
// alternative reference only. Do not run pm2 commands against prod.

module.exports = {
  apps: [
    {
      name: 'aiwholesail-api',
      script: 'index.js',
      cwd: '/var/www/aiwholesail-api',
      instances: 'max', // Use all available CPU cores
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3202
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3202
      },
      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/log/pm2/aiwholesail-api-error.log',
      out_file: '/var/log/pm2/aiwholesail-api-out.log',
      combine_logs: true,
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      // Restart strategy
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ],

  deploy: {
    production: {
      user: 'root',
      host: 'your-hetzner-ip',
      ref: 'origin/main',
      repo: 'git@github.com:connorodea/aiwholesail.git',
      path: '/var/www/aiwholesail-api',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};
