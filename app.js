const $ = (id) => document.getElementById(id);
let currentPerson = null;
let contexts = [];
let pendingAccess = null;
let pendingSubmissionId = null;
let pendingCandidate = null;
let registrationPrefill = null;
let passportPage = 0;
let accessEmail = '';
let accessRequestInFlight = false;
const catalogs=window.IMPACTA_CATALOGS||{programas:{},dependencias:[]};

function inferredLevel(program=''){
  const value=program.toLowerCase();
  if(value.includes('doctorado'))return 'Doctorado';
  if(value.includes('maestr')||value.includes('mtr.'))return 'Maestría';
  if(value.includes('especial')||value.includes('esp.'))return 'Especialización';
  return program?'Pregrado':'';
}
function setProgramOptions(level,value=''){
  const programs=catalogs.programas[level]||[];
  $('registration-program').innerHTML='<option value="">Seleccione</option>'+programs.map(item=>`<option>${esc(item)}</option>`).join('');
  if(value&&!programs.includes(value))$('registration-program').insertAdjacentHTML('beforeend',`<option>${esc(value)}</option>`);
  $('registration-program').value=value||'';
}
function updateAffiliationFields(programValue=''){
  const link=$('registration-link').value;
  const academic=link==='Estudiante activo'||link==='Graduado';
  const collaborator=link==='Colaborador';
  $('registration-program-label').textContent=link==='Estudiante activo'?'Unidad de estudio':'Programa académico';
  $('registration-level-field').classList.toggle('hidden',!academic);
  $('registration-program-field').classList.toggle('hidden',!academic);
  $('registration-dependency-field').classList.toggle('hidden',!collaborator);
  $('registration-modality-field').classList.toggle('hidden',!academic);
  $('registration-level').required=academic;$('registration-program').required=academic;
  $('registration-dependency').required=collaborator;$('registration-modality').required=academic;
  if(!academic){$('registration-level').value='';setProgramOptions('');$('registration-modality').value='';}
  if(!collaborator)$('registration-dependency').value='';
  if(academic&&programValue){const level=inferredLevel(programValue);$('registration-level').value=level;setProgramOptions(level,programValue);}
}

function setPassportPage(page){
  passportPage=Math.max(0,Math.min(2,page));
  const book=$('passport-book');book.dataset.page=String(passportPage);
  const labels=['Cubierta','Identidad y trayectoria','Validación y evidencias'];
  $('passport-page-label').textContent=labels[passportPage];
  $('passport-open').classList.toggle('hidden',passportPage!==0);
  $('passport-prev').classList.toggle('hidden',passportPage===0);
  $('passport-next').classList.toggle('hidden',passportPage===0||passportPage===2);
  $('passport-close').classList.toggle('hidden',passportPage===0);
  const coverFront=$('passport-cover-open'),dataPage=document.querySelector('.passport-data'),leaf=$('passport-leaf');
  coverFront.setAttribute('aria-hidden',passportPage===0?'false':'true');coverFront.inert=passportPage!==0;
  dataPage.inert=passportPage===0;
  leaf.querySelector('.passport-history').inert=passportPage!==1;
  leaf.querySelector('.passport-validation').inert=passportPage!==2;
}

async function configureMode(){
  try{
    const health=await fetch('/api/health').then(response=>response.json());
    const real=health.mode==='real_controlado';
    $('mode-label').textContent=real?'MVP · base histórica Impacta':'MVP · demostración controlada';
    $('privacy-note').textContent=real
      ?'Consulta controlada. El vínculo prellenado se genera solo al continuar y se entrega directamente a Microsoft Forms; no se registra en logs.'
      :'El vínculo prellenado se genera solo al continuar. Para esta demo use exclusivamente datos sintéticos.';
    $('footer-note').textContent=real
      ?'Prototipo institucional · Base histórica Impacta · Acceso local controlado.'
      :'Prototipo institucional · Los datos visibles son sintéticos y no corresponden a personas reales.';
    $('demo-help').classList.toggle('hidden',real);
  }catch(_error){/* Conserva el texto seguro predeterminado. */}
}

