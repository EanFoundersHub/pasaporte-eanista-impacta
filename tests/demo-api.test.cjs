const test = require('node:test');
const assert = require('node:assert/strict');

test('un registro provisional nunca hereda la identidad demostrativa de Laura', async () => {
  const originalWindow = global.window;
  const originalLocation = global.location;
  global.location = {href: 'https://example.test/', origin: 'https://example.test'};
  global.window = {fetch: async () => new Response('{}', {status: 404})};
  delete require.cache[require.resolve('../demo-api.js')];
  require('../demo-api.js');

  const search = await global.window.fetch('/api/identity/search', {
    method: 'POST',
    body: JSON.stringify({
      nombre: 'Felipe Caballero',
      correo: 'caballero066@gmail.com',
      documento: '1015456575'
    })
  }).then(response => response.json());
  assert.equal(search.status, 'not_found');

  const provisional = await global.window.fetch('/api/universal/external', {
    method: 'POST',
    body: JSON.stringify({
      codigo_contexto: 'FOUNDERSHUB-2026',
      nombre: 'Felipe Caballero',
      correo: 'caballero066@gmail.com',
      documento: '1015456575'
    })
  }).then(response => response.json());
  assert.equal(provisional.person.nombre, 'Felipe Caballero');
  assert.equal(provisional.person.correo_personal, 'caballero066@gmail.com');
  assert.equal(provisional.person.documento_mascarado.endsWith('6575'), true);
  assert.equal(provisional.person.nombre.includes('Laura'), false);

  const confirmed = await global.window.fetch('/api/universal/confirm', {
    method: 'POST',
    body: JSON.stringify({token: provisional.token, result: 'CONFIRMADA'})
  }).then(response => response.json());
  assert.equal(confirmed.person.nombre, 'Felipe Caballero');

  const prefill = await global.window.fetch('/api/universal/prefill', {
    method: 'POST',
    body: JSON.stringify({id_persona: provisional.person.id_persona, codigo_contexto: 'FOUNDERSHUB-2026'})
  }).then(response => response.json());
  assert.equal(prefill.values.nombre, 'Felipe Caballero');
  assert.equal(prefill.values.correo, 'caballero066@gmail.com');

  global.window = originalWindow;
  global.location = originalLocation;
});

test('el modo demo deja pasar las solicitudes seguras al Worker', async () => {
  const originalWindow = global.window;
  const originalLocation = global.location;
  let nativeUrl = '';
  global.location = {href: 'https://example.test/', origin: 'https://example.test'};
  global.window = {fetch: async url => {nativeUrl = String(url); return new Response(JSON.stringify({status: 'ok'}), {status: 200});}};
  delete require.cache[require.resolve('../demo-api.js')];
  require('../demo-api.js');
  const response = await global.window.fetch('https://worker.example/api/pa08', {method: 'POST'});
  assert.equal(response.status, 200);
  assert.equal(nativeUrl, 'https://worker.example/api/pa08');
  global.window = originalWindow;
  global.location = originalLocation;
});
