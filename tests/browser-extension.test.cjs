const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../browser-extension/background.js'),'utf8');
function worker(overrides={}){
 const data={},calls=[],listeners={},alarms=[];
 const chrome={runtime:{getURL:p=>'chrome-extension://'+'a'.repeat(32)+'/'+p,getManifest:()=>({version:'0.6.0'}),onMessage:{addListener:f=>listeners.message=f},onInstalled:{addListener:f=>listeners.install=f},onStartup:{addListener:f=>listeners.startup=f}},
 storage:{local:{get:async keys=>Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(k=>[k,data[k]])),set:async values=>Object.assign(data,values),remove:async keys=>{for(const k of Array.isArray(keys)?keys:[keys])delete data[k]}}},
 alarms:{create:async(name,value)=>alarms.push({name,...value}),clear:async()=>{},onAlarm:{addListener:f=>listeners.alarm=f}},
 permissions:{contains:async()=>true},tabs:{query:async()=>[],create:async args=>{calls.push(['create',args]);return{id:1,windowId:1,url:args.url,status:'complete'}},update:async()=>{},get:async()=>{}},windows:{update:async()=>{}},scripting:{executeScript:async args=>{calls.push(['script',args]);return[{result:{status:200,text:'{}'}}]}}};
 const context={chrome,AbortController,AbortSignal,URL,Date,setTimeout,clearTimeout,fetch:async(url,options)=>{calls.push(['fetch',url,options]);throw new Error('offline');},...overrides};vm.createContext(context);vm.runInContext(source,context);
 return{context,chrome,data,calls,listeners,alarms};
}
const job=(extra={})=>({type:'cart-request',retailer:'woolworths',operation:'CustomerCart',deadline:Date.now()+10000,...extra});
test('no connection or paused companion does no network work or tab work',async()=>{
 for(const state of [{},{connection:{token:'test'},paused:true}]){const w=worker();Object.assign(w.data,state);await w.context.poll();assert.deepEqual(w.calls,[]);assert.deepEqual(w.alarms,[]);}
});
test('closed app gets bounded retry backoff and loopback requests never carry cookies',async()=>{
 const w=worker();w.data.connection={token:'test'};
 for(let i=0;i<4;i++)await w.context.poll();
 assert.deepEqual(w.alarms.map(a=>a.delayInMinutes),[3,2,3,4,3,5,3,5]);assert.equal(w.data.health.state,'offline');
 for(const [type,url,opts] of w.calls){assert.equal(type,'fetch');assert.equal(url,'http://127.0.0.1:47391/poll');assert.equal(opts.credentials,'omit');assert.equal(opts.redirect,'error');assert(opts.signal);}
});
test('invalid, expired and non-retailer commands fail before touching tabs or the network',async()=>{
 const w=worker();for(const j of [job({retailer:'google'}),job({operation:'CheckoutPayment'}),job({deadline:0}),job({type:'evaluate'}),job({retailer:'__proto__'})])await assert.rejects(w.context.execute(j));assert.deepEqual(w.calls,[]);
});
test('a cart request never opens a missing retailer tab',async()=>{
 const w=worker();await assert.rejects(w.context.execute(job()),/Open Woolworths/);assert.deepEqual(w.calls,[]);
});
test('retailer permission denial blocks script execution and shows recovery advice',async()=>{
 const w=worker();w.chrome.permissions.contains=async()=>false;await assert.rejects(w.context.execute(job()),/Enable Woolworths access/);assert.deepEqual(w.calls,[]);
 await w.context.control({type:'open-store',retailer:'woolworths'});assert.equal(w.calls[0][0],'create');assert.equal(w.calls[0][1].url,'https://www.woolworths.co.nz/cart');
});
test('retailer navigation to Google sign-in blocks injection and does not activate any tab',async()=>{
 const w=worker();w.chrome.tabs.query=async()=>[{id:5,url:'https://accounts.google.com/',status:'complete'}];await assert.rejects(w.context.execute(job()),/Finish signing in/);assert.deepEqual(w.calls,[]);
});
test('existing retailer tab receives exactly one fixed script without focus changes',async()=>{
 const w=worker();w.chrome.tabs.query=async()=>[{id:5,url:'https://www.woolworths.co.nz/cart',status:'complete'}];const result=await w.context.execute(job());assert.equal(result.status,200);assert.equal(w.calls.length,1);assert.equal(w.calls[0][0],'script');assert.equal(w.calls[0][1].target.tabId,5);assert.equal(w.calls[0][1].world,'MAIN');
});
test('revoked pairing stops automatic retries',async()=>{
 const w=worker({fetch:async()=>({ok:false,status:403})});w.data.connection={token:'old'};await w.context.poll();assert.equal(w.data.paused,true);assert.equal(w.data.health.state,'reconnect');await w.context.poll();assert.equal(w.alarms.length,1);assert.equal((await w.context.control({type:'status'})).state,'reconnect');
});
test('external pages and loopback lookalikes cannot send privileged controls or pair',()=>{
 const w=worker();for(const url of ['https://mail.google.com/','http://127.0.0.1:47391/connectevil','http://127.0.0.1:47392/connect']){
 assert.equal(w.listeners.message({type:'disconnect'},{url,frameId:0},()=>assert.fail()),undefined);
 assert.equal(w.listeners.message({type:'pair',code:'a'.repeat(64)},{url,frameId:0},()=>assert.fail()),undefined);
 }
 assert.equal(w.listeners.message({type:'pair',code:'a'.repeat(64)},{url:'http://127.0.0.1:47391/connect',frameId:1},()=>assert.fail()),undefined);assert.deepEqual(w.calls,[]);
});
test('popup never receives connection secrets and distinguishes offline from paired',async()=>{
 const w=worker();w.data.connection={token:'private'};const status=await w.context.control({type:'status'});assert.equal(status.state,'offline');assert(!JSON.stringify(status).includes('private'));assert(!('connection' in status));
});
test('unsupported New World request cannot even call its authentication endpoint',async()=>{
 const w=worker({location:{origin:'https://www.newworld.co.nz'}});const result=await w.context.retailerRequest(job({retailer:'newworld',operation:'CheckoutPayment'}));assert.match(result.error,/Unsupported/);assert.deepEqual(w.calls,[]);
});
test('manifest cannot read or modify Google, email, cookies, proxy, or request headers',()=>{
 const m=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../browser-extension/manifest.json'),'utf8'));
 assert.deepEqual(m.permissions,['storage','scripting','alarms']);assert.deepEqual(m.host_permissions,['http://127.0.0.1/*']);assert.deepEqual(m.optional_host_permissions,['https://www.newworld.co.nz/*','https://www.woolworths.co.nz/*']);assert.equal(m.content_scripts.length,1);assert.deepEqual(m.content_scripts[0].matches,['http://127.0.0.1/connect']);assert.deepEqual(m.content_scripts[0].include_globs,['http://127.0.0.1:47391/connect*']);assert.equal(m.incognito,'not_allowed');
});

test('pairing accepts the exact connection page with its original fragment retained by Chrome',async()=>{
 const w=worker();w.context.local=async route=>{if(route==='/pair')return{token:'paired'};throw new Error('offline');};
 const result=await new Promise(resolve=>assert.equal(w.listeners.message({type:'pair',code:'a'.repeat(64)},{url:'http://127.0.0.1:47391/connect#'+'a'.repeat(64),frameId:0},resolve),true));
 assert.equal(result.ok,true);assert.equal(w.data.connection.token,'paired');await w.context.poll();
});
test('connection page never reports success when the worker ignores a message',async()=>{
 const element={textContent:''},code=fs.readFileSync(require('node:path').join(__dirname,'../browser-extension/connect.js'),'utf8');
 const context={location:{origin:'http://127.0.0.1:47391',pathname:'/connect',hash:'#'+'a'.repeat(64)},history:{replaceState(){}},chrome:{runtime:{sendMessage:async()=>undefined}},document:{getElementById:()=>element}};
 vm.runInNewContext(code,context);await new Promise(r=>setImmediate(r));assert.match(element.textContent,/did not respond/);
});
