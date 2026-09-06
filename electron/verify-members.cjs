const assert=require('node:assert/strict');
const {basketSummary}=require('./model.cjs');
async function verifyMembers({cat,state,js,until,win,report}){
 const data=await Promise.all([cat.search('newworld',state.stores.newworld,'butter'),cat.search('woolworths',state.stores.woolworths,'haloumi')]);
 const members=data.map(d=>d.products.find(p=>p.member&&p.regularCents>p.cents&&p.unit==='each'));
 assert(members.every(Boolean),'Both live stores must return a usable member offer');
 const basket=members.map(p=>({key:p.retailer+':'+p.id,product:p,offers:{[p.retailer]:p},quantity:2,preferred:p.retailer}));
 await js(`window.grocery.save(${JSON.stringify({...state,basket})})`);await win.loadURL(win.webContents.getURL());
 const total=loyalty=>'$'+(basketSummary(basket,'cheapest',loyalty).cents/100).toFixed(2);
 await until(`document.querySelector('.total strong')?.textContent === '${total(state.loyalty)}'`);
 await js(`document.querySelector('.store-picker').click()`);await until(`document.querySelectorAll('.loyalty input').length===2`);
 const labels=await js(`Array.from(document.querySelectorAll('.loyalty')).map(x=>x.textContent)`);assert.deepEqual(labels,['Club+ Deals','Member Price']);
 await js(`document.querySelectorAll('.loyalty input')[1].click()`);
 await until(`document.querySelector('.total strong')?.textContent === '${total({newworld:true,woolworths:false})}'`);
 await js(`document.querySelectorAll('.loyalty input')[0].click()`);
 await until(`document.querySelector('.total strong')?.textContent === '${total({newworld:false,woolworths:false})}'`);
 await until(`(async()=>{const s=await window.grocery.load();return !s.loyalty.newworld&&!s.loyalty.woolworths})()`);
 await js(`document.querySelector('[aria-label="Close store settings"]').click()`);await win.loadURL(win.webContents.getURL());
 await until(`document.querySelector('.total strong')?.textContent === '${total({newworld:false,woolworths:false})}'`);
 report.checks.push({name:'Both live member prices, independent switches, basket totals and persisted membership',members:members.map(p=>({retailer:p.retailer,name:p.name,memberCents:p.cents,nonMemberCents:p.regularCents})),labels});
 await js(`window.grocery.save(${JSON.stringify(state)})`);await win.loadURL(win.webContents.getURL());await until(`Boolean(document.querySelector('.basket-empty'))`);
}
module.exports={verifyMembers};
