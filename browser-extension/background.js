const BASE = 'http://127.0.0.1:47391';
const roots = {newworld:'https://www.newworld.co.nz', woolworths:'https://www.woolworths.co.nz'};
const names = {newworld:'New World', woolworths:'Woolworths'};
let running = null, controller = null, generation = 0;

async function local(path, connection, body, signal) {
 const timeout = AbortSignal.timeout(path === '/poll' ? 24000 : 5000);
 const response = await fetch(BASE + path, {
  method: body ? 'POST' : 'GET', credentials:'omit', cache:'no-store', redirect:'error',
  headers:{'Content-Type':'application/json', 'X-Grocery-Origin':chrome.runtime.getURL('').replace(/\/$/,''), ...(connection ? {Authorization:'Bearer '+connection.token} : {})},
  ...(body ? {body:JSON.stringify(body)} : {}), signal:signal ? AbortSignal.any([signal, timeout]) : timeout
 });
 if (!response.ok) { const error = new Error(response.status === 403 ? 'Reconnect from Grocery Compare.' : 'The app connection is unavailable.'); error.status = response.status; throw error; }
 return response.json();
}
async function remember(state, extra = {}) {
 await chrome.storage.local.set({health:{state, checkedAt:Date.now(), ...extra}});
}
async function schedule(minutes = 1) {
 const {connection, paused} = await chrome.storage.local.get(['connection','paused']);
 if (connection && !paused) await chrome.alarms.create('keep-connection',{delayInMinutes:minutes});
}
async function stop() {
 generation++; controller?.abort();
 await chrome.alarms.clear('keep-connection');
 if (running) await running;
}
async function control(message) {
 if (message.type === 'status') {
  const {connection, paused, health, activity} = await chrome.storage.local.get(['connection','paused','health','activity']);
  let state = !connection ? 'unpaired' : paused ? (health?.state === 'reconnect' ? 'reconnect' : 'paused') : 'offline';
  if (connection && !paused) {
   try { await local('/status',connection); state = 'connected'; void poll(); }
   catch(e) { state = e.status === 403 ? 'reconnect' : 'offline'; }
  }
  return {state, activity, health, version:chrome.runtime.getManifest().version};
 }
 if (message.type === 'pause' || message.type === 'disconnect') {
  await chrome.storage.local.set({paused:true}); await stop();
  const {connection} = await chrome.storage.local.get('connection');
  if (connection) await local(message.type === 'disconnect' ? '/disconnect' : '/pause',connection,{}).catch(()=>{});
  if (message.type === 'disconnect') await chrome.storage.local.remove(['connection','activity','health']);
  return {ok:true};
 }
 if (message.type === 'resume' || message.type === 'retry') {
  await chrome.storage.local.set({paused:false}); void poll(); return {ok:true};
 }
 if (message.type === 'open-store' && roots[message.retailer]) {
  await tabFor(message.retailer,true); return {ok:true};
 }
 throw new Error('Unsupported action.');
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
 if (!message || typeof message !== 'object') return;
 let task;
 let pairingPage = false;
 try { const url = new URL(sender.url); pairingPage = url.origin === BASE && url.pathname === '/connect' && !url.search; } catch {}
 if (message.type === 'pair' && sender.frameId === 0 && pairingPage && /^[a-f0-9]{64}$/.test(message.code)) {
  task = (async()=>{await stop(); const connection = await local('/pair',null,{code:message.code}); await chrome.storage.local.set({connection,paused:false,failures:0}); await remember('connected'); void poll(); return {ok:true};})();
 } else if ([chrome.runtime.getURL('popup.html'),chrome.runtime.getURL('setup.html')].includes(sender.url)) task = control(message);
 if (task) { task.then(reply).catch(e=>reply({error:e.message})); return true; }
});
chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name === 'keep-connection') void poll();});
chrome.runtime.onStartup.addListener(()=>{void poll();});
chrome.runtime.onInstalled.addListener(details=>{
 void (async()=>{await chrome.alarms.clear('keep-connection'); if(details.reason === 'install') await chrome.tabs.create({url:chrome.runtime.getURL('setup.html')}); await poll();})();
});
function poll() {
 if (running) return running;
 const current = generation;
 controller = new AbortController(); const signal = controller.signal;
 running = (async()=>{
  try {
   // Survives worker termination while a request is outstanding.
   await schedule(3);
   // Yield periodically so the browser can suspend the worker between sessions.
   const until = Date.now()+120000;
   while (!signal.aborted && current === generation && Date.now()<until) {
    const {connection,paused} = await chrome.storage.local.get(['connection','paused']);
    if (!connection || paused) break;
    const job = await local('/poll',connection,null,signal);
    await remember('connected'); await chrome.storage.local.set({failures:0});
    if (!job || signal.aborted || current !== generation) continue;
    let response;
    try { response = {id:job.id,result:await execute(job)}; }
    catch(e) { response = {id:job.id,error:e.message}; }
    await chrome.storage.local.set({activity:{at:Date.now(),retailer:names[job.retailer] || 'Store',action:job.type === 'open' ? 'Opened store' : 'Cart request',ok:!response.error}});
    // Never replay a job after an interrupted or unacknowledged result.
    if (!signal.aborted) await local('/result',connection,response,signal).catch(e=>{if(e.status !== 410) throw e;});
   }
  } catch(e) {
   if (!signal.aborted) {
    const {failures=0} = await chrome.storage.local.get('failures');
    await chrome.storage.local.set({failures:Math.min(failures+1,4)});
    await remember(e.status === 403 ? 'reconnect' : 'offline');
    if(e.status === 403) await chrome.storage.local.set({paused:true});
   }
  } finally {
   running = null;
   const {failures=0} = await chrome.storage.local.get('failures');
   await schedule(failures ? Math.min(5,2**failures) : 0.5);
  }
 })();
 return running;
}
function validateJob(job) {
 if (!job || !Object.hasOwn(roots,job.retailer)) throw new Error('Unsupported retailer.');
 if (!Number.isFinite(job.deadline) || job.deadline <= Date.now()) throw new Error('This request expired. Review the cart before trying again.');
 if (job.type === 'open') return;
 const operations = job.retailer === 'newworld' ? ['getCart','setItems','setStore'] : ['CustomerCart','SetCartShoppingMode','SetCartLineItemQuantity'];
 if (job.type !== 'cart-request' || !operations.includes(job.operation)) throw new Error('Unsupported cart request.');
}
async function tabFor(retailer, focus = false) {
 const root = roots[retailer]; if (!root) throw new Error('Unsupported retailer.');
 const allowed = await chrome.permissions.contains({origins:[root+'/*']});
 if (!allowed) {
  if (focus) return chrome.tabs.create({url:root+(retailer === 'newworld' ? '/shop/cart' : '/cart'),active:true});
  throw new Error('Enable '+names[retailer]+' access in the Grocery Compare extension, then try again.');
 }
 const tabs = await chrome.tabs.query({url:root+'/*'});
 let tab = tabs.find(t=>t.active && !t.incognito) || tabs.find(t=>!t.incognito);
 if (!tab) {
  if (!focus) throw new Error('Open '+names[retailer]+' in your browser and sign in before sending items.');
  tab = await chrome.tabs.create({url:root+(retailer === 'newworld' ? '/shop/cart' : '/cart'),active:true});
 } else if (focus) await chrome.tabs.update(tab.id,{active:true});
 if (focus) { await chrome.windows.update(tab.windowId,{focused:true}); return tab; }
 const start = Date.now();
 while (tab.status !== 'complete') {
  if (Date.now()-start > 15000) throw new Error('Finish opening the store and try again.');
  await new Promise(r=>setTimeout(r,250)); tab = await chrome.tabs.get(tab.id);
 }
 if (new URL(tab.url).origin !== root) throw new Error('Finish signing in at the store, then try again.');
 return tab;
}
async function execute(job) {
 validateJob(job);
 const tab = await tabFor(job.retailer,job.type === 'open');
 if (job.type === 'open') return {opened:true};
 const {paused} = await chrome.storage.local.get('paused');
 if (paused) throw new Error('Browser companion is paused.');
 validateJob(job);
 let results;
 try { results = await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func:retailerRequest,args:[job]}); }
 catch { throw new Error('Open the store and finish signing in or verification, then try again.'); }
 const result = results?.[0]?.result;
 if (!result) throw new Error('The store did not respond. Review your cart before trying again.');
 if (result.error) throw new Error(result.error);
 return result;
}
// Runs in the retailer's tab: browser cookies stay in the browser. No arbitrary
// code, URL, GraphQL query or HTTP headers can be supplied by the desktop app.
async function retailerRequest(job){
 try{
  const roots={newworld:'https://www.newworld.co.nz',woolworths:'https://www.woolworths.co.nz'};
  if(location.origin!==roots[job.retailer])throw new Error('Finish signing in, then try again.');
  const allowed=job.retailer==='newworld'?['getCart','setItems','setStore']:['CustomerCart','SetCartShoppingMode','SetCartLineItemQuantity'];
  if(!allowed.includes(job.operation))throw new Error('Unsupported cart request.');
  if(job.deadline!==undefined&&(!Number.isFinite(job.deadline)||job.deadline<=Date.now()))throw new Error('This request expired. Review the cart before trying again.');
  const call=async(url,options={})=>{const remaining=(job.deadline||Date.now()+25000)-Date.now();if(remaining<=0)throw new Error('This request expired. Review the cart before trying again.');const r=await fetch(url,{credentials:'include',...options,signal:AbortSignal.timeout(Math.min(25000,remaining))});const text=await r.text();if(text.length>1800000)throw new Error('Store response is too large.');return {status:r.status,text}};
  if(job.retailer==='woolworths'){
   const queries={CustomerCart:'query CustomerCart{customerCart{key shoppingMode{mode pickupLocationId pickupLocation{id name}} lineItems{sku productVariantSku quantity} validationResult{failedValidations{message}}}}',SetCartShoppingMode:'mutation SetCartShoppingMode($input:SetCartShoppingModeInput!){setCartShoppingMode(input:$input){shoppingMode{mode pickupLocationId pickupLocation{id name}} validationResult{failedValidations{message}}}}',SetCartLineItemQuantity:'mutation SetCartLineItemQuantity($input:SetCartLineItemQuantitiesInput!){setCartLineItemQuantity(input:$input){key lineItems{sku productVariantSku quantity} validationResult{failedValidations{message}}}}'};
   if(!Object.hasOwn(queries,job.operation))throw new Error('Unsupported cart request.');
   return await call('/api/graphql?op-name='+job.operation,{method:'POST',headers:{'content-type':'application/json','wnzx-operation-name':job.operation},body:JSON.stringify({operationName:job.operation,query:queries[job.operation],variables:job.variables})});
  }
  const auth=await call('/api/user/get-current-user',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({fingerprintUser:crypto.randomUUID().replaceAll('-',''),fingerprintGuest:navigator.userAgent})});
  if(auth.status!==200)throw new Error('Sign in to New World and finish its verification, then try again.');
  let token;try{token=JSON.parse(auth.text).access_token}catch{}if(!token)throw new Error('Sign in to New World, then try again.');
  let claims;try{claims=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))}catch{}
  if(!Array.isArray(claims?.roles)||!claims.roles.length||claims.roles.some(role=>/anonymous|guest/i.test(role)))throw new Error('Sign in to New World in this browser, then send your items again.');
  let path='/cart',method='GET',body;
  if(job.operation==='setItems'){method='POST';body=JSON.stringify(job.body)}else if(job.operation==='setStore'&&/^[a-zA-Z0-9-]+$/.test(job.storeId)){method='POST';path+='/store/'+job.storeId}else if(job.operation!=='getCart')throw new Error('Unsupported cart request.');
  return await call('https://api-prod.newworld.co.nz/v1/edge'+path,{method,headers:{'content-type':'application/json',authorization:'Bearer '+token},...(body?{body}:{})});
 }catch(e){return {error:e.message||'Open the store, finish signing in and try again.'}}
}
