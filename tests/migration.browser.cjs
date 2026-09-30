/* Published V0.4/V0.5 matches survive V0.6 on their exact board and free-play slot. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const oldSnapshot = require('./fixtures/v04-snapshot.json');
const v5Snapshot = require('./fixtures/v05-snapshot.json');

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox']});
  try{
    for(const fixture of [oldSnapshot,v5Snapshot]){
    const p=await browser.newPage({viewport:{width:360,height:640},isMobile:true,hasTouch:true});
    const errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await p.evaluate(snapshot=>{
      CQWorldUI.selectMap(snapshot.version === 1 ? 'lanes' : 'plain');
      localStorage.setItem(CQSave.KEY,JSON.stringify({
        format:'colorquest-match',version:1,id:'v04-real-fixture',writer:'previous-release',savedAt:1750000000000,
        snapshot,ui:{camera:{cx:16,cy:35,zoom:2.2,mini:true},selection:[snapshot.state.units[0].id],step:1}
      }));
    },fixture);
    await p.reload();
    assert.match(await p.locator('#resumeDetails').innerText(),fixture.version===1?/Toile originelle|Toile classique/:/Couloirs/);
    assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem(CQSave.KEY)).snapshot.version),fixture.version,'reading an old slot never overwrites it');
    await p.locator('#continueGame').tap();
    assert.equal(await p.evaluate(()=>game.mapId),fixture.version===1?'legacy':'lanes','resume keeps the original board regardless of selected new map');
    assert.equal(await p.evaluate(()=>paused),true);
    const restored=await p.evaluate(()=>CQSnapshot.capture(game));
    for(const key of Object.keys(fixture.state)){
      if(key==='tiles'){
        const trimmed=restored.state.tiles.map((tile,i)=>Object.fromEntries(Object.keys(fixture.state.tiles[i]).map(k=>[k,tile[k]])));
        assert.deepEqual(trimmed,fixture.state.tiles,'all legacy terrain, exploration and ownership preserved');
      }else assert.deepEqual(restored.state[key],fixture.state[key],`legacy field ${key} preserved`);
    }
    assert.equal(restored.state.mission,null,'a historical free match never becomes a campaign mission');
    assert.equal(await p.evaluate(()=>localStorage.getItem(CQSave.CAMPAIGN_KEY)),null,'migration never touches the campaign slot');
    if(fixture.version===1)assert.equal(restored.state.tiles.some(t=>t.cache||t.rich||t.terrain!=='plain'),false,'no new resources or terrain inserted into the old game');
    assert.equal(await p.evaluate(()=>CQCamera.zoom),2.2);
    assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem(CQSave.KEY)).snapshot.version),3,'a successful resume writes the new format');
    await p.reload();await p.locator('#continueGame').tap();
    assert.deepEqual(await p.evaluate(()=>CQSnapshot.capture(game)),restored,'a second resume is exactly stable');
    await p.locator('#back').tap();await p.locator('#exit').tap();
    await p.evaluate(()=>CQWorldUI.selectMap('crossroads'));
    await p.locator('#play').tap();await p.locator('#newGameCancel').tap();
    assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem(CQSave.KEY)).snapshot.state.mapId),fixture.version===1?'legacy':'lanes');
    await p.locator('#play').tap();await p.locator('#newGameConfirm').tap();
    assert.equal(await p.evaluate(()=>game.mapId),'crossroads');
    assert.equal(await p.evaluate(()=>game.tiles.filter(t=>t.cache>0).length),6);
    assert.equal(await p.evaluate(()=>game.specializations[1]),null);
    assert.deepEqual(errors,[]);
    console.log(`PASS snapshot v${fixture.version}→V0.6 browser migration: exact old board/state, paused resume, map/queue retained, v3 stable, independent slot and replacement confirmation.`);
    await p.close();
    }
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
