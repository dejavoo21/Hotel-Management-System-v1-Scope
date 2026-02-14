const { spawn } = require('node:child_process');

function run(cmd, args, opts = {}) {
  const child = spawn(cmd, args, {
    stdio: 'inherit',
    env: process.env,
    ...opts,
  });

  child.on('exit', (code, signal) => {
    if (signal) process.exit(1);
    process.exit(code ?? 1);
  });
}

const serviceName = String(process.env.RAILWAY_SERVICE_NAME || '').toLowerCase();
const port = String(process.env.PORT || '3000');

const isWeb =
  serviceName.includes('web') ||
  serviceName.includes('frontend') ||
  String(process.env.RUN_WEB || '') === '1';

if (isWeb) {
  // Serve the built Vite app from packages/web/dist.
  run('npx', ['serve', 'dist', '-s', '-l', port], {
    cwd: 'packages/web',
  });
} else {
  // Default to API service.
  run('npx', ['tsx', 'src/index.ts'], {
    cwd: 'packages/api',
  });
}

