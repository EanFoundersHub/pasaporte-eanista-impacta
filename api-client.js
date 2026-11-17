(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.PasaporteAPI=api;
  if(typeof window!=='undefined')window.PasaporteAPI=api;
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this),function(){
  'use strict';
  const host=typeof globalThis!=='undefined'?globalThis:this;

  class ApiError extends Error{
    constructor(message,{status=0,code='NETWORK_ERROR',details=null}={}){super(message);this.name='ApiError';this.status=status;this.code=code;this.details=details;}
  }

  const trimSlash=value=>String(value||'').replace(/\/$/,'');
  const join=(base,path)=>`${trimSlash(base)}${path.startsWith('/')?path:`/${path}`}`;
  const config=()=>({
    apiBaseUrl:trimSlash(host.PASAPORTE_CONFIG?.apiBaseUrl||''),
    pa08Url:host.PASAPORTE_CONFIG?.pa08Url||'',
    pa09AdminUrl:host.PASAPORTE_CONFIG?.pa09AdminUrl||'',
    pa11Url:host.PASAPORTE_CONFIG?.pa11Url||'',
    timeoutMs:Number(host.PASAPORTE_CONFIG?.timeoutMs)||180000
  });

  const storage=()=>host.sessionStorage&&typeof host.sessionStorage.getItem==='function'?host.sessionStorage:null;
  const saveToken=(key,value)=>{try{if(value)storage()?.setItem(key,value);}catch(_e){}};
  const loadToken=key=>{try{return storage()?.getItem(key)||'';}catch(_e){return '';}};

  async function request(path,{method='GET',body,headers={},timeoutMs,absolute=false}={}){
    const current=config(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs||current.timeoutMs);
    const url=absolute?path:join(current.apiBaseUrl,path);
    try{
      const response=await fetch(url,{method,headers:{...(body!==undefined&&!headers['Content-Type']?{'Content-Type':'application/json'}:{}),...headers},body:body===undefined?undefined:headers['Content-Type']&&headers['Content-Type']!=='application/json'?body:JSON.stringify(body),signal:controller.signal,referrerPolicy:'no-referrer'});
      let data=null;try{data=await response.json();}catch(_e){}
      if(!response.ok)throw new ApiError(data?.message||data?.mensaje||`Solicitud rechazada (${response.status}).`,{status:response.status,code:data?.code||`HTTP_${response.status}`,details:data});
      return data||{};
    }catch(error){
      if(error instanceof ApiError)throw error;
      if(error?.name==='AbortError')throw new ApiError('La consulta tardó demasiado. Puedes intentarlo nuevamente.',{code:'TIMEOUT'});
      throw new ApiError('El servicio está temporalmente fuera de línea.',{code:'NETWORK_ERROR'});
    }finally{clearTimeout(timer);}
  }

  const post=(path,body,options={})=>request(path,{...options,method:'POST',body});
  const personPath=(id,suffix='')=>`/api/person/${encodeURIComponent(id)}${suffix}`;

  const api={
    ApiError,request,
    getHealth:()=>request('/api/health'),
    getContexts:()=>request('/api/contexts'),
    searchPerson:identity=>post('/api/identity/search',identity),
    identify:payload=>post('/api/universal/identify',payload),
    selectCandidate:payload=>post('/api/universal/select-candidate',payload),
    confirmIdentity:payload=>post('/api/universal/confirm',payload),
    createProvisionalPerson:payload=>post('/api/universal/external',payload),
    getRegistrationPrefill:payload=>post('/api/universal/prefill',payload),
    createEnrollment:payload=>post('/api/universal/registration-details',payload),
    getPersonProfile:id=>request(personPath(id)),
    confirmAcademicData:(id,payload)=>post(personPath(id,'/validate'),payload),
    requestCorrection:(id,payload)=>post(personPath(id,'/validate'),{...payload,result:'CORRECCION_SOLICITADA'}),
    requestIdentityUpdate:(id,payload)=>post(personPath(id,'/identity-update'),payload),
    uploadPrototype:(id,file)=>request(personPath(id,'/prototype'),{method:'POST',body:file,headers:{'Content-Type':file.type||'application/octet-stream','X-File-Name':encodeURIComponent(file.name)}}),
    getAdminSummary:params=>request(`/api/admin/dashboard?${new URLSearchParams(params||{})}`),
    getAdminPeople:params=>request(`/api/admin/people?${new URLSearchParams(params||{})}`),
    getAdminPerson:id=>request(`/api/admin/person/${encodeURIComponent(id)}`),
    getReviewQueue:()=>request('/api/admin/reviews'),
    resolveReview:payload=>post('/api/admin/reviews/resolve',payload),
    requestAccessCode:correo=>{
      const url=config().pa08Url;if(!url)throw new ApiError('El acceso por código no está configurado.',{code:'NOT_CONFIGURED'});
      return post(url,{accion:'SOLICITAR_CODIGO',correo},{absolute:true});
    },
    verifyAccessCode:(correo,codigo)=>{
      const url=config().pa08Url;if(!url)throw new ApiError('El acceso por código no está configurado.',{code:'NOT_CONFIGURED'});
      return post(url,{accion:'VALIDAR_CODIGO',correo,codigo},{absolute:true}).then(data=>{saveToken('pasaporteAccessToken',data.accessToken);return data;});
    },
    requestAdminCode:correo=>{
      const url=config().pa09AdminUrl;if(!url)throw new ApiError('La conexión administrativa no está configurada.',{code:'NOT_CONFIGURED'});
      return post(url,{accion:'SOLICITAR_CODIGO_ADMIN',correo},{absolute:true});
    },
    verifyAdminCode:(correo,codigo)=>{
      const url=config().pa09AdminUrl;if(!url)throw new ApiError('La conexión administrativa no está configurada.',{code:'NOT_CONFIGURED'});
      return post(url,{accion:'VALIDAR_CODIGO_ADMIN',correo,codigo},{absolute:true,timeoutMs:600000}).then(data=>{saveToken('pasaporteAdminToken',data.accessToken);return data;});
    },
    callForms:(payload,{admin=false}={})=>{
      const url=config().pa11Url;if(!url)throw new ApiError('El servicio de experiencias no está configurado.',{code:'NOT_CONFIGURED'});
      const token=loadToken(admin?'pasaporteAdminToken':'pasaporteAccessToken');
      if(!token)throw new ApiError('La sesión segura no está disponible o venció.',{status:401,code:'AUTH_REQUIRED'});
      return post(url,payload,{absolute:true,headers:{Authorization:`Bearer ${token}`}});
    },
    listExperiences:()=>api.callForms({accion:'LISTAR_EXPERIENCIAS'}),
    getPublishedForm:idFormulario=>api.callForms({accion:'OBTENER_FORMULARIO',idFormulario}),
    registerExperience:payload=>api.callForms({accion:'REGISTRAR_INSCRIPCION',...payload}),
    saveFormResponses:payload=>api.callForms({accion:'GUARDAR_RESPUESTAS',...payload}),
    saveFormAttachment:payload=>api.callForms({accion:'GUARDAR_ADJUNTO',...payload}),
    saveExperience:payload=>api.callForms({accion:'GUARDAR_EXPERIENCIA',...payload},{admin:true}),
    saveFormDefinition:payload=>api.callForms({accion:'GUARDAR_FORMULARIO',...payload},{admin:true}),
    provisionForms:()=>api.callForms({accion:'APROVISIONAR'},{admin:true}),
    verifyEnrollment:payload=>api.callForms({accion:'VERIFICAR_INSCRIPCION',...payload},{admin:true}),
    listFormResponses:idFormulario=>api.callForms({accion:'LISTAR_RESPUESTAS',idFormulario},{admin:true}),
    promoteEnrollment:payload=>api.callForms({accion:'MARCAR_PARTICIPANDO',...payload},{admin:true})
  };
  return Object.freeze(api);
});
