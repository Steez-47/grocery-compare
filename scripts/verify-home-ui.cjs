// Runs the real built renderer with isolated, deterministic retailer products.
const path=require('node:path');
if(process.type==='renderer'){
 const {contextBridge,ipcRenderer}=require('electron');
 const api=Object.fromEntries(['load','save','appearance','departments','feedPlan','homeCandidates','homeRank','compare','track','preferences','browserStatus','windowState'].map(method=>[method,(...args)=>ipcRenderer.invoke('home-test',method,args)]));
 api.onStoreStatus=api.onWindowState=()=>()=>{};contextBridge.exposeInMainWorld('grocery',api);
}else{
 const {app,BrowserWindow,ipcMain}=require('electron'),fs=require('node:fs/promises'),assert=require('node:assert/strict');
 const {homeRows}=require('../electron/home.cjs'),{emptyProfile}=require('../electron/recommend.cjs');
 const out=path.resolve(__dirname,'../test-results/home');app.setPath('userData',path.join(out,'profile'));
 const names=['Fruit','Milk','Bread','Rice','Coffee','Chips','Frozen meals','Household','Yoghurt','Vegetables','Chocolate','Breakfast cereal','Pasta','Sauces','Juice','Tea'];
 const plan=names.map((name,i)=>({id:String(i),name,sources:{}}));
 let state={version:1,stores:{newworld:{id:'nw',name:'Broadway'},woolworths:{id:'ww',name:'Kelvin Grove'}},loyalty:{newworld:true,woolworths:true},basket:[],policy:'cheapest'};
 const products=names.flatMap((name,i)=>Array.from({length:8},(_,j)=>({retailer:j%2?'woolworths':'newworld',id:i+'-'+j,name:name+' '+['Everyday favourite','Classic selection','Family pack','Original','Premium selection','Essentials','Organic','Fresh choice'][j],brand:['Pams','Woolworths','Homegrown','Market'][j%4],size:'500g',image:'',barcode:'',cents:350+j*50,regularCents:j===2?900:350+j*50,wasCents:j%3===0?1000:null,member:j===2,special:j%3===0||j===2,offer:'',unit:'each',min:1,max:99,step:1,unitPrice:'',available:true,restricted:false,storeId:j%2?'ww':'nw',checkedAt:new Date().toISOString(),url:'',categories:[name]})));
 ipcMain.handle('home-test',async(e,m,args)=>{
  if(m==='load')return state;if(m==='save'){state=args[0];return true}if(m==='appearance')return {theme:'light'};if(m==='departments')return [];if(m==='feedPlan')return plan;
  if(m==='homeCandidates')return {products:products.filter(p=>p.id.startsWith(args[0]+'-')),partial:false};
  if(m==='homeRank')return homeRows(args[0],emptyProfile(),{basket:args[4].map(p=>({offers:{[p.retailer]:p}})),loyalty:args[3],deals:args[1],limit:args[2]});
  if(m==='preferences')return {enabled:true,revision:0};if(m==='windowState')return {maximized:false};if(m==='browserStatus')return {connected:false};return true;
 });
 app.whenReady().then(async()=>{await fs.mkdir(out,{recursive:true});const win=new BrowserWindow({show:false,width:1440,height:1000,webPreferences:{preload:__filename,sandbox:false,contextIsolation:true,backgroundThrottling:false}});const run=code=>win.webContents.executeJavaScript(code),until=async code=>{const end=Date.now()+20000;while(!await run(code)){if(Date.now()>end)throw Error('Timed out '+code);await new Promise(r=>setTimeout(r,80))}};
 try{await win.loadFile(path.resolve(__dirname,'../dist/index.html'));await until(`document.querySelectorAll('.discovery-products .product-row').length===24 && !document.querySelector('.discovery-loading')`);
 assert.equal(await run(`document.querySelectorAll('.recommendation-shelf').length`),0);
 win.showInactive();await new Promise(r=>setTimeout(r,350));await fs.writeFile(path.join(out,'recommended.png'),(await win.webContents.capturePage()).toPNG());
 await run(`document.querySelectorAll('.discovery-tabs button')[1].click()`);await until(`document.querySelector('[aria-label="Best deals"]') && document.querySelectorAll('.discovery-products .product-row').length>0 && !document.querySelector('.discovery-loading')`);
 assert(await run(`Array.from(document.querySelectorAll('.discovery-products .product-row')).every(el=>el.querySelector(':scope > .sale-details'))`));
 await fs.writeFile(path.join(out,'deals.png'),(await win.webContents.capturePage()).toPNG());
 await run(`document.querySelector('.home-feed .more').click()`);await until(`document.querySelector('.discovery-caption').innerText.includes('16 aisles')&&!document.querySelector('.discovery-loading')`);
 await run(`document.querySelectorAll('.discovery-tabs button')[0].click()`);await until(`document.querySelector('[aria-label="Recommended products"]')&&!document.querySelector('.discovery-loading')`);
 await run(`document.querySelector('.discovery-products .row-add').click()`);await until(`document.querySelector('.basket').innerText.includes('1')`);
 win.setSize(1080,800);await new Promise(r=>setTimeout(r,200));assert(await run(`document.documentElement.scrollWidth<=innerWidth`));await fs.writeFile(path.join(out,'compact.png'),(await win.webContents.capturePage()).toPNG());
 await fs.writeFile(path.join(out,'report.json'),JSON.stringify({passed:true,checks:['24 mixed recommendations','deal badges on every deal','more expands to 16 aisles','quick add','compact width without page overflow']},null,2));console.log('Home UI checks passed');app.exit(0);
 }catch(e){console.error(e);await fs.writeFile(path.join(out,'error.txt'),String(e.stack));app.exit(1)}});
}

