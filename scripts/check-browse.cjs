const {Catalogue}=require('../electron/catalogue.cjs');const {transport}=require('./check-matching.cjs');const fs=require('node:fs/promises');
async function main(){const cat=new Catalogue({newworld:transport('newworld'),woolworths:transport('woolworths')});
const stores={newworld:(await cat.stores('newworld','Broadway')).find(x=>/Palmerston/i.test(x.address)),woolworths:(await cat.stores('woolworths','Kelvin Grove'))[0]};
const departments=await cat.departments(stores);console.log(departments.map(d=>d.name+': '+d.children.map(c=>c.name).join(', ')).join('\n'));await fs.writeFile('research/departments.json',JSON.stringify(departments,null,2));
for(const name of ['Milk','Butter','Rice']){const c=departments.flatMap(d=>d.children).find(x=>x.name===name);for(const r of ['newworld','woolworths']){const d=await cat.search(r,stores[r],'',0,true,{category:c.sources[r]});console.log(name,r,d.products.length,d.products[0]?.name,d.products[0]?.categories);await fs.writeFile(`research/browse-${name}-${r}.json`,JSON.stringify(d,null,2))}}
}main().catch(e=>{console.error(e.message);process.exitCode=1});
