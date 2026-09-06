// Run with: node scripts/verify-cart-pricing.cjs (after building).
// Exercises the real renderer with fixture data in an isolated Electron profile.
// No retailer requests, user shopping data or cart transfers are used.
const path=require('node:path');
if(!process.versions.electron){
 const {spawnSync}=require('node:child_process');
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const result=spawnSync(require('electron'),[__filename],{env,stdio:'inherit',windowsHide:true});
 if(result.error)throw result.error;process.exit(result.status??1);
}
const {app,BrowserWindow,ipcMain}=require('electron');
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const output=path.resolve(__dirname,'../test-results/cart-pricing');
app.disableHardwareAcceleration();
app.setPath('userData',path.join(output,'profile'));
const p=(retailer,extra={})=>({retailer,id:retailer,name:'Test apples',brand:'',size:'kg',image:'',unit:'kg',cents:325,regularCents:325,member:false,available:true,min:0.1,step:0.1,max:0.9,storeId:retailer,checkedAt:new Date().toISOString(),...extra});
const nw=p('newworld'),ww=p('woolworths',{cents:350,regularCents:350});
const initial={version:1,stores:{newworld:{id:'newworld',name:'Test New World'},woolworths:{id:'woolworths',name:'Test Woolworths'}},loyalty:{newworld:false,woolworths:false},policy:'cheapest',basket:[{key:'apples',product:nw,offers:{newworld:nw,woolworths:ww},quantity:0.7,preferred:'cheapest'}]};
let state=structuredClone(initial),win;
const errors=[];
app.whenReady().then(async()=>{
 await fs.mkdir(output,{recursive:true});
 const preload=path.join(output,'preload.cjs');
 await fs.writeFile(preload,`const {contextBridge,ipcRenderer}=require('electron');
 contextBridge.exposeInMainWorld('grocery',{
 load:()=>ipcRenderer.invoke('fixture-load'),save:s=>ipcRenderer.invoke('fixture-save',s),
 appearance:async()=>({theme:'light'}),setAppearance:async()=>true,departments:async()=>[],feedPlan:async()=>[{id:'test',name:'Everyday essentials'}],
 shelf:()=>ipcRenderer.invoke('fixture-shelf'),track:async()=>true,
 preferences:async()=>({enabled:false,revision:0}),stores:async()=>[],
 browserStatus:async()=>({connected:false}),onStoreStatus:()=>()=>{}
 });`);
 ipcMain.handle('fixture-load',()=>structuredClone(state));
 ipcMain.handle('fixture-save',(_event,next)=>{state=next;return true;});
 ipcMain.handle('fixture-shelf',()=>({rows:[initial.basket[0]],partial:false}));
 win=new BrowserWindow({show:false,width:1380,height:920,webPreferences:{preload,contextIsolation:true,sandbox:true,offscreen:true}});
 // Keep accidental network requests out of this deterministic test.
 win.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_details,callback)=>callback({cancel:true}));
 win.webContents.on('console-message',event=>{if(event.level==='error')errors.push(event.message)});
 const js=async code=>{try{return await win.webContents.executeJavaScript(code)}catch(error){throw new Error(error.message+'\nStep: '+code+'\nConsole: '+errors.join('\n'))}};
 const until=async expression=>{const start=Date.now();while(!await js(expression)){if(Date.now()-start>10000)throw new Error('Renderer timeout: '+expression);await new Promise(resolve=>setTimeout(resolve,50));}};
 const load=async next=>{state=structuredClone(next);await win.loadFile(path.resolve(__dirname,'../dist/index.html'));await until(`document.querySelector('.basket-count')?.textContent==='${next.basket.length}' && document.querySelector('.store-picker')?.textContent.includes('Test New World')`);};
 const amounts=()=>js(`({line:document.querySelector('.line-bottom > strong').textContent,total:document.querySelector('.total strong').textContent,quantity:document.querySelector('.basket-line .quantity-input input').value,blocked:document.querySelector('.checkout').disabled})`);
 const capture=async name=>{await new Promise(resolve=>setTimeout(resolve,180));await fs.writeFile(path.join(output,name),(await win.webContents.capturePage()).toPNG());};
 const checks=[];
 await load(initial);
 await js(`localStorage.removeItem('grocery.basketCollapsed')`);await load(initial);
 // $3.25/kg * 0.7kg is $2.275; binary multiplication used to show $2.27.
 assert.deepEqual(await amounts(),{line:'$2.28',total:'$2.28',quantity:'0.7',blocked:false});
 checks.push('Weighted half-cent line price matches subtotal in the built renderer');
 await js(`document.querySelector('.basket [aria-label="More Test apples"]').click()`);
 await until(`document.querySelector('.basket-line .quantity-input input').value==='0.8'`);
 assert.equal((await amounts()).total,'$2.60');
 await js(`document.querySelector('.basket [aria-label="More Test apples"]').click()`);
 await until(`document.querySelector('.basket-line .quantity-input input').value==='0.9'`);
 assert(await js(`document.querySelector('.basket [aria-label="More Test apples"]').disabled`));
 await js(`document.querySelector('.basket [aria-label="Less Test apples"]').click()`);
 await until(`document.querySelector('.basket-line .quantity-input input').value==='0.8'`);
 checks.push('Increment, maximum and decrement keep displayed prices consistent');
 await js(`document.querySelector('.store-comparison summary').click()`);
 await js(`Array.from(document.querySelectorAll('.plan')).find(p=>p.textContent.includes('Woolworths')).click()`);
 await until(`document.querySelector('.total strong').textContent==='$2.80'`);
 assert.equal((await amounts()).line,'$2.80');
 checks.push('Changing store updates line and subtotal together');
 const invalid=structuredClone(initial);
 invalid.basket[0].offers={newworld:p('newworld',{unit:'each',min:1,step:1,max:2})};
 invalid.basket[0].product=invalid.basket[0].offers.newworld;invalid.basket[0].quantity=1.5;
 await load(invalid);
 assert.deepEqual(await amounts(),{line:'Unavailable',total:'$0.00',quantity:'1.5',blocked:true});
 assert(await js(`document.querySelector('.cart-attention').textContent.includes('1 product needs attention')`));
 checks.push('Invalid each quantity is unavailable and blocks checkout');
 await js(`document.querySelector('.basket [aria-label="More Test apples"]').click()`);
 await until(`document.querySelector('.basket-line .quantity-input input').value==='2'`);
 assert.equal((await amounts()).blocked,false);
 checks.push('Quantity control repairs an invalid amount to a valid store increment');
 const member=structuredClone(initial);
 member.basket[0].offers.newworld={...nw,cents:100,regularCents:null,member:true};
 await load(member);assert.equal((await amounts()).total,'$2.45');
 member.loyalty.newworld=true;await load(member);assert.equal((await amounts()).total,'$0.70');
 checks.push('Membership changes select only eligible prices');
 const free=structuredClone(initial);free.basket[0].offers.newworld.cents=0;
 await load(free);assert.deepEqual(await amounts(),{line:'$0.00',total:'$0.00',quantity:'0.7',blocked:false});
 checks.push('A zero-price item remains available');
 await load(initial);
 assert(await js(`document.querySelector('.item-source').textContent.includes('New World') && document.querySelector('.item-unit-price').textContent.includes('$3.25 / kg')`));
 await js(`document.querySelector('.item-options summary').click()`);
 await js(`const select=document.querySelector('.item-options select');select.value='woolworths';select.dispatchEvent(new Event('change',{bubbles:true}));`);
 await until(`document.querySelector('.total strong').textContent==='$2.45'`);
 assert.equal((await amounts()).quantity,'0.7');
 assert(await js(`document.querySelector('.shopping-mode p').textContent.includes('selected manually')`));
 checks.push('Store options make item choices explicit and preserve quantities');
 const expandedWidth=await js(`document.querySelector('.shop').getBoundingClientRect().width`);
 await js(`document.querySelector('.basket-tools [aria-label="Collapse basket"]').click()`);
 await until(`document.querySelector('.basket').hidden`);
 assert(await js(`document.querySelector('.shop').getBoundingClientRect().width>${expandedWidth} && document.activeElement===document.querySelector('.basket-toggle') && document.querySelector('.basket-toggle').getAttribute('aria-expanded')==='false'`));
 await load(initial);
 assert(await js(`document.querySelector('.basket').hidden`));
 await until(`Boolean(document.querySelector('.recommendation-shelf .row-add'))`);
 await js(`document.querySelector('.recommendation-shelf .row-add').click()`);
 await until(`document.querySelector('.basket-toggle strong')?.textContent==='$2.60'`);
 assert(await js(`document.querySelector('.basket').hidden && document.querySelector('.toast').textContent.includes('Added Test apples')`));
 checks.push('Adding while collapsed updates the total and confirms the addition without reopening');
 await capture('cart-collapsed.png');
 await js(`document.querySelector('.basket-toggle').click()`);
 await until(`!document.querySelector('.basket').hidden`);
 assert.equal((await amounts()).total,'$2.60');
 checks.push('Collapse frees browsing space, moves keyboard focus and persists through reload');
 await load({...initial,basket:[]});
 assert(await js(`document.querySelector('.basket-empty').textContent.includes('No items yet')`));
 await js(`document.querySelector('.basket-empty button').click()`);
 await until(`document.querySelector('.basket').hidden`);
 await js(`document.querySelector('.basket-toggle').click()`);
 checks.push('Empty basket explains how to add items and supports collapse and reopen');
 // A varied basket checks wrapping, scrolling and both store subtotals.
 const milk=p('woolworths',{id:'milk',name:'Standard milk 2L',unit:'each',size:'2L',cents:460,min:1,step:1,max:10});
 const oats=p('newworld',{id:'oats',name:'Wholegrain rolled oats 750g',unit:'each',size:'750g',cents:390,min:1,step:1,max:10});
 const preview=structuredClone(initial);
 preview.basket.push({key:'milk',product:milk,offers:{woolworths:milk},quantity:2,preferred:'cheapest'},{key:'oats',product:oats,offers:{newworld:oats},quantity:1,preferred:'cheapest'});
 await load(preview);
 assert(await js(`document.querySelector('.total strong').textContent==='$15.38' && document.querySelectorAll('.basket-breakdown>div').length===2`));
 await capture('cart.png');
 await js(`document.querySelector('.store-comparison summary').click()`);
 assert(await js(`Array.from(document.querySelectorAll('.plan')).filter(p=>p.textContent.includes('partial total')).length===2`));
 await capture('cart-comparison.png');
 await js(`document.querySelector('.store-comparison summary').click()`);
 await js(`document.querySelector('.theme-toggle').click()`);
 await until(`document.documentElement.dataset.theme==='dark'`);
 await capture('cart-dark.png');
 win.setSize(1040,700);
 await until(`window.innerWidth===1040`);
 assert(await js(`document.documentElement.scrollWidth<=window.innerWidth && document.querySelector('.checkout').getBoundingClientRect().bottom<=window.innerHeight`));
 await capture('cart-compact.png');
 checks.push('Store breakdowns, partial totals, dark mode and minimum window size');
 assert.deepEqual(errors,[]);
 await fs.writeFile(path.join(output,'verification.json'),JSON.stringify({checks,errors},null,2));
 console.log(checks.map(check=>'PASS '+check).join('\n'));app.exit(0);
}).catch(error=>{console.error(error);app.exit(1);});
