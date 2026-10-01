// Dependency-free local launcher for the compiled application.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../dist/my-task-board/browser');
const port = Number(process.env.PORT || 4200);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
try { await stat(resolve(root, 'index.csr.html')); }
catch { console.error('Application non compilée. Exécutez npm ci puis npm run build, ou utilisez l’archive prête à lancer.'); process.exit(1); }
const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let file = resolve(root, '.' + pathname);
    if (file !== root && !file.startsWith(root + sep)) { response.writeHead(403); response.end(); return; }
    if (!extname(pathname)) file = resolve(root, 'index.csr.html');
    const data = await readFile(file);
    response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch { response.writeHead(404); response.end('Fichier introuvable'); }
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `Le port ${port} est déjà utilisé. Fermez l’ancienne instance ou définissez PORT.` : error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  const url = `http://localhost:${port}/board`;
  console.log(`MyTaskBoard : ${url}\nGardez cette fenêtre ouverte. Ctrl+C pour arrêter.\nLes données restent dans votre navigateur ; exportez une sauvegarde régulièrement.`);
  if (process.argv.includes('--open') && process.platform === 'win32') execFile('cmd.exe', ['/c', 'start', '', url], { windowsHide: true }, () => {});
});
