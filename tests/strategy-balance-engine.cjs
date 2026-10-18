'use strict';
const {play,make,variants}=require('../scripts/strategy-balance-engine.cjs'),assert=require('node:assert/strict');
for(const variant of variants)for(const count of [2,3,4]){
 const g=play({count,size:7,seed:71,variant,policy:'collect'});
 assert.equal(g.claims.reduce((n,c)=>n+c.value,0)-2*g.rescues.filter(r=>r.type==='return').length,g.scores.reduce((a,b)=>a+b,0));
 assert.equal(g.turns.length,g.round*count);
 for(let round=1;round<=g.round;round++){
  const ids=g.turns.filter(t=>t.round===round).map(t=>t.id),expected=Array.from({length:count},(_,i)=>i);
  if(variant.endsWith('cyclic')){const first=(round-1)%count;expected.forEach((_,i)=>expected[i]=(i+first)%count);}
  if(variant.endsWith('halves')&&round>6)expected.reverse();
  if(variant.endsWith('snake')&&round%2===0)expected.reverse();
  if(variant.endsWith('phase')){const first=round<=6?(round-1)%count:(count-1-(round-7)%count+count)%count;for(let i=0;i<count;i++)expected[i]=round<=6?(first+i)%count:(first-i+count)%count;}
  assert.deepEqual(ids,expected);
 }
 console.log('PASS '+variant+' '+count+'p: score, equal turn budgets and exact circuit order');
}
// Candidate choice must not change if the identities of unseen walls change.
for(const policy of ['collect','value','control']){
 const h=make({count:2,size:7,seed:31,variant:'finite-cyclic',policy}),g=h.g;
 while(g.phase==='placement')h.t.run();
 const unseen=Object.values(g.walls).filter(w=>!w.faceUp&&!w.seen.includes(g.current));
 assert.ok(unseen.length);const a=JSON.stringify(h.t.choose());unseen.forEach(w=>w.kind=w.kind==='solid'?'phantom':'solid');
 assert.equal(JSON.stringify(h.t.choose()),a,'A policy must not inspect unseen wall identities');
 console.log('PASS '+policy+' hidden-wall metamorphic regression');
}
