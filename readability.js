/* Contextual map reading. All previews and connection paths are read-only. */
(function () {
  'use strict';
  let selectedId = null, watchedGame = null, previous = new Map(), disconnected = [], tick = 0, selectedPath = [];
  const names = {core:'Cœur',relay:'Relais',extractor:'Extracteur',bastion:'Bastion',barracks:'Caserne',scout:'Éclaireur',fighter:'Combattant',breaker:'Briseur',engineer:'Ingénieur',saboteur:'Saboteur'};
  const roles = {
    core:'Votre couleur part d’ici. Gardez vos bâtiments reliés à ce Cœur.',
    relay:'Étend votre couleur autour de lui. Le trait montre sa liaison au Cœur.',
    extractor:'Exploite une source pour produire du pigment.',
    bastion:'Tire sur les ennemis qui s’approchent.',
    barracks:'Formez vos renforts ici depuis « Mobiliser ».',
    scout:'Explore vite. Touchez « Donner un ordre », puis sa destination.',
    fighter:'Conquiert et combat. Touchez « Donner un ordre », puis votre cible.',
    breaker:'Attaque à distance, surtout les bâtiments.',
    engineer:'Répare automatiquement les bâtiments alliés proches.',
    saboteur:'Rapide et fragile. Envoyez-le couper les relais adverses.'
  };
  const stopped = {
    relay:'La couleur ne progresse plus. Reliez ce territoire à votre Cœur.',
    extractor:'La production est arrêtée. Reliez cette source à votre Cœur.',
    bastion:'La défense est arrêtée. Reliez ce territoire à votre Cœur.',
    barracks:'La file est en pause. Reliez cette caserne à votre Cœur.'
  };
  const wrap = document.getElementById('canvasWrap');
  const card = document.createElement('div'); card.className='object-card hidden';card.id='objectCard';card.setAttribute('role','status');
  card.innerHTML='<div class="object-heading"><strong id="objectName"></strong><span id="objectState"></span></div><p id="objectRole"></p><div class="object-health" id="objectHealthTrack" aria-hidden="true"><i id="objectHealth"></i></div><button id="dismissObject" aria-label="Fermer la sélection">×</button>';
  wrap.append(card);
  const previewCard = document.createElement('div'); previewCard.id='buildPreviewCard';previewCard.className='build-preview-card hidden';previewCard.setAttribute('role','status');
  previewCard.innerHTML='<div class="build-preview-heading"><strong id="buildPreviewName"></strong><span id="buildPreviewCost"></span></div><p id="buildPreviewMessage"></p><button id="cancelBuildPreview" type="button" aria-label="Annuler la construction">×</button><div id="placementConfirmActions" hidden><span>Touchez une autre case pour déplacer.</span><button id="confirmBuild" type="button">Valider</button></div>';
  wrap.append(previewCard);
  document.getElementById('cancelBuildPreview').onclick=()=>{setMode(null);previewCard.classList.add('hidden')};
  const alert = document.createElement('button');alert.id='networkAlert';alert.className='network-alert hidden';alert.setAttribute('aria-live','polite');wrap.append(alert);
  alert.onclick=()=>{const b=disconnected[0];if(b){CQCamera.focus(b.x+.5,b.y+.5,2.3);selectBuilding(b)}};
  document.getElementById('dismissObject').onclick=()=>{clearBuilding();selection=[];card.classList.add('hidden')};
  const income=document.createElement('span');income.id='income';income.className='income';document.querySelector('.resource').append(income);
  const element = id => document.getElementById(id);
  const setText = (id,value) => {const node=element(id);if(node.textContent!==value)node.textContent=value};
  const readable = entity => entity && entity.hp>0 && (entity.team===1 || game.tile(entity.x,entity.y)?.visible);

  function selectBuilding(b){
    if(!game||!readable(b)){clearBuilding();return}
    if(watchedGame!==game){reset();watchedGame=game}
    selectedId=b.id;selection=[];setMode(null);
    if(b.team===1&&['core','barracks'].includes(b.type))window.CQStrategy?.setRecruitSource?.(b.id);
    audio('select_001');update(true);
  }
  function clearBuilding(){selectedId=null;selectedPath=[];card.classList.add('hidden')}
  function reset(){selectedId=null;selectedPath=[];watchedGame=null;previous.clear();disconnected=[];card.classList.add('hidden');previewCard.classList.add('hidden');alert.classList.add('hidden')}

  // Network connectivity follows orthogonally adjacent owned tiles. A straight
  // line between buildings would wrongly imply passage through hostile ground.
  function networkPath(x,y){
    if(!game)return [];
    const start=game.tile(x,y),core=game.buildings.find(b=>b.type==='core'&&b.team===1&&b.hp>0);
    const canPass=t=>t&&t.owner===1&&t.connected&&!t.blocked;
    if(!canPass(start)||!core)return [];
    const width=game.width,startKey=start.y*width+start.x,endKey=core.y*width+core.x;
    const from=new Map([[startKey,null]]),queue=[start];
    for(let head=0;head<queue.length;head++){
      const tile=queue[head],key=tile.y*width+tile.x;
      if(key===endKey){
        const route=[];let cursor=key;
        while(cursor!==null){route.push({x:cursor%width,y:Math.floor(cursor/width)});cursor=from.get(cursor)}
        return route.reverse();
      }
      for(const [dx,dy] of [[0,1],[1,0],[0,-1],[-1,0]]){
        const next=game.tile(tile.x+dx,tile.y+dy);if(!canPass(next))continue;
        const nextKey=next.y*width+next.x;if(from.has(nextKey))continue;
        from.set(nextKey,key);queue.push(next);
      }
    }
    return [];
  }

  function update(force=false){
    if(!game||!playing){previewCard.classList.add('hidden');return}
    if(watchedGame!==game){reset();watchedGame=game}
    previewCard.classList.toggle('hidden',mode?.kind!=='build');
    // A scene change or cancelled selection must release the map immediately;
    // only text/stat refresh is throttled, never this hit-testing surface.
    if(selectedId&&!game.buildings.some(b=>b.id===selectedId&&readable(b)))clearBuilding();
    if(mode||(!selectedId&&!selection.some(id=>game.units.some(u=>u.id===id&&u.team===1&&u.hp>0)))){card.classList.add('hidden');selectedPath=[]}
    if(!force&&performance.now()-tick<120)return;tick=performance.now();
    income.textContent='+'+(game.income[1]??2.6).toFixed(1).replace('.',',')+'/s';
    disconnected=game.buildings.filter(b=>b.team===1&&b.hp>0&&!b.connected);
    const newly=disconnected.filter(b=>previous.get(b.id)===true);
    if(!window.CQAlerts){
      if(newly.length&&!window.CQTutorial?.active){toast('Réseau coupé : '+disconnected.length+' bâtiment(s) isolé(s). Touchez l’alerte pour les voir.');audio('error_001')}
      previous=new Map(game.buildings.filter(b=>b.team===1).map(b=>[b.id,b.connected]));
      alert.classList.toggle('hidden',!disconnected.length||!!window.CQTutorial?.active);
      alert.textContent='⚠ '+disconnected.length+' bâtiment'+(disconnected.length>1?'s':'')+' isolé'+(disconnected.length>1?'s':'')+' · Voir';
    }
    let entity=game.buildings.find(b=>b.id===selectedId&&readable(b));
    if(selectedId&&!entity)clearBuilding();
    const picked=game.units.filter(u=>u.team===1&&u.hp>0&&selection.includes(u.id));
    if(!entity&&picked.length===1)entity=picked[0];
    const visible=!!entity||picked.length>1;
    card.classList.toggle('hidden',!visible||!!mode);
    if(!visible){selectedPath=[];return}
    const inMission=!!game.mission;card.classList.toggle('object-mission',inMission);
    if(entity){
      const isBuilding=game.buildings.includes(entity),own=entity.team===1,isolated=isBuilding&&own&&!entity.connected;
      const noun=names[entity.type]||'Bâtiment',female=entity.type==='barracks';
      element('objectName').textContent=(own?(female?'Votre caserne':'Votre '+noun.toLocaleLowerCase('fr')):noun+' adverse')+(!inMission&&isBuilding&&(entity.level||1)>1?' · niv. '+entity.level:'');
      const stats=isBuilding&&game.getBuildingStats?.(entity);
      let description=isolated?(stopped[entity.type]||'Reliez ce bâtiment à votre Cœur.'):roles[entity.type]||'';
      if(entity.type==='extractor'&&!isolated)description='Source exploitée : +'+(stats?.income||3.1).toFixed(1).replace('.',',')+' pigment/s.';
      if(!own)description='Bâtiment adverse repéré. Vos unités peuvent l’attaquer.';
      element('objectRole').textContent=description;
      const state=!own?'Adversaire':isBuilding?(isolated?'⚠ ISOLÉ'+(female?'E':'')+' · à reconnecter':entity.type==='core'?'◉ Centre du réseau':'✓ Relié'+(female?'e':'')+' au Cœur'):'✓ Sous vos ordres';
      element('objectState').textContent=state+(!inMission?' · '+Math.ceil(entity.hp)+'/'+entity.maxHp+' PV':'');
      element('objectHealth').style.width=Math.max(0,entity.hp/entity.maxHp*100)+'%';
      element('objectHealthTrack').hidden=inMission&&entity.hp>=entity.maxHp;
      card.classList.toggle('isolated',isolated);
      card.classList.toggle('object-enemy',!own);
      selectedPath=isBuilding&&own&&entity.connected&&entity.type!=='core'?networkPath(entity.x,entity.y):[];
    }else{
      element('objectName').textContent=picked.length+' unités sélectionnées';
      element('objectState').textContent='✓ Sous vos ordres';
      element('objectRole').textContent='Touchez « Donner un ordre », puis leur destination.';
      const hp=picked.reduce((n,u)=>n+u.hp,0),max=picked.reduce((n,u)=>n+u.maxHp,0);
      element('objectHealth').style.width=hp/max*100+'%';element('objectHealthTrack').hidden=inMission&&hp>=max;
      card.classList.remove('isolated','object-enemy');selectedPath=[];
    }
  }

  function clipMap(c,v){
    c.beginPath();c.rect(Math.max(0,v.x),Math.max(0,v.y),Math.max(0,Math.min(v.w,v.x+game.width*v.cell)-Math.max(0,v.x)),Math.max(0,Math.min(v.h,v.y+game.height*v.cell)-Math.max(0,v.y)));c.clip();
  }
  function drawConnection(c,v,path){
    if(path.length<2)return;
    const trace=()=>{c.beginPath();path.forEach((p,i)=>{const x=v.x+(p.x+.5)*v.cell,y=v.y+(p.y+.5)*v.cell;i?c.lineTo(x,y):c.moveTo(x,y)});c.stroke()};
    c.save();c.lineJoin='round';c.lineCap='round';c.strokeStyle='#fffef8';c.lineWidth=5;trace();
    c.strokeStyle=paletteColor('selection','#174f67');c.lineWidth=2.2;trace();
    for(const p of [path[0],path[path.length-1]]){c.fillStyle='#fffef8';c.beginPath();c.arc(v.x+(p.x+.5)*v.cell,v.y+(p.y+.5)*v.cell,4,0,Math.PI*2);c.fill();c.stroke()}
    c.restore();
  }

  function placementPreview(type,x,y){
    const cost=game?.getCost?.(1,type)??0;
    if(!game||!Number.isFinite(x)||!Number.isFinite(y))return {ok:false,message:'Choisissez une case sur votre couleur.',cost,path:[],tile:null,radius:0};
    x=Math.floor(x);y=Math.floor(y);const tile=game.tile(x,y);
    if(!tile||(!tile.explored&&tile.owner!==1))return {ok:false,message:'Explorez cette zone avant d’y construire.',cost,path:[],tile:null,radius:0,x,y};
    const result=game.canBuild?.(1,type,x,y)||{ok:false,message:'Placement indisponible.'};
    const stats=game.getBuildingStats?.({team:1,type,level:1,x,y});
    let message=result.message;
    if(result.ok)message='✓ Relié au Cœur · '+(type==='extractor'?'source prête à être exploitée.':type==='barracks'?'renforts formés ici.':'la zone pointillée montre sa portée.');
    else if(message==='Construisez sur votre territoire connecté.')message=tile.owner===1?'Ce terrain est isolé. Reliez-le au Cœur.':'Placez ce bâtiment sur votre couleur reliée au Cœur.';
    else if(message==='Pigment insuffisant.')message='Il manque '+Math.max(1,Math.ceil(cost-game.money[1]))+' pigments. Attendez que votre réserve augmente.';
    return {...result,message,cost,x,y,tile,radius:stats?.radius||0,path:tile.owner===1&&tile.connected?networkPath(x,y):[]};
  }
  function drawPlacement(c,v,point,type){
    if(!game||mode?.kind!=='build'){previewCard.classList.add('hidden');return null}
    type=type||mode.type;point=point||window.CQCamera?.placement||hover;
    const preview=placementPreview(type,point?.x,point?.y);
    previewCard.classList.remove('hidden');previewCard.classList.toggle('invalid',!!point&&!preview.ok);
    setText('buildPreviewName',names[type]||'Construction');
    setText('buildPreviewCost',preview.cost+' pigments');
    setText('buildPreviewMessage',preview.message);
    if(!preview.tile)return preview;
    const s=v.cell,x=v.x+(preview.x+.5)*s,y=v.y+(preview.y+.5)*s;
    c.save();clipMap(c,v);drawConnection(c,v,preview.path);
    c.fillStyle=preview.ok?paletteColor('playerFill','#a0e0d0')+'38':'#ce724526';
    c.strokeStyle=preview.ok?paletteColor('playerStrong','#259e8b'):'#a34f2b';c.lineWidth=1.8;
    // Radius is the actual simulation statistic. Its outline does not reveal tiles.
    c.setLineDash([5,4]);c.beginPath();c.arc(x,y,s*preview.radius,0,Math.PI*2);c.fill();c.stroke();c.setLineDash([]);
    c.lineWidth=2;c.strokeRect(v.x+preview.x*s+1,v.y+preview.y*s+1,s-2,s-2);
    c.restore();return preview;
  }

  function draw(c,v){
    if(!game)return;const s=v.cell;
    c.save();clipMap(c,v);
    c.lineWidth=Math.min(2,s*.12);c.lineCap='square';
    for(const t of game.tiles){
      if(!t.owner||(!t.visible&&t.owner!==1)||t.blocked)continue;
      const x=v.x+t.x*s,y=v.y+t.y*s;if(x+s<0||y+s<0||x>v.w||y>v.h)continue;
      c.strokeStyle=t.owner===1?(t.connected?paletteColor('playerStrong','#259e8b'):'#b5863c'):paletteColor('enemyStrong','#d46652');
      c.beginPath();
      const edges=[[0,-1,x,y,x+s,y],[1,0,x+s,y,x+s,y+s],[0,1,x,y+s,x+s,y+s],[-1,0,x,y,x,y+s]];
      for(const [dx,dy,a,b,e,f]of edges){const n=game.tile(t.x+dx,t.y+dy);if(!n||n.owner!==t.owner||n.connected!==t.connected){c.moveTo(a,b);c.lineTo(e,f)}}c.stroke();
    }
    if(!mode&&selectedPath.every(p=>{const t=game.tile(p.x,p.y);return t?.owner===1&&t.connected&&!t.blocked}))drawConnection(c,v,selectedPath);
    // Units keep their real navigation route around obstacles.
    c.strokeStyle=paletteColor('selection','#155a72')+'b0';c.lineWidth=1.6;c.setLineDash([4,4]);
    for(const u of game.units.filter(u=>u.team===1&&selection.includes(u.id)).slice(0,12)){
      if(!u.path.length)continue;c.beginPath();c.moveTo(v.x+u.x*s,v.y+u.y*s);
      for(const p of u.path)c.lineTo(v.x+p.x*s,v.y+p.y*s);c.stroke();
      const dest=u.path[u.path.length-1];c.beginPath();c.arc(v.x+dest.x*s,v.y+dest.y*s,5,0,Math.PI*2);c.stroke();
    }c.setLineDash([]);
    const candidates=[];
    for(const b of game.buildings){
      if(!readable(b))continue;
      const x=v.x+(b.x+.5)*s,y=v.y+(b.y+.5)*s;
      if(x<-60||y<-30||x>v.w+60||y>v.h+30)continue;
      if(b.id===selectedId){c.strokeStyle='#fffef8';c.lineWidth=5;c.beginPath();c.arc(x,y,s*1.35,0,Math.PI*2);c.stroke();c.strokeStyle=paletteColor('selection','#174f67');c.lineWidth=2.5;c.stroke()}
      if(s>=15||b.id===selectedId||b.type==='core'||!b.connected)candidates.push({b,x,y});
      if(b.team===1&&!b.connected){
        // A broken mark remains recognizable in every palette, including monochrome.
        const bx=x+s*.8,by=y-s*.8;c.fillStyle='#fff3dc';c.strokeStyle='#946321';c.lineWidth=1.3;
        c.beginPath();c.arc(bx,by,7,0,Math.PI*2);c.fill();c.stroke();c.beginPath();c.moveTo(bx-2,by-3);c.lineTo(bx+2,by+1);c.moveTo(bx-2,by+1);c.lineTo(bx+2,by-3);c.stroke();c.fillStyle='#946321';c.fillRect(bx-.8,by+3,1.6,1.6);
      }
    }
    const occupied=[];
    candidates.sort((a,b)=>(b.b.id===selectedId?20:!b.b.connected?10:b.b.type==='core'?5:0)-(a.b.id===selectedId?20:!a.b.connected?10:a.b.type==='core'?5:0));
    for(const {b,x,y} of candidates){
      const label=b.type==='core'?(b.team===1?'Votre Cœur':'Cœur adverse'):(names[b.type]||'Bâtiment')+(!b.connected?' · isolé':'');
      c.font='600 11px system-ui';const tw=c.measureText(label).width,rect={x:x-tw/2-5,y:y+s+4,w:tw+10,h:18};
      if(occupied.some(r=>rect.x<r.x+r.w+4&&rect.x+rect.w>r.x-4&&rect.y<r.y+r.h+3&&rect.y+rect.h>r.y-3))continue;
      occupied.push(rect);c.fillStyle=b.connected?'#fffef8f2':'#fff0dcf2';c.beginPath();c.roundRect(rect.x,rect.y,rect.w,rect.h,4);c.fill();
      c.fillStyle=b.connected?'#204b58':'#885715';c.textAlign='center';c.fillText(label,x,rect.y+13);
    }
    c.restore();
  }
  window.CQUI={selectBuilding,clearBuilding,reset,update,draw,drawPlacement,placementPreview,networkPath,get selectedBuilding(){return selectedId}};
})();
