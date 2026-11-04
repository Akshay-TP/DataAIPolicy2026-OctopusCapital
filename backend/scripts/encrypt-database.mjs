import Database from 'better-sqlite3-multiple-ciphers';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {databaseKey,isPlainDatabase,configureCipher,openEncryptedDatabase} from '../../database/encryption.mjs';

export function encryptExistingDatabase(file,key) {
  if(!existsSync(file))return false;
  if(!isPlainDatabase(file)){const check=openEncryptedDatabase(file,key);check.close();return false;}
  const db=new Database(file,{timeout:1000});
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');db.pragma('journal_mode=DELETE');
    db.pragma('temp_store=MEMORY');configureCipher(db);db.rekey(Buffer.from(key,'utf8'));
    db.exec('VACUUM');
    if(db.pragma('integrity_check',{simple:true})!=='ok')throw new Error('Database integrity verification failed');
  }finally{db.close();}
  const verify=openEncryptedDatabase(file,key);try{if(verify.pragma('integrity_check',{simple:true})!=='ok')throw new Error('Encrypted database verification failed');}finally{verify.close();}
  if(isPlainDatabase(file))throw new Error('Database encryption verification failed');return true;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const demo=process.env.DEMO_MODE!=='false'&&process.env.NODE_ENV!=='production',dataDir=resolve(process.env.DATA_DIR||(demo?'data/india-demo':'private-data'));
  const key=databaseKey({dataDir,demo});
  // Existing legacy snapshots are encrypted too; the app never creates a plaintext safety copy.
  let count=0;for(const name of ['fieldledger.sqlite','before-multicurrency.sqlite'])if(encryptExistingDatabase(resolve(dataDir,name),key))count++;
  console.log(`Verified encrypted storage (${count} database file(s) encrypted). Keep the database key separate from the data directory.`);
}