async function loadContexts(){
  try{
    const data=await fetch('/api/contexts').then(response=>response.json());
    contexts=data.contexts||[];
    $('context').insertAdjacentHTML('beforeend',contexts.map(item=>
      `<option value="${esc(item.codigo)}">${esc(item.nombre)}</option>`
    ).join(''));
  }catch(_error){/* La consulta de trayectoria permanece disponible. */}
}

$('context').addEventListener('change',()=>{
  $('search-submit').textContent='Enviar código y verificar';
  $('access-result').classList.add('hidden');
});
$('registration-level').addEventListener('change',()=>setProgramOptions($('registration-level').value));
$('registration-link').addEventListener('change',()=>updateAffiliationFields());

function esc(value){return String(value ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
catalogs.dependencias.forEach(item=>$('registration-dependency').insertAdjacentHTML('beforeend',`<option>${esc(item)}</option>`));
function showStatus(message,error=false){$('status').textContent=message;$('status').className='status'+(error?' error':'');}
function hideResults(){ $('profile').classList.add('hidden'); $('candidates').classList.add('hidden'); $('identity-confirm').classList.add('hidden'); $('new-registration').classList.add('hidden'); $('form-completion').classList.add('hidden'); $('embedded-form').classList.add('hidden'); $('access-code-panel').classList.add('hidden'); $('microsoft-form-frame').removeAttribute('src'); registrationPrefill=null; }
function field(label,value){return `<div class="info-item"><span>${esc(label)}</span><strong>${esc(value || 'Pendiente')}</strong></div>`;}

function resetToSearch(){
  document.body.classList.remove('passport-active','identity-active');
  hideResults();
  $('access-result').classList.add('hidden');
  $('status').classList.add('hidden');
  $('search-form').reset();
  $('search-submit').textContent='Enviar código y verificar';
  $('access-code').value='';accessEmail='';accessRequestInFlight=false;
  pendingAccess=null;pendingSubmissionId=null;pendingCandidate=null;currentPerson=null;
  setPassportPage(0);
  window.scrollTo({top:0,behavior:'smooth'});
  setTimeout(()=>$('person-name-input').focus(),250);
}

async function loadRegistrationForm(personId,contextCode){
  if(!personId||!contextCode)return;
  const response=await fetch('/api/universal/prefill',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id_persona:personId,codigo_contexto:contextCode})});
  const data=await response.json();if(!response.ok){showStatus(data.message||'No fue posible preparar el formulario.',true);return;}
  registrationPrefill=data;
  $('form-completion-title').textContent=data.context.nombre;
  $('registration-name').value=data.values.nombre||'';$('registration-email').value=data.values.correo||'';
  const rawLink=(data.values.tipo_vinculacion||'').toLowerCase();
  $('registration-link').value=rawLink.includes('extern')?'Externo':rawLink.includes('colaborador')?'Colaborador':rawLink.includes('gradu')?'Graduado':'Estudiante activo';
  $('registration-modality').value=data.values.modalidad||'';
  updateAffiliationFields(data.values.programa_academico||'');
  $('registration-phone').value='';
  $('prefill-sources').textContent='Programa y modalidad se precargan desde las fuentes disponibles; el celular será aportado por la persona.';
  $('form-completion').classList.remove('hidden');
  $('form-completion').scrollIntoView({behavior:'smooth',block:'start'});
}

