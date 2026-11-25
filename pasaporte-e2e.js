(()=>{
  'use strict';
  const TEST_TITLE='PRUEBA E2E Pasaporte - SelecciÃ³n y participaciÃ³n';
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  let experience=null,formId='',definition=null;

  $('send-code').addEventListener('click',async()=>{
    const email=$('test-email').value.trim();$('send-code').disabled=true;$('access-status').textContent='Enviando cÃ³digo al correo de pruebaâ€¦';
    try{await window.PasaporteAPI.requestAccessCode(email);$('access-status').textContent='CÃ³digo enviado. Ingresa el cÃ³digo para continuar.';}
    catch(error){$('access-status').textContent=error.message||'No fue posible enviar el cÃ³digo.';}
    finally{$('send-code').disabled=false;}
  });

  $('access-form').addEventListener('submit',async event=>{
    event.preventDefault();$('verify-code').disabled=true;$('access-status').textContent='Verificando identidadâ€¦';
    try{
      const verified=await window.PasaporteAPI.verifyAccessCode($('test-email').value.trim(),$('test-code').value.trim());
      if(!verified.IDPersona&&!verified.idPersona)throw new Error('La verificaciÃ³n no devolviÃ³ una identidad asociada. Revisa el registro de prueba.');
      const listed=await window.PasaporteAPI.listExperiences();
      experience=(listed.experiencias||[]).find(item=>(item.Nombre||item.nombre)===TEST_TITLE);
      if(!experience)throw new Error('No aparece publicada la experiencia de prueba en SharePoint.');
      formId=experience.FormularioActivoId||experience.formularioActivoId||'';
      if(!formId)throw new Error('La experiencia publicada no tiene un formulario activo asociado.');
      const result=await window.PasaporteAPI.getPublishedForm(formId);
      const raw=result.formulario?.DefinicionJson||result.formulario?.definicionJson||'{}';
      definition=typeof raw==='string'?JSON.parse(raw):raw;
      renderForm();
      $('experience-title').textContent=`2 Â· ${experience.Nombre||experience.nombre}`;
      $('experience-status').textContent='Formulario cargado desde el servicio PA11 conectado a SharePoint.';
      $('experience-panel').classList.remove('hidden');$('access-status').textContent='Identidad verificada. Completa el formulario publicado.';
    }catch(error){$('access-status').textContent=error.message||'No fue posible cargar el formulario.';}
    finally{$('verify-code').disabled=false;}
  });

  function renderField(field){
    const id=String(field.id||field.clave||'').trim();if(!id)return '';
    const name=esc(id),label=esc(field.label||field.etiqueta||id),required=field.required?' required':'';
    const options=field.options||field.opciones||[];
    if(field.type==='select'||field.tipo==='select'||field.tipo==='choice')return `<div><label for="field-${name}">${label}</label><select id="field-${name}" name="${name}"${required}><option value="">Seleccione</option>${options.map(value=>`<option>${esc(value)}</option>`).join('')}</select></div>`;
    if(field.type==='textarea'||field.tipo==='textarea')return `<div><label for="field-${name}">${label}</label><textarea id="field-${name}" name="${name}" rows="4"${required}></textarea></div>`;
    if(field.type==='checkbox'||field.tipo==='checkbox')return `<div><label><input id="field-${name}" name="${name}" type="checkbox" value="true"${required}> ${label}</label></div>`;
    const type=['email','url','number','date'].includes(field.type)?field.type:'text';
    return `<div><label for="field-${name}">${label}</label><input id="field-${name}" name="${name}" type="${type}"${required}></div>`;
  }

  function renderForm(){
    const fields=definition.fields||definition.campos||[];
    if(!fields.length)throw new Error('La definiciÃ³n publicada no contiene preguntas.');
    $('test-experience-form').innerHTML=fields.map(renderField).join('')+'<div class="completion-action"><button id="submit-test-form" type="submit">Enviar inscripciÃ³n de prueba</button></div>';
    $('test-experience-form').addEventListener('submit',submitForm,{once:true});
  }

  async function submitForm(event){
    event.preventDefault();const button=$('submit-test-form');button.disabled=true;$('experience-status').textContent='Guardando inscripciÃ³n y respuestas en SharePointâ€¦';
    try{
      const idExperience=experience.IDExperiencia||experience.idExperiencia||'';
      const enrollment=await window.PasaporteAPI.registerExperience({idExperiencia:idExperience,idFormulario:formId,origen:'PRUEBA_E2E_PASAPORTE'});
      const idEnrollment=enrollment.id||enrollment.IDInscripcion||'';
      if(!idEnrollment)throw new Error('La respuesta de inscripciÃ³n no devolviÃ³ el ID de inscripciÃ³n.');
      const answers={};for(const [key,value] of new FormData(event.currentTarget).entries())answers[key]=value;
      await window.PasaporteAPI.saveFormResponses({idInscripcion:idEnrollment,idFormulario:formId,version:String(definition.version||1),respuestas:answers});
      $('experience-status').textContent=`InscripciÃ³n guardada en SharePoint Â· Estado ${enrollment.estado||'INSCRITO'}. La respuesta quedÃ³ asociada a la persona verificada.`;
      button.textContent='InscripciÃ³n registrada';
      const passport=await window.PasaporteAPI.getPassport();
      renderPassport(passport.participaciones||[]);
    }catch(error){$('experience-status').textContent=error.message||'No se pudo completar el registro de prueba.';button.disabled=false;}
  }

  function renderPassport(items){
    const matching=items.filter(item=>(item.IDFilaFuente||'').startsWith('PRUEBA_E2E_')||(item.Fuente||'')==='PASAPORTE_EANISTA');
    $('passport-items').innerHTML=matching.length?matching.map(item=>`<article class="passport-stamp"><span>${esc(item.Anio||'')} Â· ${esc(item.FaseParticipacion||'Impacta')}</span><strong>${esc(item.ProgramaIniciativa||'Experiencia Impacta')}</strong><small>${esc(item.EstadoParticipacion||'ParticipaciÃ³n registrada')}</small></article>`).join(''):'<p class="empty">La experiencia todavÃ­a no aparece en el pasaporte. Debe llegar a PARTICIPANDO.</p>';
    $('passport-panel').classList.remove('hidden');
  }
})();

