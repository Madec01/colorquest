/* A real V0.4 match must survive the V0.5 update without moving it to a new map. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const oldSnapshot = require('./fixtures/v04-snapshot.json');

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox']});
  try{
    const p=await browser.newPage({viewport:{width:360,height:640},isMobile:true,hasTouch:true});
    const errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await p.evaluate(snapshot=>{
      CQWorldUI.selectMap('lanes');
      localStorage.setItem(CQSave.KEY,JSON.stringify({
        format:'colorquest-match',version:1,id:'v04-real-fixture',writer:'previous-release',savedAt:1750000000000,
        snapshot,ui:{camera:{cx:16,cy:35,zoom:2.2,mini:true},selection:[snapshot.state.units[0].id],step:1}
      }));
    },oldSnapshot);
    await p.reload();
    assert.match(await p.locator('#resumeDetails').innerText(),/Toile originelle|Toile classique/);
    assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem(CQSave.KEY)).snapshot.version),1,'reading a legacy slot never overwrites it');
    await p.locator('#continueGame').tap();
    assert.equal(await p.evaluate(()=>game.mapId),'legacy','resume keeps the original board regardless of selected new map');
    assert.equal(await p.evaluate(()=>paused),true);
    const restored=await p.evaluate(()=>CQSnapshot.capture(game));
    for(const key of Object.keys(oldSnapshot.state)){
      if(key==='tiles'){
        const trimmed=restored.state.tiles.map((tile,i)=>Object.fromEntries(Object.keys(oldSnapshot.state.tiles[i]).map(k=>[k,tile[k]])));
        assert.deepEqual(trimmed,oldSnapshot.state.tiles,'all legacy terrain, exploration and ownership preserved');
      }else assert.deepEqual(restored.state[key],oldSnapshot.state[key],`legacy field ${key} preserved`);
    }
    assert.equal(restored.state.tiles.some(t=>t.cache||t.rich||t.terrain!=='plain'),false,'no new resources or terrain inserted into the old game');
    assert.equal(await p.evaluate(()=>CQCamera.zoom),2.2);
    assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem(CQSave.KEY)).snapshot.version),2,'a successful resume writes the new format');
    await p.reload();await p.locator('#continueGame').tap();
    assert.deepEqual(await p.evaluate(()=>CQSnapshot.capture(game)),restored,'a second resume is exactly stable');
    await p.locator('#back').tap();await p.locator('#exit').tap();
    await p.evaluate(()=>CQWorldUI.selectMap('crossroads'));
    await p.locator('#play').tap();await p.locator('#newGameCancel').tap();
    assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem(CQSave.KEY)).snapshot.state.mapId),'legacy');
    await p.locator('#play').tap();await p.locator('#newGameConfirm').tap();
    assert.equal(await p.evaluate(()=>game.mapId),'crossroads');
    assert.equal(await p.evaluate(()=>game.tiles.filter(t=>t.cache>0).length),6);
    assert.equal(await p.evaluate(()=>game.specializations[1]),null);
    assert.deepEqual(errors,[]);
    console.log('PASS V0.4→V0.5 browser migration: exact legacy board/state, paused resume, map/queue retained, new format stable, replacement confirmation and selected new map.');
    await p.close();
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
