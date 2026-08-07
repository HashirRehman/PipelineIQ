'use strict';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { spawn } = require('child_process');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

// Pass through all additional args after -- to be the migration name
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: npm run migrate:new -- <migration_name>');
  process.exit(1);
}

const child = spawn('npx', ['supabase@latest', 'migration', 'new', ...args], {
  stdio: 'inherit',
  env: { ...process.env },
  shell: process.platform === 'win32',
});

child.on('exit', (code) => process.exit(code));
