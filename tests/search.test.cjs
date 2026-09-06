const test=require('node:test'),assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const {parseQuery,SearchIndex,rankProducts,rankRows,searchCatalogue}=require('../electron/search.cjs');
const p=(id,name,size='',extra={})=>({id,retailer:'newworld',name,size,brand:'',...extra});
const water=p('water','Pure Spring Water','24 x 500ml');
const fixtures=[p('beer','Lager','24 pack'),p('cola','Cola','24pk'),p('toilet','Toilet Paper','24 rolls'),p('small','Spring Water','12 x 500ml'),p('single','Spring Water','500ml'),water,p('sparkling','Sparkling Water','24 pack'),p('watermelon','Watermelon','24pk')];
for(const query of ['water 24 pk','water 24pk','water 24-pack','WATER 24 PACK','24 pack water','water pack of 24','water 24 bottles','water 24ct','water 24 pks']){
 test(`requires water AND count: ${query}`,()=>assert.deepEqual(new Set(rankProducts(fixtures,query).map(x=>x.id)),new Set(['water','sparkling'])));
}
for(const query of ['water 24 x 500ml','water 24×500ml','water 24 × 0.5 L','water 500 ml 24pk','water 24-pack 0.5 litres','water 500ml x 24']){
 test(`matches equivalent multipack notation: ${query}`,()=>assert.deepEqual(rankProducts(fixtures,query).map(x=>x.id),['water']));
}
test('reverse multipack notation in the retailer title is supported',()=>assert.equal(rankProducts([p('reverse','Water 500ml x 24')],'water 24pk 0.5l').length,1));
for(const [query,name,size] of [
 ['milk 2l','Milk','2000ml'],['rice 1 kg','Rice','1000g'],['yoghurt 500g','Greek Yogurt','0.5kg'],
 ['soya milk','Soy Milk','1L'],['lite milk','Light Milk','2L'],['apples','Apple',''],['tomatoes','Tomato',''],
 ["vogels bread","Vogel’s Bread",'750g'],['cafe coffee','Café Coffee','200g'],['gluten-free pasta','Gluten Free Pasta','500g'],
 ['milk 1.5%','Milk 1.5% Fat','2L'],['eggs size 7','Eggs Size 7','12pk'],
 ])test(`normalises ${query}`,()=>assert.equal(rankProducts([p('match',name,size)],query).length,1));

for(const [query,name,size] of [
 ['water','Watermelon',''],['ham','Shampoo',''],['salt','Unsalted Butter',''],['milk 2l','Milk','2kg'],
 ['water 24pk','Water','124pk'],['water 24pk','Water','24L'],['water 24pk','Water','12 x 500ml'],
 ['water 12l','Water','24 x 500ml'],['gluten free pasta','Pasta','500g'],['milk 1.5%','Milk 3% Fat','2L'],
 ['eggs size 7','Eggs Size 6','12pk'],['milk chocolate','Milk','2L'],['water 24pk','Water 24 Hour Hydration','500ml'],
 ])test(`rejects missing or conflicting intent: ${query} / ${name} ${size}`,()=>assert.deepEqual(rankProducts([p('wrong',name,size)],query),[]));

test('category, promotion, price and unrelated metadata cannot satisfy intent',()=>{
 assert.deepEqual(rankProducts([p('cola','Cola','24pk',{categories:['Water'],tags:['water'],offer:'water special',cents:24})],'water 24pk'),[]);
 assert.deepEqual(rankProducts([p('water','Water','500ml',{max:24,cents:24,offer:'24 pack offer'})],'water 24pk'),[]);
});
test('brand field can satisfy a brand query, but brand alone cannot substitute for product',()=>{
 const milk=p('milk','Blue Milk','2L',{brand:'Anchor'});
 assert.deepEqual(rankProducts([milk],'anchor milk 2l'),[milk]);
 assert.deepEqual(rankProducts([milk],'anchor butter'),[]);
});
test('relevance favours a direct product name over a longer incidental match',()=>{
 const direct=p('direct','Milk Chocolate','200g'),incidental=p('other','Biscuit Pieces Coated In Milk Chocolate With Caramel','200g');
 assert.equal(rankProducts([incidental,direct],'milk chocolate')[0],direct);
});
test('duplicates are removed per retailer while store offers stay distinct',()=>{
 assert.equal(rankProducts([water,water,{...water,retailer:'woolworths'}],'water').length,2);
});
test('blank, punctuation, stopword and hostile-looking inputs are handled literally',()=>{
 for(const q of ['', '   ','---','and the','.*','__proto__','constructor','water | beer','water <script>alert(1)</script>'])assert.deepEqual(rankProducts(fixtures,q),[]);
});
test('word order and duplicates do not change membership',()=>{
 const expected=rankProducts(fixtures,'water 24 pk').map(x=>x.id).sort();
 for(const q of ['24 pk water','water water 24pk','24pk WATER water'])assert.deepEqual(rankProducts(fixtures,q).map(x=>x.id).sort(),expected);
});
test('adding constraints never introduces new matches across a generated corpus',()=>{
 const products=[];for(const noun of ['Water','Cola','Beer','Toilet Paper'])for(const count of [6,12,24,48])for(const volume of [330,500,600])products.push(p(products.length,noun,`${count} x ${volume}ml`));
 const base=new Set(rankProducts(products,'water').map(x=>x.id));
 const constrained=rankProducts(products,'water 24pk');assert.equal(constrained.length,3);
 assert(constrained.every(x=>base.has(x.id)));assert.equal(rankProducts(products,'water 24pk 500ml').length,1);
 assert.deepEqual(rankProducts(products.reverse(),'water 24pk').map(x=>x.id),constrained.map(x=>x.id));
});
test('search ranks compared rows globally, retaining only matching offers as evidence',()=>{
 const other=p('other','Chocolate Milk Biscuit Snack','200g');
 const direct=p('direct','Milk','2L');
 const rows=[{key:'other',product:other,offers:{newworld:other}},{key:'direct',product:direct,offers:{newworld:direct}},{key:'beer',product:fixtures[0],offers:{newworld:fixtures[0]}}];
 assert.deepEqual(rankRows(rows,'milk').map(r=>r.key),['direct','other']);
});

