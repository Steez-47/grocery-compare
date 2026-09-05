import React,{useEffect,useState} from 'react';
import {ArrowLeft,Plus,X,RefreshCw} from 'lucide-react';
import browse from '../electron/browse.cjs';
import model from '../electron/model.cjs';
import type {Aisle,Department,Product,Row,State,Retailer} from './types';
export function BrowseNav({departments,active,onChoose}:{departments:Department[];active:Aisle|null;onChoose:(a:Aisle)=>void}){
 const [department,setDepartment]=useState('');const selected=departments.find(d=>d.id===department);
 return <nav className="browse-nav" aria-label="Browse departments"><div className="department-tabs">{departments.map(d=><button key={d.id} aria-pressed={d.id===department} onClick={()=>setDepartment(d.id===department?'':d.id)}>{d.name}</button>)}</div>{selected&&<div className="aisle-tabs">{selected.children.map(a=><button key={a.id} aria-pressed={active?.id===a.id} onClick={()=>onChoose(a)}>{a.name}</button>)}</div>}</nav>;
}
export function SimilarModal({source,state,onClose,onAdd}:{source:Product;state:State;onClose:()=>void;onAdd:(r:Row,s:Retailer)=>void}){
 const [rows,setRows]=useState<Row[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState(''),[added,setAdded]=useState('');
 useEffect(()=>{let cancelled=false;const q=browse.recommendationQuery(source).slice(0,100);
  Promise.allSettled((['newworld','woolworths']as Retailer[]).map(r=>window.grocery.search(r,state.stores[r]!,q))).then(results=>{
   if(cancelled)return;const products=results.flatMap(r=>r.status==='fulfilled'?r.value.products:[]);setRows(model.groupProducts(browse.rankSimilar(source,products)) as Row[]);setError(results.some(r=>r.status==='rejected')?'Some store results could not be loaded.':'');setBusy(false);
  });return()=>{cancelled=true};
 },[source.id,source.retailer,state.stores.newworld?.id,state.stores.woolworths?.id]);
 const money=(p:Product)=>{const c=model.effectivePrice(p,state.loyalty[p.retailer]);return c===null?'—':`$${(c/100).toFixed(2)}`};
 return <div className="modal-backdrop"><section className="modal similar-modal"><div className="modal-heading"><h2>Similar items</h2><button className="icon-button" aria-label="Close similar items" onClick={onClose}><X/></button></div><p className="match-source">{source.name}</p><div className="similar-results">{busy?<div className="loading"><RefreshCw className="spin"/>Finding similar items…</div>:rows.map(row=><article className="similar-row" key={row.key}><img src={row.product.image} alt="" onError={e=>{e.currentTarget.style.visibility='hidden'}}/><div><h3>{row.product.name}</h3><div className="similar-offers">{Object.entries(row.offers).map(([r,value])=>{const p=value!;return <button key={r} aria-label={`Add similar ${p.name} from ${r}`} disabled={model.effectivePrice(p,state.loyalty[p.retailer])===null} onClick={()=>{onAdd(row,r as Retailer);setAdded(p.name)}}><span className={'store-badge '+r}>{r==='newworld'?'NW':'W'}</span>{money(p)}<Plus size={14}/></button>})}</div>{row.equivalent&&<small>House-brand equivalent</small>}</div></article>)}{!busy&&!rows.length&&<p>No similar items found.</p>}</div>{error&&<p className="error-text">{error}</p>}{added&&<div className="added-message" role="status">Added {added}</div>}</section></div>;
}
