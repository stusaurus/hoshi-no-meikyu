// Solo-default and return-to-title navigation regression (Chromium).
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const URL=process.env.STAR_MAZE_URL||'http://127.0.0.1:8765/';

async function run(browser,width,height){
 const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
 const page=await ctx.newPage();
 const errors=[];
 page.on('pageerror',err=>errors.push(err.message));
 try{
  const response=await page.goto(URL,{waitUntil:'networkidle'});
  assert.equal(response.status(),200);
  assert.equal(await page.locator('#gameSet').inputValue(),'strategy','Public fixed-action mode must be the default ruleset');
  assert.match(await page.locator('#setDescription').innerText(),/公開得点・固定アクション/);
  await page.locator('#gameSet').selectOption('standard');
  assert.match(await page.locator('#setDescription').innerText(),/カード8種類・壁4種類/);
  await page.locator('#gameSet').selectOption('starter');
  assert.match(await page.locator('#setDescription').innerText(),/カード5種類・壁3種類/);
  assert.equal(await page.locator('#playMode').inputValue(),'cpu2','1 human vs 1 CPU is the default');
  assert.match(await page.locator('#startHeading').innerText(),/1人で遊ぼう/);
  assert.equal(await page.locator('#start').isVisible(),true);
  assert.equal(await page.locator('#friendCountLabel').isVisible(),false,'Hide multiplayer-only settings in solo play');
  assert.equal(await page.locator('#backToTitle').isVisible(),false,'No back button on title');

  // Selecting multiplayer changes the visible introduction, but can switch back.
  await page.locator('#playMode').selectOption('local');
  assert.equal(await page.locator('#friendCountLabel').isVisible(),true,'Multiplayer player count is available for friend mode');
  assert.match(await page.locator('#startHeading').innerText(),/友達と遊ぼう/);
  await page.locator('#playMode').selectOption('cpu2');
  assert.equal(await page.locator('#friendCountLabel').isVisible(),false);
  assert.match(await page.locator('#startHeading').innerText(),/1人で遊ぼう/);

  // Start: initial private placement must offer an exit.
  await page.locator('#start').click();
  assert.equal(await page.locator('#handoff').isVisible(),true);
  assert.equal(await page.locator('#backFromHandoff').isVisible(),true);
  assert.equal(await page.locator('main').evaluate(el=>el.style.visibility),'hidden');

  // Declining return preserves the game and hidden-info guard.
  page.once('dialog',async d=>{assert.match(d.message(),/保存されません/);await d.dismiss();});
  await page.locator('#backFromHandoff').click();
  assert.equal(await page.locator('#handoff').isVisible(),true);
  assert.equal(await page.evaluate(()=>G!==null),true,'Game remains after cancel');

  // Accepting return resets and restores usable title screen.
  page.once('dialog',d=>d.accept());
  await page.locator('#backFromHandoff').click();
  assert.equal(await page.evaluate(()=>G),null,'Game cleared after confirmed return');
  assert.equal(await page.locator('#handoff').isVisible(),false);
  assert.equal(await page.locator('#backToTitle').isVisible(),false);
  assert.equal(await page.locator('#playMode').inputValue(),'cpu2','Return preserves solo-first starting experience');

  // After revealing a turn, top-of-page button must also work.
  await page.locator('#start').click();
  await page.locator('#reveal').click();
  assert.equal(await page.locator('#backToTitle').isVisible(),true);
  assert.equal(await page.locator('#board [data-cell]').count(),49);
  page.once('dialog',d=>d.accept());
  await page.locator('#backToTitle').click();
  assert.equal(await page.evaluate(()=>G),null);
  assert.equal(await page.locator('#start').isVisible(),true);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+8),'No horizontal overflow');
  assert.deepEqual(errors,[],'No JavaScript errors');
  console.log('PASS '+width+'px: solo by default, local option, both back buttons, safe confirmation, restart');
 }finally{await ctx.close();}
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  await run(browser,1280,800);
  await run(browser,390,844);
  await run(browser,320,740);
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
