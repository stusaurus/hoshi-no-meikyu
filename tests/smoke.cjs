// Run with: node tests/smoke.cjs
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8');
function load(players,size) {
  const nodes={};
  for(const name of ['main','#board','#status','#score','#side','#log','#handoff','#modaltitle','#modaltext','#reveal','#playerCount','#boardSize']){
    nodes[name]={style:{setProperty(){}},addEventListener(){},innerHTML:'',hidden:false,textContent:'',value:name==='#playerCount'?String(players):String(size)};
  }
  const document={querySelector:name=>nodes[name],addEventListener(){}};
  const context={document,console};
  vm.createContext(context);
  vm.runInContext(source+'\nthis.__test={start,unlock,placeStar,placeWall,neighbor,edge,wallInitialAllowed,endTurn,get:()=>G};',context);
  return {t:context.__test,nodes};
}
function game(players,size){
  const {t}=load(players,size);
  t.start();let g=t.get(),steps=0;
  while(g.phase!=='ended'&&steps++<100){
    t.unlock();
    if(g.phase==='play'){t.endTurn();continue;}
    if(g.phase!=='placement')throw Error('Unknown phase '+g.phase);
    if(g.queue[0].type==='star'){
      let i=Array.from({length:size*size},(_,i)=>i).find(i=>!g.stars[i]&&!g.players.some(p=>Math.abs(Math.floor(i/size)-Math.floor(p.pos/size))+Math.abs(i%size-p.pos%size)<2));
      assert.notEqual(i,undefined,'Star placement must have a valid cell');
      t.placeStar(i);
    }else{
      let done=false;
      for(let i=0;i<size*size&&!done;i++)for(let d=0;d<4&&!done;d++){
        let j=t.neighbor(i,d);
        if(j<0||g.walls[t.edge(i,j)]||(g.placementPhase===0&&!t.wallInitialAllowed(i,j)))continue;
        g.dir=d;t.placeWall(i);done=true;
      }
      assert.ok(done,'Wall placement must have a valid edge');
    }
  }
  assert.equal(g.phase,'ended',players+' players '+size+'x'+size+' must reach end of round 6');
  assert.equal(Object.keys(g.stars).length,players*2+3);
  assert.equal(Object.keys(g.walls).length,players*2);
  assert.equal(g.round,6);
  return true;
}
for(const players of [2,3,4])for(const size of [7,8,9]){game(players,size);console.log('PASS',players,'players',size+'x'+size);}
console.log('9 setup-to-score smoke cases passed.');
