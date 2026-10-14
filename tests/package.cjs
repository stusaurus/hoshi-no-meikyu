const {execFileSync}=require('node:child_process'),assert=require('node:assert/strict'),fs=require('node:fs');
const files=execFileSync('unzip',['-Z1','star-maze-playable.zip'],{encoding:'utf8'}).trim().split('\n');
for(const name of ['index.html','style.css','game.js','cpu.js','assets/art.webp'])assert.ok(files.includes(name),'Missing '+name);
assert.ok(execFileSync('unzip',['-p','star-maze-playable.zip','assets/art.webp']).equals(fs.readFileSync('assets/art.webp')));
assert.ok(!files.some(x=>x.includes('node_modules')||x.startsWith('/')));console.log('PASS offline ZIP paths and byte-identical approved art');
