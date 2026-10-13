/* Beginner CPU for the local prototype.
   Only the current CPU's own/observed star scores and revealed/observed wall kinds
   may inform decisions. Unseen contents must be treated as unknown. */
(function(){
"use strict";
const CARD_CPU={walk:"てくてく",dash:"流星ダッシュ",jump:"ジェットジャンプ",scan:"宇宙探査",tractor:"トラクタービーム",wallmove:"壁の移動",pull:"星の引力",shield:"宇宙バリア"};
function cpu(){return G&&G.players[G.current]&&G.players[G.current].cpu;}
function unknownValue(s,viewer){
 return (s.placer===viewer||s.seen.includes(viewer))?s.value:1.45;
}
function wallVisible(w,viewer){return w.faceUp||w.seen.includes(viewer);}
function safeStep(pos,next,id){
 if(next<0||isFlag(next)||occupied(next,id))return false;
 const w=G.walls[edge(pos,next)];
 if(!w||!wallVisible(w,id))return true;
 if(w.kind==="solid"||w.kind==="bounce")return false;
 if(w.kind==="oneway"&&pos!==w.a)return false;
 return true;
}
function publicDistance(start,goal,id){
 if(start===goal)return 0;
 const seen=new Set([start]),queue=[[start,0]];
 for(let j=0;j<queue.length;j++){
  const [pos,cost]=queue[j];
  for(let d=0;d<4;d++){
   const next=neighbor(pos,d);
   if(next<0||seen.has(next)||!safeStep(pos,next,id))continue;
   if(next===goal)return cost+1;
   seen.add(next);queue.push([next,cost+1]);
  }
 }
 return G.n*G.n;
}
function targets(id){return Object.entries(G.stars).filter(([_,s])=>s.claimed===null).map(([pos,s])=>({pos:Number(pos),score:unknownValue(s,id)}));}
function strategicDistance(pos,id){
 const stars=targets(id);
 if(!stars.length)return 0;
 let best=Infinity;
 for(const s of stars){
  const d=publicDistance(pos,s.pos,id);
  const v=(d+1)/(0.85+s.score*0.28);
  if(v<best)best=v;
 }
 return best;
}
function positionUtility(from,to,id){
 const star=G.stars[to];
 const landing=star&&star.claimed===null;
 let progress=(strategicDistance(from,id)-strategicDistance(to,id))*15;
 if(landing)progress+=70+unknownValue(star,id)*14;
 return progress;
}
function candidateMoves(id){
 const pos=G.players[id].pos,hand=G.players[id].hand,out=[];
 for(let i=0;i<hand.length;i++){
  const card=hand[i];
  if(card==="walk"){
   for(let d=0;d<4;d++){
    const a=neighbor(pos,d);
    if(!safeStep(pos,a,id))continue;
    out.push({card,i,type:"walk",steps:[a],score:positionUtility(pos,a,id)+1});
    if(starAt(a))continue; // May stop on a star before a second step
    for(let d2=0;d2<4;d2++){
     const b=neighbor(a,d2);
     if(b===pos||!safeStep(a,b,id))continue;
     out.push({card,i,type:"walk",steps:[a,b],score:positionUtility(pos,b,id)+1.5});
    }
   }
  }
  if(card==="dash"){
   for(let d=0;d<4;d++){
    let cur=pos,uncertain=0;
    for(let j=0;j<G.n;j++){
     const next=neighbor(cur,d);
     if(next===-1||!safeStep(cur,next,id))break;
     const w=G.walls[edge(cur,next)];
     if(w&&!wallVisible(w,id))uncertain++;
     cur=next;
    }
    if(cur!==pos)out.push({card,i,type:"dash",d,score:positionUtility(pos,cur,id)+.5-uncertain*1.2});
   }
  }
  if(card==="jump"){
   for(let d=0;d<4;d++)for(let len=1;len<=2;len++){
    let cur=pos,blockers=0,possible=true;
    for(let j=0;j<len;j++){
     const next=neighbor(cur,d);
     if(next<0){possible=false;break;}
     if(G.walls[edge(cur,next)])blockers++;
     if(j<len-1&&(isFlag(next)||occupied(next,id)))blockers++;
     cur=next;
    }
    if(possible&&blockers<=1&&free(cur,id)){
     out.push({card,i,type:"jump",d,len,score:positionUtility(pos,cur,id)+.2+blockers*.4});
    }
   }
  }
 }
 return out;
}
function candidatePull(id){
 const pl=G.players[id],from=pl.pos,stars=targets(id),result=[];
 const idx=pl.hand.indexOf("pull");if(idx<0)return result;
 for(const s of stars){
  for(let d=0;d<4;d++){
   const next=neighbor(s.pos,d);
   if(next<0||G.stars[next]||occupied(next,-1)||isFlag(next))continue;
   const before=publicDistance(from,s.pos,id),after=publicDistance(from,next,id);
   const benefit=(before-after)*6;
   if(benefit>0)result.push({card:"pull",type:"pull",i:idx,from:s.pos,to:next,score:benefit+2});
  }
 }
 return result;
}
function candidateScan(id){
 const idx=G.players[id].hand.indexOf("scan");if(idx<0)return [];
 const me=G.players[id],possibilities=[];
 for(const [where,s] of Object.entries(G.stars)){
  if(s.claimed!==null||s.placer===id||s.seen.includes(id))continue;
  const at=Number(where);
  possibilities.push({card:"scan",type:"scanStar",i:idx,at,score:3+Math.max(0,3.5-publicDistance(me.pos,at,id))});
 }
 // Only public position is used for wall selection; hidden type is never read.
 for(const [k,w] of Object.entries(G.walls)){
  if(w.faceUp||w.seen.includes(id))continue;
  const d=Math.min(publicDistance(me.pos,w.a,id),publicDistance(me.pos,w.b,id));
  possibilities.push({card:"scan",type:"scanWall",i:idx,k,score:1+Math.max(0,2-d)});
 }
 return possibilities;
}
function candidateTractor(id){
 const idx=G.players[id].hand.indexOf("tractor");if(idx<0)return [];
 const myPos=G.players[id].pos,possibilities=[];
 for(const rival of G.players){
  if(rival.id===id||dist(myPos,rival.pos)>3)continue;
  for(let d=0;d<4;d++){
   const at=neighbor(rival.pos,d);
   if(!safeStep(rival.pos,at,rival.id))continue;
   if(starAt(at))continue; // Don't knowingly gift a star.
   const from=strategicDistance(rival.pos,id),to=strategicDistance(at,id);
   possibilities.push({card:"tractor",type:"tractor",i:idx,target:rival.id,to:at,score:Math.min(9,(to-from)*4)+1});
  }
 }
 return possibilities;
}
function candidateWallMove(id){
 const idx=G.players[id].hand.indexOf("wallmove");if(idx<0)return [];
 const me=G.players[id],out=[];
 for(const [k,w] of Object.entries(G.walls)){
   // Do not examine wall kinds unless already known. Moving any wall opens an edge.
   if(!wallVisible(w,id))continue;
   const adjacent=dist(w.a,me.pos)<=2||dist(w.b,me.pos)<=2;
   if(!adjacent)continue;
   const center=wallCenter(w);
   for(let at=0;at<G.n*G.n;at++)for(let d=0;d<4;d++){
     const end=neighbor(at,d);if(end<0||G.walls[edge(at,end)])continue;
     const a=rc(at),b=rc(end),c=[(a[0]+b[0])/2,(a[1]+b[1])/2];
     if(Math.abs(center[0]-c[0])+Math.abs(center[1]-c[1])>1.01)continue;
     const targetStar=targets(id).some(s=>dist(s.pos,me.pos)<=4);
     out.push({card:"wallmove",type:"wallmove",i:idx,k,at,d,score:targetStar?2:1});
     if(out.length>6)return out;
   }
 }
 return out;
}
function candidateFallback(id){
 const pl=G.players[id],out=[];
 const disposable=pl.hand.map((c,i)=>({c,i})).filter(x=>x.c!=="shield");
 for(const card of disposable){
  for(let d=0;d<4;d++){
   const to=neighbor(pl.pos,d);
   if(!safeStep(pl.pos,to,id))continue;
   const score=positionUtility(pl.pos,to,id)+0.1;
   out.push({card:card.c,type:"fallback",i:card.i,to,score:score-5});
  }
 }
 return out;
}
function chooseAction(){
 const id=G.current,pl=G.players[id];
 const opts=[
  ...candidateMoves(id),
  ...candidatePull(id),
  ...candidateScan(id),
  ...candidateTractor(id),
  ...candidateWallMove(id),
  ...candidateFallback(id)
 ];
 if(pl.hand.includes("shield")&&!pl.shield){
  const enemyNearby=G.players.some(x=>x.id!==id&&dist(x.pos,pl.pos)<=3);
  opts.push({card:"shield",type:"shield",i:pl.hand.indexOf("shield"),score:enemyNearby?3:0});
 }
 opts.sort((a,b)=>b.score-a.score||a.i-b.i);
 return opts[0]||null;
}
function executeAction(plan){
 if(!plan||G.phase!=="play"||!cpu())return false;
 const before=G.actions;
 selectCard(plan.i);
 if(plan.type==="walk"){
  for(const at of plan.steps){
   if(!G.active||G.active.card!=="walk")break;
   const previous=G.players[G.current].pos;
   moveWalk(at);
   if(G.players[G.current].pos===previous&&!G.active)break;
  }
  if(G.active&&G.active.card==="walk")finishWalk();
 }else if(plan.type==="dash")startDash(plan.d);
 else if(plan.type==="jump")startJump(plan.d,plan.len);
 else if(plan.type==="scanStar")inspectStar(plan.at);
 else if(plan.type==="scanWall")inspectWall(plan.k);
 else if(plan.type==="pull"){onCell(plan.from);onCell(plan.to);}
 else if(plan.type==="tractor"){onCell(G.players[plan.target].pos);onCell(plan.to);}
 else if(plan.type==="wallmove"){onWall(plan.k);G.dir=plan.d;moveWall(plan.at);}
 else if(plan.type==="fallback"){basic();moveWalk(plan.to);}
 // Shield resolves upon card selection.
 if(G.active&&G.active.committed&&G.active.card==="walk")finishWalk();
 if(G.active&&!G.active.committed){G.active=null;render();}
 return G.actions>before;
}
function placeCPU(){
 const pl=G.players[G.current],type=placementKind(),n=G.n;
 if(type==="star"){
  const spots=Array.from({length:n*n},(_,i)=>i).filter(i=>!G.stars[i]&&!occupied(i,-1)&&G.players.every(x=>dist(i,x.pos)>=2));
  if(!spots.length){G.message="星を配置できる場所がありません。";return false;}
  // Public information + CPU's own star value only.
  // Place valuable stars fairly near ourselves but not next to the home square.
  const ownVal=pl.stars[0]??0;
  const scored=spots.map(at=>{
   const ours=dist(pl.pos,at);
   const rivals=Math.min(...G.players.filter(p=>p.id!==pl.id).map(p=>dist(p.pos,at)));
   return {at,score:(ownVal>1?Math.max(0,6-ours)*2:ours*.15)+(rivals-ours)*.6};
  }).sort((a,b)=>b.score-a.score);
  placeStar(scored[0].at);
  return true;
 }
 if(type==="wall"){
  const candidates=[];
  for(let at=0;at<n*n;at++)for(let d=0;d<4;d++){
   const to=neighbor(at,d);if(to<0||G.walls[edge(at,to)])continue;
   if(G.placementPhase===0&&!wallInitialAllowed(at,to))continue;
   const enemies=G.players.filter(x=>x.id!==pl.id);
   const nearest=Math.min(...enemies.map(p=>Math.min(dist(p.pos,at),dist(p.pos,to))));
   candidates.push({at,d,score:Math.max(0,7-nearest)});
  }
  if(!candidates.length)return false;
  candidates.sort((a,b)=>b.score-a.score);
  G.dir=candidates[0].d;placeWall(candidates[0].at);return true;
 }
 return false;
}
function actCPU(){
 if(G.actions===0&&blockedPublic(G.players[G.current])){
  const p=G.players[G.current],options=candidateMoves(G.current);
  // Prefer a legal card escape over an expensive emergency move.
  if(options.length===0||options[0].score<0){
   const boosts=boostDirs(p);
   if(boosts.length&&p.hand.length>=2){emergencyBoost(boosts[0]);endTurn();return;}
   if(!boosts.length&&!hasCardEscape(p)){emergencyReturn();endTurn();return;}
  }
 }
 const plan=chooseAction();
 if(!plan){endTurn();return;}
 const succeeded=executeAction(plan);
 if(!succeeded)G.message="CPUは有効な行動を選べず手番を終了しました。";
 if(G.phase==="play"&&G.actions<2&&succeeded){
  // Re-evaluate after the first action, so newly exposed walls can alter the plan.
  const next=chooseAction();
  if(next)executeAction(next);
 }
 endTurn();
}
function run(){
 if(!cpu()||G.phase==="ended")return;
 try{
  if(G.phase==="placement")placeCPU();
  else if(G.phase==="play")actCPU();
 }catch(err){
  console.error("StarMaze CPU error",err);
  G.message="CPUの処理に問題が発生しました。ゲームを続けられるよう手番を終了します。";
  if(G.phase==="play"){G.active=null;endTurn();}
  else {G.locked=false;$("reveal").hidden=false;$("modaltitle").textContent="CPUの処理を確認してください";}
 }
}
window.StarMazeCPU={run,unknownValue,wallVisible,chooseAction,publicDistance};
})();