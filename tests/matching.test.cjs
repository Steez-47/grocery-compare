const test=require('node:test');const assert=require('node:assert/strict');
const {sameProduct,groupProducts}=require('../electron/model.cjs');
const make=(retailer,name,brand,size,id=name)=>({retailer,name,brand,size,id,unit:'each'});
const examples=[
 ['Anchor','Blue Milk','Milk Standard Blue','2L','2L'],
 ['Anchor','Lite Milk','Milk Lite 98.5% Fat Free','2L','2L'],
 ['Anchor','Zero Lacto Blue Milk','Lactose Free Milk Blue','2L','2L'],
 ['Tip Top','Supersoft White Toast Bread','Super Soft Toast Bread White','700g','700g'],
 ['Tip Top','Supersoft Honeygrain Toast Bread','Super Soft Toast Bread Honey Grain','700g','700g'],
 ['Mainland','Salted Buttersoft Spreadable Butter','Buttersoft Butter Salted','375g','375g'],
 ['Mainland','Buttersoft Salted Reduced Spreadable Butter','Buttersoft Butter Reduced Salt','375g','375g'],
 ['Westgold','Salted Grass Fed New Zealand Butter','Butter Salted','400g','400g'],
 ['Dairyworks','Garlic & Sea Salt Butter','Butter Garlic & Seasalt','100g','100g'],
 ['Woodland','Free Range Grade 7 Eggs','Eggs Free Range Size 7','10pk','10 Pack'],
 ['Henergy','SPCA Size 7 Barn Eggs','Eggs Cage Free Size 7','12pk','12 Pack'],
 ['Better Eggs','Free Range Size 7 Eggs','S.P.C.A Eggs Free Range Size 7','12pk','12 Pack'],
];
for(const [brand,a,b,sa,sb] of examples)test(`Retailer wording: ${brand} ${a}`,()=>assert.equal(sameProduct(make('newworld',`${brand} ${a} ${sa}`,brand,sa),make('woolworths',`${brand} ${b} ${sb}`,brand,sb)),true));
test('different variants stay separate despite sharing most words',()=>{
 for(const [a,b,brand,size] of [
  ['Butter Salted','Butter Unsalted','Mainland','500g'],
  ['Buttersoft Butter Salted','Buttersoft Butter Reduced Salt','Mainland','375g'],
  ['Supersoft White Toast Bread','Super Soft White Sandwich Bread','Tip Top','700g'],
  ['Supersoft White Toast Bread','Supersoft High Fibre White Toast Bread','Tip Top','700g'],
  ['Blue Milk','Lactose Free Milk Blue','Anchor','2L'],
  ['Milk Lite','Milk Trim','Anchor','2L'],
  ['Free Range Size 6 Eggs','Free Range Size 7 Eggs','Woodland','12pk'],
  ['Colony Caged Size 7 Eggs','Cage Free Barn Size 7 Eggs','Farmer Brown','12pk'],
  ['Chicken Breast Skinless','Chicken Thigh Skinless','Waitoa','400g'],
  ['Coffee Whole Beans','Coffee Plunger Grind','Coffee Supreme','200g'],
 ])assert.equal(sameProduct(make('newworld',a,brand,size),make('woolworths',b,brand,size)),false,`${a} vs ${b}`);
});
test('units normalize, but multipacks, unknown sizes, brands and barcodes are protected',()=>{
 const a=make('newworld','Example Flour 1kg','Example','1kg');
 assert.equal(sameProduct(a,make('woolworths','Example Flour 1000g','Example','1000g')),true);
 assert.equal(sameProduct(a,make('woolworths','Example Flour 2 x 500g','Example','2 x 500g')),false);
 assert.equal(sameProduct(a,make('woolworths','Example Flour','Example','')),false);
 assert.equal(sameProduct(a,make('woolworths','Other Flour 1kg','Other','1kg')),false);
 assert.equal(sameProduct({...a,barcode:'123'},{...a,retailer:'woolworths',barcode:'456'}),false);
});
test('paired products appear first and grouping is independent of retailer ordering',()=>{
 const a=make('newworld','Anchor Blue Milk 2l','Anchor','2l'),b=make('woolworths','Anchor Milk Standard Blue 2L','Anchor','2L'),c=make('newworld','Pams Milk 2L','Pams','2L');
 for(const input of [[c,a,b],[b,c,a]]){const rows=groupProducts(input);assert.equal(rows.length,2);assert.deepEqual(Object.keys(rows[0].offers).sort(),['newworld','woolworths']);}
});
