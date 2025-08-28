module.exports = {
  apps: [{
    name: 'telecom-app',
    script: 'server.js',
    cwd: '/www/wwwroot/xh.nfeyre.top',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      NEXTAUTH_URL: 'https://xh.nfeyre.top',
      NEXTAUTH_SECRET: 'D5PRq04w+NhcD2PuWRQjrod5URTzGtIs90xcREET93Q=',
      DATABASE_URL: 'file:./dev.db'
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: '/root/.pm2/logs/telecom-app-error.log',
    out_file: '/root/.pm2/logs/telecom-app-out.log',
    log_file: '/root/.pm2/logs/telecom-app-combined.log',
    max_memory_restart: '1G',
    kill_timeout: 5000,
    listen_timeout: 3000,
    min_uptime: '10s',
    max_restarts: 10
  }]
};