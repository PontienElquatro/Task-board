import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const manifestPath = require.resolve('playwright/package.json');
const manifest = require('playwright/package.json');
const cli = resolve(dirname(manifestPath), manifest.bin.playwright);
const args = ['install', 'chromium'];
if (process.platform === 'linux' && process.env.CI) args.push('--with-deps');
const child = spawn(process.execPath, [cli, ...args], {
  cwd: root, stdio: 'inherit',
  env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || resolve(root, 'tmp/playwright-browsers') },
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
