module.exports = {
  apps: [
    {
      name: 'douxiaozhu',
      cwd: '../server',
      script: 'app.js',
      instances: 1,
      env: {
        PORT: 3000,
        JWT_SECRET: 'change-me',
        NODE_ENV: 'production'
      }
    }
  ]
};
