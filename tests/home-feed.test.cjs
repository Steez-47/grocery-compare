const test=require('node:test'),assert=require('node:assert/strict');
const {saleInfo}=require('../electron/pricing.cjs'),{homeRows}=require('../electron/home.cjs'),{emptyProfile}=require('../electron/recommend.cjs');
const p=(id,extra={})=>({id,retailer:'newworld',name:'Product '+id,brand:id,size:'500g',cents:500,regularCents:500,member:false,available:true,restricted:false,unit:'each',min:1,max:99,step:1,categories:['Pantry'],...extra});
const loyalty={newworld:true,woolworths:true};
test('Sale reference and percentage require a real lower price',()=>{
 assert.equal(saleInfo(p('a'),true),null);assert.equal(saleInfo(p('a',{wasCents:400}),true),null);
 assert.deepEqual(saleInfo(p('a',{wasCents:1000}),true),{label:'Sale',reference:1000,referenceLabel:'Was',saving:500,percent:50});
 assert.equal(saleInfo(p('a',{special:true}),true).reference,null);
});
test('Member references are current non-member prices and honour eligibility',()=>{
 const product=p('a',{member:true,cents:400,regularCents:600,wasCents:800});
 assert.equal(saleInfo(product,true).reference,600);assert.equal(saleInfo(product,true).referenceLabel,'Non-member');
 assert.equal(saleInfo(product,false).reference,800);assert.equal(saleInfo(product,false).saving,200);
 assert.equal(saleInfo({...product,wasCents:null},false),null);
 assert.equal(saleInfo({...product,regularCents:null},false),null);
});
test('Unavailable or restricted offers never appear as deals',()=>{
 for(const extra of [{available:false},{restricted:true},{cents:null}])assert.equal(saleInfo(p('a',{wasCents:1000,...extra}),true),null);
});
test('Best deals rank verified percentages then specials without references',()=>{
 const products=[p('small',{wasCents:600}),p('special',{special:true}),p('half',{wasCents:1000}),p('normal')];
 assert.deepEqual(homeRows(products,emptyProfile(),{loyalty,deals:true}).map(r=>r.product.id),['half','small','special']);
});
test('Home feed deduplicates repeated pages, mixes categories and excludes basket products',()=>{
 const products=Array.from({length:64},(_,i)=>p(String(i),{name:['Apples','Milk','Bread','Rice','Soap','Coffee','Chips','Pizza'][i%8]+' '+i,categories:['Category '+i%8]}));
 const rows=homeRows([...products,...products],emptyProfile(),{loyalty,limit:24});
 assert.equal(rows.length,24);assert.equal(new Set(rows.map(r=>r.key)).size,24);assert.ok(new Set(rows.slice(0,8).map(r=>r.product.categories[0])).size>=6);
 const next=homeRows(products,emptyProfile(),{loyalty,limit:24,basket:[rows[0]]});assert.ok(!next.some(r=>r.key===rows[0].key));
});
