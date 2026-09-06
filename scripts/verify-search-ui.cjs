// Runs the production renderer in an isolated Electron profile with deterministic catalogue pages.
const path=require('node:path');
if(process.type==='renderer'){
 const {contextBridge,ipcRenderer}=require('electron');
 const call=method=>(...args)=>ipcRenderer.invoke('search-test',method,args);
 const api=Object.fromEntries(['load','save','appearance','departments','feedPlan','search','compare','track','preferences','browserStatus'].map(method=>[method,call(method)]));
 api.onStoreStatus=()=>()=>{};contextBridge.exposeInMainWorld('grocery',api);
}else{
 const {app,BrowserWindow,ipcMain}=require('electron'),fs=require('node:fs/promises'),assert=require('node:assert/strict');
 const {searchCatalogue}=require('../electron/search.cjs'),{groupProducts}=require('../electron/model.cjs');
 const output=path.resolve(__dirname,'../test-results/search');app.setPath('userData',path.join(output,'profile'));
 const calls=[],checks=[];let mode='normal',failed=false;
 const product=(r,id,name,size)=>({retailer:r,id,name,brand:'Test',size,barcode:'',image:'',cents:900,regularCents:900,member:false,offer:'',unit:'each',min:1,max:99,step:1,unitPrice:'',available:true,restricted:false,storeId:r,checkedAt:new Date().toISOString(),url:''});
 const cat={search:async(r,s,q,page)=>{
  calls.push({r,q,page,mode});
  if(mode==='retry'&&r==='woolworths'&&!failed){failed=true;throw Error('Fixture connection interrupted');}
  const items=[product(r,'cola','Cola','24pk'),product(r,'water','Spring Water','24 x 500ml'),product(r,'small','Spring Water','12pk'),product(r,'paper','Toilet Paper','24 rolls')];
  if(mode==='paged')return {products:page<3?[items[0]]:[product(r,'later','Still Water','24pk')],pages:r==='newworld'?4:1,total:144};
  return {products:items,pages:1,total:4};
 }};
 const state={version:1,stores:{newworld:{id:'newworld',name:'Test New World'},woolworths:{id:'woolworths',name:'Test Woolworths'}},loyalty:{newworld:true,woolworths:true},basket:[],policy:'cheapest'};
 ipcMain.handle('search-test',async(e,method,args)=>{
  if(method==='load')return state;
  if(method==='appearance')return {theme:'light'};
  if(method==='search')return searchCatalogue(cat,...args);
  if(method==='compare')return groupProducts(args[0]);
  if(['departments','feedPlan'].includes(method))return [];
  if(method==='preferences')return {enabled:false,revision:0};
  return true;
 });
 app.whenReady().then(async()=>{
  await fs.mkdir(output,{recursive:true});
  const win=new BrowserWindow({show:false,width:1440,height:1000,webPreferences:{preload:__filename,contextIsolation:true,sandbox:false,backgroundThrottling:false}});
  const evaluate=code=>win.webContents.executeJavaScript(code);
  const until=async code=>{const end=Date.now()+15000;while(!await evaluate(code)){if(Date.now()>end)throw Error('Timed out: '+code);await new Promise(r=>setTimeout(r,50));}};
  const submit=async query=>{
   await evaluate(`(()=>{const input=document.querySelector('[aria-label="Search groceries"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(query)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
   await new Promise(r=>setTimeout(r,30));
   await evaluate(`document.querySelector('form.search').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))`);
   await until(`!document.querySelector('form.search button.primary').disabled`);
  };
  const results=()=>evaluate(`document.querySelector('[aria-label="Grocery search results"]').innerText`);
  try{
   await win.loadFile(path.resolve(__dirname,'../dist/index.html'));
   await until(`document.querySelector('[aria-label="Search groceries"]') && !document.querySelector('.stores-modal')`);
   for(const query of ['water 24 pk','water 24 × 500ml','water 0.5l 24pk']){
    await submit(query);const text=await results();assert(text.includes('Spring Water'));assert(!/Cola|Toilet Paper|12pk/.test(text));checks.push(query+' shows only matching water');
   }
   await submit('water 24 pk');win.showInactive();await new Promise(r=>setTimeout(r,500));
   assert((await results()).includes('Spring Water'));
   await fs.writeFile(path.join(output,'water-search.png'),(await win.webContents.capturePage()).toPNG());
   win.hide();
   await submit('water 48pk');assert.equal((await results()).trim(),'');assert(await evaluate(`document.body.innerText.includes('No products found')`));checks.push('No-match state retains exact pack requirement');
   mode='paged';await submit('water 24pk');assert.equal((await results()).trim(),'');assert(await evaluate(`document.body.innerText.includes('No matches on these pages')`));
   await evaluate(`document.querySelector('button.more').click()`);await until(`!document.querySelector('form.search button.primary').disabled`);
   assert((await results()).includes('Still Water'));assert(!await evaluate(`!!document.querySelector('button.more')`));
   assert.deepEqual(calls.filter(c=>c.mode==='paged'&&c.r==='newworld').map(c=>c.page),[0,1,2,3]);
   assert.deepEqual(calls.filter(c=>c.mode==='paged'&&c.r==='woolworths').map(c=>c.page),[0]);checks.push('Show more uses exact source cursor and skips exhausted store');
   mode='retry';await submit('water 24pk');assert((await results()).includes('Spring Water'));assert(await evaluate(`document.body.innerText.includes('Fixture connection interrupted')`));
   await evaluate(`document.querySelector('button.more').click()`);await until(`!document.querySelector('form.search button.primary').disabled`);
   assert(!await evaluate(`document.body.innerText.includes('Fixture connection interrupted')`));assert.deepEqual(calls.filter(c=>c.mode==='retry'&&c.r==='newworld').map(c=>c.page),[0]);assert.deepEqual(calls.filter(c=>c.mode==='retry'&&c.r==='woolworths').map(c=>c.page),[0,0]);checks.push('Failed store retries same page while retaining successful store results');
   assert(await evaluate(`document.documentElement.scrollWidth<=innerWidth`));checks.push('Production renderer has no horizontal overflow');
   await fs.writeFile(path.join(output,'verification.json'),JSON.stringify({checks,calls},null,2));console.log(JSON.stringify({checks,output},null,2));app.quit();
  }catch(error){console.error(error);await fs.writeFile(path.join(output,'failure.png'),(await win.webContents.capturePage()).toPNG());app.exit(1);}
 });
}
