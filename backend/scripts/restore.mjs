import { readFileSync,existsSync,mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { decryptBackup } from '../services/backup.mjs';
import { openRepository } from '../../database/repository.mjs';

// Restore only into a new, empty database, never over a running workspace.
const backupFile=process.env.BACKUP_FILE,password=process.env.BACKUP_PASSWORD;
if(!backupFile||!password||!process.env.DATA_DIR)throw new Error('Set BACKUP_FILE, BACKUP_PASSWORD, and a new DATA_DIR before restoring.');
const dataDir=resolve(process.env.DATA_DIR);
if(existsSync(resolve(dataDir,'fieldledger.sqlite')))throw new Error('Target database already exists. Choose a new DATA_DIR; existing records are never overwritten.');
const payload=decryptBackup(JSON.parse(readFileSync(resolve(backupFile),'utf8')),password);
if(![2,3,4].includes(payload.schema)||!payload.workspace||!Array.isArray(payload.staff))throw new Error('Invalid backup contents');
mkdirSync(dataDir,{recursive:true});const repo=openRepository({dataDir,demo:false});
try {
  repo.save(payload.workspace);payload.staff.forEach(u=>repo.saveStaff(u));
  const restored=repo.read();
  if(restored.members.length!==payload.workspace.members.length||restored.visits.length!==payload.workspace.visits.length)throw new Error('Restore verification failed');
  for(const key of ['checkins','supportPlans','services','cashflow'])if(restored[key].length!==(payload.workspace[key]||[]).length)throw new Error('Household health restore verification failed: '+key);
  console.log(`Restored and verified ${restored.members.length} members and ${restored.visits.length} visits in ${dataDir}.`);
}finally{repo.close();}
