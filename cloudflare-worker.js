const ALLOWED_ORIGINS = new Set(['https://eanfoundershub.github.io']);
const enc = new TextEncoder();
const securityHeaders = {
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-store',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=()','X-Frame-Options':'DENY'
};
const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const fromB64url = text => Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(text.length/4)*4,'=')),c=>c.charCodeAt(0));
const cors = origin => ALLOWED_ORIGINS.has(origin) ? {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Vary':'Origin'} : {};
const json = (body,status,origin='') => new Response(JSON.stringify(body),{status,headers:{...securityHeaders,...cors(origin),'Content-Type':'application/json; charset=utf-8'}});
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length<=320;
const isAdmin = (email,env) => new Set(String(env.ADMIN_EMAILS||'afcaballero@universidadean.edu.co').toLowerCase().split(',').map(x=>x.trim()).filter(Boolean)).has(email);
const pickPersonId = data => String(data?.idPersona||data?.IDPersona||data?.persona?.IDPersona||data?.persona?.id_persona||'');

async function tokenKey(secret){
  if(!secret||secret.length<32) throw new Error('TOKEN_SECRET no configurado o demasiado corto.');
  return crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
async function signToken(claims,secret){
  const payload=b64url(enc.encode(JSON.stringify({...claims,iat:Math.floor(Date.now()/1000)})));
  const signature=await crypto.subtle.sign('HMAC',await tokenKey(secret),enc.encode(payload));
  return `${payload}.${b64url(signature)}`;
}
async function verifyToken(token,secret){
  const [payload,signature]=String(token||'').split('.');
  if(!payload||!signature) return null;
  const ok=await crypto.subtle.verify('HMAC',await tokenKey(secret),fromB64url(signature),enc.encode(payload));
  if(!ok) return null;
  const claims=JSON.parse(new TextDecoder().decode(fromB64url(payload)));
  return Number(claims.exp)>Math.floor(Date.now()/1000)?claims:null;
}
async function readBody(request,origin){
  const length=Number(request.headers.get('Content-Length')||0);
  if(length>65536) return {error:json({mensaje:'Solicitud demasiado grande.'},413,origin)};
  try{return {body:await request.json()};}catch{return {error:json({mensaje:'Solicitud inválida.'},400,origin)};}
}
async function upstream(url,payload,origin){
  if(!url) return json({mensaje:'Servicio no configurado.'},503,origin);
  try{
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),redirect:'follow'});
    const text=await r.text(); let data;
    try{data=JSON.parse(text);}catch{data={mensaje:'Respuesta no disponible.'};}
    return {response:r,data};
  }catch{return {error:json({mensaje:'Servicio temporalmente no disponible.'},502,origin)};}
}
async function access(request,env,kind,origin){
  const parsed=await readBody(request,origin); if(parsed.error)return parsed.error;
  const body=parsed.body||{},accion=String(body.accion||'').trim().toUpperCase(),correo=String(body.correo||'').trim().toLowerCase(),codigo=String(body.codigo||'').trim();
  if(!validEmail(correo))return json({mensaje:'Correo inválido.'},400,origin);
  if(codigo&&!/^\d{6}$/.test(codigo))return json({mensaje:'Código inválido.'},400,origin);
  const admin=kind==='pa09';
  if(admin&&!['SOLICITAR_CODIGO_ADMIN','VALIDAR_CODIGO_ADMIN'].includes(accion))return json({mensaje:'Acción inválida.'},400,origin);
  if(!admin&&!['SOLICITAR_CODIGO','VALIDAR_CODIGO'].includes(accion))return json({mensaje:'Acción inválida.'},400,origin);
  if(admin&&!isAdmin(correo,env))return json({mensaje:'Acceso no autorizado.'},403,origin);
  const result=await upstream(admin?env.PA09_ADMIN_URL:env.PA08_FLOW_URL,{accion,correo,...(codigo?{codigo}:{})},origin);
  if(result.error)return result.error;
  if(result.response.ok&&accion.startsWith('VALIDAR_CODIGO')){
    const personId=pickPersonId(result.data),scope=admin?'admin':'user';
    result.data.accessToken=await signToken({scope,personId,exp:Math.floor(Date.now()/1000)+(admin?1800:3600)},env.TOKEN_SECRET);
    result.data.expiresIn=admin?1800:3600;
  }
  return json(result.data,result.response.status,origin);
}
async function pa11(request,env,origin){
  const token=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
  let claims; try{claims=await verifyToken(token,env.TOKEN_SECRET);}catch{return json({mensaje:'Seguridad no configurada.'},503,origin);}
  if(!claims)return json({mensaje:'Sesión inválida o vencida.'},401,origin);
  const parsed=await readBody(request,origin);if(parsed.error)return parsed.error;
  const body=parsed.body||{},accion=String(body.accion||'').trim().toUpperCase();
  const adminActions=new Set(['APROVISIONAR','GUARDAR_EXPERIENCIA','GUARDAR_FORMULARIO','VERIFICAR_INSCRIPCION']);
  const userActions=new Set(['LISTAR_EXPERIENCIAS','OBTENER_FORMULARIO','REGISTRAR_INSCRIPCION','GUARDAR_RESPUESTAS']);
  if(!adminActions.has(accion)&&!userActions.has(accion))return json({mensaje:'Acción inválida.'},400,origin);
  if(adminActions.has(accion)&&claims.scope!=='admin')return json({mensaje:'Permiso administrativo requerido.'},403,origin);
  const payload={...body,accion};
  if(['REGISTRAR_INSCRIPCION','GUARDAR_RESPUESTAS'].includes(accion)&&claims.scope!=='admin'){
    if(!claims.personId)return json({mensaje:'La identidad verificada no contiene un identificador.'},422,origin);
    payload.idPersona=claims.personId;
  }
  const result=await upstream(env.PA11_FLOW_URL,payload,origin);
  return result.error||json(result.data,result.response.status,origin);
}

export default {async fetch(request,env){
  const url=new URL(request.url),origin=request.headers.get('Origin')||'';
  if(url.pathname==='/health'&&request.method==='GET')return json({estado:'OK',version:'2.0'},200,origin);
  if(!ALLOWED_ORIGINS.has(origin))return json({mensaje:'Origen no permitido.'},403,origin);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...securityHeaders,...cors(origin)}});
  if(request.method!=='POST')return json({mensaje:'Método no permitido.'},405,origin);
  if(url.pathname==='/api/pa08')return access(request,env,'pa08',origin);
  if(url.pathname==='/api/pa09')return access(request,env,'pa09',origin);
  if(url.pathname==='/api/pa11')return pa11(request,env,origin);
  return json({mensaje:'No encontrado.'},404,origin);
}};

export const testables={signToken,verifyToken,pickPersonId};
