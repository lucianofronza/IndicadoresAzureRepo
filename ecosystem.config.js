module.exports = {
  apps: [
    {
      name: 'backend',
      cwd: './backend',
      script: 'npm',
      args: 'run dev',
      env: {
        NODE_ENV: 'development',
        PORT: 8080,
      },
      watch: ['src'],
      ignore_watch: ['node_modules', 'logs'],
      instances: 1,
      autorestart: true,
      max_memory_restart: '1G',
    },
    {
      name: 'frontend',
      cwd: './frontend',
      script: 'npm',
      args: 'run dev',
      env: {
        NODE_ENV: 'development',
        PORT: 5173,
      },
      watch: ['src'],
      ignore_watch: ['node_modules', 'dist'],
      instances: 1,
      autorestart: true,
      max_memory_restart: '1G',
    },
  ],
};
