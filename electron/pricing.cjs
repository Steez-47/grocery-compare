const cents=n=>Number.isFinite(n)&&n>=0?Math.round(n):null;
const dollars=n=>typeof n==='number'?cents(n*100):null;
const cup=(amount,unit)=>cents(amount)!==null&&unit?`$${(amount/100).toFixed(2)} / ${unit}`:'';
const nwCup=p=>p?cup(p.pricePerUnit,p.measureDescription||p.unitQuantityUom):'';
function nwPricing(p){
 const base=cents(p.singlePrice?.price??p.price);if(base===null)return null;
 // NEW_PRICE is a total at its threshold, not an amount to subtract.
 // Multi-buy and bonus rewards must not become a single-item price.
 const promotions=(p.promotions||[]).filter(x=>x.rewardType==='NEW_PRICE'&&x.threshold===1&&cents(x.rewardValue)!==null);
 const choose=(list,start)=>list.reduce((best,x)=>x.rewardValue<best.price?{price:Math.round(x.rewardValue),promo:x}:best,start);
 const ordinary=choose(promotions.filter(x=>!x.cardDependencyFlag),{price:base});
 const member=choose(promotions.filter(x=>x.cardDependencyFlag),ordinary),isMember=member.price<ordinary.price;
 const unitPrice=nwCup(member.promo?.comparativePrice||(!member.promo?p.singlePrice?.comparativePrice:null));
 const regularUnitPrice=nwCup(ordinary.promo?.comparativePrice||(!ordinary.promo?p.singlePrice?.comparativePrice:null));
 return {priceVersion:2,cents:member.price,regularCents:ordinary.price,wasCents:base>ordinary.price?base:null,member:isMember,
  unitPrice,regularUnitPrice,offer:member.promo?.description||'',memberLimit:isMember&&member.promo.limit>0?member.promo.limit:undefined};
}
function effectiveUnitPrice(p,member){return p.member&&!member?p.regularUnitPrice||'':p.unitPrice||'';}
function priceLabel(p,member){
 if(p.member)return member?(p.retailer==='woolworths'?'Member Price':'Club+ Deal'):'Non-member price';
 if(member&&p.memberPriceStatus==='unavailable')return 'Member Price unavailable';
 return effectiveUnitPrice(p,member)||'Each';
}
function repairPriceProduct(p){return p.priceVersion===2?p:{...p,checkedAt:'1970-01-01T00:00:00Z'};}
function wwMemberTag(p,weighted){
 // A product-level weight promotion must never be used as an each price.
 if(!weighted&&p.variants?.some(v=>v.unitOfMeasure==='KG'))return null;
 const tags=(p.tags||[]).filter(t=>t.type==='MemberPrice');
 for(const t of tags){const d=t.decisionInputs;if(!d||cents(d.promotionalPrice)===null)continue;
  return {cents:cents(d.promotionalPrice),unitPrice:cup(d.promotionalComparativePrice,`${d.promotionalComparativeSize||''}${d.promotionalComparativeUom||''}`)};
 }return null;
}
function applyWwMember(p,item){
 if(!item||String(item.sku)!==p.sku)return p;
 const price=item.price||{};
 if(!price.isClubPrice||price.isTargetedOffer||item.productTag?.multiBuy||(item.productTags||[]).some(t=>t.multiBuy))return {...p,memberPriceStatus:'checked'};
 const now=new Intl.DateTimeFormat('sv-SE',{timeZone:'Pacific/Auckland',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date()).replace(' ','T');
 if(price.promotionStartDate&&price.promotionStartDate>now||price.promotionEndDate&&price.promotionEndDate<now)return {...p,memberPriceStatus:'checked'};
 const unit=/^kg$/i.test(item.unit)?'kg':/^each$/i.test(item.unit)?'each':null;
 const each=p.unit==='each'&&unit==='kg'&&item.supportsBothEachAndKgPricing;
 if(p.unit!==unit&&!each)return {...p,memberPriceStatus:'unavailable'};
 const member=dollars(each?price.averagePricePerSingleUnit:price.salePrice);
 const ordinary=dollars(each?price.originalAveragePricePerSingleUnit:price.originalPrice);
 // Both feeds must agree about the unit and current non-member price.
 // A historical wasPrice or an estimated item weight cannot establish it.
 if(member===null||ordinary===null||ordinary!==p.regularCents)return {...p,memberPriceStatus:'unavailable'};
 if(member>=ordinary)return {...p,memberPriceStatus:'checked'};
 return {...p,cents:member,regularCents:ordinary,member:true,special:true,memberPriceStatus:'checked',priceSource:'woolworths-rest',
  regularUnitPrice:p.regularUnitPrice||p.unitPrice,unitPrice:cup(dollars(item.size?.cupPrice),item.size?.cupMeasure)};
}
module.exports={nwPricing,wwMemberTag,applyWwMember,effectiveUnitPrice,priceLabel,repairPriceProduct};
