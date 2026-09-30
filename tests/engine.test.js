'use strict';
const assert=require('node:assert/strict');
const {Game,WIDTH,HEIGHT,COSTS}=require('../engine.js');
function test(name,fn){fn();console.log('✓ '+name);}
function advance(g,seconds){for(let n=0;n<Math.ceil(seconds*10)&&g.winner===null;n++)g.update(.1);}
test('Portrait board, economy, denied builds do not spend pigment',()=>{
 const g=new Game({seed:1});assert.ok(HEIGHT>WIDTH);assert.equal(g.tiles.length,WIDTH*HEIGHT);
 const before=g.money[1];assert.equal(g.build(1,'relay',0,0).ok,false);assert.equal(g.money[1],before);
 assert.equal(g.build(1,'extractor',16,44).ok,false);assert.equal(g.money[1],before);
 assert.equal(g.build(1,'relay',16,45).ok,true);assert.equal(g.money[1],before-COSTS.relay);
 advance(g,1);assert.ok(g.money[1]>before-COSTS.relay);
});
test('Connected land disconnects at a cut and reconnects when repaired',()=>{
 const g=new Game();for(const t of g.tiles){t.owner=0;t.blocked=false;}
 for(let y=32;y<=41;y++)g.tile(16,y).owner=1;g.recompute();assert.equal(g.tile(16,32).connected,true);
 g.tile(16,36).owner=2;g.recompute();assert.equal(g.tile(16,32).connected,false);assert.equal(g.tile(16,40).connected,true);
 g.tile(16,36).owner=1;g.recompute();assert.equal(g.tile(16,32).connected,true);
});
test('Pathfinding avoids walls and unit orders reach the destination',()=>{
 const g=new Game();for(let y=34;y<=44;y++)g.tile(19,y).blocked=true;
 const path=g.findPath(17.5,40.5,21,40);assert.ok(path.length>4);assert.ok(path.every(p=>!g.tile(p.x,p.y).blocked));
 const u=g.units.find(u=>u.team===1&&u.type==='scout');assert.equal(g.order([u.id],21,40).ok,true);advance(g,12);assert.ok(Math.hypot(u.x-21.5,u.y-40.5)<.01);
 assert.equal(g.order([u.id],19,40).ok,false);
});
test('Recruitment and powers debit or recharge only on valid actions',()=>{
 const g=new Game();const money=g.money[1];assert.equal(g.recruit(1,'unknown').ok,false);assert.equal(g.money[1],money);
 assert.equal(g.recruit(1,'fighter').ok,true);assert.equal(g.money[1],money-COSTS.fighter);
 assert.equal(g.power(1,'impulse',0,0).ok,false);assert.equal(g.cooldowns[1].impulse,0);
 assert.equal(g.power(1,'impulse',16,41).ok,true);assert.equal(g.cooldowns[1].impulse,40);
 assert.equal(g.power(1,'impulse',16,41).ok,false);
});
test('AI expands, recruits, and an idle match completes with finite state',()=>{
 const g=new Game({seed:42,difficulty:'easy'});advance(g,60);
 assert.ok(g.buildings.filter(b=>b.team===2).length>1);assert.ok(g.units.filter(u=>u.team===2).length>3);
 advance(g,720);assert.notEqual(g.winner,null);assert.ok(g.time<=720.11);
 assert.ok(g.units.every(u=>Number.isFinite(u.x)&&Number.isFinite(u.y)&&Number.isFinite(u.hp)));
 assert.ok(g.money[2]>=0);
});
test('Domination timer resets below threshold and wins at 45 seconds',()=>{
 const g=new Game();g.scores[1]=.61;g.hold[1]=20;g.update(.1);assert.ok(g.hold[1]>20);
 g.scores[1]=.59;g.update(.1);assert.equal(g.hold[1],0);
 g.scores[1]=.61;g.hold[1]=44.95;g.update(.1);assert.equal(g.winner,1);
 const time=g.time;g.update(.1);assert.equal(g.time,time);
});
test('Time limit compares connected territory and supports draws',()=>{
 const g=new Game();g.time=719.95;g.scores[1]=.2;g.scores[2]=.3;g.update(.1);assert.equal(g.winner,2);assert.equal(g.winReason,'Temps écoulé');
 const draw=new Game();draw.time=719.95;draw.scores[1]=draw.scores[2]=.2;draw.update(.1);assert.equal(draw.winner,0);
});
test('Explicit retreat moves even while an enemy is in attack range',()=>{
 const g=new Game();g.units=g.units.filter(u=>u.type==='fighter').slice(0,2);const a=g.units[0],b=g.units[1];a.team=1;b.team=2;a.x=12.5;a.y=40.5;b.x=13.5;b.y=40.5;
 assert.equal(g.order([a.id],8,40).ok,true);g.update(.1);assert.ok(a.x<12.5);
});
console.log('All simulation checks passed.');
