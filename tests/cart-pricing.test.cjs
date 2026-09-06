const test=require('node:test');
const assert=require('node:assert/strict');
const {basketSummary,selectOffer,effectivePrice,validateQuantity,fitQuantity,quantityRules}=require('../electron/model.cjs');

const product=(retailer='newworld',extra={})=>({retailer,id:retailer,name:'Groceries',unit:'each',cents:500,regularCents:600,member:false,available:true,min:1,step:1,max:99,...extra});
const line=(offers,quantity=1,preferred='cheapest')=>({product:offers[0],offers:Object.fromEntries(offers.map(p=>[p.retailer,p])),quantity,preferred});
const loyalty={newworld:false,woolworths:false};
const summary=(lines,policy='cheapest',members=loyalty)=>basketSummary(lines,policy,members);

test('empty basket is zero with no missing items or transfers',()=>{
 assert.deepEqual(summary([]),{cents:0,missing:0,shops:{newworld:[],woolworths:[]}});
});

test('weighted half cents round up, including binary floating-point boundaries',()=>{
 for(const [cents,quantity,expected] of [[325,0.7,228],[445,0.7,312],[399,0.5,200],[25,0.58,15],[100,0.145,15],[499,0.001,0],[500,0.001,1]]){
  const result=summary([line([product('newworld',{unit:'kg',min:0.001,step:0.001,cents})],quantity)]);
  assert.equal(result.missing,0);assert.equal(result.cents,expected,`${cents} cents/kg at ${quantity} kg`);
 }
});

test('subtotal sums individually rounded lines',()=>{
 const p=product('newworld',{unit:'kg',min:0.1,step:0.1,cents:399});
 assert.equal(summary([line([p],0.5),line([{...p,id:'second'}],0.5)]).cents,400);
});

test('invalid or absent prices stay missing; zero is a valid price',()=>{
 for(const cents of [null,undefined,NaN,Infinity,-1,1.5,'500',Number.MAX_SAFE_INTEGER+1]){
  const p=product('newworld',{cents});
  assert.equal(effectivePrice(p,false),null,`price ${String(cents)}`);
  assert.equal(summary([line([p])]).missing,1);
 }
 assert.equal(summary([line([product('newworld',{cents:0})],3)]).cents,0);
 assert.equal(summary([line([product('newworld',{cents:0})],3)]).missing,0);
});

test('membership uses the eligible price and falls back to another store when unknown',()=>{
 const nw=product('newworld',{cents:400,regularCents:700,member:true}),ww=product('woolworths',{cents:550});
 const l=line([nw,ww],2);
 assert.equal(summary([l]).cents,1100);
 assert.equal(summary([l],'cheapest',{...loyalty,newworld:true}).cents,800);
 assert.equal(summary([l],'newworld').cents,1400);
 for(const regularCents of [null,undefined,NaN,-100]){
  const unknown=line([{...nw,regularCents},ww]);
  assert.equal(summary([unknown]).cents,550);
  assert.equal(summary([unknown],'newworld').missing,1);
 }
 assert.equal(summary([line([{...nw,regularCents:0}])]).missing,0);
});

test('invalid each quantities are missing and never included in transfer lists',()=>{
 for(const quantity of [0,-1,1.5,100,NaN,Infinity,undefined,null,'2']){
  const l={...line([product()]),quantity};
  assert.deepEqual(summary([l]),{cents:0,missing:1,shops:{newworld:[],woolworths:[]}},`quantity ${String(quantity)}`);
 }
});

test('cheapest selects only stores that accept the requested each quantity',()=>{
 const nw=product('newworld',{cents:200,max:2}),ww=product('woolworths',{cents:300});
 assert.equal(summary([line([nw,ww],3)]).cents,900);
 assert.equal(summary([line([nw,ww],3)],'newworld').missing,1);
 assert.equal(summary([line([nw,ww],3,'newworld')]).missing,1);
 assert.equal(summary([line([nw,ww],3,'newworld')],'woolworths').cents,900);
});

test('weight minima, increments and maxima determine offer eligibility',()=>{
 const nw=product('newworld',{unit:'kg',cents:300,min:0.2,step:0.1,max:2});
 const ww=product('woolworths',{unit:'kg',cents:400,min:0.25,step:0.25,max:3});
 for(const [quantity,cents,missing] of [[0.25,100,0],[0.3,90,0],[2.5,1000,0],[0.1,0,1],[3.25,0,1]]){
  const result=summary([line([nw,ww],quantity)]);assert.equal(result.cents,cents);assert.equal(result.missing,missing);
 }
});

test('unavailable and partially missing baskets preserve valid totals',()=>{
 const nw=product('newworld',{available:false,cents:100}),ww=product('woolworths',{cents:600});
 const l=line([nw,ww],2);
 assert.equal(summary([l]).cents,1200);
 const result=summary([l,line([nw])]);
 assert.equal(result.cents,1200);assert.equal(result.missing,1);assert.equal(result.shops.woolworths.length,1);
 assert.equal(summary([line([nw,ww],1,'newworld')]).missing,1);
});

test('tied prices are deterministic and calculating a plan does not mutate the basket',()=>{
 const l=line([product(),product('woolworths')],2),before=structuredClone(l);
 assert.equal(selectOffer(l,'cheapest',loyalty).retailer,'newworld');
 for(const policy of ['cheapest','newworld','woolworths'])summary([l],policy);
 assert.deepEqual(l,before);
});

test('quantity validation rejects malformed rules and fractional each units',()=>{
 for(const extra of [{min:0},{step:0},{step:-1},{max:NaN},{min:2,max:1},{min:0.5,step:0.5}]){
  assert.equal(validateQuantity(extra.min||1,product('newworld',extra)),false);
 }
 assert.equal(validateQuantity(0.1+0.2,product('newworld',{unit:'kg',min:0.1,step:0.1})),true);
});

test('fitting a quantity caps it at the last valid increment below the maximum',()=>{
 const p=product('newworld',{unit:'kg',min:0.25,step:0.25,max:0.9});
 for(const [requested,expected] of [[0.1,0.25],[0.3,0.5],[0.75,0.75],[0.8,0.75],[2,0.75]]){
  const fitted=fitQuantity(requested,p);assert.equal(fitted,expected);assert(validateQuantity(fitted,p));
 }
});

test('shared quantity maximum is on the common increment grid',()=>{
 const a=product('newworld',{unit:'kg',min:0.2,step:0.1,max:0.9}),b=product('woolworths',{unit:'kg',min:0.25,step:0.25,max:0.9});
 const rules=quantityRules(line([a,b],0.5));
 assert.equal(rules.min,0.5);assert.equal(rules.max,0.5);
 assert(validateQuantity(rules.max,a));assert(validateQuantity(rules.max,b));
});
