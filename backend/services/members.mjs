import { randomUUID } from 'node:crypto';
import { assert,str,money } from '../middleware/http.mjs';
import { groupAccess } from './access.mjs';
import { validMoney } from '../../shared/catalog.mjs';
export function enrollMember(s,b,user) {
  assert(str(b.name)&&str(b.business)&&s.groups.some(g=>g.id===b.groupId),'Name, livelihood and valid group are required');
  groupAccess(user,b.groupId);
  const currency=b.currency||s.settings.currency;
  assert(validMoney(b.income,currency)&&validMoney(b.expenses,currency)&&Number.isInteger(b.household)&&b.household>=1&&b.household<=30&&Number.isInteger(b.earners)&&b.earners>=0&&b.earners<=b.household,'Check household figures and currency precision');
  assert(s.config.acceptedIds.includes(b.identityType)&&typeof b.identitySuffix==='string'&&/^\d{4}$/.test(b.identitySuffix),'Select an accepted ID type and enter only its last four digits');
  const customFields={};
  for(const q of s.config.questions) {
    const v=b.customFields?.[q.id];
    if(v===undefined||v===''){assert(!q.required,`${q.label} is required`);continue;}
    assert(q.type==='number'?typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=100000000:str(v,0,300),`Check ${q.label}`);customFields[q.id]=v;
  }
  return {id:'MEM-'+randomUUID().slice(0,8),currency,name:b.name.trim(),business:b.business.trim(),groupId:b.groupId,income:b.income,expenses:b.expenses,household:b.household,earners:b.earners,identityType:b.identityType,identitySuffix:b.identitySuffix,kycVerified:false,joined:new Date().toISOString().slice(0,10),consent:null,customFields,customFieldLabels:Object.fromEntries(s.config.questions.map(q=>[q.id,q.label]))};
}
