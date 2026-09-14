const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
// Explicit allowlist: never expose source, configuration files, .git or backups.
const routes={'/':'index.html','/index.html':'index.html','/app.html':'app.html','/assets/workspace.js':'assets/workspace.js','/assets/workspace.css':'assets/workspace.css'};
http.createServer((req, res) => {
  const route = new URL(req.url, 'http://localhost').pathname;
  if (!routes[route]) {
    res.writeHead(404); return res.end('Not found');
  }
  const type=route.endsWith('.js')?'application/javascript':route.endsWith('.css')?'text/css':'text/html';
  res.writeHead(200, {'Content-Type':type+'; charset=utf-8', 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
  fs.createReadStream(path.join(root, routes[route])).pipe(res);
}).listen(4173, '127.0.0.1', () => console.log('Agency Planner: http://127.0.0.1:4173'));
