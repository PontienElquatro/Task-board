import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../supabase/functions/_shared/notification-email.ts', import.meta.url), 'utf8');
const context = { URL, Date };
vm.runInNewContext(stripTypeScriptTypes(source.replace(/^export /gm, '')), context);
const { invitationEmail, assignmentEmail } = context;
const fixture = { teamName: 'TheDev', role: 'member', acceptUrl: 'https://maat.example/team?invitation=fixture&token=fake', expiresAt: '2099-01-01T12:00:00Z' };

test('invitation has a French HTML and plain text version with branding and expiry', () => {
  const email = invitationEmail(fixture);
  assert.match(email.html, /lang="fr"/);
  assert.match(email.html, /width=device-width/);
  assert.match(email.html, /max-width:560px/);
  assert.match(email.html, /#312e81/);
  assert.match(email.html, /Ma’at by El_Quatro Technology/);
  assert.match(email.text, /2099-01-01 à 12:00 UTC/);
  assert.ok(email.text.includes(fixture.acceptUrl));
  assert.match(email.html, /invitation=fixture&amp;token=fake/);
});

test('team names cannot inject HTML or multiline subjects', () => {
  const email = invitationEmail({ ...fixture, teamName: '<img src=x onerror="alert(1)">\r\nInjected: yes' });
  assert.doesNotMatch(email.html, /<img/);
  assert.match(email.html, /&lt;img/);
  assert.doesNotMatch(email.subject, /[\r\n]/);
});

test('all supported invitation roles have readable French labels', () => {
  for (const [role, label] of [['admin', 'administrateur'], ['member', 'membre'], ['viewer', 'observateur']]) {
    assert.ok(invitationEmail({ ...fixture, role }).text.includes(label));
  }
  assert.throws(() => invitationEmail({ ...fixture, role: 'owner' }), /Rôle/);
  assert.throws(() => invitationEmail({ ...fixture, role: '__proto__' }), /Rôle/);
});

test('unsafe links and invalid expiry fail closed', () => {
  for (const acceptUrl of ['javascript:alert(1)', 'http://maat.example', 'https://user:password@maat.example', 'https://maat.example:8443']) {
    assert.throws(() => invitationEmail({ ...fixture, acceptUrl }));
  }
  assert.throws(() => invitationEmail({ ...fixture, expiresAt: 'not-a-date' }), /Expiration/);
});

test('assignment preview is generic and targets the existing team projects route', () => {
  const email = assignmentEmail('https://maat.example');
  assert.match(email.text, /https:\/\/maat.example\/team-projects/);
  assert.match(email.text, /Paramètres → Notifications/);
  assert.doesNotMatch(email.html, /<script|<img|tracking|unsubscribe=/);
  assert.match(email.html, /Voir mes projets d’équipe/);
});

test('assignment origins reject paths, queries and fragments', () => {
  for (const origin of ['https://maat.example/path', 'https://maat.example?redirect=evil', 'https://maat.example#fragment']) {
    assert.throws(() => assignmentEmail(origin), /Origine/);
  }
});
