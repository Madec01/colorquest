/* Camp management and producer selection, designed for portrait play. */
(() => {
  'use strict';
  const $s = id => document.getElementById(id);
  const names = {core:'Cœur',relay:'Relais',extractor:'Extracteur',bastion:'Bastion',barracks:'Caserne',scout:'Éclaireur',fighter:'Combattant',breaker:'Briseur',engineer:'Ingénieur',saboteur:'Saboteur'};
  const icons = {core:'⬡',relay:'◈',extractor:'◉',bastion:'⬡',barracks:'▤',scout:'●',fighter:'■',breaker:'▲',engineer:'✚',saboteur:'◆'};
  const unitTypes = ['scout','fighter','breaker','engineer','saboteur'];
  const unitRoles = {scout:'Explorer vite',fighter:'Conquérir et défendre',breaker:'Assiéger à distance',engineer:'Réparer les bâtiments',saboteur:'Détruire les relais'};
  const fallbackPrices = {scout:22,fighter:35,breaker:65,engineer:55,saboteur:60};
  const fallbackTimes = {scout:4,fighter:6,breaker:9,engineer:8,saboteur:7};
  const doctrines = {
    expansion:{name:'Expansion',icon:'◈',summary:'Plus loin, plus vite',effect:'Relais −25 % de coût. Portée du Cœur et des relais +1 case.'},
    fortification:{name:'Fortification',icon:'⬡',summary:'Un réseau résistant',effect:'Bâtiments +30 % de vie. Les zones coupées tiennent 25 s au lieu de 15 s.'},
    mobility:{name:'Mobilité',icon:'↗',summary:'Des renforts réactifs',effect:'Unités +20 % de vitesse. Durée de recrutement −15 %.'}
  };
  const tabs = {recruit:'Recruter',develop:'Développer',squads:'Escouades',guide:'Guide'};
  let openTab='recruit', opened=false, watchedGame=null, lastTick=0, queueSignature='', developmentSignature='', selectedDoctrine=null, upgradeTarget=null, previousFocus=null, recruitSource=null;
  let discoverySeen=false;
  try { discoverySeen=localStorage.getItem('colorquest.v03.discovered')==='1'; } catch (_) {}

  const trigger=document.createElement('button');trigger.id='strategyOpen';trigger.className='strategy-open';
  trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls','strategySheet');trigger.setAttribute('aria-expanded','false');
  trigger.innerHTML='<span>☷ Camp</span><b class="strategy-badge hidden" id="strategyQueueBadge">0</b><i class="strategy-trigger-progress"></i>';
  document.querySelector('.mobile-tabs').append(trigger);
  const desktopTrigger=document.createElement('button');desktopTrigger.id='strategyDesktopOpen';desktopTrigger.className='strategy-desktop-trigger';
  desktopTrigger.setAttribute('aria-haspopup','dialog');desktopTrigger.setAttribute('aria-controls','strategySheet');desktopTrigger.setAttribute('aria-expanded','false');
  desktopTrigger.innerHTML='<span>☷ Camp & armée</span><small id="strategyDesktopStatus">Renforts · améliorations · escouades</small>';
  document.querySelector('.orders').after(desktopTrigger);
  trigger.onclick=desktopTrigger.onclick=()=>open(openTab);

  const sheet=document.createElement('div');sheet.id='strategySheet';sheet.className='strategy-sheet hidden';
  sheet.innerHTML=`<section class="strategy-dialog" role="dialog" aria-modal="true" aria-labelledby="strategyTitle">
    <header class="strategy-header"><div><span class="strategy-eyebrow">VOTRE RÉSEAU ÉVOLUE</span><h2 id="strategyTitle">Camp & armée</h2></div><button id="strategyClose" class="strategy-icon-button" aria-label="Fermer Camp et armée">×</button></header>
    <div class="strategy-live"><span id="strategyLiveState"><i></i> La partie continue</span><span class="strategy-money" id="strategyMoney">0 ◉</span><button id="strategyPause">Ⅱ Pause</button></div>
    <nav class="strategy-tabs" aria-label="Gestion du camp">${Object.entries(tabs).map(([key,label])=>`<button data-strategy-tab="${key}" aria-controls="strategyPanel" aria-pressed="${key===openTab}">${label}</button>`).join('')}</nav>
    <div class="strategy-production-peek hidden" id="strategyProductionPeek"><button id="strategyProductionMain" data-strategy-action="queue"><span id="strategyProductionName"></span><small id="strategyProductionTime"></small><i><b id="strategyProductionBar"></b></i></button><button id="strategyCancelActive" data-strategy-action="cancel-active" aria-label="Annuler le renfort en formation">×</button></div>
    <div class="strategy-content" id="strategyPanel"></div>
    <div class="strategy-feedback" id="strategyFeedback" role="status" aria-live="polite">Préparez vos renforts sans perdre la bataille de vue.</div>
  </section>`;
  document.body.append(sheet);
  const discovery=document.createElement('button');discovery.id='strategyDiscovery';discovery.className='strategy-discovery hidden';
  discovery.innerHTML='<b>NOUVEAU</b><span>Renforts, escouades, améliorations <strong>Découvrir →</strong></span>';
  document.getElementById('canvasWrap').append(discovery);discovery.onclick=()=>open('guide');
  const upgradeButton=document.createElement('button');upgradeButton.id='strategyObjectUpgrade';upgradeButton.className='strategy-object-upgrade hidden';
  $s('objectCard')?.append(upgradeButton);upgradeButton.onclick=()=>open('develop');
  const quickSource=document.createElement('div');quickSource.id='strategyRecruitSource';quickSource.className='strategy-recruit-source hidden';
  quickSource.innerHTML='<div class="strategy-producer-field"><select id="strategyQuickProducer" aria-label="Lieu de recrutement"></select><i class="strategy-quick-progress"><b id="strategyQuickProgress"></b></i></div><button id="strategyQuickRally" aria-label="Placer le ralliement de ce bâtiment" title="Placer le ralliement">⚑</button><button id="strategyQuickCancel" class="hidden" aria-label="Annuler le renfort en formation" title="Annuler la formation">×</button>';
  $s('unitButtons').before(quickSource);
  $s('strategyQuickProducer').onchange=e=>setRecruitSource(Number(e.target.value));
  $s('strategyQuickRally').onclick=()=>{if(!allowed()||paused||!missionCan('rally'))return;setMode({kind:'rally',producerId:getRecruitSource()});};
  $s('strategyQuickCancel').onclick=()=>{if(allowed())cancelJob(jobs()[0]);};
  const simpleCancel=document.createElement('button');simpleCancel.id='strategySimpleCancel';simpleCancel.className='strategy-simple-cancel';
  simpleCancel.innerHTML='<span aria-hidden="true">×</span><small>Annuler</small>';
  simpleCancel.onclick=()=>{if(allowed())cancelJob(jobs()[0]);};
  $s('strategyClose').onclick=()=>close();
  $s('strategyPause').onclick=()=>{togglePause();report(paused?'Partie en pause. Reprenez pour produire et donner des ordres.':'La partie reprend, la production continue.');update(true);};
  sheet.addEventListener('click',e=>{if(e.target===sheet)close()});
  sheet.querySelectorAll('[data-strategy-tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.strategyTab));
  sheet.addEventListener('click',handleAction);
  document.addEventListener('keydown',e=>{
    if(!opened)return;
    if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();return;}
    if(e.key==='Tab'){
      const focusable=[...sheet.querySelectorAll('button:not(:disabled),select:not(:disabled),a[href]')].filter(el=>!el.closest('.hidden'));
      const first=focusable[0],last=focusable[focusable.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}
    }
    // Camp buttons retain their native keyboard activation; map shortcuts do not leak through.
    e.stopPropagation();
  },true);

  const core=()=>game?.buildings.find(b=>b.team===1&&b.type==='core'&&b.hp>0);
  const price=type=>game?.getCost?.(1,type)??fallbackPrices[type]??0;
  const time=type=>game?.getRecruitTime?.(1,type,getRecruitSource())??fallbackTimes[type];
  const money=()=>game?.money?.[1]??0;
  const producers=()=>game?.getRecruitProducers?.(1)||game?.buildings.filter(b=>b.team===1&&b.hp>0&&(b.type==='core'||b.type==='barracks'))||[];
  const producer=()=>producers().find(b=>b.id===getRecruitSource());
  const jobs=(id=getRecruitSource())=>game?.getRecruitQueue?.(1,id)||(producers().find(b=>b.id===id)?.type==='barracks'?producers().find(b=>b.id===id).queue||[]:game?.queues?.[1]||[]);
  const allJobs=()=>producers().flatMap(b=>jobs(b.id));
  const rally=()=>{const b=producer();return b?.type==='barracks'?b.rally:game?.rally?.[1]};
  const missionCan=(action,type)=>!game?.mission||window.CQMissions?.can?.(game,action,type)!==false;
  const recruitTypes=()=>unitTypes.filter(type=>missionCan('recruit',type));
  const campAllowed=()=>allowed()&&!game.mission;
  const liveUnits=()=>game?.units.filter(u=>u.team===1&&u.hp>0)||[];
  const format=value=>Number(value).toLocaleString('fr-FR',{maximumFractionDigits:1});
  const getSquad=slot=>(game?.getSquad?.(1,slot)||[]).map(value=>typeof value==='object'?value.id:value);
  const activeSelection=()=>liveUnits().filter(u=>selection.includes(u.id));
  const allowed=()=>game&&playing&&!ended&&!window.CQTutorial?.active;
  function getRecruitSource(){
    const list=producers();if(!list.some(b=>b.id===recruitSource))recruitSource=list.find(b=>b.type==='core')?.id??list[0]?.id??null;
    return recruitSource;
  }
  function producerName(b){
    if(!b)return 'Bâtiment indisponible';
    return b.type==='core'?'Cœur':'Caserne '+(producers().filter(p=>p.type==='barracks').findIndex(p=>p.id===b.id)+1);
  }
  function setRecruitSource(id){
    if(!producers().some(b=>b.id===id))return false;
    recruitSource=id;if(mode?.kind==='rally')mode.producerId=id;
    queueSignature='';update(true);return true;
  }
  function fillProducerSelect(select,compact=false){
    if(!select)return;
    const list=producers(),signature=list.map(b=>b.id).join(',');
    if(select.dataset.producers!==signature){select.dataset.producers=signature;select.replaceChildren(...list.map(b=>{const option=document.createElement('option');option.value=String(b.id);return option;}));}
    for(const [index,b]of list.entries()){
      const queue=jobs(b.id),first=queue[0];
      const state=b.type==='barracks'&&!b.connected?'Coupée':queue.length>1?queue.length+' en file':first?(paused?'Pause':Math.ceil(first.remaining)+' s'):b.type==='core'?'Prêt':'Prête';
      const label=producerName(b)+(compact?' · '+state:queue.length?' · '+queue.length+' en file':' · File vide');
      if(select.options[index].textContent!==label)select.options[index].textContent=label;
    }
    const value=String(getRecruitSource());if(select.value!==value)select.value=value;
  }
  function updateQuickSource(){
    const visible=allowed()&&recruitTypes().length>0,simple=visible&&['contact','link'].includes(game?.mission?.id);
    quickSource.classList.toggle('hidden',!visible||simple);
    document.querySelector('.command-panel')?.classList.toggle('has-recruit-source',visible&&!simple);
    const fighter=$s('unitButtons').querySelector('[data-recruit="fighter"]');
    fighter?.classList.toggle('strategy-simple-production',simple);
    if(!simple){simpleCancel.remove();$s('unitButtons').classList.remove('has-simple-cancel');fighter?.querySelector('.strategy-simple-progress')?.remove();}
    if(!visible)return;
    const b=producer(),queue=jobs(),first=queue[0],isolated=b?.type==='barracks'&&!b.connected;
    if(simple&&fighter){
      fighter.querySelector('small').textContent=first?queue.length+' en file · '+(paused?'pause':Math.ceil(first.remaining)+' s'):'Formation au Cœur · '+format(time('fighter'))+' s';
      if(!fighter.querySelector('.strategy-simple-progress')){const bar=document.createElement('i');bar.className='strategy-simple-progress';bar.setAttribute('aria-hidden','true');bar.innerHTML='<b></b>';fighter.append(bar);}
      fighter.querySelector('.strategy-simple-progress b').style.width=(first&&first.duration?Math.max(0,1-first.remaining/first.duration)*100:0)+'%';
      $s('unitButtons').classList.toggle('has-simple-cancel',!!first);
      if(first){if(simpleCancel.parentNode!==$s('unitButtons'))$s('unitButtons').append(simpleCancel);simpleCancel.setAttribute('aria-label','Annuler la formation de '+names[first.type]+' · '+Math.floor(first.cost*(first.started ? .5 : 1))+' pigments remboursés');}
      else simpleCancel.remove();
      return;
    }
    fillProducerSelect($s('strategyQuickProducer'),true);
    quickSource.classList.toggle('is-isolated',!!isolated);
    $s('strategyQuickProducer').setAttribute('aria-label','Recruter depuis '+producerName(b)+'. '+(isolated?'Réseau coupé, production suspendue. ':paused?'Partie en pause. ':'')+(first?names[first.type]+', '+Math.ceil(first.remaining)+' secondes, '+queue.length+' en file.':'Aucun renfort en attente.'));
    $s('strategyQuickProgress').style.width=(first&&first.duration?Math.max(0,1-first.remaining/first.duration)*100:0)+'%';
    $s('strategyQuickRally').classList.toggle('hidden',!missionCan('rally'));
    $s('strategyQuickRally').disabled=paused||!b;
    $s('strategyQuickRally').setAttribute('aria-label','Placer le ralliement : '+producerName(b));
    $s('strategyQuickCancel').classList.toggle('hidden',!first);
    if(first)$s('strategyQuickCancel').setAttribute('aria-label','Annuler '+names[first.type]+' à '+producerName(b)+' · '+Math.floor(first.cost*(first.started ? .5 : 1))+' pigments remboursés');
  }
  function cancelJob(job){
    if(!job)return;
    const refund=Math.floor(job.cost*(job.started ? .5 : 1));
    feedback(game.cancelRecruit(1,job.id,getRecruitSource()),'Recrutement annulé · '+refund+' pigments remboursés.');
  }
  function report(message,error=false){
    $s('strategyFeedback').textContent=message;$s('strategyFeedback').classList.toggle('is-error',error);
    if(!opened)toast(message);
  }
  function feedback(result,success){
    const failed=result?.ok===false;audio(failed?'error_001':'confirmation_001');report(failed?(result.message||'Action indisponible.'):success,failed);update(true);return !failed;
  }
  function markDiscovered(){discoverySeen=true;discovery.classList.add('hidden');try{localStorage.setItem('colorquest.v03.discovered','1')}catch(_){}}
  function open(tab='recruit'){
    if(!campAllowed())return;
    previousFocus=document.activeElement;opened=true;setMode(null);markDiscovered();
    sheet.classList.remove('hidden');document.body.classList.add('strategy-sheet-open');
    trigger.setAttribute('aria-expanded','true');desktopTrigger.setAttribute('aria-expanded','true');
    if(tab==='develop')upgradeTarget=window.CQUI?.selectedBuilding??core()?.id;
    setTab(tab);$s('strategyClose').focus();
  }
  function close(restoreFocus=true){
    if(!opened)return;opened=false;sheet.classList.add('hidden');document.body.classList.remove('strategy-sheet-open');
    trigger.setAttribute('aria-expanded','false');desktopTrigger.setAttribute('aria-expanded','false');
    if(restoreFocus&&previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
  }
  function setTab(tab){
    openTab=tabs[tab]?tab:'recruit';queueSignature='';developmentSignature='';
    if(openTab==='develop'&&!upgradeTarget)upgradeTarget=window.CQUI?.selectedBuilding??core()?.id;
    sheet.querySelectorAll('[data-strategy-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.strategyTab===openTab)));
    render();$s('strategyPanel').scrollTop=0;update(true);
  }
  function render(){
    const panel=$s('strategyPanel');
    if(openTab==='recruit')panel.innerHTML=`<div class="strategy-section-heading"><h3 id="strategyProducerTitle">Renforts au Cœur</h3><span id="strategyCoreLevel">Niveau 1</span></div><label class="strategy-producer-label" for="strategyProducerSelect">Lieu de recrutement<select id="strategyProducerSelect"></select></label><p class="strategy-intro" id="strategyProducerIntro">Chaque bâtiment possède sa propre file. Les renforts apparaissent à côté de lui.</p>
      <div class="strategy-recruit-grid">${recruitTypes().map(type=>`<button class="strategy-unit-card" data-strategy-recruit="${type}"><span class="strategy-unit-icon ${type}" aria-hidden="true">${icons[type]}</span><strong>${names[type]}</strong><span class="strategy-unit-role">${unitRoles[type]}</span><span class="strategy-unit-meta"><b data-unit-price="${type}">${price(type)} ◉</b><span data-unit-time="${type}">${format(time(type))} s</span></span><small data-unit-lock="${type}" class="strategy-unit-lock"></small></button>`).join('')}
      <button class="strategy-rally-card" data-strategy-action="rally"><span aria-hidden="true">⚑</span><strong>Ralliement</strong><small id="strategyRallyLabel">Choisir sur la carte →</small></button></div>
      <div class="strategy-section-heading strategy-queue-heading"><h3 id="strategyQueueTitle">File du Cœur</h3><span id="strategyQueueCount">0 / 6</span></div><div id="strategyQueue" class="strategy-queue"></div><p class="strategy-footnote">Annuler : 100 % remboursé en attente, 50 % pendant la formation. 6 places par bâtiment, 36 unités au total, formations comprises. Une caserne coupée suspend sa file ; sa destruction rembourse les formations selon ces mêmes règles.</p>`;
    if(openTab==='recruit')$s('strategyProducerSelect').onchange=e=>setRecruitSource(Number(e.target.value));
    if(openTab==='develop')panel.innerHTML='<div id="strategyDevelopment"></div>';
    if(openTab==='squads')panel.innerHTML=`<div class="strategy-section-heading"><h3>Votre sélection</h3><span id="strategySelectedCount">0 unité</span></div><p class="strategy-intro">Touchez un rôle pour ajouter ou retirer ses unités, puis affectez votre sélection à une escouade.</p>
      <div class="strategy-type-filters">${unitTypes.map(type=>`<button data-strategy-select-type="${type}" aria-pressed="false"><span aria-hidden="true">${icons[type]}</span> ${names[type]} <b data-type-count="${type}">0</b></button>`).join('')}</div>
      <div class="strategy-selection-actions"><button data-strategy-action="select-all">Toute l’armée</button><button data-strategy-action="select-map">Choisir sur la carte ↗</button></div>
      <div class="strategy-section-heading"><h3>3 escouades</h3><span>RAPPEL EN UN TOUCHER</span></div><div class="strategy-squads">${[0,1,2].map(slot=>`<div class="strategy-squad"><button data-strategy-squad="${slot}"><span class="strategy-squad-number">${slot+1}</span><span><strong>Escouade ${slot+1}</strong><small data-squad-size="${slot}">Vide</small></span></button><button data-strategy-assign="${slot}">Affecter</button></div>`).join('')}</div>
      <div class="strategy-section-heading"><h3>Ordres à la sélection</h3></div><div class="strategy-order-grid"><button data-strategy-order="hold"><span>▣</span> Tenir</button><button data-strategy-order="attack"><span>⚔</span> Attaquer</button><button data-strategy-order="retreat"><span>↙</span> Se replier</button><button data-strategy-order="move"><span>↗</span> Se déplacer</button></div><p class="strategy-footnote">Tenir : défendre sur place. Attaquer : engager les ennemis sur le trajet. Se replier : rejoindre votre Cœur pour se soigner. Déplacer : priorité au trajet.</p>`;
    if(openTab==='guide')panel.innerHTML=`<div class="strategy-guide-intro"><span>◈</span><div><h3>Une armée, une stratégie.</h3><p>Gardez de la réserve pour le front : améliorer votre Cœur coûte autant que plusieurs unités.</p></div></div>
      <article class="strategy-guide-card"><b>01</b><div><h3>Préparez les renforts</h3><p>Le Cœur et chaque caserne forment leurs propres renforts, avec 6 places par file. Choisissez leur lieu de formation et leur ralliement. Une caserne coupée attend sa reconnexion.</p><button data-strategy-guide="recruit">Ouvrir le recrutement →</button></div></article>
      <article class="strategy-guide-card"><b>02</b><div><h3>Faites évoluer votre base</h3><p>Le Cœur, les relais, extracteurs et bastions possèdent 3 niveaux et doivent être connectés pour évoluer. Le Cœur de niveau 2 débloque deux spécialistes et le choix d’une spécialisation.</p><button data-strategy-guide="develop">Voir les améliorations →</button></div></article>
      <article class="strategy-guide-card"><b>03</b><div><h3>Répartissez vos forces</h3><p>Créez jusqu’à 3 escouades avec la sélection. Tenir garde une position, Attaquer engage en chemin, Se replier ramène les unités se soigner au Cœur.</p><button data-strategy-guide="squads">Organiser les escouades →</button></div></article>
      <article class="strategy-guide-card"><b>04</b><div><h3>Choisissez votre manière de jouer</h3><p>Expansion pour étendre le réseau, Fortification pour le protéger ou Mobilité pour les raids. Une spécialisation coûte 100 pigments et reste active pour toute la partie.</p></div></article>
      <div class="strategy-tip"><b>Les spécialistes</b><p>L’ingénieur répare automatiquement les bâtiments alliés proches mais ne combat pas. Le saboteur inflige de gros dégâts aux relais ; protégez-le des combattants.</p></div>`;
  }
  function renderQueue(){
    const queue=jobs(),signature=getRecruitSource()+':'+queue.map(job=>job.id).join(',');
    if(queueSignature!==signature||!$s('strategyQueue').children.length){
      queueSignature=signature;
      $s('strategyQueue').innerHTML=queue.length?queue.map((job,index)=>`<div class="strategy-queue-item" data-queue-job="${job.id}"><span class="strategy-queue-icon">${icons[job.type]||'●'}</span><div class="strategy-queue-details"><strong>${names[job.type]||'Unité'}</strong><small data-queue-text="${job.id}">${index?'En attente':'Formation'}</small><div class="strategy-queue-bar"><i data-queue-bar="${job.id}"></i></div></div><button data-strategy-cancel="${job.id}" aria-label="Annuler le recrutement : ${names[job.type]||'unité'}">×</button></div>`).join(''):'<div class="strategy-queue-empty">Aucun renfort en attente.<span>Choisissez une unité ci-dessus.</span></div>';
    }
    for(const [index,job]of queue.entries()){
      const progress=job.duration?Math.max(0,Math.min(1,1-job.remaining/job.duration)):0;
      sheet.querySelector(`[data-queue-bar="${job.id}"]`).style.width=(progress*100)+'%';
      const active=index===0;
      const isolated=producer()?.type==='barracks'&&!producer()?.connected;
      sheet.querySelector(`[data-queue-text="${job.id}"]`).textContent=(active?(paused?'En pause · ':isolated?'Réseau coupé · ':'En formation · ')+Math.ceil(job.remaining)+' s':'En attente · '+format(job.duration)+' s')+' · remboursement '+Math.floor(job.cost*(job.started ? .5 : 1))+' ◉';
    }
    $s('strategyQueueCount').textContent=queue.length+' / 6';
  }
  function buildingEffect(b){
    const next=(b.level||1)+1, expansion=game.specializations?.[1]==='expansion';
    if(next>3)return 'Ce bâtiment a atteint son niveau maximum.';
    if(b.type==='core')return next===2?'Revenu 3,5/s · formation −15 %. Débloque ingénieur, saboteur et spécialisation.':'Revenu 4,5/s · formation −30 %. Le Cœur gagne en portée, en défense et en résistance.';
    if(b.type==='relay')return 'Portée '+((next===2?7:8)+(expansion?1:0))+' cases · +60 PV de base.';
    if(b.type==='extractor')return 'Revenu '+(next===2?'4,5':'6')+' pigments/s · +45 PV de base.';
    if(b.type==='barracks')return 'La caserne forme des renforts près du front. Elle ne possède pas d’amélioration ; sa file reste indépendante de celle du Cœur.';
    return 'Dégâts '+(next===2?'19':'24')+' · portée '+(next===2?'7,25':'8')+' cases · +80 PV de base.';
  }
  function renderDevelopment(){
    const b=game.buildings.find(b=>b.id===upgradeTarget&&b.team===1&&b.hp>0)||core();
    if(!b){$s('strategyDevelopment').innerHTML='<p class="strategy-intro">Votre Cœur est indisponible.</p>';return;}
    if(b.type==='barracks'){
      const signature=[b.id,b.connected].join('|');
      if(developmentSignature!==signature){developmentSignature=signature;$s('strategyDevelopment').innerHTML=`<div class="strategy-upgrade-heading"><span>${icons.barracks}</span><div><h3>${producerName(b)}</h3><p>${b.connected?'Connectée au réseau':'Isolée : formation suspendue'}</p></div></div><p class="strategy-intro">${buildingEffect(b)}</p><div class="strategy-selection-actions"><button data-strategy-action="recruit-here" data-producer="${b.id}">Recruter ici →</button><button data-strategy-action="develop-core">Améliorer mon Cœur</button></div>`;}
      return;
    }
    upgradeTarget=b.id;const doctrine=game.specializations?.[1],level=b.level||1,coreLevel=core()?.level||1;
    const signature=[b.id,level,b.connected,doctrine,coreLevel,selectedDoctrine].join('|');
    if(developmentSignature!==signature){
      developmentSignature=signature;
      $s('strategyDevelopment').innerHTML=`<div class="strategy-upgrade-heading"><span>${icons[b.type]}</span><div><h3>${names[b.type]} <small>niveau ${level} / 3</small></h3><p>${b.connected?'Connecté au réseau':'Isolé : reconnectez-le pour améliorer'}</p></div></div>
        <div class="strategy-building-stats" id="strategyBuildingStats"></div>
        <div class="strategy-upgrade-card"><span class="strategy-eyebrow">${level<3?'PROCHAIN NIVEAU · '+(level+1):'DÉVELOPPEMENT COMPLET'}</span><p>${buildingEffect(b)}</p><button id="strategyUpgrade" data-strategy-action="upgrade">Améliorer</button></div>
        <div class="strategy-selection-actions"><button data-strategy-action="develop-core">Mon Cœur</button><button data-strategy-action="select-building">Choisir un bâtiment ↗</button></div>
        <div class="strategy-section-heading"><h3>Votre spécialisation</h3><span>${doctrine?'CHOIX ACTIF':'100 ◉ · CŒUR NIVEAU 2'}</span></div>
        <p class="strategy-intro">${doctrine?'Votre bonus est actif pour toute la partie.':'Un seul choix pour toute la partie. Touchez une voie pour la comparer, puis confirmez.'}</p>
        <div class="strategy-doctrines">${Object.entries(doctrines).map(([key,value])=>`<button class="strategy-doctrine ${doctrine===key?'chosen':''} ${!doctrine&&selectedDoctrine===key?'preview':''}" data-strategy-doctrine="${key}" ${doctrine?'disabled':''} aria-pressed="${doctrine===key||(!doctrine&&selectedDoctrine===key)}"><span class="strategy-doctrine-icon">${value.icon}</span><div><strong>${value.name}${doctrine===key?' ✓':''}</strong><small>${value.summary}</small><p>${value.effect}</p></div></button>`).join('')}</div>
        ${!doctrine?`<div class="strategy-doctrine-confirm"><p id="strategyDoctrineHint">${selectedDoctrine?'Choix définitif : '+doctrines[selectedDoctrine].name+'.':'Choisissez une spécialisation ci-dessus.'}</p><button id="strategyDoctrineConfirm" data-strategy-action="doctrine">Confirmer · 100 ◉</button></div>`:''}`;
    }
    const stats=game.getBuildingStats?.(b)||{};
    const details=[Math.ceil(b.hp)+' / '+Math.ceil(b.maxHp)+' PV'];
    if(stats.income)details.push('+'+format(stats.income)+' pigment/s');if(stats.radius)details.push('Portée '+format(stats.radius));
    if(b.type==='bastion'&&stats.damage)details.push(format(stats.damage)+' dégâts');
    $s('strategyBuildingStats').textContent=details.join(' · ');
    const upgradeCost=game.getUpgradeCost?.(b.id),canUpgrade=upgradeCost!==null&&upgradeCost!==undefined&&level<3;
    $s('strategyUpgrade').disabled=!canUpgrade||!b.connected||paused||money()<upgradeCost;
    $s('strategyUpgrade').textContent=!canUpgrade?'Niveau maximum':!b.connected?'Connexion nécessaire':paused?'En pause — reprendre pour améliorer':'Niveau '+(level+1)+' · '+upgradeCost+' ◉';
    $s('strategyUpgrade').title=canUpgrade&&money()<upgradeCost?'Il manque '+Math.ceil(upgradeCost-money())+' pigments':'';
    const confirm=$s('strategyDoctrineConfirm');
    if(confirm){confirm.disabled=!selectedDoctrine||coreLevel<2||money()<100||paused;confirm.textContent=coreLevel<2?'Débloqué au Cœur niveau 2':paused?'En pause — reprendre pour choisir':'Confirmer '+(selectedDoctrine?doctrines[selectedDoctrine].name:'le choix')+' · 100 ◉';}
  }
  function updateSquads(){
    const selected=activeSelection();$s('strategySelectedCount').textContent=selected.length+' unité'+(selected.length>1?'s':'');
    for(const type of unitTypes){
      const list=liveUnits().filter(u=>u.type===type),button=sheet.querySelector(`[data-strategy-select-type="${type}"]`);
      sheet.querySelector(`[data-type-count="${type}"]`).textContent=list.length;button.disabled=!list.length;
      button.setAttribute('aria-pressed',String(list.length>0&&list.every(u=>selection.includes(u.id))));
    }
    for(let slot=0;slot<3;slot++){
      const members=getSquad(slot),use=sheet.querySelector(`[data-strategy-squad="${slot}"]`),assign=sheet.querySelector(`[data-strategy-assign="${slot}"]`);
      sheet.querySelector(`[data-squad-size="${slot}"]`).textContent=members.length?members.length+' unités · sélectionner':'Vide';
      use.disabled=!members.length;assign.disabled=!selected.length;assign.textContent=members.length?'Remplacer':'Affecter';
      use.classList.toggle('is-selected',members.length>0&&members.length===selected.length&&members.every(id=>selection.includes(id)));
      assign.setAttribute('aria-label',(members.length?'Remplacer':'Affecter')+' l’escouade '+(slot+1)+' par la sélection');
    }
    sheet.querySelectorAll('[data-strategy-order]').forEach(b=>b.disabled=!selected.length||paused);
  }
  function handleAction(e){
    const button=e.target.closest('button');if(!button||button.disabled||!campAllowed())return;
    if(button.dataset.strategyRecruit){
      if(paused)return;const type=button.dataset.strategyRecruit;if(!missionCan('recruit',type))return;
      const result=game.recruit(1,type,getRecruitSource());
      feedback(result,names[type]+' ajouté à la file : '+producerName(producer())+'.');return;
    }
    if(button.dataset.strategyCancel){
      const raw=button.dataset.strategyCancel,job=jobs().find(j=>String(j.id)===raw);if(!job)return;
      cancelJob(job);return;
    }
    if(button.dataset.strategyGuide){setTab(button.dataset.strategyGuide);return;}
    if(button.dataset.strategyDoctrine){selectedDoctrine=button.dataset.strategyDoctrine;renderDevelopment();return;}
    if(button.dataset.strategySelectType){
      const list=liveUnits().filter(u=>u.type===button.dataset.strategySelectType),ids=list.map(u=>u.id),all=ids.every(id=>selection.includes(id));
      selection=all?selection.filter(id=>!ids.includes(id)):[...new Set([...selection,...ids])];window.CQUI?.clearBuilding();update(true);return;
    }
    if(button.dataset.strategyAssign!==undefined){
      const slot=Number(button.dataset.strategyAssign);feedback(game.assignSquad(1,slot,[...selection]),'Escouade '+(slot+1)+' affectée : '+activeSelection().length+' unités.');return;
    }
    if(button.dataset.strategySquad!==undefined){
      selection=[...getSquad(Number(button.dataset.strategySquad))];window.CQUI?.clearBuilding();
      report('Escouade '+(Number(button.dataset.strategySquad)+1)+' sélectionnée. Choisissez son ordre.');audio('select_001');update(true);return;
    }
    if(button.dataset.strategyOrder){
      if(paused)return;const order=button.dataset.strategyOrder;
      if(order==='attack'||order==='move'){close();setMode({kind:order});return;}
      const result=game.command(1,[...selection],order);if(result?.ok!==false)close();
      feedback(result,order==='hold'?'Position tenue : les unités défendent sur place.':'Repli vers le Cœur : les unités rentrent se soigner.');return;
    }
    switch(button.dataset.strategyAction){
      case 'rally':if(paused||!missionCan('rally'))return;close();setMode({kind:'rally',producerId:getRecruitSource()});break;
      case 'queue':setTab('recruit');$s('strategyPanel').scrollTo({top:$s('strategyQueue').offsetTop-$s('strategyPanel').offsetTop-30,behavior:'smooth'});break;
      case 'cancel-active':cancelJob(jobs()[0]);break;
      case 'recruit-here':setRecruitSource(Number(button.dataset.producer));setTab('recruit');break;
      case 'select-all':selection=liveUnits().map(u=>u.id);window.CQUI?.clearBuilding();report('Toute l’armée est sélectionnée.');update(true);break;
      case 'select-map':close();toast('Touchez une unité sur la carte, puis ouvrez Camp → Escouades.');break;
      case 'select-building':close();toast('Touchez un bâtiment, puis son bouton d’amélioration.');break;
      case 'develop-core':upgradeTarget=core()?.id;developmentSignature='';renderDevelopment();break;
      case 'upgrade':{
        if(paused)return;const b=game.buildings.find(b=>b.id===upgradeTarget);if(!b)return;
        const result=game.upgradeBuilding(1,b.id);developmentSignature='';feedback(result,names[b.type]+' atteint le niveau '+b.level+'.');break;
      }
      case 'doctrine':if(!paused&&selectedDoctrine)feedback(game.chooseSpecialization(1,selectedDoctrine),'Spécialisation '+doctrines[selectedDoctrine].name+' activée pour cette partie.');break;
    }
  }
  function update(force=false){
    if(watchedGame!==game){reset();watchedGame=game;}
    if(!force&&performance.now()-lastTick<100)return;lastTick=performance.now();
    updateQuickSource();
    const canUse=campAllowed();trigger.classList.toggle('hidden',!canUse);desktopTrigger.classList.toggle('hidden',!canUse);
    if(!canUse){close(false);discovery.classList.add('hidden');upgradeButton.classList.add('hidden');$s('objectCard')?.classList.remove('has-strategy-upgrade');return;}
    const queue=jobs(),first=queue[0],total=allJobs().length,source=producer(),isolated=source?.type==='barracks'&&!source.connected,progress=first&&first.duration?Math.max(0,1-first.remaining/first.duration):0;
    trigger.style.setProperty('--cq-queue-progress',String(progress));
    $s('strategyQueueBadge').textContent=total;$s('strategyQueueBadge').classList.toggle('hidden',!total);
    trigger.setAttribute('aria-label','Camp et armée'+(total?' · '+total+' renforts en file au total':''));
    $s('strategyDesktopStatus').textContent=total?total+' renfort'+(total>1?'s':'')+' en file au total':'Renforts · améliorations · escouades';
    const b=game.buildings.find(b=>b.id===window.CQUI?.selectedBuilding&&b.team===1&&b.hp>0);
    const upgradable=b&&b.type!=='barracks'&&missionCan('upgrade');
    upgradeButton.classList.toggle('hidden',!upgradable||!!mode);$s('objectCard')?.classList.toggle('has-strategy-upgrade',!!upgradable&&!mode);
    if(upgradable){const upgradeCost=game.getUpgradeCost?.(b.id);upgradeButton.textContent=(b.level||1)<3?'↑ Améliorer · niveau '+((b.level||1)+1)+(upgradeCost!=null?' · '+upgradeCost+' ◉':''):'✓ Niveau 3 · Voir le développement';}
    discovery.classList.toggle('hidden',discoverySeen||opened||!!mode||!!b||selection.length>0||game.time>90);
    if(!opened)return;
    $s('strategyProductionPeek').classList.toggle('hidden',!first);
    if(first){$s('strategyProductionName').textContent=(icons[first.type]||'●')+' '+names[first.type]+' · '+producerName(source);$s('strategyProductionTime').textContent=(paused?'Pause · ':isolated?'Réseau coupé · ':Math.ceil(first.remaining)+' s · ')+queue.length+' en file →';$s('strategyProductionBar').style.width=(progress*100)+'%';$s('strategyCancelActive').setAttribute('aria-label','Annuler '+names[first.type]+' en formation · '+Math.floor(first.cost*(first.started ? .5 : 1))+' pigments remboursés');}
    $s('strategyMoney').textContent=Math.floor(money())+' ◉';$s('strategyLiveState').innerHTML='<i'+(paused?' class="paused"':'')+'></i> '+(paused?'Partie en pause':'La partie continue');
    $s('strategyPause').textContent=paused?'▶ Reprendre':'Ⅱ Pause';$s('strategyPause').setAttribute('aria-label',paused?'Reprendre la partie':'Mettre la partie en pause');
    if(openTab==='recruit'){
      const level=core()?.level||1;$s('strategyCoreLevel').textContent='Cœur niveau '+level;
      fillProducerSelect($s('strategyProducerSelect'));
      $s('strategyProducerTitle').textContent='Renforts : '+producerName(source);
      $s('strategyQueueTitle').textContent='File : '+producerName(source);
      $s('strategyProducerIntro').textContent=isolated?'Réseau coupé : la formation attend sa reconnexion. Les renforts déjà payés restent dans cette file.':'Chaque bâtiment possède sa propre file et son ralliement. Les renforts apparaissent à côté de lui.';
      for(const type of recruitTypes()){
        const button=sheet.querySelector(`[data-strategy-recruit="${type}"]`),locked=(type==='engineer'||type==='saboteur')&&level<2;
        if(!button)continue;
        const capped=liveUnits().length+total>=36;
        button.disabled=locked||paused||isolated||!source||money()<price(type)||queue.length>=6||capped;
        sheet.querySelector(`[data-unit-price="${type}"]`).textContent=price(type)+' ◉';sheet.querySelector(`[data-unit-time="${type}"]`).textContent=format(time(type))+' s';
        const hint=locked?'Cœur niveau 2 requis':paused?'En pause':isolated?'Reconnectez cette caserne':queue.length>=6?'File complète':capped?'36 unités, formations comprises':money()<price(type)?'Pigment insuffisant':'';
        sheet.querySelector(`[data-unit-lock="${type}"]`).textContent=hint;button.classList.toggle('is-locked',locked);
      }
      $s('strategyRallyLabel').textContent=rally()?'Déplacer son drapeau →':'Choisir sur la carte →';
      sheet.querySelector('[data-strategy-action=rally]').disabled=paused||!missionCan('rally');
      renderQueue();
    }else if(openTab==='develop')renderDevelopment();else if(openTab==='squads')updateSquads();
  }
  function draw(c,v){
    if(!allowed())return;const point=rally();if(!point)return;
    const x=v.x+(point.x+.5)*v.cell,y=v.y+(point.y+.5)*v.cell;if(x<-30||y<-35||x>v.w+30||y>v.h+30)return;
    c.save();c.strokeStyle=paletteColor('selection','#175769');c.fillStyle=C.cyan;c.lineWidth=2;c.beginPath();c.moveTo(x,y+5);c.lineTo(x,y-19);c.stroke();
    c.beginPath();c.moveTo(x+1,y-18);c.lineTo(x+16,y-13);c.lineTo(x+1,y-8);c.closePath();c.fill();c.stroke();
    c.strokeStyle='#ffffff';c.lineWidth=2;c.beginPath();c.ellipse(x,y+6,7,3,0,0,Math.PI*2);c.stroke();
    if(mode?.kind==='rally'||v.cell>=13){c.font='600 10px system-ui';c.textAlign='center';c.fillStyle='#fffef7';c.fillRect(x-29,y+11,58,15);c.fillStyle=paletteColor('selection','#175769');c.fillText('Ralliement',x,y+22);}c.restore();
  }
  function reset(){close(false);queueSignature='';developmentSignature='';selectedDoctrine=null;upgradeTarget=null;recruitSource=null;lastTick=0;discovery.classList.add('hidden');upgradeButton.classList.add('hidden');quickSource.classList.add('hidden');simpleCancel.remove();$s('unitButtons').classList.remove('has-simple-cancel');document.querySelector('.command-panel')?.classList.remove('has-recruit-source');$s('objectCard')?.classList.remove('has-strategy-upgrade');}
  function onGameStart(){reset();watchedGame=game;update(true);}
  window.CQStrategy={open,close,update,reset,onGameStart,draw,getRecruitSource,setRecruitSource,jobs,get isOpen(){return opened},get tab(){return openTab}};
})();
