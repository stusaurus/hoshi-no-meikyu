
"use strict";
const $=s=>document.querySelector(s), colours=["#72baff","#ff8e98","#7fe5b5","#ffd477"], names=["青","赤","緑","黄"];
let G=null;
const shuffle=a=>{let b=a.slice();for(let i=b.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;};
const dist=(a,b)=>Math.abs(Math.floor(a/G.n)-Math.floor(b/G.n))+Math.abs(a%G.n-b%G.n);
const inBoard=(r,c)=>r>=0&&c>=0&&r<G.n&&c<G.n;
const rc=i=>[Math.floor(i/G.n),i%G.n];
function neighbor(i,d){let [r,c]=rc(i), dirs=[[-1,0],[0,1],[1,0],[0,-1]],nr=r+dirs[d][0],nc=c+dirs[d][1];return inBoard(nr,nc)?nr*G.n+nc:-1;}
function edge(a,b){return a<b?a+"-"+b:b+"-"+a;}
function isFlag(i){return G.stars[i]&&G.stars[i].claimed!==null;}
function occupied(i,except){return G.players.some(p=>p.id!==except&&p.pos===i);}
function free(i,except){return i>=0&&!isFlag(i)&&!occupied(i,except);}
function starAt(i){return G.stars[i]&&G.stars[i].claimed===null;}
function human(p){return names[p.id]+"ロケット";}
function record(msg){G.logs.unshift(msg);G.logs=G.logs.slice(0,14);}
function info(msg){G.message=msg;render();}
const defs={
 walk:{name:"てくてく",icon:"👣",group:"move",desc:"最大2歩、途中停止可能"},
 dash:{name:"流星ダッシュ",icon:"☄️",group:"move",desc:"障害物まで直進"},
 jump:{name:"ジェットジャンプ",icon:"🚀",group:"move",desc:"障害物を1つ越えて最大2マス"},
 scan:{name:"宇宙探査",icon:"🔭",group:"effect",desc:"秘密の星か壁を確認"},
 tractor:{name:"トラクタービーム",icon:"🧲",group:"effect",desc:"3マス以内の相手を1マス動かす"},
 wallmove:{name:"壁の移動",icon:"↔️",group:"effect",desc:"壁を隣接する辺へ移す"},
 pull:{name:"星の引力",icon:"🌟",group:"effect",desc:"未確保の星を1マス移す"},
 shield:{name:"宇宙バリア",icon:"🛡️",group:"effect",desc:"次の強制移動を防ぐ"}
};
const cardCounts={walk:12,dash:8,jump:6,scan:6,tractor:6,wallmove:4,pull:4,shield:2};
// STARTER: 5 card types, with more movement cards for beginner-friendly turns.
const starterCardCounts={walk:16,dash:10,jump:6,scan:6,tractor:6};
const starterWallKinds=["solid","bounce","phantom"];
const starterWallCounts={2:[2,1,1],3:[2,2,2],4:[3,2,3]};
const starCounts={2:[1,2,2,2],3:[2,2,3,2],4:[2,3,4,2]};
const wallCounts={2:[1,1,1,1],3:[2,1,1,2],4:[2,2,2,2]};
const wallKinds=["solid","bounce","oneway","phantom"];
const wallLabels={solid:"鉄壁",bounce:"反発壁",oneway:"一方通行",phantom:"幻影壁"};
const wallIcons={solid:"▰",bounce:"↩",oneway:"➜",phantom:"◇"};
function choosePlayers(n,size){
 let p=n===2?[0,size*size-1]:n===3?[0,size-1,(size-1)*size+Math.floor(size/2)]:[0,size-1,(size-1)*size,size*size-1];
 return p;
}
function draw(p,count){for(let i=0;i<count;i++){if(!G.deck.length){G.deck=shuffle(G.discard);G.discard=[];}if(G.deck.length)p.hand.push(G.deck.pop());}}
function start(){
 const modeEl=$("#playMode"),mode=modeEl&&modeEl.value?modeEl.value:"local";
 // Headless tests without a set selector retain the original STANDARD rules.
 const setEl=$("#gameSet"),ruleset=setEl&&setEl.value==="starter"?"starter":"standard";
 let n=mode.startsWith("cpu")?Number(mode.slice(3)):Number($("#playerCount").value);
 let size=Number($("#boardSize").value);
 let allStars=[];starCounts[n].forEach((num,value)=>{for(let k=0;k<num;k++)allStars.push(value);});allStars=shuffle(allStars);
 let walls=[];
 const activeKinds=ruleset==="starter"?starterWallKinds:wallKinds;
 const activeWallCounts=ruleset==="starter"?starterWallCounts[n]:wallCounts[n];
 activeWallCounts.forEach((num,j)=>{for(let k=0;k<num;k++)walls.push(activeKinds[j]);});walls=shuffle(walls);
 const presets=["walk","walk","dash","scan","tractor"];
 let deck=[],activeCardCounts=ruleset==="starter"?starterCardCounts:cardCounts;
 Object.keys(activeCardCounts).forEach(k=>{for(let i=0;i<activeCardCounts[k];i++)deck.push(k);});
 let positions=choosePlayers(n,size);
 G={n:size,nplayers:n,ruleset,cpuMode:mode!=="local",round:1,phase:"placement",placementPhase:0,players:[],stars:{},walls:{},queue:[],current:0,actions:0,active:null,selectedSupply:0,dir:1,deck:[],discard:[],logs:[],message:"",privateMessage:"",locked:false};
 for(let id=0;id<n;id++){
  let p={id,cpu:mode!=="local"&&id>0,pos:positions[id],home:positions[id],hand:presets.slice(),stars:[allStars.pop(),allStars.pop()],walls:[walls.pop(),walls.pop()],shield:false,penalty:0};
  G.players.push(p);
  presets.forEach(c=>{let j=deck.indexOf(c);deck.splice(j,1);});
 }
 G.deck=shuffle(deck);
 let neutrals=allStars;
 neutrals.forEach(value=>{
  let candidates=Array.from({length:size*size},(_,i)=>i).filter(i=>positions.every(x=>dist(i,x)>=2)&&!G.stars[i]);
  let i=candidates[Math.floor(Math.random()*candidates.length)];
  if(i!==undefined)G.stars[i]={value,placer:null,claimed:null,seen:[]};
 });
 record("ゲームを開始しました。星の得点は最終発表まで秘密です。");
 beginPlacement(0);
}
function beginPlacement(phase){
 G.placementPhase=phase;G.phase="placement";G.active=null;G.selectedSupply=0;G.dir=1;
 let f=Array.from({length:G.nplayers},(_,i)=>i);
 G.queue=phase===0?f.map(p=>({p,type:"star"})).concat(f.slice().reverse().map(p=>({p,type:"wall"}))):
 f.slice().reverse().map(p=>({p,type:"star"})).concat(f.map(p=>({p,type:"wall"})));
 nextPlacement();
}
function nextPlacement(){
 if(!G.queue.length){
  G.phase="play";G.current=0;G.active=null;G.actions=0;
  record(G.placementPhase===0?"初期配置が完了しました。前半戦開始！":"後半戦開始！");
  handoff();return;
 }
 let step=G.queue[0];G.current=step.p;G.active=null;G.selectedSupply=0;G.dir=1;G.message="";
 handoff();
}
function afterPlacement(){
 G.queue.shift();nextPlacement();
}
function handoff(){
 G.locked=true;G.privateMessage="";
 if($("#backToTitle"))$("#backToTitle").hidden=false;
 if($("#backFromHandoff"))$("#backFromHandoff").hidden=false;
 $("main").style.visibility="hidden";
 const cpu=Boolean(G.players[G.current]&&G.players[G.current].cpu);
 $("#modaltitle").textContent=cpu?"CPUが考えています":"画面を交代してください";
 $("#modaltext").textContent=cpu?"ロケットが次の一手を選んでいます。":G.phase==="placement"?"次は "+human(G.players[G.current])+" の秘密配置です。本人だけが画面を見てください。":"次は "+human(G.players[G.current])+" のターンです。本人だけが画面を開いてください。";
 $("#reveal").hidden=cpu;
 $("#handoff").hidden=false;
 if(cpu&&typeof window!=="undefined"&&window.StarMazeCPU){
  const scheduledGame=G,scheduledPlayer=G.current,scheduledPhase=G.phase;
  window.setTimeout(()=>{
   if(G===scheduledGame&&G.current===scheduledPlayer&&G.phase===scheduledPhase&&G.locked)window.StarMazeCPU.run();
  },0);
 }
}
function unlock(){
 if(G.players[G.current]&&G.players[G.current].cpu)return;
 G.locked=false;$("#reveal").hidden=false;$("#handoff").hidden=true;$("main").style.visibility="visible";
 if(G.phase==="play"&&G.actions===0)G.players[G.current].shield=false;
 render();
}
function placementKind(){return G.queue[0].type;}
function placeStar(i){
 let p=G.players[G.current],v=p.stars[G.selectedSupply];
 if(v===undefined)return info("配置する星を選んでください。");
 if(G.stars[i]||occupied(i,-1)||G.players.some(x=>dist(i,x.pos)<2))return info("星は空きマスで、すべてのロケットから2マス以上離して配置してください。");
 G.stars[i]={value:v,placer:G.current,claimed:null,seen:[G.current]};
 p.stars.splice(G.selectedSupply,1);record(human(p)+" が星を1枚配置しました。");afterPlacement();
}
function wallInitialAllowed(a,b){
 // Initial setup must not close the last exit of any start position, regardless of hidden wall type.
 for(const p of G.players){let open=0;for(let d=0;d<4;d++){
  let j=neighbor(p.pos,d);if(j<0||!free(j,p.id))continue;
  let k=edge(p.pos,j);if(!G.walls[k]&&k!==edge(a,b))open++;
 }if(open===0)return false;}return true;
}
function targetEdge(i){let j=neighbor(i,G.dir);return j>=0?{i,j,k:edge(i,j)}:null;}
function placeWall(i){
 let e=targetEdge(i),p=G.players[G.current];
 if(!e||G.walls[e.k])return info("壁は空いている隣接マス間に設置してください。");
 if(G.placementPhase===0&&!wallInitialAllowed(e.i,e.j))return info("開始時にロケットの全出口を塞ぐことはできません。");
 let kind=p.walls[G.selectedSupply];if(!kind)return info("配置する壁を選んでください。");
 G.walls[e.k]={a:Math.min(e.i,e.j),b:Math.max(e.i,e.j),kind,placer:p.id,seen:[p.id],faceUp:false};
 p.walls.splice(G.selectedSupply,1);record(human(p)+" が秘密の壁を配置しました。");afterPlacement();
}
function knownStar(s){return G.phase==="ended"||s.seen.includes(G.current);}
function knownWall(w){return G.phase==="ended"||w.faceUp||w.seen.includes(G.current);}
function wallMark(w){return knownWall(w)?wallIcons[w.kind]:"?";}
function wallHtml(i,j,where){
 let k=edge(i,j),w=G.walls[k];if(!w)return "";
 return '<button type="button" class="wall '+where+' '+(w.faceUp?"open":"unknown")+'" data-wall="'+k+'" title="壁を調べる／選ぶ" aria-label="'+(knownWall(w)?wallLabels[w.kind]:"秘密の壁")+'">'+wallMark(w)+'</button>';
}
function renderBoard(){
 if(!G)return;
 $("#board").style.setProperty("--n",G.n);
 let h="";
 for(let i=0;i<G.n*G.n;i++){
  let p=G.players.find(p=>p.pos===i),s=G.stars[i],c="",c2="",starlabel="";
  if(s){
   if(s.claimed!==null){c='<span class="token star claimed" style="color:'+colours[s.claimed]+'">⚑</span>';}
   else c='<span class="token star">✦</span>';
   if(knownStar(s))starlabel='<span class="starlabel">'+s.value+'点</span>';
  }
  if(p){c2='<span class="token '+(s&&s.claimed!==null?"dual":"")+'" style="color:'+colours[p.id]+'">🚀'+(p.shield?"<span class=playerdot>🛡</span>":"")+'</span>';}
  h+='<div class="cell" tabindex="0" role="button" data-cell="'+i+'" aria-label="'+(i+1)+'番のマス">'+c+starlabel+c2;
  if(i%G.n!==G.n-1)h+=wallHtml(i,i+1,"e");
  if(i<G.n*(G.n-1))h+=wallHtml(i,i+G.n,"s");
  h+='</div>';
 }
 $("#board").innerHTML=h;
}
function renderScore(){
 let h='<div class="row between"><b>プレイヤーの確保数</b><span class="small muted">点数は最終公開まで秘密</span></div><div class="row">';
 for(const p of G.players){let f=Object.values(G.stars).filter(x=>x.claimed===p.id).length;
 h+='<span class="pill"><span style="color:'+colours[p.id]+'">⚑</span> '+human(p)+'：'+f+'個'+(p.penalty?" / 減点"+p.penalty:"")+'</span>';}
 $("#score").innerHTML=h+"</div>";
}
function dirBtns(prefix){
 return '<div class="actions">'+["↑","→","↓","←"].map((s,d)=>'<button class="btn '+(G.dir===d?"active":"")+'" data-dir="'+d+'" aria-label="'+["上","右","下","左"][d]+'">'+s+'</button>').join("")+'</div>';
}
function renderPlacement(){
 let type=placementKind(),p=G.players[G.current],pool=type==="star"?p.stars:p.walls;
 let h='<div class="banner"><strong>'+human(p)+' の秘密配置</strong><div class="small"> '+(G.placementPhase===0?"ゲーム開始前":"第4ラウンド前")+' / '+(type==="star"?"星":"壁")+'を配置</div></div>';
 h+='<p class="small">この情報は置く本人だけが確認します。他の人には見せないでください。</p><h3>配置する'+(type==="star"?"星":"壁")+'を選択</h3><div class="actions">';
 pool.forEach((v,i)=>{h+='<button class="btn '+(G.selectedSupply===i?"active":"")+'" data-supply="'+i+'">'+(type==="star"?v+"点の星":wallLabels[v])+'</button>';});h+='</div>';
 if(type==="star")h+='<p class="note">① 星カードを選ぶ → ② ロケットから2マス以上離れた空きマスをタップ。点数は秘密です。</p>';
 else h+='<p class="note">① 壁を選ぶ → ② 方向（↑→↓←）を選ぶ → ③ その手前のマスをタップ。壁の正体は相手に秘密です。'+(G.ruleset==="standard"?"一方通行は右・下の正方向のみ通れます。":"")+'</p>'+dirBtns();
 return h;
}
function cardBtn(c,i){let def=defs[c];return '<button class="btn '+def.group+' '+(G.active&&G.active.index===i?"active":"")+'" data-card="'+i+'" title="'+def.desc+'"><span class="cardicon">'+def.icon+'</span>'+def.name+'</button>';}
function blockedPublic(p){
 for(let d=0;d<4;d++){
  let j=neighbor(p.pos,d);if(j<0)continue;
  if(!free(j,p.id))continue;
  let w=G.walls[edge(p.pos,j)];
  if(!w||!w.faceUp||w.kind==="phantom"||(w.kind==="oneway"&&w.a===p.pos))return false;
 }
 return true;
}
function boostDirs(p){let out=[];for(let d=0;d<4;d++){let mid=neighbor(p.pos,d),j=mid>=0?neighbor(mid,d):-1;if(j>=0&&free(j,p.id)&&!G.stars[j])out.push(d);}return out;}
function renderPlay(){
 let p=G.players[G.current],h='<div class="banner"><strong style="color:'+colours[p.id]+'">'+human(p)+'</strong><div class="small">第'+G.round+' / 6ラウンド　・　残り'+(2-G.actions)+'アクション</div></div>';
 h+='<p class="small muted">操作：カードを選択 → 盤面か方向ボタンで実行。星で止まると旗を立てられます。</p>';
 h+='<h3>手札（クリックして使用）</h3><div class="hand">'+p.hand.map(cardBtn).join("")+'</div>';
 h+='<p class="small muted">手札のカードは1枚ずつ使用。効果を使わず1マスだけ歩くこともできます。</p>';
 if(G.active){
  let a=G.active,c=a.card;h+='<div class="note"><b>'+defs[c].name+'</b>：';
  const descriptions={walk:"隣のマスをタップ（残り"+(a.remaining||2)+"歩）。途中で終了できます。",dash:"進む方向を選択。止まるまで直進します。",jump:"方向と距離を選択。障害物を最大1つ越えられます。",scan:"秘密の星または壁をタップして自分だけ確認。",tractor:a.target===undefined?"3マス以内の相手ロケットをタップ。":"相手の移動先となる隣接マスをタップ。",wallmove:a.wallKey===undefined?"移動したい壁をタップ。":"新しい壁の方向を選択後、その手前のマスをタップ。",pull:a.starIndex===undefined?"未確保の星をタップ。":"星を移動する隣接マスをタップ。",shield:""};h+=descriptions[c]+"</div>";
  if(c==="dash")h+=directionAction("dash");
  if(c==="jump")h+=directionAction("jump");
  if(c==="wallmove"&&a.wallKey!==undefined)h+=dirBtns();
  if(c==="walk")h+='<button class="btn soft" data-finish="1">ここで移動終了</button>';
  if(!a.committed)h+='<button class="btn soft" data-cancel="1">カード選択を取り消す</button>';
 }
 h+='<div class="actions"><button class="btn" id="basic" '+(G.actions>=2||G.active&&G.active.committed?"disabled":"")+'>選択カードを捨てて1歩</button>';
 h+='<button class="btn primary" id="endturn">手番終了</button></div>';
 if(!G.active&&G.actions===0&&blockedPublic(p)){
  h+='<div class="note"><b>包囲状態</b>：通常歩行の出口が公開情報で塞がれています。</div>';
  let bs=boostDirs(p);if(bs.length&&p.hand.length>=2){
   h+='<div class="small">緊急ブースト（手札2枚、2アクション）</div><div class="actions">'+bs.map(d=>'<button class="btn bad" data-boost="'+d+'">'+["↑","→","↓","←"][d]+'</button>').join("")+'</div>';
  }else if(!bs.length)h+='<button class="btn bad" id="emergency">緊急帰還（2点減点）</button>';
 }
 return h;
}
function directionAction(type){
 let h='<div class="actions">';
 for(let d=0;d<4;d++){
  if(type==="dash")h+='<button class="btn" data-move="dash-'+d+'">'+["↑","→","↓","←"][d]+'</button>';
  else for(let length=1;length<=2;length++)h+='<button class="btn" data-move="jump-'+d+'-'+length+'">'+["↑","→","↓","←"][d]+length+'</button>';
 }
 return h+'</div>';
}
function render(){
 const backToTitle=$("#backToTitle"),backFromHandoff=$("#backFromHandoff");
 if(backToTitle)backToTitle.hidden=!G;
 if(backFromHandoff)backFromHandoff.hidden=!G;
 if(!G){$("#board").innerHTML="";$("#status").innerHTML='<strong>新しいゲーム</strong>';$("#score").innerHTML="";$("#log").innerHTML="";
 $("#side").innerHTML='<h2 id="startHeading">🚀 まずは1人で遊ぼう</h2><p class="small muted" id="startDescription">CPUと1対1で対戦できます。まずは簡単なスターターがおすすめです。</p>'+
 '<div class="starter-selection"><label for="gameSet"><strong>ゲームセット</strong></label><select id="gameSet"><option value="starter" selected>🌟 スターターセット（おすすめ）</option><option value="standard">スタンダード（従来版）</option></select><div class="starter-intro" id="setDescription"><strong>カード5種類・壁3種類</strong><p>移動：てくてく・流星ダッシュ・ジェットジャンプ<br>効果：宇宙探査・トラクタービーム<br>壁：通常・反発・幻影</p><small>最初は1人＋CPUで練習できます。遊び方は同じ、複雑なカードを減らしたセットです。</small></div></div>'+
 '<div class="formgrid"><label>遊び方<select id="playMode"><option value="cpu2" selected>1人で遊ぶ・CPU1体（おすすめ）</option><option value="cpu3">1人で遊ぶ・CPU2体</option><option value="cpu4">1人で遊ぶ・CPU3体</option><option value="local">友達と遊ぶ・同じ端末で交代</option></select></label><label id="friendCountLabel" hidden>友達と遊ぶ場合の人数<select id="playerCount"><option value="2" selected>2人</option><option value="3">3人</option><option value="4">4人</option></select></label><label>盤面サイズ（検証用）<select id="boardSize"><option value="7" selected>7×7</option><option value="8">8×8</option><option value="9">9×9</option></select></label></div>'+
 '<button class="btn primary start-main" id="start">🚀 スターターでゲームスタート</button><div class="note">開発中の試遊版です。最終点数は星を公開するまで秘密。遠隔オンライン対戦と保存は未実装です。</div>';
 return;}
 $("#status").innerHTML='<div class="row between"><b>'+(G.phase==="ended"?"対戦終了":G.phase==="placement"?"秘密配置フェーズ":"第"+G.round+"ラウンド")+'</b><span class="pill">'+(G.ruleset==="starter"?"🌟 スターター":"スタンダード")+' / '+G.nplayers+'人 / '+G.n+'×'+G.n+'</span></div>';
 renderBoard();renderScore();
 if(G.phase==="ended"){
  let scores=G.players.map(p=>{let total=Object.values(G.stars).filter(s=>s.claimed===p.id).reduce((sum,s)=>sum+s.value,0)-p.penalty;return {p,total};}).sort((a,b)=>b.total-a.total);
  $("#side").innerHTML='<h2>星の得点を公開！</h2><div class="results">'+scores.map(x=>'<div class="result"><span style="color:'+colours[x.p.id]+'">⚑</span> '+human(x.p)+'<br><strong>'+x.total+'点</strong><div class="tiny">減点 '+x.p.penalty+'</div></div>').join("")+'</div><div class="note">獲得した星だけが得点になります。今回は '+names[scores[0].p.id]+'ロケット'+(scores.filter(x=>x.total===scores[0].total).length>1?"たちの同点！":"の勝利！")+'</div><button id="reset" class="btn primary">新しいゲーム</button>';
 }else{
  $("#side").innerHTML=(G.message?'<div class="note">'+G.message+'</div>':"")+(G.privateMessage?'<div class="note">'+G.privateMessage+'</div>':"")+(G.phase==="placement"?renderPlacement():renderPlay());
 }
 $("#log").innerHTML='<h3>公開された出来事</h3><div class="log">'+G.logs.map(x=>'<div>'+x+'</div>').join("")+'</div>';
}
function commit(){
 let a=G.active;if(!a||a.committed)return;
 let p=G.players[G.current];if(G.actions>=2)return;
 let c=p.hand.splice(a.index,1)[0];if(!c)return;
 a.committed=true;G.discard.push(c);G.actions++;G.message="";
}
function claim(p){
 let s=G.stars[p.pos];if(s&&s.claimed===null){
  s.claimed=p.id;record(human(p)+" が星を確保！ 旗が障害物になりました。");
 }
}
function finishAction(p,move){
 if(move)claim(p||G.players[G.current]);G.active=null;render();
}
function revealWall(w){
 if(!w.faceUp){w.faceUp=true;record(wallLabels[w.kind]+" が公開されました。");}
}
function step(p,j,mode){
 let old=p.pos;
 if(j<0||!free(j,p.id))return {blocked:true,bounce:false};
 let w=G.walls[edge(old,j)];
 if(w){
  revealWall(w);
  if(w.kind==="solid"||(w.kind==="oneway"&&old!==w.a))return {blocked:true,bounce:false};
  if(w.kind==="bounce"){
   let ro=rc(old),rj=rc(j),br=ro[0]-(rj[0]-ro[0]),bc=ro[1]-(rj[1]-ro[1]),back=inBoard(br,bc)?br*G.n+bc:-1;
   if(back>=0&&free(back,p.id)&&!G.walls[edge(old,back)])p.pos=back;
   return {blocked:true,bounce:true};
  }
 }
 p.pos=j;return {blocked:false,bounce:false};
}
function moveWalk(i){
 let a=G.active,p=G.players[G.current];if(!a||a.card!=="walk")return;
 if(dist(p.pos,i)!==1)return info("上下左右の隣のマスを選んでください。");
 commit();
 let t=step(p,i,"walk");a.remaining--;
 if(t.blocked)G.message=t.bounce?"反発壁で押し戻されました。":"通行できませんでした。残りの歩数で別の方向を試せます。";
 if(a.remaining<=0||t.bounce){finishAction(p,true);}else render();
}
function startDash(d){
 let a=G.active,p=G.players[G.current];if(!a||a.card!=="dash")return;
 commit();let moved=0;
 for(let i=0;i<G.n;i++){let j=neighbor(p.pos,d);if(j<0)break;let t=step(p,j,"dash");if(t.blocked)break;moved++;}
 G.message=moved?"流星ダッシュで "+moved+"マス進みました。":"障害物のためダッシュできませんでした。";
 finishAction(p,true);
}
function startJump(d,len){
 let a=G.active,p=G.players[G.current];if(!a||a.card!=="jump")return;
 let curr=p.pos,barriers=0;for(let k=0;k<len;k++){
  let j=neighbor(curr,d);if(j<0)return info("盤面の外へは飛べません。");
  let w=G.walls[edge(curr,j)];if(w)barriers++;
  if(k<len-1&&(isFlag(j)||occupied(j,p.id)))barriers++;
  curr=j;
 }
 if(!free(curr,p.id))return info("着地点に旗やロケットがあります。");
 if(barriers>1)return info("ジェットジャンプで越えられる障害物は1つまでです。");
 commit();p.pos=curr;G.message="ジェットジャンプしました。";finishAction(p,true);
}
function inspectStar(i){
 let s=G.stars[i];if(!s)return info("星を選んでください。");
 commit();if(!s.seen.includes(G.current))s.seen.push(G.current);
 G.privateMessage="🔭 この星は "+s.value+"点です（自分だけに表示）。";finishAction(null,false);
}
function inspectWall(k){
 let w=G.walls[k];if(!w)return;commit();if(!w.seen.includes(G.current))w.seen.push(G.current);
 G.privateMessage="🔭 この壁は「"+wallLabels[w.kind]+"」です（自分だけに表示）。";finishAction(null,false);
}
function wallCenter(w){let x=rc(w.a),y=rc(w.b);return [(x[0]+y[0])/2,(x[1]+y[1])/2];}
function moveWall(i){
 let a=G.active,e=targetEdge(i);if(!e)return info("壁を移す場所は盤面内の辺にしてください。");
 if(G.walls[e.k])return info("すでに壁が置かれています。");
 let w=G.walls[a.wallKey];if(!w)return info("元の壁が見つかりません。");
 let c=wallCenter(w),neww={a:Math.min(e.i,e.j),b:Math.max(e.i,e.j)},d=wallCenter(neww);
 if(Math.abs(c[0]-d[0])+Math.abs(c[1]-d[1])>1.01)return info("壁は隣接する辺にしか移動できません。");
 commit();delete G.walls[a.wallKey];w.a=neww.a;w.b=neww.b;G.walls[e.k]=w;
 record("壁が移動しました。");finishAction(null,false);
}
function forcedMove(i){
 let a=G.active,p=G.players[a.target];if(dist(p.pos,i)!==1)return info("相手の隣接マスを選んでください。");
 commit();
 if(p.shield){p.shield=false;G.message="相手のバリアが強制移動を防ぎました。";record(human(p)+" のバリアが消えました。");}
 else{
  let t=step(p,i,"forced");G.message=t.blocked?"強制移動は壁または障害物に阻まれました。":"相手を1マス動かしました。";
  claim(p);
 }finishAction(null,false);
}
function moveStar(i){
 let a=G.active,from=a.starIndex;
 if(dist(from,i)!==1||G.stars[i]||occupied(i,-1)||isFlag(i))return info("星は隣接する空きマスにしか動かせません。");
 commit();G.stars[i]=G.stars[from];delete G.stars[from];record("未確保の星が1マス移動しました。");finishAction(null,false);
}
function onCell(i){
 if(G.phase==="placement"){if(placementKind()==="star")placeStar(i);else placeWall(i);return;}
 if(G.phase!=="play"||!G.active)return;
 let a=G.active;
 if(a.card==="walk"){moveWalk(i);return;}
 if(a.card==="scan"){if(G.stars[i])inspectStar(i);else info("星か壁を選んでください。");return;}
 if(a.card==="tractor"){
  if(a.target===undefined){
   let p=G.players.find(x=>x.pos===i&&x.id!==G.current);
   if(!p||dist(G.players[G.current].pos,p.pos)>3)return info("3マス以内の相手ロケットを選んでください。");
   a.target=p.id;render();
  }else forcedMove(i);
  return;
 }
 if(a.card==="pull"){
  if(a.starIndex===undefined){if(!starAt(i))return info("未確保の星を選んでください。");a.starIndex=i;render();}
  else moveStar(i);return;
 }
 if(a.card==="wallmove"&&a.wallKey!==undefined)moveWall(i);
}
function onWall(k){
 if(G.phase!=="play"||!G.active)return;
 let a=G.active;
 if(a.card==="scan")inspectWall(k);
 else if(a.card==="wallmove"){a.wallKey=k;render();}
}
function selectCard(i){
 if(G.phase!=="play"||G.actions>=2)return;
 if(G.active&&G.active.committed)return info("進行中の移動を終了してください。");
 let p=G.players[G.current],c=p.hand[i];if(!c)return;
 G.active={index:i,card:c,committed:false,remaining:2};
 G.message="";G.privateMessage="";
 if(c==="shield"){commit();p.shield=true;record(human(p)+" がバリアを張りました。");finishAction(null,false);}
 else render();
}
function basic(){
 let a=G.active;
 if(!a||a.committed||G.actions>=2)return info("まず手札から捨てるカードを選んでください。");
 G.active.card="walk";G.active.remaining=1;G.active.basic=true;render();
}
function finishWalk(){
 if(!G.active||G.active.card!=="walk")return;
 if(G.active.committed)finishAction(G.players[G.current],true);
 else {G.active=null;render();}
}
function endTurn(){
 if(G.phase!=="play")return;
 if(G.active&&G.active.committed)finishAction(G.players[G.current],true);
 let p=G.players[G.current];draw(p,5-p.hand.length);
 G.active=null;G.message="";G.privateMessage="";
 G.current++;
 if(G.current>=G.nplayers){
  G.current=0;
  if(G.round>=6||(G.round>=4&&Object.values(G.stars).every(s=>s.claimed!==null))){finishGame();return;}
  G.round++;
  if(G.round===4){record("第4ラウンドの追加配置です。");beginPlacement(1);return;}
 }
 G.actions=0;handoff();
}
function emergencyBoost(d){
 let p=G.players[G.current];if(G.actions!==0||!blockedPublic(p)||p.hand.length<2)return;
 let j=neighbor(p.pos,d);j=j>=0?neighbor(j,d):-1;
 if(j<0||!free(j,p.id)||G.stars[j])return info("安全に着地できる2マス先を選んでください。");
 for(let k=0;k<2;k++)G.discard.push(p.hand.pop());
 G.actions=2;p.pos=j;G.message="緊急ブーストで脱出しました。";record(human(p)+" が緊急ブースト。");claim(p);render();
}
function hasCardEscape(p){
 if(p.hand.includes("jump")){
  for(let d=0;d<4;d++)for(let len=1;len<=2;len++){
   let curr=p.pos,barriers=0,possible=true;
   for(let stepN=0;stepN<len;stepN++){
    let j=neighbor(curr,d);
    if(j<0){possible=false;break;}
    if(G.walls[edge(curr,j)])barriers++;
    if(stepN<len-1&&(isFlag(j)||occupied(j,p.id)))barriers++;
    curr=j;
   }
   if(possible&&barriers<=1&&free(curr,p.id))return true;
  }
 }
 if(p.hand.includes("wallmove")){
  for(let d=0;d<4;d++){
   const j=neighbor(p.pos,d);if(j<0||!free(j,p.id))continue;
   const k=edge(p.pos,j),w=G.walls[k];
   if(!w||!w.faceUp||w.kind==="phantom"||(w.kind==="oneway"&&w.a===p.pos))continue;
   const c=wallCenter(w);
   for(let i=0;i<G.n*G.n;i++)for(let sd=0;sd<4;sd++){
    const q=neighbor(i,sd);if(q<0||G.walls[edge(i,q)])continue;
    const a=rc(i),b=rc(q);
    const ncenter=[(a[0]+b[0])/2,(a[1]+b[1])/2];
    if(Math.abs(c[0]-ncenter[0])+Math.abs(c[1]-ncenter[1])<=1.01)return true;
   }
  }
 }
 return false;
}
function emergencyReturn(){
 let p=G.players[G.current];
 if(G.actions!==0||!blockedPublic(p)||boostDirs(p).length>0||hasCardEscape(p))return info("使える脱出手段があるため、緊急帰還できません。");
 let safe=Array.from({length:G.n*G.n},(_,i)=>i).filter(i=>free(i,p.id)&&!G.stars[i]).sort((a,b)=>dist(a,p.home)-dist(b,p.home)||a-b);
 if(!safe.length)return info("復帰可能な空きマスがありません。ルールを再検証してください。");
 p.pos=safe[0];p.penalty+=2;G.actions=2;G.message="緊急帰還しました。最終得点から2点引かれます。";record(human(p)+" が緊急帰還しました。");render();
}
function finishGame(){
 G.phase="ended";G.active=null;G.message="";G.privateMessage="";G.locked=false;$("#handoff").hidden=true;$("main").style.visibility="visible";
 record("最終得点を公開しました。");render();
}
function reset(){G=null;$("main").style.visibility="visible";$("#handoff").hidden=true;$("#reveal").hidden=false;render();}
function returnToTitle(){
 if(!G)return;
 if(!window.confirm("対戦を終了してタイトルへ戻りますか？\n現在の進行状況は保存されません。"))return;
 reset();
}
if($("#backToTitle"))$("#backToTitle").addEventListener("click",returnToTitle);
if($("#backFromHandoff"))$("#backFromHandoff").addEventListener("click",returnToTitle);
$("#reveal").addEventListener("click",unlock);
document.addEventListener("change",e=>{
 if(e.target.id==="gameSet"){
  const starter=e.target.value==="starter";
  $("#setDescription").innerHTML=starter?'<strong>カード5種類・壁3種類</strong><p>移動：てくてく・流星ダッシュ・ジェットジャンプ<br>効果：宇宙探査・トラクタービーム<br>壁：通常・反発・幻影</p><small>初めて遊ぶ人向けの基本セットです。</small>':'<strong>カード8種類・壁4種類</strong><p>スターターに壁の移動・星の引力・宇宙バリアと一方通行壁を追加した従来版。</p><small>複雑なカードを試したい人向けです。</small>';
  const solo=$("#playMode").value!=="local";
  $("#start").textContent=(solo?"🚀 ":"👥 ")+(starter?"スターターでゲームスタート":"スタンダードでゲームスタート");
  return;
 }
 if(e.target.id!=="playMode")return;
 const single=e.target.value!=="local";
 const friendCountLabel=$("#friendCountLabel");
 if(friendCountLabel)friendCountLabel.hidden=single;
 $("#startHeading").textContent=single?"🚀 まずは1人で遊ぼう":"👥 友達と遊ぼう";
 $("#startDescription").textContent=single?"CPUと対戦できます。初めての方はCPU1体がおすすめです。":"2〜4人が同じ端末を交代しながら対戦します。";
 $("#start").textContent=(single?"🚀 ":"👥 ")+($("#gameSet").value==="starter"?"スターターでゲームスタート":"スタンダードでゲームスタート");
});
document.addEventListener("click",e=>{
 let b=e.target.closest("button");if(!b||G&&G.locked)return;
 if(b.id==="start")return start();
 if(b.id==="reset")return reset();
 if(b.hasAttribute("data-dir")){G.dir=Number(b.dataset.dir);render();return;}
 if(b.hasAttribute("data-supply")){G.selectedSupply=Number(b.dataset.supply);render();return;}
 if(b.hasAttribute("data-card")){selectCard(Number(b.dataset.card));return;}
 if(b.hasAttribute("data-finish")){finishWalk();return;}
 if(b.hasAttribute("data-cancel")){if(G.active&&!G.active.committed)G.active=null;render();return;}
 if(b.id==="basic"){basic();return;}
 if(b.id==="endturn"){endTurn();return;}
 if(b.hasAttribute("data-move")){let [c,d,len]=b.dataset.move.split("-");if(c==="dash")startDash(Number(d));else startJump(Number(d),Number(len));return;}
 if(b.hasAttribute("data-boost")){emergencyBoost(Number(b.dataset.boost));return;}
 if(b.id==="emergency"){emergencyReturn();return;}
});
$("#board").addEventListener("click",e=>{
 if(!G||G.locked)return;let w=e.target.closest("[data-wall]");if(w){onWall(w.dataset.wall);return;}
 let c=e.target.closest("[data-cell]");if(c)onCell(Number(c.dataset.cell));
});
$("#board").addEventListener("keydown",e=>{
 if((e.key==="Enter"||e.key===" ")&&e.target.hasAttribute("data-cell")){e.preventDefault();onCell(Number(e.target.dataset.cell));}
});
render();