function renderPerson(person, evidence=''){
  currentPerson=person; document.body.classList.remove('identity-active'); document.body.classList.add('passport-active'); $('candidates').classList.add('hidden'); $('profile').classList.remove('hidden');
  $('person-name').textContent=person.nombre;
  const status=person.estado_validacion || 'PENDIENTE';
  const badge=$('validation-badge'); badge.textContent=status.replaceAll('_',' '); badge.className='passport-seal '+(status==='CONFIRMADA'?'confirmed':status==='CORRECCION_SOLICITADA'?'correction':'');
  const official=person.datos_institucionales;
  $('academic-validation').classList.toggle('hidden',person.tipo_vinculacion==='Participante externo');
  $('person-grid').innerHTML=[
    field('Documento',person.documento_mascarado),field('Vinculación',person.tipo_vinculacion),field('Código estudiantil',person.codigo_estudiante),
    field('Programa reportado',person.programa_original),field('Programa institucional consultado',official?.programa_academico),field('Código SNIES institucional',official?.codigo_snies),
    field('Estado académico',official?.estado_academico),
    field('Correo institucional',person.correo_institucional),field('Consulta institucional',person.consulta_institucional),field('Fecha de validación',person.fecha_validacion)
  ].join('');
  const warning=person.requiere_revision_academica?' Hay diferencia entre el dato reportado y la fuente institucional; se requiere validación.':'';
  $('match-evidence').textContent=evidence+warning;
  const items=person.experiencias || [];
  $('timeline').innerHTML=items.length?items.map(x=>`<div class="passport-stamp"><span>${esc(x.anio)} · ${esc(x.fase||'Impacta')}</span><strong>${esc(x.programa_iniciativa)}</strong><small>${esc(x.estado_participacion||'Participación registrada')}</small></div>`).join(''):'<p class="empty">Tu primer sello aparecerá con tu primera experiencia en Impacta.</p>';
  const vals=person.validaciones||[];
  $('validation-history').innerHTML=vals.length?`<div class="history"><strong>Historial de validación</strong><ul>${vals.map(v=>`<li>${esc(v.fecha)} · ${esc(v.resultado)}${v.observacion?' · '+esc(v.observacion):''}</li>`).join('')}</ul></div>`:'';
  renderPrototype(person.prototipos||[]);
  $('correction-form').classList.add('hidden');
  setPassportPage(0);
  $('profile').scrollIntoView({behavior:'smooth',block:'start'});
}

function renderCandidates(data){
  $('profile').classList.add('hidden'); const box=$('candidates'); box.classList.remove('hidden');
  box.innerHTML=`<p class="eyebrow">Revisión humana requerida</p><h2>Encontramos registros similares</h2><p>${esc(data.message)}</p>${data.candidates.map(c=>`<div class="candidate" data-card="${esc(c.id_persona)}"><div><strong>${esc(c.nombre)}</strong><p>${esc(c.documento_mascarado||'Documento no disponible')} · ${esc(c.correo_mascarado||'Correo no disponible')}</p><p>${esc(c.tipo_vinculacion||'Vinculación pendiente')} · ${esc(c.programa||'Programa pendiente')}</p><span class="score">Similitud ${(c.score*100).toFixed(0)}% · ${esc((c.reason||'').replaceAll('_',' '))}</span></div><div class="actions"><button data-person="${esc(c.id_persona)}">Sí, soy yo</button><button class="secondary" data-reject="${esc(c.id_persona)}">No soy yo</button></div></div>`).join('')}`;
  box.querySelectorAll('[data-person]').forEach(btn=>btn.addEventListener('click',async()=>{
    pendingCandidate=data.candidates.find(c=>c.id_persona===btn.dataset.person);
    if(!pendingCandidate)return;
    if($('context').value){
      const r=await fetch('/api/universal/select-candidate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({codigo_contexto:$('context').value,submission_id:pendingSubmissionId,id_persona:pendingCandidate.id_persona,canal:'PORTAL_UNIVERSAL'})});
      const selected=await r.json(); if(!r.ok){showStatus(selected.message||'No fue posible seleccionar la coincidencia.',true);return;}
      pendingAccess=selected; await confirmPending('CONFIRMADA');
    }else{
      const r=await fetch('/api/person/'+encodeURIComponent(pendingCandidate.id_persona));const selected=await r.json();
      if(selected.person){showStatus('Identidad confirmada por la persona.');renderPerson(selected.person,'Coincidencia aproximada confirmada manualmente; no fue asumida por el sistema.');}
    }
  }));
  box.querySelectorAll('[data-reject]').forEach(btn=>btn.addEventListener('click',()=>{btn.closest('.candidate')?.remove();showStatus('Coincidencia descartada. Puedes revisar otra opción o continuar como registro nuevo.');if($('context').value)$('new-registration').classList.remove('hidden');}));
}

async function callAccessFlow(payload){
  const endpoint=window.PASAPORTE_CONFIG?.pa08Url;
  if(!endpoint)throw new Error('La conexión segura todavía no está configurada.');
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),referrerPolicy:'no-referrer'});
  let data={};try{data=await response.json()}catch(_error){/* Respuesta segura por defecto. */}
  if(!response.ok){
    const message=response.status===401?'El código no es válido o ya venció. Solicita uno nuevo.':data.mensaje||'No fue posible completar la verificación.';
    throw new Error(message);
  }
  return data;
}

