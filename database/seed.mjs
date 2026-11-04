export function seed() {
  const groups = [
    {id:'GRP-001', name:'Udaan Savings Group', location:'Nagpur', officer:'Asha Patil', day:'Thursday', nextMeeting:'2026-10-15', time:'09:00', color:'teal'},
    {id:'GRP-002', name:'Sakhi Community Group', location:'Bhandara', officer:'Asha Patil', day:'Friday', nextMeeting:'2026-10-16', time:'10:30', color:'purple'},
    {id:'GRP-003', name:'Pragati Livelihood Group', location:'Gondia', officer:'Meera Shah', day:'Monday', nextMeeting:'2026-10-19', time:'09:30', color:'orange'}
  ];
  const names = ['Sunita Patil','Rekha Sharma','Anita Devi','Meena Yadav','Pooja Singh','Kavita Joshi','Sushma Rao','Lata Pawar','Usha Mishra','Geeta Patel','Savita More','Nirmala Das','Shobha Jadhav','Asha Gupta','Seema Verma','Rani Kumari','Manju Sahu','Radha Chauhan','Kamala Sen','Sarita Naik','Vandana Roy','Pushpa Thakur','Sangeeta Jain','Mala Biswas'];
  const businesses = ['Village grocery shop','Vegetable growing','Food stall','Poultry raising','Tailoring','Market trading'];
  const members = names.map((name,i) => ({id:`MEM-${String(i+1).padStart(3,'0')}`,name,currency:'INR',groupId:groups[Math.floor(i/8)].id,business:businesses[i%6],income:18000+i*300,expenses:14000+i*200,household:3+i%4,earners:1+i%2,kycVerified:i!==4,identityType:'Aadhaar',identitySuffix:String(7100+i),joined:'2026-07-02',consent:null}));
  const loans = members.filter((_,i)=>i%4!==3).map((m,i)=>({id:`LN-${String(i+1).padStart(3,'0')}`,memberId:m.id,currency:'INR',principal:30000+i*1000,installment:1500+i*50,frequency:'weekly',purpose:m.business,date:'2026-08-20',status:'active'}));
  const visits = [];
  members.forEach((m,i) => {
    const loan = loans.find(l=>l.memberId===m.id);
    for (let w=0;w<8;w++) {
      const date = new Date(Date.UTC(2026,7,20+w*7)).toISOString().slice(0,10);
      const missed = (i===2 && w>4) || (i===12 && w%3===0);
      visits.push({id:`seed-${i}-${w}`,memberId:m.id,currency:'INR',loanId:loan?.id||null,date,attendance:missed?'absent':'present',due:loan?.installment||0,paid:missed?0:loan?.installment||0,savings:missed?0:200+i%3*50,utilisation:w===7?(i===2?'follow-up':loan?'verified':'not-checked'):'not-checked',note:w===7&&i===2?'Stock purchase delayed. Arrange a supportive follow-up visit.':'',officer:'Asha Patil',createdAt:date+'T10:00:00.000Z'});
    }
  });
  return {settings:{name:'FieldLedger India · Demonstration',country:'India',currency:'INR',locale:'en-IN'},groups,members,loans,visits,audit:[{id:'initial',at:'2026-10-15T00:00:00.000Z',actor:'System',action:'Synthetic demonstration workspace created'}]};
}
