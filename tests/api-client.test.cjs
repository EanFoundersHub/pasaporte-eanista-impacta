const test=require('node:test');
const assert=require('node:assert/strict');
const api=require('../api-client.js');

function response(data,status=200){return {ok:status>=200&&status<300,status,json:async()=>data};}
function mockFetch(handler){global.fetch=async(url,options={})=>handler(String(url),options);}

test.beforeEach(()=>{const data=new Map();global.sessionStorage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)};global.PASAPORTE_CONFIG={apiBaseUrl:'https://example.test',pa08Url:'https://worker.test/api/pa08',pa09AdminUrl:'https://worker.test/api/pa09',pa11Url:'https://worker.test/api/pa11',timeoutMs:500};});

test('busca una persona sin enviar datos en la URL',async()=>{
  mockFetch((url,options)=>{assert.equal(url,'https://example.test/api/identity/search');assert.equal(options.method,'POST');assert.deepEqual(JSON.parse(options.body),{documento:'1001',correo:'persona@example.com',nombre:'Persona'});return response({status:'found',person:{id_persona:'P1'}});});
  const result=await api.searchPerson({documento:'1001',correo:'persona@example.com',nombre:'Persona'});
  assert.equal(result.person.id_persona,'P1');
});

test('conserva coincidencias ambiguas para decisiÃ³n humana',async()=>{
  mockFetch(()=>response({status:'ambiguous',candidates:[{id_persona:'P2',score:.72}]}));
  const result=await api.searchPerson({nombre:'Nombre parecido'});
  assert.equal(result.status,'ambiguous');assert.equal(result.candidates[0].score,.72);
});

test('confirma identidad mediante token temporal',async()=>{
  mockFetch((url,options)=>{assert.equal(url,'https://example.test/api/universal/confirm');assert.deepEqual(JSON.parse(options.body),{token:'T1',result:'CONFIRMADA'});return response({status:'identity_confirmed'});});
  assert.equal((await api.confirmIdentity({token:'T1',result:'CONFIRMADA'})).status,'identity_confirmed');
});

test('solicita cÃ³digo administrativo al proxy, no a SharePoint',async()=>{
  mockFetch((url,options)=>{assert.equal(url,'https://worker.test/api/pa09');assert.deepEqual(JSON.parse(options.body),{accion:'SOLICITAR_CODIGO_ADMIN',correo:'admin@universidadean.edu.co'});return response({estado:'CODIGO_ENVIADO'});});
  assert.equal((await api.requestAdminCode('admin@universidadean.edu.co')).estado,'CODIGO_ENVIADO');
});

test('recupera resumen y detalle administrativo por separado',async()=>{
  const seen=[];mockFetch((url)=>{seen.push(url);return url.includes('/people?')?response({people:[{id_persona:'P1'}]}):response({totals:{personas:1}});});
  const summary=await api.getAdminSummary({facultad:'IngenierÃ­a'});const people=await api.getAdminPeople({limit:25});
  assert.equal(summary.totals.personas,1);assert.equal(people.people.length,1);assert.match(seen[0],/dashboard\?facultad=Ingenier%C3%ADa/);assert.match(seen[1],/people\?limit=25/);
});

test('normaliza errores HTTP sin filtrar la respuesta completa',async()=>{
  mockFetch(()=>response({mensaje:'Acceso no autorizado.'},403));
  await assert.rejects(()=>api.requestAdminCode('otro@example.com'),error=>error instanceof api.ApiError&&error.status===403&&error.message==='Acceso no autorizado.');
});

test('conserva el token administrativo solo en la sesiÃ³n',async()=>{
  mockFetch(()=>response({estado:'VALIDADO',accessToken:'TOKEN-ADMIN'}));
  await api.verifyAdminCode('admin@universidadean.edu.co','123456');
  assert.equal(global.sessionStorage.getItem('pasaporteAdminToken'),'TOKEN-ADMIN');
});

test('publica formularios por PA11 con autorizaciÃ³n temporal',async()=>{
  global.sessionStorage.setItem('pasaporteAdminToken','TOKEN-ADMIN');
  mockFetch((url,options)=>{assert.equal(url,'https://worker.test/api/pa11');assert.equal(options.headers.Authorization,'Bearer TOKEN-ADMIN');assert.equal(JSON.parse(options.body).accion,'GUARDAR_FORMULARIO');return response({estado:'FORMULARIO_GUARDADO'});});
  const result=await api.saveFormDefinition({idFormulario:'F1',nombre:'Prueba',definicion:{fields:[]}});
  assert.equal(result.estado,'FORMULARIO_GUARDADO');
});

test('impide llamar PA11 sin sesiÃ³n verificada',async()=>{
  assert.throws(()=>api.registerExperience({idExperiencia:'E1'}),error=>error.code==='AUTH_REQUIRED'&&error.status===401);
});

test('consulta respuestas y promueve una inscripciÃ³n solo con sesiÃ³n administrativa',async()=>{
  global.sessionStorage.setItem('pasaporteAdminToken','TOKEN-ADMIN');const actions=[];
  mockFetch((_url,options)=>{actions.push(JSON.parse(options.body).accion);return response({estado:'OK',respuestas:[]});});
  await api.listFormResponses('F1');await api.selectEnrollment({idInscripcion:'I1'});await api.promoteEnrollment({idInscripcion:'I1',idExperiencia:'E1'});
  assert.deepEqual(actions,['LISTAR_RESPUESTAS','MARCAR_SELECCIONADO','MARCAR_PARTICIPANDO']);
});

test('envÃ­a adjuntos por la sesiÃ³n verificada del participante',async()=>{
  global.sessionStorage.setItem('pasaporteAccessToken','TOKEN-PERSONA');
  mockFetch((_url,options)=>{assert.equal(options.headers.Authorization,'Bearer TOKEN-PERSONA');assert.equal(JSON.parse(options.body).accion,'GUARDAR_ADJUNTO');return response({estado:'ADJUNTO_GUARDADO'});});
  assert.equal((await api.saveFormAttachment({idInscripcion:'I1',nombreArchivo:'prototipo.pdf',contenidoBase64:'AA=='})).estado,'ADJUNTO_GUARDADO');
});

test('consulta el pasaporte con sesiÃ³n de la persona verificada',async()=>{
  global.sessionStorage.setItem('pasaporteAccessToken','TOKEN-PERSONA');
  mockFetch((url,options)=>{assert.equal(url,'https://worker.test/api/pa11');assert.equal(options.headers.Authorization,'Bearer TOKEN-PERSONA');assert.equal(JSON.parse(options.body).accion,'OBTENER_PASAPORTE');assert.equal('idPersona' in JSON.parse(options.body),false);return response({participaciones:[{ProgramaIniciativa:'Prueba'}]});});
  assert.equal((await api.getPassport()).participaciones[0].ProgramaIniciativa,'Prueba');
});