async function sendAccessCode(){
  if(accessRequestInFlight)return;
  accessEmail=$('person-email-input').value.trim().toLowerCase();
  if(!accessEmail){showStatus('Ingresa un correo válido para recibir el código.',true);return;}
  accessRequestInFlight=true;$('search-submit').disabled=true;$('access-code-resend').disabled=true;
  showStatus('Enviando un código temporal a tu correo…');
  try{
    const data=await callAccessFlow({accion:'SOLICITAR_CODIGO',correo:accessEmail});
    if(data.estado!=='CODIGO_ENVIADO')throw new Error(data.mensaje||'No fue posible enviar el código.');
    $('access-code-panel').classList.remove('hidden');document.body.classList.add('code-active');
    $('access-code').value='';showStatus('Código enviado. Revisa tu bandeja de entrada.');
    $('access-code-panel').scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>$('access-code').focus(),250);
  }catch(error){showStatus(error.message,true);}
  finally{accessRequestInFlight=false;$('search-submit').disabled=false;$('access-code-resend').disabled=false;}
}

function personFromAccess(data){
  const source=data.persona||{};
  const trajectory=Array.isArray(data.trayectoria)?data.trayectoria:[];
  const program=source.programa||'Pendiente de validación institucional';
  return {
    id_persona:source.id_persona||accessEmail,nombre:source.nombre||$('person-name-input').value.trim()||'Persona verificada',
    documento_mascarado:$('person-document-input').value.trim()?`••••${$('person-document-input').value.trim().slice(-4)}`:'Pendiente',
    correo_institucional:accessEmail.endsWith('@universidadean.edu.co')?accessEmail:'',correo_personal:accessEmail.endsWith('@universidadean.edu.co')?'':accessEmail,
    codigo_estudiante:'',tipo_vinculacion:source.estado_identidad||'Vinculación pendiente',programa_original:program,programa_institucional:program,
    modalidad_institucional:source.modalidad||'',fuente_dato:'SharePoint · Pasaporte Eanista',estado_validacion:'CONFIRMADA',fecha_validacion:new Date().toISOString(),
    consulta_institucional:'VERIFICADA_POR_CODIGO',requiere_revision_academica:false,
    datos_institucionales:{programa_academico:program,codigo_snies:'Pendiente',estado_academico:source.estado_identidad||'Pendiente',fuente:'SharePoint institucional'},
    experiencias:trajectory.map(item=>({anio:item.Anio||item.anio||'',fase:item.FaseParticipacion||item.fase||'Impacta',programa_iniciativa:item.ProgramaIniciativa||item.Title||'Experiencia Impacta',estado_participacion:item.EstadoParticipacion||item.PosibleDuplicado||'Participación registrada'})),
    validaciones:[],prototipos:[]
  };
}