for(const retailer of ['newworld','woolworths']){
 test(`${retailer}: retrieves by product words and finds constrained matches on later pages`,async()=>{
  const calls=[];const cat={search:async(...args)=>{calls.push(args);return {products:args[3]===2?[water]:[fixtures[0]],pages:4,total:144}}};
  const result=await searchCatalogue(cat,retailer,{id:'s'},'water 24 pk');
  assert.deepEqual(result.products,[water]);assert.equal(result.nextPage,3);
  assert.deepEqual(calls.map(c=>c[2]),['water','water','water']);assert.deepEqual(calls.map(c=>c[3]),[0,1,2]);
  const last=await searchCatalogue(cat,retailer,{id:'s'},'water 24 pk',result.nextPage);
  assert.equal(last.nextPage,null);assert.equal(calls.at(-1)[3],3);
 });
}
test('pack-only queries preserve a usable retailer query',async()=>{
 let query;await searchCatalogue({search:async(r,s,q)=>{query=q;return {products:fixtures,pages:1,total:8}}},'newworld',{id:'s'},'24 pk');
 assert.equal(query,'24 pk');assert.equal(parseQuery('water 24pk 500ml').retrievalQuery,'water');
});
test('category browsing passes through unchanged',async()=>{
 const data={products:fixtures,pages:8,total:288},options={category:{path:['Drinks']}};let args;
 assert.equal(await searchCatalogue({search:async(...a)=>{args=a;return data}},'newworld',{id:'s'},'',2,true,options),data);
 assert.equal(args[3],2);assert.equal(args[4],true);assert.equal(args[5],options);
});
test('bounded scanning exposes continuation even when all three pages are irrelevant',async()=>{
 let calls=0;const result=await searchCatalogue({search:async()=>{calls++;return {products:[fixtures[0]],pages:20,total:720}}},'newworld',{id:'s'},'water 24pk');
 assert.equal(calls,3);assert.equal(result.nextPage,3);assert.deepEqual(result.products,[]);
});
test('enough matches stop additional network requests, with deduplication',async()=>{
 let calls=0;const result=await searchCatalogue({search:async()=>{calls++;return {products:Array.from({length:12},(_,i)=>({...water,id:String(i)})),pages:20,total:720}}},'newworld',{id:'s'},'water 24pk');
 assert.equal(calls,1);assert.equal(result.nextPage,1);assert.equal(result.products.length,12);
});
test('errors are surfaced and force/store parameters reach every request',async()=>{
 const store={id:'chosen'};let calls=0;
 await assert.rejects(searchCatalogue({search:async(r,s,q,page,force)=>{assert.equal(s,store);assert.equal(force,true);if(calls++)throw Error('offline');return {products:[],pages:3}}},'newworld',store,'water 24pk',0,true),/offline/);
});
test('source cursor respects the IPC page ceiling',async()=>{
 const seen=[];const result=await searchCatalogue({search:async(r,s,q,page)=>{seen.push(page);return {products:[],pages:100}}},'newworld',{id:'s'},'water',27);
 assert.deepEqual(seen,[27,28]);assert.equal(result.nextPage,null);
});
test('10,000-product index: exact relevance and repeated query performance',t=>{
 const products=Array.from({length:10000},(_,i)=>p(String(i),i%10?'Cola':'Spring Water',`${i%2?12:24} x 500ml`));
 const start=performance.now(),index=new SearchIndex(products),built=performance.now();
 for(let i=0;i<100;i++)assert.equal(index.search('water 24pk').length,1000);
 const elapsed=performance.now()-built;
 t.diagnostic(`10,000 products: index ${(built-start).toFixed(1)}ms; 100 searches ${elapsed.toFixed(1)}ms`);
 assert(elapsed<10000,'100 indexed searches should complete within a generous 10-second budget');
});
