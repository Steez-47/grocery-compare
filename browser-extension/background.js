const BASE='http://127.0.0.1:47391';
const roots={newworld:'https://www.newworld.co.nz',woolworths:'https://www.woolworths.co.nz'};
let polling=false,controller=null;
async function local(path,connection,body,signal){const response=await fetch(BASE+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-Grocery-Origin':chrome.runtime.getURL('').replace(/\/$/,''),...(connection?{Authorization:'Bearer '+connection.token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal});if(!response.ok)throw new Error(response.status===403?'Reconnect from Grocery Compare.':'The app connection is unavailable.');return response.json()}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
 if(message.type==='pair'&&sender.url?.startsWith(BASE+'/connect')&&/^[a-f0-9]{64}$/.test(message.code)){
  local('/pair',null,{code:message.code}).then(async connection=>{controller?.abort();await chrome.storage.local.set({connection});reply({ok:true});setTimeout(poll,100)}).catch(e=>reply({error:e.message}));return true;
 }
 if(message.type==='disconnect'&&sender.url===chrome.runtime.getURL('popup.html')){controller?.abort();reply({ok:true})}
});
chrome.alarms.create('keep-connection',{periodInMinutes:0.5});
chrome.alarms.onAlarm.addListener(()=>poll());chrome.runtime.onStartup.addListener(()=>poll());chrome.runtime.onInstalled.addListener(()=>poll());
async function poll(){
 if(polling)return;polling=true;controller=new AbortController();
 try{while(true){const {connection}=await chrome.storage.local.get('connection');if(!connection)break;const job=await local('/poll',connection,null,controller.signal);if(!job)continue;let response;try{response={id:job.id,result:await execute(job)}}catch(e){response={id:job.id,error:e.message}}await local('/result',connection,response,controller.signal)}}catch{}finally{polling=false}
}
async function tabFor(retailer,focus=false){
 const root=roots[retailer];if(!root)throw new Error('Unsupported retailer.');
 const tabs=await chrome.tabs.query({url:root+'/*'});let tab=tabs.find(t=>t.active)||tabs[0];
 if(!tab)tab=await chrome.tabs.create({url:root+(retailer==='newworld'?'/shop/cart':'/cart'),active:true});else if(focus)await chrome.tabs.update(tab.id,{active:true});
 if(focus)await chrome.windows.update(tab.windowId,{focused:true});
 const start=Date.now();while(tab.status!=='complete'){if(Date.now()-start>25000)throw new Error('Finish opening the store and try again.');await new Promise(r=>setTimeout(r,250));tab=await chrome.tabs.get(tab.id)}
 if(new URL(tab.url).origin!==root)throw new Error('Finish signing in at the store, then try again.');return tab;
}
async function execute(job){
 if(!roots[job.retailer])throw new Error('Unsupported retailer.');
 const tab=await tabFor(job.retailer,job.type==='open');
 if(job.type==='open')return {opened:true};
 if(job.type!=='cart-request')throw new Error('Unsupported command.');
 let results;try{results=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func:retailerRequest,args:[job]})}catch{throw new Error('Open the store in your browser and finish signing in or verification, then try again.')}
 const [{result}]=results;
 if(result?.error)throw new Error(result.error);return result;
}
// Runs in the retailer's tab: browser cookies stay in the browser. No arbitrary
// code, URL, GraphQL query or HTTP headers can be supplied by the desktop app.
async function retailerRequest(job){
 try{
  const roots={newworld:'https://www.newworld.co.nz',woolworths:'https://www.woolworths.co.nz'};
  if(location.origin!==roots[job.retailer])throw new Error('Finish signing in, then try again.');
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
