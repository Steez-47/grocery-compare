import React,{useState} from 'react';
import {ArrowRight,Plus,ShoppingBag,Unlink} from 'lucide-react';
import model from '../electron/model.cjs';
import type {Row,Retailer,Product,State} from './types';
const names={newworld:'New World',woolworths:'Woolworths'};
export function ProductCard({row,state,onAdd,onSimilar,onMatch,onSeparate}:{row:Row;state:State;onAdd:(row:Row,r:Retailer)=>void;onSimilar:(p:Product)=>void;onMatch:(row:Row)=>void;onSeparate:(row:Row)=>void}){
 const [failed,setFailed]=useState(false),paired=Object.keys(row.offers).length===2;
 return <article className="product-card"><div className="picture">{!failed&&row.product.image?<img src={row.product.image} alt="" loading="lazy" onError={()=>setFailed(true)}/>:<ShoppingBag size={34}/>}</div>
 {paired&&<button className="separate-button" aria-label={`Separate comparison for ${row.product.name}`} onClick={()=>onSeparate(row)}><Unlink size={13}/></button>}
 <div className="product-name"><span>{row.product.brand||'Groceries'}</span><h3>{row.product.name}</h3>{row.equivalent&&<small className="equivalent-badge">Equivalent</small>}</div>
 <div className="offer-list">{(['newworld','woolworths']as Retailer[]).map(r=>{const p=row.offers[r],c=p?model.effectivePrice(p,state.loyalty[r]):null;return <div className={'offer '+(!p?'missing':'')} key={r}><span className={'store-badge '+r}>{r==='newworld'?'NW':'W'}</span><div className="offer-price">{p?<><strong>{c===null?'—':`$${(c/100).toFixed(2)}`}{p.unit==='kg'&&<small> / kg</small>}</strong><span>{row.equivalent?p.name:p.member?'Member price':p.unitPrice||'Each'}</span></>:<button className="find-match" onClick={()=>onMatch(row)}>Find match</button>}</div>{p&&<button className="add-button" aria-label={`Add ${p.name} from ${names[r]}`} disabled={!p.available||p.restricted||c===null} onClick={()=>onAdd(row,r)}>{p.restricted?'18+':!p.available?'—':<Plus size={19}/>}</button>}</div>})}</div>
 <button className="similar-button" onClick={()=>onSimilar(row.product)}>Similar items<ArrowRight size={13}/></button></article>;
}
