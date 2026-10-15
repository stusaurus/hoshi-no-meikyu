'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const supply=['walk','walk','dash','dash','jump','jump','scan','tractor'];
function make(count,size){
 const nodes=new Map();function el(k){if(!nodes.has(k))nodes.set(k,{style:{setProperty(){}},addEventListener(){},hidden:false,innerHTML:'',textContent:'',value:k==='#gameSet'?'balanced':k==='#playMode'?'local':k==='#playerCount'?String(count):k==='#boardSize'?String(size):''});return nodes.get(k);}
 const ctx=vm.createContext({document:{querySelector:el,addEventListener(){}},window:{setTimeout(){}},console,Math});
 vm.runInContext(fs.readFileSync('game.js','utf8')+'\n'+fs.readFileSync('cpu.js','utf8')+'\nthis.t={start,get:()=>G,run:window.StarMazeCPU.run,unlock,selectCard,startJump,endTurn,render};',ctx);ctx.t.start();return {t:ctx.t,nodes};
}
for(const count of [2,3,4])for(const size of [7,8,9]){
 const {t,nodes}=make(count,size),g=t.get();
 assert.ok(g.balanced);g.players.forEach(p=>{assert.deepEqual(Array.from(p.hand),supply);p.cpu=true;});
 let ticks=0;const order=new Map();
 while(g.phase!=='ended'){
  assert.ok(++ticks<400);
  if(g.phase==='play'){
   t.unlock();t.render();assert.match(nodes.get('#side').innerHTML,/残り\d枚/);
   if(!order.has(g.round))order.set(g.round,[]);order.get(g.round).push(g.current);
   const id=g.current,half=g.round<=6?0:1,before=g.players[id].hand.length,round=g.round;
   t.run();
   if(!(round===6&&g.phase==='placement'))assert.ok(g.players[id].hand.length===before||g.players[id].hand.length===before-1);
   for(const p of g.players)for(const c of supply)assert.equal(p.hand.filter(x=>x===c).length+p.usedCards.filter(x=>x===c).length,supply.filter(x=>x===c).length);
   if(half===0&&g.phase==='placement')assert.ok(g.players.every(p=>p.hand.join()===supply.join()&&p.usedCards.length===0));
  }else t.run();
 }
 for(const [round,ids] of order)assert.deepEqual(ids,Array.from({length:count},(_,i)=>(i+round-1)%count));
 assert.equal(Object.keys(g.stars).length,3*count);
 console.log('PASS finite/public '+count+'p '+size+': consumed cards, no random refill, equal turns, exact cyclic order, midgame reset, legal CPU completion');
}
// Two uses exhaust jump. A third attempt must not consume another card, and
// the disabled zero-count action stays visible under its stable card label.
{
 const {t,nodes}=make(2,7),g=t.get();g.phase='play';g.locked=false;g.walls={};g.stars={};g.players[0].pos=8;
 for(let k=0;k<2;k++){g.actions=0;t.selectCard(g.players[0].hand.indexOf('jump'));t.startJump(1,1);}
 assert.equal(g.players[0].hand.filter(x=>x==='jump').length,0);assert.equal(g.players[0].usedCards.filter(x=>x==='jump').length,2);
 g.actions=0;t.render();assert.match(nodes.get('#side').innerHTML,/data-card="-1" disabled/);const before=g.players[0].hand.join();t.selectCard(-1);assert.equal(g.active,null);assert.equal(g.players[0].hand.join(),before);
 console.log('PASS exhausted card cannot spend a different card; zero stock is visible and disabled');
}
