const {Catalogue}=require('../electron/catalogue.cjs');const {transport}=require('./check-matching.cjs');const fs=require('node:fs/promises');
async function main(){
 const cat=new Catalogue({newworld:transport('newworld'),woolworths:transport('woolworths')});
 const store=(await cat.stores('newworld','Broadway')).find(x=>/Palmerston/i.test(x.address));
 const tasks={
  'nw-decorated':()=>cat.nw('/store/'+store.id+'/decorateProducts',{method:'POST',body:JSON.stringify({productIds:['5023660-EA-000']})}),
  'nw-categories':()=>cat.nw('/store/'+store.id+'/categories'),
  'ww-categories':()=>cat.gql('query GetAllCategories{My{categories{key name slug children{key name slug children{key name slug children{key name slug}}}}}}'),
  'ww-metadata':()=>cat.gql('query ProductSearch($input:CompositeSearchInput!){My{products(searchInput:$input){results{...on ProductSummary{sku productName brand categoryHierarchyNames{lvl0 lvl1 lvl2 lvl3} productGroup{description id} healthStarRating variants{variantKey name availabilityStatus}}}}}}',{input:{byKeyword:{value:'milk',sortBy:'RELEVANCE',pageSize:8,pageIndex:0}}}),
  'ww-details':()=>cat.gql('query GetProductDetails($key:String!){My{product(key:$key){name brand isOwnBrand category{name parent{name}} variants{...on GroceryVariant{key name barcode volumeSize ingredients countryOfOrigin allergenContained servingSize servingsPerPack nutritionalInformation{energy protein fatTotal fatTotalSaturated carbohydrate carbohydrateSugars dietaryFibre sodium quantityPerUnit}}}}}}',{key:'281759'}),
 };
 for(const [name,fn]of Object.entries(tasks)){try{const d=await fn();await fs.writeFile(`research/${name}.json`,JSON.stringify(d,null,2));console.log(name,JSON.stringify(d).slice(0,1300))}catch(e){console.log(name,e.message)}}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
