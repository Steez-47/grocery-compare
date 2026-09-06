import React,{useState} from 'react';
import {ChevronDown,Plus,ShoppingBag,Check} from 'lucide-react';
import model from '../electron/model.cjs';
import pricing from '../electron/pricing.cjs';
import {Quantity} from './Quantity';
import type {Row,Retailer,Product,State} from './types';
const names={newworld:'New World',woolworths:'Woolworths'};
const money=(c:number|null)=>c===null?'Unavailable':`$${(c/100).toFixed(2)}`;
export function ProductCard({row,state,onAdd,onSimilar,onMatch,onSeparate}:{row:Row;state:State;onAdd:(row:Row,r?:Retailer,quantity?:number)=>void;onSimilar?:(p:Product)=>void;onMatch?:(row:Row)=>void;onSeparate?:(row:Row)=>void}){
 const rules=model.quantityRules(row),[quantity,setQuantity]=useState<number>(rules.min),[valid,setValid]=useState(true),[failed,setFailed]=useState(false);
 const selected=model.selectOffer({...row,quantity,preferred:'cheapest'},'cheapest',state.loyalty) as Product|null;
 const product=selected||row.product,paired=Object.keys(row.offers).length===2;
 const inBasket=state.basket.find(l=>Object.values(l.offers).some(p=>Object.values(row.offers).some(o=>o?.id===p?.id&&o?.retailer===p?.retailer)));
 const total=selected?model.linePrice(selected,quantity,state.loyalty[selected.retailer]):null;
 const available=Object.values(row.offers).filter(p=>p&&p.available&&model.linePrice(p,quantity,state.loyalty[p.retailer])!==null);
 const atLimit=!!inBasket&&inBasket.quantity+quantity>rules.max;
 return <article className="product-row">
  <div className="product-row-main"><div className="row-picture">{!failed&&product.image?<img src={product.image} alt="" loading="lazy" onError={()=>setFailed(true)}/>:<ShoppingBag size={27}/>}</div>
   <div className="row-description"><span className="row-brand">{product.brand||'Fresh groceries'}</span><h3>{product.name}</h3><p>{product.size|| (product.unit==='kg'?'Loose · sold by weight':'Each')}{row.equivalent&&<span className="equivalent-label"> · Equivalent products</span>}</p>{inBasket&&<small className="in-basket"><Check size={12}/>{inBasket.quantity}{product.unit==='kg'?' kg':''} in your list</small>}</div>
   <div className="row-price"><strong>{money(total)}{product.unit==='kg'&&total!==null&&<small> est.</small>}</strong><span className={'price-store '+(selected?.retailer||'')}>{selected?names[selected.retailer]:'Unavailable'}</span><small>{selected&&(selected.member||selected.memberPriceStatus==='unavailable')?pricing.priceLabel(selected,state.loyalty[selected.retailer]):''}</small><small>{product.unit==='kg'?`${money(selected?model.effectivePrice(selected,state.loyalty[selected.retailer]):null)} / kg`:selected?pricing.effectiveUnitPrice(selected,state.loyalty[selected.retailer]):''}</small></div>
   <div className="row-buy"><Quantity value={quantity} rules={rules} name={product.name} onChange={setQuantity} onValidity={setValid}/><button className="primary row-add" disabled={!selected||selected.restricted||!valid||atLimit} aria-label={`Add ${product.name} at cheapest price`} onClick={()=>onAdd(row,undefined,quantity)}><Plus size={16}/>{product.restricted?'18+':atLimit?'At limit':'Add'}</button></div>
  </div>
  <details className="row-comparison"><summary>{available.length===2?'Compare 2 stores':selected?'1 store available':'Check store availability'}<ChevronDown size={13}/></summary><div className="comparison-content">{(['newworld','woolworths'] as Retailer[]).map(r=>{const p=row.offers[r];return <div className="comparison-offer" key={r}><span className={'store-badge '+r}>{r==='newworld'?'NW':'W'}</span><div><strong>{names[r]}</strong><small>{p?p.name:'No matching product found'}</small></div><span>{p&&p.available?money(model.linePrice(p,quantity,state.loyalty[r])):'Unavailable'}</span></div>})}<div className="comparison-actions">{onSimilar&&<button onClick={()=>onSimilar(product)}>Similar items</button>}{onMatch&&<button onClick={()=>onMatch(row)}>Find a match</button>}{paired&&onSeparate&&<button onClick={()=>onSeparate(row)}>These aren't the same</button>}</div></div></details>
 </article>;
}
