// Opt-in native integration test; uses isolated sessions and never signs in or buys.
const fs=require('node:fs/promises');const path=require('node:path');const assert=require('node:assert/strict');
const {app}=require('electron');const {groupProducts}=require('./model.cjs');
async function run({win,cat,state,persist}){
 const out=path.join(__dirname,'../test-results');await fs.mkdir(out,{recursive:true});
 const report={started:new Date().toISOString(),checks:[]};const mark=(name,data)=>{report.checks.push({name,...data});};
 const stores=await Promise.all([cat.stores('newworld','Broadway'),cat.stores('woolworths','Kelvin Grove')]);
 assert(stores[0].length&&stores[1].length);state.stores={newworld:stores[0].find(x=>/palmerston/i.test(x.address))||stores[0][0],woolworths:stores[1][0]};mark('Live stores',{newworld:state.stores.newworld.name,woolworths:state.stores.woolworths.name});
 const data=await Promise.all([cat.search('newworld',state.stores.newworld,'butter',0,true),cat.search('woolworths',state.stores.woolworths,'butter',0,true)]);
 for(let i=0;i<2;i++){assert(data[i].products.length>0);mark('Live search '+['newworld','woolworths'][i],{count:data[i].products.length,first:data[i].products[0].name,cents:data[i].products[0].cents});}
 const rows=groupProducts(data.flatMap(x=>x.products));mark('Comparison',{rows:rows.length,matched:rows.filter(r=>Object.keys(r.offers).length===2).length});
 state.basket=[];state.policy='cheapest';await persist();await win.loadURL(win.webContents.getURL());
 await win.webContents.executeJavaScript(`new Promise(resolve=>{const t=setInterval(()=>{if(document.querySelector('input[aria-label="Search groceries"]')){clearInterval(t);resolve(true)}},100)})`);
 // UI checks are performed on the real Electron renderer through native input later.
 await fs.writeFile(path.join(out,'native-smoke.json'),JSON.stringify(report,null,2));
}
module.exports={run};
