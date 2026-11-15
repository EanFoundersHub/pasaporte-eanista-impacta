const ALLOWED_ORIGIN = 'https://eanfoundershub.github.io';

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

function cors(origin) {
  return origin === ALLOWED_ORIGIN ? {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  } : {};
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {...securityHeaders, ...cors(origin), 'Content-Type': 'application/json; charset=utf-8'}
  });
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 320;
}

async function forward(request, env, kind) {
  const origin = request.headers.get('Origin') || '';
  if (origin !== ALLOWED_ORIGIN) return json({mensaje:'Origen no permitido.'}, 403, origin);
  if (request.method === 'OPTIONS') return new Response(null, {status:204, headers:{...securityHeaders, ...cors(origin)}});
  if (request.method !== 'POST') return json({mensaje:'Método no permitido.'}, 405, origin);
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > 4096) return json({mensaje:'Solicitud demasiado grande.'}, 413, origin);

  let body;
  try { body = await request.json(); } catch { return json({mensaje:'Solicitud inválida.'}, 400, origin); }
  const accion = String(body.accion || '').trim().toUpperCase();
  const correo = String(body.correo || '').trim().toLowerCase();
  const codigo = String(body.codigo || '').trim();
  if (!validEmail(correo)) return json({mensaje:'Correo inválido.'}, 400, origin);
  if (codigo && !/^\d{6}$/.test(codigo)) return json({mensaje:'Código inválido.'}, 400, origin);

  let upstreamUrl;
  let payload;
  if (kind === 'pa09') {
    if (!['SOLICITAR_CODIGO_ADMIN','VALIDAR_CODIGO_ADMIN'].includes(accion)) return json({mensaje:'Acción inválida.'}, 400, origin);
    if (correo !== 'afcaballero@universidadean.edu.co') return json({mensaje:'Acceso no autorizado.'}, 403, origin);
    upstreamUrl = env.PA09_ADMIN_URL;
    payload = {accion, correo, codigo};
  } else {
    if (!['SOLICITAR_CODIGO','VALIDAR_CODIGO'].includes(accion)) return json({mensaje:'Acción inválida.'}, 400, origin);
    upstreamUrl = env.PA08_FLOW_URL;
    payload = codigo ? {accion, correo, codigo} : {accion, correo};
  }
  if (!upstreamUrl) return json({mensaje:'Servicio no configurado.'}, 503, origin);

  try {
    const upstream = await fetch(upstreamUrl, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload),
      redirect:'follow'
    });
    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); } catch { data = {mensaje:'Respuesta no disponible.'}; }
    return json(data, upstream.status, origin);
  } catch {
    return json({mensaje:'Servicio temporalmente no disponible.'}, 502, origin);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health' && request.method === 'GET') return json({estado:'OK'}, 200, '');
    if (url.pathname === '/api/pa08') return forward(request, env, 'pa08');
    if (url.pathname === '/api/pa09') return forward(request, env, 'pa09');
    return json({mensaje:'No encontrado.'}, 404, request.headers.get('Origin') || '');
  }
};
