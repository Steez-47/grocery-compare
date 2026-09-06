import React,{useEffect,useState} from 'react';
import {ArrowLeft,Plus,X,RefreshCw,ChevronDown} from 'lucide-react';
import model from '../electron/model.cjs';
import {ProductCard} from './ProductCard';
import type {Aisle,Department,Product,Row,State,Retailer} from './types';
export function BrowseNav({departments,active,onChoose}:{departments:Department[];active:Aisle|null;onChoose:(a:Aisle)=>void}){
 const [department,setDepartment]=useState('');
 return <nav className="browse-nav" aria-label="Browse departments">{departments.map(d=><div className="department-group" key={d.id}><button className="department-button" aria-expanded={d.id===department} onClick={()=>setDepartment(d.id===department?'':d.id)}><span className="department-dot"/>{d.name}<ChevronDown size={13}/></button>{d.id===department&&<div className="aisle-tabs">{d.children.map(a=><button key={a.id} aria-pressed={active?.id===a.id} onClick={()=>onChoose(a)}>{a.name}</button>)}</div>}</div>)}</nav>;
}
export function SimilarModal({source,state,onClose,onAdd}:{source:Product;state:State;onClose:()=>void;onAdd:(r:Row,s?:Retailer,quantity?:number)=>void}){
 const [rows,setRows]=useState<Row[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState(''),[added,setAdded]=useState('');
 useEffect(()=>{let cancelled=false;window.grocery.similar(source).then(result=>{if(!cancelled){setRows(result.rows);setError(result.partial?'Some store results could not be loaded.':'');setBusy(false)}}).catch(e=>{if(!cancelled){setError(e.message);setBusy(false)}});return()=>{cancelled=true}},[source.id,source.retailer,state.stores.newworld?.id,state.stores.woolworths?.id]);
 const money=(p:Product)=>{const c=model.effectivePrice(p,state.loyalty[p.retailer]);return c===null?'—':`${(c/100).toFixed(2)}${p.unit==='kg'?' / kg':''}`};
 return <div className="modal-backdrop"><section className="modal similar-modal"><div className="modal-heading"><h2>Similar items</h2><button className="icon-button" aria-label="Close similar items" onClick={onClose}><X/></button></div><p className="match-source">{source.name}</p><div className="similar-results">{busy?<div className="loading"><RefreshCw className="spin"/>Finding similar items…</div>:rows.map(row=><ProductCard key={row.key} row={row} state={state} onAdd={(row,r,q)=>{onAdd(row,r,q);setAdded(row.product.name)}}/>)} {!busy&&!rows.length&&<p>No similar items found.</p>}</div>{error&&<p className="error-text">{error}</p>}{added&&<div className="added-message" role="status">Added {added}</div>}</section></div>;
}
