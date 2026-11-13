const $ = id => document.getElementById(id);
const dimensions = ['facultad','programa','modalidad','fase','anio','tipo_experiencia','estado_participacion','estado_validacion'];
let optionsLoaded = false;
let currentDashboardParams = new URLSearchParams();

function esc(value){return String(value ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function number(value){return new Intl.NumberFormat('es-CO').format(value || 0);}

function fillSelect(id, values){
  const select=$(id), current=select.value;
  select.innerHTML='<option value="">'+(id==='programa'?'Todos':'Todas')+'</option>'+values.map(value=>`<option value="${esc(value)}">${esc(value)}</option>`).join('');
  if(values.includes(current)) select.value=current;
}

const dimensionLabels={facultad:'Facultad',programa:'Programa',modalidad:'Modalidad',fase:'Fase',anio:'Año',tipo_experiencia:'Tipo de experiencia',estado_participacion:'Estado de participación',estado_validacion:'Validación'};

function applyDimensionFilter(key,value){
  const select=$(key);if(!select)return;
  if(![...select.options].some(option=>option.value===value))select.insertAdjacentHTML('beforeend',`<option value="${esc(value)}">${esc(value)}</option>`);
  select.value=value;loadDashboard();
  $('status').scrollIntoView({behavior:'smooth',block:'start'});
}

function renderBars(id, rows, dimension, limit=12){
  const target=$(id), data=(rows || []).slice(0,limit), max=Math.max(...data.map(row=>row.total),1);
  target.innerHTML=data.length?data.map(row=>`<button type="button" class="bar-row" data-dimension="${esc(dimension)}" data-value="${esc(row.etiqueta)}" aria-label="Filtrar ${esc(dimensionLabels[dimension])} por ${esc(row.etiqueta)}, ${number(row.total)} participaciones"><span class="bar-label" title="${esc(row.etiqueta)}">${esc(row.etiqueta)}</span><span class="bar-track"><span style="width:${Math.max(2,row.total/max*100)}%"></span></span><strong>${number(row.total)}</strong></button>`).join(''):'<p class="empty">No hay datos para estos filtros.</p>';
  target.querySelectorAll('[data-dimension]').forEach(button=>button.addEventListener('click',()=>applyDimensionFilter(button.dataset.dimension,button.dataset.value)));
}

function renderActiveFilters(){
  const active=dimensions.filter(key=>$(key).value).map(key=>({key,value:$(key).value}));
  const box=$('active-filters');box.classList.toggle('hidden',!active.length);
  box.innerHTML=active.length?`<strong>Zoom activo:</strong>${active.map(item=>`<button type="button" data-remove-filter="${esc(item.key)}">${esc(dimensionLabels[item.key])}: ${esc(item.value)} <span aria-hidden="true">×</span></button>`).join('')}`:'';
  box.querySelectorAll('[data-remove-filter]').forEach(button=>button.addEventListener('click',()=>{$(button.dataset.removeFilter).value='';loadDashboard();}));
}

async function loadPeople(params){
  const panel=$('people-panel');
  panel.classList.remove('hidden');$('people-body').innerHTML='<tr><td colspan="5">Cargando personas del segmento…</td></tr>';
  $('show-people').setAttribute('aria-expanded','true');
  try{
    const response=await fetch('/api/admin/people?'+params.toString());const data=await response.json();if(!response.ok)throw new Error(data.message);
    $('people-title').textContent='Detalle del zoom aplicado';$('people-count').textContent=number(data.total)+' personas';
    $('people-body').innerHTML=data.people.length?data.people.map(person=>`<tr><td data-label="Persona"><button class="person-link" type="button" data-person-id="${esc(person.id_persona)}">${esc(person.nombre)}</button><small>${esc(person.tipo_vinculacion||'Vinculación pendiente')}</small></td><td data-label="Contacto protegido"><span>${esc(person.documento_mascarado||'Documento no disponible')}</span><small>${esc(person.correo_mascarado||'Correo no disponible')}</small></td><td data-label="Información académica"><span>${esc(person.programa)}</span><small>${esc(person.facultad)} · ${esc(person.modalidad)}</small></td><td data-label="Trayectoria"><strong>${number(person.experiencias)} experiencias</strong><small>Última: ${esc(person.ultima_participacion||'Sin fecha')}</small></td><td data-label="Validación"><span class="person-status">${esc(String(person.estado_validacion).replaceAll('_',' '))}</span></td></tr>`).join(''):'<tr><td colspan="5">No hay personas para este segmento.</td></tr>';
    panel.querySelectorAll('[data-person-id]').forEach(button=>button.addEventListener('click',()=>loadPersonProfile(button.dataset.personId)));
    panel.scrollIntoView({behavior:'smooth',block:'start'});
  }catch(error){$('people-body').innerHTML=`<tr><td colspan="5">${esc(error.message||'No fue posible cargar el detalle.')}</td></tr>`;}
}

function closePeople(){
  $('people-panel').classList.add('hidden');
  $('show-people').setAttribute('aria-expanded','false');
}

async function loadPersonProfile(personId){
  const dialog=$('person-profile');
  $('profile-name').textContent='Cargando perfil…';
  $('profile-content').innerHTML='<p class="empty">Consultando trayectoria…</p>';
  dialog.showModal();
  try{
    const response=await fetch('/api/admin/person/'+encodeURIComponent(personId));
    const data=await response.json();if(!response.ok)throw new Error(data.message||'No fue posible abrir el perfil.');
    const p=data.person, experiences=p.experiencias||[], resources=p.recursos||[];$('profile-name').textContent=p.nombre;
    $('profile-content').innerHTML=`<section class="profile-summary"><div><span>Vinculación</span><strong>${esc(p.tipo_vinculacion||'Pendiente')}</strong></div><div><span>Documento</span><strong>${esc(p.documento_mascarado||'No disponible')}</strong></div><div><span>Correo</span><strong>${esc(p.correo_mascarado||'No disponible')}</strong></div><div><span>Programa</span><strong>${esc(p.programa)}</strong></div><div><span>Facultad / modalidad</span><strong>${esc(p.facultad||'Sin información')} · ${esc(p.modalidad)}</strong></div><div><span>Validación</span><strong>${esc(String(p.estado_validacion||'Pendiente').replaceAll('_',' '))}</strong></div></section><section class="profile-resources"><div class="profile-section-title"><p class="eyebrow">Documentos, enlaces y prototipos</p><h3>Recursos asociados a su trayectoria</h3></div><div class="profile-resource-grid">${resources.length?resources.map(resource=>`<article><span class="resource-kind">${esc(resource.tipo)}</span><strong>${esc(resource.iniciativa)}</strong><p>${esc(resource.titulo)}</p>${resource.url?`<a class="resource-link" href="${esc(resource.url)}" target="_blank" rel="noopener noreferrer">Abrir ${esc(String(resource.tipo).toLowerCase())}</a>`:'<small class="resource-pending">Recurso pendiente de configuración</small>'}</article>`).join(''):'<article class="empty-resource"><strong>Sin recursos asociados</strong><p>Las experiencias de esta persona todavía no tienen documentos, enlaces o prototipos configurados.</p></article>'}</div></section><section class="profile-experiences"><div class="profile-section-title"><p class="eyebrow">Trayectoria Impacta</p><h3>${number(experiences.length)} experiencias registradas</h3></div><div class="profile-timeline">${experiences.length?experiences.map(exp=>`<article><div class="experience-year">${esc(exp.anio||'—')}</div><div class="experience-dot"></div><div><h4>${esc(exp.programa_iniciativa||exp.tipo_experiencia||'Experiencia Impacta')}</h4><p>${esc(exp.fase||'Fase sin registrar')} · ${esc(exp.estado_participacion||'Estado sin registrar')}</p><small>${esc(exp.cohorte||'Sin cohorte')} · ${esc(exp.fecha||'Fecha no disponible')}</small></div></article>`).join(''):'<p class="empty">No hay experiencias registradas.</p>'}</div></section>`;
  }catch(error){$('profile-name').textContent='Perfil no disponible';$('profile-content').innerHTML=`<p class="status error">${esc(error.message)}</p>`;}
}

function renderQuality(data){
  const total=Math.max(data.personas_total||0,1);
  const items=[['Sin documento',data.sin_documento],['Sin correo',data.sin_correo],['Sin programa',data.sin_programa],['Sin facultad',data.sin_facultad],['Sin modalidad',data.sin_modalidad],['Documentos repetidos',data.documentos_duplicados]];
  $('quality-grid').innerHTML=items.map(([label,value])=>`<div class="quality-item ${value?'attention':'healthy'}"><span>${esc(label)}</span><strong>${number(value)}</strong><small>${(value/total*100).toLocaleString('es-CO',{maximumFractionDigits:1})}%</small></div>`).join('');
}

function renderPrototypes(rows){
  const resourceCard=item=>{
    const ready=item.activo&&item.formulario_configurado&&item.campos_prefill>0;
    const resource=item.recurso||{};
    return `<article class="prototype-card"><div class="prototype-head"><span class="prototype-state ${ready?'ready':'pending'}">${ready?'Listo para prueba':'Configuración pendiente'}</span><strong>${esc(item.nombre)}</strong></div><div class="resource-summary"><span>${esc(resource.tipo||'Pendiente')}</span><strong>${esc(resource.titulo||'Recurso por configurar')}</strong>${resource.url?`<a class="resource-link" href="${esc(resource.url)}" target="_blank" rel="noopener noreferrer">Abrir ${esc(String(resource.tipo||'recurso').toLowerCase())}</a>`:'<small>Agrega un documento, enlace o prototipo.</small>'}</div><ul><li class="${item.activo?'ok-check':''}">Convocatoria activa</li><li class="${item.formulario_configurado?'ok-check':''}">Microsoft Forms conectado</li><li class="${item.campos_prefill?'ok-check':''}">${number(item.campos_prefill)} campos precargados</li><li class="${item.respuestas_procesadas?'ok-check':''}">${number(item.respuestas_procesadas)} respuestas procesadas</li></ul><small>${esc(item.codigo)}</small></article>`;
  };
  const all=rows||[], events=all.filter(item=>String(item.tipo||'').toLowerCase()==='evento');
  $('prototype-grid').innerHTML=all.filter(item=>String(item.tipo||'').toLowerCase()!=='evento').map(resourceCard).join('')||'<p class="empty">No hay prototipos configurados.</p>';
  $('events-grid').innerHTML=events.map(resourceCard).join('')||'<article class="empty-resource"><strong>Aún no hay eventos configurados</strong><p>Cuando se cree un contexto de tipo Evento, aquí aparecerán su documento, enlace o prototipo sin mezclarlo con las convocatorias.</p></article>';
}

async function loadDashboard(){
  $('status').className='status'; $('status').textContent='Actualizando indicadores…';
  const params=new URLSearchParams(); dimensions.forEach(key=>{if($(key).value)params.set(key,$(key).value);});
  currentDashboardParams=new URLSearchParams(params);closePeople();
  try{
    const response=await fetch('/api/admin/dashboard?'+params.toString());
    const data=await response.json(); if(!response.ok)throw new Error(data.message||'Error de consulta');
    if(!optionsLoaded){dimensions.forEach(key=>fillSelect(key,data.options[key]||[]));optionsLoaded=true;}
    $('personas').textContent=number(data.totals.personas);
    $('participaciones').textContent=number(data.totals.participaciones);
    $('anios').textContent=number(data.totals.anios);
    $('promedio').textContent=data.totals.personas?(data.totals.participaciones/data.totals.personas).toLocaleString('es-CO',{maximumFractionDigits:2}):'0';
    const share=data.baseline.participaciones?data.totals.participaciones/data.baseline.participaciones*100:0;
    $('zoom-share').textContent=share.toLocaleString('es-CO',{maximumFractionDigits:1})+'%';
    $('zoom-bar').style.width=Math.max(share?2:0,share)+'%';
    $('zoom-title').textContent=params.size?'Segmento seleccionado':'Universo completo';
    $('zoom-detail').textContent=`${number(data.totals.participaciones)} de ${number(data.baseline.participaciones)} participaciones · ${number(data.totals.personas)} personas en el segmento.`;
    $('provisionales').textContent=number(data.control.identidades_provisionales);
    $('pendientes').textContent=number(data.control.pendientes_confirmacion);
    $('revision-accesos').textContent=number(data.control.revisiones_acceso);
    $('revision-forms').textContent=number(data.control.revisiones_forms);
    $('correcciones').textContent=number(data.control.correcciones_solicitadas);
    renderQuality(data.quality||{});renderPrototypes(data.prototypes||[]);
    renderBars('chart-fase',data.distributions.fase,'fase');
    renderBars('chart-modalidad',data.distributions.modalidad,'modalidad');
    renderBars('chart-tipo',data.distributions.tipo_experiencia,'tipo_experiencia');
    renderBars('chart-estado',data.distributions.estado_participacion,'estado_participacion');
    renderBars('chart-validacion',data.distributions.estado_validacion,'estado_validacion');
    renderBars('chart-facultad',data.distributions.facultad,'facultad',15);
    renderBars('chart-programa',data.distributions.programa,'programa',15);
    renderBars('chart-anio',data.distributions.anio,'anio',30);
    renderActiveFilters();
    $('status').textContent=params.size?'Filtros aplicados correctamente.':'Mostrando el consolidado completo.';
  }catch(error){$('status').className='status error';$('status').textContent=error.message||'No fue posible cargar el dashboard.';}
}

async function loadReviews(){
  const target=$('review-list');target.innerHTML='<p class="empty">Cargando casos…</p>';
  try{
    const response=await fetch('/api/admin/reviews');const data=await response.json();if(!response.ok)throw new Error(data.message);
    target.innerHTML=data.items.length?data.items.map(item=>`<article class="review-item" data-review="${esc(item.id_revision)}"><div><span class="review-type">${esc(item.tipo.replaceAll('_',' '))}</span><h3>${esc(item.nombre)}</h3><p>${esc(item.origen)} · ${esc(item.estado.replaceAll('_',' '))}</p><small>${esc(item.fecha||'Fecha pendiente')}${item.motivo?' · '+esc(item.motivo):''}</small></div><div class="review-actions"><button data-action="RESUELTA">Resolver</button><button class="secondary" data-action="RECHAZADA">Rechazar</button></div></article>`).join(''):'<p class="empty">No hay casos pendientes de revisión.</p>';
    target.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',async()=>{
      const item=button.closest('[data-review]');button.disabled=true;
      const response=await fetch('/api/admin/reviews/resolve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id_revision:item.dataset.review,accion:button.dataset.action,observacion:'Decisión registrada desde la bandeja administrativa.'})});
      const result=await response.json();if(!response.ok){button.disabled=false;alert(result.message||'No fue posible resolver el caso.');return;}await Promise.all([loadReviews(),loadDashboard()]);
    }));
  }catch(error){target.innerHTML=`<p class="empty">${esc(error.message||'No fue posible cargar la bandeja.')}</p>`;}
}

dimensions.forEach(key=>$(key).addEventListener('change',loadDashboard));
$('reset').addEventListener('click',()=>{dimensions.forEach(key=>$(key).value='');loadDashboard();});
$('refresh-reviews').addEventListener('click',loadReviews);
$('show-people').addEventListener('click',()=>loadPeople(currentDashboardParams));
$('close-people').addEventListener('click',closePeople);
$('close-profile').addEventListener('click',()=>$('person-profile').close());
$('person-profile').addEventListener('click',event=>{if(event.target===$('person-profile'))$('person-profile').close();});
loadDashboard();loadReviews();
