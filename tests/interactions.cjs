// Run: node tests/interactions.cjs
// Interaction regressions for Star Maze STANDARD browser-only prototype.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const script=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8');

function create(){
  const names=['main','#board','#status','#score','#side','#log','#handoff','#modaltitle','#modaltext','#reveal','#playerCount','#boardSize'];
  const nodes=Object.fromEntries(names.map(k=>[k,{style:{setProperty(){}},addEventListener(){},innerHTML:'',hidden:false,textContent:'',value:k==='#playerCount'?'2':'7'}]));
  const document={querySelector:k=>nodes[k],addEventListener(){}};
  const ctx={document,console};vm.createContext(ctx);
  vm.runInContext(script+'\nthis.__test={start,unlock,selectCard,moveWalk,startDash,startJump,forcedMove,inspectStar,emergencyBoost,emergencyReturn,blockedPublic,edge,knownStar,get:()=>G};',ctx);
  const t=ctx.__test;t.start();t.unlock();const g=t.get();
  g.phase='play';g.round=1;g.actions=0;g.active=null;g.current=0;
  g.players[0].pos=0;g.players[1].pos=48;g.walls={};g.stars={};
  return {t,g,nodes};
}
function test(name,fn){fn();console.log('PASS '+name);}

test('Dash stops at a claimed flag and claims a star at the stopping cell',()=>{
  const {t,g}=create();
  g.stars[2]={value:3,placer:0,claimed:null,seen:[0]};
  g.stars[3]={value:0,placer:1,claimed:1,seen:[1]};
  t.selectCard(2);t.startDash(1);
  assert.equal(g.players[0].pos,2);
  assert.equal(g.stars[2].claimed,0);
  assert.equal(g.actions,1);
});

test('Tractor beam gives the displaced player ownership of the landed star',()=>{
  const {t,g}=create();
  g.players[1].pos=1;g.stars[2]={value:3,placer:0,claimed:null,seen:[0]};
  t.selectCard(4);g.active.target=1;t.forcedMove(2);
  assert.equal(g.players[1].pos,2);
  assert.equal(g.stars[2].claimed,1);
});

test('Hidden solid wall reveals on contact and consumes one walking step',()=>{
  const {t,g}=create(),k=t.edge(0,1);
  g.walls[k]={a:0,b:1,kind:'solid',seen:[1],faceUp:false,placer:1};
  t.selectCard(0);t.moveWalk(1);
  assert.equal(g.players[0].pos,0);
  assert.equal(g.walls[k].faceUp,true);
  assert.equal(g.actions,1);
  assert.equal(g.active.remaining,1);
});

test('Jump crosses one hidden wall without revealing it',()=>{
  const {t,g}=create(),k=t.edge(0,1);
  g.walls[k]={a:0,b:1,kind:'solid',seen:[1],faceUp:false,placer:1};
  g.players[0].hand[2]='jump';
  t.selectCard(2);t.startJump(1,2);
  assert.equal(g.players[0].pos,2);
  assert.equal(g.walls[k].faceUp,false);
});

test('Scan privately learns a star without claiming or publicly exposing it',()=>{
  const {t,g}=create();
  g.stars[9]={value:3,placer:1,claimed:null,seen:[1]};
  assert.equal(t.knownStar(g.stars[9]),false);
  t.selectCard(3);t.inspectStar(9);
  assert.equal(t.knownStar(g.stars[9]),true);
  assert.equal(g.stars[9].claimed,null);
});

test('Emergency boost escapes four-sided blockade using a safe landing',()=>{
  const {t,g}=create();
  for(const pos of [1,7])g.stars[pos]={value:0,placer:1,claimed:1,seen:[1]};
  assert.equal(t.blockedPublic(g.players[0]),true);
  t.emergencyBoost(1);
  assert.equal(g.players[0].pos,2);
  assert.equal(g.actions,2);
});

test('Emergency return subtracts two points when boost has no destination',()=>{
  const {t,g}=create();
  for(const pos of [1,7,2,14])g.stars[pos]={value:0,placer:1,claimed:1,seen:[1]};
  t.emergencyReturn();
  assert.equal(g.players[0].penalty,2);
  assert.equal(g.actions,2);
});

console.log('7 interactive rule regressions passed.');