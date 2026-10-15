'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const game=fs.readFileSync('game.js','utf8'),bot=fs.readFileSync('cpu.js','utf8').replace('run,unknownValue,wallVisible,chooseAction,publicDistance','run,unknownValue,wallVisible,chooseAction,publicDistance,candidateTractor');
function make(){const els=new Map(),tasks=[];function el(k){if(!els.has(k))els.set(k,{style:{setProperty(){}},hidden:false,innerHTML:'',textContent:'',addEventListener(){},value:k==='#gameSet'?'starter':k==='#playMode'?'cpu2':k==='#boardSize'?'7':''});return els.get(k);}const c=vm.createContext({document:{querySelector:el,addEventListener(){}},window:{setTimeout:fn=>tasks.push(fn)},console,Math});vm.runInContext(game+'\n'+bot+'\nthis.api={start,get:()=>G,edge,selectCard,startJump,inspectWall,render,ai:window.StarMazeCPU}',c);c.api.start();const g=c.api.get();g.phase='play';g.locked=false;g.current=0;g.players[0].cpu=true;g.players[0].pos=24;g.players[1].pos=25;g.stars={};g.walls={};return {c,t:c.api,g,els};}
{
 const {t,g}=make();g.players[0].hand=['tractor'];const k=t.edge(25,26);g.walls[k]={a:25,b:26,kind:'solid',faceUp:false,seen:[1],placer:1};
 const a=JSON.stringify(t.ai.candidateTractor(0));g.walls[k].kind='phantom';const b=JSON.stringify(t.ai.candidateTractor(0));assert.equal(a,b,'Rival-only knowledge must not influence tractor candidates');
 g.walls[k].seen.push(0);g.walls[k].kind='solid';const solid=t.ai.candidateTractor(0);g.walls[k].kind='phantom';const phantom=t.ai.candidateTractor(0);assert.ok(phantom.length>solid.length,'CPU own scan can legitimately affect choices');
 console.log('PASS tractor hidden-information metamorphic regression');
}
{
 const {t,g}=make();g.players[0].hand=['walk'];g.players[0].shield=true;t.ai.run();assert.equal(g.players[0].shield,false,'CPU shield expires at start of next turn');console.log('PASS CPU barrier expiration');
}
{
 const {t,g,els}=make();g.stars[2]={value:3,placer:1,claimed:1,seen:[1]};t.render();assert.ok(!els.get('#board').innerHTML.includes('3点'),'Unobserved claimed star points stay hidden');
 const k=t.edge(24,25);g.walls[k]={a:24,b:25,kind:'bounce',faceUp:false,seen:[1],placer:1};t.render();let h=els.get('#board').innerHTML;assert.ok(h.includes('sprite-wall_hidden'));assert.ok(!h.includes('sprite-wall_bounce'));g.players[0].hand=['scan'];t.selectCard(0);t.inspectWall(k);assert.equal(g.walls[k].faceUp,false);assert.ok(els.get('#side').innerHTML.includes('自分だけが知っている壁'));g.current=1;g.walls[k].seen=[0];t.render();assert.ok(!els.get('#side').innerHTML.includes('自分だけが知っている壁'));console.log('PASS secret art and private wall notebook');
}
{
 const {t,g}=make();g.players[0].hand=['jump'];g.walls[t.edge(24,25)]={a:24,b:25,kind:'solid',faceUp:false,seen:[],placer:1};g.walls[t.edge(25,26)]={a:25,b:26,kind:'phantom',faceUp:false,seen:[],placer:1};t.selectCard(0);t.startJump(1,2);assert.equal(g.actions,0);assert.equal(g.players[0].pos,24);assert.equal(g.walls[t.edge(24,25)].faceUp,false);console.log('PASS invalid jump preserves card and hidden wall face');
}
