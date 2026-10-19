import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LANGUAGES} from '../shared/catalog.mjs';
import {dictionaries} from '../frontend/public/translations.js';
import {activeLanguage,rememberLanguage,t,translate} from '../frontend/public/i18n.js';

test('all eight languages cover the core actions and retain English fallback',()=>{
  assert.equal(LANGUAGES.length,8);
  for(const language of LANGUAGES)for(const key of ['Overview','Currency','Members','Household currency','Loan currency','Collection currency','Save meeting','Print receipt','Language'])assert.ok(dictionaries[language.code][key]);
  assert.equal(t('Overview','hi'),'सारांश');assert.equal(t('Overview','zh-Hant'),'總覽');assert.equal(t('Unknown guidance','vi'),'Unknown guidance');assert.equal(t('present','id'),'Hadir');
});
test('language preferences are separate for each workspace and account',()=>{
  const storage=new Map();globalThis.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
  const a={config:{workspaceId:'w',language:'en'},user:{id:'a'}},b={...a,user:{id:'b'}};
  rememberLanguage('hi',a);assert.equal(activeLanguage(a),'hi');assert.equal(activeLanguage(b),'en');
  rememberLanguage('zh-Hant',b);assert.equal(activeLanguage(b),'zh-Hant');assert.equal(activeLanguage(a),'hi');
  rememberLanguage('invalid',a);assert.equal(activeLanguage(a),'hi');
});
test('switching a live view back to English restores source labels and preserves member text',()=>{
  const label={textContent:'Members',parentElement:{closest:()=>false}},member={textContent:'Members',parentElement:{closest:()=>true}};
  const root={querySelectorAll:()=>[]};globalThis.NodeFilter={SHOW_TEXT:4};globalThis.document={documentElement:{},createTreeWalker:()=>{const nodes=[label,member];return {nextNode:()=>nodes.shift()||null};}};
  translate(root,'hi');assert.equal(label.textContent,'सदस्य');assert.equal(member.textContent,'Members');
  translate(root,'zh-Hant');assert.equal(label.textContent,'成員');translate(root,'en');assert.equal(label.textContent,'Members');assert.equal(document.documentElement.lang,'en');
});
