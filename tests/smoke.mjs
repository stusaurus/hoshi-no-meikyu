import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
const source=fs.readFileSync(new URL("../game.js",import.meta.url),"utf8");
let checks=0;
for(const count of [2,3,4])for(const size of [7,8,9]){
  const elements=new Map();
  function element(name){
    if(!elements.has(name))elements.set(name,{
      value:name==="#playerCount"?String(count):name==="#boardSize"?String(size):"",
      innerHTML:"",textContent:"",hidden:true,
      style:{visibility:"visible",setProperty(){}},
      addEventListener(){}
    });
    return elements.get(name);
  }
  const document={querySelector:element,addEventListener(){}};
  const ctx=vm.createContext({document,console,Math,Number,String,Object,Array});
  vm.runInContext(source,ctx);
  function run(code){return vm.runInContext(code,ctx)}
  run("start()");
  let iterations=0;
  while(run("G.phase")!=="ended"){
    if(++iterations>100)throw Error("game did not finish for "+count+" players on "+size+"x"+size);
    run("unlock()");
    if(run("G.phase")==="placement"){
      if(run('placementKind()')==="star"){
        const at=run('Array.from({length:G.n*G.n},(_,i)=>i).find(i=>!G.stars[i]&&!occupied(i,-1)&&G.players.every(p=>dist(i,p.pos)>=2))');
        assert.notEqual(at,undefined,"star placement available");
        run("placeStar("+at+")");
      }else{
        let placed=false;
        for(let i=0;i<size*size&&!placed;i++)for(let d=0;d<4&&!placed;d++){
          const before=run("G.queue.length");
          run("G.dir="+d+";placeWall("+i+")");
          placed=run("G.queue.length")<before;
        }
        assert.ok(placed,"wall placement available");
      }
    }else{
      // Smoke-test the card action and complete the round while keeping fixed hand intact.
      run("selectCard(0)");
      const current=run("G.players[G.current].pos");
      const next=run("Array.from({length:4},(_,d)=>neighbor(G.players[G.current].pos,d)).find(i=>i>=0)");
      if(next>=0)run("onCell("+next+")");
      run("finishWalk()");
      run("endTurn()");
    }
  }
  assert.equal(run("G.phase"),"ended");
  assert.equal(run("Object.keys(G.stars).length"),count*2+3);
  assert.equal(run("Object.keys(G.walls).length"),count*2);
  assert.ok(run("G.players.every(p=>p.hand.length===5)"),"hands replenish");
  checks++;
}
console.log("PASS "+checks+" sizes/player-count setups, placement phases, full game rounds and final reveal");