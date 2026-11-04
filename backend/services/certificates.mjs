import {generateKeyPairSync,createPrivateKey,createPublicKey,sign,createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync,realpathSync} from 'node:fs';
import {resolve,dirname,relative,isAbsolute} from 'node:path';
import {CERTIFICATE_FORMAT,WITHDRAWAL_FORMAT,signedBytes,canonicalJson,DEFAULT_CERTIFICATE_POLICY} from '../../shared/certificates.mjs';

export function seal(privateKey,format,payload){
  return {format,algorithm:'Ed25519',payload,signature:sign(null,signedBytes(format,payload),privateKey).toString('base64url')};
}
export function sourceVersion(snapshot){return createHash('sha256').update(canonicalJson(snapshot)).digest('hex');}
export function createDemoIssuer(folder,issuerId,name){
  mkdirSync(folder,{recursive:true,mode:0o700});const privateKeyFile=resolve(folder,'signing.pem'),file=resolve(folder,'issuer.json');
  if(!existsSync(privateKeyFile))writeFileSync(privateKeyFile,generateKeyPairSync('ed25519').privateKey.export({type:'pkcs8',format:'pem'}),{flag:'wx',mode:0o600});
  if(!existsSync(file))writeFileSync(file,JSON.stringify({issuerId,name,keyId:issuerId+'-demo-key-1',privateKeyFile,validFrom:'2020-01-01T00:00:00.000Z',validUntil:'2036-01-01T00:00:00.000Z'}),{flag:'wx',mode:0o600});
  return file;
}
export function loadAuthority({demo,dataDir}){
  let file=process.env.CERTIFICATE_ISSUER_FILE;
  if(!file&&demo){const key=createHash('sha256').update(resolve(dataDir)).digest('hex').slice(0,20);file=createDemoIssuer(resolve('.local/certificate-keys',key),'fieldledger-demo-'+key,'FieldLedger Demonstration Issuer');}
  let issuer=null,privateKey=null;
  if(file){
    issuer=JSON.parse(readFileSync(resolve(file),'utf8'));const keyFile=realpathSync(resolve(dirname(resolve(file)),issuer.privateKeyFile));
    const inside=relative(resolve(dataDir),keyFile);if(inside===''||!inside.startsWith('..')&&!isAbsolute(inside))throw new Error('Certificate signing keys must be stored outside DATA_DIR.');
    privateKey=createPrivateKey(readFileSync(keyFile));if(privateKey.asymmetricKeyType!=='ed25519')throw new Error('Certificate signing requires an Ed25519 key.');
    const publicKey=createPublicKey(privateKey).export({format:'jwk'}).x;
    issuer={issuerId:issuer.issuerId,name:issuer.name,keyId:issuer.keyId,publicKey,validFrom:issuer.validFrom,validUntil:issuer.validUntil};
    if(![issuer.issuerId,issuer.name,issuer.keyId].every(value=>typeof value==='string'&&value.length>0&&value.length<=120)||![issuer.validFrom,issuer.validUntil].every(value=>typeof value==='string'&&new Date(value).toISOString()===value)||issuer.validFrom>=issuer.validUntil)throw new Error('Invalid certificate issuer configuration.');
  }
  const trustFile=process.env.CERTIFICATE_TRUST_FILE,trust=trustFile?JSON.parse(readFileSync(resolve(trustFile),'utf8')):{keys:[],statusLists:[]};
  if(!Array.isArray(trust.keys)||trust.keys.length>100||trust.statusLists!==undefined&&!Array.isArray(trust.statusLists))throw new Error('Invalid approved issuer registry.');
  const keys=[...trust.keys];if(issuer&&!keys.some(key=>key.issuerId===issuer.issuerId&&key.keyId===issuer.keyId))keys.push(issuer);
  if(issuer&&keys.some(key=>key.issuerId===issuer.issuerId&&key.keyId===issuer.keyId&&key.publicKey!==issuer.publicKey))throw new Error('The signing key does not match its approved public key.');
  if(new Set(keys.map(key=>key.issuerId+'\n'+key.keyId)).size!==keys.length)throw new Error('Duplicate approved issuer key.');
  for(const key of keys)if(![key.issuerId,key.name,key.keyId].every(value=>typeof value==='string'&&value.length>0&&value.length<=120)||![key.validFrom,key.validUntil].every(value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value)||key.validFrom>=key.validUntil||typeof key.publicKey!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(key.publicKey)||key.privateKey||key.privateKeyFile)throw new Error('The approved registry must contain public Ed25519 keys only.');
  const authority={issuer,keys,initialStatus:trust.statusLists||[],recipientId:issuer?.issuerId||process.env.CERTIFICATE_RECIPIENT_ID||null};
  authority.sign=payload=>{if(!privateKey)throw new Error('Certificate issuer is not configured');if(Date.now()<Date.parse(issuer.validFrom)||Date.now()>=Date.parse(issuer.validUntil))throw new Error('Certificate signing key is outside its approved validity period');return seal(privateKey,CERTIFICATE_FORMAT,payload);};
  authority.status=s=>privateKey?seal(privateKey,WITHDRAWAL_FORMAT,{issuerId:issuer.issuerId,keyId:issuer.keyId,sequence:s.config.certificateStatusSequence||0,issuedAt:new Date().toISOString(),nextUpdate:new Date(Date.now()+86400000).toISOString(),withdrawn:(s.certificates||[]).filter(row=>row.withdrawal).map(row=>({id:row.id,at:row.withdrawal.at})).sort((a,b)=>a.id.localeCompare(b.id))}):null;
  authority.settings=s=>({issuer,keys,recipientId:authority.recipientId||s.config.workspaceId,policy:s.config.certificatePolicy||DEFAULT_CERTIFICATE_POLICY,statusLists:[...authority.initialStatus,...(s.certificateStatusCache||[]).map(row=>row.envelope),...((issuer)?[authority.status(s)]:[])],synthetic:demo});
  return authority;
}
