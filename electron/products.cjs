const clean=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/['’]/g,'').replace(/[^a-z0-9.%]+/g,' ').trim();
function sizeKey(s){return clean(s).replace(/(?:packs?|pk|count|ct)\b/g,'ea').replace(/(\d+(?:\.\d+)?)\s*(ml|kg|g|l)\b/g,(_,n,u)=>String(Number((Number(n)*(u==='kg'||u==='l'?1000:1)).toFixed(4)))+(u==='kg'?'g':u==='l'?'ml':u)).replace(/\s/g,'');}
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function houseBrand(p){const b=clean(p.brand);return p.retailer==='newworld'?/^(pams(?: value| finest| free range| organic)?|value)$/.test(b):/^(woolworths(?: essentials| gold)?|macro(?: organic)?)$/.test(b);}
function houseTier(p){const b=clean(p.brand);return /value|essentials/.test(b)?'value':/finest|gold/.test(b)?'premium':'standard';}
function productWords(p){
 let s=clean(p.name.replace(new RegExp(escape(p.size||'(?!)'),'i'),' '));
 const brand=clean(p.brand);if(s.startsWith(brand+' '))s=s.slice(brand.length);
 // Some Woolworths names contain Essentials even when the brand field does not.
 if(houseBrand(p))s=s.replace(/^\s*essentials\b/,' ');
 if(houseBrand(p)){if(brand.includes('organic')&&!s.includes('organic'))s+=' organic';if(brand.includes('free range')&&!s.includes('free range'))s+=' free range';}
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
  // Pams confirms cream and salt for this specific product, not for all plain butter.
  if(p.retailer==='newworld'&&p.id==='5023660-EA-000'&&!/\bsalt\b/.test(s))s+=' salt';
 }
 if(houseBrand(p)&&/\bspread\b/.test(s))s=s.replace(/\bmargarine\b/g,' ');
 if(/\beggs\b/.test(s))s=s.replace(/s\.?\s*p\.?\s*c\.?\s*a\.?/g,' ').replace(/\bcage free\b/g,'barn').replace(/\bgrade\b/g,'size').replace(/\bmixed size\b/g,'mixed');
 return [...new Set(s.split(/\s+/).filter(Boolean))].sort();
}

module.exports={clean,sizeKey,houseBrand,houseTier,productWords};
