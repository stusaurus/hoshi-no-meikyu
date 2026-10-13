// End-to-end UI smoke tests with real Chromium, run in GitHub Actions.
// This checks controls and page layout; it is not a game-balance simulation.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const URL = process.env.STAR_MAZE_URL || 'http://127.0.0.1:8765/';
const viewports = [
  {name:'desktop',width:1280,height:800},
  {name:'mobile390',width:390,height:844},
  {name:'mobile320',width:320,height:740}
];
fs.mkdirSync(path.join(__dirname,'..','artifacts'),{recursive:true});

async function snapshot(page,label) {
  await page.screenshot({path:path.join(__dirname,'..','artifacts',label+'.png'),fullPage:true});
}
async function ready(page) {
  if(await page.locator('#handoff').isVisible()){
    await page.locator('#reveal').click();
  }
}
async function placeOne(page) {
  await ready(page);
  const data=await page.evaluate(()=>{
    const kind=G.queue[0].type,n=G.n;
    if(kind==='star'){
      const cell=Array.from({length:n*n},(_,i)=>i).find(i=>!G.stars[i]&&!occupied(i,-1)&&G.players.every(p=>dist(i,p.pos)>=2));
      return {kind,cell};
    }
    for(let i=0;i<n*n;i++)for(let dir=0;dir<4;dir++){
      const j=neighbor(i,dir);
      if(j<0||G.walls[edge(i,j)])continue;
      if(G.placementPhase===0&&!wallInitialAllowed(i,j))continue;
      return {kind,cell:i,dir};
    }
    return {kind,cell:null};
  });
  assert.notEqual(data.cell,null,'There must be a placeable '+data.kind);
  if(data.kind==='wall')await page.locator('[data-dir="'+data.dir+'"]').click();
  await page.locator('#board [data-cell="'+data.cell+'"]').click();
}
async function finishPlacement(page) {
  let steps=0;
  while(await page.evaluate(()=>G.phase)==='placement'){
    if(++steps>20)throw Error('Placement did not finish');
    await placeOne(page);
  }
  assert.equal(await page.evaluate(()=>G.phase),'play');
}
async function play(viewport,browser) {
  const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},deviceScaleFactor:1});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
    const response=await page.goto(URL,{waitUntil:'networkidle'});
    assert.equal(response.status(),200,'home page served');
    assert.equal(await page.title(),'星の迷宮 | STANDARD 試作版');
    await page.locator('#playerCount').selectOption('2');
    await page.locator('#boardSize').selectOption('7');
    await page.locator('#start').click();
    assert.equal(await page.locator('#handoff').isVisible(),true,'handoff appears before private setup');
    assert.equal(await page.locator('main').evaluate(x=>x.style.visibility),'hidden','main is masked during private handoff');
    await finishPlacement(page);
    await ready(page);
    assert.equal(await page.locator('#board [data-cell]').count(),49);
    const sc=await page.evaluate(()=>({width:document.documentElement.scrollWidth,window:window.innerWidth}));
    assert.ok(sc.width<=sc.window+8,'horizontal overflow '+sc.width+' vs '+sc.window+' at '+viewport.name);
    await snapshot(page,'board-'+viewport.name);
    await page.locator('[data-card="2"]').click();
    await page.locator('[data-move="dash-1"]').click();
    assert.equal(await page.evaluate(()=>G.actions),1,'Dash uses one action');
    assert.equal(await page.evaluate(()=>G.active),null,'Dash finishes');
    await page.locator('[data-card="2"]').click(); // Scan shifts from hand index 3 to 2
    const starCell=await page.evaluate(()=>Number(Object.keys(G.stars)[0]));
    await page.locator('#board [data-cell="'+starCell+'"]').click();
    assert.equal(await page.evaluate(()=>G.actions),2,'Scan uses second action');
    assert.match(await page.locator('#side').innerText(),/自分だけに表示/,'scan reveals private information to current user');
    await page.locator('#endturn').click();
    assert.equal(await page.locator('#handoff').isVisible(),true,'handoff shown between players');
    assert.equal(await page.locator('main').evaluate(x=>x.style.visibility),'hidden','private information masked');
    await ready(page);
    assert.equal(await page.evaluate(()=>G.current),1);
    assert.equal(await page.evaluate(()=>G.privateMessage),'','old user scan message cleared');
    let turns=0;
    while(await page.evaluate(()=>G.phase)!=='ended'){
      if(++turns>36)throw Error('Full game did not finish');
      if(await page.evaluate(()=>G.phase)==='placement'){await finishPlacement(page);continue}
      await ready(page);
      await page.locator('#endturn').click();
    }
    assert.equal(await page.locator('.results .result').count(),2,'both players get final score');
    assert.equal(await page.locator('#board [data-cell]').count(),49);
    await snapshot(page,'result-'+viewport.name);
    assert.deepEqual(errors,[],'no page JavaScript exceptions');
    console.log('PASS '+viewport.name+': private placement, controls, dash, scan, handoff, final reveal, no overflow');
  }catch(e){
    await snapshot(page,'failure-'+viewport.name).catch(()=>{});
    console.error('FAIL '+viewport.name+': '+e.stack);
    throw e;
  }finally{await context.close();}
}
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{for(const viewport of viewports)await play(viewport,browser);}
  finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
