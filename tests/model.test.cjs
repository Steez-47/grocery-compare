const test=require('node:test');const assert=require('node:assert/strict');
const {sameProduct,groupProducts,basketSummary,validateQuantity}=require('../electron/model.cjs');
const {nwProduct,wwProducts,Catalogue}=require('../electron/catalogue.cjs');
const p=(r,over={})=>({retailer:r,id:r,name:'Sample Standard Milk 2L',brand:'Sample',size:'2L',barcode:'',unit:'each',cents:500,regularCents:500,available:true,member:false,min:1,step:1,max:10,...over});
test('same brand, exact words and size can match, but variants and sizes cannot',()=>{
 assert.equal(sameProduct(p('newworld'),p('woolworths')),true);
 assert.equal(sameProduct(p('newworld'),p('woolworths',{name:'Sample Standard Milk 1L',size:'1L'})),false);
 assert.equal(sameProduct(p('newworld'),p('woolworths',{name:'Sample Trim Milk 2L'})),false);
 assert.equal(sameProduct(p('newworld'),p('woolworths',{brand:'Another'})),false);
 assert.equal(sameProduct(p('newworld'),p('woolworths',{size:''})),false);
});
test('ambiguous identical-name listings remain separate instead of choosing an arbitrary SKU',()=>{assert.equal(groupProducts([p('newworld'),p('newworld',{id:'b'}),p('woolworths')]).length,3)});
test('missing prices stay missing and member prices respect membership',()=>{
 const line={quantity:2,preferred:'cheapest',offers:{newworld:p('newworld'),woolworths:p('woolworths',{member:true,regularCents:null,cents:400})}};
 const loyalty={newworld:false,woolworths:false};
 assert.equal(basketSummary([line],'cheapest',loyalty).cents,1000);
 assert.equal(basketSummary([line],'woolworths',loyalty).missing,1);
 assert.equal(basketSummary([line],'cheapest',{...loyalty,woolworths:true}).cents,800);
});
test('split plan respects explicit store choices and unavailable items',()=>{
 const line={quantity:1,preferred:'newworld',offers:{newworld:p('newworld'),woolworths:p('woolworths',{cents:400})}};
 assert.equal(basketSummary([line],'cheapest',{newworld:true,woolworths:true}).cents,500);
 line.offers.newworld.available=false;
 assert.equal(basketSummary([line],'cheapest',{newworld:true,woolworths:true}).missing,1);
});
test('units reject fractional quantities; weights follow their step and maximum',()=>{
 assert.equal(validateQuantity(1.5,p('newworld')),false);
 assert.equal(validateQuantity(0.3,p('newworld',{unit:'kg',min:0.1,step:0.1})),true);
 assert.equal(validateQuantity(100,p('newworld')),false);
 assert.equal(validateQuantity(NaN,p('newworld')),false);
});
test('New World prices are cents, including zero; no-price records are excluded',()=>{
 const x={productId:'123-EA-000',name:'Sample',singlePrice:{price:482},displayName:'2L'};
 assert.equal(nwProduct(x,{id:'store'}).cents,482);
 assert.equal(nwProduct({...x,singlePrice:{price:0}},{id:'store'}).cents,0);
 assert.equal(nwProduct({...x,singlePrice:{}},{id:'store'}),null);
});
test('Woolworths price normalization deduplicates ads and preserves selected location',()=>{
 const x={sku:'1',productName:'Sample 2L',storeKey:'fulfilment',variants:[{variantKey:'1-EA',name:'Sample 2L',variantPrice:{sellingPrice:4.82,isClubPrice:false}}]};
 const data=wwProducts({My:{products:{results:[x,x,{}]}}},{id:'pickup'});
 assert.equal(data.length,1);assert.equal(data[0].cents,482);assert.equal(data[0].storeId,'pickup');assert.equal(data[0].fulfilmentStoreId,'fulfilment');
});
test('transfer uses target quantities, preserves unrelated items, and verifies results',async()=>{
 const cat=new Catalogue({});let cart={shoppingMode:{pickupLocationId:'s'},lineItems:[{productVariantSku:'unrelated',quantity:5},{productVariantSku:'milk',quantity:1}]};let writes=0;
 cat.gql=async(q,v)=>{if(q.startsWith('query'))return{customerCart:structuredClone(cart)};writes++;for(const t of v.input.cartLineItemQuantityUpdates){const old=cart.lineItems.find(l=>l.productVariantSku===t.variantKey);if(old)old.quantity=t.quantity;else cart.lineItems.push({productVariantSku:t.variantKey,quantity:t.quantity});}return {setCartLineItemQuantity:{}}};
 const lines=[{product:{id:'milk'},quantity:2}];await cat.transfer('woolworths',{id:'s'},lines);await cat.transfer('woolworths',{id:'s'},lines);
 assert.equal(cart.lineItems.find(l=>l.productVariantSku==='milk').quantity,2);assert.equal(cart.lineItems[0].quantity,5);assert.equal(writes,2);
});
test('transfer never changes the location of an occupied Woolworths cart',async()=>{
 const cat=new Catalogue({});cat.gql=async()=>({customerCart:{shoppingMode:{pickupLocationId:'other'},lineItems:[{quantity:1}]}});
 await assert.rejects(()=>cat.transfer('woolworths',{id:'desired'},[{product:{id:'x'},quantity:1}]),/another location/);
});
test('a successful write without verified cart quantities is reported as failure',async()=>{
 const cat=new Catalogue({});cat.gql=async(q)=>q.startsWith('query')?{customerCart:{shoppingMode:{pickupLocationId:'s'},lineItems:[]}}:{setCartLineItemQuantity:{}};
 await assert.rejects(()=>cat.transfer('woolworths',{id:'s'},[{product:{id:'x'},quantity:2}]),/could not be verified/);
});
test('New World never switches an occupied cart with an unknown location',async()=>{
 const cat=new Catalogue({});let writes=0;cat.cart=async()=>({products:[{productId:'existing',quantity:1}]});cat.nw=async()=>{writes++};
 await assert.rejects(()=>cat.transfer('newworld',{id:'desired'},[{product:{id:'x',unit:'each'},quantity:1}],'guest'),/location could not be safely confirmed/);assert.equal(writes,0);
});
test('empty Woolworths location searches do not call the failing all-stores endpoint',async()=>{
 const cat=new Catalogue({});cat.gql=async()=>{throw new Error('Unexpected request')};assert.deepEqual(await cat.stores('woolworths',''),[]);
});
