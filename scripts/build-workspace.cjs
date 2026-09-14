const fs=require('node:fs');
const path=require('node:path');
const esbuild=require('esbuild');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const configPath=path.join(root,'config/public.local.json');
const config=JSON.parse(fs.readFileSync(fs.existsSync(configPath)?configPath:path.join(root,'config/public.example.json'),'utf8'));
// The browser config must contain only explicitly public properties.
const allowed=['supabaseUrl','supabasePublishableKey','providers','environment'];
if(Object.keys(config).some(k=>!allowed.includes(k)))throw new Error('Propiedad inesperada en la configuración pública. No incluyas secretos.');
const key=config.supabasePublishableKey||'';
if(key.startsWith('sb_secret_'))throw new Error('Una clave secreta no se puede publicar.');
if(key&&!key.startsWith('sb_publishable_')){
 let role;try{role=JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role;}catch{}
 if(role!=='anon')throw new Error('Solo se admite la clave publicable o anon.');
}
fs.mkdirSync(path.join(root,'assets'),{recursive:true});
const result=esbuild.buildSync({absWorkingDir:root,tsconfigRaw:{},entryPoints:['./src/workspace/main.js'],bundle:true,minify:true,write:false,format:'iife',target:['es2022'],alias:{'agency-config':fs.existsSync(configPath)?'./config/public.local.json':'./config/public.example.json'}});
fs.writeFileSync(path.join(root,'assets/workspace.js'),result.outputFiles[0].contents);
fs.copyFileSync(path.join(root,'src/workspace/style.css'),path.join(root,'assets/workspace.css'));
const fingerprint=name=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex').slice(0,12);
const page=fs.readFileSync(path.join(root,'src/workspace/app.html'),'utf8')
 .replace('assets/workspace.js','assets/workspace.js?v='+fingerprint('assets/workspace.js'))
 .replace('assets/workspace.css','assets/workspace.css?v='+fingerprint('assets/workspace.css'));
fs.writeFileSync(path.join(root,'app.html'),page);
console.log('app.html + assets/ generados · '+(config.supabaseUrl?'Conexión configurada':'Supabase pendiente de configurar'));
