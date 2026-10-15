'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const root=process.env.STAR_MAZE_URL||'http://127.0.0.1:8765/';
const balanced=process.env.STAR_MAZE_BALANCED==='1';
fs.mkdirSync('artifacts',{recursive:true});
async function run(browser,width,count){
 const page=await browser.newPage({viewport:{width,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(root);assert.equal(await page.locator('#gameSet').inputValue(),'strategy');
  if(balanced)await page.locator('#gameSet').selectOption('balanced');
  await page.locator('#playMode').selectOption('cpu'+count);await page.locator('#boardSize').selectOption(String(count+5));
  await page.locator('#start').click();
  async function untilHuman(){await page.waitForFunction(()=>G.phase==='ended'||!G.players[G.current].cpu,{},{timeout:15000});if(await page.locator('#handoff').isVisible())await page.locator('#reveal').click();}
  async function place(){
   while(await page.evaluate(()=>G.phase==='placement')){
    await untilHuman();if(await page.evaluate(()=>G.phase!=='placement'))break;
    const next=await page.evaluate(()=>{
     if(placementKind()==='star')return {i:Array.from({length:G.n*G.n},(_,i)=>i).find(i=>!G.stars[i]&&G.players.every(p=>dist(i,p.pos)>=2)),supply:G.players[G.current].stars.length-1};
     for(let i=0;i<G.n*G.n;i++)for(let d=0;d<4;d++){const j=neighbor(i,d);if(j>=0&&!G.walls[edge(i,j)]&&(G.placementPhase!==0||wallInitialAllowed(i,j)))return {i,d};}
    });assert.ok(next);
    if(next.supply!==undefined)await page.locator('[data-supply="'+next.supply+'"]').click();
    if(next.d!==undefined)await page.locator('[data-dir="'+next.d+'"]').click();
    await page.locator('[data-cell="'+next.i+'"]').click();
   }
  }
  await place();await untilHuman();
  assert.equal(await page.evaluate(()=>Object.keys(G.stars).length),2*count);
  assert.equal(await page.locator('.starlabel').count(),2*count);
  assert.equal(await page.locator('[data-card]').count(),5);
  assert.equal(await page.locator('#basic').isVisible(),false);
  assert.match(await page.locator('#score').innerText(),/現在の得点/);
  assert.match(await page.locator('#side').innerText(),balanced?/後半開始時に全員を同じ8枚/:/繰り返し|次の手番でも/);
  assert.match(await page.locator('[data-card]:has(.sprite-card_scan)').innerText(),/秘密の壁/);
  assert.match(await page.locator('.fixed-card .sprite-card_scan').evaluate(el=>getComputedStyle(el,'::after').content),/秘密の壁/);
  // Put an existing 3-point star next to the human to verify real walk UI,
  // live points, and that choosing one action doesn't remove its card.
  const dest=await page.evaluate(()=>{
   const at=G.n+1,to=at+1;G.players[0].pos=at;G.players.slice(1).forEach((p,i)=>p.pos=G.n*G.n-1-i);G.walls={};
   const key=Object.keys(G.stars).find(k=>G.stars[k].value===3),star=G.stars[key];delete G.stars[key];
   if(G.stars[to]){G.stars[key]=G.stars[to];delete G.stars[to];}G.stars[to]=star;render();return to;
  });
  await page.locator('[data-card="0"]').click();await page.locator('[data-cell="'+dest+'"]').click();await page.locator('[data-finish]').click();
  assert.equal(await page.evaluate(()=>playerPoints(G.players[0])),3);
  assert.equal(await page.evaluate(()=>G.players[0].hand.length),balanced?7:5);
  assert.equal(await page.locator('[data-card]').count(),5);assert.equal(await page.locator('[data-card]:enabled').count(),0);
  assert.match(await page.locator('.player-score').first().innerText(),/3点/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'artifacts/'+(balanced?'balanced-':'strategy-')+width+'-'+count+'p.png',fullPage:true});
  await page.locator('#endturn').click();await untilHuman();
  assert.equal(await page.locator('[data-card]:enabled').count(),5);await page.locator('[data-card="0"]').click();await page.locator('[data-cancel]').click();
  let turns=0;
  while(await page.evaluate(()=>G.phase!=='ended')){
   if(++turns>80)throw Error('Fixed-action game did not finish');
   await untilHuman();if(await page.evaluate(()=>G.phase==='ended'))break;
   if(await page.evaluate(()=>G.phase==='placement')){await place();continue;}
   await page.locator('#endturn').click();
  }
  assert.equal(await page.evaluate(()=>Object.keys(G.stars).length),3*count);
  assert.equal(await page.locator('.result').count(),count);assert.match(await page.locator('#side h2').innerText(),/対戦終了/);
  assert.deepEqual(errors,[]);console.log('PASS '+(balanced?'finite/cyclic':'fixed/public')+' browser '+width+'px '+count+'p: two+one placement, public stars, live points, card budgets, CPU finish');
 }finally{await page.close();}
}
(async()=>{const browser=await chromium.launch({args:['--no-sandbox']});try{for(const width of [1280,390,320])for(const count of [2,3,4])await run(browser,width,count);}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
