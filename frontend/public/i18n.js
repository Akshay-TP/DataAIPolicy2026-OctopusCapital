// The current India interface has one reviewed language. Personal text is never relabelled.
import {dictionaries} from './translations.js';
const preferenceKey=s=>s?.user&&s?.config?.workspaceId?'fl-language-'+s.config.workspaceId+'-'+s.user.id:'fl-login-language';
export const activeLanguage=()=> 'en';
export const languagePicker=()=> '';
export const t=text=>dictionaries.en[text]||text;
export function rememberLanguage(code,state){if(code==='en')try{localStorage.setItem(preferenceKey(state),code);}catch{}}
export function translate(root){
  if(!root)return;
  document.documentElement.lang='en';document.documentElement.dir='ltr';
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  for(let node;node=walker.nextNode();){
    if(node.parentElement?.closest('[data-no-translate],.member-cell,.meeting-info,.org,.user,.visit-note'))continue;
    const value=node.textContent.trim(),label=dictionaries.en[value];
    if(label)node.textContent=node.textContent.replace(value,label);
  }
}
