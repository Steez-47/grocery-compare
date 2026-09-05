const fs=require('node:fs/promises');
const {clean}=require('./products.cjs');
const {key,pairKey,textScore,tokenise}=require('./matching.cjs');
const {effectivePrice}=require('./model.cjs');
const DAY=86400000;
const emptyProfile=()=>({version:1,enabled:true,theme:'system',revision:0,products:{},brands:{},interests:{},aisles:{},seen:{},confirmed:[],rejected:[]});
const value=(entry,now)=>Number.isFinite(entry?.value)&&Number.isFinite(entry?.updated)?entry.value*Math.pow(0.5,Math.max(0,now-entry.updated)/(30*DAY)):0;
function bump(map,k,weight,now){if(!k)return;map[k]={value:Math.max(-15,Math.min(30,value(map[k],now)+weight)),updated:now};}
function trim(map,max){const entries=Object.entries(map);if(entries.length>max){entries.sort((a,b)=>(b[1].updated||b[1].last)-(a[1].updated||a[1].last));for(const [k]of entries.slice(max))delete map[k];}}
function record(profile,event,now=Date.now()){
 if(!profile.enabled)return;
 if(event.type==='impression'){
  for(const p of event.products||[]){const k=key(p),old=profile.seen[k];if(!old||now-old.last>15*60000)profile.seen[k]={count:Math.min(30,(old?.count||0)+1),last:now};}
 }else{
  const weight={add:4,view:1,browse:1.2,dismiss:-6}[event.type];if(weight===undefined)return;
  const p=event.product;
  if(p){bump(profile.products,key(p),weight,now);bump(profile.brands,clean(p.brand),weight*0.2,now);for(const word of tokenise(p))bump(profile.interests,word,weight*0.22,now);for(const c of p.categories||[])bump(profile.interests,clean(c),weight*0.3,now);}
  if(event.aisle)bump(profile.aisles,event.aisle,weight,now);
  for(const word of clean(event.query||'').split(' ').filter(w=>w.length>2))bump(profile.interests,word,0.2,now);
 }
 trim(profile.products,1500);trim(profile.brands,300);trim(profile.interests,500);trim(profile.aisles,150);trim(profile.seen,2000);profile.revision++;
}
function affinity(p,profile,now){if(!profile.enabled)return 0;const words=tokenise(p),cats=p.categories||[];
 return 0.6*value(profile.products[key(p)],now)+0.2*value(profile.brands[clean(p.brand)],now)
 +words.reduce((s,w)=>s+value(profile.interests[w],now),0)/Math.max(3,words.length)
 +cats.reduce((s,c)=>s+value(profile.interests[clean(c)],now),0)/Math.max(3,cats.length);
}
function unitValue(p){const m=String(p.unitPrice||'').match(/\$([\d.]+)\s*\/\s*(\d+(?:\.\d+)?)\s*(kg|g|ml|l|ea)\b/i);if(!m)return null;const unit=m[3].toLowerCase(),amount=Number(m[2])*(unit==='kg'||unit==='l'?1000:1);return {unit:unit==='kg'?'g':unit==='l'?'ml':unit,value:Number(m[1])/amount};}
function rankRows(rows,profile,{now=Date.now(),basket=[],loyalty={newworld:true,woolworths:true},source=null,limit=6}={}){
 const inBasket=new Set(basket.flatMap(l=>Object.values(l.offers).map(key))),units=new Map();
 const candidates=rows.map(row=>{const offers=Object.values(row.offers).filter(p=>p.available&&!p.restricted&&effectivePrice(p,loyalty[p.retailer])!==null);if(!offers.length)return null;
  const p=offers.reduce((a,b)=>affinity(a,profile,now)>=affinity(b,profile,now)?a:b),u=unitValue(p);
  if(u){const values=units.get(u.unit)||[];values.push(u.value);units.set(u.unit,values)}
  return {row,p,offers,u};
 }).filter(Boolean).filter(c=>!c.offers.every(p=>inBasket.has(key(p)))&&(!profile.enabled||value(profile.products[key(c.p)],now)>-5));
 for(const c of candidates){
  const discount=Math.max(...c.offers.map(p=>p.regularCents>p.cents?(p.regularCents-p.cents)/p.regularCents:0));
  const seen=profile.enabled?profile.seen[key(c.p)]:null;
  const exposure=seen?Math.min(1.5,seen.count*0.2)*Math.pow(0.5,Math.max(0,now-seen.last)/(3*DAY)):0;
  const unitRank=c.u?(units.get(c.u.unit)||[]).filter(n=>n>c.u.value).length/Math.max(1,units.get(c.u.unit)?.length):0;
  c.score=affinity(c.p,profile,now)+Math.min(0.7,discount*2)+(c.offers.some(p=>p.special)?0.15:0)+(c.offers.length===2?0.5:0)+unitRank*0.45-exposure+(source?textScore(source,c.p)*7:0);
 }
 const selected=[];
 while(candidates.length&&selected.length<limit){
  let best=0,bestScore=-Infinity;
  candidates.forEach((c,i)=>{const similar=selected.length?Math.max(...selected.map(s=>textScore(s.p,c.p))):0;const brandCount=selected.filter(s=>clean(s.p.brand)===clean(c.p.brand)).length;
   const score=c.score-similar*1.3-brandCount*0.7;
   if(score>bestScore){best=i;bestScore=score}
  });selected.push(candidates.splice(best,1)[0]);
 }
 return selected.map(c=>c.row);
}
function rankShelves(departments,profile,now=Date.now()){
 const cold=['Sweets & lollies','Fruit','Breakfast cereal','Milk','Chips','Bread','Coffee','Frozen Pizza','Rice','Vegetables','Chocolate'];
 const candidates=departments.flatMap(d=>d.children.map(a=>({aisle:a,department:d.name,score:(cold.includes(a.name)?1-cold.indexOf(a.name)*0.045:0.1)+(profile.enabled?value(profile.aisles[a.id],now)*0.8+clean(a.name).split(' ').reduce((s,w)=>s+value(profile.interests[w],now),0)*0.5:0)})));
 const result=[];while(candidates.length){let best=0,score=-Infinity;candidates.forEach((c,i)=>{const recent=result.slice(-2).filter(x=>x.department===c.department).length;const s=c.score-recent*1.3;if(s>score){score=s;best=i}});
  // Every fourth shelf explores a department not yet represented where possible.
  if(result.length%4===3){const unseen=candidates.findIndex(c=>!result.some(s=>s.department===c.department));if(unseen>=0)best=unseen;}
  result.push(candidates.splice(best,1)[0]);
 }return result.map(x=>x.aisle);
}
class Preferences{
 constructor(file){this.file=file;this.data=emptyProfile();this.queue=Promise.resolve();this.recent=new Map();}
 async load(){try{const d=JSON.parse(await fs.readFile(this.file,'utf8'));if(d.version===1)this.data={...emptyProfile(),...d};}catch(e){if(e.code!=='ENOENT')await fs.copyFile(this.file,this.file+'.recovery').catch(()=>{});}return this.data;}
 save(){const payload=JSON.stringify(this.data);this.queue=this.queue.catch(()=>{}).then(()=>fs.writeFile(this.file+'.tmp',payload).then(()=>fs.rename(this.file+'.tmp',this.file)));return this.queue;}
 async track(event){const id=JSON.stringify([event.type,event.product&&key(event.product),event.aisle,event.query]),now=Date.now();if(event.type!=='impression'&&now-(this.recent.get(id)||0)<15000)return;this.recent.set(id,now);if(this.recent.size>300)this.recent.delete(this.recent.keys().next().value);record(this.data,event,now);await this.save();}
 async feedback(a,b,accept){const k=pairKey(a,b);this.data.confirmed=this.data.confirmed.filter(x=>x!==k);this.data.rejected=this.data.rejected.filter(x=>x!==k);this.data[accept?'confirmed':'rejected'].push(k);this.data.confirmed=this.data.confirmed.slice(-500);this.data.rejected=this.data.rejected.slice(-500);this.data.revision++;await this.save();}
 async reset(){const old=this.data;this.data={...emptyProfile(),enabled:old.enabled,theme:old.theme,confirmed:old.confirmed,rejected:old.rejected,revision:old.revision+1};this.recent.clear();await this.save();}
}
module.exports={emptyProfile,record,affinity,rankRows,rankShelves,Preferences,unitValue};
