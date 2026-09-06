import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ShoppingBasket,Search,MapPin,ChevronDown,Plus,Minus,X,ArrowLeft,ArrowRight,RefreshCw,Check,ShoppingBag,Download,SlidersHorizontal,Store as StoreIcon} from 'lucide-react';
import model from '../electron/model.cjs';
import pricing from '../electron/pricing.cjs';
import searchEngine from '../electron/search.cjs';
import {BrowseNav,SimilarModal} from './Browse';
import {HomeFeed} from './HomeFeed';
import {ProductCard} from './ProductCard';
import {ThemeControl} from './ThemeControl';
import {BrowserSetup} from './BrowserSetup';
import {Checkout} from './Checkout';
import {Cart} from './Cart';
import type {State,Retailer,Policy,Store,Product,Row,Line,Department,Aisle} from './types';
import './style.css';
import './browse.css';
import './feed.css';
import './theme.css';
import './cart.css';
import './shopping.css';
const {groupProducts,effectivePrice,basketSummary}=model;
const names={newworld:'New World',woolworths:'Woolworths'};
const retailers:Retailer[]=['newworld','woolworths'];
const dollars=(c:number|null)=>c===null?'—':new Intl.NumberFormat('en-NZ',{style:'currency',currency:'NZD'}).format(c/100);
const empty:State={version:1,stores:{newworld:null,woolworths:null},loyalty:{newworld:true,woolworths:true},basket:[],policy:'cheapest'};
function Badge({r}:{r:Retailer}){return <span className={'store-badge '+r}>{r==='newworld'?'NW':'W'}</span>}
function Picture({p}:{p:Product}){const [failed,setFailed]=useState(false);return <div className="picture">{!failed&&p.image?<img src={p.image} alt="" loading="lazy" onError={()=>setFailed(true)}/>:<ShoppingBag size={34}/>}</div>}
function App(){
 const [state,setState]=useState<State>(empty),[loaded,setLoaded]=useState(false),[query,setQuery]=useState(''),[searched,setSearched]=useState('');
 const [rows,setRows]=useState<Row[]>([]),[busy,setBusy]=useState(false),[errors,setErrors]=useState<Partial<Record<Retailer,string>>>({});
 const [pages,setPages]=useState<Record<Retailer,number|null>>({newworld:0,woolworths:0}),[hasMore,setHasMore]=useState(false);
 const [browserSetup,setBrowserSetup]=useState(false);
 const [basketCollapsed,setBasketCollapsed]=useState(()=>{try{return localStorage.getItem('grocery.basketCollapsed')==='true'}catch{return false}});
 const basketToggle=useRef<HTMLButtonElement>(null);
 function toggleBasket(collapsed:boolean){setBasketCollapsed(collapsed);try{localStorage.setItem('grocery.basketCollapsed',String(collapsed))}catch{}if(collapsed)basketToggle.current?.focus();}
 const [storeModal,setStoreModal]=useState(false),[match,setMatch]=useState<Row|null>(null),[checkout,setCheckout]=useState(false);
 const [browser,setBrowser]=useState<{retailer:Retailer|null;url:string;loading:boolean}>({retailer:null,url:'',loading:false});
 const [notice,setNotice]=useState(''),[sort,setSort]=useState('relevance');
 const [refreshing,setRefreshing]=useState(false),[sending,setSending]=useState<Retailer|null>(null);
 const [,setClock]=useState(0);const [homeEpoch,setHomeEpoch]=useState(0);
 const [departments,setDepartments]=useState<Department[]>([]),[aisle,setAisle]=useState<Aisle|null>(null),[similar,setSimilar]=useState<Product|null>(null);
 const [brandFilter,setBrandFilter]=useState(''),[onlyHouse,setOnlyHouse]=useState(false),[onlySpecial,setOnlySpecial]=useState(false),[onlyStock,setOnlyStock]=useState(false);
 const requestId=useRef(0),lastProducts=useRef<Product[]>([]),stateRef=useRef(state),saveTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 stateRef.current=state;
 useEffect(()=>{window.grocery.load().then(s=>{setState(s);setLoaded(true);if(!s.stores.newworld||!s.stores.woolworths)setStoreModal(true)}).catch(e=>setNotice(e.message));return window.grocery.onStoreStatus(setBrowser)},[]);
 useEffect(()=>{if(!loaded)return;window.grocery.save(state).catch(e=>setNotice('Could not save your basket: '+e.message));},[state,loaded]);
 useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),8000);return()=>clearTimeout(t)},[notice]);
 useEffect(()=>{const t=setInterval(()=>setClock(c=>c+1),60000);return()=>clearInterval(t)},[]);
 const ready=retailers.every(r=>state.stores[r]);
 useEffect(()=>{let cancelled=false;if(ready)window.grocery.departments(state.stores).then(d=>{if(!cancelled)setDepartments(d)}).catch(e=>{if(!cancelled)setNotice(e.message)});return()=>{cancelled=true}},[state.stores.newworld?.id,state.stores.woolworths?.id]);
 async function search(q=query,more=false,browseAisle:Aisle|null=more?aisle:null){
  q=q.trim();if(!q&&!browseAisle)return;if(!ready){setStoreModal(true);return;}
  const id=++requestId.current;setBusy(true);setErrors({});setSearched(browseAisle?.name||q);setQuery(q);setAisle(browseAisle);if(!more)setBrandFilter('');
  if(!more){lastProducts.current=[];setRows([]);setPages({newworld:0,woolworths:0});}
  if(!more)window.grocery.track({type:'browse',aisle:browseAisle?.id,query:q}).catch(()=>{});
  const nextPages:Record<Retailer,number|null>={newworld:more?pages.newworld:0,woolworths:more?pages.woolworths:0};
  const results=await Promise.allSettled(retailers.map(r=>nextPages[r]===null?Promise.resolve(null):window.grocery.search(r,state.stores[r]!,q,nextPages[r]!,false,browseAisle?{category:browseAisle.sources[r]}:{})));
  if(id!==requestId.current)return;
  const products:Product[]=more?[...lastProducts.current]:[];const errs:Partial<Record<Retailer,string>>={};let moreAvailable=false;
  results.forEach((result,i)=>{const r=retailers[i];if(result.status==='fulfilled'){if(!result.value)return;products.push(...result.value.products);nextPages[r]=result.value.nextPage!==undefined?result.value.nextPage:(result.value.pages>nextPages[r]!+1?nextPages[r]!+1:null);moreAvailable||=nextPages[r]!==null;}else{errs[r]=result.reason.message;moreAvailable=true;}});
  const unique=[...new Map(products.map(p=>[p.retailer+':'+p.id,p])).values()];lastProducts.current=unique;
  try{const compared=await window.grocery.compare(unique);if(id!==requestId.current)return;setRows(browseAisle?compared:searchEngine.rankRows(compared,q));setErrors(errs);setPages(nextPages);setHasMore(moreAvailable);}catch(e){if(id===requestId.current)setErrors({newworld:`Could not compare products. ${(e as Error).message}`})}finally{if(id===requestId.current)setBusy(false)}
 }
 function add(row:Row,r?:Retailer,recommendationAisle?:string,quantity=model.quantityRules(row).min){const p=model.selectOffer({...row,quantity,preferred:r||'cheapest'},'cheapest',state.loyalty) as Product|null;if(!p)return;window.grocery.track({type:'add',product:p,aisle:recommendationAisle||aisle?.id}).catch(()=>{});
  if(basketCollapsed)setNotice(`Added ${p.name} to your basket.`);
  setState(s=>model.addToBasket(s,row,quantity,r||'cheapest'));
 }
 function changeQty(key:string,delta:number){setState(s=>({...s,basket:s.basket.map(l=>l.key===key?{...l,quantity:Math.round((l.quantity+delta)*1000)/1000}:l).filter(l=>l.quantity>0)}))}
 async function refreshBasket(){
  if(!ready)return;setRefreshing(true);const snapshot=stateRef.current;let failures=0;
  const updated:Line[]=[];
  for(const line of snapshot.basket){const offers:Row['offers']={};
   for(const r of retailers){const previous=line.offers[r];if(!previous)continue;
    try{const data=await window.grocery.search(r,snapshot.stores[r]!,[previous.brand,previous.name.replace(previous.brand,'').replace(previous.size,'')].join(' ').trim().slice(0,100),0,true);let p=data.products.find(p=>p.id===previous.id);if(!p)p=data.products.find(p=>p.name.toLowerCase()===previous.name.toLowerCase()&&p.unit===previous.unit);if(p)offers[r]=p;else failures++;}catch{offers[r]={...previous,checkedAt:'1970-01-01T00:00:00Z'};failures++;}
   }
   updated.push({...line,offers,product:Object.values(offers)[0]||line.product});
  }
  setState(s=>retailers.some(r=>s.stores[r]?.id!==snapshot.stores[r]?.id)?s:({...s,basket:s.basket.map(l=>{const u=updated.find(x=>x.key===l.key);return u?{...u,quantity:l.quantity,preferred:l.preferred}:l})}));setRefreshing(false);if(failures)setNotice(`${failures} price(s) unavailable. Choose another item or try again.`);
 }
 async function openStore(r:Retailer){await window.grocery.save(stateRef.current);try{await window.grocery.openStore(r);}catch(e){setNotice((e as Error).message)}}
 async function send(r:Retailer){setSending(r);try{await window.grocery.save(stateRef.current);const result=await window.grocery.transfer(r);setNotice(`${result.count} items verified in ${names[r]}.${result.messages.length?' '+result.messages.join(' '):''}`);}catch(e){setNotice((e as Error).message)}finally{setSending(null)}}
 const summary=basketSummary(state.basket,state.policy,state.loyalty);

 const brands=[...new Set(rows.flatMap(row=>Object.values(row.offers).map(p=>p!.brand)).filter(Boolean))].sort();
 const shown=rows.filter(row=>Object.values(row.offers).some(p=>p&&(!brandFilter||p.brand===brandFilter)&&(!onlyHouse||model.houseBrand(p))&&(!onlySpecial||p.special)&&(!onlyStock||p.available))).sort((a,b)=>{if(sort==='relevance')return 0;const price=(r:Row)=>Math.min(...Object.values(r.offers).map(p=>effectivePrice(p,state.loyalty[p!.retailer])??Infinity));return sort==='low'?price(a)-price(b):a.product.name.localeCompare(b.product.name)});
 function home(){requestId.current++;setSearched('');setQuery('');setRows([]);setAisle(null);setBusy(false);setHomeEpoch(v=>v+1);document.querySelector('.shop')?.scrollTo({top:0})}
 async function separate(row:Row){const a=row.offers.newworld,b=row.offers.woolworths;if(!a||!b)return;await window.grocery.matchFeedback(a,b,false);setRows(rs=>rs.flatMap(r=>r.key===row.key?Object.values(r.offers).map(p=>({key:p!.retailer+':'+p!.id,product:p!,offers:{[p!.retailer]:p!}})): [r]));setState(s=>({...s,basket:s.basket.map(l=>{if(l.offers.newworld?.id!==a.id||l.offers.woolworths?.id!==b.id)return l;const chosen=model.selectOffer(l,s.policy,s.loyalty)||l.product;return {...l,product:chosen,offers:{[chosen.retailer]:chosen},equivalent:false}})}));setHomeEpoch(v=>v+1);setNotice('Comparison separated. This choice is remembered.');}
 const renderCard=(row:Row,recommendationAisle?:string)=><ProductCard row={row} state={state} onAdd={(row,r,q)=>add(row,r,recommendationAisle,q)} onSimilar={p=>{window.grocery.track({type:'view',product:p,aisle:recommendationAisle||aisle?.id}).catch(()=>{});setSimilar(p)}} onMatch={setMatch} onSeparate={row=>separate(row).catch(e=>setNotice(e.message))}/>;
 const stale=state.basket.some(l=>Object.values(l.offers).some(p=>p?.storeId!==state.stores[p!.retailer]?.id||Date.now()-Date.parse(p!.checkedAt)>30*60*1000));
 if(browser.retailer)return <div className="store-shell"><header className="browser-bar"><button className="back" onClick={async()=>{await window.grocery.closeStore();setBrowser({retailer:null,url:'',loading:false})}}><ArrowLeft size={18}/> Back to basket</button><Badge r={browser.retailer}/><strong>{names[browser.retailer]}</strong><span className="browser-address">{(()=>{try{return new URL(browser.url).hostname}catch{return 'Loading…'}})()}</span><button className="icon-button" aria-label="Reload store" onClick={()=>window.grocery.navigate('reload')}><RefreshCw size={18} className={browser.loading?'spin':''}/></button><button onClick={()=>window.grocery.navigate('cart')}>Store cart</button></header>{notice&&<div className="toast browser-toast">{notice}</div>}</div>;
 return <div className="app"><header className="topbar"><div className="brand"><span className="brand-icon"><ShoppingBasket size={24}/></span><span>Grocery Compare</span></div><div className="stores">{retailers.map(r=><button key={r} className="store-picker" onClick={()=>setStoreModal(true)}><Badge r={r}/><span>{state.stores[r]?.name||'Choose store'}</span><ChevronDown size={14}/></button>)}<ThemeControl/><button ref={basketToggle} className="basket-toggle" aria-label={basketCollapsed?"Open basket":"Collapse basket"} aria-expanded={!basketCollapsed} aria-controls="shopping-basket" onClick={()=>toggleBasket(!basketCollapsed)}><ShoppingBasket size={17}/><span>Basket</span><span className="basket-count">{state.basket.length}</span>{!!state.basket.length&&<strong>{summary.missing>0?"Partial ":""}{dollars(summary.cents)}</strong>}</button></div></header>
 <div className={"workspace "+(basketCollapsed?"basket-closed":"")}><aside className="department-sidebar"><button className="all-groceries" onClick={home}><ShoppingBag size={18}/> All groceries</button><p className="nav-label">SHOP BY AISLE</p><BrowseNav departments={departments} active={aisle} onChoose={a=>search('',false,a)}/><button className="manage-stores" onClick={()=>setStoreModal(true)}><SlidersHorizontal size={15}/> Manage stores</button></aside><main className="shop"><div className="shop-heading"><h1>{searched||'Groceries'}</h1></div>
 <form className="search" onSubmit={e=>{e.preventDefault();search()}}><Search size={23}/><input aria-label="Search groceries" placeholder="Search for milk, bread, apples…" value={query} onChange={e=>setQuery(e.target.value)} maxLength={100}/>{query&&<button type="button" className="icon-button" aria-label="Clear search" onClick={()=>setQuery('')}><X size={17}/></button>}<button className="primary" type="submit" disabled={busy}>Search</button></form>
 {searched&&<button className="back-to-browse" onClick={home}><ArrowLeft size={16}/> Browse</button>}
 {searched&&<div className="browse-filters"><span className="loaded-count">{searched} · {shown.length} loaded</span><select aria-label="Filter by brand" value={brandFilter} onChange={e=>setBrandFilter(e.target.value)}><option value="">All brands</option>{brands.map(b=><option key={b}>{b}</option>)}</select><button aria-pressed={onlyHouse} onClick={()=>setOnlyHouse(v=>!v)}>House brands</button><button aria-pressed={onlySpecial} onClick={()=>setOnlySpecial(v=>!v)}>Specials</button><button aria-pressed={onlyStock} onClick={()=>setOnlyStock(v=>!v)}>In stock</button></div>}
 {searched&&<div className="result-toolbar"><span className="result-label">{shown.length} products</span><select aria-label="Sort products" value={sort} onChange={e=>setSort(e.target.value)}><option value="relevance">Relevance</option><option value="low">Lowest price</option><option value="name">A to Z</option></select></div>}
 {ready&&<HomeFeed state={state} hidden={!!searched} epoch={homeEpoch} onChoose={a=>search('',false,a)} renderCard={renderCard}/>}
 {retailers.map(r=>errors[r]&&<div className="inline-error" key={r}><Badge r={r}/><span>{errors[r]}</span><button onClick={()=>openStore(r)}>Open store</button></div>)}
 {!searched?null:<>
 <div className="product-list" aria-label="Grocery search results">{shown.map(row=><React.Fragment key={row.key}>{renderCard(row)}</React.Fragment>)}</div>
 {busy&&<div className="loading"><RefreshCw size={21} className="spin"/> Finding your groceries…</div>}{!busy&&!shown.length&&!Object.keys(errors).length&&<div className="welcome"><Search size={42}/><h2>{hasMore?"No matches on these pages":"No products found"}</h2><p>{hasMore?"Check more results from your stores.":"Try another product name or remove a size or pack count."}</p></div>}{hasMore&&!busy&&<button className="more" onClick={()=>search(aisle?'':searched,true)}>Show more</button>}</>}
 </main><Cart state={state} hidden={basketCollapsed} refreshing={refreshing} stale={stale} onChange={setState} onQuantity={changeQty} onCompare={setMatch} onRefresh={refreshBasket} onCheckout={()=>setCheckout(true)} onCollapse={()=>toggleBasket(true)} onExport={()=>window.grocery.exportList().catch(e=>setNotice(e.message))}/></div>
 {storeModal&&<StoreModal state={state} onBrowser={()=>setBrowserSetup(true)} onClose={()=>{setStoreModal(false);setHomeEpoch(v=>v+1)}} onSave={async stores=>{try{await window.grocery.save({...state,stores});requestId.current++;setState(s=>({...s,stores}));setStoreModal(false);setRows([]);setSearched('');setAisle(null);lastProducts.current=[];setBusy(false);setHomeEpoch(v=>v+1);}catch(e){setNotice((e as Error).message)}}} onLoyalty={(r,value)=>setState(s=>({...s,loyalty:{...s.loyalty,[r]:value}}))}/>}
 {match&&<MatchModal row={match} state={state} onClose={()=>setMatch(null)} onChoose={async p=>{try{await window.grocery.matchFeedback(match.product,p,true);setHomeEpoch(v=>v+1);const update=(row:Row)=>({...row,offers:{...row.offers,[p.retailer]:p}});setRows(rs=>rs.map(r=>r.key===match.key?update(r):r));setState(s=>({...s,basket:s.basket.map(l=>l.key===match.key?{...l,...update(l)}:l)}));setMatch(null)}catch(e){setNotice((e as Error).message)}}}/>}
 {similar&&<SimilarModal source={similar} state={state} onClose={()=>setSimilar(null)} onAdd={(row,r,q)=>add(row,r,undefined,q)}/>}
 {checkout&&<Checkout state={state} sending={sending} onClose={()=>setCheckout(false)} onOpen={r=>openStore(r).catch(e=>setNotice(e.message))} onSend={send} onConnect={()=>setBrowserSetup(true)}/>}
 {browserSetup&&<BrowserSetup onClose={()=>setBrowserSetup(false)}/>}
 {notice&&<div role="status" className="toast">{notice}<button aria-label="Dismiss message" onClick={()=>setNotice('')}><X size={16}/></button></div>}
 </div>
}
function StoreModal({state,onClose,onSave,onLoyalty,onBrowser}:{state:State;onBrowser:()=>void;onClose:()=>void;onSave:(s:State['stores'])=>void;onLoyalty:(r:Retailer,v:boolean)=>void}){
 const [personalise,setPersonalise]=useState(true),[cleared,setCleared]=useState(false);
 useEffect(()=>{window.grocery.preferences().then(p=>setPersonalise(p.enabled)).catch(()=>{})},[]);
 const [selected,setSelected]=useState(state.stores),[q,setQ]=useState(''),[results,setResults]=useState<Record<Retailer,Store[]>>({newworld:[],woolworths:[]}),[loading,setLoading]=useState(false),[error,setError]=useState('');const seq=useRef(0);
 useEffect(()=>{const id=++seq.current;const t=setTimeout(async()=>{setLoading(true);const data=await Promise.allSettled(retailers.map(r=>window.grocery.stores(r,q)));if(seq.current!==id)return;setError('');data.forEach((d,i)=>{if(d.status==='fulfilled')setResults(s=>({...s,[retailers[i]]:d.value}));else setError(d.reason.message)});setLoading(false)},300);return()=>clearTimeout(t)},[q]);
 return <div className="modal-backdrop"><div className="modal stores-modal"><div className="modal-heading"><h2>Your stores</h2><button className="icon-button" aria-label="Close store settings" onClick={onClose}><X/></button></div><div className="store-search"><MapPin size={18}/><input aria-label="Find stores" placeholder="Town, suburb or store name" value={q} onChange={e=>setQ(e.target.value)}/>{loading&&<RefreshCw size={17} className="spin"/>}</div>{error&&<p className="error-text">{error}</p>}<div className="store-columns">{retailers.map(r=><section key={r}><h3><Badge r={r}/>{names[r]}</h3><div className="store-options">{results[r].map(s=><button key={s.id} className={selected[r]?.id===s.id?'selected':''} onClick={()=>setSelected(v=>({...v,[r]:s}))}><span>{s.name}<small>{s.address}</small></span>{selected[r]?.id===s.id&&<Check size={17}/>}</button>)}{!loading&&!results[r].length&&<p>No stores found</p>}</div><label className="loyalty"><input type="checkbox" checked={state.loyalty[r]} onChange={e=>onLoyalty(r,e.target.checked)}/>{r==='newworld'?'Club+ Deals':'Member Price'}</label></section>)}</div><div className="recommendation-settings"><label><input type="checkbox" checked={personalise} onChange={e=>{const enabled=e.target.checked;window.grocery.setPersonalisation(enabled).then(()=>setPersonalise(enabled)).catch(e=>setError(e.message))}}/>Personalise browsing</label><button className="text-button" onClick={()=>window.grocery.resetPreferences().then(()=>setCleared(true)).catch(e=>setError(e.message))}>{cleared?'History cleared':'Clear history'}</button></div><button className="text-button browser-connect" onClick={onBrowser}>Browser connection</button><div className="modal-footer"><span>{retailers.map(r=>selected[r]?.name).filter(Boolean).join(' + ')}</span><button className="primary" disabled={!selected.newworld||!selected.woolworths} onClick={()=>onSave(selected)}>Save stores</button></div></div></div>
}
function MatchModal({row,state,onClose,onChoose}:{row:Row;state:State;onClose:()=>void;onChoose:(p:Product)=>void}){
 const r:Retailer=row.offers.newworld&&!row.offers.woolworths?'woolworths':row.offers.woolworths&&!row.offers.newworld?'newworld':row.product.retailer==='newworld'?'woolworths':'newworld';
 const [query,setQuery]=useState(''),[results,setResults]=useState<Product[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');const seq=useRef(0);
 async function find(){const id=++seq.current;setBusy(true);setError('');try{const products=query.trim()?(await window.grocery.search(r,state.stores[r]!,query.slice(0,100))).products:await window.grocery.matchCandidates(row.product);if(id===seq.current)setResults(products)}catch(e){setError((e as Error).message)}finally{if(id===seq.current)setBusy(false)}}
 useEffect(()=>{find()},[]);
 return <div className="modal-backdrop"><div className="modal match-modal"><div className="modal-heading"><h2>Choose an equivalent</h2><button className="icon-button" aria-label="Close matching" onClick={onClose}><X/></button></div><p className="match-source">{row.product.name}</p><form className="search compact" onSubmit={e=>{e.preventDefault();find()}}><Search size={18}/><input aria-label="Search equivalent product" value={query} onChange={e=>setQuery(e.target.value)} maxLength={100}/><button className="primary" disabled={busy}>Search</button></form><h3 className="match-store"><Badge r={r}/>{names[r]}</h3><div className="match-results">{busy?<div className="loading"><RefreshCw className="spin"/>Searching…</div>:results.filter(p=>p.unit===row.product.unit&&!p.restricted).map(p=><button className="match-result" key={p.id} onClick={()=>onChoose(p)}><Picture p={p}/><span>{p.name}<small>{pricing.effectiveUnitPrice(p,state.loyalty[r])}</small></span><strong>{dollars(effectivePrice(p,state.loyalty[r]))}</strong><Plus size={18}/></button>)}{!busy&&!results.length&&<p>{error||'No matches. Try fewer words.'}</p>}</div></div></div>
}
createRoot(document.getElementById('root')!).render(<App/>);
