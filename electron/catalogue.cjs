const crypto = require('node:crypto');
const {RequestCache}=require('./request-cache.cjs');
const {nwPricing,wwMemberTag}=require('./pricing.cjs');
const {WoolworthsMembers}=require('./woolworths-members.cjs');
const WW = 'https://www.woolworths.co.nz';
const NW = 'https://www.newworld.co.nz';
const NWAPI = 'https://api-prod.newworld.co.nz/v1/edge';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';
const money = x => typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.round(x*100) : null;
const title = s => String(s||'').replace(/\b\w/g,c=>c.toUpperCase());
const sizeOf = s => String(s||'').match(/(?:\d+\s*[x×]\s*)?\d+(?:\.\d+)?\s*(?:kg|g|ml|l|pk|pack|ea)\b/i)?.[0] || '';
function nwProduct(p,store){
 const pricing=nwPricing(p);
 if(!p.productId || !pricing) return null;
 const promo=p.promotions?.find(x=>x.bestPromotion)||p.promotions?.[0];
 const name=[p.brand,p.name,p.displayName].filter(Boolean).join(' ').trim();
 const weighted=p.saleType==='WEIGHT'||p.saleType==='BOTH'&&/-KGM-/.test(p.productId);
 const weight=p.variableWeight||{},scale=/^kg$/i.test(weight.stepUnitOfMeasure||weight.unitOfMeasure||'g')?1:1000;
 const minimum=Number(weight.minOrderQuantity)/scale,increment=Number(weight.stepSize)/scale;
 return {retailer:'newworld',id:p.productId,name,brand:p.brand||'',size:p.displayName||'',barcode:p.barcode||p.gtin||'',
  image:p.productImageUrls?.[0]||p.productImageUrl||`https://a.fsimg.co.nz/product/retail/fan/image/400x400/${p.productId.split('-')[0]}.png`,
  categories:Object.values(p.categoryTrees?.[0]||{}).filter(Boolean),tags:(p.facets||[]).map(f=>f.itemDescription).filter(Boolean),special:Boolean(promo||p.decalCode),saleEligible:Boolean(pricing.wasCents||pricing.member),healthStar:null,
  ...pricing,
  unit:weighted?'kg':'each',min:weighted&&minimum>0?minimum:weighted?0.1:1,step:weighted&&increment>0?increment:weighted?0.1:1,max:Math.min(99,pricing.memberLimit||99),
  available:p.availability?.includes('ONLINE')??true,restricted:Boolean(p.tobaccoFlag||p.liquorFlag),
  storeId:store.id,checkedAt:new Date().toISOString(),url:`${NW}/shop/product/${p.productId.toLowerCase().replaceAll('-','_')}`};
}
function wwProducts(data,store){
 const seen=new Set();
 return (data?.My?.products?.results||[]).flatMap(p=>(p.variants||[]).map(v=>{
  if(!p.sku||seen.has(v.variantKey))return null;seen.add(v.variantKey);
  const price=v.variantPrice,unit=v.purchaseUnit;
  if(money(price?.sellingPrice)===null)return null;
  const weighted=unit?.unit==='KILOGRAM'||v.unitOfMeasure==='KG'||/-KG$/.test(v.variantKey);
  const tag=wwMemberTag(p,weighted),base=money(price.sellingPrice),discount=tag&&tag.cents<base?tag:null;
  const unitPrice=price.cupPrice!=null?`$${Number(price.cupPrice).toFixed(2)} / ${price.cupUnit||''}`:'';
  const quantity=(value,fallback)=>Number.isFinite(value)&&value>0?Number(value.toFixed(3)):fallback;
  return {retailer:'woolworths',id:v.variantKey,sku:p.sku,name:v.name||p.productName,brand:p.brand||'',size:weighted?'kg':sizeOf(v.name||p.productName),barcode:'',
   image:p.imageUrl||'',priceVersion:2,cents:discount?.cents??base,regularCents:discount?base:price.isClubPrice?null:base,wasCents:money(price.wasPrice),member:!!(discount||price.isClubPrice),regularUnitPrice:price.isClubPrice?'':unitPrice,
   categories:Object.values(p.categoryHierarchyNames||{}).flat().filter(x=>x&&x!=='All Departments'),tags:[],special:!!price.isSpecial,healthStar:p.healthStarRating??null,
   offer:'',unit:weighted?'kg':'each',
   min:quantity(unit?.minimumQty,1),step:quantity(unit?.incrementQty,1),max:quantity(unit?.maximumQty,99),
   unitPrice:discount?discount.unitPrice:unitPrice,
   available:!['OutOfStock','OUT_OF_STOCK','Unavailable'].includes(v.availabilityStatus),restricted:!!(p.isTobacco||p.isAlcohol),
   storeId:store.id,fulfilmentStoreId:p.storeKey,checkedAt:new Date().toISOString(),url:`${WW}/shop/productdetails?stockcode=${p.sku}`};
 })).filter(Boolean);
}
const productFields = `sku productName brand imageUrl storeKey isAlcohol isTobacco tags { type decisionInputs } categoryHierarchyNames { lvl0 lvl1 lvl2 lvl3 } healthStarRating variants { variantKey name unitOfMeasure availabilityStatus purchaseUnit { unit minimumQty maximumQty incrementQty defaultQty } variantPrice { sellingPrice wasPrice isClubPrice isSpecial cupPrice cupUnit } }`;
const WSEARCH=`query ProductSearch($input:CompositeSearchInput!){My{myKey products(searchInput:$input){totalCount totalPages results{...on ProductSummary{${productFields}} ...on SponsoredProduct{${productFields}}}}}}`;
const WCART=`query CustomerCart{customerCart{key shoppingMode{mode pickupLocationId pickupLocation{id name}} lineItems{sku productVariantSku quantity} validationResult{failedValidations{message}}}}`;
const WSTORE=`mutation SetCartShoppingMode($input:SetCartShoppingModeInput!){setCartShoppingMode(input:$input){shoppingMode{mode pickupLocationId pickupLocation{id name}} validationResult{failedValidations{message}}}}`;
const WSET=`mutation SetCartLineItemQuantity($input:SetCartLineItemQuantitiesInput!){setCartLineItemQuantity(input:$input){key lineItems{sku productVariantSku quantity} validationResult{failedValidations{message}}}}`;

