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
function effectivePrice(p,member){
 const cents=p.member&&!member?p.regularCents:p.cents;
 return Number.isSafeInteger(cents)&&cents>=0?cents:null;
}
function linePrice(p,quantity,member){
 const cents=effectivePrice(p,member);
 if(cents===null||!validateQuantity(quantity,p))return null;
 // Catalogue weights have gram precision. Multiply integers before rounding
 // each line to cents so binary decimals cannot round half a cent down.
 const scale=p.unit==='kg'?1000:1,amount=cents*Math.round(quantity*scale);
 if(!Number.isSafeInteger(amount))return null;
 return Math.floor(amount/scale)+(amount%scale>=scale/2?1:0);
}
function selectOffer(line,policy,loyalty){
 const offers=Object.values(line.offers).filter(p=>p&&p.available&&!p.restricted&&['newworld','woolworths'].includes(p.retailer)&&linePrice(p,line.quantity,loyalty[p.retailer])!==null);
 if(policy!=='cheapest')return offers.find(p=>p.retailer===policy)||null;
 if(line.preferred&&line.preferred!=='cheapest')return offers.find(p=>p.retailer===line.preferred)||null;
 return offers.sort((a,b)=>effectivePrice(a,loyalty[a.retailer])-effectivePrice(b,loyalty[b.retailer]))[0]||null;
}
function basketSummary(lines,policy,loyalty){
 let cents=0,missing=0;const shops={newworld:[],woolworths:[]};
 for(const line of lines){
  const p=selectOffer(line,policy,loyalty);
  if(!p){missing++;continue;}
  const total=linePrice(p,line.quantity,loyalty[p.retailer]);
  if(!Number.isSafeInteger(cents+total)){missing++;continue;}
  cents+=total;shops[p.retailer].push({product:p,quantity:line.quantity});
 }
 return {cents,missing,shops};
}
function validateQuantity(q,p){
 if(!Number.isFinite(q)||q<=0||![p.min,p.step,p.max].every(Number.isFinite)||p.min<=0||p.step<=0||p.max<p.min)return false;
 if(p.unit==='each'){if(![q,p.min,p.step].every(Number.isSafeInteger))return false;}
 else if(p.unit!=='kg'||Math.abs(q*1000-Math.round(q*1000))>1e-6)return false;
 const steps=(q-p.min)/p.step;
 return q>=p.min-1e-6&&q<=p.max+1e-6&&Math.abs(steps-Math.round(steps))<0.00001;
}
function quantityRules(line,fallback=line.product){
 const offers=Object.values(line.offers).filter(p=>p.available);if(fallback.unit!=='kg'||offers.length<2)return fallback;
 const gcd=(a,b)=>b?gcd(b,a%b):a,steps=offers.map(p=>Math.round(p.step*1000));
 if(steps.some(s=>s<=0))return fallback;
 const period=steps.reduce((a,b)=>a/gcd(a,b)*b),start=Math.ceil(Math.max(...offers.map(p=>p.min))*1000),max=Math.floor(Math.min(...offers.map(p=>p.max))*1000);
 if(period>100000)return fallback;
 for(let g=start;g<=Math.min(max,start+period);g++)if(offers.every(p=>validateQuantity(g/1000,p)))return {...fallback,min:g/1000,step:period/1000,max:(g+Math.floor((max-g)/period)*period)/1000};
 return fallback;
}
function fitQuantity(quantity,p){
 const lastStep=Math.floor((p.max-p.min)/p.step+1e-6),requestedStep=Math.max(0,Math.ceil((quantity-p.min)/p.step-1e-6));
 return Number((p.min+Math.min(lastStep,requestedStep)*p.step).toFixed(3));
}
function repairWeightProduct(p){
 if(p.retailer==='newworld'&&p.unit==='each'&&/-KGM-/.test(p.id)&&/^kg$/i.test(p.size||''))return {...p,unit:'kg',min:0.1,step:0.1,checkedAt:'1970-01-01T00:00:00Z'};
 if(p.unit==='kg')return {...p,min:Number(p.min.toFixed(3)),step:Number(p.step.toFixed(3)),max:Number(p.max.toFixed(3))};
 return p;
}
function addToBasket(state,row,quantity,preferred='cheapest'){
 const p=selectOffer({...row,quantity,preferred},'cheapest',state.loyalty);
 if(!p)return state;
 const old=state.basket.find(l=>Object.values(l.offers).some(o=>Object.values(row.offers).some(n=>n?.id===o?.id&&n?.retailer===o?.retailer)));
 const offers={...old?.offers,...row.offers};
 const nextQuantity=Number(((old?.quantity||0)+quantity).toFixed(3));
 const line={...old,...row,key:old?.key||row.key,offers,quantity:nextQuantity,preferred};
 if(!selectOffer(line,'cheapest',state.loyalty))return state;
 // The Add button promises the cheapest offer, including after a one-store shop.
 return {...state,policy:'cheapest',basket:old?state.basket.map(l=>l===old?line:l):[...state.basket,line]};
}
module.exports={sameProduct,groupProducts,effectivePrice,linePrice,selectOffer,basketSummary,validateQuantity,quantityRules,fitQuantity,repairWeightProduct,addToBasket,sizeKey,houseBrand,productWords};
