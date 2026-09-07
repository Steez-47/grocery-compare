// Share overlapping reads, expire cold entries, and bound retained catalogue data.
class RequestCache {
 constructor({limit=64,ttl=180000,now=Date.now}={}){this.limit=limit;this.ttl=ttl;this.now=now;this.entries=new Map();this.pending=new Map();}
 get(key,work,force=false){
  const now=this.now();
  for(const [k,v] of this.entries)if(now-v.time>=this.ttl)this.entries.delete(k);
  const old=this.entries.get(key);
  if(!force&&old){this.entries.delete(key);this.entries.set(key,old);return Promise.resolve(old.data);}
  // A forced refresh must not join an older ordinary read.
  const flight=JSON.stringify([key,force]);
  if(this.pending.has(flight))return this.pending.get(flight);
  const job=Promise.resolve().then(work).then(data=>{
   // Only the newest request for this key may populate the cache.
   if(this.owners.get(key)===job){this.entries.delete(key);this.entries.set(key,{time:this.now(),data});while(this.entries.size>this.limit)this.entries.delete(this.entries.keys().next().value);}
   return data;
  }).finally(()=>{this.pending.delete(flight);if(this.owners.get(key)===job)this.owners.delete(key);});
  this.owners??=new Map();this.owners.set(key,job);this.pending.set(flight,job);return job;
 }
}
module.exports={RequestCache};
