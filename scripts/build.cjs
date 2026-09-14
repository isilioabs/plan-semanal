const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = value => JSON.stringify(value).replace(/</g, '\\u003c');
const manifest = JSON.parse(read('src/vendor-assets.json'));
const data = ['src/data.js', 'src/phase0.js', 'src/dialogs.js'].map(read).join('\n;\n');
manifest['b2c112cf-47e0-40a3-8b97-14fca074388f'] = {
  mime: 'application/javascript',
  compressed: true,
  data: zlib.gzipSync(Buffer.from(data)).toString('base64')
};
const component = read('src/component.js').replace('__ACTIONS__', () => read('src/actions.js'));
const template = read('src/template.html').replace('__COMPONENT__', () => component);
const output = read('src/shell.html')
  .replace('__MANIFEST__', () => json(manifest))
  .replace('__TEMPLATE__', () => json(template));
fs.writeFileSync(path.join(root, 'index.html'), output);
console.log('index.html generado desde src/');
require('./build-workspace.cjs');
