const $=id=>document.getElementById(id);
const dims=['facultad','programa','modalidad','fase','anio','tipo_experiencia','estado_participacion','estado_validacion'];
let store={personas:[],participaciones:[],validaciones:[],revisiones:[]},filteredPeople=[],filteredParts=[];
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const fmt=v=>new Intl.NumberFormat('es-CO').format(v||0);
const val=(o,...keys)=>{for(const k of keys)if(o?.[k]!==undefined&&o[k]!==null&&String(o[k]).trim()!=='')return String(o[k]).trim();return '';};
const idOf=p=>val(p,'IDPersona','id_persona','IdPersona');
const nameOf=p=>val(p,'NombreCompleto','Nombre','Title')||'Nombre pendiente';
const programOf=p=>val(p,'ProgramaInstitucional','ProgramaReportado','programa');
const modalityOf=p=>val(p,'ModalidadInstitucional','ModalidadReportada','modalidad');
const facultyOf=p=>val(p,'Facultad','facultad');
const linkOf=p=>val(p,'TipoVinculacion','EstadoIdentidad','tipo_vinculacion');
const maskDoc=p=>{const d=val(p,'DocumentoOriginal','DocumentoNormalizado');return d?`••••${d.replace(/\D/g,'').slice(-4)}`:'Documento no disponible';};
const maskEmail=p=>{const e=val(p,'CorreoInstitucionalOriginal','CorreoOriginal','CorreoPersonalOriginal','CorreoNormalizado');if(!e.includes('@'))return 'Correo no disponible';const [u,d]=e.split('@');return `${u.slice(0,1)}${'•'.repeat(Math.min(8,Math.max(3,u.length-1)))}@${d}`;};
const partsFor=id=>store.participaciones.filter(x=>val(x,'IDPersona','id_persona')===id&&val(x,'EstadoRegistro')!=='ANULADO');
const lastValidation=id=>store.validaciones.filter(x=>val(x,'IDPersona')===id).sort((a,b)=>val(b,'FechaValidacion','Created').localeCompare(val(a,'FechaValidacion','Created')))[0];
const validationOf=p=>val(lastValidation(idOf(p)),'Resultado')||val(p,'EstadoValidacion','EstadoIdentidad')||'PENDIENTE';
const endpoint=()=>window.PASAPORTE_CONFIG?.pa09AdminUrl;
const SUMMARY_CACHE_KEY='impactaAdminSummaryV1';
const SUMMARY_CACHE_TTL=5*60*1000;
const afterPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));

function readSummaryCache(){
  try{const cached=JSON.parse(sessionStorage.getItem(SUMMARY_CACHE_KEY)||'null');return cached&&Date.now()-cached.savedAt<SUMMARY_CACHE_TTL?cached:null;}catch(_e){return null;}
}
function writeSummaryCache(){
  const summary={savedAt:Date.now(),personas:store.personas.length,participaciones:store.participaciones.length,validaciones:store.validaciones.length,revisiones:store.revisiones.length};
  try{sessionStorage.setItem(SUMMARY_CACHE_KEY,JSON.stringify(summary));}catch(_e){}
}

