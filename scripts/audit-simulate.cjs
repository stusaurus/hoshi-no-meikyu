'use strict';
// Reproducible STARTER audit. Test-only policy adapters; no production rules changed.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),os=require('node:os');
const args=Object.fromEntries(process.argv.slice(2).map(x=>x.replace(/^--/,'').split('=')));
const dir=path.resolve(args.out||'docs/audit-2026-10-14/data');fs.mkdirSync(dir,{recursive:true});
const policies=(args.policies||'collect,sabotage,explore,random,mixed').split(','),seedOffset=Number(args.seedOffset||0);
const seeds=Number(args.seeds||4),ruleset=args.set||'starter',variant=args.variant||'current';
let source=fs.readFileSync(args.gameSource||'game.js','utf8');
if(variant==='five-rounds')source=source.replace('G.round>=6||','G.round>=5||'); // isolated hypothetical, not a formal rule
let cpu=fs.readFileSync(args.cpuSource||'cpu.js','utf8');
// Memoize only within one non-mutating planning pass; fresh cache each choice.
cpu=cpu.replace('function publicDistance(', 'function uncachedPublicDistance(').replace('function targets(id)', `let distances=new Map();function publicDistance(a,b,id){const k=a+':'+b+':'+id;if(!distances.has(k))distances.set(k,uncachedPublicDistance(a,b,id));return distances.get(k);}
function targets(id)`).replace('function chooseAction(){','function chooseAction(){distances.clear();').replace('function placeCPU(){','function placeCPU(){distances.clear();');
// Adapt choices ONLY inside this VM; preserve candidate legality and knowledge limits.
cpu=cpu.replace('opts.sort((a,b)=>b.score-a.score||a.i-b.i);',`const policy=pl.auditPolicy||'collect';
 if(policy==='explore')opts.forEach(o=>{if(o.type.startsWith('scan'))o.score+=80;});
 if(policy==='sabotage')opts.forEach(o=>{if(o.type==='tractor'&&o.score>1)o.score+=100;});
 if(policy==='random')opts.forEach(o=>o.score=Math.random());
 opts.sort((a,b)=>b.score-a.score||a.i-b.i);`);