$('search-form').addEventListener('submit',async(e)=>{e.preventDefault();hideResults();await sendAccessCode();});
$('access-code-form').addEventListener('submit',async(e)=>{
  e.preventDefault();const code=$('access-code').value.trim();if(!/^\d{6}$/.test(code)){showStatus('Ingresa los seis dígitos del código.',true);return;}
  $('access-code-submit').disabled=true;showStatus('Validando identidad y consultando trayectoria…');
  try{
    const data=await callAccessFlow({accion:'VALIDAR_CODIGO',correo:accessEmail,codigo:code});
    $('access-code').value='';$('access-code-panel').classList.add('hidden');document.body.classList.remove('code-active');
    if(data.estado==='VERIFICADO'){
      showStatus('Identidad verificada. Cargamos tu Pasaporte de Experiencias.');
      renderPerson(personFromAccess(data),'Identidad validada mediante código temporal y consulta viva en SharePoint.');
    }else if(data.estado==='VERIFICADO_REQUIERE_REGISTRO'){
      pendingSubmissionId=(globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`);
      showStatus('Correo verificado. No encontramos una identidad consolidada; completa el registro sin repetir tus datos.');
      $('new-registration').classList.remove('hidden');$('new-registration').scrollIntoView({behavior:'smooth',block:'center'});
    }else throw new Error(data.mensaje||'La respuesta de verificación no fue reconocida.');
  }catch(error){showStatus(error.message,true);}
  finally{$('access-code-submit').disabled=false;}
});
$('access-code-resend').addEventListener('click',sendAccessCode);
$('access-code-cancel').addEventListener('click',()=>{document.body.classList.remove('code-active');$('access-code-panel').classList.add('hidden');$('access-code').value='';accessEmail='';showStatus('Puedes corregir el correo y solicitar un código nuevo.');$('person-email-input').focus();});

async function confirmPending(result){
  if(!pendingAccess)return;
  $('identity-yes').disabled=true;$('identity-no').disabled=true;
  try{
    const response=await fetch('/api/universal/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:pendingAccess.token,result})});
    const data=await response.json();if(!response.ok)throw new Error(data.message);
    $('identity-confirm').classList.add('hidden');
    if(data.status==='identity_confirmed'){
      showStatus('Identidad confirmada. La inscripción se registrará cuando envíes el formulario.');
      const box=$('access-result');box.classList.remove('hidden');
      box.innerHTML=`<p class="eyebrow">Identidad confirmada</p><h2>${esc(data.context.nombre)}</h2><p>Aún no estás inscrito. Completa y envía el formulario para finalizar la inscripción.</p>`;
      $('profile').classList.add('hidden');
      await loadRegistrationForm(data.person.id_persona,data.context.codigo);
    }else showStatus(data.message||'El caso fue enviado a revisión humana.');
  }catch(error){showStatus(error.message||'No se pudo confirmar la identidad.',true);}
  finally{$('identity-yes').disabled=false;$('identity-no').disabled=false;}
}
$('identity-yes').addEventListener('click',()=>confirmPending('CONFIRMADA'));
$('identity-no').addEventListener('click',()=>confirmPending('CORRECCION_SOLICITADA'));
$('continue-registration').addEventListener('click',async()=>{
  if(!$('registration-consent').checked){showStatus('Debes autorizar el tratamiento de datos para continuar.',true);return;}
  try{
    const response=await fetch('/api/universal/external',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({codigo_contexto:$('context').value,submission_id:pendingSubmissionId||globalThis.crypto?.randomUUID?.(),nombre:$('person-name-input').value.trim(),correo:$('person-email-input').value.trim(),documento:$('person-document-input').value.trim(),canal:'PORTAL_UNIVERSAL'})});
    const data=await response.json();if(!response.ok)throw new Error(data.message);
    pendingAccess=data;$('new-registration').classList.add('hidden');
    $('identity-summary').innerHTML=[field('Nombre',data.person.nombre),field('Correo',data.person.correo_personal),field('Vinculación',data.person.tipo_vinculacion),field('Experiencia',data.context.nombre),field('Estado','Identidad provisional'),field('Fuente','Registro directo del participante')].join('');
    $('identity-confirm').classList.remove('hidden');document.body.classList.add('identity-active');showStatus('Revisa los datos provisionales antes de registrar la participación.');
    $('identity-confirm').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(error){showStatus(error.message||'No fue posible crear el registro provisional.',true);}
});

async function saveValidation(result,observation='',correctedValue=''){
  if(!currentPerson)return; $('confirm-btn').disabled=true;$('correct-btn').disabled=true;
  try{const r=await fetch(`/api/person/${encodeURIComponent(currentPerson.id_persona)}/validate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({result,observation,corrected_value:correctedValue})});const data=await r.json();if(!r.ok)throw new Error(data.message);showStatus('Validación registrada correctamente.');renderPerson(data.person,'La consulta refleja el registro de validación más reciente.');}
  catch(err){showStatus(err.message||'No se pudo registrar la validación.',true);}
  finally{$('confirm-btn').disabled=false;$('correct-btn').disabled=false;}
}
$('confirm-btn').addEventListener('click',()=>saveValidation('CONFIRMADA'));
$('correct-btn').addEventListener('click',()=>$('correction-form').classList.toggle('hidden'));
$('correction-form').addEventListener('submit',(e)=>{e.preventDefault();saveValidation('CORRECCION_SOLICITADA',$('observation').value,$('corrected-value').value);});
$('update-data-btn').addEventListener('click',()=>$('identity-update-form').classList.toggle('hidden'));
$('passport-cover-open').addEventListener('click',()=>setPassportPage(1));
$('passport-open').addEventListener('click',()=>setPassportPage(1));
$('passport-prev').addEventListener('click',()=>setPassportPage(passportPage-1));
$('passport-next').addEventListener('click',()=>setPassportPage(passportPage+1));
$('passport-close').addEventListener('click',()=>setPassportPage(0));
$('passport-new-search').addEventListener('click',resetToSearch);
$('identity-new-search').addEventListener('click',resetToSearch);
$('identity-update-form').addEventListener('submit',async(e)=>{
  e.preventDefault(); if(!currentPerson)return;
  try{
    const response=await fetch(`/api/person/${encodeURIComponent(currentPerson.id_persona)}/identity-update`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:$('updated-name').value,correo:$('updated-email').value,documento:$('updated-document').value})});
    const data=await response.json(); if(!response.ok)throw new Error(data.message);
    $('identity-update-form').reset();$('identity-update-form').classList.add('hidden');showStatus('Solicitud de actualización registrada para revisión, conservando los datos originales.');renderPerson(data.person,'La actualización quedó pendiente de revisión humana.');
  }catch(error){showStatus(error.message||'No se pudo registrar la actualización.',true);}
});
$('prototype-upload-form').addEventListener('submit',async(e)=>{
  e.preventDefault();if(!currentPerson)return;
  const file=$('prototype-file').files[0];if(!file)return;
  $('prototype-upload-status').textContent='Adjuntando archivo…';
  try{
    const response=await fetch(`/api/person/${encodeURIComponent(currentPerson.id_persona)}/prototype`,{method:'POST',headers:{'Content-Type':file.type||'application/octet-stream','X-File-Name':encodeURIComponent(file.name)},body:file});
    const data=await response.json();if(!response.ok)throw new Error(data.message);
    currentPerson=data.person;$('prototype-file').value='';renderPrototype(data.person.prototipos||[]);
    $('prototype-upload-status').textContent='Archivo adjuntado y asociado a este pasaporte.';
  }catch(error){$('prototype-upload-status').textContent=error.message||'No fue posible adjuntar el archivo.';}
});