async function callAdmin(payload){
  if(window.PasaporteAPI){
    if(payload.accion==='SOLICITAR_CODIGO_ADMIN')return window.PasaporteAPI.requestAdminCode(payload.correo);
    if(payload.accion==='VALIDAR_CODIGO_ADMIN')return window.PasaporteAPI.verifyAdminCode(payload.correo,payload.codigo);
  }
  if(!endpoint())throw new Error('La conexión administrativa aún no está configurada.');
  const r=await fetch(endpoint(),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),referrerPolicy:'no-referrer'});
  let data={};try{data=await r.json();}catch(_e){}
  if(!r.ok)throw new Error(data.mensaje||'No fue posible validar el acceso administrativo.');return data;
}
function accessStatus(message,error=false){$('admin-access-status').textContent=message;$('admin-access-status').className='privacy'+(error?' error':'');}
const waitCuriosities=[
  'Una persona puede tener muchas experiencias sin duplicar su identidad.',
  'El pasaporte conserva la fuente y la fecha de cada validación.',
  'Una participación anulada no desaparece: queda trazable y no entra en los indicadores activos.',
  'Las coincidencias ambiguas se envían a revisión humana antes de asumir una identidad.',
  'Los documentos y correos se enmascaran en las vistas administrativas.',
  'Los filtros permiten pasar del indicador agregado al perfil y su trayectoria.',
  'Impacta InHouse conecta prototipos y evidencias con la persona que los desarrolló.'
];
const waitStages=[
  [0,4,'Comprobando el código de acceso…'],
  [5,12,'Estableciendo una conexión segura con SharePoint…'],
  [18,28,'Consultando el resumen agregado de Impacta…'],
  [42,48,'Recuperando trayectorias y validaciones…'],
  [75,68,'La base es amplia. Seguimos trabajando sin recargar la página…'],
  [110,82,'Preparando indicadores y filtros del dashboard…'],
  [160,90,'Verificando consistencia antes de mostrar los resultados…']
];
let waitTimer=null,curiosityTimer=null,waitStarted=0,curiosityIndex=0,gameScore=0;
function moveStamp(){
  const stamp=$('game-stamp');
  stamp.style.left=`${8+Math.floor(Math.random()*76)}%`;
  stamp.style.top=`${10+Math.floor(Math.random()*66)}%`;
}
function showCuriosity(next=true){
  if(next)curiosityIndex=(curiosityIndex+1)%waitCuriosities.length;
  $('wait-curiosity').textContent=waitCuriosities[curiosityIndex];
}
function startWaitExperience(){
  waitStarted=Date.now();gameScore=0;curiosityIndex=0;
  $('game-score').textContent='0 sellos';$('game-message').textContent='¿Cuántos encuentras antes de que termine la carga?';
  showCuriosity(false);moveStamp();
  $('admin-access').classList.add('hidden');$('admin-wait').classList.remove('hidden');
  const cached=readSummaryCache(),cacheNote=$('wait-cache-note');
  if(cached){cacheNote.textContent=`Último resumen seguro: ${fmt(cached.personas)} personas y ${fmt(cached.participaciones)} participaciones. Estamos actualizándolo con SharePoint.`;cacheNote.classList.remove('hidden');}else cacheNote.classList.add('hidden');
  const tick=()=>{const seconds=Math.floor((Date.now()-waitStarted)/1000),minutes=Math.floor(seconds/60),rest=seconds%60,stage=[...waitStages].reverse().find(([at])=>seconds>=at),progress=Math.min(94,stage[1]+Math.floor(Math.max(0,seconds-stage[0])/12));$('wait-elapsed').textContent=`${String(minutes).padStart(2,'0')}:${String(rest).padStart(2,'0')} transcurridos`;$('wait-stage').textContent=stage[2];$('wait-percentage').textContent=`${progress}%`;$('wait-progress-bar').style.width=`${progress}%`;$('wait-progress').setAttribute('aria-valuenow',String(progress));};
  tick();waitTimer=setInterval(tick,1000);curiosityTimer=setInterval(()=>showCuriosity(true),7000);
}
function stopWaitExperience(){
  clearInterval(waitTimer);clearInterval(curiosityTimer);waitTimer=null;curiosityTimer=null;$('wait-percentage').textContent='100%';$('wait-progress-bar').style.width='100%';$('wait-progress').setAttribute('aria-valuenow','100');$('admin-wait').classList.add('hidden');
}
$('next-curiosity').addEventListener('click',()=>showCuriosity(true));
$('game-stamp').addEventListener('click',()=>{gameScore+=1;$('game-score').textContent=`${gameScore} ${gameScore===1?'sello':'sellos'}`;$('game-message').textContent=gameScore<5?'¡Bien! El siguiente sello ya se movió.':gameScore<10?'¡Excelente ritmo!':'¡Nivel Impacta desbloqueado!';moveStamp();});
if(['127.0.0.1','localhost'].includes(location.hostname)&&new URLSearchParams(location.search).has('preview-wait'))startWaitExperience();
$('admin-email-form').addEventListener('submit',async e=>{e.preventDefault();$('admin-send-code').disabled=true;try{const email=$('admin-email').value.trim().toLowerCase();await callAdmin({accion:'SOLICITAR_CODIGO_ADMIN',correo:email});sessionStorage.setItem('impactaAdminEmail',email);$('admin-code-form').classList.remove('hidden');accessStatus('Código enviado. Revisa tu correo institucional.');$('admin-code').focus();}catch(err){accessStatus(err.message,true);}finally{$('admin-send-code').disabled=false;}});
$('admin-code-form').addEventListener('submit',async e=>{e.preventDefault();$('admin-validate-code').disabled=true;accessStatus('Comprobando acceso y preparando los datos…');startWaitExperience();try{const data=await callAdmin({accion:'VALIDAR_CODIGO_ADMIN',correo:sessionStorage.getItem('impactaAdminEmail')||$('admin-email').value.trim(),codigo:$('admin-code').value.trim()});store={personas:data.personas||[],participaciones:data.participaciones||[],validaciones:data.validaciones||[],revisiones:data.revisiones||[]};writeSummaryCache();$('admin-content').classList.remove('hidden');document.body.classList.remove('admin-locked');await afterPaint();await initialize();stopWaitExperience();}catch(err){stopWaitExperience();$('admin-access').classList.remove('hidden');accessStatus(err.message,true);$('admin-code').focus();}finally{$('admin-validate-code').disabled=false;}});

