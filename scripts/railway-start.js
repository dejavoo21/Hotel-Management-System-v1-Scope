const { spawn, spawnSync } = require('node:child_process');

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

function runSync(cmd, args, opts = {}) {
  console.log(`Running: ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    env: process.env,
    ...opts,
  });
  if (result.status !== 0) {
    console.error(`Command failed with exit code ${result.status}`);
    return false;
  }
  return true;
}

function runMigrations() {
  // Only run migrations if DATABASE_URL is set and not in demo mode
  if (!process.env.DATABASE_URL || process.env.DEMO_MODE === 'true') {
    console.log('Skipping migrations (no DATABASE_URL or DEMO_MODE enabled)');
    return true;
  }
  
  console.log('Running database migrations...');
  const success = runSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: 'packages/api',
  });
  
  if (success) {
    console.log('Migrations completed successfully');
  }
  return success;
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
  // Run migrations before starting API
  runMigrations();
  
  // Check if we should run backfill (one-time flag)
  if (process.env.RUN_BACKFILL === 'true') {
    console.log('Running data backfill...');
    runSync('npx', ['tsx', 'scripts/backfill-data.ts'], {
      cwd: 'packages/api',
    });
  }
  
  // Default to API service.
  run('npx', ['tsx', 'src/index.ts'], {
    cwd: 'packages/api',
  });
}

