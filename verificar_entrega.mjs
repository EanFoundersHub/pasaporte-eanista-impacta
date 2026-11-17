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
const deployWorkflow=fs.readFileSync(path.join(root,'.github/workflows/pages.yml'),'utf8');
const publicIndex=fs.readFileSync(path.join(root,'index.html'),'utf8');
const checks={
  archivos_requeridos:missing.length===0,
  sin_url_firmada:findings.length===0,
  constructor_carga_api:/api-client\.js/.test(html),
  constructor_carga_config:/runtime-config\.js/.test(html),
  worker_tiene_pa11:/\/api\/pa11/.test(fs.readFileSync(path.join(root,'cloudflare-worker.js'),'utf8')),
  worker_firma_tokens:/HMAC/.test(fs.readFileSync(path.join(root,'cloudflare-worker.js'),'utf8')),
  pages_publica_cliente_api:/cp .*api-client\.js/.test(deployWorkflow),
  pages_configura_pa11:/pa11Url/.test(deployWorkflow),
  pages_verifica_cliente_api:/test -s _site\/api-client\.js/.test(deployWorkflow),
  codigo_oculto_hasta_envio:/id="experience-code-step" class="access-code-step hidden"/.test(publicIndex),
  reenvio_con_limite:/RESEND_MAX_ATTEMPTS = 3/.test(fs.readFileSync(path.join(root,'app.js'),'utf8')),
  reenvio_espera_120s:/RESEND_COOLDOWN_MS = 120000/.test(fs.readFileSync(path.join(root,'app.js'),'utf8')),
  placeholders_sin_espaciado:/input::placeholder\{letter-spacing:normal/.test(fs.readFileSync(path.join(root,'styles.css'),'utf8'))
};
for(const [name,value] of Object.entries(checks))console.log(`${name}=${value}`);
if(missing.length)console.error('Faltantes:',missing.join(', '));
if(findings.length)console.error('Posibles secretos:',JSON.stringify(findings));
if(Object.values(checks).some(x=>!x))process.exit(2);
