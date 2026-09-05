if(location.origin==='http://127.0.0.1:47391'&&location.pathname==='/connect'&&/^#[a-f0-9]{64}$/.test(location.hash)){
 const code=location.hash.slice(1);history.replaceState(null,'','/connect');
 chrome.runtime.sendMessage({type:'pair',code}).then(result=>{const el=document.getElementById('connection-status');if(el)el.textContent=result.error||'Connected. Return to Grocery Compare to send your items.'}).catch(()=>{});
}