class Catalogue {
 constructor(transports){this.transports=transports;this.nwAuth=null;this.storesCache=null;this.wwStore=null;this.wwQueue=Promise.resolve();this.requests=new RequestCache();this.metadata=new RequestCache({limit:8,ttl:600000});this.wwMembers=new WoolworthsMembers((path,init={})=>this.json('woolworths',WW+'/api/v1'+path,{...init,headers:{'X-Requested-With':'OnlineShopping.WebApp','X-UI-Ver':'7.76.44'}}));}
 async json(retailer,url,init={},checkout=false){
  const r=await this.transports[retailer](url,{...init,headers:{'user-agent':UA,accept:'application/json','content-type':'application/json',...init.headers},signal:AbortSignal.timeout(30000)},checkout);
  if(!r.ok)throw new Error(r.status===401?'Sign in to the store to continue.':r.status===403?'Open the store and complete its verification check.':`The store returned an error (${r.status}). Try again.`);
  const raw=await r.text();let d;try{d=JSON.parse(raw)}catch{throw new Error('Open the store and complete its verification check.')}
  return d;
 }
 async gql(query,variables={},checkout=false){
  const operationName=query.match(/(?:query|mutation)\s+(\w+)/)[1];
  const result=await this.json('woolworths',WW+'/api/graphql?op-name='+operationName,{method:'POST',headers:{'wnzx-operation-name':operationName,origin:WW,referer:WW+'/'},body:JSON.stringify({query,variables,operationName})},checkout);
  if(result.errors?.length){const message=result.errors[0].message||'Woolworths could not complete the request.';throw new Error(message.includes('GuestCart')?'Open Woolworths and sign in, then return here to send your items.':message);}
  if(!result.data)throw new Error('Woolworths returned no data.');return result.data;
 }
 async token(){
  if(this.nwAuth && this.nwAuth.expires>Date.now()+60000)return this.nwAuth.token;
  return this.metadata.get('nw-token',async()=>{const d=await this.json('newworld',NW+'/api/user/get-current-user',{method:'POST',body:JSON.stringify({fingerprintUser:crypto.randomUUID().replaceAll('-',''),fingerprintGuest:UA})});
  if(!d.access_token)throw new Error('New World could not start a session.');
  this.nwAuth={token:d.access_token,expires:Date.parse(d.expires_time)||Date.now()+600000};return d.access_token;},true);
 }
 async nw(path,init={},token=null,checkout=false){
  return this.json('newworld',NWAPI+path,{...init,headers:{authorization:`Bearer ${token||await this.token()}`,origin:NW,referer:NW+'/',...init.headers}},checkout);
 }
 async stores(retailer,query=''){
  if(retailer==='newworld'){
   if(!this.storesCache){const d=await this.nw('/store');this.storesCache=(d.stores||[]).filter(s=>s.banner==='MNW'&&s.onlineActive).map(s=>({id:s.id,name:s.name.replace(/^New World /,''),address:s.address,region:s.region}));}
   return this.storesCache.filter(s=>(s.name+' '+s.address).toLowerCase().includes(query.toLowerCase()));
  }
  if(query.trim().length<2)return [];
  const d=await this.gql('query SearchLocations($input:LocationsInput!){locations(input:$input){locations{id name storeId address{locality{suburb city}}}}}',{input:{search:query.trim(),allStores:false,filter:{max:250}}});
  return (d.locations?.locations||[]).map(s=>({id:s.id,name:s.name.replace(/ Woolworths$/,''),address:[s.address?.locality?.suburb,s.address?.locality?.city].filter(Boolean).join(', ')}));
 }
 async departments(stores){
  const {departments}=require('./browse.cjs');
  return this.metadata.get('departments|'+stores.newworld.id+'|'+stores.woolworths.id,async()=>{
  const [nw,ww]=await Promise.all([this.nw('/store/'+stores.newworld.id+'/categories'),this.gql('query GetAllCategories{My{categories{key name children{key name children{key name children{key name}}}}}}')]);
  return departments(nw,ww);});
 }
 async search(retailer,store,query,page=0,force=false,options={}){
  if(!store?.id)throw new Error('Choose a store first.');
  const key=JSON.stringify([retailer,store.id,store.region,query,page,options]);
  return this.requests.get(key,()=>this.fetchSearch(retailer,store,query,page,force,options),force);
 }
 async fetchSearch(retailer,store,query,page,force,options){
  let result;
  if(retailer==='newworld'){
   const region=store.region||'NI';
   const category=options.category?.path;
   const filters=`stores:${store.id}`+(category?.length?` AND category${category.length-1}${region}:${JSON.stringify(category.at(-1))}`:'');
   const d=await this.nw('/search/paginated/products',{method:'POST',body:JSON.stringify({algoliaQuery:{attributesToHighlight:[],attributesToRetrieve:['productID','Type'],facets:[],filters,hitsPerPage:36,page,query},algoliaFacetQueries:[],storeId:store.id,hitsPerPage:36,page,sortOrder:`${region}_POPULARITY_ASC`,tobaccoQuery:false,precisionMedia:{adDomain:'SEARCH_PAGE',adPositions:[],publishImpressionEvent:false,disableAds:true}})});
   if(!Array.isArray(d.products))throw new Error('New World returned an unexpected product response.');
   result={products:d.products.map(p=>nwProduct(p,store)).filter(Boolean),total:d.totalProducts||d.totalHits||d.products.length,pages:d.totalPages||d.numberOfPages||1};
  }else{
   const work=async()=>{
    if(this.wwStore!==store.id){
     const d=await this.gql(WSTORE,{input:{pickupLocationId:store.id,shoppingMode:'Pickup'}});
     if(d.setCartShoppingMode?.shoppingMode?.pickupLocationId!==store.id)throw new Error('Woolworths could not select that store.');
     this.wwStore=store.id;
    }
    const d=await this.gql(WSEARCH,{input:{[options.category?.key?'byCategoryKey':'byKeyword']:{value:options.category?.key||query,sortBy:'RELEVANCE',pageSize:36,pageIndex:page}}});
    return {products:await this.wwMembers.enrich(wwProducts(d,store),store,force),total:d.My.products.totalCount,pages:d.My.products.totalPages};
   };
   const job=this.wwQueue.then(work,work);this.wwQueue=job.catch(()=>{});result=await job;
  }
  return result;
 }
 async cart(retailer,token){
  if(retailer==='woolworths')return (await this.gql(WCART,{},true)).customerCart;
  if(!token)throw new Error('Open New World, sign in, then return here.');
  return this.nw('/cart',{},token,true);
 }
 async transfer(retailer,store,lines,token){
  const before=await this.cart(retailer,token);
  if(retailer==='woolworths'){
   if(before.shoppingMode?.pickupLocationId!==store.id){
    if(before.lineItems?.length)throw new Error('Your Woolworths cart uses another location. Change its location in the store first.');
    const d=await this.gql(WSTORE,{input:{pickupLocationId:store.id,shoppingMode:'Pickup'}},true);
    if(d.setCartShoppingMode?.shoppingMode?.pickupLocationId!==store.id)throw new Error('Check the Woolworths store location.');
   }
   // Target quantities make repeated transfers idempotent; unrelated cart items are preserved.
   const targets=lines.map(l=>({variantKey:l.product.id,quantity:l.quantity}));
   const result=await this.gql(WSET,{input:{cartLineItemQuantityUpdates:targets}},true);
   const after=await this.cart(retailer,token);
   const failed=targets.filter(t=>!after.lineItems?.some(x=>x.productVariantSku===t.variantKey&&Math.abs(x.quantity-t.quantity)<0.0001));
   if(failed.length)throw new Error(`${failed.length} item(s) could not be verified in Woolworths. Review the store cart before trying again.`);
   return {count:targets.length,messages:result.setCartLineItemQuantity?.validationResult?.failedValidations?.map(x=>x.message)||[]};
  }
  // Do not switch an occupied basket whose store cannot be established.
  const currentStore=before.storeId||before.store?.id;
  if(before.products?.length&&currentStore!==store.id)throw new Error('New World already has items in its cart. Review that cart first; its location could not be safely confirmed.');
  await this.nw('/cart/store/'+encodeURIComponent(store.id),{method:'POST'},token,true);
  const products=lines.map(l=>({productId:l.product.id,sale_type:l.product.unit==='kg'?'WEIGHT':'UNITS',quantity:l.product.unit==='kg'?Math.round(l.quantity*1000):l.quantity}));
  await this.nw('/cart',{method:'POST',body:JSON.stringify({products})},token,true);
  const after=await this.cart(retailer,token);
  const failed=products.filter(p=>!after.products?.some(x=>x.productId===p.productId&&Math.abs(Number(x.quantity)-p.quantity)<0.001));
  if(failed.length)throw new Error(`${failed.length} item(s) could not be verified in New World. Review the store cart before trying again.`);
  return {count:products.length,messages:[]};
 }
}
module.exports={Catalogue,nwProduct,wwProducts,money,sizeOf,WW,NW,UA,WCART,WSET,WSTORE};
