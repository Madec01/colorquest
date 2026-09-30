/* Browser gesture regression: node tests/camera.browser.cjs */
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
(async()=>{
 const executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined;
 const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
 await page.click('#play');
 await page.evaluate(()=>{
   window.__calls={orders:0,builds:0};
   const o=game.order.bind(game),b=game.build.bind(game);
   game.order=(...a)=>{if(a[0]?.length)__calls.orders++;return o(...a)};
   game.build=(...a)=>{if(a[0]===1)__calls.builds++;return b(...a)};
   selection=game.units.filter(u=>u.team===1).map(u=>u.id);
 });
 const rect=await page.locator('#map').boundingBox();
 const cdp=await page.context().newCDPSession(page);
 const point=(x,y,id=1)=>({x:rect.x+x,y:rect.y+y,id});
 async function touch(type,points){await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});}
 let before=await page.evaluate(()=>({cx:(view.w/2-view.x)/view.cell,cy:(view.h/2-view.y)/view.cell,z:CQCamera.zoom}));
 const x=rect.width*.35,y=rect.height*.55;
 // One finger dragging with an active build mode must pan without placing.
 await page.evaluate(()=>setMode({kind:'build',type:'relay'}));
 await touch('touchStart',[point(x,y)]);await touch('touchMove',[point(x+55,y+90)]);await touch('touchEnd',[]);
 assert.deepEqual(await page.evaluate(()=>__calls),{orders:0,builds:0});
 let after=await page.evaluate(()=>({cy:(view.h/2-view.y)/view.cell}));assert.notEqual(after.cy,before.cy,'pan changes camera');
 // Pinch, transition to one finger, then release must never become a tap.
 await touch('touchStart',[point(x-30,y,1),point(x+30,y,2)]);
 await touch('touchMove',[point(x-65,y-10,1),point(x+65,y+10,2)]);
 await touch('touchEnd',[point(x-65,y-10,1)]);
 await touch('touchMove',[point(x-55,y+10,1)]);
 await touch('touchEnd',[]);
 assert((await page.evaluate(()=>CQCamera.zoom))>before.z,'pinch increases zoom');
 assert.deepEqual(await page.evaluate(()=>__calls),{orders:0,builds:0});
 // Cancel must never construct.
 await touch('touchStart',[point(x,y)]);await touch('touchCancel',[]);
 assert.equal(await page.evaluate(()=>__calls.builds),0);
 // Navigation tap without move mode never orders; explicit move does.
 await page.evaluate(()=>{setMode(null);CQCamera.focus(16,38,2);});
 const target=await page.evaluate(()=>{const r=canvas.getBoundingClientRect();const t=game.tiles.find(t=>t.owner===1&&!t.blocked&&!game.buildings.some(b=>Math.hypot(b.x+.5-t.x-.5,b.y+.5-t.y-.5)<3)&&!game.units.some(u=>Math.hypot(u.x-t.x-.5,u.y-t.y-.5)<3));return{x:r.x+view.x+(t.x+.5)*view.cell,y:r.y+view.y+(t.y+.5)*view.cell}});
 await page.touchscreen.tap(target.x,target.y);assert.equal(await page.evaluate(()=>__calls.orders),0);
 await page.evaluate(()=>setMode({kind:'move'}));await page.touchscreen.tap(target.x,target.y);assert.equal(await page.evaluate(()=>__calls.orders),1);
 // Extreme zoom is clamped; focus survives resize while viewport stays on map.
 await page.evaluate(()=>CQCamera.zoomAt(100));assert.equal(await page.evaluate(()=>CQCamera.zoom),4);
 await page.evaluate(()=>CQCamera.zoomAt(.001));assert.equal(await page.evaluate(()=>CQCamera.zoom),1);
 await page.click('#cameraHome');assert.equal(await page.evaluate(()=>CQCamera.zoom),1.7);
 await page.setViewportSize({width:360,height:740});
 assert(await page.evaluate(()=>Number.isFinite(view.cell)&&view.cell>0));
 assert.deepEqual(errors,[],'no runtime errors');
 const desktop=await browser.newPage({viewport:{width:1280,height:900}});
 desktop.on('pageerror',e=>errors.push(e.message));await desktop.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);await desktop.click('#play');
 const r=await desktop.locator('#map').boundingBox();await desktop.mouse.move(r.x+r.width/2,r.y+r.height/2);await desktop.mouse.wheel(0,-500);await desktop.waitForTimeout(80);
 assert((await desktop.evaluate(()=>CQCamera.zoom))>1.7,'wheel zoom works');
 await desktop.evaluate(()=>{selection=game.units.filter(u=>u.team===1).map(u=>u.id);window.__orders=0;const order=game.order.bind(game);game.order=(...a)=>{__orders++;return order(...a)};CQCamera.focus(16,38,2)});
 await desktop.mouse.click(r.x+r.width*.4,r.y+r.height*.55,{button:'right'});assert.equal(await desktop.evaluate(()=>__orders),1,'right click is explicit desktop order');
 assert.deepEqual(errors,[]);
 console.log('PASS: mobile pan/build suppression, pinch transition, cancel, explicit orders, zoom bounds/home/resize, desktop wheel and right-click.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
