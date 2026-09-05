const {app,BrowserWindow,WebContentsView,ipcMain,session,Menu,shell,dialog}=require('electron');
const path=require('node:path');const fs=require('node:fs/promises');const {pathToFileURL}=require('node:url');
const {Catalogue,WW,NW,UA}=require('./catalogue.cjs');const {basketSummary,validateQuantity}=require('./model.cjs');
const smoke=process.argv.includes('--smoke'),verify=process.argv.includes('--verify');
// GUI launches may detach inherited console handles on Windows.
process.stdout?.on('error',()=>{});process.stderr?.on('error',()=>{});
if(smoke||verify)app.setPath('userData',path.join(app.isPackaged?app.getPath('temp'):path.join(__dirname,'..'),'test-results',verify?'verification-profile':'profile'));
if(!smoke&&!verify&&!app.requestSingleInstanceLock()){app.quit();return;}
let win,cat,storeView=null,activeRetailer=null,nwToken=null,saveQueue=Promise.resolve(),transferring=false;
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
function layout(){if(storeView){const [w,h]=win.getContentSize();storeView.setBounds({x:0,y:72,width:w,height:Math.max(0,h-72)});}}
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
 try{const loaded=JSON.parse(await fs.readFile(path.join(app.getPath('userData'),'shopping.json'),'utf8'));if(loaded.version===1)state={...defaults,...loaded};}catch(err){if(err.code!=='ENOENT')await fs.copyFile(path.join(app.getPath('userData'),'shopping.json'),path.join(app.getPath('userData'),'shopping.recovery.json')).catch(()=>{});}
 for(const r of ['newworld','woolworths'])for(const s of [catalogSession(r),checkoutSession(r)]){s.setUserAgent(UA);s.setPermissionRequestHandler((_wc,_permission,cb)=>cb(false));s.setPermissionCheckHandler(()=>false);}
 checkoutSession('newworld').webRequest.onBeforeSendHeaders({urls:['https://api-prod.newworld.co.nz/*']},(details,cb)=>{const value=details.requestHeaders.Authorization||details.requestHeaders.authorization;if(value?.startsWith('Bearer '))nwToken=value.slice(7);cb({requestHeaders:details.requestHeaders});});
 cat=new Catalogue(Object.fromEntries(['newworld','woolworths'].map(r=>[r,(url,opts,checkout)=>(checkout?checkoutSession(r):catalogSession(r)).fetch(url,opts)])));
 win=new BrowserWindow({show:!verify,title:'Grocery Compare',width:1380,height:920,minWidth:1040,minHeight:700,backgroundColor:'#f6f7f2',icon:path.join(__dirname,'../assets/icon.ico'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 win.on('resize',layout);win.on('closed',()=>{for(const v of Object.values(views))if(!v.webContents.isDestroyed())v.webContents.close();win=null;});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());
 handle('load',()=>state);
 handle('save',async(next)=>{
  if(!next||next.version!==1||!Array.isArray(next.basket)||next.basket.length>300||JSON.stringify(next).length>2000000)throw new Error('Invalid shopping list.');
  for(const l of next.basket){if(!l.offers||!Number.isFinite(l.quantity)||l.quantity<=0||l.quantity>999)throw new Error('Invalid basket quantity.');}
  state={version:1,stores:next.stores,loyalty:next.loyalty,basket:next.basket,policy:next.policy};await persist();return true;
 });
 handle('stores',async(r,q)=>{if(!['newworld','woolworths'].includes(r)||typeof q!=='string'||q.length>100)throw new Error('Invalid store search.');return cat.stores(r,q);});
 handle('departments',stores=>{if(!stores?.newworld?.id||!stores?.woolworths?.id||!/^[a-zA-Z0-9-]+$/.test(stores.newworld.id))throw new Error('Choose stores first.');return cat.departments(stores)});
 handle('search',async(r,store,q,page=0,force=false,options={})=>{if(!['newworld','woolworths'].includes(r)||typeof q!=='string'||q.length>100||!Number.isInteger(page)||page<0||page>28||!store?.id||!/^[a-zA-Z0-9-]+$/.test(store.id)||JSON.stringify(options).length>1500)throw new Error('Invalid search.');if(options.category&&(!Array.isArray(options.category.path)||options.category.path.length>3||options.category.path.some(x=>typeof x!=='string'||x.length>150)))throw new Error('Invalid category.');return cat.search(r,store,q,page,force,options);});
 handle('store-open',async(r)=>showStore(r));
 handle('store-close',hideStore);
 handle('store-nav',action=>{if(!storeView)return;if(action==='back'&&storeView.webContents.navigationHistory.canGoBack())storeView.webContents.navigationHistory.goBack();if(action==='reload')storeView.webContents.reload();if(action==='cart')storeView.webContents.loadURL(activeRetailer==='woolworths'?WW+'/cart':NW+'/shop/cart').catch(()=>{});});
 handle('transfer',async(r)=>{
  if(transferring)throw new Error('A basket is already being sent.');
  const lines=basketSummary(state.basket,state.policy,state.loyalty).shops[r];if(!lines?.length)throw new Error('No items selected for this store.');
  for(const l of lines){if(l.product.storeId!==state.stores[r]?.id||!(Date.now()-Date.parse(l.product.checkedAt)<1800000))throw new Error('Refresh the basket for your selected stores first.');if(!validateQuantity(l.quantity,l.product))throw new Error('Check quantities before sending.');if(l.product.restricted)throw new Error('Add age-restricted items in the store itself.');}
  transferring=true;
  try{const result=await cat.transfer(r,state.stores[r],lines,nwToken);if(views[r])views[r].webContents.reload();return result;}finally{transferring=false;}
 });
 handle('export',async()=>{const target=await dialog.showSaveDialog(win,{defaultPath:'Shopping list.txt',filters:[{name:'Text',extensions:['txt']}]});if(target.canceled)return false;const s=basketSummary(state.basket,state.policy,state.loyalty);const text=Object.entries(s.shops).map(([r,lines])=>`${r==='newworld'?'New World':'Woolworths'} ${state.stores[r]?.name||''}\n`+lines.map(l=>`${l.quantity}${l.product.unit==='kg'?' kg':''} × ${l.product.name}`).join('\n')).join('\n\n');await fs.writeFile(target.filePath,text);return true;});
 await win.loadURL(localURL);
 if(!verify)win.show();
 if(verify){require('./verify.cjs').run({win,cat,app}).then(()=>app.exit(0)).catch(async err=>{await fs.writeFile(path.join(app.getPath('userData'),'verification-error.txt'),err.stack);app.exit(1);});}
 if(smoke){require('./smoke.cjs').run({win,cat,state,showStore,hideStore,persist}).catch(async err=>{await fs.mkdir(path.join(__dirname,'../test-results'),{recursive:true});await fs.writeFile(path.join(__dirname,'../test-results/smoke-error.txt'),err.stack);app.exit(1);});}
});
app.on('window-all-closed',()=>app.quit());
