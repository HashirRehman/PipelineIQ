'use strict';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { spawn } = require('child_process');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const args = ['supabase@latest', 'db', 'push'];

const child = spawn('npx', args, {
  stdio: 'inherit',
  env: { ...process.env },
  shell: process.platform === 'win32',
});

child.on('exit', (code) => process.exit(code));
