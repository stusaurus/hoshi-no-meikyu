// Real Chromium CPU-mode end-to-end test.
// Human takes setup turns and passes; CPU must place stars/walls and play to reveal.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const ROOT=process.env.STAR_MAZE_URL||'http://127.0.0.1:8765/';
fs.mkdirSync(path.join(__dirname,'..','artifacts'),{recursive:true});
async function run(browser,count,width){
 const context=await browser.newContext({viewport:{width,height:820}});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(ROOT,{waitUntil:'networkidle'});
  const art=await page.evaluate(async()=>{const r=await fetch('./assets/art.webp');return {ok:r.ok,bytes:(await r.arrayBuffer()).byteLength};});
  assert.ok(art.ok&&art.bytes>25000,'Approved illustrations asset must be served, not missing');

  assert.equal(await page.locator('#gameSet').inputValue(),'strategy','Fixed-action mode is the default ruleset');
  await page.locator('#gameSet').selectOption('starter');
  await page.locator('#playMode').selectOption('cpu'+count);
  await page.locator('#boardSize').selectOption(count===4?'9':'7');
  await page.locator('#start').click();
  assert.equal(await page.evaluate(()=>G.ruleset),'starter');

  assert.equal(await page.evaluate(()=>G.players.filter(x=>x.cpu).length),count-1);
  let turns=0;
  while(turns++<70){
   // CPU executes inside the covered handoff. Wait until the human is up.
   await page.waitForFunction(()=>G.phase==='ended'||(G.players[G.current]&&!G.players[G.current].cpu),null,{timeout:20000});
   const phase=await page.evaluate(()=>G.phase);
   if(phase==='ended')break;
   if(await page.locator('#handoff').isVisible()){
    assert.equal(await page.locator('main').evaluate(x=>x.style.visibility),'hidden','Handoff masks private information');
    await page.locator('#reveal').click();
   }
   if(phase==='placement'){
    const action=await page.evaluate(()=>{
      const size=G.n,kind=G.queue[0].type;
      if(kind==='star'){
       const i=Array.from({length:size*size},(_,i)=>i).find(i=>!G.stars[i]&&!occupied(i,-1)&&G.players.every(p=>dist(i,p.pos)>=2));
       return {kind,cell:i};
      }
      for(let i=0;i<size*size;i++)for(let d=0;d<4;d++){
       const j=neighbor(i,d);if(j<0||G.walls[edge(i,j)])continue;
       if(G.placementPhase===0&&!wallInitialAllowed(i,j))continue;
       return {kind,cell:i,d};
      }
      return {kind,cell:null};
    });
    assert.notEqual(action.cell,null,'Human placement exists');
    if(action.kind==='wall')await page.locator('[data-dir="'+action.d+'"]').click();
    await page.locator('#board [data-cell="'+action.cell+'"]').click();
   }else if(phase==='play'){
    assert.equal(await page.locator('.rocket-on-cell').count(),count,'4-color rocket artwork renders once board is visible');
    assert.equal(await page.locator('.sprite-rocket_blue').count(),1,'Blue player uses approved blue rocket, not emoji');
    const hand=await page.evaluate(()=>({
      move:G.players[G.current].hand.filter(c=>defs[c].group==='move').length,
      effect:G.players[G.current].hand.filter(c=>defs[c].group==='effect').length
    }));
    assert.equal(hand.move,3,'Starter hand has 3 movement cards after prior refill');
    assert.equal(hand.effect,2,'Starter hand has 2 effect cards after prior refill');
    assert.equal(await page.locator('.move-group [data-card]').count(),3,'3 cards shown under blue movement heading');
    assert.equal(await page.locator('.card-art').count(),5,'All starter cards show approved illustrations');
    assert.equal(await page.locator('.sprite-star_hidden').count(),await page.evaluate(()=>Object.keys(G.stars).length),'All stars, including claimed ones, stay face-down until the final reveal');
    assert.equal(await page.locator('.wall.unknown .sprite-wall_hidden').count(),await page.evaluate(()=>Object.values(G.walls).filter(w=>!w.faceUp).length),'All hidden wall types share the stone back');

    assert.equal(await page.locator('.effect-group [data-card]').count(),2,'2 cards shown under purple effect heading');
    await page.locator('#endturn').click();
   }else throw Error('Unknown phase '+phase);
  }
  assert.equal(await page.evaluate(()=>G.phase),'ended','Game completes against CPUs');
  assert.ok(await page.evaluate(()=>Object.values(G.stars).some(s=>s.claimed!==null&&s.claimed>0)),'CPU scored at least once');
  assert.equal(await page.locator('.result').count(),count);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert.ok(overflow<=8,'No horizontal overflow: '+overflow);
  await page.screenshot({path:path.join(__dirname,'..','artifacts','cpu-'+count+'players-'+width+'.png'),fullPage:true});
  assert.deepEqual(errors,[],'No JavaScript page errors');
  console.log('PASS 1 human + '+(count-1)+' CPU(s), '+width+'px, entire game including scores');
 }finally{
  await context.close();
 }
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  await run(browser,2,1280);
  await run(browser,4,390);
  await run(browser,3,390);
  await run(browser,2,320);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});