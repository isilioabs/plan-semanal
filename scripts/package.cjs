const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const output=path.join(root,'release');
const artifacts=['index.html','app.html','assets/workspace.js','assets/workspace.css','assets/agency-planner-logo.png'];
if(fs.existsSync(output)){
 for(const entry of fs.readdirSync(output,{recursive:true,withFileTypes:true})){
  if(!entry.isFile())continue;
  const relative=path.relative(output,path.join(entry.parentPath,entry.name)).replaceAll('\\','/');
  if(!artifacts.includes(relative))throw new Error('release/ contiene un archivo ajeno al paquete: '+relative+'. Revisa esa carpeta antes de publicar.');
 }
}
// Explicit artifact list; never copy configuration or source directories into the release.
for(const name of artifacts){
 fs.mkdirSync(path.dirname(path.join(output,name)),{recursive:true});
 fs.copyFileSync(path.join(root,name),path.join(output,name));
}
console.log('Paquete publicable creado en release/. No se ha desplegado.');
