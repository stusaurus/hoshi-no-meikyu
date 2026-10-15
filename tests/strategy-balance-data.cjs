'use strict';
const fs=require('node:fs'),zlib=require('node:zlib'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root='docs/balance-2026-10-15/';let total=0;const screening=[];
for(const [name,expected] of [['screen-a',6264],['screen-b',6264],['skill-web',4176],['phase-screen',2088],['phase-web-2p',288],['phase-web-multi',600],['horizon-4',1728],['horizon-5',1728],['horizon-6',1728],['contested',1152],['halves-varied',576],['halves-contested',576]]){
 const meta=JSON.parse(fs.readFileSync(root+name+'/summary.json')),games=JSON.parse(zlib.gunzipSync(fs.readFileSync(root+name+'/games.json.gz')));
 assert.equal(meta.completed,expected);assert.equal(games.length,expected);assert.deepEqual(meta.failures,[]);
 for(const k of ['game','cpu'])assert.equal(meta.sourceHashes[k],crypto.createHash('sha256').update(fs.readFileSync(root+'source/'+k+'.js')).digest('hex'));
 const keys=games.map(g=>[g.count,g.size,g.policy,g.variant,g.seed,g.seat,g.identity].join(':'));assert.equal(new Set(keys).size,expected);
 for(const g of games){
  assert.equal(g.turns.length,g.count*g.round);assert.equal(g.scores.reduce((a,b)=>a+b,0),g.claims.reduce((n,c)=>n+c.value,0)-2*g.rescues.filter(r=>r.type==='return').length);
  assert.equal(g.actions.length,g.turns.reduce((n,t)=>n+t.cards,0));assert.equal(g.rescues.length,g.turns.reduce((n,t)=>n+t.rescues,0));
  assert.equal(new Set(g.claims.map(c=>c.pos)).size,g.claims.length);assert.ok(g.claims.every(c=>c.value>=1&&c.value<=3));
  const finite=g.variant.startsWith('finite'),halfBudget=g.halfTurns||6;
  const best=Math.max(...g.scores);assert.deepEqual(g.winners,g.scores.flatMap((s,i)=>s===best?[i]:[]));
  for(let round=1;round<=g.round;round++){
   const turns=g.turns.filter(t=>t.round===round);assert.equal(turns.length,g.count);assert.equal(new Set(turns.map(t=>t.id)).size,g.count);
   assert.ok(turns.every(t=>t.cards+t.rescues<=1));
   const ids=Array.from({length:g.count},(_,i)=>i),first=(round-1)%g.count;
   if(g.variant.endsWith('cyclic'))for(let i=0;i<g.count;i++)ids[i]=(first+i)%g.count;
   if(g.variant.endsWith('phase')){const first=round<=halfBudget?(round-1)%g.count:(g.count-1-(round-halfBudget-1)%g.count+g.count)%g.count;for(let i=0;i<g.count;i++)ids[i]=round<=halfBudget?(first+i)%g.count:(first-i+g.count)%g.count;}
   if(g.variant.endsWith('halves')&&round>halfBudget)ids.reverse();
   if(g.variant.endsWith('snake')&&round%2===0)ids.reverse();assert.deepEqual(turns.map(t=>t.id),ids);
  }
  if(finite)for(let id=0;id<g.count;id++)for(const half of [0,1])for(const c of ['walk','dash','jump','scan','tractor'])assert.ok(g.actions.filter(a=>a.id===id&&(a.round>halfBudget?1:0)===half&&a.card===c).length<=(['scan','tractor'].includes(c)?1:2));
 }
 for(const row of meta.summary){
  const subset=games.filter(g=>g.count===row.count&&g.size===row.size&&g.policy===row.policy&&g.variant===row.variant);
  assert.equal(row.n,subset.length);assert.equal(row.seeds,new Set(subset.map(g=>g.seed)).size);
  for(let id=0;id<row.count;id++)assert.ok(Math.abs(row.winShare[id]-subset.reduce((n,g)=>n+(g.winners.includes(id)?1/g.winners.length:0),0)/subset.length)<1e-10);
 }
 if(name.startsWith('screen'))screening.push(...games);total+=games.length;
 console.log('PASS '+name+' '+games.length+': unique keys, frozen source, score/claim conservation, exact orders, finite budgets and aggregates');
}
// The six main treatments must share the same legal initial geometry and
// privately dealt wall supplies for each paired seed/seat/actor rotation.
const pairs=new Map();for(const g of screening){const key=[g.count,g.size,g.policy,g.seed,g.seat,g.identity].join(':');if(!pairs.has(key))pairs.set(key,[]);pairs.get(key).push(g);}
for(const pair of pairs.values()){assert.equal(pair.length,6);assert.equal(new Set(pair.map(g=>g.openingKey)).size,1);}
assert.equal(total,27168);console.log('PASS 27,168 records and 2,088 matched six-treatment openings');
