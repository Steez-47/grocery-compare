import React,{useEffect,useMemo,useRef,useState} from 'react';
import {ArrowRight,RefreshCw,Sparkles,Tag} from 'lucide-react';
import type {Aisle,Product,Row,State} from './types';
function FeedItem({row,children,hidden}:{row:Row;children:React.ReactNode;hidden:boolean}){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(hidden)return;const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.intersectionRatio>=0.25)){window.grocery.track({type:'impression',products:[row.product]}).catch(()=>{});observer.disconnect()}},{threshold:0.25});if(ref.current)observer.observe(ref.current);return()=>observer.disconnect()},[row.key,hidden]);
 return <div ref={ref} className="feed-item">{children}</div>;
}
export const HomeFeed=React.memo(function HomeFeed({state,hidden,epoch,onChoose,renderCard}:{state:State;hidden:boolean;epoch:number;onChoose:(a:Aisle)=>void;renderCard:(r:Row,aisleId?:string)=>React.ReactNode}){
 const [plan,setPlan]=useState<Aisle[]>([]),[pages,setPages]=useState<Record<string,{products:Product[];partial:boolean}>>({}),[tab,setTab]=useState<'recommended'|'deals'>('recommended'),[limit,setLimit]=useState(24),[aisleLimit,setAisleLimit]=useState(8),[refresh,setRefresh]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState(''),[rows,setRows]=useState<Row[]>([]),[ranking,setRanking]=useState(false);
 const stores=useMemo(()=>state.stores,[state.stores.newworld?.id,state.stores.woolworths?.id]);
 useEffect(()=>{let cancelled=false;setPlan([]);setPages({});setRows([]);setLimit(24);setAisleLimit(8);setError('');setLoading(true);window.grocery.feedPlan(stores).then(p=>{if(!cancelled){setPlan(p.slice(0,24));if(!p.length)setLoading(false)}}).catch(e=>{if(!cancelled){setError(e.message);setLoading(false)}});return()=>{cancelled=true}},[stores,epoch,refresh]);
 useEffect(()=>{if(!plan.length)return;let cancelled=false;setLoading(true);setError('');const pending=plan.slice(0,aisleLimit).filter(a=>!pages[a.id]);let cursor=0;const batch:typeof pages={};let failures=0;
  async function worker(){while(cursor<pending.length&&!cancelled){const aisle=pending[cursor++];try{batch[aisle.id]=await window.grocery.homeCandidates(aisle.id,stores);if(!cancelled)setPages(old=>({...old,[aisle.id]:batch[aisle.id]}))}catch{failures++}}}
  Promise.all([worker(),worker()]).then(()=>{if(cancelled)return;setPages(old=>({...old,...batch}));setLoading(false);if(failures)setError(`${failures} aisle${failures===1?'':'s'} could not be loaded. You can retry to check them again.`)});return()=>{cancelled=true};
 },[plan,aisleLimit,stores]);
 const products=useMemo(()=>Object.values(pages).flatMap(p=>p.products),[pages]);
 useEffect(()=>{let cancelled=false;setRanking(true);window.grocery.homeRank(products,tab==='deals',limit,state.loyalty,state.basket.flatMap(l=>Object.values(l.offers) as Product[])).then(r=>{if(!cancelled)setRows(r)}).catch(e=>{if(!cancelled)setError(e.message)}).finally(()=>{if(!cancelled)setRanking(false)});return()=>{cancelled=true}},[products,tab,limit,state.loyalty.newworld,state.loyalty.woolworths,state.basket]);
 const partial=Object.values(pages).some(p=>p.partial),canExplore=aisleLimit<plan.length,canMore=limit<240&&(rows.length>=limit||canExplore);
 return <div className="home-feed" hidden={hidden}>
  <div className="discovery-intro"><span className="discovery-eyebrow">YOUR EVERYDAY SHOP, WITH A LITTLE INSPIRATION</span><h2>Find your next favourites.</h2><p>A fresh mix of essentials, treats and ideas from your selected stores.</p></div>
  <div className="discovery-toolbar"><div className="discovery-tabs" aria-label="Home feed"><button aria-pressed={tab==='recommended'} onClick={()=>{setTab('recommended');setRows([]);setLimit(24)}}><Sparkles size={16}/>Recommended</button><button aria-pressed={tab==='deals'} onClick={()=>{setTab('deals');setRows([]);setLimit(24)}}><Tag size={16}/>Best deals</button></div><button className="icon-button" aria-label="Refresh recommendations" disabled={loading} onClick={()=>setRefresh(v=>v+1)}><RefreshCw size={16}/></button></div>
  <div className="discovery-caption"><p>{tab==='deals'?'Biggest percentage savings among the products loaded. Member deals follow your store settings.':'Picked across aisles, with variety and your shopping activity in mind.'}</p><small>{Object.keys(pages).length?`${Object.keys(pages).length} aisles explored`:''}</small></div>
  {tab==='deals'&&<p className="deal-scope">Store specials without a previous price appear after verified discounts. This is a selection, not every store deal.</p>}
  {(error||partial)&&<div className="feed-notice" role="status"><span>{error||'Some store results are unavailable. Showing the products we could load.'}</span><button onClick={()=>setRefresh(v=>v+1)} disabled={loading}>Retry</button></div>}
  <div className="discovery-products" aria-label={tab==='deals'?'Best deals':'Recommended products'} aria-busy={loading||ranking}>{rows.map(row=><FeedItem key={row.key} row={row} hidden={hidden}>{renderCard(row)}</FeedItem>)}</div>
  {(loading||ranking)&&<div className="discovery-loading" role="status"><RefreshCw size={16} className="spin"/>{rows.length?'Finding more variety…':'Finding picks across your stores…'}</div>}
  {!loading&&!ranking&&!rows.length&&!error&&<div className="discovery-empty"><h3>{tab==='deals'?'No eligible specials found yet':'More inspiration is an aisle away'}</h3><p>{tab==='deals'?'Explore more aisles to check for deals at your stores.':'Explore more aisles, or browse a category below.'}</p></div>}
  {!loading&&canMore&&<button className="more" onClick={()=>{setLimit(v=>Math.min(240,v+24));if(canExplore)setAisleLimit(v=>v+8)}}>{tab==='deals'?'Discover more deals':'Discover more picks'}<ArrowRight size={15}/></button>}
  {!!plan.length&&<div className="discovery-aisles"><h3>Explore an aisle</h3><div>{plan.slice(0,8).map(a=><button key={a.id} onClick={()=>onChoose(a)}>{a.name}<ArrowRight size={13}/></button>)}</div></div>}
 </div>;
});
