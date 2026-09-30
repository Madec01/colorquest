/* Map readability, selection details and actionable network alerts. */
(function () {
  'use strict';
  let selectedId = null, watchedGame = null, previous = new Map(), disconnected = [], tick = 0;
  const names = {core:'Cœur',relay:'Relais',extractor:'Extracteur',bastion:'Bastion',scout:'Éclaireur',fighter:'Combattant',breaker:'Briseur',engineer:'Ingénieur',saboteur:'Saboteur'};
  const roles = {core:'Centre du réseau · produit du pigment',relay:'Diffuse votre couleur sur le terrain neutre',extractor:'Produit +3,1 pigment/s si connecté',bastion:'Défend les unités et bâtiments proches',scout:'Explore vite · fragile au combat',fighter:'Conquiert les frontières et défend le réseau',breaker:'Tir à distance · efficace contre les bâtiments',engineer:'Répare les bâtiments alliés à proximité',saboteur:'Rapide et fragile · spécialiste des relais'};
  const wrap = document.getElementById('canvasWrap');
  const card = document.createElement('div'); card.className='object-card hidden';card.id='objectCard';card.setAttribute('role','status');
  card.innerHTML='<div><strong id="objectName"></strong><span id="objectState"></span></div><p id="objectRole"></p><div class="object-health"><i id="objectHealth"></i></div><button id="dismissObject" aria-label="Fermer la sélection">×</button>';
  wrap.append(card);
  const alert = document.createElement('button');alert.id='networkAlert';alert.className='network-alert hidden';alert.setAttribute('aria-live','polite');wrap.append(alert);
  alert.onclick=()=>{const b=disconnected[0];if(b){CQCamera.focus(b.x+.5,b.y+.5,2.3);selectBuilding(b)}};
  document.getElementById('dismissObject').onclick=()=>{selectedId=null;selection=[];card.classList.add('hidden')};
  const income=document.createElement('span');income.id='income';income.className='income';document.querySelector('.resource').append(income);
  function selectBuilding(b){if(!b){selectedId=null;return}selectedId=b.id;selection=[];setMode(null);audio('select_001');update(true)}
  function reset(){selectedId=null;watchedGame=null;previous.clear();disconnected=[];card.classList.add('hidden');alert.classList.add('hidden')}
  function update(force=false){
    if(!game||!playing)return;
    if(watchedGame!==game){reset();watchedGame=game}
    if(!force&&performance.now()-tick<120)return;tick=performance.now();
    income.textContent='+'+(game.income[1]||2.6).toFixed(1).replace('.',',')+'/s';
    disconnected=game.buildings.filter(b=>b.team===1&&!b.connected);
    const newly=disconnected.filter(b=>previous.get(b.id)===true);
    if(newly.length&&!window.CQTutorial?.active){toast('Réseau coupé : '+disconnected.length+' bâtiment(s) isolé(s). Touchez l’alerte pour les voir.');audio('error_001')}
    previous=new Map(game.buildings.filter(b=>b.team===1).map(b=>[b.id,b.connected]));
    alert.classList.toggle('hidden',!disconnected.length||!!window.CQTutorial?.active);
    alert.textContent='⚠ '+disconnected.length+' bâtiment'+(disconnected.length>1?'s':'')+' isolé'+(disconnected.length>1?'s':'')+' · Voir';
    let entity=game.buildings.find(b=>b.id===selectedId);
    const picked=game.units.filter(u=>selection.includes(u.id));
    if(!entity&&picked.length===1)entity=picked[0];
    const visible=!!entity||picked.length>1;
    card.classList.toggle('hidden',!visible||!!mode);
    if(!visible)return;
    if(entity){
      const isBuilding=game.buildings.includes(entity),tile=game.tile(entity.x,entity.y);
      document.getElementById('objectName').textContent=names[entity.type]+(isBuilding?' · niv. '+(entity.level||1):'');
      const bs=isBuilding&&game.getBuildingStats?.(entity);document.getElementById('objectRole').textContent=bs&&entity.type==='extractor'?'Produit +'+(bs.income||3.1).toFixed(1).replace('.',',')+' pigment/s si connecté':roles[entity.type];
      document.getElementById('objectState').textContent=Math.ceil(entity.hp)+'/'+entity.maxHp+' PV · '+(isBuilding?(entity.connected?'Connecté':'ISOLÉ'):tile?.owner===1&&tile.connected?'Terrain allié':'En exploration');
      document.getElementById('objectHealth').style.width=Math.max(0,entity.hp/entity.maxHp*100)+'%';
      card.classList.toggle('isolated',isBuilding&&!entity.connected);
    }else{
      document.getElementById('objectName').textContent=picked.length+' unités sélectionnées';
      document.getElementById('objectState').textContent='Groupe prêt';
      document.getElementById('objectRole').textContent='Appuyez sur « Donner un ordre », puis sur une destination.';
      const hp=picked.reduce((n,u)=>n+u.hp,0),max=picked.reduce((n,u)=>n+u.maxHp,0);
      document.getElementById('objectHealth').style.width=hp/max*100+'%';card.classList.remove('isolated');
    }
  }
  function draw(c,v){
    if(!game)return;const s=v.cell,W=game.width,H=game.height;
    c.save();c.beginPath();c.rect(Math.max(0,v.x),Math.max(0,v.y),Math.min(v.w,v.x+W*s)-Math.max(0,v.x),Math.min(v.h,v.y+H*s)-Math.max(0,v.y));c.clip();
    // Only revealed territory contributes borders; no information through fog.
    c.lineWidth=Math.min(2,s*.12);c.lineCap='square';
    for(const t of game.tiles){
      if(!t.owner||(!t.visible&&t.owner!==1)||t.blocked)continue;
      const x=v.x+t.x*s,y=v.y+t.y*s;if(x+s<0||y+s<0||x>v.w||y>v.h)continue;
      c.strokeStyle=t.owner===1?(t.connected?paletteColor('playerStrong','#259e8b'):'#b5863c'):paletteColor('enemyStrong','#d46652');
      c.beginPath();
      const edges=[[0,-1,x,y,x+s,y],[1,0,x+s,y,x+s,y+s],[0,1,x,y+s,x+s,y+s],[-1,0,x,y,x,y+s]];
      for(const [dx,dy,a,b,e,f]of edges){const n=game.tile(t.x+dx,t.y+dy);if(!n||n.owner!==t.owner||n.connected!==t.connected){c.moveTo(a,b);c.lineTo(e,f)}}c.stroke();
    }
    // Paths follow the actual navigation route instead of crossing obstacles.
    c.strokeStyle=paletteColor('selection','#155a72')+'b0';c.lineWidth=1.6;c.setLineDash([4,4]);
    for(const u of game.units.filter(u=>selection.includes(u.id)).slice(0,12)){
      if(!u.path.length)continue;c.beginPath();c.moveTo(v.x+u.x*s,v.y+u.y*s);
      for(const p of u.path)c.lineTo(v.x+p.x*s,v.y+p.y*s);c.stroke();
      const dest=u.path[u.path.length-1];c.beginPath();c.arc(v.x+dest.x*s,v.y+dest.y*s,5,0,Math.PI*2);c.stroke();
    }c.setLineDash([]);
    for(const b of game.buildings){
      if(b.team!==1&&!game.tile(b.x,b.y)?.visible)continue;
      const x=v.x+(b.x+.5)*s,y=v.y+(b.y+.5)*s;
      if(x<-60||y<-30||x>v.w+60||y>v.h+30)continue;
      if(b.id===selectedId){c.strokeStyle=paletteColor('selection','#174f67');c.lineWidth=2.5;c.beginPath();c.arc(x,y,s*1.35,0,Math.PI*2);c.stroke()}
      if(s>=13||b.id===selectedId){
        const label=names[b.type]+((b.level||1)>1?' '+b.level:'')+(!b.connected?' · ISOLÉ':'');c.font='600 11px system-ui';const tw=c.measureText(label).width;
        c.fillStyle=b.connected?'#fffef8eb':'#fff0dceb';c.beginPath();c.roundRect(x-tw/2-5,y+s+4,tw+10,17,4);c.fill();c.fillStyle=b.connected?'#204b58':'#885715';c.textAlign='center';c.fillText(label,x,y+s+16);
      }
      if(!b.connected){c.fillStyle='#ad701b';c.beginPath();c.arc(x+s*.7,y-s*.7,5,0,Math.PI*2);c.fill()}
    }
    c.restore();
  }
  window.CQUI={selectBuilding,clearBuilding(){selectedId=null},reset,update,draw,get selectedBuilding(){return selectedId}};
})();
