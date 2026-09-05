// Opt-in isolated Edge test. Uses a new guest profile; never the user's cookies.
// Only reads carts and exercises the guest-login guard. Never writes a cart.
const fs=require('node:fs/promises'),path=require('node:path'),{spawn}=require('node:child_process'),assert=require('node:assert/strict');
const {BrowserLink}=require('../electron/browser-link.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 const root=path.resolve(__dirname,'..'),profile=path.join(root,'test-results','edge-bridge-'+Date.now());await fs.mkdir(profile,{recursive:true});
 const link=await new BrowserLink(path.join(profile,'link.json')).start();let edge,cdp,port;
 const requests=[],route=link.route.bind(link);link.route=(req,res)=>{requests.push({method:req.method,path:req.url,origin:req.headers.origin});return route(req,res)};
 try{
  edge=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-http2','--disable-sync','--disable-background-networking','--no-first-run','--no-default-browser-check','--user-data-dir='+profile,'--load-extension='+path.join(root,'browser-extension'),'--remote-debugging-port=0','about:blank'],{windowsHide:true,stdio:'ignore'});
  for(let i=0;i<80;i++){try{port=Number((await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);break}catch{await sleep(250)}}if(!port)throw new Error('Isolated Edge did not start.');
  const tabs=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json(),page=tabs.find(t=>t.type==='page');
  cdp=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{cdp.addEventListener('open',resolve,{once:true});cdp.addEventListener('error',reject,{once:true})});
  let id=0;const pending=new Map();cdp.addEventListener('message',event=>{const d=JSON.parse(event.data);if(pending.has(d.id)){pending.get(d.id)(d);pending.delete(d.id)}});
  const command=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;const timer=setTimeout(()=>{pending.delete(n);reject(new Error('CDP timeout'))},15000);pending.set(n,d=>{clearTimeout(timer);d.error?reject(new Error(d.error.message)):resolve(d.result)});cdp.send(JSON.stringify({id:n,method,params}))});
  await command('Page.navigate',{url:link.connectURL()});
  for(let i=0;i<80&&!link.status().connected;i++)await sleep(250);
  if(!link.status().connected){const d=await command('Runtime.evaluate',{expression:'document.body.innerText',returnByValue:true});throw new Error('Companion did not connect: '+d.result.value)}
  const report={checks:['Real Edge companion pairing and authenticated local connection'],isolated:true};
  const ww=await link.request({type:'cart-request',retailer:'woolworths',operation:'CustomerCart',variables:{}});
  assert.equal(ww.status,200);const response=JSON.parse(ww.text);assert(response.data?.customerCart||response.errors);report.checks.push('Read-only Woolworths request through the actual Edge extension');
  await assert.rejects(link.request({type:'cart-request',retailer:'newworld',operation:'getCart'}),/sign in|verification/i);report.checks.push('New World guest session requires sign-in');
  await fs.writeFile(path.join(root,'test-results','browser-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  await command('Browser.close').catch(()=>{});
 }catch(e){console.error('Connection request trace:',JSON.stringify(requests.slice(-12)));if(port){const tabs=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();for(const t of tabs.filter(t=>t.url.startsWith('https://www.woolworths.co.nz'))){const ws=new WebSocket(t.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));const output=await new Promise(r=>{ws.addEventListener('message',m=>r(JSON.parse(m.data)),{once:true});ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:'document.body.innerText.slice(0,800)',returnByValue:true}}))});console.error('Guest page:',output.result?.result?.value);ws.close()}}throw e}finally{cdp?.close();edge?.kill();await link.close()}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
