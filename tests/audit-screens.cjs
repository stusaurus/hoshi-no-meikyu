const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const root=process.env.STAR_MAZE_URL||'http://127.0.0.1:8765/',stage=process.env.AUDIT_STAGE||'after';
const out='docs/audit-2026-10-14/'+stage;fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({args:['--no-sandbox']});
try{for(const width of [1280,390,320]){const page=await browser.newPage({viewport:{width,height:width===1280?900:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(root);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:out+'/title-'+width+'.png',fullPage:true});
await page.locator('#playMode').selectOption('local');await page.locator('#boardSize').selectOption('9');await page.locator('#start').click();await page.locator('#reveal').click();await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:out+'/placement-'+width+'.png',fullPage:true});
// Reproducible visual fixture; actual gameplay flows are separately tested in browser.cjs.
await page.evaluate(()=>{G.phase='play';G.current=0;G.players[0].pos=40;G.players[1].pos=80;G.stars={40:{value:3,placer:0,claimed:0,seen:[0]},41:{value:0,placer:1,claimed:null,seen:[1]},30:{value:2,placer:1,claimed:1,seen:[1]},22:{value:1,placer:null,claimed:null,seen:[]}};G.walls={};for(const [a,b,kind,faceUp] of [[40,41,'solid',false],[40,49,'bounce',true],[21,22,'phantom',true],[31,32,'solid',true]])G.walls[edge(a,b)]={a,b,kind,faceUp,seen:[1],placer:1};render();});
await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:out+'/board-'+width+'.png',fullPage:true});
const metrics=await page.evaluate(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {width:r.width,height:r.height};};return {viewport:innerWidth,scroll:document.documentElement.scrollWidth,cell:rect('[data-cell]'),wall:rect('[data-wall]'),rocket:rect('.rocket-on-cell'),flag:rect('.flag-on-star'),card:rect('[data-card]')};});
fs.writeFileSync(out+'/metrics-'+width+'.json',JSON.stringify(metrics,null,2));assert.deepEqual(errors,[]);await page.close();}}
finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