function distinct(values){return [...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));}
function fill(id,values){$(id).innerHTML=`<option value="">${id==='programa'?'Todos':'Todas'}</option>`+distinct(values).map(x=>`<option>${esc(x)}</option>`).join('');}
function dist(rows,getter){const m=new Map();rows.forEach(x=>{const k=getter(x)||'Sin información';m.set(k,(m.get(k)||0)+1);});return [...m].map(([etiqueta,total])=>({etiqueta,total})).sort((a,b)=>b.total-a.total);}
function bars(id,rows,dim,limit=15){const t=$(id),d=rows.slice(0,limit),max=Math.max(1,...d.map(x=>x.total));t.innerHTML=d.length?d.map(x=>`<button class="bar-row" data-dim="${dim}" data-value="${esc(x.etiqueta)}"><span class="bar-label">${esc(x.etiqueta)}</span><span class="bar-track"><span style="width:${Math.max(2,x.total/max*100)}%"></span></span><strong>${fmt(x.total)}</strong></button>`).join(''):'<p class="empty">Sin datos.</p>';t.querySelectorAll('[data-dim]').forEach(b=>b.onclick=()=>{$(b.dataset.dim).value=b.dataset.value;render();});}
function personForPart(x){return store.personas.find(p=>idOf(p)===val(x,'IDPersona'))||{};}
function matches(p,x,key,want){if(!want)return true;const map={facultad:facultyOf(p)||val(x,'FacultadSnapshot'),programa:programOf(p)||val(x,'ProgramaInstitucionalSnapshot','ProgramaReportadoSnapshot'),modalidad:modalityOf(p)||val(x,'ModalidadInstitucionalSnapshot','ModalidadReportadaSnapshot'),fase:val(x,'FaseParticipacion','Fase'),anio:val(x,'Anio','A_x00f1_o'),tipo_experiencia:val(x,'TipoAcompanamiento','ProgramaIniciativa'),estado_participacion:val(x,'EstadoParticipacion','PosibleDuplicado'),estado_validacion:validationOf(p)};return map[key]===want;}
function render(){
  filteredParts=store.participaciones.filter(x=>{const p=personForPart(x);return val(x,'EstadoRegistro')!=='ANULADO'&&dims.every(k=>matches(p,x,k,$(k).value));});
  const ids=new Set(filteredParts.map(x=>val(x,'IDPersona')).filter(Boolean));filteredPeople=store.personas.filter(p=>ids.has(idOf(p))||(dims.every(k=>!$(k).value)&&!store.participaciones.length));
  $('personas').textContent=fmt(filteredPeople.length);$('participaciones').textContent=fmt(filteredParts.length);$('anios').textContent=fmt(distinct(filteredParts.map(x=>val(x,'Anio'))).length);$('promedio').textContent=filteredPeople.length?(filteredParts.length/filteredPeople.length).toLocaleString('es-CO',{maximumFractionDigits:2}):'0';
  const share=store.participaciones.length?filteredParts.length/store.participaciones.length*100:0;$('zoom-share').textContent=share.toLocaleString('es-CO',{maximumFractionDigits:1})+'%';$('zoom-bar').style.width=share+'%';$('zoom-detail').textContent=`${fmt(filteredParts.length)} de ${fmt(store.participaciones.length)} participaciones · ${fmt(filteredPeople.length)} personas.`;
  $('provisionales').textContent=fmt(store.personas.filter(p=>/PENDIENTE|PROVISIONAL/i.test(linkOf(p))).length);$('pendientes').textContent=fmt(store.validaciones.filter(v=>/PENDIENTE/i.test(val(v,'Resultado'))).length);$('revision-accesos').textContent=fmt(store.revisiones.filter(r=>/ACCESO/i.test(val(r,'TipoRevision'))&&/PENDIENTE/i.test(val(r,'Estado'))).length);$('revision-forms').textContent=fmt(store.revisiones.filter(r=>/FORM/i.test(val(r,'TipoRevision'))&&/PENDIENTE/i.test(val(r,'Estado'))).length);$('correcciones').textContent=fmt(store.validaciones.filter(v=>/CORRECCION/i.test(val(v,'Resultado'))).length);
  const no=(fn)=>store.personas.filter(p=>!fn(p)).length, total=Math.max(store.personas.length,1);$('quality-grid').innerHTML=[['Sin documento',no(p=>val(p,'DocumentoOriginal','DocumentoNormalizado'))],['Sin correo',no(p=>val(p,'CorreoInstitucionalOriginal','CorreoOriginal','CorreoPersonalOriginal'))],['Sin programa',no(programOf)],['Sin facultad',no(facultyOf)],['Sin modalidad',no(modalityOf)]].map(([l,n])=>`<div class="quality-item ${n?'attention':'healthy'}"><span>${l}</span><strong>${fmt(n)}</strong><small>${(n/total*100).toLocaleString('es-CO',{maximumFractionDigits:1})}%</small></div>`).join('');
  bars('chart-fase',dist(filteredParts,x=>val(x,'FaseParticipacion')),'fase');bars('chart-modalidad',dist(filteredParts,x=>modalityOf(personForPart(x))||val(x,'ModalidadInstitucionalSnapshot','ModalidadReportadaSnapshot')),'modalidad');bars('chart-tipo',dist(filteredParts,x=>val(x,'TipoAcompanamiento','ProgramaIniciativa')),'tipo_experiencia');bars('chart-estado',dist(filteredParts,x=>val(x,'EstadoParticipacion','PosibleDuplicado')),'estado_participacion');bars('chart-validacion',dist(filteredPeople,validationOf),'estado_validacion');bars('chart-facultad',dist(filteredParts,x=>facultyOf(personForPart(x))||val(x,'FacultadSnapshot')),'facultad');bars('chart-programa',dist(filteredParts,x=>programOf(personForPart(x))||val(x,'ProgramaInstitucionalSnapshot','ProgramaReportadoSnapshot')),'programa');bars('chart-anio',dist(filteredParts,x=>val(x,'Anio')),'anio',30);
  $('status').textContent=`Datos vivos cargados: ${fmt(store.personas.length)} personas, ${fmt(store.participaciones.length)} participaciones, ${fmt(store.validaciones.length)} validaciones y ${fmt(store.revisiones.length)} revisiones.`;
  renderReviews();renderResources();
}
function renderPeople(){const rows=filteredPeople;$('people-panel').classList.remove('hidden');$('people-count').textContent=`${fmt(rows.length)} personas`;$('people-body').innerHTML=rows.map(p=>{const ps=partsFor(idOf(p));return `<tr><td><button class="person-link" data-person="${esc(idOf(p))}">${esc(nameOf(p))}</button><small>${esc(linkOf(p)||'Pendiente')}</small></td><td>${esc(maskDoc(p))}<small>${esc(maskEmail(p))}</small></td><td>${esc(programOf(p)||'Sin programa')}<small>${esc(facultyOf(p)||'Sin facultad')} · ${esc(modalityOf(p)||'Sin modalidad')}</small></td><td><strong>${fmt(ps.length)} experiencias</strong><small>Última: ${esc(ps.map(x=>val(x,'Anio')).sort().at(-1)||'—')}</small></td><td>${esc(validationOf(p).replaceAll('_',' '))}</td></tr>`;}).join('')||'<tr><td colspan="5">Sin personas en este segmento.</td></tr>';$('people-body').querySelectorAll('[data-person]').forEach(b=>b.onclick=()=>profile(b.dataset.person));}
function profile(id){const p=store.personas.find(x=>idOf(x)===id),ps=partsFor(id).sort((a,b)=>val(a,'Anio').localeCompare(val(b,'Anio')));$('profile-name').textContent=nameOf(p);$('profile-content').innerHTML=`<section class="profile-summary"><div><span>Vinculación</span><strong>${esc(linkOf(p)||'Pendiente')}</strong></div><div><span>Documento</span><strong>${esc(maskDoc(p))}</strong></div><div><span>Correo</span><strong>${esc(maskEmail(p))}</strong></div><div><span>Programa</span><strong>${esc(programOf(p)||'Sin información')}</strong></div><div><span>Facultad / modalidad</span><strong>${esc(facultyOf(p)||'Sin información')} · ${esc(modalityOf(p)||'Sin información')}</strong></div><div><span>Validación</span><strong>${esc(validationOf(p))}</strong></div></section><section class="profile-experiences"><div class="profile-section-title"><p class="eyebrow">Trayectoria Impacta</p><h3>${fmt(ps.length)} experiencias registradas</h3></div><div class="profile-timeline">${ps.map(x=>`<article><div class="experience-year">${esc(val(x,'Anio')||'—')}</div><div class="experience-dot"></div><div><h4>${esc(val(x,'ProgramaIniciativa','TipoAcompanamiento','Title')||'Experiencia Impacta')}</h4><p>${esc(val(x,'FaseParticipacion')||'Sin fase')} · ${esc(val(x,'EstadoParticipacion')||'Registrada')}</p><small>${esc(val(x,'Cohorte','Fuente')||'Sin cohorte')}</small></div></article>`).join('')||'<p class="empty">Sin experiencias registradas.</p>'}</div></section>`;$('person-profile').showModal();}
function renderReviews(){$('review-list').innerHTML=store.revisiones.length?store.revisiones.map(r=>`<article class="review-item"><div><span class="review-type">${esc(val(r,'TipoRevision')||'REVISIÓN')}</span><h3>${esc(val(r,'Title','IDRevision')||'Caso')}</h3><p>${esc(val(r,'Estado')||'PENDIENTE')}</p><small>${esc(val(r,'Detalle')||'Sin detalle')}</small></div></article>`).join(''):'<p class="empty">No hay casos de revisión.</p>';}
function renderResources(){const inhouse=store.participaciones.filter(x=>/INHOUSE|IN HOUSE/i.test(val(x,'FaseParticipacion','ProgramaIniciativa','TipoAcompanamiento'))),events=store.participaciones.filter(x=>/EVENTO/i.test(val(x,'TipoAcompanamiento','ProgramaIniciativa')));const cards=rows=>dist(rows,x=>val(x,'ProgramaIniciativa','NombreProyectoEmpresa','Title')||'Recurso pendiente').map(x=>`<article class="prototype-card"><strong>${esc(x.etiqueta)}</strong><p>${fmt(x.total)} registros asociados</p><small>Documento, enlace o prototipo: pendiente de asociar en SharePoint</small></article>`).join('')||'<p class="empty">No hay registros clasificados.</p>';$('prototype-grid').innerHTML=cards(inhouse);$('events-grid').innerHTML=cards(events);}
async function initialize(){
  fill('facultad',store.personas.map(facultyOf));fill('programa',store.personas.map(programOf));fill('modalidad',store.personas.map(modalityOf));
  $('wait-stage').textContent='Preparando filtros académicos…';$('wait-progress-bar').style.width='96%';$('wait-percentage').textContent='96%';await afterPaint();
  fill('fase',store.participaciones.map(x=>val(x,'FaseParticipacion')));fill('anio',store.participaciones.map(x=>val(x,'Anio')));fill('tipo_experiencia',store.participaciones.map(x=>val(x,'TipoAcompanamiento','ProgramaIniciativa')));fill('estado_participacion',store.participaciones.map(x=>val(x,'EstadoParticipacion','PosibleDuplicado')));fill('estado_validacion',store.personas.map(validationOf));
  dims.forEach(k=>$(k).onchange=render);$('wait-stage').textContent='Dibujando indicadores…';$('wait-progress-bar').style.width='98%';$('wait-percentage').textContent='98%';await afterPaint();render();
}
$('reset').onclick=()=>{dims.forEach(k=>$(k).value='');render();};$('show-people').onclick=renderPeople;$('close-people').onclick=()=>$('people-panel').classList.add('hidden');$('close-profile').onclick=()=>$('person-profile').close();$('refresh-reviews').onclick=renderReviews;
