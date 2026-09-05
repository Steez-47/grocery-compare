const clean=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/['’]/g,'').replace(/[^a-z0-9.%]+/g,' ').trim();
function sizeKey(s){return clean(s).replace(/(?:packs?|pk|count|ct)\b/g,'ea').replace(/(\d+(?:\.\d+)?)\s*(ml|kg|g|l)\b/g,(_,n,u)=>String(Number((Number(n)*(u==='kg'||u==='l'?1000:1)).toFixed(4)))+(u==='kg'?'g':u==='l'?'ml':u)).replace(/\s/g,'');}
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function productWords(p){
 let s=clean(p.name.replace(new RegExp(escape(p.size||'(?!)'),'i'),' '));
 const brand=clean(p.brand);if(s.startsWith(brand+' '))s=s.slice(brand.length);
 s=s.replace(/\bsupersoft\b/g,'super soft').replace(/\bhoneygrain\b/g,'honey grain').replace(/\bseasalt\b/g,'sea salt').replace(/\bsoya\b/g,'soy').replace(/\blite\b/g,'light').replace(/\bspreadable\b/g,'spread').replace(/\bsalted\b/g,'salt').replace(/\band\b/g,' ');
 // Category-specific wording changes; never a general fuzzy-name threshold.
 if(/\bmilk\b/.test(s)){
  s=s.replace(/\bzero lacto\b/g,'lactose free');
  if(/\bblue\b/.test(s))s=s.replace(/\bstandard\b/g,' ');
  if(/\blight\b/.test(s))s=s.replace(/\b98\.5% fat free\b/g,' ');
 }
 if(/\bbutter\b/.test(s)){
  s=s.replace(/\b(?:grass fed|new zealand|premium|pure)\b/g,' ');
  if(/\bbuttersoft\b/.test(s))s=s.replace(/\bspread\b/g,' ');
 }
 if(/\beggs\b/.test(s))s=s.replace(/s\.?\s*p\.?\s*c\.?\s*a\.?/g,' ').replace(/\bcage free\b/g,'barn').replace(/\bgrade\b/g,'size').replace(/\bmixed size\b/g,'mixed');
 return [...new Set(s.split(/\s+/).filter(Boolean))].sort();
}
function matchScore(a,b){
 if(a.retailer===b.retailer||a.unit!==b.unit)return 0;
 if(a.barcode&&b.barcode)return a.barcode===b.barcode?100:0;
 if(!a.brand||!b.brand||clean(a.brand)!==clean(b.brand)||!a.size||sizeKey(a.size)!==sizeKey(b.size))return 0;
 const x=productWords(a),y=productWords(b);
 if(x.join('|')===y.join('|'))return 90;
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
 return xx.length>=2&&xx.join('|')===yy.join('|')?80:0;
}
function sameProduct(a,b){return matchScore(a,b)>0;}
function groupProducts(products){
 const unique=[...new Map(products.map(p=>[p.retailer+':'+p.id,p])).values()];
 const best=unique.map((p,i)=>{let score=0,indices=[];unique.forEach((q,j)=>{if(i===j)return;const s=matchScore(p,q);if(s>score){score=s;indices=[j]}else if(s&&s===score)indices.push(j)});return indices.length===1?indices[0]:-1;});
 const used=new Set(),rows=[];
 unique.forEach((p,i)=>{if(used.has(i))return;const row={key:p.retailer+':'+p.id,product:p,offers:{[p.retailer]:p}},j=best[i];used.add(i);if(j>=0&&best[j]===i&&!used.has(j)){row.offers[unique[j].retailer]=unique[j];used.add(j)}rows.push(row)});
 return rows.sort((a,b)=>Object.keys(b.offers).length-Object.keys(a.offers).length);
}
function effectivePrice(p,member){return p.member&&!member?p.regularCents:p.cents;}
function selectOffer(line,policy,loyalty){
 const offers=Object.values(line.offers).filter(p=>p.available&&effectivePrice(p,loyalty[p.retailer])!==null);
 if(policy!=='cheapest')return offers.find(p=>p.retailer===policy)||null;
 if(line.preferred&&line.preferred!=='cheapest')return offers.find(p=>p.retailer===line.preferred)||null;
 return offers.sort((a,b)=>effectivePrice(a,loyalty[a.retailer])-effectivePrice(b,loyalty[b.retailer]))[0]||null;
}
function basketSummary(lines,policy,loyalty){let cents=0,missing=0;const shops={newworld:[],woolworths:[]};for(const line of lines){const p=selectOffer(line,policy,loyalty);if(!p){missing++;continue;}cents+=Math.round(effectivePrice(p,loyalty[p.retailer])*line.quantity);shops[p.retailer].push({product:p,quantity:line.quantity});}return {cents,missing,shops};}
function validateQuantity(q,p){return Number.isFinite(q)&&q>=p.min&&q<=p.max&&Math.abs(q/p.step-Math.round(q/p.step))<0.00001;}
module.exports={sameProduct,groupProducts,effectivePrice,selectOffer,basketSummary,validateQuantity,sizeKey};
