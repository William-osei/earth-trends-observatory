// AI-assisted implementation. See AI-DISCLOSURE.md.
import http from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
const root = resolve('dist');
const types = {'.html':'text/html; charset=utf-8','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.pdf':'application/pdf','.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation','.zip':'application/zip','.md':'text/markdown; charset=utf-8'};
http.createServer(async (req,res)=>{
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (pathname.endsWith('/') ? pathname+'index.html' : pathname));
    if (file !== root && !file.startsWith(root+sep)) {res.writeHead(403).end();return;}
    if (!(await stat(file)).isFile()) throw new Error('Not a file');
    res.writeHead(200, {'Content-Type':types[extname(file)] || 'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    res.end(await readFile(file));
  } catch {res.writeHead(404, {'Content-Type':'text/plain'}).end('Not found');}
}).listen(4173, '127.0.0.1', ()=>console.log('Local: http://127.0.0.1:4173'));
