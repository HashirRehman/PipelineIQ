'use strict';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { spawn } = require('child_process');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const positionalRef = (process.argv[2] || '').trim();
const projectRef = (positionalRef || process.env.PROJECT_REF || '').trim();

if (!projectRef) {
  console.error('ERROR: PROJECT_REF env var is required to link.');
  process.exit(1);
}

console.log(`Linking to Supabase project: ${projectRef}`);

const args = ['supabase@latest', 'link', '--project-ref', projectRef];
const child = spawn('npx', args, {
  stdio: 'inherit',
  env: { ...process.env },
  shell: process.platform === 'win32',
});

child.on('exit', (code) => process.exit(code));
