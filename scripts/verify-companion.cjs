// Real extension smoke test in a disposable Edge profile. No user account or cart writes.
const fs=require('node:fs/promises'),path=require('node:path'),{spawn}=require('node:child_process'),assert=require('node:assert/strict');
const {BrowserLink}=require('../electron/browser-link.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function socket(url){const ws=new WebSocket(url);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})});let id=0;const pending=new Map();ws.addEventListener('message',e=>{const d=JSON.parse(e.data);pending.get(d.id)?.(d)});return{close:()=>ws.close(),call:(method,params={})=>new Promise((resolve,reject)=>{const n=++id,t=setTimeout(()=>{pending.delete(n);reject(new Error('Timed out: '+method))},15000);pending.set(n,d=>{clearTimeout(t);pending.delete(n);d.error?reject(new Error(d.error.message)):resolve(d.result)});ws.send(JSON.stringify({id:n,method,params}))})};}
async function main(){
 const root=path.resolve(__dirname,'..'),out=path.join(root,'test-results','companion'),profile=path.join(out,'edge-'+Date.now());await fs.mkdir(profile,{recursive:true});
 const link=await new BrowserLink(path.join(profile,'link.json')).start();let edge,page,popup,worker;
 const report={isolated:true,checks:[],limitations:['No signed-in Google/email or retailer account testing','Retailer writes not performed']};
 try{
  edge=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-sync','--no-first-run','--no-default-browser-check','--user-data-dir='+profile,'--load-extension='+path.join(root,'browser-extension'),'--remote-debugging-port=0','about:blank'],{windowsHide:true,stdio:'ignore'});
  let port;for(let i=0;i<80;i++){try{port=Number((await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);break}catch{await sleep(250)}}if(!port)throw new Error('Isolated Edge did not start');
  const list=async()=>await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
  let targets;for(let i=0;i<40;i++){targets=await list();if(targets.some(t=>t.type==='service_worker'))break;await sleep(250)}
  const service=targets.find(t=>t.type==='service_worker'&&t.url.endsWith('/background.js'));assert(service,'Extension worker loaded');worker=await socket(service.webSocketDebuggerUrl);
  const base='chrome-extension://'+new URL(service.url).host,initial=targets.find(t=>t.type==='page'&&t.url==='about:blank');page=await socket(initial.webSocketDebuggerUrl);
  await page.call('Page.navigate',{url:link.connectURL()});
  for(let i=0;i<60&&!link.status().connected;i++)await sleep(100);
  if(!link.status().connected){console.log('Pairing page:',JSON.stringify(await page.call('Runtime.evaluate',{expression:'({url:location.href,text:document.body.innerText})',returnByValue:true})));console.log('Worker state:',JSON.stringify(await worker.call('Runtime.evaluate',{expression:'chrome.storage.local.get(null)',awaitPromise:true,returnByValue:true})));}
  assert(link.status().connected,'Extension paired');report.checks.push('Actual extension loads and pairs with the desktop bridge');
  const evaluate=async(client,expression)=>{const r=await client.call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text+': '+r.exceptionDetails.exception?.description);return r.result.value};
  const created=await evaluate(worker,`chrome.tabs.create({url:${JSON.stringify(base+'/popup.html')}})`);
  for(let i=0;i<40;i++){targets=await list();if(targets.some(t=>t.url===base+'/popup.html'))break;await sleep(100)}
  popup=await socket(targets.find(t=>t.url===base+'/popup.html').webSocketDebuggerUrl);
  await popup.call('Emulation.setDeviceMetricsOverride',{width:380,height:650,deviceScaleFactor:1,mobile:false});
  await popup.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});
  for(let i=0;i<50;i++){if((await evaluate(popup,'document.getElementById("status")?.textContent'))==='Ready to send')break;await sleep(100)}
  assert.equal(await evaluate(popup,'document.getElementById("status").textContent'),'Ready to send');
  assert.equal(await evaluate(popup,'document.getElementById("woolworths-status").textContent'),'Cart access off');
  const shot=await popup.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await fs.writeFile(path.join(out,'popup-light.png'),Buffer.from(shot.data,'base64'));
  await popup.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'}]});await sleep(100);const dark=await popup.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await fs.writeFile(path.join(out,'popup-dark.png'),Buffer.from(dark.data,'base64'));
  assert(await evaluate(popup,'document.documentElement.scrollWidth <= innerWidth'));report.checks.push('Real popup: connected status, optional store access off, light/dark layout without overflow');
  await assert.rejects(link.request({type:'cart-request',retailer:'woolworths',operation:'CustomerCart',variables:{}}),/Enable Woolworths access/);report.checks.push('Actual browser refuses cart execution without retailer permission');
  await evaluate(popup,'document.getElementById("toggle").click()');for(let i=0;i<60;i++){if(await evaluate(popup,'document.getElementById("status").textContent === "Companion paused"'))break;await sleep(100)}
  assert.equal(await evaluate(popup,'document.getElementById("status").textContent'),'Companion paused');assert.equal(link.status().connected,false);report.checks.push('Pause stops the bridge and updates both ends');
  await evaluate(popup,'document.getElementById("toggle").click()');for(let i=0;i<60&&!link.status().connected;i++)await sleep(100);assert(link.status().connected);report.checks.push('Resume reconnects without repairing');
  // A synthetic cookie proves these control actions do not clear cookie storage; it is not a real login test.
  await page.call('Network.setCookie',{name:'grocery-companion-test',value:'unchanged',url:'https://accounts.google.com/',secure:true,httpOnly:true});
  await evaluate(popup,'document.getElementById("disconnect").click()');for(let i=0;i<60&&link.status().paired;i++)await sleep(100);assert.equal(link.status().paired,false);
  const cookies=await page.call('Network.getCookies',{urls:['https://accounts.google.com/']});assert(cookies.cookies.some(c=>c.name==='grocery-companion-test'&&c.value==='unchanged'));report.checks.push('Disconnect revokes app pairing and preserves an isolated synthetic Google-domain cookie');
  const denied=await evaluate(worker,`chrome.scripting.executeScript({target:{tabId:${created.id}},func:()=>document.title}).then(()=>false,()=>true)`);assert(denied);report.checks.push('Browser enforces injection boundary on non-retailer extension pages');
  await popup.call('Page.navigate',{url:base+'/setup.html'});await popup.call('Emulation.setDeviceMetricsOverride',{width:900,height:1100,deviceScaleFactor:1,mobile:false});await sleep(200);const help=await popup.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await fs.writeFile(path.join(out,'setup.png'),Buffer.from(help.data,'base64'));
  await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  await page.call('Browser.close').catch(()=>{});
 }finally{page?.close();popup?.close();worker?.close();edge?.kill();await link.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1});

