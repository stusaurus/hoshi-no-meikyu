// Run: node tests/cpu.cjs
// Beginner CPU end-to-end game loop for 2-4 participants and 7/8/9 boards.
// The CPU must not read unseen star points or secret wall types to plan.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const game=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8');
const bot=fs.readFileSync(path.join(__dirname,'..','cpu.js'),'utf8');
const names=['main','#board','#status','#score','#side','#log','#handoff','#modaltitle','#modaltext','#reveal','#playerCount','#boardSize','#playMode'];
function make(players,size,seed){
  const nodes=Object.fromEntries(names.map(k=>[k,{
    style:{setProperty(){}},addEventListener(){},innerHTML:'',textContent:'',hidden:false,
    value:k==='#playerCount'?String(players):k==='#boardSize'?String(size):k==='#playMode'?'cpu'+players:''
  }]));
  const tasks=[],errors=[],math=Object.create(Math);
  let x=seed;
  math.random=()=>{x=(x*1664525+1013904223)>>>0;return x/4294967296;};
  const context=vm.createContext({
    document:{querySelector:k=>nodes[k],addEventListener(){}},
    window:{setTimeout:f=>tasks.push(f)},
    console:{error:(...args)=>errors.push(args.map(String).join(' ')),log:()=>{}},
    Math:math
  });
  vm.runInContext(game+'\n'+bot+'\nthis.harness={start,unlock,placeStar,placeWall,neighbor,edge,wallInitialAllowed,endTurn,get:()=>G,ai:window.StarMazeCPU};',context);
  return {t:context.harness,tasks,errors};
}
function placeHuman(t){
  const G=t.get(),n=G.n,initial=G.placementPhase===0;
  assert.equal(G.current,0,'Only the first player is human in CPU mode');
  if(G.queue[0].type==='star'){
    const at=Array.from({length:n*n},(_,i)=>i).find(i=>!G.stars[i]&&!G.players.some(p=>Math.abs(Math.floor(i/n)-Math.floor(p.pos/n))+Math.abs(i%n-p.pos%n)<2));
    assert.notEqual(at,undefined,'Human star placement available');
    t.placeStar(at);
  }else{
    let done=false;
    for(let i=0;i<n*n&&!done;i++)for(let d=0;d<4&&!done;d++){
      const j=t.neighbor(i,d);
      if(j<0||G.walls[t.edge(i,j)]||initial&&!t.wallInitialAllowed(i,j))continue;
      const before=G.queue.length;G.dir=d;t.placeWall(i);done=G.queue.length<before;
    }
    assert.ok(done,'Human wall placement available');
  }
}
let finished=0;
for(const players of [2,3,4])for(const size of [7,8,9])for(const seed of [41,93]){
  const {t,tasks,errors}=make(players,size,seed);t.start();
  assert.equal(t.get().nplayers,players);
  assert.equal(t.get().players[0].cpu,false);
  assert.ok(t.get().players.slice(1).every(p=>p.cpu));
  const hidden={value:0,placer:0,seen:[]};
  assert.equal(t.ai.unknownValue(hidden,1),1.45,'Zero-point hidden stars remain unknown to CPU');
  hidden.value=3;
  assert.equal(t.ai.unknownValue(hidden,1),1.45,'Three-point hidden stars remain unknown to CPU');
  assert.equal(t.ai.unknownValue(hidden,0),3,'Placer can see own stars');
  assert.equal(t.ai.wallVisible({faceUp:false,seen:[0]},1),false,'CPU cannot see unseen wall type');
  t.ai.wallVisible({faceUp:true,seen:[]},1);
  let iterations=0,cpuSteps=0;
  while(t.get().phase!=='ended'&&iterations++<300){
    const G=t.get(),p=G.players[G.current];
    if(p.cpu){
      assert.ok(tasks.length,'CPU must schedule a turn after handoff');
      tasks.shift()();cpuSteps++;continue;
    }
    if(G.locked)t.unlock();
    if(G.phase==='placement')placeHuman(t);
    else if(G.phase==='play')t.endTurn();
    else throw Error('Unexpected phase '+G.phase);
  }
  assert.equal(errors.length,0,'No CPU runtime errors: '+errors.join(' | '));
  assert.equal(t.get().phase,'ended','CPU match must finish');
  assert.equal(Object.keys(t.get().stars).length,players*2+3);
  assert.equal(Object.keys(t.get().walls).length,players*2);
  assert.ok(cpuSteps>=players-1,'Each bot must act');
  assert.ok(t.get().players.every(p=>p.hand.length<=5),'Hands must remain bounded');
  assert.ok(Object.values(t.get().stars).some(s=>s.claimed!==null&&s.claimed>0),'CPU must claim stars in tested scenarios');
  finished++;
  console.log('PASS '+players+' players '+size+'×'+size+' seed '+seed+' ('+cpuSteps+' CPU steps)');
}
console.log(finished+' CPU match scenarios and unseen-information assertions passed.');