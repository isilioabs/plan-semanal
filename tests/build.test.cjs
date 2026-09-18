const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const F = require('../src/phase0.js');
const read = name => fs.readFileSync(path.join(__dirname,'..',name),'utf8');
test('published artifact includes the current editable controller and no unresolved build placeholders', () => {
  const html = read('index.html');
  const template = JSON.parse(html.match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/)[1]);
  const controller = read('src/component.js').replace('__ACTIONS__',()=>read('src/actions.js'));
  assert.ok(template.includes(controller));
  new vm.Script(controller);
  assert.doesNotMatch(html,/__ACTIONS__|__COMPONENT__|__TEMPLATE__|__MANIFEST__/);
  const assets = JSON.parse(html.match(/<script type="__bundler\/manifest">\s*([\s\S]*?)\s*<\/script>/)[1]);
  const data = zlib.gunzipSync(Buffer.from(assets['b2c112cf-47e0-40a3-8b97-14fca074388f'].data,'base64')).toString('utf8');
  assert.ok(data.includes(read('src/phase0.js')));
  assert.ok(data.includes(read('src/dialogs.js')));
});
test('base configuration is empty and carries no agency seed records', () => {
  const window = {};
  vm.runInNewContext(read('src/data.js'),{window});
  assert.equal(window.PLAN_DATA.eventos.length,0);
  assert.equal(window.PLAN_DATA.descuentos.length,0);
  assert.equal(window.PLAN_DATA.clientes.length,0);
  assert.equal(window.PLAN_DATA.productos.length,0);
});
test('legacy file fixture normalizes without dropping administrative fields', () => {
  const data = F.parse(read('tests/fixtures/legacy-example.json'));
  assert.equal(data.eventos.length,3);
  assert.equal(data.descuentos.length,1);
  assert.equal(data.descuentos[0].publicado,'');
  assert.equal(F.summary(data).total,9000);
  assert.equal(F.summary(data).missing,1);
});
