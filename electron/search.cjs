// Structured conjunctive retrieval. Retailer results are candidates, not proof of relevance.
const aliases = new Map(Object.entries({soya:'soy',lite:'light',yoghurt:'yogurt',yoghurts:'yogurt',yogurts:'yogurt',tomatoes:'tomato',potatoes:'potato',berries:'berry',eggs:'egg',bottles:'bottle',apples:'apple',bananas:'banana',oranges:'orange',lemons:'lemon',limes:'lime',avocados:'avocado',onions:'onion',carrots:'carrot',packs:'pack',pk:'pack',pks:'pack'}));
const stop = new Set(['and','the','of','a','an']);
const normalise = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/['’]/g,'').replace(/[‐‑–—-]/g,' ');
const amount = (n,u) => `${Number((Number(n) * (/^(kg|l|litre|litres|liter|liters)$/.test(u)?1000:1)).toFixed(4))}${/^(kg|g|gram|grams)$/.test(u)?'g':'ml'}`;

function parseQuery(value) {
 let text=normalise(value);const constraints=new Set();
 text=text.replace(/\b(\d+(?:\.\d+)?)\s*(ml|kg|g|l|litres?|liters?|grams?)\s*[x×]\s*(\d+)\b/g,(_,n,u,count)=>{constraints.add('pack:'+Number(count));constraints.add('size:'+amount(n,u));return ' ';});
 // Multipacks: 24 x 500ml, 24×0.5 L. Keep individual volume, never infer total volume.
 text=text.replace(/\b(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(ml|kg|g|l|litres?|liters?|grams?)\b/g,(_,count,n,u)=>{constraints.add('pack:'+Number(count));constraints.add('size:'+amount(n,u));return ' ';});
 text=text.replace(/\b(\d+)\s*(?:packs?|pks?|counts?|ct|bottles?|cans?|rolls?|ea)\b/g,(_,n)=>{constraints.add('pack:'+Number(n));return ' ';});
 text=text.replace(/\bpack\s+of\s+(\d+)\b/g,(_,n)=>{constraints.add('pack:'+Number(n));return ' ';});
 text=text.replace(/\b(\d+(?:\.\d+)?)\s*(ml|kg|g|l|litres?|liters?|grams?)\b/g,(_,n,u)=>{constraints.add('size:'+amount(n,u));return ' ';});
 text=text.replace(/\b(\d+(?:\.\d+)?)\s*%/g,(_,n)=>{constraints.add('percent:'+Number(n));return ' ';});
 const words=(text.match(/[a-z0-9]+/g)||[]).filter(w=>!stop.has(w)).map(w=>aliases.get(w)||w);
 return {words:[...new Set(words)],constraints:[...constraints],tokens:[...new Set([...words,...constraints])],retrievalQuery:[...new Set(words)].join(' ') || String(value||'').trim()};
}

class SearchIndex {
 constructor(products) {
  this.documents=[];this.postings=new Map();
  const seen=new Set();
  for(const product of products){
   const key=product.retailer+':'+product.id;if(seen.has(key))continue;seen.add(key);
   // Categories, promotions and prices must not satisfy a requested product or quantity.
   const name=parseQuery(product.name),brand=parseQuery(product.brand),size=parseQuery(product.size);
   const tokens=[...name.words,...brand.words,...name.constraints,...size.constraints];
   const frequencies=new Map();for(const token of tokens)frequencies.set(token,(frequencies.get(token)||0)+1);
   const id=this.documents.length;this.documents.push({product,frequencies,length:tokens.length||1,name:name.words});
   for(const token of frequencies.keys()){if(!this.postings.has(token))this.postings.set(token,new Set());this.postings.get(token).add(id);}
  }
  this.averageLength=this.documents.reduce((sum,d)=>sum+d.length,0)/(this.documents.length||1)||1;
 }
 search(query) {
  const parsed=typeof query==='string'?parseQuery(query):query;
  if(!parsed.tokens.length)return [];
  const lists=parsed.tokens.map(token=>this.postings.get(token)||new Set()).sort((a,b)=>a.size-b.size);
  // Intersect smallest posting first; no amount of pack-size evidence can replace a missing noun.
  const candidates=[...lists[0]].filter(id=>lists.every(list=>list.has(id)));
  return candidates.map(id=>{
   const doc=this.documents[id];let score=0;
   for(const token of parsed.words){
    const frequency=doc.frequencies.get(token),df=this.postings.get(token).size;
    const idf=Math.log(1+(this.documents.length-df+0.5)/(df+0.5));
    score+=idf*(frequency*2.2)/(frequency+1.2*(0.25+0.75*doc.length/this.averageLength));
   }
   if(parsed.words.length&&doc.name.some((_,start)=>parsed.words.every((word,offset)=>doc.name[start+offset]===word)))score+=1;
   return {product:doc.product,score};
  }).sort((a,b)=>b.score-a.score || String(a.product.name).localeCompare(String(b.product.name)) || (a.product.retailer+':'+a.product.id).localeCompare(b.product.retailer+':'+b.product.id));
 }
}

function rankProducts(products,query){return new SearchIndex(products).search(query).map(result=>result.product);}
function rankRows(rows,query){
 const ranked=new SearchIndex(rows.flatMap(row=>Object.values(row.offers))).search(query);
 const scores=new Map(ranked.map(({product,score})=>[product.retailer+':'+product.id,score]));
 const score=row=>Math.max(...Object.values(row.offers).map(p=>scores.get(p.retailer+':'+p.id)??-Infinity));
 return rows.filter(row=>Number.isFinite(score(row))).sort((a,b)=>score(b)-score(a)||a.product.name.localeCompare(b.product.name));
}

// Bound each user request while letting the caller continue at the exact source cursor.
async function searchCatalogue(catalogue,retailer,store,query,page=0,force=false,options={}){
 if(options.category||!query.trim())return catalogue.search(retailer,store,query,page,force,options);
 const parsed=parseQuery(query);
 if(!parsed.tokens.length)return {products:[],total:0,pages:0,nextPage:null};
 let next=page,pages=0,total=0;const candidates=[];let ranked=[];
 for(let scanned=0;scanned<3;scanned++){
  const data=await catalogue.search(retailer,store,parsed.retrievalQuery,next,force,options);
  candidates.push(...data.products);pages=data.pages;total=data.total;next++;
  ranked=rankProducts(candidates,parsed);
  if(ranked.length>=12||next>=pages||next>28)break;
 }
 return {products:ranked,total,pages,nextPage:next<pages&&next<=28?next:null};
}
module.exports={parseQuery,SearchIndex,rankProducts,rankRows,searchCatalogue};
