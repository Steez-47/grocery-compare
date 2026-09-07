const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {BrowserLink,cartOperation,transport}=require('../electron/browser-link.cjs');
const {Catalogue,WCART,WSET}=require('../electron/catalogue.cjs');
const origin='chrome-extension://'+'a'.repeat(32);
async function setup(){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'grocery-browser-test-')),link=await new BrowserLink(path.join(dir,'link.json'),{port:0,timeout:1000}).start(),base='http://127.0.0.1:'+link.port;const request=(route,body,token,extra={})=>fetch(base+route,{method:body?'POST':'GET',headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{}),...extra},...(body?{body:JSON.stringify(body)}:{})});return {link,base,request,cleanup:async()=>{await link.close();await fs.rm(dir,{recursive:true,force:true})}}}
async function pair(s){const code=new URL(s.link.connectURL()).hash.slice(1),r=await s.request('/pair',{code});assert.equal(r.status,200);return (await r.json()).token}
test('browser pairing requires a fresh single-use code and protects commands with token and origin',async()=>{
 const s=await setup();try{assert.equal((await s.request('/pair',{code:'wrong'})).status,403);const url=s.link.connectURL(),code=new URL(url).hash.slice(1),r=await s.request('/pair',{code}),token=(await r.json()).token;assert.equal(r.status,200);
 assert.equal((await s.request('/pair',{code})).status,403);assert.equal((await s.request('/poll',null,'wrong')).status,403);assert.equal((await s.request('/poll',null,token,{Origin:'https://evil.example'})).status,403);const status=await new Promise((resolve,reject)=>{const req=require('node:http').get(s.base+'/poll',{headers:{Host:'evil.example',Origin:origin,Authorization:'Bearer '+token}},res=>{res.resume();resolve(res.statusCode)});req.on('error',reject)});assert.equal(status,403);
 const task=s.link.request({type:'open',retailer:'newworld'}),job=await (await s.request('/poll',null,token)).json();assert.equal(job.type,'open');assert.equal(job.retailer,'newworld');await s.request('/result',{id:job.id,result:{opened:true}},token);assert.deepEqual(await task,{opened:true});
 const next=s.link.request({type:'open',retailer:'woolworths'}),edgeJob=await (await s.request('/poll',null,token,{Origin:'','X-Grocery-Origin':origin})).json();await s.request('/result',{id:edgeJob.id,result:{opened:true}},token);assert.deepEqual(await next,{opened:true});
 await s.link.disconnect();assert.equal(s.link.status().connected,false);assert.equal((await s.request('/poll',null,token)).status,403);
 }finally{await s.cleanup()}
});
test('pairing expiration and command timeouts never silently retry a cart write',async()=>{
 const s=await setup();try{const code=new URL(s.link.connectURL()).hash.slice(1);s.link.pairing.expires=Date.now()-1;assert.equal((await s.request('/pair',{code})).status,403);await pair(s);await assert.rejects(s.link.request({type:'cart-request',retailer:'newworld',operation:'setItems'}),/did not respond/);assert.equal(s.link.queue.length,0);assert.equal(s.link.pending.size,0)}finally{await s.cleanup()}
});
test('cart bridge only permits exact retailer cart endpoints and finite operations',()=>{
 assert.equal(cartOperation('newworld','https://api-prod.newworld.co.nz/v1/edge/cart').operation,'getCart');
 assert.equal(cartOperation('newworld','https://api-prod.newworld.co.nz/v1/edge/cart/store/store-1',{method:'POST'}).operation,'setStore');
 assert.equal(cartOperation('woolworths','https://www.woolworths.co.nz/api/graphql',{method:'POST',body:JSON.stringify({query:WCART,operationName:'CustomerCart'})}).operation,'CustomerCart');
 for(const url of ['https://evil.example/cart','https://api-prod.newworld.co.nz.evil.example/v1/edge/cart','https://api-prod.newworld.co.nz/v1/edge/user'])assert.throws(()=>cartOperation('newworld',url),/Unsupported/);
 assert.throws(()=>cartOperation('woolworths','https://www.woolworths.co.nz/api/graphql',{method:'POST',body:JSON.stringify({operationName:'CheckoutPayment'})}),/Unsupported/);
});
test('existing verified cart transfer operates through browser RPC, preserving unrelated items',async()=>{
 const s=await setup();try{const token=await pair(s),cart={shoppingMode:{pickupLocationId:'9424'},lineItems:[{productVariantSku:'unrelated',quantity:3}]},requests=[];
 const worker=(async()=>{for(let i=0;i<3;i++){const job=await (await s.request('/poll',null,token)).json();requests.push(job.operation);let data;
 if(job.operation==='CustomerCart')data={customerCart:cart};else {assert.equal(job.operation,'SetCartLineItemQuantity');for(const x of job.variables.input.cartLineItemQuantityUpdates)cart.lineItems.push({productVariantSku:x.variantKey,quantity:x.quantity});data={setCartLineItemQuantity:{validationResult:{failedValidations:[]}}}}
 await s.request('/result',{id:job.id,result:{status:200,text:JSON.stringify({data})}},token);
 }})();
 const cat=new Catalogue({woolworths:transport(s.link,'woolworths')}),result=await cat.transfer('woolworths',{id:'9424'},[{product:{id:'milk'},quantity:2}]);await worker;assert.equal(result.count,1);assert.deepEqual(requests,['CustomerCart','SetCartLineItemQuantity','CustomerCart']);assert.equal(cart.lineItems[0].quantity,3);
 }finally{await s.cleanup()}
});
test('extension permissions are restricted and browser-side code cannot request payments or other hosts',async()=>{
 const manifest=JSON.parse(await fs.readFile(path.join(__dirname,'../browser-extension/manifest.json'),'utf8'));assert(!manifest.permissions.includes('cookies'));assert(!manifest.host_permissions.includes('<all_urls>'));
 const source=await fs.readFile(path.join(__dirname,'../browser-extension/background.js'),'utf8');const calls=[];
 const context={chrome:{runtime:{onMessage:{addListener(){}},onStartup:{addListener(){}},onInstalled:{addListener(){}}},alarms:{create(){},onAlarm:{addListener(){}}}},location:{origin:'https://www.woolworths.co.nz'},AbortSignal,fetch:async(url,opts)=>{calls.push({url,opts});return {status:200,text:async()=>'{"data":{}}'}}};vm.createContext(context);vm.runInContext(source,context);
 const result=await context.retailerRequest({retailer:'woolworths',operation:'CheckoutPayment'});assert.match(result.error,/Unsupported/);assert.equal(calls.length,0);
 await context.retailerRequest({retailer:'woolworths',operation:'CustomerCart',variables:{},query:'mutation Pay{}',url:'https://evil.example'});assert.equal(calls[0].url,'/api/graphql?op-name=CustomerCart');assert.equal(calls[0].opts.credentials,'include');assert(!calls[0].opts.body.includes('mutation Pay'));
 context.location.origin='https://www.newworld.co.nz';context.crypto=globalThis.crypto;context.navigator={userAgent:'Test'};context.atob=globalThis.atob;context.fetch=async(url)=>{calls.push({url});return {status:200,text:async()=>JSON.stringify({access_token:'x.'+Buffer.from(JSON.stringify({roles:['ANONYMOUS']})).toString('base64url')+'.x'})}};
 const count=calls.length,guest=await context.retailerRequest({retailer:'newworld',operation:'setItems',body:{products:[]}});assert.match(guest.error,/Sign in to New World/);assert.equal(calls.length,count+1);assert.equal(calls.at(-1).url,'/api/user/get-current-user');
});

test('status is authenticated; pause cancels work and disconnect revokes pairing',async()=>{
 const s=await setup();try{
 const token=await pair(s);assert.equal((await s.request('/status',null,token)).status,200);assert.equal((await s.request('/status',null,'wrong')).status,403);
 const pending=s.link.request({type:'open',retailer:'newworld'});const rejected=assert.rejects(pending,/connection closed/i);
 assert.equal((await s.request('/pause',{},token)).status,200);await rejected;assert.equal(s.link.status().connected,false);assert.equal(s.link.status().paired,true);
 assert.equal((await s.request('/status',null,token)).status,200);assert.equal(s.link.status().connected,false);
 assert.equal((await s.request('/disconnect',{},token)).status,200);assert.equal(s.link.status().paired,false);assert.equal((await s.request('/status',null,token)).status,403);
 }finally{await s.cleanup()}
});
test('pause cannot be undone by a previously waiting poll completing',async()=>{
 const s=await setup();try{const token=await pair(s);const poll=s.request('/poll',null,token);while(!s.link.waiting)await new Promise(r=>setTimeout(r,5));await s.request('/pause',{},token);assert.equal((await poll).status,409);assert.equal(s.link.status().connected,false);}finally{await s.cleanup()}
});
