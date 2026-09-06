const {clean,houseBrand}=require('./products.cjs');
// Loose produce is an equivalent commodity, not a branded fixed-size pack.
// Keep every remaining descriptor, so unfamiliar varieties stay distinct too.
function produceKey(p){
 if(p.unit!=='kg'||!(p.categories||[]).some(c=>/^fruit (?:&|and) (?:veg|vegetables)$/i.test(c)))return null;
 if(p.brand&&!houseBrand(p))return null;
 let name=clean(p.name);const brand=clean(p.brand);if(brand&&name.startsWith(brand+' '))name=name.slice(brand.length);
 if(/organic/.test(brand)&&!name.includes('organic'))name+=' organic';
 name=name.replace(/\bmin(?:imum)?\s+(?:order|order weight)\s*\d+(?:\.\d+)?\s*(?:kg|g)\b/g,' ').replace(/\b\d+(?:\.\d+)?\s*(?:kg|g)\b/g,' ').replace(/\b(?:fresh|loose|per|kg|new zealand|nz|washed|brushed)\b/g,' ');
 if(/\b(?:pack|bag|bunch|punnet|tray|juice|chips|dried|frozen|diced|sliced|chopped|peeled)\b/.test(name))return null;
 const aliases={bananas:'banana',lemons:'lemon',limes:'lime',apples:'apple',pears:'pear',oranges:'orange',tomatoes:'tomato',potatoes:'potato',carrots:'carrot',onions:'onion',avocados:'avocado',capsicums:'capsicum',mushrooms:'mushroom',courgettes:'courgette',peaches:'peach',nectarines:'nectarine',plums:'plum',apricots:'apricot'};
 let words=name.split(/\s+/).filter(Boolean).map(w=>aliases[w]||w);
 if(words.includes('banana')&&!words.some(w=>['green','cooking','plantain'].includes(w)))words=words.filter(w=>w!=='yellow');
 if(words.includes('tomato'))words=words.filter(w=>w!=='red'&&!(w==='vine'&&words.includes('truss')));
 if(words.includes('potato')&&words.includes('agria'))words=words.filter(w=>w!=='yellow');
 return words.length?[...new Set(words)].sort().join('|'):null;
}
module.exports={produceKey};
