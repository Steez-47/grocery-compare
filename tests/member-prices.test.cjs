const test=require('node:test'),assert=require('node:assert/strict');
const {nwProduct,wwProducts}=require('../electron/catalogue.cjs');
const {applyWwMember,priceLabel,effectiveUnitPrice,repairPriceProduct}=require('../electron/pricing.cjs');
const {basketSummary}=require('../electron/model.cjs');
const {WoolworthsMembers}=require('../electron/woolworths-members.cjs');
const store={id:'9424',name:'Kelvin Grove'};
const raw={sku:'6001481',productName:'Woolworths Haloumi Cheese 200g',storeKey:'9470',variants:[{variantKey:'6001481-EA',unitOfMeasure:'EACH',availabilityStatus:'IN_STOCK',variantPrice:{sellingPrice:6.89,wasPrice:8,isClubPrice:false,cupPrice:3.45,cupUnit:'100G'}}]};
const product=()=>wwProducts({My:{products:{results:[raw]}}},store)[0];
const item=()=>({sku:'6001481',unit:'Each',price:{originalPrice:6.89,salePrice:6.50,isClubPrice:true},size:{cupPrice:3.25,cupMeasure:'100g'},context:{fulfilment:{method:'Pickup',pickupAddressId:1093410,fulfilmentStoreId:9470}}});
const nw={productId:'5013505-EA-000',brand:'Mainland',name:'Salted Buttersoft Spreadable Butter',displayName:'375g',singlePrice:{price:1299,comparativePrice:{pricePerUnit:346,measureDescription:'100g'}},promotions:[{rewardValue:1139,rewardType:'NEW_PRICE',threshold:1,cardDependencyFlag:true,comparativePrice:{pricePerUnit:304,measureDescription:'100g'}}]};
test('New World uses the actual Club+ reward price and both comparison-unit prices',()=>{
 const p=nwProduct(nw,{id:'broadway'});assert.equal(p.cents,1139);assert.equal(p.regularCents,1299);assert.equal(p.member,true);
 assert.equal(effectiveUnitPrice(p,true),'$3.04 / 100g');assert.equal(effectiveUnitPrice(p,false),'$3.46 / 100g');
 assert.equal(priceLabel(p,true),'Club+ Deal');assert.equal(priceLabel(p,false),'Non-member price');
});
test('New World ignores multibuy totals and bonus points, and retains an ordinary special',()=>{
 const promotions=[{rewardValue:700,rewardType:'NEW_PRICE',threshold:2,cardDependencyFlag:true},{rewardValue:1,rewardType:'BONUS_POINTS',threshold:1,cardDependencyFlag:true},{rewardValue:1199,rewardType:'NEW_PRICE',threshold:1,cardDependencyFlag:false}];
 const p=nwProduct({...nw,promotions},{id:'nw'});assert.equal(p.cents,1199);assert.equal(p.regularCents,1199);assert.equal(p.wasCents,1299);assert.equal(p.member,false);
});
test('New World picks the cheapest eligible single-item promotion regardless of order',()=>{
 const p=nwProduct({...nw,promotions:[...nw.promotions,{rewardValue:1200,rewardType:'NEW_PRICE',threshold:1,cardDependencyFlag:false,bestPromotion:true}]},{id:'nw'});
 assert.equal(p.regularCents,1200);assert.equal(p.cents,1139);
});
test('Woolworths reads Member Price from its alternate feed without using a historical was price',()=>{
 const p=applyWwMember(product(),item());assert.equal(p.cents,650);assert.equal(p.regularCents,689);assert.equal(p.wasCents,800);assert.equal(p.member,true);
 assert.equal(priceLabel(p,true),'Member Price');assert.equal(effectiveUnitPrice(p,true),'$3.25 / 100g');assert.equal(effectiveUnitPrice(p,false),'$3.45 / 100G');
});
test('Woolworths native MemberPrice tags are handled even when isClubPrice is false',()=>{
 const data={...raw,tags:[{type:'MemberPrice',decisionInputs:{promotionalPrice:650,promotionalComparativePrice:325,promotionalComparativeSize:100,promotionalComparativeUom:'g'}}]};
 const p=wwProducts({My:{products:{results:[data]}}},store)[0];assert.equal(p.cents,650);assert.equal(p.regularCents,689);assert.equal(p.member,true);
});
test('Woolworths historical wasPrice never fills an unknown current non-member price',()=>{
 const data=structuredClone(raw);data.variants[0].variantPrice.isClubPrice=true;
 const p=wwProducts({My:{products:{results:[data]}}},store)[0];assert.equal(p.regularCents,null);
});
test('unrelated SKUs, wrong units, conflicting prices and malformed amounts do not become member prices',()=>{
 for(const patch of [{sku:'1'},{unit:'Kg'},{price:{originalPrice:7,salePrice:6,isClubPrice:true}},{price:{originalPrice:6.89,salePrice:-1,isClubPrice:true}},{price:{originalPrice:6.89,salePrice:null,isClubPrice:true}}])assert.equal(applyWwMember(product(),{...item(),...patch}).member,false);
});
test('expired, future, targeted and multibuy offers never masquerade as current single-item prices',()=>{
 for(const patch of [{promotionEndDate:'2000-01-01T23:59:59'},{promotionStartDate:'2100-01-01T00:00:00'},{isTargetedOffer:true}]){const d=item();Object.assign(d.price,patch);assert.equal(applyWwMember(product(),d).member,false);}
 const d=item();d.productTags=[{multiBuy:{quantity:2}}];assert.equal(applyWwMember(product(),d).member,false);
});
test('weighted member prices stay per kg and are never reused for the each variant',()=>{
 const d={...item(),unit:'Kg',price:{originalPrice:6.89,salePrice:6.50,isClubPrice:true},supportsBothEachAndKgPricing:true};
 assert.equal(applyWwMember({...product(),unit:'kg'},d).cents,650);
 assert.equal(applyWwMember(product(),d).member,false);
});
test('membership switches change the cheapest store and the complete basket total',()=>{
 const ww=applyWwMember(product(),item()),nw={...product(),retailer:'newworld',id:'nw',cents:675,regularCents:675};
 const basket=[{quantity:2,preferred:'cheapest',offers:{newworld:nw,woolworths:ww}}];
 assert.equal(basketSummary(basket,'cheapest',{newworld:false,woolworths:true}).cents,1300);
 assert.equal(basketSummary(basket,'cheapest',{newworld:false,woolworths:false}).cents,1350);
 assert.equal(basketSummary(basket,'woolworths',{newworld:false,woolworths:false}).cents,1378);
});
test('legacy saved baskets are marked stale without losing quantities or product identity',()=>{
 const p=product();delete p.priceVersion;const fixed=repairPriceProduct(p);assert.equal(Date.parse(fixed.checkedAt),0);assert.equal(fixed.id,p.id);assert.equal(repairPriceProduct(product()).checkedAt,product().checkedAt);
});
function fakeApi({wrongStore=false,fail=false}={}){let calls=[];return {calls,request:async(path,init)=>{calls.push({path,init});if(path.includes('addresses/pickup-addresses'))return {storeAreas:[{storeAddresses:[{id:1093410,name:'Woolworths Kelvin Grove'},{id:1093410,name:'Woolworths Kelvin Grove'}]}]};if(path.includes('fulfilment/my'))return {context:{fulfilment:{...item().context.fulfilment,fulfilmentStoreId:wrongStore?9171:9470}}};if(fail)throw new Error('offline');return item();}};}
test('member-price enrichment verifies both store identifiers and caches exact SKU lookups',async()=>{
 const api=fakeApi(),m=new WoolworthsMembers(api.request);assert.equal((await m.enrich([product()],store))[0].cents,650);
 assert.equal(api.calls[1].init.method,'PUT');assert.equal(api.calls[2].path,'/products/6001481');await m.enrich([product()],store);assert.equal(api.calls.length,3);
 await m.enrich([product()],store,true);assert.equal(api.calls.length,4);
});
test('wrong-store and failed member-price feeds retain ordinary prices with an unavailable status',async()=>{
 for(const options of [{wrongStore:true},{fail:true}]){const api=fakeApi(options),m=new WoolworthsMembers(api.request),[p]=await m.enrich([product()],store);assert.equal(p.cents,689);assert.equal(p.member,false);assert.equal(p.memberPriceStatus,'unavailable');}
});
test('every product response must still confirm the selected fulfilment store',async()=>{
 const api=fakeApi(),request=async(...args)=>{const d=await api.request(...args);if(args[0].startsWith('/products/'))d.context.fulfilment.fulfilmentStoreId=9171;return d;};
 assert.equal((await new WoolworthsMembers(request).enrich([product()],store))[0].member,false);
});
