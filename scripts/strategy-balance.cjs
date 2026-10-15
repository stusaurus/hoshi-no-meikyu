'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),os=require('node:os');
const {play,variants:allVariants,sourceHashes}=require('./strategy-balance-engine.cjs');
const args=Object.fromEntries(process.argv.slice(2).map(x=>x.replace(/^--/,'').split('=')));
const seeds=Number(args.seeds||12),seedOffset=Number(args.seedOffset||0),variants=(args.variants||allVariants.join(',')).split(','),policies=(args.policies||'collect').split(','),opening=args.opening||'varied',out=args.out||'docs/balance-2026-10-15/screen';
const halfTurns=Number(args.halfTurns||6);
const counts=(args.counts||'2,3,4').split(',').map(Number),sizes=(args.sizes||'7,8,9').split(',').map(Number);
fs.mkdirSync(out,{recursive:true});const records=[],failures=[],start=Date.now();
for(const count of counts)for(const size of sizes)for(const policy of policies)for(const variant of variants){
 for(let s=0;s<seeds;s++)for(let seat=0;seat<count;seat++)for(let identity=0;identity<count;identity++){
  const seed=20261015+count*1000000+size*10000+(s+seedOffset)*8191;
  try{records.push(play({count,size,seed,seat,identity,variant,policy,opening,halfTurns}));}catch(e){failures.push({count,size,seed,seat,identity,variant,policy,error:e.message});}
 }
 console.log(count+'p '+size+' '+policy+' '+variant+': '+records.length+' records / '+failures.length+' failures');
 fs.writeFileSync(path.join(out,'progress.json'),JSON.stringify({completed:records.length,failures,seconds:(Date.now()-start)/1000}));
}
const mean=a=>a.length?a.reduce((a,b)=>a+b,0)/a.length:null,summary=[];
for(const count of counts)for(const size of sizes)for(const policy of policies)for(const variant of variants){
 const g=records.filter(g=>g.count===count&&g.size===size&&g.policy===policy&&g.variant===variant),a=g.flatMap(g=>g.actions);
 const wins=Array.from({length:count},(_,id)=>mean(g.map(g=>g.winners.includes(id)?1/g.winners.length:0)));
 summary.push({count,size,policy,variant,n:g.length,seeds:new Set(g.map(g=>g.seed)).size,uniqueOpenings:new Set(g.map(g=>g.openingKey)).size,winShare:wins,spread:Math.max(...wins)-Math.min(...wins),scores:Array.from({length:count},(_,id)=>mean(g.map(g=>g.scores[id]))),margin:mean(g.map(g=>g.margin)),capture:mean(g.map(g=>g.capture)),rounds:mean(g.map(g=>g.round)),passesPerGame:mean(g.map(g=>g.turns.filter(t=>t.pass).length)),repeatRate:g.reduce((s,g)=>s+g.repeated,0)/(g.reduce((s,g)=>s+g.transitions,0)||1),midReversal:mean(g.filter(g=>g.midReversal!==null).map(g=>g.midReversal)),rescues:g.flatMap(g=>g.rescues).length,cards:Object.fromEntries(['walk','dash','jump','scan','tractor'].map(c=>[c,a.filter(a=>a.card===c).length]))});
}
const report={sourceHashes,halfTurns,seeds,seedOffset,counts,sizes,variants,policies,opening,completed:records.length,failures,seconds:(Date.now()-start)/1000,environment:{node:process.version,cpu:os.cpus()[0].model},summary};
fs.writeFileSync(path.join(out,'games.json.gz'),zlib.gzipSync(JSON.stringify(records)));
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(report,null,2));
console.log('DONE '+records.length+' '+report.seconds+'s');if(failures.length)process.exitCode=1;
