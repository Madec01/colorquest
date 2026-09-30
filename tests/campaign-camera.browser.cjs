/* Mobile campaign placement must stay read-only until explicit confirmation. */
'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox']});
 try {
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
  await page.locator('#campaignOpen').tap();
  await page.locator('[data-campaign-mission="first-ink"]').tap();
  await page.waitForFunction(()=>playing&&game?.mission?.id==='first-ink');
  assert.equal(await page.evaluate(()=>CQCamera.zoom),1);
  assert(await page.evaluate(()=>{
   const a=CQMissions.bounds(game.mission.id),epsilon=.1;
   return view.x+a.x*view.cell>=-epsilon&&view.y+a.y*view.cell>=-epsilon&&view.x+(a.x+a.width)*view.cell<=view.w+epsilon&&view.y+(a.y+a.height)*view.cell<=view.h+epsilon;
  }),'overview fits the small arena');
  // Freeze only the simulation for exact economy comparisons during gestures.
  await page.evaluate(()=>{game.update=()=>{};CQCamera.focus(16.5,35.5,2.3);window.__builds=0;const original=game.build.bind(game);game.build=(...args)=>{__builds++;return original(...args);};});
  const baseline=await page.evaluate(()=>JSON.stringify(CQSnapshot.capture(game)));
  await page.locator('[data-build="relay"]').tap();
  const rect=await page.locator('#map').boundingBox();
  const cdp=await page.context().newCDPSession(page);
  const point=(x,y,id=1)=>({x:rect.x+x,y:rect.y+y,id});
  const touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
  const x=rect.width*.38,y=rect.height*.44;
  await touch('touchStart',[point(x,y)]);await touch('touchMove',[point(x+30,y+55)]);await touch('touchEnd',[]);
  assert.equal(await page.evaluate(()=>CQCamera.placement),null,'pan creates no placement');
  await touch('touchStart',[point(x-25,y,1),point(x+25,y,2)]);
  await touch('touchMove',[point(x-50,y-5,1),point(x+50,y+5,2)]);
  await touch('touchEnd',[point(x-50,y-5,1)]);await touch('touchMove',[point(x-40,y+5,1)]);await touch('touchEnd',[]);
  assert.equal(await page.evaluate(()=>CQCamera.placement),null,'pinch transition creates no placement');
  assert.equal(await page.evaluate(()=>__builds),0);
  assert.equal(await page.evaluate(()=>JSON.stringify(CQSnapshot.capture(game))),baseline,'preview/navigation never alters simulation');
  async function choose(x,y){
   const p=await page.evaluate(({x,y})=>{CQCamera.focus(x+.5,y+.5,2.3);const r=canvas.getBoundingClientRect();return{x:r.x+view.x+(x+.5)*view.cell,y:r.y+view.y+(y+.5)*view.cell};},{x,y});
   await page.touchscreen.tap(p.x,p.y);
  }
  await choose(16,35);
  assert.deepEqual(await page.evaluate(()=>CQCamera.placement),{x:16,y:35,type:'relay'});
  assert.equal(await page.evaluate(()=>__builds),0,'map tap is preview only');
  await page.locator('#confirmBuild').waitFor({state:'visible'});
  assert.equal(await page.locator('#confirmBuild').isEnabled(),true);
  assert.equal(await page.evaluate(()=>JSON.stringify(CQSnapshot.capture(game))),baseline);
  await page.locator('#cancelBuildPreview').tap();
  assert.equal(await page.evaluate(()=>CQCamera.placement),null,'cancel clears candidate');
  assert.equal(await page.locator('#confirmBuild').isVisible(),false);
  assert.equal(await page.evaluate(()=>__builds),0);
  await page.locator('[data-build="relay"]').tap();
  await choose(16,39);
  assert.equal(await page.locator('#confirmBuild').isEnabled(),false,'occupied core cannot be confirmed');
  await choose(16,35);
  const before=await page.evaluate(()=>({money:game.money[1],count:game.buildings.length}));
  await page.locator('#confirmBuild').tap();
  assert.deepEqual(await page.evaluate(()=>({money:game.money[1],count:game.buildings.length,builds:__builds})),{money:before.money-45,count:before.count+1,builds:1});
  assert.equal(await page.evaluate(()=>mode),null);
  assert.equal(await page.locator('#confirmBuild').isVisible(),false);
  await page.setViewportSize({width:360,height:640});
  await page.locator('#cameraOverview').tap();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert(await page.evaluate(()=>view.cell>0&&view.h>200),'small phone retains a playable map');
  assert.deepEqual(errors,[]);
  console.log('PASS: campaign arena fit, pan/pinch, read-only preview, cancellation, invalid placement, explicit single purchase and small portrait viewport.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