const bridge=`\nrender=()=>{};this.api={start,get:()=>G,run:window.StarMazeCPU.run};
this.metrics={actions:[],contacts:[],claims:[],rescues:[],stalls:0};
const rawStep=step;step=function(p,j,m){const w=G.walls[edge(p.pos,j)],r=rawStep(p,j,m);if(w)metrics.contacts.push({kind:w.kind,player:p.id,revealed:w.faceUp,blocked:r.blocked,bounce:r.bounce});return r;};
const rawClaim=claim;claim=function(p){const s=G.stars[p.pos],was=s&&s.claimed;rawClaim(p);if(s&&was===null&&s.claimed!==null)metrics.claims.push({id:p.id,value:s.value,round:G.round});};
const rawSelect=selectCard;selectCard=function(i){thisAction={id:G.current,card:G.players[G.current].hand[i],before:G.players[G.current].pos,flags:metrics.claims.length,actions:G.actions,rivals:G.players.map(p=>p.pos),seen:Object.values(G.stars).filter(s=>s.seen.includes(G.current)).length+Object.values(G.walls).filter(w=>w.seen.includes(G.current)).length};rawSelect(i);};
let thisAction=null;const rawFinish=finishAction;finishAction=function(p,m){const a=thisAction,active=G.active,valid=a&&active&&active.committed;const used=active&&active.card,basic=!!(active&&active.basic);rawFinish(p,m);if(valid){const nowSeen=Object.values(G.stars).filter(s=>s.seen.includes(a.id)).length+Object.values(G.walls).filter(w=>w.seen.includes(a.id)).length;metrics.actions.push({...a,used,basic,moved:G.players[a.id].pos!==a.before,learned:nowSeen>a.seen,rivalMoved:G.players.some((p,i)=>i!==a.id&&p.pos!==a.rivals[i]),points:metrics.claims.slice(a.flags).filter(x=>x.id===a.id).reduce((n,x)=>n+x.value,0),giftPoints:metrics.claims.slice(a.flags).filter(x=>x.id!==a.id).reduce((n,x)=>n+x.value,0)});}};
const rc0=emergencyReturn;emergencyReturn=function(){const before=G.actions;rc0();if(G.actions>before)metrics.rescues.push('return');};
const rb0=emergencyBoost;emergencyBoost=function(d){const before=G.actions;rb0(d);if(G.actions>before)metrics.rescues.push('boost');};`;
function run(count,size,seed,seat,order,policy){
 let x=seed>>>0;const math=Object.create(Math);math.random=()=>((x=(Math.imul(x,1664525)+1013904223)>>>0)/4294967296);
 const nodes=new Map(),tasks=[],errors=[];
 function el(k){if(!nodes.has(k))nodes.set(k,{style:{setProperty(){}},addEventListener(){},hidden:false,innerHTML:'',textContent:'',value:k==='#gameSet'?ruleset:k==='#playMode'?'cpu'+count:k==='#boardSize'?''+size:k==='#playerCount'?''+count:''});return nodes.get(k);}
 const ctx=vm.createContext({Math:math,document:{querySelector:el,addEventListener(){}},window:{setTimeout:fn=>tasks.push(fn)},console:{log(){},error(...a){errors.push(a.join(' '));}}});
 vm.runInContext(source+'\n'+cpu+bridge,ctx);const a=ctx.api;a.start();const g=a.get();
 // Identity remains slot id. Rotate physical seat and separately which actor/policy occupies each turn slot.
 const starts=g.players.map(p=>p.pos),identities=g.players.map(p=>(p.id+order)%count),supplies=g.players.map(p=>({stars:p.stars.slice(),walls:p.walls.slice()}));
 g.players.forEach((p,i)=>{p.pos=starts[(identities[i]+seat)%count];p.home=p.pos;p.stars=supplies[identities[i]].stars.slice();p.walls=supplies[identities[i]].walls.slice();p.cpu=true;p.auditPolicy=policy==='mixed'?['collect','sabotage','explore','random'][identities[i]]:policy;});
 let ticks=0,roundScores=[],blocked=0,noAction=0;
 const score=()=>g.players.map(p=>Object.values(g.stars).filter(s=>s.claimed===p.id).reduce((n,s)=>n+s.value,0)-p.penalty);
 while(g.phase!=='ended'){
  if(++ticks>300)throw Error('nontermination');
  const ph=g.phase,r=g.round,id=g.current,old=g.players[id].pos,before=ctx.metrics.actions.length;
  if(ph==='play'&&vm.runInContext('blockedPublic(G.players[G.current])',ctx))blocked++;
  tasks.length=0;a.run();
  if(errors.length)throw Error(errors[0]);
  if(ph==='play'&&ctx.metrics.actions.length===before&&old===g.players[id].pos)noAction++;
  if(ph==='play'&&id===count-1)roundScores.push({round:r,scores:score()});
 }
 const scores=score(),max=Math.max(...scores),winners=scores.flatMap((v,i)=>v===max?[i]:[]),sorted=scores.slice().sort((a,b)=>b-a);
 const penultimate=roundScores.at(-2),previousLeaders=penultimate?penultimate.scores.flatMap((v,i)=>v===Math.max(...penultimate.scores)?[i]:[]):[];
 return {count,size,seed,seat,order,policy,identities,round:g.round,scores,winners,margin:sorted[0]-sorted[1],claimCounts:g.players.map(p=>Object.values(g.stars).filter(s=>s.claimed===p.id).length),capture:Object.values(g.stars).filter(s=>s.claimed!==null).length/Object.keys(g.stars).length,reversal:previousLeaders.length?Number(winners.some(i=>!previousLeaders.includes(i))):null,roundScores,blocked,noAction,wallRevealed:Object.values(g.walls).filter(w=>w.faceUp).length,wallCount:Object.keys(g.walls).length,...JSON.parse(JSON.stringify(ctx.metrics))};
}
const records=[],failures=[],start=Date.now();
for(const count of [2,3,4])for(const size of [7,8,9])for(const policy of policies){
 for(let s=0;s<seeds;s++)for(let seat=0;seat<count;seat++)for(let order=0;order<count;order++){
  const seed=20261014+count*1000000+size*10000+(s+seedOffset)*8191;
  try{records.push(run(count,size,seed,seat,order,policy));}catch(e){failures.push({count,size,seed,seat,order,policy,error:e.message});}
 }
 console.log(count+'p '+size+' '+policy+' complete '+records.length+' errors '+failures.length);
 fs.writeFileSync(path.join(dir,'progress.json'),JSON.stringify({completed:records.length,failures,seconds:(Date.now()-start)/1000}));
}
const mean=a=>a.length?a.reduce((n,x)=>n+x,0)/a.length:null;
const summary=[];
for(const count of [2,3,4])for(const size of [7,8,9])for(const policy of policies){
 const r=records.filter(x=>x.count===count&&x.size===size&&x.policy===policy),actions=r.flatMap(x=>x.actions),contacts=r.flatMap(x=>x.contacts);
 summary.push({count,size,policy,n:r.length,winShare:Array.from({length:count},(_,i)=>mean(r.map(x=>x.winners.includes(i)?1/x.winners.length:0))),identityWinShare:Array.from({length:count},(_,i)=>mean(r.map(x=>{let slot=x.identities.indexOf(i);return x.winners.includes(slot)?1/x.winners.length:0;}))),scores:Array.from({length:count},(_,i)=>mean(r.map(x=>x.scores[i]))),claims:Array.from({length:count},(_,i)=>mean(r.map(x=>x.claimCounts[i]))),capture:mean(r.map(x=>x.capture)),margin:mean(r.map(x=>x.margin)),reversal:mean(r.filter(x=>x.reversal!==null).map(x=>x.reversal)),rounds:mean(r.map(x=>x.round)),blocked:mean(r.map(x=>x.blocked)),noAction:mean(r.map(x=>x.noAction)),rescues:r.flatMap(x=>x.rescues).reduce((o,k)=>(o[k]=(o[k]||0)+1,o),{}),wallReveal:mean(r.map(x=>x.wallRevealed/x.wallCount)),wallContacts:Object.fromEntries(['solid','bounce','phantom','oneway'].map(k=>[k,contacts.filter(x=>x.kind===k).length])),cards:Object.fromEntries(['walk','dash','jump','scan','tractor','wallmove','pull','shield'].map(k=>{const a=actions.filter(x=>x.card===k);return [k,{used:a.length,effect:a.filter(x=>!x.basic).length,basic:a.filter(x=>x.basic).length,moved:a.filter(x=>x.moved).length,directPoints:a.reduce((n,x)=>n+x.points,0),zeroDirectPoint:a.filter(x=>!x.points).length,learned:a.filter(x=>x.learned).length,rivalMoved:a.filter(x=>x.rivalMoved).length,giftPoints:a.reduce((n,x)=>n+x.giftPoints,0)}];}))});
}
const report={ruleset,variant,seeds,seedOffset,policies,seedFormula:'20261014 + players*1000000 + size*10000 + seedIndex*8191',environment:{node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0].model},seconds:(Date.now()-start)/1000,completed:records.length,failures,definitions:{success:'Committed card action; successful effect is NOT inferred from points',directPoints:'Claimed points during action only; no causal estimate of scan/tractor future value',reversal:'Final winners include someone not leading after penultimate completed round; omniscient retrospective score',order:'Rotate actors including private star/wall supplies and policies across turn slots independently of physical seat; paired rotations share seeds and are NOT independent samples',random:'Random legal candidate, not uniform over cards/positions'},summary};
fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify(report,null,2));fs.writeFileSync(path.join(dir,'games.json'),JSON.stringify(records));
console.log('DONE '+records.length+' matches '+report.seconds+'s');if(failures.length)process.exitCode=1;
