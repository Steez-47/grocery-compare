const {clean,sizeKey,houseBrand,productWords}=require('./products.cjs');
const {produceKey}=require('./produce.cjs');
const aliases={spreadable:'spread',powdered:'powder',granulated:'granule',granules:'granule',sweets:'lolly',lollies:'lolly',candy:'lolly',yogurt:'yoghurt',flavoured:'flavour',flavored:'flavour',flavouring:'flavour',cookies:'cookie',biscuits:'biscuit',tomatoes:'tomato',potatoes:'potato',choc:'chocolate',chocolates:'chocolate',beans:'bean',noodles:'noodle',sachets:'sachet',capsules:'pod',capsule:'pod',pods:'pod',sliced:'slice',chips:'chip'};
const filler=new Set(['fresh','premium','pure','natural','naturally','new','zealand','nz','style','pack','packet','jar','bottle','delicious','tasty','flavour','traditional','quality','authentic','finest']);
const critical=new Set(['semi','buttersoft','unsalted','reduced','organic','decaf','decaffeinated','caffeine','gluten','lactose','dairy','vegan','vegetarian','light','trim','blue','protein','uht','wholemeal','wheatmeal','multigrain','white','sandwich','toast','thick','thin','fibre','skinless','boneless','breast','thigh','drumstick','mince','powder','granule','bean','ground','instant','pod','capsule','strawberry','banana','raspberry','blackberry','blueberry','vanilla','chocolate','caramel','hazelnut','mint','lemon','orange','garlic','herb','honey','chilli','bbq','sour','sweet','dark','medium','strong','jumbo']);
const optionalCritical=new Set(['toast','instant']);
const cache=new Map();
function key(p){return p.retailer+':'+p.id;}
function pairKey(a,b){return [key(a),key(b)].sort().join('|');}
function oneEdit(a,b){if(Math.abs(a.length-b.length)>1)return false;let i=0,j=0,changes=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue}if(++changes>1)return false;if(a.length>=b.length)i++;if(b.length>=a.length)j++;}return changes+(i<a.length||j<b.length?1:0)<=1;}
function tokenise(p){return [...new Set(productWords(p).map(w=>{if(aliases[w])return aliases[w];if(w.length>=6&&!critical.has(w)){const matches=[...critical].filter(c=>c.length>=6&&oneEdit(w,c));if(matches.length===1)return matches[0]}return w}).filter(w=>!filler.has(w)))];}
function inferredSize(p){
 if(p.size||p.unit!=='each'||p.member)return null;
 const m=String(p.unitPrice||'').match(/\$([\d.]+)\s*\/\s*(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b/i);if(!m||!p.cents)return null;
 const u=m[3].toLowerCase(),unit=u==='kg'?'g':u==='l'?'ml':u,scale=Number(m[2])*(u==='kg'||u==='l'?1000:1),cup=Number(m[1]),price=p.cents/100;if(cup<=0.005)return null;
 const low=(price-0.005)/(cup+0.005)*scale,high=(price+0.005)/(cup-0.005)*scale,mid=(low+high)/2,rounded=Math.round(mid);
 if((high-low)/mid>0.02||rounded<1||rounded<low||rounded>high)return null;
 return {size:rounded+unit,low,high,unit};
}
function grams(text){const result=new Set();for(const word of text.split(' ')){const s=' '+word+' ';for(let n=2;n<=3;n++)for(let i=0;i+n<=s.length;i++)result.add(s.slice(i,i+n));}return result;}
function vector(p){
 const fingerprint=JSON.stringify([p.retailer,p.id,p.name,p.brand,p.size,p.unit,p.cents,p.unitPrice,p.member,p.categories]);const old=cache.get(fingerprint);if(old)return old;
 const words=tokenise(p),features=new Map(),chars=grams(words.join(' '));
 for(const w of words)features.set('w:'+w,critical.has(w)?2.2:1.5);
 for(const g of chars)features.set('c:'+g,0.16);
 let norm=0;for(const v of features.values())norm+=v*v;norm=Math.sqrt(norm)||1;
 for(const [k,v]of features)features.set(k,v/norm);
 const inferred=inferredSize(p);const result={words,features,chars,brand:clean(p.brand),size:sizeKey(p.size||inferred?.size),inferred,categories:new Set((p.categories||[]).map(clean))};
 cache.set(fingerprint,result);if(cache.size>3000)cache.delete(cache.keys().next().value);return result;
}
function cosine(a,b){let score=0;const [small,big]=a.size<b.size?[a,b]:[b,a];for(const [k,v]of small)score+=v*(big.get(k)||0);return score;}
function charSimilarity(a,b){let same=0;for(const x of a)if(b.has(x))same++;return 2*same/Math.max(1,a.size+b.size);}
function conflict(a,b){
 const x=new Set(a.words),y=new Set(b.words);
 // Numeric grades, strengths, fat percentages and formulation claims matter.
 const numbers=v=>v.filter(w=>/\d/.test(w)).sort().join('|');if(numbers(a.words)!==numbers(b.words))return true;
 for(const w of critical){if(optionalCritical.has(w))continue;if(x.has(w)!==y.has(w))return true;}
 if(x.has('sandwich')!==y.has('sandwich')||x.has('free')!==y.has('free'))return true;
 if(x.has('salt')&&y.has('unsalted')||y.has('salt')&&x.has('unsalted'))return true;
 return false;
}
function textScore(a,b){const x=vector(a),y=vector(b);return cosine(x.features,y.features);}
function pairScore(a,b,legacy=()=>0){
 if(a.retailer===b.retailer||a.unit!==b.unit)return {accepted:false,score:0};
 const produceA=produceKey(a),produceB=produceKey(b);
 if(produceA||produceB)return {accepted:!!produceA&&produceA===produceB,score:produceA===produceB?290:0,kind:'produce'};
 const x=vector(a),y=vector(b),house=x.brand!==y.brand&&houseBrand(a)&&houseBrand(b);
 if(!x.size||x.size!==y.size||(!house&&x.brand!==y.brand)||!x.brand||!y.brand)return {accepted:false,score:0};
 if(a.barcode&&b.barcode&&!house&&a.barcode!==b.barcode)return {accepted:false,score:0};
 if(x.inferred&&y.inferred)return {accepted:false,score:0};
 const exact=legacy(x.inferred?{...a,size:x.inferred.size}:a,y.inferred?{...b,size:y.inferred.size}:b);if(exact)return {accepted:true,score:200+exact,kind:house?'equivalent':'exact'};
 if(conflict(x,y))return {accepted:false,score:0};
 const shared=x.words.filter(w=>y.words.includes(w));
 const missingX=x.words.filter(w=>!y.words.includes(w)),missingY=y.words.filter(w=>!x.words.includes(w));
 // Two distinct descriptions must agree lexically or at character level.
 // This blocks raspberry/blackberry-like variants outside the attribute lexicon.
 if(missingX.length&&missingY.length){const resemblance=charSimilarity(grams(missingX.join(' ')),grams(missingY.join(' ')));if(resemblance<0.58)return {accepted:false,score:0};}
 const cos=cosine(x.features,y.features),coverage=shared.length/Math.max(1,Math.min(x.words.length,y.words.length));
 const category=[...x.categories].some(c=>y.categories.has(c));
 const chars=charSimilarity(x.chars,y.chars);
 let score=100*(0.53*cos+0.29*coverage+0.13*chars+(category?0.05:0));
 // Store titles often omit descriptive words. Only allow that shortcut within
 // a verified category and a same-brand, same-size block.
 if(!house&&category&&coverage===1&&shared.length>=1)score=Math.max(score,84+Math.min(shared.length,3));
 const accepted=score>=82&&((shared.length>=2)||category);
 return {accepted,score,kind:house?'equivalent':'similar'};
}
function group(products,legacy,feedback={}){
 const unique=[...new Map(products.map(p=>[key(p),p])).values()],blocks=new Map(),scores=new Map();
 unique.forEach((p,i)=>{const v=vector(p),produce=produceKey(p),block=produce?'produce|'+produce:[houseBrand(p)?'house':v.brand,p.unit,v.size].join('|');const list=blocks.get(block)||[];list.push(i);blocks.set(block,list)});
 const positions=new Map(unique.map((p,i)=>[key(p),i]));
 const rejected=new Set(feedback.rejected||[]),confirmed=new Set(feedback.confirmed||[]);let comparisons=0;
 for(const ids of blocks.values())for(let ai=0;ai<ids.length;ai++)for(let bi=ai+1;bi<ids.length;bi++){
  const i=ids[ai],j=ids[bi],a=unique[i],b=unique[j];if(a.retailer===b.retailer)continue;comparisons++;
  const k=pairKey(a,b);if(rejected.has(k))continue;
  const result=pairScore(a,b,legacy);if(confirmed.has(k)&&a.unit===b.unit&&sizeKey(a.size)===sizeKey(b.size))Object.assign(result,{accepted:true,score:500,kind:'confirmed'});
  if(!result.accepted)continue;for(const [from,to]of [[i,j],[j,i]]){const list=scores.get(from)||[];list.push({index:to,...result});scores.set(from,list)}
 }
 // Explicitly confirmed cross-brand pairs are outside normal brand blocks.
 for(const k of confirmed){if(rejected.has(k))continue;const ids=k.split('|').map(id=>positions.get(id)??-1);if(ids.some(i=>i<0))continue;const [i,j]=ids;if(unique[i].retailer===unique[j].retailer||unique[i].unit!==unique[j].unit||!sizeKey(unique[i].size)||sizeKey(unique[i].size)!==sizeKey(unique[j].size))continue;
  for(const [from,to]of [[i,j],[j,i]]){const list=(scores.get(from)||[]).filter(s=>s.index!==to);list.push({index:to,score:500,kind:'confirmed'});scores.set(from,list)}
 }
 const best=new Map();for(const [i,list]of scores){list.sort((a,b)=>b.score-a.score);if(list.length===1||list[0].score-list[1].score>=4)best.set(i,list[0]);}
 const used=new Set(),rows=[];
 unique.forEach((p,i)=>{if(used.has(i))return;used.add(i);const row={key:key(p),product:p,offers:{[p.retailer]:p}},bestMatch=best.get(i),j=bestMatch?.index;
  if(j!==undefined&&best.get(j)?.index===i&&!used.has(j)){const q=unique[j];row.offers[q.retailer]=q;row.equivalent=clean(p.brand)!==clean(q.brand);row.matchKind=bestMatch.kind;used.add(j)}rows.push(row);
 });
 group.lastComparisons=comparisons;return rows.sort((a,b)=>Object.keys(b.offers).length-Object.keys(a.offers).length);
}
module.exports={key,pairKey,vector,textScore,pairScore,group,tokenise,inferredSize};
