module.exports = {
  apps: [
    {
      name: "zaodirect-backend",
      script: "src/server.js",
      cwd: ".",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: 4001,
      },
    },
  ],
};
