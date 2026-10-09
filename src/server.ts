import { createNodeRequestHandler, isMainModule } from '@angular/ssr/node';
import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');
const app = express();

// Personal data is browser-local: serve the client shell directly.
// HTML must not be cached for a year along with versioned assets.
app.use(express.static(browserDistFolder, {
  index: false,
  redirect: false,
  maxAge: '1y',
  setHeaders: (res, path) => {
    if (/\.(?:html|json|webmanifest)$/.test(path) || path.endsWith('ngsw-worker.js')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(resolve(browserDistFolder, 'index.csr.html'));
});

if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, () => console.log('MyTaskBoard listening on http://localhost:' + port));
}

export const reqHandler = createNodeRequestHandler(app);
