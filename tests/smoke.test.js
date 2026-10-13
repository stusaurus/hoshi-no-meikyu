// Run: node tests/smoke.test.js
// Uses only built-in Node.js. Tests the exact game.js used in the browser.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8');
function createHarness(players,size){
 const nodes=new Map();
 function el(key){
  if(!nodes.has(key))nodes.set(key,{
   value:key==='#playerCount'?String(players):key==='#boardSize'?String(size):'',
   innerHTML:'',hidden:true,textContent:'',style:{visibility:'visible',setProperty(){}},addEventListener(){}
  });
  return nodes.get(key);
 }
 const document={querySelector:el,addEventListener(){}};
 const api=new Function('document',src+'\nreturn {start,unlock,placeStar,placeWall,endTurn,selectCard,moveWalk,step,dist,neighbor,knownStar,knownWall,get:()=>G}')(document);
 api.start();
 return api;
}
function setup(api){
 for(let tries=0;tries<24&&api.get().phase==='placement';tries++){
  api.unlock();
  const G=api.get(),step=G.queue[0],before=G.queue.length;
  if(step.type==='star'){
   const spot=Array.from({length:G.n*G.n},(_,i)=>i)
     .find(i=>!G.stars[i]&&!G.players.some(p=>p.pos===i)&&G.players.every(p=>api.dist(p.pos,i)>=2));
   assert.notEqual(spot,undefined,'star placement available');
   api.placeStar(spot);
  }else{
   let done=false;
   for(let cell=0;cell<G.n*G.n&&!done;cell++){
    for(let dir=0;dir<4&&!done;dir++){
     G.dir=dir;
     const next=api.neighbor(cell,dir);
     if(next<0)continue;
     api.placeWall(cell);
     if(G.queue.length<before)done=true;
    }
   }
   assert(done,'wall placement available');
  }
 }
 assert.equal(api.get().phase,'play','setup completes');
}
let checked=0;
for(const players of [2,3,4])for(const size of [7,8,9]){
 const api=createHarness(players,size);
 setup(api);
 const G=api.get();
 assert.equal(G.players.length,players);
 assert.equal(Object.keys(G.stars).length,players*2+3);
 assert.equal(Object.keys(G.walls).length,players);
 const privateStar=Object.values(G.stars).find(s=>s.placer!==null);
 assert(privateStar);
 G.current=privateStar.placer;
 assert(api.knownStar(privateStar),'placer sees own star');
 G.current=(privateStar.placer+1)%players;
 assert(!api.knownStar(privateStar),'opponent does not see private star');
 G.current=0;
 let limit=0;
 while(G.phase!=='ended'&&limit++<150){
  if(G.phase==='placement'){setup(api);continue}
  api.unlock();
  api.endTurn();
 }
 assert.equal(G.phase,'ended','six rounds conclude');
 const scores=G.players.map(p=>Object.values(G.stars).filter(s=>s.claimed===p.id).reduce((sum,s)=>sum+s.value,0)-p.penalty);
 assert(scores.every(Number.isFinite));
 checked++;
}
{
 const api=createHarness(2,7);setup(api);
 const G=api.get(),p=G.players[0];
 const next=api.neighbor(p.pos,1);
 assert(next>=0);
 G.stars[next]={value:3,placer:null,claimed:1,seen:[]};
 const before=p.pos,resp=api.step(p,next,'walk');
 assert(resp.blocked&&p.pos===before,'claimed star flag blocks walking');
}
console.log('PASS '+checked+' setups and six-round finishes, secrets, flags');
