import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGES } from '../shared/catalog.mjs';
import { activeLanguage, rememberLanguage, t, translate, languagePicker } from '../frontend/public/i18n.js';

test('India interface offers English and ignores obsolete language preferences', () => {
  const storage = new Map([['fl-login-language', 'fil']]);
  globalThis.localStorage = {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
  };
  assert.deepEqual(LANGUAGES, [{ code: 'en', name: 'English', locale: 'en-IN' }]);
  assert.equal(activeLanguage({ config: { language: 'km' } }), 'en');
  assert.equal(languagePicker('en'), '');
  assert.equal(t('not-recorded'), 'Not recorded');
  assert.equal(t('Unmapped household text'), 'Unmapped household text');
});

test('preferences remain account-scoped and unsupported options cannot be saved', () => {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
  };
  const a = { config: { workspaceId: 'w' }, user: { id: 'a' } },
    b = { ...a, user: { id: 'b' } };
  rememberLanguage('en', a);
  rememberLanguage('fil', b);
  rememberLanguage('km', b);
  assert.equal(storage.get('fl-language-w-a'), 'en');
  assert.equal(storage.has('fl-language-w-b'), false);
  assert.equal(activeLanguage(b), 'en');
});

test('English labels remain readable without changing personal record text', () => {
  const label = { textContent: 'not-recorded', parentElement: { closest: () => false } },
    member = { textContent: 'not-recorded', parentElement: { closest: () => true } };
  const root = { querySelectorAll: () => [] };
  globalThis.NodeFilter = { SHOW_TEXT: 4 };
  globalThis.document = {
    documentElement: {},
    createTreeWalker: () => {
      const nodes = [label, member];
      return { nextNode: () => nodes.shift() || null };
    },
  };
  translate(root, 'en');
  assert.equal(label.textContent, 'Not recorded');
  assert.equal(member.textContent, 'not-recorded');
  assert.equal(document.documentElement.lang, 'en');
});
