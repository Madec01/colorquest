'use strict';
const {chromium}=require('playwright');
const path=require('node:path');const {pathToFileURL}=require('node:url');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}),args:['--no-sandbox']});
 for(const size of [{width:390,height:844},{width:360,height:640}]){
  const p=await browser.newPage({viewport:size,isMobile:true,hasTouch:true});let errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
  await p.locator('#startTutorial').tap();
  const pump=async(n=120)=>p.evaluate(n=>{for(let i=0;i<n;i++){game.update(.05);CQTutorial.update(.05)}},n);
  const step=async n=>assert.equal(await p.evaluate(()=>CQTutorial.step),n);
  const tapTile=async(x,y)=>{const point=await p.evaluate(({x,y})=>{const r=canvas.getBoundingClientRect();return{x:r.x+view.x+(x+.5)*view.cell,y:r.y+view.y+(y+.5)*view.cell}},{x,y});await p.touchscreen.tap(point.x,point.y)};
  const move=async(type,x,y)=>{
    const u=await p.evaluate(type=>{const u=game.units.find(u=>u.team===1&&u.type===type);return{x:u.x-.5,y:u.y-.5}},type);
    await tapTile(u.x,u.y);assert.ok(await p.evaluate(()=>selection.length>0),'unit tap selects');
    await p.locator('#moveOrder').tap();await tapTile(x,y);
  };
  await step(0);await pump(30);await step(0);
  await move('scout',13,37);await pump();await step(1);
  await p.locator('[data-build="relay"]').tap();await tapTile(12,38);await pump();await step(2);
  await p.locator('[data-build="extractor"]').tap();await tapTile(9,36);await pump();await step(3);
  await p.locator('#unitButtons [data-recruit="fighter"]').tap();await pump(160);await step(4);
  await move('fighter',13,28);await pump(250);await step(5);
  await move('fighter',20,28);await pump(180);await step(6);
  await move('fighter',16,34);await pump(180);await step(7);
  assert.equal(await p.evaluate(()=>CQTutorial.active),false);assert.ok(await p.locator('#trainingPlay').isVisible());
  await p.locator('#trainingPlay').tap();assert.equal(await p.evaluate(()=>game.duration),720);assert.equal(await p.evaluate(()=>game.hasOwnProperty('_aiThink')),false);
  await p.evaluate(()=>CQTutorial.start());await p.locator('#trainingOptions').tap();await p.locator('#trainingRestart').tap();await step(0);
  await p.locator('#trainingOptions').tap();await p.locator('#trainingSkip').tap();assert.equal(await p.evaluate(()=>CQTutorial.active),true,'confirmation preserves the tutorial');await p.locator('#newGameCancel').tap();assert.equal(await p.evaluate(()=>CQTutorial.active),true,'cancel keeps the exercise playable');await p.locator('#trainingOptions').tap();await p.locator('#trainingSkip').tap();await p.locator('#newGameConfirm').tap();assert.equal(await p.evaluate(()=>CQTutorial.active),false);assert.equal(await p.evaluate(()=>game.duration),720);
  await p.locator('#cameraHome').tap();await p.locator('#selectAll').tap();await p.locator('#objectCard').waitFor({state:'visible'});
  // A real network cut produces an actionable alert and an isolated building card.
  await p.evaluate(()=>{game.units=[];game.buildings=game.buildings.filter(b=>b.type==='core');for(const t of game.tiles){if(t.owner===1)t.owner=0;}for(let y=30;y<=41;y++){const t=game.tile(16,y);t.owner=1;t.blocked=false;}game._building(1,'relay',16,30);game.recompute();CQUI.update(true);game.tile(16,35).owner=0;game.recompute();CQUI.update(true)});
  await p.locator('#networkAlert').tap();await p.locator('#objectCard').waitFor({state:'visible'});assert.match(await p.locator('#objectState').textContent(),/ISOLÉ/);
  assert.equal(await p.evaluate(()=>CQCamera.zoom),2.3);
  const overflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);assert.deepEqual(errors,[]);
  console.log(`PASS tutorial touch ${size.width}x${size.height}: all 7 steps, wait guards, restart, skip, normal AI restored, group details.`);await p.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
