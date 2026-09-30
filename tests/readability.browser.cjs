/* Connected paths, understandable selection states and read-only touch previews. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const url = pathToFileURL(path.resolve(__dirname, '../index.html')).href;

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox'] });
  try {
    for (const viewport of [{width:390,height:844},{width:360,height:640}]) {
      const page = await browser.newPage({viewport,isMobile:true,hasTouch:true});
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.addInitScript(()=>localStorage.setItem('colorquest.v03.discovered','1'));
      await page.goto(url);
      await page.waitForFunction(()=>window.CQUI&&window.CQEngine&&window.CQCamera);
      // A deliberately bent network: the direct line between relay and core
      // crosses neutral ground and a rock. Only the long route is conductive.
      const connected = await page.evaluate(()=>{
        activateGame(new CQEngine.Game({mapId:'plain',seed:42}),{resume:true});
        game.units=[];game.buildings=game.buildings.filter(b=>b.type==='core');
        for(const t of game.tiles)if(t.owner===1)t.owner=0;
        const paint=(x,y)=>{const t=game.tile(x,y);t.owner=1;t.blocked=false;t.source=false;t.explored=true;t.visible=true};
        for(let x=10;x<=16;x++){paint(x,41);paint(x,32)}
        for(let y=32;y<=41;y++)paint(10,y);
        game.tile(16,35).blocked=true;
        window.__relay=game._building(1,'relay',16,32);
        game.recompute();game.updateVisibility();CQCamera.focus(13.5,36.5,2);CQUI.selectBuilding(__relay);
        const before=JSON.stringify(game),route=CQUI.networkPath(16,32);
        // Capture the renderer's selected-network stroke, not unit paths or borders.
        const original={moveTo:ctx.moveTo,lineTo:ctx.lineTo,beginPath:ctx.beginPath,stroke:ctx.stroke};let points=[],lines=[];
        ctx.beginPath=function(...args){points=[];return original.beginPath.apply(this,args)};
        ctx.moveTo=function(x,y){points.push([x,y]);return original.moveTo.call(this,x,y)};
        ctx.lineTo=function(x,y){points.push([x,y]);return original.lineTo.call(this,x,y)};
        ctx.stroke=function(...args){if(Math.abs(this.lineWidth-2.2)<.001&&points.length>2)lines.push(points.map(p=>[...p]));return original.stroke.apply(this,args)};
        CQUI.draw(ctx,view);Object.assign(ctx,original);
        return {route,unchanged:before===JSON.stringify(game),conductive:route.every(p=>{const t=game.tile(p.x,p.y);return t.owner===1&&t.connected&&!t.blocked}),rendered:lines.some(line=>line.length===route.length&&line.every((p,i)=>Math.abs(p[0]-(view.x+(route[i].x+.5)*view.cell))<.001&&Math.abs(p[1]-(view.y+(route[i].y+.5)*view.cell))<.001))};
      });
      assert.ok(connected.route.length>15,'the network path bends around the non-owned shortcut');
      assert.deepEqual(connected.route[0],{x:16,y:32});assert.deepEqual(connected.route.at(-1),{x:16,y:41});
      assert.ok(connected.route.every((p,i)=>!i||Math.abs(p.x-connected.route[i-1].x)+Math.abs(p.y-connected.route[i-1].y)===1),'line follows adjacent cells');
      assert.ok(connected.conductive);assert.ok(connected.rendered,'the canvas draws the same actual route');assert.ok(connected.unchanged,'drawing never changes simulation');
      assert.match(await page.locator('#objectName').textContent(),/Votre relais/);
      assert.match(await page.locator('#objectState').textContent(),/Relié au Cœur/);
      const close=await page.locator('#dismissObject').boundingBox();assert.ok(close.width>=44&&close.height>=44);
      await page.screenshot({path:`/tmp/colorquest-v06-network-${viewport.width}.png`});
      await page.evaluate(()=>{game.tile(10,36).owner=0;game.recompute();CQUI.update(true)});
      assert.deepEqual(await page.evaluate(()=>CQUI.networkPath(__relay.x,__relay.y)),[]);
      assert.match(await page.locator('#objectState').textContent(),/ISOLÉ/);
      assert.match(await page.locator('#objectRole').textContent(),/ne progresse plus/);
      assert.equal(await page.evaluate(()=>{
        const u=game._unit(1,'fighter',10.5,40.5);CQUI.clearBuilding();selection=[u.id];CQUI.update(true);
        selection=[];CQUI.update();return document.getElementById('objectCard').classList.contains('hidden');
      }),true,'clearing selection immediately releases the map even during the stat refresh throttle');
      // A fogged enemy loses its selection and never supplies hidden card state.
      await page.evaluate(()=>{const b=game.getCore(2);game.tile(b.x,b.y).visible=true;CQUI.selectBuilding(b);game.tile(b.x,b.y).visible=false;CQUI.update(true)});
      assert.equal(await page.locator('#objectCard').isVisible(),false);
      // A real campaign state presents the cause and action without raw health,
      // technology level or unexplained numerical statistics.
      await page.evaluate(()=>{activateGame(new CQEngine.Game({missionId:'link',seed:42}),{resume:true});const b=game.buildings.find(b=>b.type==='extractor'&&b.team===1);CQUI.selectBuilding(b);CQCamera.focus(16.5,26,1.5)});
      assert.doesNotMatch(await page.locator('#objectCard').textContent(),/\bPV\b|niv\./);
      assert.match(await page.locator('#objectRole').textContent(),/production est arrêtée/);
      assert.match(await page.locator('#objectState').textContent(),/ISOLÉ/);
      await page.screenshot({path:`/tmp/colorquest-v06-isolation-${viewport.width}.png`});
      // Preview validity is exactly the engine check; asking and rendering it
      // repeatedly must not debit pigment, advance time, recruit or paint.
      const preview = await page.evaluate(()=>{
        activateGame(new CQEngine.Game({missionId:'first-ink',seed:42}),{resume:true});
        const t=game.tiles.find(t=>game.canBuild(1,'relay',t.x,t.y).ok);window.__previewTarget={x:t.x,y:t.y};
        mode={kind:'build',type:'relay'};hover={x:t.x+.5,y:t.y+.5};
        const before=JSON.stringify(game);let result;
        for(let i=0;i<5;i++){result=CQUI.placementPreview('relay',t.x,t.y);CQUI.drawPlacement(ctx,view)}
        return {unchanged:before===JSON.stringify(game),ok:result.ok,radius:result.radius,engineRadius:game.getBuildingStats({team:1,type:'relay',level:1,x:t.x,y:t.y}).radius,path:result.path.length,cost:result.cost,price:game.getCost(1,'relay')};
      });
      assert.ok(preview.unchanged);assert.ok(preview.ok);assert.equal(preview.radius,preview.engineRadius);assert.equal(preview.cost,preview.price);assert.ok(preview.path>1);
      assert.match(await page.locator('#buildPreviewMessage').textContent(),/Relié au Cœur/);
      const failures=await page.evaluate(()=>{
        const t=__previewTarget;game.money[1]=0;const poor=CQUI.placementPreview('relay',t.x,t.y);game.money[1]=100;
        const rock=game.tile(t.x,t.y);rock.blocked=true;const blocked=CQUI.placementPreview('relay',t.x,t.y);rock.blocked=false;
        const hidden=game.tile(0,0);hidden.explored=false;hidden.visible=false;hidden.owner=0;
        const fog1=CQUI.placementPreview('relay',0,0);hidden.blocked=!hidden.blocked;hidden.source=true;hidden.rich=true;
        const fog2=CQUI.placementPreview('relay',0,0);
        return {poor:{ok:poor.ok,message:poor.message},blocked:{ok:blocked.ok,message:blocked.message},fog1,fog2};
      });
      assert.equal(failures.poor.ok,false);assert.match(failures.poor.message,/Il manque 45 pigments/);
      assert.equal(failures.blocked.ok,false);assert.match(failures.blocked.message,/inaccessible/);
      assert.deepEqual(failures.fog1,failures.fog2,'hidden terrain differences never leak through preview');assert.equal(failures.fog1.tile,null);
      // Exercise the persistent touch target and its actual confirm affordance.
      await page.evaluate(()=>{mode=null;setMode({kind:'build',type:'relay'});CQCamera.focus(__previewTarget.x+.5,__previewTarget.y+.5,2);});
      const tap = await page.evaluate(()=>{const r=canvas.getBoundingClientRect();return{x:r.x+view.x+(__previewTarget.x+.5)*view.cell,y:r.y+view.y+(__previewTarget.y+.5)*view.cell,count:game.buildings.length}});
      await page.touchscreen.tap(tap.x,tap.y);
      assert.equal(await page.evaluate(()=>game.buildings.length),tap.count,'preview tap does not spend or build');
      await page.locator('#confirmBuild').waitFor({state:'visible'});
      const confirm=await page.locator('#confirmBuild').boundingBox();assert.ok(confirm.width>=44&&confirm.height>=44);
      const cancel=await page.locator('#cancelBuildPreview').boundingBox();assert.ok(cancel.width>=44&&cancel.height>=44);
      assert.equal(await page.locator('#placementHint').isVisible(),false,'legacy hint does not cover the preview or confirmation');
      const ui=await page.evaluate(()=>({card:document.getElementById('buildPreviewCard').getBoundingClientRect().toJSON(),canvas:canvas.getBoundingClientRect().toJSON(),overflow:document.documentElement.scrollWidth>innerWidth}));
      assert.ok(ui.card.height<ui.canvas.height*.52,'preview preserves the majority of the playable map');assert.equal(ui.overflow,false);
      await page.screenshot({path:`/tmp/colorquest-v06-placement-${viewport.width}.png`});
      await page.locator('#cancelBuildPreview').tap();assert.equal(await page.evaluate(()=>mode),null);
      assert.equal(await page.evaluate(()=>game.buildings.length),tap.count,'cancel leaves the simulation unchanged');
      await page.locator('[data-build="relay"]').tap();await page.touchscreen.tap(tap.x,tap.y);
      await page.locator('#confirmBuild').tap();assert.equal(await page.evaluate(()=>game.buildings.length),tap.count+1);
      // A caserne selection really switches the producer, while displaying its
      // purpose rather than exposing a new unexplained set of stats.
      await page.evaluate(()=>{activateGame(new CQEngine.Game({missionId:'outpost',seed:42}),{resume:true});const t=game.tiles.find(t=>game.canBuild(1,'barracks',t.x,t.y).ok);const r=game.build(1,'barracks',t.x,t.y);window.__barracks=r.id;CQUI.selectBuilding(game.buildings.find(b=>b.id===r.id))});
      assert.equal(await page.evaluate(()=>CQStrategy.getRecruitSource()),await page.evaluate(()=>__barracks));
      assert.match(await page.locator('#objectRole').textContent(),/renforts ici/);
      assert.doesNotMatch(await page.locator('#objectCard').textContent(),/\bPV\b|niv\./);
      assert.deepEqual(errors,[]);
      console.log(`PASS readability ${viewport.width}x${viewport.height}: real conductive canvas route, cut explanation, mission card, fog privacy, pure placement and confirm, barracks producer.`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
