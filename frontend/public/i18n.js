// Initial Filipino coverage for navigation, shared controls and core workflow labels.
// Member names, original field notes and organization-defined question labels are never translated.
const fil={
  'Overview':'Pangkalahatan','Members':'Mga miyembro','Groups':'Mga grupo','Field visits':'Mga pagbisita',
  'Loan register':'Talaan ng pautang','Consent & sharing':'Pahintulot at pagbabahagi','Organization':'Organisasyon',
  'Follow-up cases':'Mga follow-up','Offline records':'Mga offline na tala','Staff accounts':'Mga kawani',
  'Record a visit':'Magtala ng pagbisita','Record visit':'Magtala ng pagbisita','Add member':'Magdagdag ng miyembro',
  'Create group':'Gumawa ng grupo','Record a loan':'Magtala ng pautang','Group meeting':'Pulong ng grupo',
  'Cancel':'Kanselahin','Save record':'I-save ang tala','Save visit':'I-save ang pagbisita','Close':'Isara',
  'Present':'Dumalo','Absent':'Hindi dumalo','Attendance':'Pagdalo','Savings':'Ipon','Repayments':'Mga pagbabayad',
  'Member':'Miyembro','Group':'Grupo','Date':'Petsa','Due date':'Takdang petsa','Status':'Katayuan',
  'Notes':'Mga tala','Assigned to':'Nakatakdang kawani','Open':'Bukas','Resolved':'Nalutas',
  'Receipt':'Resibo','Schedule':'Iskedyul','Correct':'Iwasto','History':'Kasaysayan','Save correction':'I-save ang pagwawasto',
  'Print receipt':'I-print ang resibo','Save preferences':'I-save ang mga setting','Connected':'Konektado',
  'Offline':'Walang koneksyon','Workspace':'Workspace','Community groups':'Mga grupo sa komunidad',
  'Member register':'Talaan ng miyembro','Upcoming meetings':'Mga susunod na pulong',
  'Full name':'Buong pangalan','Livelihood / business':'Kabuhayan / negosyo','Community group':'Grupo sa komunidad',
  'Monthly household income':'Buwanang kita ng sambahayan','Monthly household expenses':'Buwanang gastos ng sambahayan',
  'Household members':'Mga kasapi ng sambahayan','Income earners':'Mga kumikita',
  'Identity document type':'Uri ng dokumento','ID last four digits only':'Huling apat na numero ng ID',
  'Visit date':'Petsa ng pagbisita','Loan being repaid':'Pautang na binabayaran',
  'Principal repayment received':'Natanggap na bayad sa prinsipal','Savings contributed':'Inihulog na ipon',
  'Loan utilisation check':'Pagsuri sa paggamit ng pautang','Group name':'Pangalan ng grupo',
  'Village / location':'Barangay / lugar','Field officer':'Kawani sa komunidad','Next meeting':'Susunod na pulong',
  'Loan purpose':'Layunin ng pautang','Principal amount':'Halaga ng prinsipal','Installment amount':'Halaga ng hulog',
  'Repayment frequency':'Dalas ng pagbabayad','Loan start date':'Petsa ng simula ng pautang',
  'Open follow-up list':'Buksan ang listahan ng follow-up','Member records':'Mga tala ng miyembro',
  'Organization name':'Pangalan ng organisasyon','Country':'Bansa','Currency':'Salapi',
  'Language':'Wika','Sign in':'Mag-sign in','Username':'Username','Password':'Password'
};
export function translate(root,language) {
  document.documentElement.lang=language==='fil'?'fil':'en';if(language!=='fil')return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
  while((node=walker.nextNode())) {
    if(node.parentElement?.closest('[data-no-translate],.member-cell,.meeting-info,.org,.user,.kv,.visit-note'))continue;
    const text=node.textContent.trim();if(fil[text])node.textContent=node.textContent.replace(text,fil[text]);
  }
}
