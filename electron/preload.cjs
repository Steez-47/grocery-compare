const {contextBridge,ipcRenderer}=require('electron');
const invoke=async(name,...args)=>{const r=await ipcRenderer.invoke(name,...args);if(!r.ok)throw new Error(r.error);return r.data;};
contextBridge.exposeInMainWorld('grocery',{
 load:()=>invoke('load'),save:s=>invoke('save',s),stores:(r,q)=>invoke('stores',r,q),departments:s=>invoke('departments',s),search:(r,s,q,p,f,o)=>invoke('search',r,s,q,p,f,o),
 openStore:r=>invoke('store-open',r),closeStore:()=>invoke('store-close'),navigate:a=>invoke('store-nav',a),transfer:r=>invoke('transfer',r),exportList:()=>invoke('export'),
 onStoreStatus:cb=>{const f=(_e,s)=>cb(s);ipcRenderer.on('store-status',f);return()=>ipcRenderer.removeListener('store-status',f);}
});
