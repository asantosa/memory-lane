const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createStory, narrate, GenerationError } = require('./generation.cjs');
const ROOT = path.resolve(__dirname, '../web');
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.png':'image/png', '.ttf':'font/ttf', '.webmanifest':'application/manifest+json' };
const key = process.env.OPENAI_API_KEY;
let active = 0;
function json(res,status,data) { res.writeHead(status, {'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data)); }
async function body(req) {
  let bytes = 0; const chunks = [];
  for await (const chunk of req) { bytes += chunk.length; if(bytes > 16000000) throw new GenerationError('The preview is too large. Select fewer photos or shorter clips.',413); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new GenerationError('The request could not be read.',400); }
}
function createServer() {
  return http.createServer(async (req,res) => {
    try {
      const url = new URL(req.url,'http://localhost');
      if(url.pathname.startsWith('/api/')) {
        const origin = req.headers.origin;
        if(req.headers['sec-fetch-site'] === 'cross-site' || (origin && new URL(origin).host !== req.headers.host && origin !== process.env.ALLOWED_ORIGIN)) return json(res,403,{error:'Open Memory Lane directly to create a story.'});
        if(url.pathname === '/api/config' && req.method === 'GET') return json(res,200,{configured:Boolean(key)});
        if(req.method !== 'POST' || !['/api/story','/api/narrate'].includes(url.pathname)) return json(res,404,{error:'Not found'});
        if(!req.headers['content-type']?.startsWith('application/json')) return json(res,415,{error:'Send JSON data.'});
        if(active >= 2) return json(res,429,{error:'Another story is being created. Try again in a moment.'});
        active++;
        try {
          const input = await body(req);
          if(url.pathname === '/api/story') return json(res,200,await createStory(input,{key}));
          const audio = await narrate(input.text,{key});
          res.writeHead(200,{'Content-Type':'audio/wav','Cache-Control':'no-store'});res.end(audio);return;
        } finally { active--; }
      }
      if(!['GET','HEAD'].includes(req.method)) { res.writeHead(405);res.end();return; }
      let name = decodeURIComponent(url.pathname);if(name.endsWith('/')) name+='index.html';
      const file = path.resolve(ROOT,'.'+name);
      if(!file.startsWith(ROOT+path.sep)) {res.writeHead(403);res.end();return;}
      const data = await fs.readFile(file);
      res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'});
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch(error) {
      if(error.code === 'ENOENT' || error.code === 'EISDIR') {res.writeHead(404);res.end('Not found');return;}
      json(res,error.status||500,{error:error instanceof GenerationError?error.message:'Something went wrong. Your draft is kept; please try again.'});
    }
  });
}
if(require.main === module) createServer().listen(Number(process.env.PORT)||4173,'127.0.0.1',()=>console.log('Memory Lane: http://127.0.0.1:'+ (process.env.PORT||4173) + (key?' · AI connected':' · AI key not configured')));
module.exports={createServer};
