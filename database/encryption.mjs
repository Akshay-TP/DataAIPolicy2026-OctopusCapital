import Database from 'better-sqlite3-multiple-ciphers';
import {readFileSync,writeFileSync,mkdirSync,existsSync,openSync,readSync,closeSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomBytes,createCipheriv,scryptSync} from 'node:crypto';

const projectRoot=fileURLToPath(new URL('../',import.meta.url));
export function databaseKey({dataDir,demo,key=process.env.DATABASE_KEY,keyFile=process.env.DATABASE_KEY_FILE}={}) {
  if(key&&keyFile)throw new Error('Set DATABASE_KEY or DATABASE_KEY_FILE, not both.');
  if(keyFile)key=readFileSync(resolve(keyFile),'utf8').trim();
  if(!key&&demo) {
    const file=resolve(projectRoot,'.local/keys',createHash('sha256').update(resolve(dataDir)).digest('hex').slice(0,24)+'.key');
    mkdirSync(dirname(file),{recursive:true,mode:0o700});
    if(!existsSync(file)){try{writeFileSync(file,randomBytes(32).toString('hex'),{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST')throw e;}}
    key=readFileSync(file,'utf8').trim();
  }
  if(typeof key!=='string'||key.length<32||key.length>1024)throw new Error('Set a separate DATABASE_KEY (32–1024 characters) or DATABASE_KEY_FILE before opening the encrypted database.');
  return key;
}
export function isPlainDatabase(file) {
  if(!existsSync(file))return false;
  const fd=openSync(file,'r'),header=Buffer.alloc(16);try{readSync(fd,header,0,16,0);}finally{closeSync(fd);}
  return header.toString('ascii')==='SQLite format 3\0';
}
export function configureCipher(db) {db.pragma("cipher='sqlcipher'");db.pragma('legacy=4');}
export function openEncryptedDatabase(file,key) {
  if(isPlainDatabase(file))throw new Error('Unencrypted database detected. Stop FieldLedger and run npm run encrypt-db before starting. Existing records have not been changed.');
  const db=new Database(file);try {
    configureCipher(db);db.key(Buffer.from(key,'utf8'));
    db.prepare('SELECT count(*) FROM sqlite_master').get();
    db.pragma('temp_store=MEMORY');db.pragma('memory_security=1');
    return db;
  }catch{db.close();throw new Error('Cannot unlock the database. Check the database key and file integrity; records were not overwritten.');}
}
export function encryptedMigrationSnapshot(db,file,key) {
  const salt=randomBytes(16),iv=randomBytes(12);
  const derived=scryptSync(key,salt,32),cipher=createCipheriv('aes-256-gcm',derived,iv);
  cipher.setAAD(Buffer.from('fieldledger.sqlite-snapshot.v1'));
  const data=Buffer.concat([cipher.update(db.serialize()),cipher.final()]);
  writeFileSync(file,JSON.stringify({format:'fieldledger.sqlite-snapshot.v1',salt:salt.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')}),{flag:'wx',mode:0o600});
}
