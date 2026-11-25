import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(path.join(here,'..','cloudflare-worker.js'),'utf8');
const worker=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const secret='0123456789abcdef0123456789abcdef';

test('firma y valida tokens temporales sin exponer el secreto',async()=>{
  const token=await worker.testables.signToken({scope:'admin',exp:Math.floor(Date.now()/1000)+60},secret);
  assert.equal(token.split('.').length,2);
  assert.equal((await worker.testables.verifyToken(token,secret)).scope,'admin');
  assert.equal(await worker.testables.verifyToken(`${token}x`,secret),null);
});

test('rechaza tokens vencidos',async()=>{
  const token=await worker.testables.signToken({scope:'user',exp:1},secret);
  assert.equal(await worker.testables.verifyToken(token,secret),null);
});

test('rechaza orÃ­genes no autorizados antes de consultar Microsoft',async()=>{
  const request=new Request('https://worker.example/api/pa11',{method:'POST',headers:{Origin:'https://sitio-malicioso.example','Content-Type':'application/json'},body:'{}'});
  const response=await worker.default.fetch(request,{TOKEN_SECRET:secret});
  assert.equal(response.status,403);
});

test('una sesiÃ³n de usuario no puede aprovisionar SharePoint',async()=>{
  const token=await worker.testables.signToken({scope:'user',personId:'P1',exp:Math.floor(Date.now()/1000)+60},secret);
  const request=new Request('https://worker.example/api/pa11',{method:'POST',headers:{Origin:'https://eanfoundershub.github.io',Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({accion:'APROVISIONAR'})});
  const response=await worker.default.fetch(request,{TOKEN_SECRET:secret});
  assert.equal(response.status,403);
});

test('la inscripciÃ³n usa la identidad firmada y no el ID enviado por el navegador',async()=>{
  const token=await worker.testables.signToken({scope:'user',personId:'P-VERIFICADA',exp:Math.floor(Date.now()/1000)+60},secret);
  let forwarded;
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async(_url,options)=>{forwarded=JSON.parse(options.body);return new Response(JSON.stringify({estado:'INSCRITO'}),{status:201,headers:{'Content-Type':'application/json'}});};
  try{
    const request=new Request('https://worker.example/api/pa11',{method:'POST',headers:{Origin:'https://eanfoundershub.github.io',Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({accion:'REGISTRAR_INSCRIPCION',idPersona:'P-FALSIFICADA',idExperiencia:'E1'})});
    const response=await worker.default.fetch(request,{TOKEN_SECRET:secret,PA11_FLOW_URL:'https://powerautomate.example/pa11'});
    assert.equal(response.status,201);assert.equal(forwarded.idPersona,'P-VERIFICADA');
  }finally{globalThis.fetch=originalFetch;}
});

test('las respuestas usan la identidad firmada y no el ID enviado por el navegador',async()=>{
  const token=await worker.testables.signToken({scope:'user',personId:'P-VERIFICADA',exp:Math.floor(Date.now()/1000)+60},secret);
  let forwarded;const originalFetch=globalThis.fetch;
  globalThis.fetch=async(_url,options)=>{forwarded=JSON.parse(options.body);return new Response(JSON.stringify({estado:'RESPUESTA_GUARDADA'}),{status:201,headers:{'Content-Type':'application/json'}});};
  try{const request=new Request('https://worker.example/api/pa11',{method:'POST',headers:{Origin:'https://eanfoundershub.github.io',Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({accion:'GUARDAR_RESPUESTAS',idPersona:'P-FALSIFICADA',idInscripcion:'I1',idFormulario:'F1',respuestas:{a:'b'}})});const response=await worker.default.fetch(request,{TOKEN_SECRET:secret,PA11_FLOW_URL:'https://powerautomate.example/pa11'});assert.equal(response.status,201);assert.equal(forwarded.idPersona,'P-VERIFICADA');}
  finally{globalThis.fetch=originalFetch;}
});

test('los adjuntos usan la identidad firmada y el cambio a PARTICIPANDO exige administrador',async()=>{
  const user=await worker.testables.signToken({scope:'user',personId:'P-VERIFICADA',exp:Math.floor(Date.now()/1000)+60},secret);let forwarded;const originalFetch=globalThis.fetch;
  globalThis.fetch=async(_url,options)=>{forwarded=JSON.parse(options.body);return new Response(JSON.stringify({estado:'OK'}),{status:200,headers:{'Content-Type':'application/json'}});};
  try{let request=new Request('https://worker.example/api/pa11',{method:'POST',headers:{Origin:'https://eanfoundershub.github.io',Authorization:`Bearer ${user}`,'Content-Type':'application/json'},body:JSON.stringify({accion:'GUARDAR_ADJUNTO',idPersona:'P-FALSA',idInscripcion:'I1',contenidoBase64:'AA=='})});let response=await worker.default.fetch(request,{TOKEN_SECRET:secret,PA11_FLOW_URL:'https://powerautomate.example/pa11'});assert.equal(response.status,200);assert.equal(forwarded.idPersona,'P-VERIFICADA');request=new Request('https://worker.example/api/pa11',{method:'POST',headers:{Origin:'https://eanfoundershub.github.io',Authorization:`Bearer ${user}`,'Content-Type':'application/json'},body:JSON.stringify({accion:'MARCAR_PARTICIPANDO',idInscripcion:'I1'})});response=await worker.default.fetch(request,{TOKEN_SECRET:secret,PA11_FLOW_URL:'https://powerautomate.example/pa11'});assert.equal(response.status,403);}
  finally{globalThis.fetch=originalFetch;}
});

test('el pasaporte usa la identidad firmada y la selecciÃ³n requiere administrador',async()=>{
  const user=await worker.testables.signToken({scope:'user',personId:'P-VERIFICADA',exp:Math.floor(Date.now()/1000)+60},secret);let forwarded;const originalFetch=globalThis.fetch;
  globalThis.fetch=async(_url,options)=>{forwarded=JSON.parse(options.body);return new Response(JSON.stringify({estado:'OK'}),{status:200,headers:{'Content-Type':'application/json'}});};
  try{
    let request=new Request('https://worker.example/api/pa11',{method:'POST',headers:{Origin:'https://eanfoundershub.github.io',Authorization:`Bearer ${user}`,'Content-Type':'application/json'},body:JSON.stringify({accion:'OBTENER_PASAPORTE',idPersona:'P-FALSA'})});
    let response=await worker.default.fetch(request,{TOKEN_SECRET:secret,PA11_FLOW_URL:'https://powerautomate.example/pa11'});assert.equal(response.status,200);assert.equal(forwarded.idPersona,'P-VERIFICADA');
    request=new Request('https://worker.example/api/pa11',{method:'POST',headers:{Origin:'https://eanfoundershub.github.io',Authorization:`Bearer ${user}`,'Content-Type':'application/json'},body:JSON.stringify({accion:'MARCAR_SELECCIONADO',idInscripcion:'I1'})});
    response=await worker.default.fetch(request,{TOKEN_SECRET:secret,PA11_FLOW_URL:'https://powerautomate.example/pa11'});assert.equal(response.status,403);
  }finally{globalThis.fetch=originalFetch;}
});

