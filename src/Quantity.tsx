import React,{useEffect,useState} from 'react';
import {Minus,Plus} from 'lucide-react';
import model from '../electron/model.cjs';
import type {Product} from './types';

export function Quantity({value,rules,name,onChange,onValidity}:{value:number;rules:Product;name:string;onChange:(value:number)=>void;onValidity?:(valid:boolean)=>void}){
 const [unit,setUnit]=useState<'kg'|'g'>('kg');
 const scale=rules.unit==='kg'&&unit==='g'?1000:1;
 const [draft,setDraft]=useState(String(value*scale)),[error,setError]=useState('');
 useEffect(()=>{setDraft(String(Number((value*scale).toFixed(3))));setError('');onValidity?.(true)},[value,scale,rules.min,rules.max,rules.step]);
 function commit(){
  const next=Number(draft)/scale;
  if(!draft.trim()||!model.validateQuantity(next,rules)){setError(`Use ${rules.min*scale}–${rules.max*scale}, in steps of ${rules.step*scale}${rules.unit==='kg'?' '+unit:''}.`);onValidity?.(false);return;}
  setError('');onValidity?.(true);onChange(next);
 }
 function step(direction:number){const next=model.fitQuantity(value+direction*rules.step,rules);setDraft(String(Number((next*scale).toFixed(3))));setError('');onValidity?.(true);onChange(next)}
 return <div className="quantity-control"><div className={'quantity-input '+(error?'invalid':'')}>
  <button type="button" aria-label={`Less ${name}`} disabled={value<=rules.min} onClick={()=>step(-1)}><Minus size={14}/></button>
  <input aria-label={`${rules.unit==='kg'?'Weight':'Quantity'} for ${name}`} aria-invalid={!!error} title={error||`Minimum ${rules.min}, step ${rules.step}, maximum ${rules.max}`} type="text" inputMode={rules.unit==='kg'?'decimal':'numeric'} value={draft} onChange={e=>{setDraft(e.target.value);onValidity?.(model.validateQuantity(Number(e.target.value)/scale,rules)&&!!e.target.value.trim())}} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();commit()}if(e.key==='Escape'){setDraft(String(value*scale));setError('');onValidity?.(true)}}}/>
  {rules.unit==='kg'&&<select aria-label={`Weight unit for ${name}`} value={unit} onChange={e=>setUnit(e.target.value as 'kg'|'g')}><option value="kg">kg</option><option value="g">g</option></select>}
  <button type="button" aria-label={`More ${name}`} disabled={value>=rules.max} onClick={()=>step(1)}><Plus size={14}/></button>
 </div>{error&&<small className="quantity-error" role="alert">{error}</small>}</div>
}
