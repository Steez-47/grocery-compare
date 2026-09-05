// Read-only live catalogue check. Results are local and ignored by Git.
const fs=require('node:fs/promises');
const {Catalogue}=require('../electron/catalogue.cjs');
const jars={};
const transport=r=>async(url,options,checkout=false)=>{
 const jar=jars[r+checkout]??=new Map();
 const res=await fetch(url,{...options,headers:{...options.headers,cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')}});
 for(const c of res.headers.getSetCookie()){const kv=c.split(';')[0],i=kv.indexOf('=');jar.set(kv.slice(0,i),kv.slice(i+1));}
 if(url.includes('op-name=ProductSearch'))await fs.writeFile('research/ww-last-raw.json',await res.clone().text());return res;
};
async function main(){
 const cat=new Catalogue({newworld:transport('newworld'),woolworths:transport('woolworths')});
 const stores={newworld:(await cat.stores('newworld','Broadway')).find(s=>/Palmerston/i.test(s.address)),woolworths:(await cat.stores('woolworths','Kelvin Grove'))[0]};
 for(const q of process.argv.slice(2)){
  const results=await Promise.all(Object.entries(stores).map(async([r,s])=>[r,await cat.search(r,s,q)]));
  await fs.writeFile(`research/matching-${q}.json`,JSON.stringify(Object.fromEntries(results),null,2));
  console.log(q,...results.map(([r,d])=>`${r}: ${d.products.length}`));
 }
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={transport};
