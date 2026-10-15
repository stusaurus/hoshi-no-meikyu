'use strict';
// Experiments execute the production engine in an isolated VM. They do not
// change the public game's rules or give planners unseen wall identities.
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const sourceRoot=process.env.STAR_MAZE_BALANCE_SOURCE||'docs/balance-2026-10-15/source';
const gameSource=fs.readFileSync(sourceRoot+'/game.js','utf8'),cpuSource=fs.readFileSync(sourceRoot+'/cpu.js','utf8');
const supply=['walk','walk','dash','dash','jump','jump','scan','tractor'];
const variants=['unlimited-fixed','finite-fixed','unlimited-cyclic','finite-cyclic','unlimited-snake','finite-snake','finite-phase','finite-halves'];
function replaceOnce(s,a,b){if(s.split(a).length!==2)throw Error('Adapter anchor changed: '+a);return s.replace(a,b);}
function make({count,size,seed,seat=0,identity=0,variant='unlimited-fixed',policy='collect',opening='varied',halfTurns=6}){
 if(!Number.isInteger(halfTurns)||halfTurns<3||halfTurns>6)throw Error('Invalid half turn budget');
 if(!variants.includes(variant))throw Error('Unknown variant');
 const finite=variant.startsWith('finite'),order=variant.split('-')[1];
 let source=gameSource,cpu=cpuSource,x=seed>>>0;const math=Object.create(Math);math.random=()=>((x=(Math.imul(x,1664525)+1013904223)>>>0)/4294967296);
 if(finite)source=replaceOnce(source,'let c=strategy()?p.hand[a.index]:p.hand.splice(a.index,1)[0];','let c=p.hand.splice(a.index,1)[0];');
 // Memoize within a choice only; all caches clear before the next decision.
 cpu=replaceOnce(cpu,'function publicDistance(','function uncachedPublicDistance(');
 cpu=replaceOnce(cpu,'function targets(id)',`const distances=new Map();function publicDistance(a,b,id){const key=a+':'+b+':'+id;if(!distances.has(key))distances.set(key,uncachedPublicDistance(a,b,id));return distances.get(key);}
 function targets(id)`);
 cpu=replaceOnce(cpu,'function chooseAction(){','function chooseAction(){distances.clear();');
 cpu=replaceOnce(cpu,'function placeCPU(){','function placeCPU(){distances.clear();');
 // Diverse legal placement choices stand in for players' choices, not new
 // random game rules. Current geometry/placement is retained by opening=web.
 if(opening==='varied'){
  cpu=replaceOnce(cpu,'placeStar(scored[0].at);',`const near=scored.filter(o=>o.score>=scored[0].score-1);placeStar(near[Math.floor(Math.random()*Math.min(near.length,4))].at);`);
  cpu=replaceOnce(cpu,'G.dir=candidates[0].d;placeWall(candidates[0].at);',`const near=candidates.filter(o=>o.score>=candidates[0].score-1),pick=near[Math.floor(Math.random()*Math.min(near.length,6))];G.dir=pick.d;placeWall(pick.at);`);
 }
 if(opening==='contested'){
  cpu=replaceOnce(cpu,'placeStar(scored[0].at);',`scored.forEach(o=>{const ours=dist(pl.pos,o.at),rival=Math.min(...G.players.filter(p=>p.id!==pl.id).map(p=>dist(p.pos,o.at))),center=(n*n-1)/2;o.score=-Math.abs(ours-rival)*3-dist(o.at,Math.floor(center));});scored.sort((a,b)=>b.score-a.score||a.at-b.at);const near=scored.filter(o=>o.score>=scored[0].score-1);placeStar(near[Math.floor(Math.random()*Math.min(near.length,4))].at);`);
 }
 const adaptation=`const policy=pl.simPolicy||'collect';
 for(const o of opts){
  let pos=null;
  if(o.type==='walk')pos=o.steps.at(-1);
  if(o.type==='jump'){pos=pl.pos;for(let k=0;k<o.len;k++)pos=neighbor(pos,o.d);}
  if(o.type==='dash'){pos=pl.pos;for(let k=0;k<G.n;k++){const j=neighbor(pos,o.d);if(!safeStep(pos,j,id))break;pos=j;}}
  if(policy==='value'&&pos!==null){
   const s=G.stars[pos];if(s&&s.claimed===null)o.score+=35*s.value;
   const future=targets(id).filter(s=>s.pos!==pos).map(s=>s.score/(publicDistance(pos,s.pos,id)+1));
   if(future.length)o.score+=12*Math.max(...future);
   if(o.card==='jump'&&pl.hand.filter(c=>c==='jump').length===1&&G.round<${halfTurns})o.score-=6;
  }
  if(policy==='control'&&o.type==='tractor'){
   const rival=G.players[o.target],score=playerPoints(rival),mine=playerPoints(pl);
   o.score+=Math.max(0,score-mine)*2+(o.score>1?12:0);
  }
  if(policy==='control'&&pos!==null){
   const s=G.stars[pos];if(s&&s.claimed===null){
    const rivals=G.players.filter(p=>p.id!==id);o.score+=rivals.filter(p=>dist(p.pos,pos)<=2).length*7;
   }
  }
  if(policy==='random')o.score=Math.random();
 }
 opts.sort((a,b)=>b.score-a.score||a.i-b.i);`;
 cpu=replaceOnce(cpu,'opts.sort((a,b)=>b.score-a.score||a.i-b.i);',adaptation);
 const nodes=new Map(),errors=[];function el(k){if(!nodes.has(k))nodes.set(k,{style:{setProperty(){}},addEventListener(){},hidden:false,innerHTML:'',textContent:'',value:k==='#gameSet'?'strategy':k==='#playMode'?'cpu'+count:k==='#boardSize'?String(size):k==='#playerCount'?String(count):''});return nodes.get(k);}
 const ctx=vm.createContext({Math:math,document:{querySelector:el,addEventListener(){}},window:{setTimeout(){}},console:{log(){},error(...a){errors.push(a.join(' '));}}});
 const bridge=`
 render=()=>{};
 this.metrics={actions:[],claims:[],rescues:[],roundScores:[]};
 function simOrder(){let ids=G.players.map(p=>p.id);if('${order}'==='cyclic'){const first=(G.round-1)%G.nplayers;ids=ids.map(i=>(i+first)%G.nplayers);}else if('${order}'==='phase'){if(G.round<=${halfTurns}){const first=(G.round-1)%G.nplayers;ids=ids.map(i=>(i+first)%G.nplayers);}else{const first=(G.nplayers-1-(G.round-${halfTurns+1})%G.nplayers+G.nplayers)%G.nplayers;ids=ids.map(i=>(first-i+G.nplayers)%G.nplayers);}}else if('${order}'==='halves'&&G.round>${halfTurns})ids.reverse();else if('${order}'==='snake'&&G.round%2===0)ids.reverse();return ids;}
 const originalNext=nextPlacement;nextPlacement=function(){const done=!G.queue.length;originalNext();if(done&&G.phase==='play'){G.simTurn=0;G.current=simOrder()[0];}};
 const originalPlacement=beginPlacement;beginPlacement=function(phase){if(phase===1&&${finite})G.players.forEach(p=>p.hand=${JSON.stringify(supply)}.slice());originalPlacement(phase);};
 endFixedTurn=function(){
  if(G.phase!=='play')return;
  if(G.active&&G.active.committed)finishAction(G.players[G.current],true);
  G.active=null;G.message='';G.privateMessage='';G.simTurn=(G.simTurn||0)+1;
  if(G.simTurn>=G.nplayers){
   metrics.roundScores.push({round:G.round,scores:G.players.map(playerPoints)});
   if(G.round>=${halfTurns*2}||(G.round>=${halfTurns+1}&&Object.values(G.stars).every(s=>s.claimed!==null))){finishGame();return;}
   G.round++;G.simTurn=0;
   if(G.round===${halfTurns+1}){beginPlacement(1);return;}
  }
  G.current=simOrder()[G.simTurn];G.actions=0;handoff();
 };
 const originalClaim=claim;claim=function(p){const s=G.stars[p.pos],newClaim=s&&s.claimed===null;originalClaim(p);if(newClaim&&s.claimed===p.id)metrics.claims.push({id:p.id,value:s.value,pos:p.pos,round:G.round});};
 const originalFinish=finishAction;finishAction=function(p,move){const a=G.active,id=G.current,before=metrics.claims.length,valid=a&&a.committed,card=a&&a.card;originalFinish(p,move);if(valid)metrics.actions.push({id,card,round:G.round,points:metrics.claims.slice(before).filter(s=>s.id===id).reduce((n,s)=>n+s.value,0)});};
 const originalBoost=emergencyBoost;emergencyBoost=function(d){const id=G.current,before=G.actions;originalBoost(d);if(G.actions>before)metrics.rescues.push({id,round:G.round,type:'boost'});};
 const originalReturn=emergencyReturn;emergencyReturn=function(){const id=G.current,before=G.actions;originalReturn();if(G.actions>before)metrics.rescues.push({id,round:G.round,type:'return'});};
 this.t={start,get:()=>G,run:window.StarMazeCPU.run,choose:window.StarMazeCPU.chooseAction,score:()=>G.players.map(playerPoints),order:simOrder,beginPlacement,selectCard,startJump,finishWalk,moveWalk,endTurn,inspectStar,inspectWall};
 `;
 vm.runInContext(source+'\n'+cpu+bridge,ctx);ctx.t.start();const g=ctx.t.get(),starts=g.players.map(p=>p.pos),walls=g.players.map(p=>p.walls.slice());
 const frontPatterns=[[1,2,3],[1,3,2],[2,3,1]],front=opening==='web'?frontPatterns[0]:frontPatterns[seed%3];
 const identities=g.players.map((p,i)=>(i+identity)%count);
 g.players.forEach((p,i)=>{p.cpu=true;p.pos=starts[(identities[i]+seat)%count];p.home=p.pos;p.walls=walls[identities[i]].slice();p.stars=front.slice();p.hand=finite?supply.slice():p.hand;p.simPolicy=policy==='duel'?['value','random'][identities[i]%2]:policy==='mixed'?['collect','value','control','random'][identities[i]]:policy;});
 return {ctx,t:ctx.t,g,errors,finite,identities,front,variant,seed,seat,identity,policy,opening,halfTurns};
}
function play(options){
 const h=make(options),{g,t,ctx,errors,finite}=h;let ticks=0,openingKey=null;const turns=[];
 while(g.phase!=='ended'){
  if(++ticks>400)throw Error('Nontermination');
  const phase=g.phase,round=g.round,id=g.current,actionsBefore=ctx.metrics.actions.length,rescuesBefore=ctx.metrics.rescues.length,handBefore=g.players[id].hand.length;
  if(phase==='play'&&!openingKey)openingKey=crypto.createHash('sha256').update(JSON.stringify({pos:g.players.map(p=>p.pos),walls:g.walls,stars:g.stars})).digest('hex');
  t.run();if(errors.length)throw Error(errors[0]);
  if(phase==='play'){
   const cards=ctx.metrics.actions.length-actionsBefore,rescues=ctx.metrics.rescues.length-rescuesBefore;
   if(cards+rescues>1)throw Error('More than one action in a turn');
   const expected=finite?handBefore-cards:5;
   // Middle setup refills all finite hands immediately after the last turn.
   if(!(finite&&round===h.halfTurns&&g.phase==='placement')&&g.players[id].hand.length!==expected)throw Error('Card conservation');
   turns.push({id,round,cards,rescues,pass:cards+rescues===0,handBefore});
  }
 }
 const scores=t.score(),best=Math.max(...scores),winners=scores.flatMap((s,i)=>s===best?[i]:[]),sorted=scores.slice().sort((a,b)=>b-a);
 const stars=Object.values(g.stars),claims=JSON.parse(JSON.stringify(ctx.metrics.claims)),rescues=JSON.parse(JSON.stringify(ctx.metrics.rescues));
 if(stars.length!==g.nplayers*3||stars.reduce((n,s)=>n+s.value,0)!==g.nplayers*6)throw Error('Equal 1/2/3 star supply');
 if(scores.reduce((a,b)=>a+b,0)!==claims.reduce((n,c)=>n+c.value,0)-2*rescues.filter(r=>r.type==='return').length)throw Error('Score conservation');
 for(let r=1;r<=g.round;r++){const ids=turns.filter(t=>t.round===r).map(t=>t.id);if(new Set(ids).size!==g.nplayers||ids.length!==g.nplayers)throw Error('Unequal turns');}
 const actions=JSON.parse(JSON.stringify(ctx.metrics.actions));
 for(let id=0;id<g.nplayers;id++)for(const half of [0,1])if(finite){for(const c of ['walk','dash','jump','scan','tractor']){const n=actions.filter(a=>a.id===id&&(a.round>h.halfTurns?1:0)===half&&a.card===c).length;if(n>supply.filter(x=>x===c).length)throw Error('Per-half finite card budget exceeded');}}
 let repeated=0,transitions=0;for(let id=0;id<g.nplayers;id++){const seq=actions.filter(a=>a.id===id);for(let i=1;i<seq.length;i++){transitions++;if(seq[i].card===seq[i-1].card)repeated++;}}
 const halves=JSON.parse(JSON.stringify(ctx.metrics.roundScores)),mid=halves.find(r=>r.round===h.halfTurns),midLeaders=mid?mid.scores.flatMap((v,i)=>v===Math.max(...mid.scores)?[i]:[]):[];
 return {count:g.nplayers,size:g.n,...Object.fromEntries(['variant','seed','seat','identity','policy','opening','halfTurns','identities','front'].map(k=>[k,h[k]])),round:g.round,scores,winners,margin:sorted[0]-sorted[1],capture:claims.length/stars.length,placedStars:Object.entries(g.stars).map(([pos,s])=>({pos:Number(pos),value:s.value,placer:s.placer,claimed:s.claimed})),openingKey,turns,actions,claims,rescues,roundScores:halves,repeated,transitions,midReversal:midLeaders.length?Number(!winners.some(i=>midLeaders.includes(i))):null};
}
module.exports={make,play,supply,variants,sourceHashes:{game:crypto.createHash('sha256').update(gameSource).digest('hex'),cpu:crypto.createHash('sha256').update(cpuSource).digest('hex')}};
