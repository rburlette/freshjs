import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const types = {'.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'};
export function serve(port = 8080) {
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const path = resolve(root, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
      if (!path.startsWith(root.endsWith(sep) ? root : root + sep)) {
        res.writeHead(403).end(); return;
      }
      const data = await readFile(path);
      res.writeHead(200, {'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store'}).end(data);
    } catch { res.writeHead(404).end('Not found'); }
  });
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve(server)));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await serve(Number(process.env.PORT || 8080));
  console.log('Open http://127.0.0.1:' + (process.env.PORT || 8080));
}
