import React from 'react';
import {ArrowRight,Check,ChevronDown,Download,Minus,PanelRightClose,Plus,RefreshCw,ShoppingBag,X} from 'lucide-react';
import model from '../electron/model.cjs';
import type {Policy,Product,Retailer,Row,State} from './types';

const retailers:Retailer[]=['newworld','woolworths'];
const names={newworld:'New World',woolworths:'Woolworths',cheapest:'Best prices across stores'};
const money=(c:number|null)=>c===null?'Unavailable':new Intl.NumberFormat('en-NZ',{style:'currency',currency:'NZD'}).format(c/100);
type Props={state:State;hidden:boolean;refreshing:boolean;stale:boolean;onChange:React.Dispatch<React.SetStateAction<State>>;onQuantity:(key:string,delta:number)=>void;onCompare:(row:Row)=>void;onRefresh:()=>void;onCheckout:()=>void;onCollapse:()=>void;onExport:()=>void};

export function Cart({state,hidden,refreshing,stale,onChange,onQuantity,onCompare,onRefresh,onCheckout,onCollapse,onExport}:Props){
 const summary=model.basketSummary(state.basket,state.policy,state.loyalty);
 const pinned=state.policy==='cheapest'&&state.basket.some(l=>l.preferred!=='cheapest');
 const setPolicy=(policy:Policy)=>onChange(s=>({...s,policy}));
 return <aside id="shopping-basket" className="basket" hidden={hidden} aria-label="Shopping basket">
  <div className="basket-heading"><div><h2>Your basket <span>{state.basket.length}</span></h2><p>{state.basket.length?`${state.basket.length} product${state.basket.length===1?'':'s'} on your list`:'Ready for your next shop'}</p></div><div className="basket-tools"><button className="icon-button" title="Export shopping list" aria-label="Export shopping list" disabled={!state.basket.length} onClick={onExport}><Download size={17}/></button><button className="icon-button" title="Collapse basket" aria-label="Collapse basket" onClick={onCollapse}><PanelRightClose size={19}/></button></div></div>
  {!state.basket.length?<div className="basket-empty"><span className="empty-basket-icon"><ShoppingBag size={30} strokeWidth={1.5}/></span><h3>A little empty in here</h3><p>Use + on a product to add it.<br/>Your quantities and totals appear here.</p><button className="quiet" onClick={onCollapse}>Keep browsing <ArrowRight size={15}/></button></div>:<>
   <div className="shopping-mode"><label htmlFor="shopping-mode">Shop at</label><select id="shopping-mode" value={state.policy} onChange={e=>setPolicy(e.target.value as Policy)}><option value="cheapest">Best prices across stores</option>{retailers.map(r=><option key={r} value={r}>{names[r]} only</option>)}</select><p>{state.policy==='cheapest'?(pinned?'Lowest prices, keeping the item choices below.':'Each item goes to the store with the lowest price.'):`Every item is priced for ${names[state.policy]}.`}</p></div>
   <div className="basket-lines">{state.basket.map(line=>{
    const offer=model.selectOffer(line,state.policy,state.loyalty) as Product|null;
    const target=state.policy==='cheapest'?line.preferred:state.policy;
    const fallback=offer||line.offers[target as Retailer]||line.product;
    const rules=target==='cheapest'?model.quantityRules(line,fallback):fallback;
    const nextQuantity=model.fitQuantity(line.quantity+0.001,rules);
    const previousQuantity=model.fitQuantity(line.quantity,rules)-rules.step;
    const unitPrice=offer?model.effectivePrice(offer,state.loyalty[offer.retailer]):null;
    return <article className={'basket-line '+(!offer?'line-unavailable':'')} key={line.key}>
     <div className="line-body"><div className="line-title"><h3>{offer?.name||line.product.name}</h3><button className="icon-button" title="Remove item" aria-label={`Remove ${line.product.name}`} onClick={()=>onChange(s=>({...s,basket:s.basket.filter(l=>l.key!==line.key)}))}><X size={15}/></button></div>
      <div className="item-source">{offer?<><span className={'store-badge '+offer.retailer}>{offer.retailer==='newworld'?'NW':'W'}</span><span>{names[offer.retailer]}</span><span className="item-unit-price">{money(unitPrice)} / {offer.unit==='kg'?'kg':'each'}</span></>:<span>Unavailable{target!=='cheapest'?` at ${names[target]}`:' at either store'}</span>}</div>
      <div className="line-bottom"><div className="stepper"><button aria-label={`Less ${line.product.name}`} onClick={()=>onQuantity(line.key,previousQuantity<rules.min?-line.quantity:Math.round((previousQuantity-line.quantity)*1000)/1000)}><Minus size={14}/></button><span>{line.quantity}{line.product.unit==='kg'?' kg':''}</span><button aria-label={`More ${line.product.name}`} disabled={nextQuantity<=line.quantity} onClick={()=>onQuantity(line.key,Math.round((nextQuantity-line.quantity)*1000)/1000)}><Plus size={14}/></button></div><strong>{offer?money(model.linePrice(offer,line.quantity,state.loyalty[offer.retailer])):'Unavailable'}</strong></div>
      {!offer&&<p className="item-help">Try a different store or quantity, or remove this item.</p>}
      <details className="item-options"><summary>Store options <ChevronDown size={12}/></summary><div>{state.policy==='cheapest'&&<label>Buy from<select aria-label={`Store for ${line.product.name}`} value={line.preferred} onChange={e=>{const preferred=e.target.value as Policy;onChange(s=>({...s,basket:s.basket.map(l=>l.key===line.key?{...l,preferred}:l)}))}}><option value="cheapest">Automatic · lowest price</option>{retailers.filter(r=>line.offers[r]).map(r=><option value={r} key={r}>{names[r]} only</option>)}</select></label>}{state.policy!=='cheapest'&&<p>Choose “Best prices across stores” above to pick a different store for this item.</p>}<button className="text-button" onClick={()=>onCompare(line)}>Find or change a matching product <ArrowRight size={12}/></button></div></details>
     </div>
    </article>;
   })}</div>
   <div className="basket-bottom">
    <details className="store-comparison"><summary>Compare store totals <ChevronDown size={14}/></summary><p>For the quantities in your basket.</p><div className="plans">{(['cheapest',...retailers] as Policy[]).map(policy=>{
     const total=model.basketSummary(state.basket,policy,state.loyalty),complete=total.missing===0;
     return <button className={'plan '+(state.policy===policy?'chosen':'')} key={policy} aria-pressed={state.policy===policy} onClick={()=>setPolicy(policy)}><span>{policy==='cheapest'?'Across stores':names[policy]}{state.policy===policy&&<Check size={13}/>}<small>{!complete?`${total.missing} unavailable · partial total`:policy==='cheapest'&&pinned?'Keeps your item choices':'All items included'}</small></span><strong>{total.missing===state.basket.length?'Unavailable':money(total.cents)}</strong></button>;
    })}</div></details>
    <div className="basket-breakdown">{retailers.filter(r=>summary.shops[r].length).map(r=><div key={r}><span>{names[r]} <small>{summary.shops[r].length} product{summary.shops[r].length===1?'':'s'}</small></span><strong>{money(summary.shops[r].reduce((sum:number,l:{product:Product;quantity:number})=>sum+(model.linePrice(l.product,l.quantity,state.loyalty[r])??0),0))}</strong></div>)}</div>
    {(stale||summary.missing>0)&&<div className="cart-attention" role="status">{stale?'Refresh prices before continuing.':`${summary.missing} product${summary.missing===1?' needs':'s need'} attention above.`}</div>}
    <div className="total"><span>{summary.missing?'Available items subtotal':'Subtotal'}</span><strong>{money(summary.cents)}</strong></div><div className="subtotal-note">Before delivery and bag fees{state.basket.some(l=>l.product.unit==='kg')&&' · Weighed items are estimates'}</div>
    <button className="primary checkout" disabled={refreshing||stale||summary.missing>0} onClick={onCheckout}>Review & send to stores <ArrowRight size={17}/></button>
    <button className="text-button refresh-prices" onClick={onRefresh} disabled={refreshing}><RefreshCw size={12} className={refreshing?'spin':''}/>{refreshing?'Updating prices…':'Refresh prices'}</button>
   </div>
  </>}
 </aside>;
}