function renderPrototype(files){
  const latest=files[0];
  $('person-prototype-stage').innerHTML=latest
    ?`<span class="prototype-placeholder-mark ready" aria-hidden="true">✓</span><strong>${esc(latest.nombre_original)}</strong><small>${(Number(latest.tamano)/1048576).toFixed(2)} MB · ${esc(latest.subido_en)}</small><a class="resource-link" href="${esc(latest.url)}" target="_blank" rel="noopener noreferrer">Abrir adjunto</a>${files.length>1?`<small>${files.length} evidencias conservadas</small>`:''}`
    :'<span class="prototype-placeholder-mark" aria-hidden="true">＋</span><strong>Adjunta una evidencia</strong><small>PDF, imagen, Office o ZIP · máximo 15 MB.</small>';
}
$('registration-details-form').addEventListener('submit',async(e)=>{
  e.preventDefault();if(!registrationPrefill)return;
  try{
    const link=$('registration-link').value;
    const program=link==='Externo'?'Externo':link==='Colaborador'?'Colaborador':$('registration-program').value;
    const response=await fetch('/api/universal/registration-details',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id_persona:registrationPrefill.person_id,codigo_contexto:registrationPrefill.context.codigo,datos:{nombre:$('registration-name').value,correo:$('registration-email').value,tipo_vinculacion:link,nivel_academico:$('registration-level').value,programa_academico:program,unidad_estudio:link==='Estudiante activo'?program:'',dependencia:$('registration-dependency').value,modalidad:$('registration-modality').value,celular:$('registration-phone').value}})});
    const data=await response.json();if(!response.ok)throw new Error(data.message);
    const box=$('access-result');box.classList.remove('hidden');
    const labels={nombre:'nombre',documento:'documento',celular:'celular',correo:'correo',tipo_vinculacion:'vinculación',modalidad:'modalidad',nivel_academico:'nivel académico',programa_academico:'programa académico'};
    const prepared=(data.prefilled_fields||[]).map(key=>labels[key]||key).join(', ');
    box.innerHTML=`<p class="eyebrow">Datos preparados</p><h2>${esc(data.context.nombre)}</h2><p>${esc(data.message)}</p>${prepared?`<p class="evidence"><strong>Se enviaron precargados:</strong> ${esc(prepared)}.</p>`:''}${data.form_url&&prepared?'<p>El formulario se abrió a continuación dentro de esta misma interfaz.</p>':'<p>No se generó un vínculo prellenado seguro. El paquete quedó guardado para revisión.</p>'}`;
    if(data.form_url&&prepared){
      $('embedded-form-title').textContent=data.context.nombre;
      $('microsoft-form-frame').src=data.form_url;
      $('embedded-form').classList.remove('hidden');
      $('form-completion').classList.add('hidden');
      $('embedded-form').scrollIntoView({behavior:'smooth',block:'start'});
    }
    showStatus('Formulario integrado y precargado. Completa únicamente las preguntas restantes.');
  }catch(error){showStatus(error.message||'No se pudieron guardar los datos del formulario.',true);}
});

