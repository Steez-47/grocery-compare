const {groupProducts,selectOffer}=require('./model.cjs');
const {rankRows}=require('./recommend.cjs');
const {saleInfo}=require('./pricing.cjs');
function homeRows(products,profile,{basket=[],loyalty,limit=24,deals=false}={}){
 const rows=groupProducts([...new Map(products.map(p=>[p.retailer+':'+p.id,p])).values()],profile);
 if(!deals)return rankRows(rows,profile,{basket,loyalty,limit,variety:true});
 // Rank the offer the card actually selects, so the headline saving is reproducible.
 return rows.map(row=>{const p=selectOffer({...row,quantity:row.product.min},'cheapest',loyalty);return {row,deal:p&&saleInfo(p,loyalty[p.retailer])}})
  .filter(x=>x.deal).sort((a,b)=>b.deal.percent-a.deal.percent||b.deal.saving-a.deal.saving||a.row.key.localeCompare(b.row.key)).slice(0,limit).map(x=>x.row);
}
module.exports={homeRows};
