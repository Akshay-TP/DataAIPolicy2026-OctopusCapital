import {addDays} from '../../shared/health.mjs';

// Fictional scenarios only. Route validation is applied to every example before one atomic save.
export function supportExamples(s,today){
  const groupId=s.groups[0].id,date=days=>addDays(today,-days),person=(id,name,kind,currency,source='worker',memberId=null)=>['people',{id,name,kind,currency,source,memberId,groupId,memberReference:'',safeContact:'Discuss contact preferences at the next agreed visit',notes:'Fictional demonstration record',consented:true}];
  return [
    person('demo-worker-india','Ramesh Kumar','domestic-worker','INR'),
    person('demo-worker-overseas','Imran Ali / family','overseas-worker','AED','family'),
    person('demo-prospect-india','Kavita Deshmukh','prospective','INR','member'),
    person('demo-livelihood-india',s.members[0]?.name||'Sunita Patil','livelihood','INR','member',s.members[0]?.id||null),
    ['debts',{id:'demo-advance-india',personId:'demo-worker-india',date:date(90),kind:'advance',label:'Reported work advance',opening:20000,currency:'INR',disputed:true,source:'worker',notes:'Amount reported by worker; not a verified legal obligation'}],
    ['debt-entries',{id:'demo-repayment-india',personId:'demo-worker-india',debtId:'demo-advance-india',date:date(40),kind:'repayment',amount:1500,source:'worker',notes:''}],
    ['pay',{id:'demo-pay-india',personId:'demo-worker-india',label:'Previous pay period',periodStart:date(45),periodEnd:date(16),dueDate:date(14),expected:9000,currency:'INR',source:'worker',notes:'Expected take-home pay after anticipated deductions'}],
    ['receipts',{id:'demo-receipt-india',personId:'demo-worker-india',payId:'demo-pay-india',date:date(12),amount:5000,source:'worker',notes:'Partial payment reported'}],
    ['deductions',{id:'demo-deduction-india',personId:'demo-worker-india',payId:'demo-pay-india',date:date(12),label:'Advance repayment deducted from wages',amount:800,status:'disputed',debtId:'demo-advance-india',confirmedRepayment:true,source:'worker',notes:'Worker reports this amount applied to debt; does not establish legitimacy'}],
    ['debts',{id:'demo-recruitment-loan',personId:'demo-worker-overseas',date:date(90),kind:'recruitment',label:'Reported recruitment loan in India',opening:70000,currency:'INR',disputed:false,source:'family',notes:''}],
    ['pay',{id:'demo-pay-overseas',personId:'demo-worker-overseas',label:'Overseas salary',periodStart:date(45),periodEnd:date(16),dueDate:date(14),expected:1800,currency:'AED',source:'family',notes:''}],
    ['receipts',{id:'demo-receipt-overseas',personId:'demo-worker-overseas',payId:'demo-pay-overseas',date:date(10),amount:1400,source:'family',notes:''}],
    ['deductions',{id:'demo-deduction-overseas',personId:'demo-worker-overseas',payId:'demo-pay-overseas',date:date(10),label:'Unexplained deduction reported',amount:200,status:'disputed',source:'family',notes:'Family requests clarification'}],
    ['remittances',{id:'demo-remittance-overseas',personId:'demo-worker-overseas',date:date(8),sent:500,sentCurrency:'AED',fee:15,received:11000,receivedCurrency:'INR',receivedDate:date(7),source:'family',notes:'Separate transfer; not another salary payment'}],
    ['participation',{id:'demo-prospect-meeting-one',personId:'demo-prospect-india',date:date(14),attendance:'present',savings:100,currency:'INR',source:'member',notes:'Voluntary contribution'}],
    ['participation',{id:'demo-prospect-meeting-two',personId:'demo-prospect-india',date:date(7),attendance:'present',savings:null,currency:'INR',source:'member',notes:'Contribution amount not provided'}],
    ['assets',{id:'demo-buffalo-check',personId:'demo-livelihood-india',date:date(2),intended:'Dairy buffalo',actual:'Buffalo purchased for milk sales',functioning:'partly-working',explanation:'Household reports lower milk output and concern about animal health',officerNotes:'Discuss a veterinary referral; no diagnosis made',source:'member',notes:''}],
    ['cases',{id:'demo-worker-followup',personId:'demo-worker-india',sourceKey:'demo-pay-india:short-pay',title:'Discuss reported pay shortfall',action:'Agree a safe contact plan and discuss available worker-support referral',dueDate:today,assigneeId:'admin',source:'worker',agreed:true,notes:'No referral sent automatically'}],
    ['cases',{id:'demo-livelihood-followup',personId:'demo-livelihood-india',assetId:'demo-buffalo-check',title:'Discuss livestock support',action:'Ask whether veterinary support is accessible and agree the next visit',dueDate:addDays(today,3),assigneeId:'admin',source:'member',agreed:true,notes:''}]
  ];
}
