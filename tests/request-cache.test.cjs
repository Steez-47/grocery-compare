const test=require('node:test'),assert=require('node:assert/strict');
const {RequestCache}=require('../electron/request-cache.cjs');
const {Catalogue}=require('../electron/catalogue.cjs');
test('overlapping reads share work; failures can be retried',async()=>{
 const cache=new RequestCache();let count=0;
 const work=async()=>{count++;await new Promise(r=>setTimeout(r,10));return ['milk'];};
 const result=await Promise.all(Array.from({length:20},()=>cache.get('milk',work)));
 assert.equal(count,1);assert(result.every(r=>r===result[0]));
 await assert.rejects(cache.get('bad',()=>{throw Error('offline')}),/offline/);
 assert.equal(await cache.get('bad',()=>42),42);assert.equal(cache.pending.size,0);
});
test('expiry and least-recently-used eviction bound memory without extending freshness',async()=>{
 let now=0;const cache=new RequestCache({limit:2,ttl:100,now:()=>now});
 await cache.get('a',()=>1);await cache.get('b',()=>2);now=50;
 assert.equal(await cache.get('a',()=>99),1);await cache.get('c',()=>3);
 assert.deepEqual([...cache.entries.keys()],['a','c']);now=100;
 assert.equal(await cache.get('a',()=>4),4);assert.equal(cache.entries.size,2);
});
test('forced refresh does not reuse an older read or let it overwrite refreshed prices',async()=>{
 const cache=new RequestCache();let ordinary,refresh;
 const first=cache.get('price',()=>new Promise(r=>ordinary=r));
 const second=cache.get('price',()=>new Promise(r=>refresh=r),true);
 await Promise.resolve();refresh(200);assert.equal(await second,200);
 ordinary(100);assert.equal(await first,100);assert.equal(await cache.get('price',()=>0),200);
});
test('catalogue coalesces same-store requests but isolates stores, pages and forced reads',async()=>{
 const cat=new Catalogue({});let calls=0;
 cat.fetchSearch=async(r,s,q,p)=>{calls++;await new Promise(r=>setTimeout(r,5));return {products:[],store:s.id,page:p};};
 await Promise.all(Array.from({length:10},()=>cat.search('newworld',{id:'one'},'milk')));assert.equal(calls,1);
 await cat.search('newworld',{id:'two'},'milk');await cat.search('newworld',{id:'one'},'milk',1);await cat.search('newworld',{id:'one'},'milk',0,true);assert.equal(calls,4);
});
test('concurrent New World authentication shares a token request and renews expired tokens',async()=>{
 const cat=new Catalogue({});let calls=0;cat.json=async()=>{calls++;return {access_token:'token'+calls,expires_time:new Date(Date.now()+600000).toISOString()};};
 assert.deepEqual(await Promise.all([cat.token(),cat.token()]),['token1','token1']);assert.equal(calls,1);
 cat.nwAuth.expires=0;assert.equal(await cat.token(),'token2');
});
