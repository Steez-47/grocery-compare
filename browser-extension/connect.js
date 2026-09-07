if(location.origin==='http://127.0.0.1:47391'&&location.pathname==='/connect'&&/^#[a-f0-9]{64}$/.test(location.hash)){
 const code=location.hash.slice(1);history.replaceState(null,'','/connect');
 chrome.runtime.sendMessage({type:'pair',code}).then(result=>{const el=document.getElementById('connection-status');if(el)el.textContent=result?.ok?'Connected. Enable your stores in the Grocery Compare toolbar icon, then return to the app to send your items.':result?.error||'The companion did not respond. Reload it on the Extensions page, then connect again from the app.';}).catch(()=>{const el=document.getElementById('connection-status');if(el)el.textContent='Reload the companion on your browser’s Extensions page, then click Connect browser in the app again.';});
}
