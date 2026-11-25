(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const setStatus=(message,error=false)=>{$('access-status').textContent=message;$('access-status').className=`evidence${error?' error':''}`;};

  $('send-code').addEventListener('click',async()=>{
    const email=$('access-email').value.trim();
    if(!email){$('access-email').reportValidity();return;}
    $('send-code').disabled=true;setStatus('Enviando el cÃ³digo al correo indicadoâ€¦');
    try{
      await window.PasaporteAPI.requestAccessCode(email);
      $('code-step').classList.remove('hidden');$('access-code').required=true;$('access-code').focus();
      setStatus('CÃ³digo enviado. Revisa tu correo e ingrÃ©salo para continuar.');
    }catch(error){setStatus(error.message||'No fue posible enviar el cÃ³digo.',true);}
    finally{$('send-code').disabled=false;}
  });

  $('access-form').addEventListener('submit',async event=>{
    event.preventDefault();
    const email=$('access-email').value.trim(),code=$('access-code').value.trim();
    if(!/^\d{6}$/.test(code)){$('access-code').setCustomValidity('Ingresa el cÃ³digo de seis dÃ­gitos.');$('access-code').reportValidity();$('access-code').setCustomValidity('');return;}
    $('verify-code').disabled=true;setStatus('Verificando el cÃ³digoâ€¦');
    try{
      const verified=await window.PasaporteAPI.verifyAccessCode(email,code);
      if(verified.estado==='VERIFICADO_REQUIERE_REGISTRO'||verified.persona?.estado_identidad==='EXTERNO_NUEVO'){
        throw new Error('El correo fue verificado, pero aÃºn no tiene una ficha de identidad en el Pasaporte.');
      }
      if(!verified.persona?.id_persona&&!verified.persona?.IDPersona)throw new Error('No se recibiÃ³ una identidad asociada a este correo.');
      setStatus('CÃ³digo vÃ¡lido. Consultando el pasaporteâ€¦');
      const result=await window.PasaporteAPI.getPassport();
      if(result.estado!=='OK'||!Array.isArray(result.participaciones))throw new Error('El servicio no devolviÃ³ la trayectoria esperada.');
      renderPassport(verified.persona,result.participaciones);
      $('passport-panel').classList.remove('hidden');
      $('passport-panel').scrollIntoView({behavior:'smooth',block:'start'});
      setStatus('Identidad verificada. Esta trayectoria procede de SharePoint.');
    }catch(error){
      sessionStorage.removeItem('pasaporteAccessToken');
      setStatus(error.message||'No fue posible consultar el pasaporte.',true);
    }finally{$('verify-code').disabled=false;}
  });

  function renderPassport(person,items){
    $('passport-title').textContent=person.nombre||'Trayectoria de la persona verificada';
    const details=[person.estado_identidad,person.programa,person.facultad].filter(Boolean);
    $('identity-summary').textContent=details.length?`Ficha verificada Â· ${details.join(' Â· ')}`:'Ficha verificada por correo.';
    const active=items.filter(item=>String(item.EstadoRegistro||'').toUpperCase()!=='ANULADO');
    const box=$('passport-items');box.replaceChildren();
    if(!active.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='TodavÃ­a no hay experiencias registradas en este pasaporte.';box.append(empty);return;}
    for(const item of active){
      const stamp=document.createElement('article');stamp.className='passport-stamp';
      const meta=document.createElement('span');meta.textContent=[item.Anio,item.FaseParticipacion||'Impacta'].filter(Boolean).join(' Â· ');
      const name=document.createElement('strong');name.textContent=item.ProgramaIniciativa||'Experiencia Impacta';
      const state=document.createElement('small');state.textContent=item.EstadoParticipacion||'ParticipaciÃ³n registrada';
      stamp.append(meta,name,state);box.append(stamp);
    }
  }

  $('sign-out').addEventListener('click',()=>{
    sessionStorage.removeItem('pasaporteAccessToken');
    $('passport-panel').classList.add('hidden');$('access-form').reset();$('code-step').classList.add('hidden');
    $('access-code').required=false;setStatus('Consulta cerrada.');$('access-email').focus();
  });
})();

