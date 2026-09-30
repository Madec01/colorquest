/* Colorquest simulation. Vanilla JS, no renderer or browser dependency.
 * new CQEngine.Game({difficulty:'easy'|'normal',seed:number})
 * update(dtSeconds); build(team,type,tileX,tileY); recruit(team,type);
 * order(unitIds,tileX,tileY); power(team,'impulse'|'bleach',tileX,tileY).
 * Actions return {ok,message}; commands are ignored once winner is set.
 * Coordinates: units have continuous tile-center coordinates; buildings and tiles
 * have integer tile indices. teams 1=player,2=AI,0=neutral. winner: null|0(draw)|1|2.
 * events: bounded queue {type,text,x,y,time,team}; latest 80 retained.
 * scores[team] are fractions of all nonblocked tiles, counting connected land.
 */
(function(root){
'use strict';
const WIDTH=32,HEIGHT=48;
const COSTS={relay:45,extractor:65,bastion:90,scout:22,fighter:35,breaker:65};
const UNIT_STATS={scout:{hp:34,speed:4.1,damage:3,range:1.25,cooldown:.9,vision:7},fighter:{hp:85,speed:2.45,damage:11,range:1.55,cooldown:.8,vision:5},breaker:{hp:62,speed:1.75,damage:20,range:5.2,cooldown:1.65,vision:6}};
const BUILDING_STATS={core:{hp:950,radius:7},relay:{hp:170,radius:6},extractor:{hp:145,radius:2},bastion:{hp:250,radius:2}};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
class Game{
 constructor(options={}){
  this.width=WIDTH;this.height=HEIGHT;this.difficulty=options.difficulty||'normal';this.seed=(options.seed||123456)>>>0;
  this.time=0;this.duration=720;this.winner=null;this.winReason='';this.units=[];this.buildings=[];this.events=[];this.money=[0,165,165];this.income=[0,0,0];this.scores=[0,0,0];this.hold=[0,0,0];this.cooldowns=[{}, {impulse:0,bleach:0},{impulse:0,bleach:0}];this._id=1;this._nextExpand=this.difficulty==='easy'?28:18;this._tick=0;this._spread=0;this._ai=0;this._vision=0;this._capture=0;this._holdEvent=[false,false,false];
  this.tiles=Array.from({length:WIDTH*HEIGHT},(_,i)=>({x:i%WIDTH,y:Math.floor(i/WIDTH),owner:0,connected:false,explored:false,visible:false,blocked:false,source:false,isolation:0}));
  // Symmetrical broken ridges create lanes without sealing any region.
  for(let y=3;y<HEIGHT-3;y++)for(let x=0;x<WIDTH;x++){
   const ridge=(y===18||y===29)&&((x>=3&&x<=10)||(x>=21&&x<=28));
   if(ridge&&this.random()>.12)this.tile(x,y).blocked=true;
  }
  const sources=[[7,37],[24,37],[16,31],[7,24],[24,23],[16,16],[7,10],[24,10]];
  for(const [x,y]of sources){this.tile(x,y).source=true;this.tile(x,y).blocked=false;}
  for(let team=1;team<=2;team++){
   const x=16,y=team===1?41:6;this._building(team,'core',x,y);
   for(const t of this.tiles)if(!t.blocked&&Math.hypot(t.x-x,t.y-y)<=6)t.owner=team;
   this._unit(team,'scout',x+.5,y-1.5);this._unit(team,'fighter',x+ (team===1?2.5:-1.5),y+.5);this._unit(team,'fighter',x+.5,y+2.5);
  }
  this.recompute();this.updateVisibility();this.emit('info','Étendez votre réseau vers les sources de pigment.',16,41,1);
 }
 random(){let x=this.seed;x^=x<<13;x^=x>>>17;x^=x<<5;this.seed=x>>>0;return this.seed/4294967296;}
 tile(x,y){x=Math.floor(x);y=Math.floor(y);return x>=0&&y>=0&&x<WIDTH&&y<HEIGHT?this.tiles[y*WIDTH+x]:null;}
 emit(type,text,x,y,team){this.events.push({type,text,message:text,x,y,team,time:this.time});if(this.events.length>80)this.events.shift();}
 _building(team,type,x,y){const s=BUILDING_STATS[type],b={id:this._id++,team,type,x,y,hp:s.hp,maxHp:s.hp,connected:true,age:0,attack:0,boostUntil:0};this.buildings.push(b);return b;}
 _unit(team,type,x,y){const s=UNIT_STATS[type],u={id:this._id++,team,type,x,y,hp:s.hp,maxHp:s.hp,path:[],order:null,attack:0,lastHit:-20,retarget:0};this.units.push(u);return u;}
 build(team,type,x,y){
  if(this.winner!==null)return {ok:false,message:'La partie est terminée.'};
  x=Math.floor(x);y=Math.floor(y);const t=this.tile(x,y),cost=COSTS[type];
  if(!BUILDING_STATS[type]||type==='core')return {ok:false,message:'Bâtiment inconnu.'};
  if(!t||t.blocked)return {ok:false,message:'Terrain inaccessible.'};
  if(t.owner!==team||!t.connected)return {ok:false,message:'Construisez sur votre territoire connecté.'};
  if(this.buildings.some(b=>Math.hypot(b.x-x,b.y-y)<2.1))return {ok:false,message:'Trop proche d’un autre bâtiment.'};
  if(type==='extractor'&&!t.source)return {ok:false,message:'Placez l’extracteur sur une source de pigment.'};
  if(type!=='extractor'&&t.source)return {ok:false,message:'Réservez cette source à un extracteur.'};
  if(this.money[team]<cost)return {ok:false,message:'Pigment insuffisant.'};
  this.money[team]-=cost;this._building(team,type,x,y);this.emit('build','Construction terminée',x,y,team);this.recompute();return {ok:true,message:'Construction terminée.'};
 }
 recruit(team,type){
  if(this.winner!==null)return {ok:false,message:'La partie est terminée.'};
  const core=this.buildings.find(b=>b.team===team&&b.type==='core');
  if(!UNIT_STATS[type]||!core)return {ok:false,message:'Recrutement impossible.'};
  if(this.units.filter(u=>u.team===team).length>=36)return {ok:false,message:'Limite de 36 unités atteinte.'};
  if(this.money[team]<COSTS[type])return {ok:false,message:'Pigment insuffisant.'};
  this.money[team]-=COSTS[type];let x=core.x+.5+(this.random()-.5)*2,y=core.y+.5+(this.random()-.5)*2;
  if(this.tile(x,y)?.blocked){x=core.x+.5;y=core.y+.5;}
  const u=this._unit(team,type,x,y);this.emit('recruit','Unité prête',x,y,team);return {ok:true,message:'Unité prête.',id:u.id};
 }
 order(ids,x,y){
  if(this.winner!==null)return {ok:false,message:'La partie est terminée.'};
  const t=this.tile(x,y);if(!t||t.blocked)return {ok:false,message:'Destination inaccessible.'};
  let count=0;const selected=this.units.filter(u=>ids.includes(u.id));
  for(const u of selected){let dest=t;
   if(selected.length>1){const angle=count*2.399963,radius=Math.min(3.5,Math.sqrt(count)*.7),candidate=this.tile(t.x+Math.round(Math.cos(angle)*radius),t.y+Math.round(Math.sin(angle)*radius));if(candidate&&!candidate.blocked)dest=candidate;}
   u.path=this.findPath(u.x,u.y,dest.x,dest.y);u.order={x:dest.x+.5,y:dest.y+.5};count++;}

  return {ok:count>0,message:count?'Ordre donné.':'Sélectionnez des unités.'};
 }
 power(team,type,x,y){
  if(this.winner!==null)return {ok:false,message:'La partie est terminée.'};
  if(!['impulse','bleach'].includes(type))return {ok:false,message:'Pouvoir inconnu.'};
  if(this.cooldowns[team][type]>0)return {ok:false,message:'Pouvoir en recharge.'};
  const t=this.tile(x,y);if(!t)return {ok:false,message:'Choisissez une zone.'};
  if(team===1&&!t.visible)return {ok:false,message:'Cette zone doit être visible.'};
  if(type==='impulse'){
   const b=this.buildings.filter(b=>b.team===team&&b.connected&&['relay','core'].includes(b.type)).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];
   if(!b||Math.hypot(b.x-x,b.y-y)>7)return {ok:false,message:'Visez un relais ou votre Cœur connecté.'};
   b.boostUntil=this.time+12;this.cooldowns[team][type]=40;this.emit('impulse','Impulsion de croissance',b.x,b.y,team);
  }else{
   for(const tile of this.tiles)if(tile.owner===3-team&&Math.hypot(tile.x-x,tile.y-y)<=4)tile.weakenedUntil=this.time+14;
   for(const b of this.buildings)if(b.team===3-team&&Math.hypot(b.x-x,b.y-y)<4)b.hp-=25;
   this.cooldowns[team][type]=50;this.emit('bleach','Décoloration',x,y,team);
  }
  return {ok:true,message:type==='impulse'?'Croissance accélérée !':'Défenses territoriales affaiblies !'};
 }
 findPath(sx,sy,tx,ty){
  const start=this.tile(sx,sy),goal=this.tile(tx,ty);if(!start||!goal||goal.blocked)return[];
  const si=start.y*WIDTH+start.x,gi=goal.y*WIDTH+goal.x;if(si===gi)return[];
  const prev=new Int32Array(WIDTH*HEIGHT);prev.fill(-1);prev[si]=si;const q=new Int32Array(WIDTH*HEIGHT);q[0]=si;let head=0,tail=1;
  while(head<tail){const i=q[head++];if(i===gi)break;const x=i%WIDTH,y=Math.floor(i/WIDTH);for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=WIDTH||ny>=HEIGHT)continue;const n=ny*WIDTH+nx;if(prev[n]!==-1||this.tiles[n].blocked)continue;prev[n]=i;q[tail++]=n;}}
  if(prev[gi]===-1)return[];const path=[];for(let i=gi;i!==si;i=prev[i])path.push({x:i%WIDTH+.5,y:Math.floor(i/WIDTH)+.5});return path.reverse();
 }
 recompute(){
  for(const t of this.tiles)t.connected=false;
  for(let team=1;team<=2;team++){
   const core=this.buildings.find(b=>b.team===team&&b.type==='core'&&b.hp>0);if(!core)continue;
   const t=this.tile(core.x,core.y);t.owner=team;t.connected=true;const q=[t];let head=0;
   while(head<q.length){const a=q[head++];for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const n=this.tile(a.x+dx,a.y+dy);if(n&&!n.blocked&&n.owner===team&&!n.connected){n.connected=true;q.push(n);}}}
  }
  const counts=[0,0,0];let available=0;for(const t of this.tiles){if(!t.blocked)available++;if(t.connected)counts[t.owner]++;}
  for(let team=1;team<=2;team++)this.scores[team]=counts[team]/available;
  for(const b of this.buildings){const t=this.tile(b.x,b.y);b.connected=t.owner===b.team&&t.connected;}
 }
 updateVisibility(){
  for(const t of this.tiles)t.visible=false;
  const reveal=(x,y,r)=>{for(let yy=Math.max(0,Math.floor(y-r));yy<=Math.min(HEIGHT-1,Math.ceil(y+r));yy++)for(let xx=Math.max(0,Math.floor(x-r));xx<=Math.min(WIDTH-1,Math.ceil(x+r));xx++){const t=this.tile(xx,yy);if(Math.hypot(xx+.5-x,yy+.5-y)<=r){t.visible=true;t.explored=true;}}};
  for(const t of this.tiles)if(t.owner===1&&t.connected){t.visible=true;t.explored=true;}
  for(const b of this.buildings)if(b.team===1)reveal(b.x+.5,b.y+.5,b.type==='core'?9:7);
  for(const u of this.units)if(u.team===1)reveal(u.x,u.y,UNIT_STATS[u.type].vision);
 }
 _spreadTerritory(){
  const claims=[];
  for(const b of this.buildings){if(!b.connected)continue;const boost=b.boostUntil>this.time,r=BUILDING_STATS[b.type].radius+(boost?2:0);for(let y=b.y-r;y<=b.y+r;y++)for(let x=b.x-r;x<=b.x+r;x++){
   const t=this.tile(x,y);if(!t||t.blocked||t.owner||Math.hypot(x-b.x,y-b.y)>r)continue;
   if([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>{const a=this.tile(x+dx,y+dy);return a?.owner===b.team&&a.connected;}))claims.push([t,b.team]);
  }}
  // Alternate claim order to avoid a systematic player advantage.
  if(Math.floor(this.time)%2)claims.reverse();for(const [t,team]of claims)if(!t.owner)t.owner=team;
  for(const t of this.tiles)if(t.owner&&!t.connected){t.isolation++;if(t.isolation>=15&&!this.buildings.some(b=>b.x===t.x&&b.y===t.y&&b.type==='core')){t.owner=0;t.isolation=0;}}else t.isolation=0;
  this.recompute();
 }
 _captureTerritory(){
  for(const u of this.units){const radius=u.type==='fighter'?1.8:u.type==='breaker'?1.15:1.05;
   for(let y=Math.floor(u.y-radius);y<=Math.floor(u.y+radius);y++)for(let x=Math.floor(u.x-radius);x<=Math.floor(u.x+radius);x++){
    const t=this.tile(x,y);if(!t||t.blocked||t.owner===u.team||Math.hypot(x+.5-u.x,y+.5-u.y)>radius)continue;
    if(this.units.some(v=>v.team!==u.team&&Math.hypot(v.x-x-.5,v.y-y-.5)<2.2))continue;
    if(this.buildings.some(b=>b.team!==u.team&&Math.hypot(b.x-x,b.y-y)<(t.weakenedUntil>this.time?1:2.5)))continue;
    if(u.type==='scout'&&t.owner!==0)continue;
    t.owner=u.team;t.isolation=0;
   }
  }
  this.recompute();
 }
 _aiThink(){
  const team=2,foe=1,core=this.buildings.find(b=>b.team===team&&b.type==='core');if(!core)return;
  const connected=this.tiles.filter(t=>t.owner===team&&t.connected&&!t.blocked);
  for(const t of connected)if(t.source&&!this.buildings.some(b=>Math.hypot(b.x-t.x,b.y-t.y)<2.1)&&this.money[team]>=65){this.build(team,'extractor',t.x,t.y);break;}
  if(this.money[team]>=45&&this.time>=this._nextExpand){
   const candidates=connected.filter(t=>!t.source&&!this.buildings.some(b=>Math.hypot(b.x-t.x,b.y-t.y)<4.2));
   let best=null,bestScore=-1;
   for(const t of candidates){let gain=0;for(let dy=-6;dy<=6;dy+=2)for(let dx=-6;dx<=6;dx+=2){const n=this.tile(t.x+dx,t.y+dy);if(n&&!n.blocked&&!n.owner&&dx*dx+dy*dy<=36)gain++;}const score=gain+t.y*.055+this.random()*2;if(gain>4&&score>bestScore){best=t;bestScore=score;}}
   if(best){this.build(team,'relay',best.x,best.y);this._nextExpand=this.time+(this.difficulty==='easy'?20:13);}
  }
  const army=this.units.filter(u=>u.team===team),targetCount=this.difficulty==='easy'?10:18;
  if(army.length<targetCount&&this.money[team]>=35)this.recruit(team,army.filter(u=>u.type==='breaker').length<Math.floor(army.length/5)?'breaker':'fighter');
  const threats=this.units.filter(u=>u.team===foe&&this.tile(u.x,u.y)?.owner===team);
  let goal=null;
  if(threats.length)goal=threats.sort((a,b)=>dist(a,core)-dist(b,core))[0];
  else if(this.time>(this.difficulty==='easy'?105:65)&&army.length>=5){
   // Target exposed enemy relays instead of blindly streaming into the core.
   goal=this.buildings.filter(b=>b.team===foe&&(b.type!=='core'||this.time>(this.difficulty==='easy'?240:180))).sort((a,b)=>dist(a,core)-dist(b,core))[0];
  }
  if(goal){const ids=army.filter(u=>u.type!=='scout').map(u=>u.id);this.order(ids,goal.x,goal.y);}
  else{
   const frontier=this.buildings.filter(b=>b.team===team&&b.connected&&b.type==='relay').sort((a,b)=>b.y-a.y)[0];
   if(frontier)for(const u of army)if(u.type!=='scout'&&u.path.length===0&&dist(u,frontier)>4)this.order([u.id],frontier.x,frontier.y);
  }
  for(const u of army.filter(u=>u.type==='scout'&&u.path.length===0)){
   const sources=this.tiles.filter(t=>t.source&&t.owner!==team);if(sources.length){sources.sort((a,b)=>dist(u,a)-dist(u,b));this.order([u.id],sources[0].x,sources[0].y);}
  }
  if(goal&&this.difficulty!=='easy'&&this.cooldowns[team].bleach<=0)this.power(team,'bleach',goal.x,goal.y);
 }
 update(dt){
  if(this.winner!==null)return;dt=Math.min(Math.max(Number(dt)||0,0),.1);this.time+=dt;
  for(let team=1;team<=2;team++){
   this.income[team]=2.6+this.buildings.filter(b=>b.team===team&&b.type==='extractor'&&b.connected).length*3.1;this.money[team]+=this.income[team]*dt;
   for(const key of ['impulse','bleach'])this.cooldowns[team][key]=Math.max(0,this.cooldowns[team][key]-dt);
  }
  for(const b of this.buildings){b.age+=dt;b.attack=Math.max(0,b.attack-dt);if(b.connected&&(b.type==='bastion'||b.type==='core')){
   const range=b.type==='core'?5:6.5,target=this.units.filter(u=>u.team!==b.team&&u.hp>0&&Math.hypot(u.x-b.x-.5,u.y-b.y-.5)<range).sort((a,c)=>dist(a,b)-dist(c,b))[0];
   if(target&&b.attack<=0){target.hp-=b.type==='core'?14:14;target.lastHit=this.time;b.attack=.8;this.emit('shot','',b.x+.5,b.y+.5,b.team);this.events[this.events.length-1].target={x:target.x,y:target.y};}
  }}
  for(const u of this.units){if(u.hp<=0)continue;const s=UNIT_STATS[u.type];u.attack=Math.max(0,u.attack-dt);
   let target=this.units.filter(v=>v.team!==u.team&&v.hp>0&&dist(u,v)<=s.range).sort((a,b)=>dist(u,a)-dist(u,b))[0],isBuilding=false;
   if(!target){target=this.buildings.filter(b=>b.team!==u.team&&b.hp>0&&Math.hypot(u.x-b.x-.5,u.y-b.y-.5)<=s.range+.5).sort((a,b)=>dist(u,a)-dist(u,b))[0];isBuilding=!!target;}
   if(target){if(u.attack<=0){target.hp-=s.damage*(isBuilding&&u.type==='breaker'?2.5:1);target.lastHit=this.time;u.attack=s.cooldown;this.emit('shot','',u.x,u.y,u.team);this.events[this.events.length-1].target={x:target.x+(isBuilding?.5:0),y:target.y+(isBuilding?.5:0)};}}
   if(u.path.length){let remaining=s.speed*dt;while(remaining>0&&u.path.length){const p=u.path[0],d=dist(u,p);if(d<=remaining){u.x=p.x;u.y=p.y;u.path.shift();remaining-=d;}else{u.x+=(p.x-u.x)/d*remaining;u.y+=(p.y-u.y)/d*remaining;remaining=0;}}}
   else if(!target){ // Short automatic engagement; explicit movement still takes precedence.
    u.retarget-=dt;if(u.retarget<=0){u.retarget=1.3;const enemy=this.units.find(v=>v.team!==u.team&&v.hp>0&&dist(u,v)<4.5);if(enemy&&u.type!=='scout')u.path=this.findPath(u.x,u.y,enemy.x,enemy.y);}
   }
   const tile=this.tile(u.x,u.y);if(tile?.owner===u.team&&tile.connected&&this.time-u.lastHit>5)u.hp=Math.min(u.maxHp,u.hp+4*dt);
  }
  // Soft separation keeps armies legible on a small portrait canvas.
  for(let i=0;i<this.units.length;i++)for(let j=i+1;j<this.units.length;j++){
   const a=this.units[i],b=this.units[j];let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d>=.56)continue;
   if(d<.001){dx=Math.cos(a.id)*.01;dy=Math.sin(a.id)*.01;d=.01;}
   const push=Math.min((.56-d)*.5,dt*.85),px=dx/d*push,py=dy/d*push;
   const ta=this.tile(a.x-px,a.y-py),tb=this.tile(b.x+px,b.y+py);
   if(ta&&!ta.blocked){a.x-=px;a.y-=py;}if(tb&&!tb.blocked){b.x+=px;b.y+=py;}
  }
  for(const b of this.buildings.filter(b=>b.hp<=0)){this.emit('destroy','Bâtiment détruit',b.x,b.y,b.team);if(b.type==='core'){this.winner=3-b.team;this.winReason='Cœur adverse détruit';}}
  for(const u of this.units.filter(u=>u.hp<=0))this.emit('death','',u.x,u.y,u.team);
  this.units=this.units.filter(u=>u.hp>0);this.buildings=this.buildings.filter(b=>b.hp>0);
  this._spread+=dt;this._capture+=dt;this._vision+=dt;this._ai+=dt;
  if(this._spread>=1){this._spread-=1;this._spreadTerritory();}
  if(this._capture>=.7){this._capture-=.7;this._captureTerritory();}
  if(this._vision>=.3){this._vision=0;this.updateVisibility();}
  if(this._ai>=(this.difficulty==='easy'?5:3.3)){this._ai=0;this._aiThink();}
  for(let team=1;team<=2;team++){
   this.hold[team]=this.scores[team]>=.6?this.hold[team]+dt:0;
   if(this.hold[team]>0&&!this._holdEvent[team]){this._holdEvent[team]=true;this.emit('domination','60 % atteints : tenez 45 secondes !',0,0,team);}if(!this.hold[team])this._holdEvent[team]=false;
   if(this.hold[team]>=45){this.winner=team;this.winReason='Domination territoriale';}
  }
  if(this.time>=this.duration&&this.winner===null){this.winner=Math.abs(this.scores[1]-this.scores[2])<.0001?0:this.scores[1]>this.scores[2]?1:2;this.winReason='Temps écoulé';}
 }
}
const api={Game,COSTS,UNIT_STATS,BUILDING_STATS,WIDTH,HEIGHT};root.CQEngine=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
