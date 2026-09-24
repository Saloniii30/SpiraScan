// A small local preview server. Run it with npm start.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleProcessing } from './processing-api.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml'
};

http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://localhost:${port}`);
    const pathname = decodeURIComponent(url.pathname);

    if (pathname === '/api/process') {
      await handleProcessing(request, response, root);
      return;
    }

    const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
    const filePath = path.resolve(root, relativePath);
    const extension = path.extname(filePath);

    const isOutsideProject = !filePath.startsWith(root + path.sep);
    const isUnsupportedFile = !contentTypes[extension];
    const isHiddenPath = relativePath
      .split(/[\\/]/)
      .some((part) => part.startsWith('.'));

    if (isOutsideProject || isUnsupportedFile || isHiddenPath) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }

    const content = await readFile(filePath);
    response.writeHead(200, { 'Content-Type': contentTypes[extension] });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end('Page not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`SpiraScan is ready at http://127.0.0.1:${port}`);
});
