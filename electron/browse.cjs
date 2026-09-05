const {houseBrand,productWords}=require('./model.cjs');
// Common aisles map to live retailer categories, not hard-coded search terms/IDs.
const aisles={
 'Fruit & veg':[['Fruit'],['Vegetables'],['Fresh Salad & Herbs']],
 'Dairy & eggs':[['Milk'],['Free Range Eggs'],['Barn Eggs'],['Butter'],['Cheese'],['Greek yoghurt','Greek & Natural Yoghurt','Greek & Natural Yoghurt'],['Fresh Cream'],['Bacon']],
 'Meat & fish':[['Chicken & Poultry'],['Beef'],['Lamb'],['Pork','Pork & Ham','Pork'],['Plant Based Alternatives'],['Fish','Seafood','Fish']],
 'Bakery':[['Bread','Sliced & Packaged Bread','Sliced & Packaged Bread'],['Bagels & crumpets','Bagels, Crumpets & Pancakes','Bagels, Crumpets & Pancakes'],['Cakes & muffins','Cakes, Muffins & Desserts','Cakes, Muffins & Desserts']],
 'Pantry':[['Rice'],['Pasta','Dried Pasta','Dried Pasta'],['Biscuits & Crackers'],['Flour'],['Sugar'],['Canned Tomatoes'],['Canned Tuna'],['Honey'],['Jam'],['Oats & Porridge']],
 'Frozen':[['Frozen Vegetables'],['Ice Cream & Sorbet'],['Frozen Fruit'],['Frozen Fish'],['Frozen Pizza']],
 'Drinks':[['Coffee'],['Coffee Beans'],['Coffee Pods & Capsules'],['Black Tea'],['Green Tea'],['Water']],
 'Household':[['Laundry'],['Dishwashing'],['Toilet Paper'],['Tissues'],['Paper Towels']],
};
const normal=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'');
function flatten(nodes,path=[]){return nodes.flatMap(n=>{const p=[...path,n.name];return [{name:n.name,path:p,key:n.key},...flatten(n.children||[],p)]});}
function departments(nw,ww){
 const n=flatten(nw),w=flatten(ww.My.categories.children);
 return Object.entries(aisles).map(([name,children])=>({id:normal(name),name,children:children.flatMap(([label,nwName=label,wwName=nwName])=>{
  const a=n.find(x=>normal(x.name)===normal(nwName)),b=w.find(x=>normal(x.name)===normal(wwName));
  return a&&b?[{id:normal(name+' '+label),name:label,sources:{newworld:{path:a.path},woolworths:{key:b.key,path:b.path}}}]:[];
 })})).filter(d=>d.children.length);
}
function recommendationQuery(p){
 const words=productWords(p),types=['milk','bread','butter','eggs','coffee','rice','pasta','yoghurt','cheese','chicken','beef','tuna','flour','sugar','tea','apples','bananas'];
 const type=types.find(w=>words.includes(w));
 if(type==='chicken'||type==='beef')return [type,...words.filter(w=>['breast','thigh','mince','steak'].includes(w))].join(' ');
 return type||p.categories?.at(-1)||words.slice(0,3).join(' ');
}
function rankSimilar(source,products){
 const words=productWords(source),cats=new Set(source.categories||[]);
 return products.filter(p=>!(p.retailer===source.retailer&&p.id===source.id)&&p.available&&!p.restricted&&p.unit===source.unit).map(p=>{
  const other=productWords(p),overlap=words.filter(w=>other.includes(w)).length;
  const category=(p.categories||[]).filter(c=>cats.has(c)).length;
  return {product:p,score:overlap/Math.max(words.length,other.length,1)*10+category*2+(p.size===source.size?1:0)+(houseBrand(p)?0.25:0)};
 }).filter(x=>x.score>=2).sort((a,b)=>b.score-a.score||a.product.cents-b.product.cents).slice(0,24).map(x=>x.product);
}
module.exports={departments,recommendationQuery,rankSimilar};
