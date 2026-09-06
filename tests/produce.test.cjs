const test=require('node:test'),assert=require('node:assert/strict');
const {nwProduct,wwProducts}=require('../electron/catalogue.cjs');
const {sameProduct,groupProducts,quantityRules,validateQuantity,fitQuantity,basketSummary,repairWeightProduct}=require('../electron/model.cjs');
const p=(r,name,extra={})=>({retailer:r,id:name,name,brand:r==='newworld'?'':'Woolworths',unit:'kg',size:r==='newworld'?'kg':'',categories:[r==='newworld'?'Fruit & Vegetables':'Fruit & Veg','Fruit'],cents:399,available:true,min:0.2,step:0.1,max:99,...extra});
test('New World BOTH per-kg listings retain per-kg price and gram-based order limits',()=>{
 const x=nwProduct({productId:'5046542-KGM-000',saleType:'BOTH',name:'Bananas',displayName:'kg',singlePrice:{price:379},variableWeight:{minOrderQuantity:200,stepSize:100,stepUnitOfMeasure:'g'}},{id:'s'});
 assert.equal(x.unit,'kg');assert.equal(x.cents,379);assert.equal(x.min,0.2);assert.equal(x.step,0.1);
 assert.equal(nwProduct({productId:'bag-EA-000',saleType:'UNITS',name:'Lemons',displayName:'1kg',singlePrice:{price:599}},{id:'s'}).unit,'each');
});
test('Woolworths weight metadata is not a pack size and decimal quantities are stable',()=>{
 const [x,y]=wwProducts({My:{products:{results:[{sku:'s',productName:'Bananas Min Order 250g',variants:[{variantKey:'s-KG',variantPrice:{sellingPrice:3.75},purchaseUnit:{unit:'KILOGRAM',minimumQty:0.20000000298,incrementQty:0.10000000149,maximumQty:99}},{variantKey:'s-EA',variantPrice:{sellingPrice:0.94},purchaseUnit:{unit:'EACH'}}]}]}}},{id:'s'});
 assert.equal(x.size,'kg');assert.equal(x.min,0.2);assert.equal(x.step,0.1);assert.equal(y.unit,'each');assert.equal(y.cents,94);
});
for(const [a,b]of [['Bananas kg','Woolworths Fresh Bananas Yellow Loose Min Order 250g'],['Lemons kg','Woolworths Fresh Lemons'],['Royal Gala Apples kg','Woolworths Fresh Apples Royal Gala'],['Loose Red Tomatoes kg','Woolworths Fresh Tomatoes Loose per kg'],['Red Truss Tomatoes kg','Woolworths Fresh Tomatoes Truss Vine Loose per kg'],['Yellow Agria Potatoes kg','Woolworths Fresh Potatoes Agria Brushed per kg']])test('Loose produce equivalent: '+a,()=>assert(sameProduct(p('newworld',a),p('woolworths',b))));
test('produce variants, packs, each prices and prepared products cannot merge',()=>{
 for(const [a,b,extra]of [['Bananas kg','Fresh Green Cooking Bananas'],['Lemons kg','Organic Lemons'],['Granny Smith Apples kg','Royal Gala Apples'],['Red Truss Tomatoes kg','Loose Tomatoes'],['Red Potatoes kg','White Potatoes'],['Lemons kg','Lemons 1kg',{unit:'each',size:'1kg'}],['Bananas kg','Bananas',{unit:'each',cents:94}],['Lemons kg','Lemons Juice']])assert(!sameProduct(p('newworld',a),p('woolworths',b,extra)),a+' / '+b);
 assert(!sameProduct(p('newworld','Banana Chips kg',{categories:['Pantry']}),p('woolworths','Bananas')));
});
test('produce ambiguity remains unmatched; explicit separation is remembered',()=>{
 const a=p('newworld','Lemons kg'),b=p('woolworths','Lemons'),c={...b,id:'duplicate'};assert.equal(groupProducts([a,b,c]).length,3);
 const key=[a.retailer+':'+a.id,b.retailer+':'+b.id].sort().join('|');assert.equal(groupProducts([a,b],{rejected:[key]}).length,2);
});
test('shared weight quantities obey both retailers and estimates use kilograms',()=>{
 const a=p('newworld','Bananas',{cents:379}),b=p('woolworths','Bananas',{min:0.25,step:0.25,cents:375}),row={product:a,offers:{newworld:a,woolworths:b}},rules=quantityRules(row);
 assert.equal(rules.min,0.5);assert.equal(rules.step,0.5);assert(validateQuantity(0.5,a)&&validateQuantity(0.5,b));
 assert.equal(basketSummary([{...row,quantity:0.5,preferred:'cheapest'}],'cheapest',{newworld:true,woolworths:true}).cents,188);
 assert.equal(validateQuantity(0.25,{...b,step:0.1}),true);assert.equal(validateQuantity(0.3,{...b,step:0.1}),false);
 assert.equal(fitQuantity(0.2,{...b,step:0.1}),0.25);
});
test('old incorrectly classified basket products require refreshed weight metadata without changing price',()=>{
 const old=p('newworld','Bananas kg',{id:'5046542-KGM-000',unit:'each',min:1,step:1}),fixed=repairWeightProduct(old);assert.equal(fixed.unit,'kg');assert.equal(fixed.cents,old.cents);assert.equal(fixed.checkedAt,'1970-01-01T00:00:00Z');assert.equal(old.unit,'each');
});
