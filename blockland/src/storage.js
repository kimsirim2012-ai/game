(function(root){'use strict';
const KEY='blockland.adventure.v3',PREVIOUS='blockland.explore.v2',OLD='blockland.offline.v1';
class Store {
 constructor(){this.db=null;this.kind='브라우저';this.lastError=null;this.writing=Promise.resolve();}
 async open(){try{if(!globalThis.indexedDB)return;this.db=await new Promise((resolve,reject)=>{const r=indexedDB.open('BlocklandExploration',1);r.onupgradeneeded=()=>r.result.createObjectStore('worlds');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('database blocked'));});this.kind='IndexedDB';}catch(e){this.lastError=e;}}
 async load(validate=()=>true){const candidates=[];try{if(this.db)for(const key of ['current-v3','current']){const data=await new Promise((resolve,reject)=>{const r=this.db.transaction('worlds').objectStore('worlds').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});if(data)candidates.push(data);}}catch(e){this.lastError=e;}for(const key of [KEY,PREVIOUS,OLD])try{const data=JSON.parse(localStorage.getItem(key));if(data)candidates.push(data);}catch(e){}return candidates.filter(validate).sort((a,b)=>(b.version||0)-(a.version||0)||(b.savedAt||0)-(a.savedAt||0))[0]||null;}
 cache(data){try{const s=JSON.stringify(data);if(s.length>=1800000)return false;localStorage.setItem(KEY,s);return true;}catch(e){this.lastError=e;return false;}}
 async save(data){this.cache(data);if(!this.db)return this.cache(data);this.writing=this.writing.catch(()=>{}).then(()=>new Promise((resolve,reject)=>{const tx=this.db.transaction('worlds','readwrite');tx.objectStore('worlds').put(data,data.version>=3?'current-v3':'current');tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('save aborted'));}));try{return await this.writing;}catch(e){this.lastError=e;this.kind='파일 저장 권장';return false;}}
}
root.BlocklandStore={Store,KEY};
})(globalThis);
