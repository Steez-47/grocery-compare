const test=require('node:test'),assert=require('node:assert/strict');
const {sameProduct,groupProducts,houseBrand}=require('../electron/model.cjs');
const {departments,rankSimilar,recommendationQuery}=require('../electron/browse.cjs');
const {nwProduct,wwProducts}=require('../electron/catalogue.cjs');
const p=(r,brand,name,size='2L',extra={})=>({retailer:r,id:r+brand+name,brand,name:brand+' '+name+' '+size,size,unit:'each',available:true,cents:500,...extra});
test('Pams and Woolworths house-brand milk pair as equivalents with different barcodes',()=>{
 const a=p('newworld','Pams Value','Standard Milk','2L',{barcode:'one'}),b=p('woolworths','Woolworths','Milk Standard','2L',{barcode:'two'});
 assert(sameProduct(a,b));assert.equal(groupProducts([a,b])[0].equivalent,true);
});
test('house-brand equivalents preserve milk type, dietary claims, size and egg housing',()=>{
 for(const [a,b]of [
  [p('newworld','Pams Value','Lite Milk'),p('woolworths','Woolworths','Milk Standard')],
  [p('newworld','Pams Value','Standard Milk','2L'),p('woolworths','Woolworths','Milk Standard','3L')],
  [p('newworld','Pams Organic','Standard Milk'),p('woolworths','Woolworths','Milk Standard')],
  [p('newworld','Pams Free Range','Size 7 Eggs','12pk'),p('woolworths','Woolworths','Barn Size 7 Eggs','12 Pack')],
  [p('newworld','Pams','Gluten Free Pasta','500g'),p('woolworths','Woolworths','Pasta','500g')],
 ])assert.equal(sameProduct(a,b),false,`${a.name} vs ${b.name}`);
});
test('known salted Pams butter pairs with salted but never unsalted Woolworths butter',()=>{
 const a=p('newworld','Pams','Pure Butter','500g',{id:'5023660-EA-000'});
 assert(sameProduct(a,p('woolworths','Woolworths','Butter Salted','500g')));
 assert(!sameProduct(a,p('woolworths','Woolworths','Butter Unsalted','500g')));
});
test('value-tier equivalents are preferred over another plausible house-brand candidate',()=>{
 const a=p('newworld','Pams Value','Long Grain Rice','1kg'),b=p('newworld','Pams','Long Grain Rice','1kg'),c=p('woolworths','Woolworths Essentials','Rice Long Grain','1kg');
 const row=groupProducts([a,b,c]).find(r=>Object.keys(r.offers).length===2);assert.equal(row.offers.newworld.brand,'Pams Value');
});
test('ordinary national brands do not become house brands',()=>{assert(!houseBrand(p('newworld','Anchor','Milk')));assert(!sameProduct(p('newworld','Pams','Milk'),p('woolworths','Anchor','Milk')))});
test('shared aisles use real category paths and omit unsupported aisles',()=>{
 const nw=[{name:'Fridge, Deli & Eggs',children:[{name:'Milk',children:[]}]}];const ww={My:{categories:{children:[{name:'Fridge & Deli',children:[{name:'Milk',key:'milk-key'}]}]}}};
 const d=departments(nw,ww);assert.equal(d.length,1);assert.equal(d[0].children.length,1);assert.deepEqual(d[0].children[0].sources.newworld.path,['Fridge, Deli & Eggs','Milk']);assert.equal(d[0].children[0].sources.woolworths.key,'milk-key');
});
test('similar recommendations rank relevant category products and exclude unavailable/restricted items',()=>{
 const source=p('newworld','Anchor','Blue Milk','2L',{categories:['Milk','Fresh Milk']});
 const close=p('woolworths','Woolworths','Milk Standard','2L',{categories:['Milk','Fresh Milk']}),other=p('woolworths','Example','Bread','700g',{categories:['Bakery']});
 assert.equal(recommendationQuery(source),'milk');assert.deepEqual(rankSimilar(source,[source,other,close,{...close,id:'unavailable',available:false},{...close,id:'restricted',restricted:true}]),[close]);
});
test('metadata adapters retain categories, dietary flags, special status and health stars',()=>{
 const nw=nwProduct({productId:'1',name:'Milk',singlePrice:{price:300},categoryTrees:[{level0:'Fridge',level1:'Milk'}],facets:[{itemDescription:'Non-GMO'}],decalCode:'SPECIAL'},{id:'s'});
 assert.deepEqual(nw.categories,['Fridge','Milk']);assert.deepEqual(nw.tags,['Non-GMO']);assert(nw.special);
 const ww=wwProducts({My:{products:{results:[{sku:'1',categoryHierarchyNames:{lvl0:['All Departments'],lvl1:['Fridge'],lvl2:['Milk']},healthStarRating:4,variants:[{variantKey:'1-EA',variantPrice:{sellingPrice:3,isSpecial:true}}]}]}}},{id:'s'})[0];
 assert.deepEqual(ww.categories,['Fridge','Milk']);assert.equal(ww.healthStar,4);assert(ww.special);
});
