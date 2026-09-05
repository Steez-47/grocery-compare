const http=require('node:http');
const fs=require('node:fs/promises');
const crypto=require('node:crypto');
const PORT=47391;
const roots={newworld:'https://www.newworld.co.nz',woolworths:'https://www.woolworths.co.nz'};
const secret=()=>crypto.randomBytes(32).toString('hex');
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
const extensionOrigin=s=>/^chrome-extension:\/\/[a-p]{32}$/.test(s||'');
class BrowserLink{
 constructor(file,{port=PORT,timeout=45000}={}){this.file=file;this.port=port;this.timeout=timeout;this.pending=new Map();this.queue=[];this.lastSeen=0;this.credentials=null;this.error='';}
 async start(){
  try{const data=JSON.parse(await fs.readFile(this.file,'utf8'));if(extensionOrigin(data.origin)&&/^[a-f0-9]{64}$/.test(data.token))this.credentials=data;}catch{}
  this.server=http.createServer((req,res)=>this.route(req,res).catch(()=>{if(!res.headersSent)res.writeHead(400);res.end()}));
  await new Promise((resolve,reject)=>{this.server.once('error',reject);this.server.listen(this.port,'127.0.0.1',resolve)});this.port=this.server.address().port;return this;
 }
 status(){return {connected:!!this.credentials&&Date.now()-this.lastSeen<35000,paired:!!this.credentials,error:this.error};}
 connectURL(){this.pairing={code:secret(),expires:Date.now()+120000};return `http://127.0.0.1:${this.port}/connect#${this.pairing.code}`;}
 async disconnect(){this.credentials=null;this.lastSeen=0;this.pairing=null;await fs.unlink(this.file).catch(()=>{});this.abort();}
 abort(){this.waiting?.();this.waiting=null;for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('Browser connection closed.'))}this.pending.clear();this.queue=[];}
 close(){this.abort();this.server?.closeAllConnections();return new Promise(resolve=>this.server?this.server.close(resolve):resolve());}
 request(command){
  if(!this.status().connected)return Promise.reject(new Error('Connect your browser first.'));
  if(this.pending.size>=20)return Promise.reject(new Error('The browser is busy. Try again shortly.'));
  const id=crypto.randomUUID();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);this.queue=this.queue.filter(x=>x.id!==id);reject(new Error('The browser did not respond. Open the store, finish signing in, then try again.'))},this.timeout);this.pending.set(id,{resolve,reject,timer});this.queue.push({...command,id,deadline:Date.now()+this.timeout});this.waiting?.();});
 }
 async read(req){let text='';for await(const chunk of req){text+=chunk;if(text.length>2000000)throw new Error('Too large')}return JSON.parse(text||'{}');}
 async route(req,res){
  if(req.headers.host!==`127.0.0.1:${this.port}`){res.writeHead(403);return res.end()}
  // Edge omits Origin on extension GETs. A custom header plus the secret is
  // required there; websites cannot send it without an approved CORS preflight.
  const origin=req.headers.origin||req.headers['x-grocery-origin'],path=req.url;
  const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
  if(req.method==='GET'&&path==='/connect'){
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'"});
   return res.end('<!doctype html><html><meta charset="utf-8"><title>Connect Grocery Compare</title><style>body{font:16px system-ui;background:#17201c;color:#e4ebe6;max-width:520px;margin:12vh auto;padding:28px}h1{font-size:24px}p{color:#b3c1b8;line-height:1.6}</style><h1>Connect Grocery Compare</h1><p id="connection-status">Install the Grocery Compare browser companion, then click Connect browser in the app again.</p></html>');
  }
  if(!extensionOrigin(origin)||(path!=='/pair'&&origin!==this.credentials?.origin)){return reply(403,{error:'Not allowed'})}
  res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
  if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type,X-Grocery-Origin');res.setHeader('Access-Control-Allow-Methods','POST,GET');return reply(204,null)}
  if(path==='/pair'&&req.method==='POST'){
   const body=await this.read(req);if(req.headers.origin!==origin||!this.pairing||Date.now()>this.pairing.expires||!equal(body.code,this.pairing.code))return reply(403,{error:'Connection code expired. Click Connect browser in the app again.'});
   const credentials={origin,token:secret()};await fs.writeFile(this.file,JSON.stringify(credentials));this.abort();this.credentials=credentials;this.pairing=null;this.lastSeen=Date.now();return reply(200,{token:credentials.token});
  }
  if(!equal(req.headers.authorization,'Bearer '+this.credentials?.token))return reply(403,{error:'Not connected'});
  if(path==='/poll'&&req.method==='GET'){
   if(this.waiting)return reply(409,{error:'Already polling'});this.lastSeen=Date.now();
   if(!this.queue.length)await new Promise(resolve=>{const timer=setTimeout(done,20000);const self=this;function done(){clearTimeout(timer);if(self.waiting===done)self.waiting=null;res.off('close',done);resolve()}this.waiting=done;res.once('close',done)});
   if(res.destroyed)return;if(origin!==this.credentials?.origin||!equal(req.headers.authorization,'Bearer '+this.credentials?.token))return reply(403,{error:'Disconnected'});this.lastSeen=Date.now();return reply(200,this.queue.shift()||null);
  }
  if(path==='/result'&&req.method==='POST'){
   const body=await this.read(req),pending=this.pending.get(body.id);if(!pending)return reply(410,{error:'Expired request'});
   this.pending.delete(body.id);clearTimeout(pending.timer);this.lastSeen=Date.now();if(body.error)pending.reject(new Error(String(body.error).slice(0,500)));else pending.resolve(body.result);return reply(200,{ok:true});
  }
  return reply(404,{error:'Not found'});
 }
}
// Only these cart operations can cross the browser connection. No generic proxy.
function cartOperation(retailer,url,init={}){
 const u=new URL(url),method=(init.method||'GET').toUpperCase();
 if(retailer==='woolworths'&&u.origin===roots.woolworths&&u.pathname==='/api/graphql'&&method==='POST'){
  const body=JSON.parse(init.body),allowed=['CustomerCart','SetCartShoppingMode','SetCartLineItemQuantity'];
  if(!allowed.includes(body.operationName))throw new Error('Unsupported browser operation.');
  return {type:'cart-request',retailer,operation:body.operationName,variables:body.variables||{}};
 }
 if(retailer==='newworld'&&u.origin==='https://api-prod.newworld.co.nz'){
  if(u.pathname==='/v1/edge/cart'&&['GET','POST'].includes(method))return {type:'cart-request',retailer,operation:method==='GET'?'getCart':'setItems',body:init.body?JSON.parse(init.body):undefined};
  if(/^\/v1\/edge\/cart\/store\/[a-zA-Z0-9-]+$/.test(u.pathname)&&method==='POST')return {type:'cart-request',retailer,operation:'setStore',storeId:u.pathname.split('/').at(-1)};
 }
 throw new Error('Unsupported browser operation.');
}
function transport(link,retailer){return async(url,init)=>{const result=await link.request(cartOperation(retailer,url,init));if(!result||!Number.isInteger(result.status)||typeof result.text!=='string')throw new Error('Invalid browser response.');return {ok:result.status>=200&&result.status<300,status:result.status,text:async()=>result.text};};}
module.exports={BrowserLink,PORT,roots,cartOperation,transport};