configureMode();
loadContexts();

document.querySelectorAll('[data-demo]').forEach(button=>button.addEventListener('click',()=>{
  const scenario=button.dataset.demo;
  hideResults(); $('access-result').classList.add('hidden');
  if(scenario==='existing'){
    $('context').value='FOUNDERSHUB-2026'; $('person-name-input').value='Laura Martínez Gómez'; $('person-email-input').value='lmartinez@universidadean.edu.co'; $('person-document-input').value='DEMO1001';
    showStatus('Escenario listo: identidad institucional exacta. Pulsa “Verificar y registrar”.');
  }else if(scenario==='external'){
    $('context').value='FOUNDERSHUB-2026'; $('person-name-input').value='Participante Externo Demo'; $('person-email-input').value='externo.nuevo@example.invalid'; $('person-document-input').value='EXT-DEMO-NUEVO';
    showStatus('Escenario listo: participante sin coincidencia. Pulsa “Verificar y registrar”.');
  }else{
    $('context').value='DESCUBRE-2026'; $('person-name-input').value='María Fernanda'; $('person-email-input').value='sin.coincidencia@example.invalid'; $('person-document-input').value='AMB-DEMO';
    showStatus('Escenario listo: posibles coincidencias que requieren decisión humana.');
  }
  $('search-submit').textContent='Verificar y registrar';
  $('person-document-input').focus();
}));

