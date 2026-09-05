const {clean,sizeKey,houseBrand,houseTier,productWords}=require('./products.cjs');
function legacyScore(a,b){
 if(a.retailer===b.retailer||a.unit!==b.unit)return 0;
 const equivalent=clean(a.brand)!==clean(b.brand)&&houseBrand(a)&&houseBrand(b);
 if(a.barcode&&b.barcode&&!equivalent)return a.barcode===b.barcode?100:0;
 if(!a.brand||!b.brand||(!equivalent&&clean(a.brand)!==clean(b.brand))||!a.size||sizeKey(a.size)!==sizeKey(b.size))return 0;
 const x=productWords(a),y=productWords(b);
 if(x.join('|')===y.join('|'))return equivalent?(houseTier(a)===houseTier(b)?75:70):90;
 // Allow only named omissions, while retaining every flavour, dietary claim,
 // strength, cut and pack-size distinction. Ambiguous candidates stay separate.
 const optional=new Set();const both=w=>x.includes(w)&&y.includes(w);const brand=clean(a.brand);
 if(both('bread')){
  if(!x.includes('sandwich')&&!y.includes('sandwich'))optional.add('toast');
  if(brand==='freyas')optional.add('swiss');
  if(brand==='ploughmans bakery')optional.add('canterbury');
  if(brand==='vogels'&&both('mixed')&&both('grain'))optional.add('original');
 }
 if(both('butter')){
  optional.add('flavoured');
  if(both('semi')&&both('soft')&&!x.includes('unsalted')&&!y.includes('unsalted'))optional.add('salt');
  if(brand==='constantia'&&both('garlic'))optional.add('spread');
 }
 if(both('coffee')&&brand==='nescafe'&&both('classic'))optional.add('instant');
 const xx=x.filter(w=>!optional.has(w)),yy=y.filter(w=>!optional.has(w));
 return xx.length>=2&&xx.join('|')===yy.join('|')?(equivalent?65:80):0;
}
const matching=require('./matching.cjs');
function sameProduct(a,b){return matching.pairScore(a,b,legacyScore).accepted;}
function groupProducts(products,feedback={}){return matching.group(products,legacyScore,feedback);}
function effectivePrice(p,member){return p.member&&!member?p.regularCents:p.cents;}
function selectOffer(line,policy,loyalty){
 const offers=Object.values(line.offers).filter(p=>p.available&&effectivePrice(p,loyalty[p.retailer])!==null);
 if(policy!=='cheapest')return offers.find(p=>p.retailer===policy)||null;
 if(line.preferred&&line.preferred!=='cheapest')return offers.find(p=>p.retailer===line.preferred)||null;
 return offers.sort((a,b)=>effectivePrice(a,loyalty[a.retailer])-effectivePrice(b,loyalty[b.retailer]))[0]||null;
}
function basketSummary(lines,policy,loyalty){let cents=0,missing=0;const shops={newworld:[],woolworths:[]};for(const line of lines){const p=selectOffer(line,policy,loyalty);if(!p){missing++;continue;}cents+=Math.round(effectivePrice(p,loyalty[p.retailer])*line.quantity);shops[p.retailer].push({product:p,quantity:line.quantity});}return {cents,missing,shops};}
function validateQuantity(q,p){return Number.isFinite(q)&&q>=p.min&&q<=p.max&&Math.abs(q/p.step-Math.round(q/p.step))<0.00001;}
module.exports={sameProduct,groupProducts,effectivePrice,selectOffer,basketSummary,validateQuantity,sizeKey,houseBrand,productWords};
