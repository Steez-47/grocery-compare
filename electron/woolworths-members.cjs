const {applyWwMember}=require('./pricing.cjs');
const normal=s=>String(s||'').toLowerCase().replace(/woolworths|countdown|click and collect/g,'').replace(/[^a-z0-9]/g,'');
class WoolworthsMembers{
 constructor(request){this.request=request;this.locations=null;this.location=null;this.cache=new Map();}
 async select(store,fulfilment){
  if(this.location?.id===store.id&&this.location.fulfilment===fulfilment)return this.location;
  this.location=null;
  if(!this.locations){const d=await this.request('/addresses/pickup-addresses');this.locations=[...new Map((d.storeAreas||[]).flatMap(a=>a.storeAddresses||[]).map(s=>[s.id,s])).values()];}
  const matches=this.locations.filter(s=>normal(s.name)===normal(store.name));
  if(matches.length!==1)throw new Error('Member Price store could not be verified.');
  const address=matches[0],d=await this.request('/fulfilment/my/pickup-addresses',{method:'PUT',body:JSON.stringify({addressId:address.id})});
  const context=d.context?.fulfilment;
  if(context?.method!=='Pickup'||String(context.pickupAddressId)!==String(address.id)||String(context.fulfilmentStoreId)!==fulfilment)throw new Error('Member Price store did not match.');
  return this.location={id:store.id,addressId:address.id,fulfilment};
 }
 async enrich(products,store,force=false){
  if(!products.length)return products;
  const pending=new Map(),result=new Map(),now=Date.now();
  for(const p of products){if(p.member)continue;const key=store.id+'|'+p.sku,old=this.cache.get(key);if(!force&&old&&now-old.time<180000)result.set(p.sku,old.item);else pending.set(p.sku,p);}
  if(pending.size){try{
   const stores=new Set(products.map(p=>String(p.fulfilmentStoreId)));if(stores.size!==1||stores.has('undefined'))throw new Error('Unknown fulfilment store.');
   const location=await this.select(store,[...stores][0]),skus=[...pending.keys()];let index=0;
   // Exact SKU details include promotion dates. Keyword OR searches silently
   // widen in this API, so they cannot be used as a reliable batch lookup.
   await Promise.all(Array.from({length:Math.min(4,skus.length)},async()=>{
    while(index<skus.length){const sku=skus[index++];try{
     if(!/^\d+$/.test(sku))continue;
     const item=await this.request('/products/'+sku),context=item.context?.fulfilment;
     if(String(item.sku)!==sku||String(context?.fulfilmentStoreId)!==location.fulfilment||String(context?.pickupAddressId)!==String(location.addressId))continue;
     result.set(sku,item);this.cache.set(store.id+'|'+sku,{time:Date.now(),item});
    }catch{/* Keep the normal catalogue usable if one member lookup fails. */}}
   }));
   while(this.cache.size>1500)this.cache.delete(this.cache.keys().next().value);
  }catch{this.location=null;}}
  return products.map(p=>p.member?p:result.has(p.sku)?applyWwMember(p,result.get(p.sku)):{...p,memberPriceStatus:'unavailable'});
 }
}
module.exports={WoolworthsMembers};
