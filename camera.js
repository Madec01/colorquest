'use strict';
/* Camera and touch gestures. Map taps never issue implicit orders. */
(() => {
  const pointers = new Map();
  const state = { zoom: 1, cx: 16, cy: 24, w: 1, h: 1, W: 32, H: 48, base: 1, mini: true };
  let gesture = null, pinch = null, miniTime = -1;
  const wrap = document.getElementById('canvasWrap');
  const toolbar = document.createElement('div');
  toolbar.className = 'camera-tools';
  toolbar.setAttribute('aria-label', 'Navigation de la carte');
  toolbar.innerHTML = '<button id="cameraZoomIn" title="Zoomer" aria-label="Zoomer">+</button><button id="cameraZoomOut" title="Dézoomer" aria-label="Dézoomer">−</button><button id="cameraHome" title="Mon Cœur" aria-label="Centrer sur mon Cœur"><span>⌂</span><small>Cœur</small></button><button id="cameraOverview" title="Vue globale" aria-label="Voir toute la carte"><span>▣</span><small>Vue</small></button>';
  const mini = document.createElement('div');
  mini.className = 'camera-minimap';
  mini.innerHTML = '<button id="cameraMiniToggle" aria-expanded="true" aria-controls="cameraMiniCanvas">MINICARTE ▾</button><canvas id="cameraMiniCanvas" width="96" height="144" aria-label="Minicarte : toucher pour déplacer la vue"></canvas>';
  wrap.append(toolbar, mini);
  const miniCanvas = document.getElementById('cameraMiniCanvas'), mc = miniCanvas.getContext('2d');
  // A closed minimap leaves more room for the playfield on phones.
  state.mini=window.innerWidth>760;miniCanvas.hidden=!state.mini;
  document.getElementById('cameraMiniToggle').setAttribute('aria-expanded',String(state.mini));
  document.getElementById('cameraMiniToggle').textContent='MINICARTE '+(state.mini?'▾':'▸');
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const active = () => playing && game && !ended && !window.CQStrategy?.isOpen && document.getElementById('modal').classList.contains('hidden');
  function layout() {
    const cell = state.base * state.zoom;
    const halfW = state.w / (2 * cell), halfH = state.h / (2 * cell);
    state.cx = halfW >= state.W / 2 ? state.W / 2 : clamp(state.cx, halfW, state.W - halfW);
    state.cy = halfH >= state.H / 2 ? state.H / 2 : clamp(state.cy, halfH, state.H - halfH);
    return { w: state.w, h: state.h, cell, x: state.w / 2 - state.cx * cell, y: state.h / 2 - state.cy * cell };
  }
  function apply() { view = layout(); miniTime = -1; }
  function resizeCamera(w, h, W, H) {
    state.w = Math.max(1, w); state.h = Math.max(1, h); state.W = W; state.H = H;
    state.base = Math.max(.1, Math.min((state.w - 14) / W, (state.h - 14) / H));
    return layout();
  }
  function focus(x, y, zoom) {
    if (zoom !== undefined) state.zoom = clamp(zoom, 1, 4);
    state.cx = x; state.cy = y; apply();
  }
  function home() {
    const core = game?.buildings.find(b => b.team === 1 && b.type === 'core' && b.hp > 0);
    if (core) focus(core.x + .5, core.y + .5, Math.max(1.7, state.zoom));
  }
  function clearGesture() { pointers.clear(); gesture = null; pinch = null; drag = null; }
  function reset() { clearGesture(); state.zoom = 1.7; home(); apply(); }
  function zoomAt(zoom, p = { x: state.w / 2, y: state.h / 2 }) {
    const world = gridPos(p); state.zoom = clamp(zoom, 1, 4);
    const s = state.base * state.zoom;
    state.cx = world.x - (p.x - state.w / 2) / s;
    state.cy = world.y - (p.y - state.h / 2) / s; apply();
    window.CQTutorial?.action('zoom', { zoom: state.zoom });
  }
  document.getElementById('cameraZoomIn').onclick = () => zoomAt(state.zoom * 1.3);
  document.getElementById('cameraZoomOut').onclick = () => zoomAt(state.zoom / 1.3);
  document.getElementById('cameraHome').onclick = home;
  document.getElementById('cameraOverview').onclick = () => focus(state.W / 2, state.H / 2, 1);
  document.getElementById('cameraMiniToggle').onclick = () => {
    state.mini = !state.mini; miniCanvas.hidden = !state.mini;
    document.getElementById('cameraMiniToggle').setAttribute('aria-expanded', String(state.mini));
    document.getElementById('cameraMiniToggle').textContent = 'MINICARTE ' + (state.mini ? '▾' : '▸');
  };
  miniCanvas.addEventListener('pointerdown', e => {
    if (!active()) return; e.preventDefault();
    const r = miniCanvas.getBoundingClientRect();
    focus((e.clientX-r.left)/r.width*state.W, (e.clientY-r.top)/r.height*state.H);
  });
  function beginPinch() {
    const [a,b] = [...pointers.values()];
    const mid = { x:(a.x+b.x)/2, y:(a.y+b.y)/2 };
    pinch = { distance: Math.max(1, Math.hypot(a.x-b.x,a.y-b.y)), zoom:state.zoom, anchor:gridPos(mid) };
    if (gesture) gesture.moved = true; drag = null;
  }
  canvas.addEventListener('pointerdown', e => {
    if (!active() || e.button !== 0) return;
    e.preventDefault(); canvas.setPointerCapture(e.pointerId);
    const p=screenPos(e); pointers.set(e.pointerId,p);
    if (pointers.size===1) {
      gesture={id:e.pointerId,start:p,last:p,moved:false,box:e.pointerType!=='touch'&&e.shiftKey,shift:e.shiftKey};
      hover=gridPos(p);
    } else if (pointers.size===2) beginPinch();
  });
  canvas.addEventListener('pointermove', e => {
    const p=screenPos(e); hover=gridPos(p);
    if (!pointers.has(e.pointerId)) return;
    if (!active()) { clearGesture(); return; }
    pointers.set(e.pointerId,p);
    if (pointers.size>=2) {
      const [a,b]=[...pointers.values()];
      if (!pinch) beginPinch();
      const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
      state.zoom=clamp(pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/pinch.distance,1,4);
      const s=state.base*state.zoom;
      state.cx=pinch.anchor.x-(mid.x-state.w/2)/s; state.cy=pinch.anchor.y-(mid.y-state.h/2)/s; apply();
      window.CQTutorial?.action('zoom',{zoom:state.zoom}); return;
    }
    if (!gesture) return;
    const crossed=Math.hypot(p.x-gesture.start.x,p.y-gesture.start.y)>8;
    const wasMoved=gesture.moved;
    if (crossed) gesture.moved=true;
    if (gesture.moved) {
      if (gesture.box) drag={start:gesture.start,last:p,touch:false};
      else {
        const previous=wasMoved?gesture.last:gesture.start;
        state.cx-=(p.x-previous.x)/view.cell; state.cy-=(p.y-previous.y)/view.cell; apply();
      }
    }
    gesture.last=p;
  });
  canvas.addEventListener('pointerup', e => {
    if (!pointers.has(e.pointerId)) return;
    const p=screenPos(e), g=gesture, wasPinch=!!pinch;
    pointers.delete(e.pointerId);
    if (wasPinch || pointers.size) {
      pinch=null; drag=null;
      const remaining=[...pointers.entries()][0];
      gesture=remaining?{id:remaining[0],start:remaining[1],last:remaining[1],moved:true,box:false}:null;
      return;
    }
    gesture=null; drag=null;
    if (!g || !active() || paused) return;
    if (g.moved || Math.hypot(p.x-g.start.x,p.y-g.start.y)>8) {
      if (g.box && !mode) {
        const a=gridPos(g.start),b=gridPos(p);
        selection=game.units.filter(u=>u.team===1&&u.hp>0&&u.x>=Math.min(a.x,b.x)&&u.x<=Math.max(a.x,b.x)&&u.y>=Math.min(a.y,b.y)&&u.y<=Math.max(a.y,b.y)).map(u=>u.id);
        window.CQUI?.clearBuilding(); audio('select_001');
        window.CQTutorial?.action('select',{unitIds:[...selection]});
      }
      return;
    }
    tap(gridPos(p),g.shift);
  });
  function tap(p,shift) {
    const t=tileAt(p.x,p.y); if (!t) return;
    if (mode?.kind==='build') {
      const type=mode.type; let bx=Math.floor(p.x),by=Math.floor(p.y);
      if (type==='extractor') {
        const near=game.tiles.filter(t=>t.source&&t.explored&&t.owner===1&&t.connected).map(t=>({t,d:Math.hypot(t.x+.5-p.x,t.y+.5-p.y)})).sort((a,b)=>a.d-b.d)[0];
        if (near && near.d<Math.max(1.25,22/view.cell)) { bx=near.t.x; by=near.t.y; }
      }
      const result=game.build(1,type,bx,by);
      if(result?.ok===false){toast(result.message||'Impossible de construire ici.');audio('error_001');}
      else { audio('drop_001');toast('Construction lancée : '+buildings[type].name);setMode(null);window.CQTutorial?.action('build',{type,x:bx,y:by}); }
      return;
    }
    if (mode?.kind==='power') {
      const type=mode.type,r=game.power(1,type,Math.floor(p.x),Math.floor(p.y));
      toast(r?.message||(r?.ok===false?'Pouvoir indisponible.':'Pouvoir activé'));audio(r?.ok===false?'error_001':'glass_001');
      if(r?.ok!==false){setMode(null);window.CQTutorial?.action('power',{type,x:p.x,y:p.y});} return;
    }
    if (mode?.kind==='rally') {
      const result=game.setRally(1,p.x,p.y);
      toast(result.message);audio(result.ok?'confirmation_001':'error_001');
      if(result.ok){moveMarker={x:p.x,y:p.y,life:1};setMode(null)}return;
    }
    if (mode?.kind==='attack') {
      const result=game.command(1,selection,'attack',p.x,p.y);
      toast(result.message);audio(result.ok?'confirmation_001':'error_001');
      if(result.ok){moveMarker={x:p.x,y:p.y,life:1};setMode(null)}return;
    }
    if (mode?.kind==='move') {
      if(!selection.length){toast('Sélectionnez une unité avant de donner un ordre.');setMode(null);return;}
      const result=game.order(selection,p.x,p.y);
      if(result?.ok===false){toast(result.message||'Destination inaccessible.');audio('error_001');return;}
      audio('click_001');moveMarker={x:p.x,y:p.y,life:1};
      window.CQTutorial?.action('move',{unitIds:[...selection],x:p.x,y:p.y});setMode(null);return;
    }
    const radius=Math.max(1,22/view.cell);
    const nearestUnit=game.units.filter(u=>u.team===1&&u.hp>0).map(u=>({u,d:Math.hypot(u.x-p.x,u.y-p.y)})).sort((a,b)=>a.d-b.d)[0];
    const nearestBuilding=game.buildings.filter(b=>b.team===1&&b.hp>0).map(b=>({b,d:Math.hypot(b.x+.5-p.x,b.y+.5-p.y)})).sort((a,b)=>a.d-b.d)[0];
    // A tap at a building's centre takes precedence; nearby units remain selectable.
    if(nearestBuilding?.d<radius && (!nearestUnit || nearestBuilding.d<nearestUnit.d*.85)) {
      selection=[];window.CQUI?.selectBuilding(nearestBuilding.b);audio('select_001');
      window.CQTutorial?.action('selectBuilding',{type:nearestBuilding.b.type,id:nearestBuilding.b.id});return;
    }
    if(nearestUnit?.d<radius){
      selection=shift?[...new Set([...selection,nearestUnit.u.id])]:[nearestUnit.u.id];
      window.CQUI?.clearBuilding();audio('select_001');
      window.CQTutorial?.action('select',{unitIds:[...selection]});return;
    }
    if(nearestBuilding?.d<radius){selection=[];window.CQUI?.selectBuilding(nearestBuilding.b);return;}
    if(selection.length)toast('Pour déplacer vos unités, touchez « Donner un ordre ».');
    else {window.CQUI?.clearBuilding();toast('Touchez une unité ou un bâtiment. Glissez pour explorer la carte.');}
  }
  canvas.addEventListener('pointercancel',clearGesture);
  canvas.addEventListener('lostpointercapture',e=>{if(pointers.has(e.pointerId))clearGesture();});
  canvas.addEventListener('pointerleave',()=>{hover=null;});
  canvas.addEventListener('contextmenu',e=>{e.preventDefault();if(active()&&!paused&&selection.length){setMode({kind:'move'});tap(gridPos(screenPos(e)),false);}});
  canvas.addEventListener('wheel',e=>{if(!active())return;e.preventDefault();zoomAt(state.zoom*Math.exp(-e.deltaY*.0015),screenPos(e));},{passive:false});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clearGesture();});
  function update() {
    mini.hidden=state.zoom<=1.03;
    document.getElementById('cameraZoomOut').disabled=state.zoom<=1.001;
    document.getElementById('cameraZoomIn').disabled=state.zoom>=3.999;
    if(!game||mini.hidden||!state.mini)return;
    const stamp=Math.floor(performance.now()/120);if(stamp===miniTime)return;miniTime=stamp;
    const sx=miniCanvas.width/state.W,sy=miniCanvas.height/state.H;
    mc.fillStyle='#eff1e9';mc.fillRect(0,0,miniCanvas.width,miniCanvas.height);
    for(const t of game.tiles){
      if(!t.explored&&t.owner!==1)continue;
      mc.fillStyle=t.blocked?'#bdc7bf':t.owner===1?(t.connected?'#51c4bd':'#bdcdc2'):t.owner===2?'#efab95':'#fffdf6';
      mc.fillRect(t.x*sx,t.y*sy,sx+.4,sy+.4);
      if(t.source){mc.fillStyle='#a68534';mc.fillRect(t.x*sx,t.y*sy,Math.max(2,sx),Math.max(2,sy));}
    }
    for(const b of game.buildings){if(b.hp<=0||(b.team!==1&&!tileAt(b.x,b.y)?.visible))continue;mc.fillStyle=b.team===1?'#087d85':'#b64937';mc.fillRect((b.x+.5)*sx-1.5,(b.y+.5)*sy-1.5,3,3);}
    const x=clamp(-view.x/view.cell,0,state.W),y=clamp(-view.y/view.cell,0,state.H);
    const right=clamp((view.w-view.x)/view.cell,0,state.W),bottom=clamp((view.h-view.y)/view.cell,0,state.H);
    mc.strokeStyle='#173e4d';mc.lineWidth=1.5;mc.strokeRect(x*sx+.75,y*sy+.75,Math.max(1,(right-x)*sx-1.5),Math.max(1,(bottom-y)*sy-1.5));
  }
  window.CQCamera={resize:resizeCamera,reset,focus,update,zoomAt,get zoom(){return state.zoom;}};
  resize();
})();
