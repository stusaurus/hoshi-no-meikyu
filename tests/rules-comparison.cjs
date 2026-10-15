'use strict';
const fs=require('node:fs'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const root='docs/audit-2026-10-15/',variants=['current','alternating','passable-flags','alternating-passable-flags'];
let reference,total=0;
for(const variant of variants){
 const dir=root+'data-'+variant+'/',meta=JSON.parse(fs.readFileSync(dir+'summary.json'));
 const games=JSON.parse(zlib.gunzipSync(fs.readFileSync(dir+'games.json.gz')));
 assert.equal(meta.variant,variant);assert.equal(meta.completed,696);assert.deepEqual(meta.failures,[]);
 assert.equal(games.length,meta.completed);
 const keys=games.map(g=>[g.count,g.size,g.seed,g.seat,g.order,g.policy].join(':'));
 assert.equal(new Set(keys).size,696);if(reference)assert.deepEqual(keys,reference);else reference=keys;
 for(const g of games){
  const alt=variant.startsWith('alternating');assert.ok(g.round<=(alt?12:6));
  assert.equal(g.logicalRound,alt?g.round/2:g.round);
  assert.equal(g.claimCounts.reduce((a,b)=>a+b,0),g.claims.length);
  assert.equal(g.scores.reduce((a,b)=>a+b,0),g.claims.reduce((a,b)=>a+b.value,0)-2*g.rescues.filter(x=>x==='return').length);
  assert.equal(g.turns.reduce((a,b)=>a+b.cards,0),g.actions.length);
  assert.equal(g.turns.reduce((a,b)=>a+b.rescues,0),g.rescues.length);
  for(const t of g.turns){assert.ok(t.cards<=(alt?1:2));assert.ok(t.rescues<=1);if(t.debt)assert.equal(t.cards+t.rescues,0);if(alt&&t.rescues)assert.equal(t.circuit%2,1);}
  for(let id=0;id<g.count;id++)assert.ok(g.turns.filter(t=>t.id===id).reduce((a,t)=>a+t.cards+2*t.rescues,0)<=12,'Maximum action budget is conserved');
  assert.ok(g.actions.every(a=>['walk','dash','jump','scan','tractor'].includes(a.card)));
 }
 for(const row of meta.summary){
  const subset=games.filter(g=>g.count===row.count&&g.size===row.size&&g.policy===row.policy);
  assert.equal(row.n,subset.length);
  for(let id=0;id<row.count;id++)assert.ok(Math.abs(row.winShare[id]-subset.reduce((sum,g)=>sum+(g.winners.includes(id)?1/g.winners.length:0),0)/subset.length)<1e-10);
 }
 total+=games.length;console.log('PASS '+variant+': 696 paired records, scoring, action budgets and winner aggregates');
}
assert.equal(total,2784);console.log('PASS 2784 comparison records (696 repeated controls; not 2784 independent seeds)');
