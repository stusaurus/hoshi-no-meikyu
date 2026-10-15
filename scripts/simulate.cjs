"use strict";
// Same in-browser code under Node vm: 9 player-count/board-size conditions.
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm');
const game=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8');
const cpu=fs.readFileSync(path.join(__dirname,'..','cpu.js'),'utf8');
const code=game+'\n'+cpu+'\nthis.bridge={start,get:()=>G,ai:window.StarMazeCPU}';
const options=Object.fromEntries(process.argv.slice(2).map(t=>t.replace(/^--/,'').split('=')));
const samples=Math.max(1,Math.min(2000,Number(options.games)||40));
const seed=Number(options.seed)||20261014;
const out=path.resolve(options.out||'reports');
const rotateSeats=options.rotateSeats==="true";
fs.mkdirSync(out,{recursive:true});
function rng(v){let x=v>>>0;return ()=>((x=(Math.imul(x,1664525)+1013904223)>>>0)/4294967296);}
function simulate(players,size,runSeed,seatOffset=0){
 const selectors=['main','#board','#status','#score','#side','#log','#handoff','#modaltitle','#modaltext','#reveal','#playerCount','#boardSize','#playMode'];
 const nodes=Object.fromEntries(selectors.map(k=>[k,{style:{setProperty(){}},addEventListener(){},innerHTML:'',textContent:'',hidden:false,value:k==='#playerCount'?String(players):k==='#boardSize'?String(size):k==='#playMode'?'cpu'+players:''}]));
 const tasks=[],errors=[],math=Object.create(Math);math.random=rng(runSeed);
 const context=vm.createContext({document:{querySelector:k=>nodes[k],addEventListener(){}},window:{setTimeout:f=>tasks.push(f)},console:{error:(...args)=>errors.push(args.map(String).join(' ')),log(){}},Math:math});
 vm.runInContext(code,context);
 const t=context.bridge;t.start();const state=t.get();
 // Rotate ownership of the SAME starting squares, without changing their set.
 // Neutral stars were already placed at setup, so their legal positions are preserved.
 const original=state.players.map(p=>p.pos);
 state.players.forEach((p,i)=>{p.pos=original[(i+seatOffset)%players];p.home=p.pos;});
 state.players[0].cpu=true;
 const perRound=Array(6).fill(0);let previousFlags=0,steps=0,cpuTurns=0;
 // First handoff was created for player 0 before activating CPU mode.
 t.ai.run();
 while(state.phase!=='ended'){
   if(++steps>players*24+40)throw Error('Game did not finish; round='+state.round+', current='+state.current+', phase='+state.phase);
   if(errors.length)throw Error(errors[0]);
   if(!tasks.length)throw Error('No pending CPU turn; '+state.phase+' player='+state.current);
   const phase=state.phase,round=state.round;
   tasks.shift()();
   if(phase==='play')cpuTurns++;
   const flags=Object.values(state.stars).filter(s=>s.claimed!==null).length;
   perRound[Math.min(5,round-1)]+=Math.max(0,flags-previousFlags);
   previousFlags=flags;
 }
 const scores=state.players.map(p=>Object.values(state.stars).filter(s=>s.claimed===p.id).reduce((n,s)=>n+s.value,0)-p.penalty);
 const ranking=scores.slice().sort((a,b)=>b-a),best=ranking[0];
 return {players,size,runSeed,seatOffset,rounds:state.round,scores,winners:scores.map((x,i)=>x===best?i:-1).filter(x=>x>=0),
  scoreMargin:best-ranking[1],flags:previousFlags,stars:Object.keys(state.stars).length,
  rescueReturns:state.players.reduce((n,p)=>n+p.penalty/2,0),
  wallsRevealed:Object.values(state.walls).filter(w=>w.faceUp).length,
  walls:Object.keys(state.walls).length,perRound,cpuTurns};
}
const games=[],conditions=[],failures=[];
const average=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
for(const players of [2,3,4])for(const size of [7,8,9]){
 const records=[];
 for(let trial=0;trial<samples;trial++){
  const seatOffset=rotateSeats?trial%players:0;
  const randomIndex=rotateSeats?Math.floor(trial/players):trial;
  const runSeed=(seed+players*10000000+size*100000+randomIndex*8191)>>>0;
  try{const result=simulate(players,size,runSeed,seatOffset);records.push(result);games.push(result);}
  catch(error){failures.push({players,size,runSeed,error:String(error.message)});}
 }
 const first=records.reduce((n,g)=>n+(g.winners.includes(0)?1/g.winners.length:0),0);
 const seatRotationWinShares=Array.from({length:players},(_,offset)=>{
  const subset=records.filter(g=>g.seatOffset===offset);
  return {offset,count:subset.length,firstPlayerWinShare:+average(subset.map(g=>g.winners.includes(0)?1/g.winners.length:0)).toFixed(4)};
 });
 const stats={players,size,completed:records.length,attempted:samples,seatRotationWinShares,
  captureRate:+average(records.map(g=>g.flags/g.stars)).toFixed(4),
  meanClaimed:+average(records.map(g=>g.flags)).toFixed(2),
  meanMargin:+average(records.map(g=>g.scoreMargin)).toFixed(2),
  tieRate:+average(records.map(g=>Number(g.winners.length>1))).toFixed(4),
  firstSeatWinShare:+(first/(records.length||1)).toFixed(4),
  expectedFirstShare:+(1/players).toFixed(4),
  meanEmergencyReturns:+average(records.map(g=>g.rescueReturns)).toFixed(3),
  meanWallReveal:+average(records.map(g=>g.wallsRevealed/g.walls)).toFixed(3),
  meanFlagsByRound:Array.from({length:6},(_,i)=>+average(records.map(g=>g.perRound[i])).toFixed(2)),
  meanRoundsPlayed:+average(records.map(g=>g.rounds)).toFixed(2)};
 conditions.push(stats);console.log('SCENARIO '+JSON.stringify(stats));
}
const report={description:"Preliminary CPU-only simulations; NOT human playtesting or evidence of optimal settings",engine:"game.js + cpu.js",cpu:"beginner bot with hidden-information limits",seatRotationEnabled:rotateSeats,gamesPerCondition:samples,seed,conditions,failures};
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(out,'games.json'),JSON.stringify(games,null,2)+'\n');
const md=['# 星の迷宮 STANDARD / 初級CPU対戦の試行結果','','**注意：初級CPUによる仮想対戦です。人間の駆け引き、所要時間、最適サイズを決定する根拠にはなりません。**','','試行：'+samples+'ゲーム/条件 × 9条件 = '+(samples*9)+'ゲーム、seed='+seed+'、開始位置の席順循環：'+(rotateSeats?'あり':'なし'),'','| 人数 | 盤面 | 完了 | 星の確保率 | 平均得点差 | 同点率 | 先手勝率* | 緊急帰還/戦 |','|---:|:---:|---:|---:|---:|---:|---:|---:|'];
for(const c of conditions)md.push('| '+c.players+' | '+c.size+'×'+c.size+' | '+c.completed+'/'+c.attempted+' | '+(c.captureRate*100).toFixed(1)+'% | '+c.meanMargin.toFixed(2)+' | '+(c.tieRate*100).toFixed(1)+'% | '+(c.firstSeatWinShare*100).toFixed(1)+'% | '+c.meanEmergencyReturns.toFixed(2)+' |');
if(rotateSeats){md.push('','## 同じ開始位置集合における先手の位置別勝率');for(const c of conditions){md.push('','### '+c.players+'人・'+c.size+'×'+c.size);for(const r of c.seatRotationWinShares)md.push('- 開始位置の割当ローテーション'+r.offset+'：'+(r.firstPlayerWinShare*100).toFixed(1)+'%（'+r.count+'試合）');}}
md.push('','*同点時は各勝者に勝利を按分。期待値は2人50%、3人33.3%、4人25%。','','## この結果の限界','','- 盤面サイズで星の枚数とゲーム時間は変えていない。','- CPUの方策に依存するので、最適ルールの証明ではない。','- 実際の15〜20分のプレイ時間は人による試遊が必要。','- 星や壁の配置・先手後手の影響を今後切り分ける。','','エラー：'+failures.length);
if(failures.length)md.push('最初のエラー：'+JSON.stringify(failures[0]));
fs.writeFileSync(path.join(out,'SUMMARY.md'),md.join('\n')+'\n');
console.log('TOTAL: '+games.length+' completed, '+failures.length+' failed.');
if(failures.length)process.exitCode=1;