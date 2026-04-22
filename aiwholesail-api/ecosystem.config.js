module.exports = {
  apps: [
    {
      name: 'aiwholesail-api',
      script: 'index.js',
      cwd: '/root/aiwholesail-api',
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
      repo: 'git@github.com:your-username/aiwholesail-api.git',
      path: '/root/aiwholesail-api',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};
