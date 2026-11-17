const $ = (id) => document.getElementById(id);
let currentPerson = null;
let contexts = [];
let pendingAccess = null;
let pendingSubmissionId = null;
let pendingCandidate = null;
let registrationPrefill = null;
let activeExperienceDefinition = null;
let activeExperienceContext = null;
let passportPage = 0;
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
  $('search-submit').textContent='Buscar coincidencias';
  $('access-result').classList.add('hidden');
});
$('registration-level').addEventListener('change',()=>setProgramOptions($('registration-level').value));
$('registration-link').addEventListener('change',()=>updateAffiliationFields());

function esc(value){return String(value ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function secureApi(){if(!window.PasaporteAPI)throw new Error('El servicio de acceso no terminó de cargar. Actualiza la página e inténtalo nuevamente.');return window.PasaporteAPI;}
catalogs.dependencias.forEach(item=>$('registration-dependency').insertAdjacentHTML('beforeend',`<option>${esc(item)}</option>`));
function showStatus(message,error=false){$('status').textContent=message;$('status').className='status'+(error?' error':'');}
function hideResults(){ $('profile').classList.add('hidden'); $('candidates').classList.add('hidden'); $('identity-confirm').classList.add('hidden'); $('new-registration').classList.add('hidden'); $('form-completion').classList.add('hidden'); $('embedded-form').classList.add('hidden'); $('mirror-experience-form').classList.add('hidden'); $('experience-success').classList.add('hidden'); registrationPrefill=null;activeExperienceDefinition=null;activeExperienceContext=null; }
function field(label,value){return `<div class="info-item"><span>${esc(label)}</span><strong>${esc(value || 'Pendiente')}</strong></div>`;}

function resetToSearch(){
  document.body.classList.remove('passport-active','identity-active');
  hideResults();
  $('access-result').classList.add('hidden');
  $('status').classList.add('hidden');
  $('search-form').reset();
  $('search-submit').textContent='Buscar coincidencias';
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

function experienceField(field,values={}){
  if(field.profile)return '';
  const id=`experience-${field.id}`,required=field.required?' required':'',value=values[field.id]||'';
  const condition=field.condition?` data-condition="${esc(field.condition)}"`:'';
  const label=`<label for="${esc(id)}">${esc(field.label)}${field.required?' *':''}</label>`;
  if(field.type==='select')return `<div class="mirror-field"${condition}>${label}<select id="${esc(id)}" name="${esc(field.id)}"${required}><option value="">Seleccione</option>${(field.options||[]).map(option=>`<option${option===value?' selected':''}>${esc(option)}</option>`).join('')}</select></div>`;
  if(field.type==='textarea')return `<div class="mirror-field"${condition}>${label}<textarea id="${esc(id)}" name="${esc(field.id)}" rows="4"${required}>${esc(value)}</textarea></div>`;
  if(field.type==='checkbox')return `<label class="check-line mirror-field"${condition}><input id="${esc(id)}" name="${esc(field.id)}" type="checkbox"${required}> ${esc(field.label)}</label>`;
  if(field.type==='file')return `<div class="mirror-field"${condition}>${label}<input id="${esc(id)}" name="${esc(field.id)}" type="url" placeholder="Pega un enlace seguro al prototipo"${required}></div>`;
  return `<div class="mirror-field"${condition}>${label}<input id="${esc(id)}" name="${esc(field.id)}" type="${esc(field.type||'text')}" value="${esc(value)}"${required}></div>`;
}

function refreshExperienceConditions(){
  const form=$('mirror-experience-form'),values=Object.fromEntries(new FormData(form).entries());
  form.querySelectorAll('[data-condition]').forEach(node=>{const [key,raw='']=node.dataset.condition.split('=');const visible=raw.split('|').includes(values[key]||'');node.classList.toggle('hidden',!visible);node.querySelectorAll('input,select,textarea').forEach(input=>{input.disabled=!visible;});});
}

function renderExperienceForm(definition){
  activeExperienceDefinition=definition;
  const values={nombre:$('registration-name').value,correo:$('registration-email').value,tipo_vinculacion:$('registration-link').value,programa:$('registration-program').value,modalidad:$('registration-modality').value,celular:$('registration-phone').value};
  const form=$('mirror-experience-form');
  form.innerHTML=`<div class="mirror-form-cover"><span>${esc(definition.phase||'Impacta')}</span><h3>${esc(definition.name||activeExperienceContext?.nombre||'Experiencia Impacta')}</h3><p>Cohorte ${esc(definition.cohort||'vigente')}</p></div>${(definition.fields||[]).map(field=>experienceField(field,values)).join('')}<button type="submit">Enviar e inscribirme</button><p class="privacy">Al enviar, la inscripción y las respuestas quedarán trazadas en SharePoint. No se crea una participación histórica hasta que Impacta actualice su estado.</p>`;
  form.classList.remove('hidden');form.querySelectorAll('input,select,textarea').forEach(input=>input.addEventListener('change',refreshExperienceConditions));refreshExperienceConditions();
}

async function openExperienceAfterVerification(){
  $('experience-access').classList.add('hidden');$('experience-access-status').textContent='Cargando formulario publicado…';
  try{const result=await secureApi().getPublishedForm(activeExperienceContext.codigo);let raw=result.formulario?.DefinicionJson||result.formulario?.definicionJson||'{}';if(typeof raw==='string')raw=JSON.parse(raw);renderExperienceForm(raw);showStatus('Identidad protegida. Completa las preguntas propias de la experiencia.');}
  catch(error){$('experience-access').classList.remove('hidden');$('experience-access-status').textContent=error.message||'No fue posible cargar el formulario publicado.';}
}

async function prepareExperienceForm(context){
  activeExperienceContext=context;$('embedded-form-title').textContent=context.nombre;$('embedded-form').classList.remove('hidden');$('form-completion').classList.add('hidden');$('experience-success').classList.add('hidden');$('experience-access').classList.remove('hidden');$('experience-access-status').textContent='';$('experience-code').value='';$('experience-code-step').classList.add('hidden');$('experience-send-code').textContent='Enviar código';
  try{if(sessionStorage.getItem('pasaporteAccessToken'))await openExperienceAfterVerification();}catch(_error){}
  $('embedded-form').scrollIntoView({behavior:'smooth',block:'start'});
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

$('search-form').addEventListener('submit',async(e)=>{
  e.preventDefault(); hideResults(); showStatus('Buscando coincidencias por documento, correo y nombre…');
  try{
    const contextCode=$('context').value;
    pendingSubmissionId=(globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`);
    const identityPayload={nombre:$('person-name-input').value.trim(),correo:$('person-email-input').value.trim(),documento:$('person-document-input').value.trim()};
    const identityResponse=await fetch('/api/identity/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(identityPayload)});
    let data=await identityResponse.json();
    if(data.status==='found' && contextCode){
      const query=data.matched_field==='documento'?identityPayload.documento:data.matched_field==='correo'?identityPayload.correo:identityPayload.nombre;
      const response=await fetch('/api/universal/identify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({codigo_contexto:contextCode,query,canal:'PORTAL_UNIVERSAL',submission_id:pendingSubmissionId})});
      data=await response.json();
    }
    if(data.status==='pendiente_confirmacion'){
      pendingAccess=data;showStatus('Encontramos una coincidencia. Confirma tu identidad para continuar.');
      $('identity-summary').innerHTML=[field('Nombre',data.person.nombre),field('Documento',data.person.documento_mascarado),field('Vinculación',data.person.tipo_vinculacion),field('Programa',data.person.datos_institucionales?.programa_academico||data.person.programa_institucional||data.person.programa_original),field('Experiencia',data.context.nombre),field('Estado',data.person.estado_validacion)].join('');
      $('identity-confirm').classList.remove('hidden');document.body.classList.add('identity-active');$('identity-confirm').scrollIntoView({behavior:'smooth',block:'start'});return;
    }
    if(data.status==='found'){showStatus('Persona encontrada con confianza alta.');renderPerson(data.person,`Coincidencia: ${data.reason.replaceAll('_',' ')} · confianza ${(data.score*100).toFixed(0)}%.`);}
    else if(data.status==='ambiguous'){showStatus('Se requiere selección humana.');renderCandidates(data);}
    else if(data.status==='not_found' && contextCode){showStatus('No encontramos una identidad exacta. Revisa los datos y continúa como participante nuevo.');$('new-registration').classList.remove('hidden');}
    else{showStatus(data.message||'No se encontró la persona.',true);}
  }catch(_error){showStatus('No fue posible consultar la fuente disponible.',true);}
});

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
document.querySelectorAll('.flow-back').forEach(button=>button.addEventListener('click',resetToSearch));
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
    box.innerHTML=`<p class="eyebrow">Datos preparados</p><h2>${esc(data.context.nombre)}</h2><p>${esc(data.message)}</p>${prepared?`<p class="evidence"><strong>Datos reutilizados:</strong> ${esc(prepared)}.</p>`:''}<p>Continuarás en el formulario integrado sin repetir esta información.</p>`;
    await prepareExperienceForm(data.context);
    showStatus('Datos confirmados. Protege tu acceso y completa únicamente las preguntas restantes.');
  }catch(error){showStatus(error.message||'No se pudieron guardar los datos del formulario.',true);}
});

$('experience-send-code').addEventListener('click',async()=>{
  const email=$('registration-email').value.trim(),button=$('experience-send-code');button.disabled=true;$('experience-access-status').textContent='Enviando código…';
  try{await secureApi().requestAccessCode(email);$('experience-access-status').textContent=`Código enviado a ${email}. Ingresa los seis dígitos para continuar.`;$('experience-code-step').classList.remove('hidden');button.textContent='Reenviar código';$('experience-code').focus();}
  catch(error){$('experience-access-status').textContent=error.message||'No fue posible enviar el código.';}finally{button.disabled=false;}
});
$('experience-verify-code').addEventListener('click',async()=>{
  const email=$('registration-email').value.trim(),code=$('experience-code').value.trim(),button=$('experience-verify-code');if(!/^\d{6}$/.test(code)){ $('experience-access-status').textContent='Ingresa el código de seis dígitos.';return;}button.disabled=true;$('experience-access-status').textContent='Verificando…';
  try{await secureApi().verifyAccessCode(email,code);await openExperienceAfterVerification();}
  catch(error){$('experience-access-status').textContent=error.message||'El código no pudo validarse.';}finally{button.disabled=false;}
});
$('mirror-experience-form').addEventListener('submit',async event=>{
  event.preventDefault();if(!activeExperienceDefinition||!activeExperienceContext)return;
  const form=$('mirror-experience-form'),button=form.querySelector('button[type="submit"]'),answers=Object.fromEntries(new FormData(form).entries());form.querySelectorAll('input[type="checkbox"]').forEach(input=>answers[input.name]=input.checked);button.disabled=true;button.textContent='Registrando…';
  try{const api=secureApi();const enrollment=await api.registerExperience({idPersona:registrationPrefill.person_id,idExperiencia:activeExperienceContext.codigo,idFormulario:activeExperienceContext.codigo,origen:'PASAPORTE_EANISTA'});await api.saveFormResponses({idInscripcion:enrollment.id,idPersona:registrationPrefill.person_id,idFormulario:activeExperienceContext.codigo,version:String(activeExperienceDefinition.version||1),respuestas:answers});form.classList.add('hidden');const success=$('experience-success');success.classList.remove('hidden');success.innerHTML=`<span class="success-mark">✓</span><p class="eyebrow">Inscripción registrada</p><h3>${esc(activeExperienceContext.nombre)}</h3><p>Estado: <strong>INSCRITO</strong>. La respuesta quedó asociada a tu identidad verificada y conservada en SharePoint.</p><button id="experience-finish" type="button">Ver mi pasaporte</button>`;success.querySelector('#experience-finish').addEventListener('click',async()=>{try{const result=await fetch('/api/person/'+encodeURIComponent(registrationPrefill.person_id)).then(r=>r.json());if(result.person)renderPerson(result.person,'Inscripción registrada; la participación histórica se actualizará cuando Impacta confirme el estado.');}catch(_error){resetToSearch();}});showStatus('Inscripción y respuestas registradas correctamente.');}
  catch(error){showStatus(error.message||'No fue posible registrar la inscripción.',true);button.disabled=false;button.textContent='Enviar e inscribirme';}
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

