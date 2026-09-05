// Only disposable, unauthenticated sessions. Never places an order.
const {Catalogue}=require('../electron/catalogue.cjs');
const {transport}=require('./check-matching.cjs');
const fs=require('node:fs/promises');
async function main(){
 const cat=new Catalogue({newworld:transport('newworld'),woolworths:transport('woolworths')});
 const detail=await cat.gql('query GetProductDetails($key:String!){My{product(key:$key){name variants{...on GroceryVariant{key name barcode volumeSize}}}}}',{key:'841328'});
 console.log('Product detail',JSON.stringify(detail));
 const stores={newworld:(await cat.stores('newworld','Broadway')).find(s=>/Palmerston/i.test(s.address)),woolworths:(await cat.stores('woolworths','Kelvin Grove'))[0]};
 for(const r of ['woolworths','newworld']){
  try{
   const token=r==='newworld'?await cat.token():undefined;
   const products=(await cat.search(r,stores[r],'butter')).products.filter(p=>p.available&&!p.restricted&&p.unit==='each');
   const line={product:products[0],quantity:1};
   console.log(r,'cart before',JSON.stringify(await cat.cart(r,token)));
   console.log(r,'transfer',await cat.transfer(r,stores[r],[line],token));
   console.log(r,'repeat',await cat.transfer(r,stores[r],[line],token));
   const after=await cat.cart(r,token);await fs.writeFile(`research/guest-cart-${r}.json`,JSON.stringify(after,null,2));
  }catch(e){console.log(r,'TEST FAILED:',e.message)}
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
