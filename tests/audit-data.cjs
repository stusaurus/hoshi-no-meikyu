const fs=require('node:fs'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const root='docs/audit-2026-10-14/';let total=0;
for(const name of ['data-current','data-baseline','data-experiment','data-fairness-extra','data-standard-control']){
 const meta=JSON.parse(fs.readFileSync(root+name+'/summary.json')),games=JSON.parse(zlib.gunzipSync(fs.readFileSync(root+name+'/games.json.gz')));
 assert.equal(games.length,meta.completed);assert.equal(meta.failures.length,0);
 for(const g of games){assert.equal(g.claimCounts.reduce((a,b)=>a+b,0),g.claims.length);assert.ok(g.scores.every(Number.isFinite));assert.equal(g.scores.reduce((a,b)=>a+b,0),g.claims.reduce((a,c)=>a+c.value,0)-2*g.rescues.filter(x=>x==='return').length);assert.ok(g.claims.every(c=>c.value>=0&&c.value<=3));if(name!=='data-standard-control')assert.ok(g.actions.every(a=>['walk','dash','jump','scan','tractor'].includes(a.card)));}
 for(const r of meta.summary){assert.ok(r.claims.every(Number.isFinite));assert.ok(Math.abs(r.winShare.reduce((a,b)=>a+b,0)-1)<1e-8);assert.equal(r.n,games.filter(g=>g.count===r.count&&g.size===r.size&&g.policy===r.policy).length);}
 total+=games.length;console.log('PASS '+name+' '+games.length+' records: score/claim conservation, finite means, distinct starter cards');
}
assert.equal(total,8613);console.log('PASS '+total+' saved records and summary integrity');
