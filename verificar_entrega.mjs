import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const required=['index.html','admin.html','admin-experiencias.html','styles.css','app.js','admin-live.js','form-builder.js','api-client.js','cloudflare-worker.js','runtime-config.js','assets/ean-impacta-color.png'];
const missing=required.filter(file=>!fs.existsSync(path.join(root,file)));
const textFiles=required.filter(x=>/\.(?:html|js|css)$/.test(x));
const findings=[];
for(const file of textFiles){
  const text=fs.readFileSync(path.join(root,file),'utf8');
  for(const pattern of [/logic\.azure\.com[^'"\s]*/ig,/sig=[A-Za-z0-9%_-]+/ig,/sharedAccessSignature/ig]){
    const matches=text.match(pattern)||[]; if(matches.length)findings.push({file,pattern:String(pattern),count:matches.length});
  }
}
const html=fs.readFileSync(path.join(root,'admin-experiencias.html'),'utf8');
const checks={
  archivos_requeridos:missing.length===0,
  sin_url_firmada:findings.length===0,
  constructor_carga_api:/api-client\.js/.test(html),
  constructor_carga_config:/runtime-config\.js/.test(html),
  worker_tiene_pa11:/\/api\/pa11/.test(fs.readFileSync(path.join(root,'cloudflare-worker.js'),'utf8')),
  worker_firma_tokens:/HMAC/.test(fs.readFileSync(path.join(root,'cloudflare-worker.js'),'utf8'))
};
for(const [name,value] of Object.entries(checks))console.log(`${name}=${value}`);
if(missing.length)console.error('Faltantes:',missing.join(', '));
if(findings.length)console.error('Posibles secretos:',JSON.stringify(findings));
if(Object.values(checks).some(x=>!x))process.exit(2);
