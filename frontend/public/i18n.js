import {LANGUAGES} from '../../shared/catalog.mjs';
import {dictionaries} from './translations.js';
// Fixed translations with English fallback. No external translation service.
// Member names, original field notes and organization-defined question labels are never translated.
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
  if(LANGUAGES.length<2)return '';
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
