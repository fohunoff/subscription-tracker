module.exports = {
  apps: [{
    name: 'subscription-tracker-api',
    script: 'index.js',
    instances: 1,
    exec_mode: 'fork', // Изменено с 'cluster' на 'fork'
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    // Graceful shutdown
    kill_timeout: 5000,
    wait_ready: false,
    listen_timeout: 10000
  }]
};
