export function seed() {
  const groups = [
    {id:'GRP-001', name:'Sampaguita Circle', location:'San Isidro, Laguna', officer:'Maya Santos', day:'Thursday', nextMeeting:'2026-10-15', time:'09:00', color:'teal'},
    {id:'GRP-002', name:'Bayanihan Women', location:'Calauan, Laguna', officer:'Maya Santos', day:'Friday', nextMeeting:'2026-10-16', time:'10:30', color:'purple'},
    {id:'GRP-003', name:'Pag-asa Collective', location:'Bay, Laguna', officer:'Lina Reyes', day:'Monday', nextMeeting:'2026-10-19', time:'09:30', color:'orange'}
  ];
  const names = ['Elena Cruz','Rosa Mendoza','Ana Reyes','Luz Garcia','Maribel Santos','Celia Ramos','Nora Flores','Lorna Bautista','Grace Aquino','Teresa Lopez','Alma Dela Cruz','Dina Castillo','Fe Navarro','Lina Torres','Mila Perez','Nena Rivera','Olivia Diaz','Pilar Romero','Rita Gonzales','Sara Villanueva','Tess Mercado','Vina Soriano','Wena Lim','Yolanda Castro'];
  const businesses = ['Sari-sari store','Vegetable growing','Food stall','Dairy farming','Tailoring','Market trading'];
  const members = names.map((name,i) => ({id:`MEM-${String(i+1).padStart(3,'0')}`,name,groupId:groups[Math.floor(i/8)].id,business:businesses[i%6],income:12500+i*320,expenses:8900+i*170,household:3+i%4,earners:1+i%2,kycVerified:i!==4,identityType:'Local government ID',identitySuffix:String(7100+i),joined:'2026-07-02',consent:null}));
  const loans = members.filter((_,i)=>i%4!==3).map((m,i)=>({id:`LN-${String(i+1).padStart(3,'0')}`,memberId:m.id,principal:10000+i*500,installment:500+i*25,frequency:'weekly',purpose:m.business,date:'2026-08-20',status:'active'}));
  const visits = [];
  members.forEach((m,i) => {
    const loan = loans.find(l=>l.memberId===m.id);
    for (let w=0;w<8;w++) {
      const date = new Date(Date.UTC(2026,7,20+w*7)).toISOString().slice(0,10);
      const missed = (i===2 && w>4) || (i===12 && w%3===0);
      visits.push({id:`seed-${i}-${w}`,memberId:m.id,loanId:loan?.id||null,date,attendance:missed?'absent':'present',due:loan?.installment||0,paid:missed?0:loan?.installment||0,savings:missed?0:100+i%3*25,utilisation:w===7?(i===2?'follow-up':loan?'verified':'not-checked'):'not-checked',note:w===7&&i===2?'Stock purchase delayed. Arrange a supportive follow-up visit.':'',officer:'Maya Santos',createdAt:date+'T10:00:00.000Z'});
    }
  });
  return {settings:{name:'Bayanihan Community Foundation',country:'Philippines',currency:'PHP',locale:'en-PH'},groups,members,loans,visits,audit:[{id:'initial',at:'2026-10-15T00:00:00.000Z',actor:'System',action:'Synthetic demonstration workspace created'}]};
}
