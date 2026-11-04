import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import Database from 'node:sqlite';
import {openRepository} from '../database/repository.mjs';
import {databaseKey,isPlainDatabase,openEncryptedDatabase} from '../database/encryption.mjs';
import {encryptExistingDatabase} from '../backend/scripts/encrypt-database.mjs';

test('encrypted database survives restart, rejects wrong keys, and does not expose household values in DB/WAL',()=>{
  const dir=mkdtempSync(join(tmpdir(),'fl-cipher-')),file=join(dir,'fieldledger.sqlite'),key=process.env.DATABASE_KEY;
  try{let repo=openRepository({dataDir:dir,demo:true});const s=repo.read(),canary='PRIVATE-HOUSEHOLD-CANARY-8193';s.members[0].name=canary;repo.save(s);
    assert.equal(isPlainDatabase(file),false);for(const path of [file,file+'-wal'])assert.equal(readFileSync(path).includes(Buffer.from(canary)),false);
    repo.close();const before=readFileSync(file);assert.throws(()=>openEncryptedDatabase(file,'a-totally-different-key-over-32-characters'),/Cannot unlock/);assert.deepEqual(readFileSync(file),before);
    repo=openRepository({dataDir:dir,demo:false});assert.equal(repo.read().members[0].name,canary);assert.equal(repo.encrypted,true);repo.close();
    assert.throws(()=>databaseKey({dataDir:dir,demo:false,key:'',keyFile:''}),/DATABASE_KEY/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('explicit plaintext encryption preserves records and foreign keys and is safe to repeat',()=>{
  const dir=mkdtempSync(join(tmpdir(),'fl-encrypt-')),file=join(dir,'fieldledger.sqlite'),key=process.env.DATABASE_KEY;
  try{const db=new Database.DatabaseSync(file);db.exec("PRAGMA foreign_keys=ON; CREATE TABLE household(id INTEGER PRIMARY KEY,name TEXT);CREATE TABLE note(id INTEGER,household_id INTEGER REFERENCES household(id));INSERT INTO household VALUES(1,'Sensitive migration note');INSERT INTO note VALUES(1,1)");db.close();
    assert.throws(()=>openEncryptedDatabase(file,key),/Unencrypted/);assert.equal(encryptExistingDatabase(file,key),true);assert.equal(encryptExistingDatabase(file,key),false);
    const encrypted=openEncryptedDatabase(file,key);assert.equal(encrypted.prepare('SELECT name FROM household').get().name,'Sensitive migration note');assert.deepEqual(encrypted.pragma('foreign_key_check'),[]);encrypted.close();assert.equal(readFileSync(file).includes(Buffer.from('Sensitive migration note')),false);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
