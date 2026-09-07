const {app,BrowserWindow,WebContentsView,ipcMain,session,Menu,shell,dialog}=require('electron');
const {BrowserLink,roots:browserRoots,transport:browserTransport}=require('./browser-link.cjs');
const path=require('node:path');const fs=require('node:fs/promises');const {pathToFileURL}=require('node:url');
const {searchCatalogue}=require('./search.cjs');
const {Catalogue,WW,NW,UA}=require('./catalogue.cjs');const {basketSummary,validateQuantity}=require('./model.cjs');
const {groupProducts}=require('./model.cjs');const {Preferences,rankRows,rankShelves}=require('./recommend.cjs');const {textScore}=require('./matching.cjs');const {recommendationQuery}=require('./browse.cjs');
const uiVerify=process.argv.includes('--ui-verify'),smoke=process.argv.includes('--smoke'),verify=uiVerify||process.argv.includes('--verify');
// GUI launches may detach inherited console handles on Windows.
process.stdout?.on('error',()=>{});process.stderr?.on('error',()=>{});
if(smoke||verify)app.setPath('userData',path.join(app.isPackaged?app.getPath('temp'):path.join(__dirname,'..'),'test-results',uiVerify?'performance-profile':verify?'verification-profile':'profile'));
if(!smoke&&!verify&&!app.requestSingleInstanceLock()){app.quit();return;}
let win,cat,prefs,browserLink,browserCat,storeView=null,activeRetailer=null,nwToken=null,saveQueue=Promise.resolve(),transferring=false;
let shelfJobs=0;const shelfWaiters=[];
async function shelfWork(fn){if(shelfJobs>=2)await new Promise(resolve=>shelfWaiters.push(resolve));shelfJobs++;try{return await fn()}finally{shelfJobs--;shelfWaiters.shift()?.()}}
const validProducts=ps=>Array.isArray(ps)&&ps.length<=2200&&JSON.stringify(ps).length<=5000000&&ps.every(p=>p&&['newworld','woolworths'].includes(p.retailer)&&typeof p.id==='string'&&p.id.length<100&&typeof p.name==='string'&&p.name.length<500);
const views={};const defaults={version:1,stores:{newworld:null,woolworths:null},loyalty:{newworld:true,woolworths:true},basket:[],policy:'cheapest'};
let state=structuredClone(defaults);
const localURL=pathToFileURL(path.join(__dirname,'../dist/index.html')).href;
const persist=async()=>{const file=path.join(app.getPath('userData'),'shopping.json');const payload=JSON.stringify(state,null,2);saveQueue=saveQueue.catch(()=>{}).then(async()=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file+'.tmp',payload);await fs.rename(file+'.tmp',file)});return saveQueue;};
app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus();}});
function protect(wc){
 wc.setWindowOpenHandler(({url})=>{if(url.startsWith('https://')){const popup=new BrowserWindow({parent:win,width:1060,height:800,webPreferences:{session:wc.session,nodeIntegration:false,contextIsolation:true,sandbox:true}});protect(popup.webContents);popup.loadURL(url).catch(()=>{});}return{action:'deny'};});
 wc.on('will-navigate',(e,url)=>{if(!url.startsWith('https://'))e.preventDefault();});
}
function checkoutSession(retailer){return session.fromPartition('persist:checkout-'+retailer);}
function catalogSession(retailer){return session.fromPartition('persist:catalogue-'+retailer);}
function emitBrowser(){if(!win?.isDestroyed())win.webContents.send('store-status',{retailer:activeRetailer,url:storeView?.webContents.getURL()||'',loading:storeView?.webContents.isLoading()||false});}
function layout(){if(storeView){const [w,h]=win.getContentSize();storeView.setBounds({x:0,y:112,width:w,height:Math.max(0,h-112)});}}
async function showStore(retailer,url){
 if(!['newworld','woolworths'].includes(retailer))throw new Error('Unknown store.');
 if(storeView)win.contentView.removeChildView(storeView);
 let view=views[retailer];
 if(!view){view=new WebContentsView({webPreferences:{session:checkoutSession(retailer),nodeIntegration:false,contextIsolation:true,sandbox:true}});view.webContents.setUserAgent(UA);protect(view.webContents);views[retailer]=view;
 for(const event of ['did-start-loading','did-stop-loading','did-navigate','did-navigate-in-page'])view.webContents.on(event,emitBrowser);
 }
 storeView=view;activeRetailer=retailer;win.contentView.addChildView(view);layout();emitBrowser();
 if(url||!view.webContents.getURL())view.webContents.loadURL(url||(retailer==='woolworths'?WW:NW)).catch(()=>emitBrowser());
 return {retailer,url:view.webContents.getURL()};
}
function hideStore(){if(storeView){win.contentView.removeChildView(storeView);storeView=null;activeRetailer=null;}return true;}
function handle(name,fn){ipcMain.handle(name,async(e,...args)=>{if(e.sender!==win.webContents||e.senderFrame?.url!==localURL)throw new Error('Untrusted caller.');try{return {ok:true,data:await fn(...args)}}catch(err){return {ok:false,error:err.message||'Something went wrong.'}}});}
app.whenReady().then(async()=>{
 Menu.setApplicationMenu(null);
 prefs=new Preferences(path.join(app.getPath('userData'),'recommendations.json'));await prefs.load();
 browserLink=new BrowserLink(path.join(app.getPath('userData'),'browser-link.json'),{port:verify||smoke?0:47391});await browserLink.start().catch(()=>{browserLink.error='Browser connection port is unavailable. Close other Grocery Compare instances and reopen the app.'});browserCat=new Catalogue(Object.fromEntries(['newworld','woolworths'].map(r=>[r,browserTransport(browserLink,r)])));
 try{const loaded=JSON.parse(await fs.readFile(path.join(app.getPath('userData'),'shopping.json'),'utf8'));if(loaded.version===1)state={...defaults,...loaded};}catch(err){if(err.code!=='ENOENT')await fs.copyFile(path.join(app.getPath('userData'),'shopping.json'),path.join(app.getPath('userData'),'shopping.recovery.json')).catch(()=>{});}
 const {repairWeightProduct}=require('./model.cjs'),{repairPriceProduct}=require('./pricing.cjs');const repair=p=>repairPriceProduct(repairWeightProduct(p));state.basket=state.basket.map(l=>({...l,product:repair(l.product),offers:Object.fromEntries(Object.entries(l.offers).map(([r,p])=>[r,repair(p)]))}));
 for(const r of ['newworld','woolworths'])for(const s of [catalogSession(r),checkoutSession(r)]){s.setUserAgent(UA);s.setPermissionRequestHandler((_wc,_permission,cb)=>cb(false));s.setPermissionCheckHandler(()=>false);}
 checkoutSession('newworld').webRequest.onBeforeSendHeaders({urls:['https://api-prod.newworld.co.nz/*']},(details,cb)=>{const value=details.requestHeaders.Authorization||details.requestHeaders.authorization;if(value?.startsWith('Bearer '))nwToken=value.slice(7);cb({requestHeaders:details.requestHeaders});});
 cat=new Catalogue(Object.fromEntries(['newworld','woolworths'].map(r=>[r,(url,opts,checkout)=>(checkout?checkoutSession(r):catalogSession(r)).fetch(url,opts)])));
 win=new BrowserWindow({show:!verify,frame:false,title:'Grocery Compare',width:1380,height:920,minWidth:1040,minHeight:700,backgroundColor:'#f6f7f2',icon:path.join(__dirname,'../assets/icon.ico'),webPreferences:{offscreen:verify&&!uiVerify,backgroundThrottling:!verify,preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 win.on('resize',layout);win.on('closed',()=>{for(const v of Object.values(views))if(!v.webContents.isDestroyed())v.webContents.close();win=null;});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());
 handle('window-state',()=>({maximized:win.isMaximized()}));
 handle('window-control',action=>{if(action==='minimize')win.minimize();else if(action==='maximize'){if(win.isMaximized())win.unmaximize();else win.maximize();}else if(action==='close'){setImmediate(()=>win.close());}else throw new Error('Unknown window action.');return true;});
 for(const event of ['maximize','unmaximize'])win.on(event,()=>win.webContents.send('window-state',{maximized:win.isMaximized()}));
 handle('load',()=>state);
 handle('appearance',()=>({theme:['light','dark'].includes(prefs.data.theme)?prefs.data.theme:'system'}));
 handle('appearance-set',async theme=>{if(!['system','light','dark'].includes(theme))throw new Error('Invalid appearance.');prefs.data.theme=theme;await prefs.save();return true});
 handle('browser-status',()=>browserLink.status());
 handle('browser-connect',async()=>{if(browserLink.error)throw new Error(browserLink.error);await shell.openExternal(browserLink.connectURL());return true});
 handle('browser-disconnect',async()=>{await browserLink.disconnect();return true});
 handle('browser-folder',async()=>{const folder=app.isPackaged?path.join(process.resourcesPath,'browser-extension'):path.join(__dirname,'../browser-extension');const error=await shell.openPath(folder);if(error)throw new Error(error);return true});
 handle('compare',products=>{if(!validProducts(products))throw new Error('Invalid products.');return groupProducts(products,prefs.data)});
 handle('track',async event=>{if(!event||!['add','view','browse','dismiss','impression'].includes(event.type)||JSON.stringify(event).length>35000||event.product&&!validProducts([event.product])||event.products&&!validProducts(event.products))throw new Error('Invalid activity.');await prefs.track(event);return true});
 handle('preferences',()=>({enabled:prefs.data.enabled,revision:prefs.data.revision}));
 handle('preferences-reset',async()=>{await prefs.reset();return true});
 handle('preferences-enabled',async enabled=>{if(typeof enabled!=='boolean')throw new Error('Invalid setting.');prefs.data.enabled=enabled;await prefs.save();return true});
 handle('match-feedback',async(a,b,accept)=>{if(!validProducts([a,b])||a.retailer===b.retailer||typeof accept!=='boolean')throw new Error('Invalid match.');await prefs.feedback(a,b,accept);return true});
 handle('feed-plan',async stores=>{if(!stores?.newworld?.id||!stores?.woolworths?.id)throw new Error('Choose stores first.');return rankShelves(await cat.departments(stores),prefs.data)});
 handle('home-candidates',async(id,selected)=>shelfWork(async()=>{
  if(!selected?.newworld?.id||!selected?.woolworths?.id)throw new Error('Choose stores first.');
  const stores=structuredClone(selected),all=await cat.departments(stores),aisle=all.flatMap(d=>d.children).find(a=>a.id===id);
  if(!aisle)throw new Error('Aisle is unavailable.');
  const data=await Promise.allSettled(['newworld','woolworths'].map(r=>cat.search(r,stores[r],'',0,false,{category:aisle.sources[r]})));
  if(data.every(d=>d.status==='rejected'))throw new Error('Could not load '+aisle.name+'.');
  return {products:data.flatMap(d=>d.status==='fulfilled'?d.value.products:[]),partial:data.some(d=>d.status==='rejected')};
 }));
 handle('home-rank',(products,deals,limit,loyalty,basket)=>{if(!validProducts(products)||!validProducts(basket)||typeof loyalty?.newworld!=='boolean'||typeof loyalty?.woolworths!=='boolean'||typeof deals!=='boolean'||!Number.isInteger(limit)||limit<1||limit>240)throw new Error('Invalid recommendations.');return require('./home.cjs').homeRows(products,prefs.data,{basket:basket.map(p=>({offers:{[p.retailer]:p}})),loyalty,limit,deals})});
 handle('shelf',async (id,selected)=>shelfWork(async()=>{
  if(!selected?.newworld?.id||!selected?.woolworths?.id)throw new Error('Choose stores first.');const stores=structuredClone(selected);const all=await cat.departments(stores),aisle=all.flatMap(d=>d.children).find(a=>a.id===id);if(!aisle)throw new Error('Aisle is unavailable.');
  const data=await Promise.allSettled(['newworld','woolworths'].map(r=>cat.search(r,stores[r],'',0,false,{category:aisle.sources[r]})));
  const products=data.flatMap(d=>d.status==='fulfilled'?d.value.products:[]);if(!products.length&&data.some(d=>d.status==='rejected'))throw new Error('Could not load this shelf.');
  return {rows:rankRows(groupProducts(products,prefs.data),prefs.data,{basket:state.basket,loyalty:state.loyalty,limit:4}),partial:data.some(d=>d.status==='rejected')};
 }));
 handle('similar',async source=>{if(!validProducts([source]))throw new Error('Invalid product.');const stores=structuredClone(state.stores);const query=recommendationQuery(source).slice(0,100);const results=await Promise.allSettled(['newworld','woolworths'].map(r=>cat.search(r,stores[r],query)));
  const products=results.flatMap(d=>d.status==='fulfilled'?d.value.products:[]).filter(p=>!(p.id===source.id&&p.retailer===source.retailer)&&p.unit===source.unit&&textScore(source,p)>0.1);
  return {rows:rankRows(groupProducts(products,prefs.data),prefs.data,{source,loyalty:state.loyalty,limit:16}),partial:results.some(d=>d.status==='rejected')};
 });
 handle('match-candidates',async source=>{if(!validProducts([source]))throw new Error('Invalid product.');const retailer=source.retailer==='newworld'?'woolworths':'newworld';const q=[source.brand,recommendationQuery(source)].join(' ').slice(0,100);let data=await cat.search(retailer,state.stores[retailer],q);if(!data.products.length)data=await cat.search(retailer,state.stores[retailer],recommendationQuery(source).slice(0,100));return data.products.filter(p=>p.unit===source.unit).sort((a,b)=>textScore(source,b)-textScore(source,a));});
 handle('save',async(next)=>{
  if(!next||next.version!==1||!Array.isArray(next.basket)||next.basket.length>300||JSON.stringify(next).length>2000000)throw new Error('Invalid shopping list.');
  for(const l of next.basket){if(!l.offers||!Number.isFinite(l.quantity)||l.quantity<=0||l.quantity>999)throw new Error('Invalid basket quantity.');}
  state={version:1,stores:next.stores,loyalty:next.loyalty,basket:next.basket,policy:next.policy};await persist();return true;
 });
 handle('stores',async(r,q)=>{if(!['newworld','woolworths'].includes(r)||typeof q!=='string'||q.length>100)throw new Error('Invalid store search.');return cat.stores(r,q);});
 handle('departments',stores=>{if(!stores?.newworld?.id||!stores?.woolworths?.id||!/^[a-zA-Z0-9-]+$/.test(stores.newworld.id))throw new Error('Choose stores first.');return cat.departments(stores)});
 handle('search',async(r,store,q,page=0,force=false,options={})=>{if(!['newworld','woolworths'].includes(r)||typeof q!=='string'||q.length>100||!Number.isInteger(page)||page<0||page>28||!store?.id||!/^[a-zA-Z0-9-]+$/.test(store.id)||JSON.stringify(options).length>1500)throw new Error('Invalid search.');if(options.category&&(!Array.isArray(options.category.path)||options.category.path.length>3||options.category.path.some(x=>typeof x!=='string'||x.length>150)))throw new Error('Invalid category.');return searchCatalogue(cat,r,store,q,page,force,options);});
 handle('store-open',async r=>{if(!Object.hasOwn(browserRoots,r))throw new Error('Unknown store.');if(browserLink.status().connected)await browserLink.request({type:'open',retailer:r});else await shell.openExternal(browserRoots[r]+(r==='newworld'?'/shop/cart':'/cart'));return true});
 handle('store-close',hideStore);
 handle('store-nav',action=>{if(!storeView)return;if(action==='back'&&storeView.webContents.navigationHistory.canGoBack())storeView.webContents.navigationHistory.goBack();if(action==='reload')storeView.webContents.reload();if(action==='cart')storeView.webContents.loadURL(activeRetailer==='woolworths'?WW+'/cart':NW+'/shop/cart').catch(()=>{});});
 handle('transfer',async(r)=>{
  if(transferring)throw new Error('A basket is already being sent.');
  const lines=basketSummary(state.basket,state.policy,state.loyalty).shops[r];if(!lines?.length)throw new Error('No items selected for this store.');
  for(const l of lines){if(l.product.storeId!==state.stores[r]?.id||!(Date.now()-Date.parse(l.product.checkedAt)<1800000))throw new Error('Refresh the basket for your selected stores first.');if(!validateQuantity(l.quantity,l.product))throw new Error('Check quantities before sending.');if(l.product.restricted)throw new Error('Add age-restricted items in the store itself.');}
  transferring=true;
  try{return await browserCat.transfer(r,state.stores[r],lines,'browser-session');}finally{transferring=false;}
 });
 handle('export',async()=>{const target=await dialog.showSaveDialog(win,{defaultPath:'Shopping list.txt',filters:[{name:'Text',extensions:['txt']}]});if(target.canceled)return false;const s=basketSummary(state.basket,state.policy,state.loyalty);const text=Object.entries(s.shops).map(([r,lines])=>`${r==='newworld'?'New World':'Woolworths'} ${state.stores[r]?.name||''}\n`+lines.map(l=>`${l.quantity}${l.product.unit==='kg'?' kg':''} × ${l.product.name}`).join('\n')).join('\n\n');await fs.writeFile(target.filePath,text);return true;});
 await win.loadURL(localURL);
 if(!verify)win.show();
 if(verify){require(uiVerify?'./verify-performance.cjs':'./verify.cjs').run({win,cat,app}).then(()=>app.exit(0)).catch(async err=>{await fs.writeFile(path.join(app.getPath('userData'),'verification-error.txt'),err.stack);if(uiVerify){await fs.writeFile(path.join(app.getPath('userData'),'failure.png'),(await win.webContents.capturePage()).toPNG());await fs.writeFile(path.join(app.getPath('userData'),'failure.txt'),await win.webContents.executeJavaScript('document.body.innerText'));}app.exit(1);});}
 if(smoke){require('./smoke.cjs').run({win,cat,state,showStore,hideStore,persist}).catch(async err=>{await fs.mkdir(path.join(__dirname,'../test-results'),{recursive:true});await fs.writeFile(path.join(__dirname,'../test-results/smoke-error.txt'),err.stack);app.exit(1);});}
});
app.on('window-all-closed',()=>app.quit());
let quitting=false;app.on('before-quit',event=>{if(quitting)return;quitting=true;event.preventDefault();Promise.allSettled([saveQueue,prefs?.queue,browserLink?.close()]).then(()=>app.exit(0));});
