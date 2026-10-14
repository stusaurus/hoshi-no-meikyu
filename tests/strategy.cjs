'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const cards=['walk','dash','jump','scan','tractor'];
function make(count,size,seed){
 const nodes=new Map(),tasks=[],errors=[];let x=seed>>>0;
 const math=Object.create(Math);math.random=()=>((x=(Math.imul(x,1664525)+1013904223)>>>0)/4294967296);
 function el(k){if(!nodes.has(k))nodes.set(k,{style:{setProperty(){}},hidden:false,innerHTML:'',textContent:'',value:k==='#gameSet'?'strategy':k==='#playMode'?'local':k==='#boardSize'?String(size):k==='#playerCount'?String(count):'',addEventListener(){}});return nodes.get(k);}
 const ctx=vm.createContext({Math:math,document:{querySelector:el,addEventListener(){}},window:{setTimeout:fn=>tasks.push(fn)},console:{log(){},error(...a){errors.push(a.join(' '));}}});
 vm.runInContext(fs.readFileSync('game.js','utf8')+'\n'+fs.readFileSync('cpu.js','utf8')+'\nthis.t={start,get:()=>G,placeStar,placeWall,neighbor,edge,wallInitialAllowed,unlock,endTurn,selectCard,startJump,startDash,inspectStar,inspectWall,knownStar,render,claim,playerPoints,emergencyBoost,emergencyReturn,run:window.StarMazeCPU.run};',ctx);
 ctx.t.start();return {t:ctx.t,nodes,errors};
}
function placement(t){
 const g=t.get();
 while(g.phase==='placement'){
  t.unlock();g.selectedSupply=g.queue[0].type==='star'?g.players[g.current].stars.length-1:0;
  if(g.queue[0].type==='star'){
   const at=Array.from({length:g.n*g.n},(_,i)=>i).find(i=>!g.stars[i]&&g.players.every(p=>Math.abs(Math.floor(i/g.n)-Math.floor(p.pos/g.n))+Math.abs(i%g.n-p.pos%g.n)>=2));
   assert.notEqual(at,undefined);t.placeStar(at);
  }else{
   let done=false;for(let i=0;i<g.n*g.n&&!done;i++)for(let d=0;d<4&&!done;d++){
    const j=t.neighbor(i,d);if(j<0||g.walls[t.edge(i,j)]||(g.placementPhase===0&&!t.wallInitialAllowed(i,j)))continue;
    const before=g.queue.length;g.dir=d;t.placeWall(i);done=g.queue.length<before;
   }assert.ok(done);
  }
 }
}
for(const count of [2,3,4])for(const size of [7,8,9]){
 const {t,nodes}=make(count,size,123+count*size),g=t.get();
 assert.equal(Object.keys(g.stars).length,0,'No random neutral stars');
 for(const p of g.players){assert.deepEqual(Array.from(p.stars),[1,2,3]);assert.deepEqual(Array.from(p.hand),cards);}
 placement(t);assert.equal(Object.keys(g.stars).length,2*count);assert.ok(g.players.every(p=>p.stars.length===1));
 assert.ok(Object.values(g.stars).every(t.knownStar));
 assert.match(nodes.get('#board').innerHTML,/starlabel/);assert.ok(!nodes.get('#board').innerHTML.includes('star_hidden'));
 // A public star cannot consume the wall-only scan action.
 t.unlock();t.selectCard(3);t.inspectStar(Number(Object.keys(g.stars)[0]));assert.equal(g.actions,0);
 // Two consecutive personal turns can choose the same movement card.
 g.active=null;g.walls={};g.stars={};g.players[0].pos=g.n+1;t.selectCard(2);t.startJump(1,1);assert.equal(g.actions,1);assert.deepEqual(Array.from(g.players[0].hand),cards);
 t.selectCard(0);assert.equal(g.active,null,'Second action is forbidden');
 assert.match(nodes.get('#side').innerHTML,/disabled/);
 for(let i=0;i<count;i++)t.endTurn();t.unlock();t.selectCard(2);t.startJump(1,1);assert.equal(g.actions,1);assert.deepEqual(Array.from(g.players[0].hand),cards);
 // A new unmodified game verifies both placement phases and equal star supply.
 const b=make(count,size,999),h=b.t.get();placement(b.t);
 while(h.round<7){b.t.unlock();b.t.endTurn();}
 assert.equal(h.phase,'placement');assert.equal(h.placementPhase,1);placement(b.t);
 assert.equal(Object.keys(h.stars).length,3*count);assert.ok(h.players.every(p=>p.stars.length===0));
 for(let id=0;id<count;id++)assert.deepEqual(Object.values(h.stars).filter(s=>s.placer===id).map(s=>s.value).sort(),[1,2,3]);
 while(h.phase!=='ended'){b.t.unlock();b.t.endTurn();}assert.equal(h.round,12);
 h.players[0].penalty=2;const star=Object.values(h.stars)[0];star.claimed=0;b.t.render();assert.equal(b.t.playerPoints(h.players[0]),star.value-2);assert.match(b.nodes.get('#score').innerHTML,/現在の得点/);
 assert.equal(h.deck.length+h.discard.length+h.moveDeck.length+h.effectDeck.length+h.moveDiscard.length+h.effectDiscard.length,0);
 console.log('PASS fixed/public '+count+'p '+size+'x'+size+': equal 1/2/3, two+one placement, reusable cards, one action, live points, 12 circuits');
}
// Fixed actions preserve cards during rescue, and live points include a
// return penalty immediately rather than revealing it only at the end.
{
 const {t,nodes}=make(2,7,3),g=t.get();placement(t);t.unlock();
 g.stars={};g.walls={};g.players[0].pos=24;g.players[1].pos=48;
 for(let d=0;d<4;d++){const j=t.neighbor(24,d);g.walls[t.edge(24,j)]={a:Math.min(24,j),b:Math.max(24,j),kind:'solid',faceUp:true,seen:[],placer:1};}
 t.emergencyBoost(0);assert.equal(g.actions,1);assert.deepEqual(Array.from(g.players[0].hand),cards);
 g.actions=0;g.players[0].pos=24;g.stars={};g.walls={};
 for(let i=0;i<49;i++)for(let d=0;d<4;d++){const j=t.neighbor(i,d);if(j>=0)g.walls[t.edge(i,j)]={a:Math.min(i,j),b:Math.max(i,j),kind:'solid',faceUp:true,seen:[],placer:1};}
 for(const i of [17,23,25,31,10,22,26,38])g.stars[i]={value:1,placer:1,claimed:1,seen:[]};
 t.emergencyReturn();assert.equal(g.players[0].penalty,2);assert.equal(g.actions,1);assert.deepEqual(Array.from(g.players[0].hand),cards);assert.match(nodes.get('#score').innerHTML,/-2/);
 assert.equal(g.players[0].pos,g.players[0].home);
 console.log('PASS fixed-action rescue conservation and live return penalty');
}
// All players automated: CPU must use public values, never consume fixed cards,
// and complete a legal game in all nine supported player/board configurations.
for(const count of [2,3,4])for(const size of [7,8,9])for(const seed of [31,97]){
 const {t,errors}=make(count,size,seed),g=t.get();g.players.forEach(p=>p.cpu=true);let ticks=0;
 while(g.phase!=='ended'&&ticks++<400){t.run();assert.ok(g.players.every(p=>p.hand.join(',')===cards.join(',')));assert.ok(g.actions<=1);assert.deepEqual(errors,[]);}
 assert.equal(g.phase,'ended');assert.equal(Object.keys(g.stars).length,3*count);
 assert.equal(Object.values(g.stars).reduce((a,s)=>a+s.value,0),6*count);
 console.log('PASS fixed-action CPU '+count+'p '+size+' seed '+seed);
}
