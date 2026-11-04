import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LANGUAGES} from '../shared/catalog.mjs';
import {dictionaries} from '../frontend/public/translations.js';
import {activeLanguage,rememberLanguage,t,translate} from '../frontend/public/i18n.js';

test('English and Filipino cover the core actions and retain English fallback',()=>{
  assert.equal(LANGUAGES.length,2);
  for(const language of LANGUAGES)for(const key of ['Overview','Currency','Members','Household currency','Loan currency','Collection currency','Save meeting','Print receipt','Language'])assert.ok(dictionaries[language.code][key]);
  assert.deepEqual(Object.keys(dictionaries),['en','fil']);assert.equal(t('Overview','fil'),'Pangkalahatan');assert.equal(t('Unknown guidance','fil'),'Unknown guidance');assert.equal(t('Household support','fil'),'Suporta sa sambahayan');
});
test('language preferences are separate for each workspace and account',()=>{
  const storage=new Map();globalThis.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
  const a={config:{workspaceId:'w',language:'en'},user:{id:'a'}},b={...a,user:{id:'b'}};
  rememberLanguage('fil',a);assert.equal(activeLanguage(a),'fil');assert.equal(activeLanguage(b),'en');
  rememberLanguage('en',b);assert.equal(activeLanguage(b),'en');assert.equal(activeLanguage(a),'fil');
  rememberLanguage('invalid',a);assert.equal(activeLanguage(a),'fil');
});
test('switching a live view back to English restores source labels and preserves member text',()=>{
  const label={textContent:'Members',parentElement:{closest:()=>false}},member={textContent:'Members',parentElement:{closest:()=>true}};
  const root={querySelectorAll:()=>[]};globalThis.NodeFilter={SHOW_TEXT:4};globalThis.document={documentElement:{},createTreeWalker:()=>{const nodes=[label,member];return {nextNode:()=>nodes.shift()||null};}};
  translate(root,'fil');assert.equal(label.textContent,'Mga miyembro');assert.equal(member.textContent,'Members');
  translate(root,'en');assert.equal(label.textContent,'Members');assert.equal(document.documentElement.lang,'en');
});
