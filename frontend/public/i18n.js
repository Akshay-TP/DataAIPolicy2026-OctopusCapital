import {LANGUAGES} from '../../shared/catalog.mjs';
import {dictionaries} from './translations.js';
// Fixed translations with English fallback. No external translation service.
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
Object.assign(dictionaries.fil,{...fil,...dictionaries.fil});
const originalText=new WeakMap(),originalAttributes=new WeakMap();
const supported=code=>LANGUAGES.some(l=>l.code===code);
const preferenceKey=s=>s?.user&&s?.config?.workspaceId?'fl-language-'+s.config.workspaceId+'-'+s.user.id:'fl-login-language';
export function activeLanguage(s) {
  let stored;try{stored=localStorage.getItem(preferenceKey(s))||localStorage.getItem('fl-login-language');}catch{}
  return supported(stored)?stored:supported(s?.config?.language)?s.config.language:'en';
}
export function rememberLanguage(code,s){if(!supported(code))return;localStorage.setItem(preferenceKey(s),code);}
export function t(text,language='en'){
  const enums={present:'Present',absent:'Absent',excused:'Excused absence',open:'Open',resolved:'Resolved',paid:'Paid',partial:'Partial',overdue:'Overdue',upcoming:'Upcoming',active:'Active',disabled:'Disabled',verified:'Verified',weekly:'Weekly',fortnightly:'Fortnightly',monthly:'Monthly'};
  const dictionary=dictionaries[language];
  return dictionary?.[text]||dictionary?.[enums[text]]||dictionary?.[Object.keys(dictionary||{}).find(key=>key.toLowerCase()===text.toLowerCase())]||text;
}
export function languagePicker(language) {
  return `<label class="language-picker"><span class="sr-only">Language</span><select class="language-select" aria-label="Language">${LANGUAGES.map(l=>`<option value="${l.code}"${l.code===language?' selected':''}>${l.name}</option>`).join('')}</select></label>`;
}
export function translate(root,language) {
  if(!root)return;document.documentElement.lang=supported(language)?language:'en';document.documentElement.dir='ltr';
  const excluded='[data-no-translate],.member-cell,.meeting-info,.org,.user,.visit-note,.language-picker';
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
  while((node=walker.nextNode())) {
    if(node.parentElement?.closest(excluded))continue;
    if(!originalText.has(node))originalText.set(node,node.textContent);
    const original=originalText.get(node),text=original.trim();node.textContent=original.replace(text,t(text,language));
  }
  for(const element of root.querySelectorAll('[placeholder],[aria-label],[title]')) {
    if(element.closest(excluded))continue;
    if(!originalAttributes.has(element))originalAttributes.set(element,Object.fromEntries(['placeholder','aria-label','title'].filter(k=>element.hasAttribute(k)).map(k=>[k,element.getAttribute(k)])));
    for(const [key,value] of Object.entries(originalAttributes.get(element)))element.setAttribute(key,t(value,language));
  }
}
