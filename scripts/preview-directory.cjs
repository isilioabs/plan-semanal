// Developer-only fixture, served on loopback separately from the real application.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const modules={'/tests/fixtures/directory-preview.mjs':'tests/fixtures/directory-preview.mjs','/src/workspace/directory.js':'src/workspace/directory.js','/src/workspace/directory-data.mjs':'src/workspace/directory-data.mjs'};
http.createServer((req,res)=>{
 if(modules[req.url]){res.setHeader('Content-Type','application/javascript; charset=utf-8');return res.end(fs.readFileSync(path.join(root,modules[req.url])));}
 if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');return res.end(fs.readFileSync(path.join(root,'src/workspace/style.css')));}
 if(req.url!=='/'){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Directorios · Prueba aislada</title><link rel="stylesheet" href="/style.css"><div id="app"></div><script type="module" src="/tests/fixtures/directory-preview.mjs"></script></html>');
}).listen(4174,'127.0.0.1',()=>console.log('Directory fixture: http://127.0.0.1:4174'));

