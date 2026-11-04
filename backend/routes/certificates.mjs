import {randomUUID} from 'node:crypto';
import QRCode from 'qrcode';
import {assert,str,date,json} from '../middleware/http.mjs';
import {requireRole,memberAccess} from '../services/access.mjs';
import {localDate} from '../services/dates.mjs';
import {sourceVersion} from '../services/certificates.mjs';
import {CLOSURE_CLAIM,CLOSURE_STATEMENT,canonicalJson,closureSource,closureBlockers,verifyCertificate,verifyWithdrawalList} from '../../shared/certificates.mjs';

export async function certificateRoutes({req,res,url,b,s,user,repository,demo,audit,authority}){
  if(!url.pathname.startsWith('/api/certificates/'))return false;
  const path=url.pathname.slice('/api/certificates/'.length),today=localDate(s.config.timeZone),at=()=>new Date().toISOString();
  const save=message=>{audit(s,user,message);repository.save(s);};
  const current=()=>authority.settings(s),identity=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{8,80}$/.test(id);
  const accessReview=id=>{const review=s.closureReviews.find(row=>row.id===id);assert(review,'Closure review not found',404);memberAccess(s,user,review.memberId);return review;};
  const delivery=path.match(/^issued\/([^/]+)\/delivery$/);
  if(delivery&&req.method==='GET'){
    const record=s.certificates.find(row=>row.id===delivery[1]);assert(record,'Certificate not found',404);memberAccess(s,user,record.memberId);
    const qr=await QRCode.toDataURL(canonicalJson(record.envelope),{errorCorrectionLevel:'M',margin:4,width:640});
    json(res,200,{envelope:record.envelope,qr,withdrawal:record.withdrawal});return true;
  }
  if(path==='status'&&req.method==='GET'){assert(authority.issuer,'Issuer not configured',409);json(res,200,authority.status(s));return true;}
  if(path==='policy'&&req.method==='POST'){
    requireRole(user,'admin');assert(typeof b.requireLiveStatus==='boolean'&&Number.isFinite(b.maxStatusAgeHours)&&b.maxStatusAgeHours>=0&&b.maxStatusAgeHours<=168,'Set a status age of 0–168 hours and a live-status policy');s.config.certificatePolicy={requireLiveStatus:b.requireLiveStatus,maxStatusAgeHours:b.maxStatusAgeHours};save('Updated documentary acceptance status policy');json(res,200,current().policy);return true;
  }
  if(path==='status/import'&&req.method==='POST'){
    const result=await verifyWithdrawalList(b.envelope,authority.keys);assert(result.valid,result.reason);
    const p=b.envelope.payload,old=s.certificateStatusCache.find(row=>row.id===p.issuerId),initial=current().statusLists.filter(row=>row.payload.issuerId===p.issuerId).sort((a,b)=>b.payload.sequence-a.payload.sequence||b.payload.issuedAt.localeCompare(a.payload.issuedAt))[0];
    if(initial){const prior=initial.payload;assert(p.sequence>=prior.sequence&&p.issuedAt>=prior.issuedAt&&prior.withdrawn.every(row=>p.withdrawn.some(next=>next.id===row.id&&next.at===row.at)),'Older or incomplete withdrawal information cannot replace the cached snapshot',409);}
    const record={id:p.issuerId,envelope:b.envelope,importedAt:at(),importedBy:user.id};if(old)Object.assign(old,record);else s.certificateStatusCache.push(record);save('Imported a verified issuer withdrawal snapshot');json(res,200,record);return true;
  }
  if(path==='reviews'&&req.method==='POST'){
    requireRole(user,'admin','supervisor');assert(authority.issuer,'Configure a signing issuer before preparing a certificate',409);
    assert(Date.parse(authority.issuer.validFrom)<=Date.now()&&Date.now()<Date.parse(authority.issuer.validUntil),'The signing key is outside its approved validity period',409);
    const loan=s.loans.find(row=>row.id===b.loanId);assert(loan,'Loan not found',404);memberAccess(s,user,loan.memberId);
    const blockers=closureBlockers(s,loan.id);assert(!blockers.length,blockers.join('. '),409);
    assert(b.authoritativeClosed===true&&b.paymentsFinal===true&&b.noPendingCorrections===true,'Reconcile closure, final payments and unresolved corrections with the authoritative source');
    assert(['fieldledger','BR.NET','other-external'].includes(b.sourceSystem)&&str(b.sourceReference,5,300),'Record the authoritative system and reconciliation reference');
    assert(str(b.subjectRef,1,60)&&str(b.loanRef,1,60)&&![b.subjectRef,b.loanRef].some(value=>/[\u0000-\u001f]/.test(value))&&date(b.assessmentDate)&&b.assessmentDate<=today,'Check the limited borrower/account references and assessment date');
    assert(b.assessmentDate>=loan.date&&s.visits.filter(row=>row.loanId===loan.id&&row.paid>0).every(row=>row.date<=b.assessmentDate),'The assessment date cannot precede the loan or its final recorded payments');
    assert(Number.isInteger(b.validDays)&&b.validDays>=1&&b.validDays<=365,'Choose 1–365 days of validity');
    const recipient=authority.keys.find(key=>key.issuerId===b.recipientId&&!key.disabled);assert(recipient,'Choose a preconfigured receiving institution');
    const id=identity(b.id)?b.id:randomUUID(),existing=s.closureReviews.find(row=>row.id===id);if(existing){assert(existing.createdById===user.id&&existing.inputKey===canonicalJson(b),'Review identifier already used',409);json(res,200,existing);return true;}
    if(b.replacesId){const prior=s.certificates.find(row=>row.id===b.replacesId);assert(prior?.loanId===loan.id,'Replacement must concern the same specified loan');}
    const preparedAt=at(),payload={id:randomUUID(),issuerId:authority.issuer.issuerId,issuerName:authority.issuer.name,keyId:authority.issuer.keyId,recipientId:recipient.issuerId,claim:CLOSURE_CLAIM,statement:CLOSURE_STATEMENT,subjectRef:b.subjectRef.trim(),loanRef:b.loanRef.trim(),assessmentDate:b.assessmentDate,preparedAt,expiresAt:new Date(Date.now()+b.validDays*86400000).toISOString(),synthetic:demo};
    const sourceSnapshot=closureSource(s,loan.id),review={id,memberId:loan.memberId,loanId:loan.id,payload,sourceSnapshot,sourceVersion:sourceVersion(sourceSnapshot),sourceSystem:b.sourceSystem,sourceReference:b.sourceReference.trim(),replacesId:b.replacesId||null,status:'prepared',createdById:user.id,createdBy:user.name,createdAt:preparedAt,version:1,inputKey:canonicalJson(b),history:[]};
    s.closureReviews.push(review);save(`Prepared specified-loan closure review ${id}`);json(res,201,review);return true;
  }
  let match=path.match(/^reviews\/([^/]+)\/(borrower|issue)$/);
  if(match&&req.method==='POST'){
    const review=accessReview(match[1]);
    if(match[2]==='borrower'){
      assert(review.status==='prepared'||review.status==='correction-requested','This review has already advanced',409);assert(b.version===review.version,'Review changed; reload the preview',409);
      assert(['approved','correction-requested'].includes(b.decision)&&b.explained===true,'Record the borrower’s choice after explaining the exact disclosed claim');
      assert(b.decision!=='approved'||b.consented===true,'Borrower permission for this exact recipient and claim is required');assert(str(b.note,5,500),'Record how the claim was reviewed or the correction requested');
      review.status=b.decision==='approved'?'borrower-reviewed':'correction-requested';review.borrowerConsent=b.decision==='approved'?{recipientId:review.payload.recipientId,payloadVersion:sourceVersion(review.payload),at:at(),recordedBy:user.id}:null;review.history.push({at:at(),actor:user.name,decision:b.decision,note:b.note});review.version++;
      save(`Recorded borrower review for ${review.id}`);json(res,200,review);return true;
    }
    requireRole(user,'admin','supervisor');const existing=s.certificates.find(row=>row.reviewId===review.id);if(existing){json(res,200,existing);return true;}
    assert(review.status==='borrower-reviewed'&&review.borrowerConsent?.payloadVersion===sourceVersion(review.payload),'A borrower-approved exact preview is required',409);
    assert(review.sourceVersion===sourceVersion(closureSource(s,review.loanId))&&!closureBlockers(s,review.loanId).length,'Source records changed or no longer establish settlement; prepare a new review',409);
    assert(Date.parse(review.payload.expiresAt)>Date.now()&&review.payload.issuerId===authority.issuer?.issuerId&&review.payload.keyId===authority.issuer?.keyId,'Prepared claim is expired or the signing configuration changed',409);
    assert(b.authorised===true,'An authorised officer must approve issuance');
    const envelope=authority.sign(review.payload),record={id:review.payload.id,memberId:review.memberId,loanId:review.loanId,reviewId:review.id,envelope,sourceSnapshot:review.sourceSnapshot,sourceVersion:review.sourceVersion,issuedAt:at(),issuedBy:user.name,withdrawal:null};
    if(review.replacesId){const prior=s.certificates.find(row=>row.id===review.replacesId);if(!prior.withdrawal)prior.withdrawal={at:at(),actor:user.name,reason:'Replaced after correction',replacementId:record.id};else prior.withdrawal.replacementId=record.id;}
    s.certificates.push(record);review.status='issued';review.version++;s.config.certificateStatusSequence=(s.config.certificateStatusSequence||0)+1;
    save(`Issued specified-loan closure certificate ${record.id}`);json(res,201,record);return true;
  }
  match=path.match(/^issued\/([^/]+)\/withdraw$/);
  if(match&&req.method==='POST'){
    requireRole(user,'admin','supervisor');const record=s.certificates.find(row=>row.id===match[1]);assert(record,'Certificate not found',404);memberAccess(s,user,record.memberId);assert(str(b.reason,5,500),'Explain the withdrawal');
    if(!record.withdrawal){record.withdrawal={at:at(),actor:user.name,reason:b.reason.trim(),replacementId:null};s.config.certificateStatusSequence=(s.config.certificateStatusSequence||0)+1;save(`Withdrew certificate ${record.id}`);}json(res,200,record);return true;
  }
  if(path==='decisions'&&req.method==='POST'){
    assert(identity(b.id)&&(!b.capturedBy||b.capturedBy===user.id),'Invalid decision identifier or account');if(b.applicantMemberId)memberAccess(s,user,b.applicantMemberId);
    assert(['unresolved','matched','mismatched'].includes(b.identity)&&['manual-review','accepted','not-accepted'].includes(b.acceptance)&&str(b.identityNotes,5,500)&&str(b.reason,5,500),'Record identity matching and documentary acceptance separately');
    const old=s.certificateDecisions.find(row=>row.id===b.id),{capturedBy,...input}=b;if(old){assert(old.createdById===user.id&&old.inputKey===canonicalJson(input),'Decision identifier already used',409);json(res,200,old);return true;}
    const settings=current(),report=await verifyCertificate(b.envelope,settings);
    assert(b.acceptance!=='accepted'||report.evidenceValid&&b.identity==='matched','Acceptance requires recognised, intact, in-date evidence, sufficiently fresh status, the intended recipient and a separate identity match',409);
    const record={id:b.id,envelope:b.envelope,report,identity:b.identity,identityNotes:b.identityNotes.trim(),acceptance:b.acceptance,reason:b.reason.trim(),requirement:'Specified loan closure letter authentication',policy:{...settings.policy},applicantMemberId:b.applicantMemberId||null,createdById:user.id,createdBy:user.name,createdAt:at(),inputKey:canonicalJson(input)};
    s.certificateDecisions.push(record);save(`Recorded documentary check ${record.id} (${record.acceptance})`);json(res,201,record);return true;
  }
  assert(false,'Certificate operation not found',404);
}
