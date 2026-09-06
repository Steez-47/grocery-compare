// Live catalogue check in the app's isolated --verify profile. No sign-in or cart transfer.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const model=require('./model.cjs');
async function run({win,cat,app}){
 const output=app.getPath('userData'),checks=[];
 const nw=(await cat.stores('newworld','Broadway')).find(s=>/Palmerston/i.test(s.address));
 const ww=(await cat.stores('woolworths','Kelvin Grove'))[0];assert(nw&&ww);
 const stores={newworld:nw,woolworths:ww};
 const results=await Promise.all(['newworld','woolworths'].map(r=>cat.search(r,stores[r],'milk',0,true)));
 assert(results.every(r=>r.products.length));checks.push('Both selected stores return live catalogue products');
 const rows=model.groupProducts(results.flatMap(r=>r.products));
 const state={version:1,stores,loyalty:{newworld:true,woolworths:true},basket:[],policy:'cheapest'};
 const paired=rows.find(r=>Object.keys(r.offers).length===2&&model.selectOffer({...r,quantity:1,preferred:'cheapest'},'cheapest',state.loyalty));assert(paired);
 const next=model.addToBasket(state,paired,2);assert.equal(next.basket.length,1);checks.push('Live matched product added automatically at eligible cheapest price');
 await win.webContents.executeJavaScript(`window.grocery.save(${JSON.stringify(next)})`);
 await win.webContents.executeJavaScript(`window.grocery.setAppearance('light')`);
 await win.loadURL(win.webContents.getURL());
 const until=async condition=>{const start=Date.now();while(!await win.webContents.executeJavaScript(condition)){if(Date.now()-start>60000)throw Error('Live renderer timeout: '+condition);await new Promise(r=>setTimeout(r,200))}};
 await until(`document.querySelectorAll('.recommendation-shelf:first-of-type .product-row').length>=2 && document.querySelector('.basket-line')`);
 const expected='$'+(model.basketSummary(next.basket,next.policy,next.loyalty).cents/100).toFixed(2);
 assert.equal(await win.webContents.executeJavaScript(`document.querySelector('.total strong').textContent`),expected);
 assert(await win.webContents.executeJavaScript(`document.documentElement.scrollWidth<=window.innerWidth && document.querySelectorAll('.product-card').length===0`));
 checks.push('Built native UI renders live products and matching basket total without horizontal overflow');
 const geometry=await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.shelf-products .product-row')).slice(0,2).map(e=>({x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,padding:parseFloat(getComputedStyle(e).paddingLeft)}))`);
 assert.equal(geometry.length,2);assert.equal(geometry[0].y,geometry[1].y);assert(geometry[1].x>geometry[0].x);assert(geometry.every(g=>g.padding>=18));
 assert(await win.webContents.executeJavaScript(`!document.body.innerText.includes('Browse the essentials')&&!document.body.innerText.includes('Start with')`));
 checks.push('Products sit side by side with 18px padding and no filler sections');
 await new Promise(r=>setTimeout(r,800));
 await fs.writeFile(path.join(output,'redesign-live.png'),(await win.webContents.capturePage()).toPNG());
 await fs.writeFile(path.join(output,'verification.json'),JSON.stringify({version:app.getVersion(),checks,stores,matchedRows:rows.filter(r=>Object.keys(r.offers).length===2).length,total:expected},null,2));
}
module.exports={run};
