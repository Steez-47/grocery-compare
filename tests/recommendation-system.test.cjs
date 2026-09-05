const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {sameProduct,groupProducts}=require('../electron/model.cjs');
const {pairKey,group,inferredSize,vector}=require('../electron/matching.cjs');
const {emptyProfile,record,affinity,rankRows,rankShelves,Preferences}=require('../electron/recommend.cjs');
const p=(retailer,name,extra={})=>({retailer,id:name,name,brand:'Example',size:'200g',unit:'each',cents:400,available:true,categories:['Sweets'],...extra});
const row=product=>({key:product.retailer+':'+product.id,product,offers:{[product.retailer]:product}});
test('general name vectors match unseen aliases, shortened descriptions and spelling',()=>{
 for(const [a,b]of [['Fruit Salad Lollies','Fruit Salad Sweets'],['Natural Party Mix Lollies','Party Mix Sweets'],['Chocolate Vanilla Cookies','Choc Vanilla Cookie'],['Strawbery Yoghurt','Strawberry Yogurt']])assert(sameProduct(p('newworld',a),p('woolworths',b)),a+' / '+b);
});
test('variant attributes and unknown conflicting descriptions cannot match',()=>{
 for(const [a,b]of [['Salted Butter','Semi Soft Salted Butter'],['Caramel Chocolate Cookies','Hazelnut Chocolate Cookies'],['Strawberry Yoghurt','Raspberry Yoghurt'],['Decaf Coffee Beans','Coffee Beans'],['Coffee 3 Refill','Coffee 4 Refill'],['Premium Forest Mix Sweets','Premium Tropical Mix Sweets'],['Wholemeal Bread','White Bread'],['Organic Rice','Rice']])assert.equal(sameProduct(p('newworld',a),p('woolworths',b)),false,a+' / '+b);
});
test('exact match outranks a broader shortened-title candidate, in either input order',()=>{
 const a=p('newworld','Example Fruit Salad Sweets'),b=p('woolworths','Example Fruit Salad Sweets'),c=p('woolworths','Example Fruit Salad');
 for(const input of [[a,c,b],[c,b,a]])assert.equal(groupProducts(input).find(r=>r.offers.newworld)?.offers.woolworths.id,b.id);
});
test('equally plausible fuzzy candidates stay separate',()=>{
 const a=p('newworld','Natural Fruit Salad Lollies'),b=p('woolworths','Fruit Salad Sweets',{id:'b'}),c={...b,id:'c'};
 assert.equal(groupProducts([a,b,c]).length,3);
});
test('unit-price inference is bounded, needs one explicit size, and invalidates with price changes',()=>{
 const a=p('newworld','Example Coffee Refill',{size:'90g'}),b=p('woolworths','Example Coffee Refill',{size:'',cents:900,unitPrice:'$10.00 / 100g'});
 assert.equal(inferredSize(b).size,'90g');assert(sameProduct(a,b));
 assert.equal(sameProduct({...a,size:'100g'},b),false);
 assert.equal(sameProduct({...a,size:'',unitPrice:b.unitPrice,cents:900},b),false);
 assert.equal(inferredSize({...b,unitPrice:'$0.01 / 100g'}),null);
 assert.equal(vector({...b,cents:1000}).size,'100g');assert.equal(vector({...b,unitPrice:'$20.00 / 100g'}).size,'45g');
 assert.equal(inferredSize({...b,size:'100g'}),null);
 assert.equal(inferredSize({...b,member:true}),null);
});
test('remembered rejection separates products and confirmation restores one pair',()=>{
 const a=p('newworld','Fruit Salad'),b=p('woolworths','Fruit Salad'),k=pairKey(a,b);
 assert.equal(groupProducts([a,b],{rejected:[k]}).length,2);
 assert.equal(groupProducts([a,b],{confirmed:[k]}).length,1);
 assert.equal(groupProducts([a,b],{confirmed:[k],rejected:[k]}).length,2);
});
test('blocking avoids a catalogue-wide all-pairs scan',()=>{
 const products=Array.from({length:600},(_,i)=>p('newworld','Product '+i,{id:String(i),brand:'Brand '+i,size:(100+i)+'g'}));
 const paired=products.map(x=>({...x,retailer:'woolworths'}));
 assert.equal(groupProducts([...products,...paired]).length,600);assert.equal(group.lastComparisons,600);
});
test('adds teach product preferences, views weigh less, and old preferences fade',()=>{
 const a=p('newworld','Fruit Salad'),b=p('newworld','Chocolate Cookies'),profile=emptyProfile(),now=10000000000;
 record(profile,{type:'view',product:b},now);record(profile,{type:'add',product:a},now);
 assert(affinity(a,profile,now)>affinity(b,profile,now));
 assert.equal(rankRows([row(b),row(a)],profile,{now})[0].product.id,a.id);
 assert(affinity(a,profile,now+30*86400000)<affinity(a,profile,now)*0.51);
});
test('browsing changes shelf order while retaining department variety',()=>{
 const departments=[{name:'Snacks',children:[{id:'sweets',name:'Sweets & lollies'},{id:'chips',name:'Chips'}]},{name:'Produce',children:[{id:'fruit',name:'Fruit'}]},{name:'Pantry',children:[{id:'coffee',name:'Coffee'},{id:'rice',name:'Rice'}]},{name:'Dairy',children:[{id:'milk',name:'Milk'}]}],profile=emptyProfile(),now=10000000000;
 assert.equal(rankShelves(departments,profile,now)[0].id,'sweets');
 record(profile,{type:'browse',aisle:'rice'},now);record(profile,{type:'add',aisle:'rice'},now);
 assert.equal(rankShelves(departments,profile,now)[0].id,'rice');
 record(profile,{type:'dismiss',aisle:'rice'},now);assert.notEqual(rankShelves(departments,profile,now)[0].id,'rice');
});
test('recommendations exclude unavailable, restricted, dismissed and basket items',()=>{
 const a=p('newworld','A'),b=p('newworld','B',{available:false}),c=p('newworld','C',{restricted:true}),d=p('newworld','D'),e=p('newworld','E'),profile=emptyProfile(),now=10000000000;
 record(profile,{type:'dismiss',product:d},now);
 assert.deepEqual(rankRows([a,b,c,d,e].map(row),profile,{now,basket:[row(a)]}).map(r=>r.product.id),['E']);
});
test('diversity limits repeated brands and impressions reduce repeated exposure',()=>{
 const a=p('newworld','Fruit Salad',{brand:'A'}),b=p('newworld','Fruit Salad Lollies',{brand:'A'}),c=p('newworld','Chocolate Buttons',{brand:'B'}),profile=emptyProfile(),now=10000000000;
 assert.equal(rankRows([a,b,c].map(row),profile,{now})[1].product.id,c.id);
 record(profile,{type:'impression',products:[a]},now);record(profile,{type:'impression',products:[a]},now+1000);
 assert.equal(profile.seen['newworld:'+a.id].count,1);
 assert.notEqual(rankRows([row(a),row(c)],profile,{now})[0].product.id,a.id);
});
test('history can be disabled and profile maps stay bounded',()=>{
 const profile=emptyProfile(),a=p('newworld','Fruit Salad');profile.enabled=false;record(profile,{type:'add',product:a});assert.deepEqual(profile.products,{});assert.equal(profile.revision,0);
 profile.enabled=true;for(let i=0;i<1510;i++)record(profile,{type:'view',product:{...a,id:String(i)}},10000000000+i);
 assert.equal(Object.keys(profile.products).length,1500);
});
test('persistent history survives reload; reset retains explicit match corrections',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'grocery-recommend-test-'));
 try{const file=path.join(dir,'recommendations.json'),prefs=new Preferences(file),a=p('newworld','Fruit Salad'),b=p('woolworths','Fruit Salad');await prefs.load();await prefs.track({type:'add',product:a});await prefs.track({type:'add',product:a});assert.equal(prefs.data.products['newworld:'+a.id].value,4);
 await prefs.feedback(a,b,false);const loaded=new Preferences(file);await loaded.load();assert.equal(loaded.data.rejected[0],pairKey(a,b));assert.equal(loaded.data.products['newworld:'+a.id].value,4);
 await loaded.reset();assert.deepEqual(loaded.data.products,{});assert.equal(loaded.data.rejected.length,1);const fresh=new Preferences(file);await fresh.load();assert.deepEqual(fresh.data.products,{});
 }finally{await fs.rm(dir,{recursive:true,force:true})}
});
