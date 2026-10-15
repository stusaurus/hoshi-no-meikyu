// Verify two isolated rulesets and that STARTER can actually finish CPU games.
// Run node tests/starter.cjs
"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict");
const game=fs.readFileSync(path.join(__dirname,"..","game.js"),"utf8");
const cpu=fs.readFileSync(path.join(__dirname,"..","cpu.js"),"utf8");
const keys=["main","#board","#status","#score","#side","#log","#handoff","#modaltitle","#modaltext","#reveal","#playerCount","#boardSize","#playMode","#gameSet","#backToTitle","#backFromHandoff"];
function make(players,size,set,seed){
 const nodes=Object.fromEntries(keys.map(k=>[k,{style:{setProperty(){}},hidden:false,innerHTML:"",textContent:"",
    value:k==="#boardSize"?String(size):k==="#playerCount"?String(players):k==="#playMode"?"cpu"+players:k==="#gameSet"?set:"",addEventListener(){}}]));
 const tasks=[],errors=[];let x=seed>>>0,math=Object.create(Math);
 math.random=()=>((x=(Math.imul(x,1664525)+1013904223)>>>0)/4294967296);
 const context=vm.createContext({document:{querySelector:k=>nodes[k],addEventListener(){}},
    window:{setTimeout:fn=>tasks.push(fn)},Math:math,console:{error:(...args)=>errors.push(args.join(" ")),log(){}}});
 vm.runInContext(game+"\n"+cpu+"\nthis.h={start,get:()=>G,unlock,placeStar,placeWall,edge,neighbor,wallInitialAllowed,endTurn,draw,discardCard}",context);
 return {api:context.h,tasks,errors};
}
function humanMove(api){
 const g=api.get(),n=g.n;
 if(g.locked)api.unlock();
 if(g.phase==="placement"){
  if(g.queue[0].type==="star"){
   const i=Array.from({length:n*n},(_,i)=>i).find(i=>!g.stars[i]&&g.players.every(p=>Math.abs(Math.floor(i/n)-Math.floor(p.pos/n))+Math.abs(i%n-p.pos%n)>=2));
   assert.notEqual(i,undefined);api.placeStar(i);
  }else{
   let done=false;
   for(let i=0;i<n*n&&!done;i++)for(let d=0;d<4&&!done;d++){
    const j=api.neighbor(i,d);if(j<0||g.walls[api.edge(i,j)]||g.placementPhase===0&&!api.wallInitialAllowed(i,j))continue;
    const before=g.queue.length;g.dir=d;api.placeWall(i);done=g.queue.length<before;
   }assert.ok(done,"wall placement must be possible");
  }
 }else if(g.phase==="play")api.endTurn();
}
const allowedStarterCards=new Set(["walk","dash","jump","scan","tractor"]);
const allowedStarterWalls=new Set(["solid","bounce","phantom"]);
let games=0;
for(const mode of ["starter","standard"])for(const players of [2,3,4])for(const size of [7,8,9]){
 const {api,tasks,errors}=make(players,size,mode,12345+players*4000+size*79);api.start();const g=api.get();
 assert.equal(g.ruleset,mode);
 if(mode==="starter"){
  assert.equal(g.deck.length,0,"starter must not have a mixed draw pile");
  assert.equal(g.discard.length,0,"starter must not have a mixed discard pile");
  assert.ok(g.moveDeck.every(c=>allowedStarterCards.has(c)&&["walk","dash","jump"].includes(c)));
  assert.ok(g.effectDeck.every(c=>allowedStarterCards.has(c)&&["scan","tractor"].includes(c)));
  assert.ok(g.players.every(p=>p.hand.filter(c=>["walk","dash","jump"].includes(c)).length===3));
  assert.ok(g.players.every(p=>p.hand.filter(c=>["scan","tractor"].includes(c)).length===2));
  assert.ok(g.players.every(p=>p.walls.every(w=>allowedStarterWalls.has(w))));
  const cards=[...g.moveDeck,...g.effectDeck,...g.players.flatMap(p=>p.hand)];
  assert.equal(cards.length,44,"starter should have 44 cards split across the two decks and hands");
  const kinds=Object.fromEntries([...allowedStarterCards].map(c=>[c,cards.filter(x=>x===c).length]));
  assert.deepEqual(kinds,{walk:16,dash:10,jump:6,scan:6,tractor:6});
 }else{
  assert.equal(g.deck.length+g.players.reduce((sum,p)=>sum+p.hand.length,0),48);
  assert.ok(g.players.some(p=>p.walls.some(w=>w==="oneway"))||g.players.some(p=>p.walls.length===2),"standard enabled");
 }
 let iter=0;
 while(g.phase!=="ended"&&iter++<260){
  if(errors.length)throw Error(errors.join(" | "));
  if(g.players[g.current].cpu){
   assert.ok(tasks.length,"CPU callback available");
   tasks.shift()();
  }else humanMove(api);
  if(mode==="starter"){
   const move=c=>["walk","dash","jump"].includes(c),effect=c=>["scan","tractor"].includes(c);
   assert.ok([...g.players.flatMap(p=>p.hand),...g.moveDeck,...g.effectDeck,...g.moveDiscard,...g.effectDiscard].every(c=>allowedStarterCards.has(c)),"No advanced cards can enter starter game");
   assert.ok(g.moveDeck.every(move)&&g.moveDiscard.every(move),"Movement pile and discards contain only movement");
   assert.ok(g.effectDeck.every(effect)&&g.effectDiscard.every(effect),"Effect pile and discards contain only effects");
   assert.ok(g.players.every(p=>p.hand.filter(move).length<=3&&p.hand.filter(effect).length<=2),"Hand slots are separate");
   assert.equal(g.deck.length+g.discard.length,0,"Mixed STANDARD pile is unused");
   assert.equal(g.moveDeck.length+g.effectDeck.length+g.moveDiscard.length+g.effectDiscard.length+g.players.reduce((sum,p)=>sum+p.hand.length,0),44,"Physical card count conserved");
   assert.ok(Object.values(g.walls).every(w=>allowedStarterWalls.has(w.kind)),"No one-way walls in starter");
  }
 }
 assert.equal(g.phase,"ended",mode+" "+players+"p "+size+"x"+size+" did not finish");
 assert.equal(errors.length,0,"CPU errors: "+errors.join("|"));
 assert.equal(Object.keys(g.stars).length,players*2+3);
 assert.equal(Object.keys(g.walls).length,players*2);
 console.log("PASS",mode,players+"p",size+"×"+size);
 games++;
}
// Edge case: starter reshuffles each discard pile independently and never changes the other one.
{
 const {api}=make(2,7,"starter",777);api.start();const g=api.get(),p=g.players[0];
 const beforeEffectDeck=g.effectDeck.slice();
 const beforeEffectDiscard=g.effectDiscard.slice();
 g.moveDeck=[]; // Simulate end-of-pile immediately before replenishment.
 const spare=p.hand.find(c=>["walk","dash","jump"].includes(c));
 p.hand.splice(p.hand.indexOf(spare),1);
 api.discardCard(spare);
 api.draw(p,1);
 assert.equal(p.hand.filter(c=>["walk","dash","jump"].includes(c)).length,3);
 assert.equal(g.effectDeck.join(","),beforeEffectDeck.join(","));
 assert.equal(g.effectDiscard.join(","),beforeEffectDiscard.join(","));
 assert.equal(g.moveDiscard.length,0,"Move discard recycled in move deck only");
 // Now consume an effect card and verify a different group is used.
 const spareEffect=p.hand.find(c=>["scan","tractor"].includes(c));
 p.hand.splice(p.hand.indexOf(spareEffect),1);
 api.discardCard(spareEffect);
 const currentMove=g.moveDeck.slice(),currentMoveDiscard=g.moveDiscard.slice();
 api.draw(p,1);
 assert.equal(p.hand.filter(c=>["scan","tractor"].includes(c)).length,2);
 assert.equal(g.moveDeck.join(","),currentMove.join(","));
 assert.equal(g.moveDiscard.join(","),currentMoveDiscard.join(","));
}
console.log("PASS separate deck reshuffle and independent 3+2 top-up");
console.log("PASS "+games+" STARTER and STANDARD CPU games");
