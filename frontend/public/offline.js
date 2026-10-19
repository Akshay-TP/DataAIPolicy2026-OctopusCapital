const encoder=new TextEncoder(),decoder=new TextDecoder();
const base64=bytes=>{let text='';for(let offset=0;offset<bytes.length;offset+=8192)text+=String.fromCharCode(...bytes.subarray(offset,offset+8192));return btoa(text);};
const bytes=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));

/** Encrypted pending records; the passphrase and key never leave this tab. */
export class OfflineVault {
  constructor(owner){this.owner=owner;this.storageKey='fl-offline-'+owner;this.key=null;this.records=[];}
  metadata(){try{const data=JSON.parse(localStorage.getItem(this.storageKey)||'null');return data?{count:data.count,locked:!this.key}:{count:0,locked:!this.key};}catch{throw new Error('Offline storage is unreadable. Keep the browser data for recovery.');}}
  async unlock(password) {
    if(password.length<12)throw new Error('Use at least 12 characters for the device passphrase.');
    const data=JSON.parse(localStorage.getItem(this.storageKey)||'null');
    const salt=data?bytes(data.salt):crypto.getRandomValues(new Uint8Array(16));
    const material=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);
    const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:210000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
    let records=[];
    if(data) {
      try{const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(data.iv),additionalData:encoder.encode(this.owner)},key,bytes(data.data));records=JSON.parse(decoder.decode(plain));}
      catch{throw new Error('Unable to unlock. Check the device passphrase; records have not been changed.');}
    }
    this.key=key;this.salt=salt;this.records=records;
  }
  async save(records) {
    if(!this.key)throw new Error('Unlock Offline records before capturing visits without a connection.');
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(this.owner)},this.key,encoder.encode(JSON.stringify(records)));
    localStorage.setItem(this.storageKey,JSON.stringify({version:1,count:records.length,salt:base64(this.salt),iv:base64(iv),data:base64(new Uint8Array(encrypted))}));
    this.records=records;
  }
  lock(){this.key=null;this.records=[];this.salt=null;}
}
