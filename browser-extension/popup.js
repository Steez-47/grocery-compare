const $ = id=>document.getElementById(id);
const roots = {newworld:'https://www.newworld.co.nz/*',woolworths:'https://www.woolworths.co.nz/*'};
let state = 'unpaired';
const copy = {
 connected:['Ready to send','Choose Send items in Grocery Compare. Your browser stays in charge of sign-in and payment.'],
 unpaired:['Let’s connect','Open Grocery Compare → checkout → Set up browser companion → Connect browser.'],
 paused:['Companion paused','No new cart requests will run. A request already sent to a store may finish; review its cart.'],
 offline:['Open Grocery Compare','The desktop app is not responding. Open it, then check again. Reconnection also happens automatically.'],
 reconnect:['Reconnect needed','In the app, open browser setup and choose Connect browser again.']
};
async function message(type,extra={}){const result=await chrome.runtime.sendMessage({type,...extra});if(result?.error)throw new Error(result.error);return result;}
async function refresh(){
 const result=await message('status');state=result.state;
 $('status').textContent=copy[state][0];$('description').textContent=copy[state][1];$('dot').className='dot '+state;$('version').textContent='v'+result.version;
 $('toggle').hidden=!['connected','paused','offline'].includes(state);$('toggle').textContent=state==='paused'?'Resume':'Pause';
 $('retry').hidden=state!=='offline';$('disconnect').hidden=state==='unpaired';
 if(result.activity){const a=result.activity;$('activity').textContent=`${a.retailer} · ${a.action} ${a.ok?'completed':'needs attention'} · ${new Date(a.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`;}else $('activity').textContent='No cart activity yet.';
 await refreshPermissions();
}
async function refreshPermissions(){for(const [store,origin] of Object.entries(roots)){const allowed=await chrome.permissions.contains({origins:[origin]});$(store+'-status').textContent=allowed?'Cart access enabled':'Cart access off';$(store+'-access').textContent=allowed?'Turn off':'Enable';$(store+'-access').dataset.allowed=String(allowed);}}
function showError(e){$('error').hidden=false;$('error').textContent=e.message||'Please try again.';}
function action(button,fn){button.addEventListener('click',async()=>{button.disabled=true;$('error').hidden=true;try{await fn();await refresh();}catch(e){showError(e);}finally{button.disabled=false;}});}
action($('toggle'),()=>message(state==='paused'?'resume':'pause'));
action($('retry'),()=>message('retry'));
action($('disconnect'),()=>message('disconnect'));
$('help').onclick=()=>chrome.runtime.openOptionsPage();
for(const [store,origin] of Object.entries(roots)){
 action($(store+'-access'),async()=>{
  // The permission request must be the first asynchronous call in this user gesture.
  if($(store+'-access').dataset.allowed==='true')await chrome.permissions.remove({origins:[origin]});
  else if(!await chrome.permissions.request({origins:[origin]}))throw new Error('Access was not enabled. You can still open the store and shop normally.');
 });
}
for(const button of document.querySelectorAll('[data-open]'))action(button,()=>message('open-store',{retailer:button.dataset.open}));
refresh().catch(showError);
