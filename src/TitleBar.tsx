import React,{useEffect,useState} from 'react';
import {ShoppingBasket,Settings,Minus,Square,Copy,X} from 'lucide-react';
import {ThemeControl} from './ThemeControl';


export function TitleBar({onSettings}:{onSettings:()=>void}){
 const [maximized,setMaximized]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  const off=window.grocery.onWindowState(s=>setMaximized(s.maximized));
  window.grocery.windowState().then(s=>setMaximized(s.maximized)).catch(e=>setError(e.message));
  return off;
 },[]);
 const control=(action:'minimize'|'maximize'|'close')=>window.grocery.windowControl(action).catch(e=>setError(e.message));
 return <header className="titlebar">
  <div className="titlebar-brand"><ShoppingBasket size={16}/><span>Grocery Compare</span></div>
  <div className="titlebar-actions"><button className="icon-button" aria-label="Settings" title="Settings" onClick={onSettings}><Settings size={17}/></button><ThemeControl/>
   <span className="titlebar-divider"/>
   <button className="window-button" aria-label="Minimize window" title="Minimize" onClick={()=>control('minimize')}><Minus size={16}/></button>
   <button className="window-button" aria-label={maximized?'Restore window':'Maximize window'} title={maximized?'Restore':'Maximize'} onClick={()=>control('maximize')}>{maximized?<Copy size={13}/>:<Square size={13}/>}</button>
   <button className="window-button window-close" aria-label="Close window" title="Close" onClick={()=>control('close')}><X size={17}/></button>
  </div>{error&&<span role="alert" className="window-error" onClick={()=>setError('')}>{error}</span>}
 </header>;
}
