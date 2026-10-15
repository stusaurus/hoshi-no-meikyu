"""Analyze paired CPU experiments; resample initial seeds, not rotations."""
import csv, gzip, json, random
from collections import defaultdict
from pathlib import Path

root = Path('docs/balance-2026-10-15')
datasets = ['screen-a','screen-b','skill-web','phase-screen','phase-web-2p','phase-web-multi','horizon-4','horizon-5','horizon-6','contested','halves-varied','halves-contested']
games = {name: json.loads(gzip.decompress((root/name/'games.json.gz').read_bytes())) for name in datasets}
screen = games['screen-a'] + games['screen-b']
rows = []
def mean(a): return sum(a)/len(a) if a else 0
def win(g, id=0): return 1/len(g['winners']) if id in g['winners'] else 0
def ci(a, seed=217):
 rng = random.Random(seed)
 samples = sorted(mean([rng.choice(a) for _ in a]) for _ in range(4000))
 return samples[int(.025*len(samples))], samples[int(.975*len(samples))]
def summarize(games, dataset):
 groups = defaultdict(list)
 for g in games: groups[g['count'],g['size'],g['policy'],g['variant']].append(g)
 for (count,size,policy,variant),g in sorted(groups.items()):
  shares = [mean([win(x,i) for x in g]) for i in range(count)]
  seeds = defaultdict(list)
  for x in g: seeds[x['seed']].append(win(x))
  lower,upper = ci([mean(a) for a in seeds.values()])
  actions = [a for x in g for a in x['actions']]
  rows.append(dict(dataset=dataset,count=count,size=size,policy=policy,variant=variant,n=len(g),initial_seeds=len(seeds),unique_openings=len({x['openingKey'] for x in g}),first=shares[0],first_low=lower,first_high=upper,spread=max(shares)-min(shares),win_shares='/'.join(f'{x:.4f}' for x in shares),draw=mean([len(x['winners'])>1 for x in g]),capture=mean([x['capture'] for x in g]),margin=mean([x['margin'] for x in g]),blowout=mean([x['margin']>=6 for x in g]),repeat=sum(x['repeated'] for x in g)/max(1,sum(x['transitions'] for x in g)),passes=mean([sum(t['pass'] for t in x['turns']) for x in g]),rounds=mean([x['round'] for x in g]),scan=sum(a['card']=='scan' for a in actions)/max(1,len(actions)),tractor=sum(a['card']=='tractor' for a in actions)/max(1,len(actions))))
summarize(screen,'screen')
summarize(games['skill-web'],'skill-web')
for name in datasets[3:]: summarize(games[name],name)
with (root/'comparison.csv').open('w') as f:
 writer=csv.DictWriter(f,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)
paired=[]
for count in [2,3,4]:
 for size in [7,8,9]:
  subsets={v:[g for g in screen if (g['count'],g['size'],g['variant'])==(count,size,v)] for v in {g['variant'] for g in screen}}
  baseline={g['seed']:[] for g in subsets['unlimited-fixed']}
  for g in subsets['unlimited-fixed']:baseline[g['seed']].append(win(g))
  for variant,records in sorted(subsets.items()):
   seeds=defaultdict(list)
   for g in records:seeds[g['seed']].append(win(g))
   delta=[mean(seeds[s])-mean(baseline[s]) for s in sorted(seeds)]
   lo,hi=ci(delta);paired.append(dict(count=count,size=size,variant=variant,delta=mean(delta),low=lo,high=hi))
with (root/'paired-differences.csv').open('w') as f:
 w=csv.DictWriter(f,fieldnames=list(paired[0]));w.writeheader();w.writerows(paired)
text='''# 星の迷宮・新版の追加バランス比較（2026-10-15）

## 比較条件と証拠の範囲

固定の公開星1/2/3点、初期2枚・後半1枚、旗が障害物、1手番1行動、前半6巡＋後半6巡をすべて維持。使い放題と、各半に歩き2・ダッシュ2・ジャンプ2・探査1・トラクター1を使うと減る8枚案を比較した。有限案は後半開始時に全員を同じ8枚に戻し、余りは持ち越さない。手番順は固定／毎巡の開始者を循環／奇数巡と偶数巡で逆順、の3案。

主比較は人数2/3/4×盤7/8/9×6案×24初期乱数×人数²の座席・壁供給のローテーション。合計12,528試合。星の前半組合せを3通りで均等に扱い、CPUの配置位置は上位の近い候補から再現可能な選択を行う。これはプレイヤーの合法な選択を広げた実験で、新たな配布運をゲームに入れたものではない。

追加の4,176試合は、公開Web CPUと同じ配置・前半星1点と2点のパターンを維持。点数と次の星への距離を重視するvalue方策、およびcollect/value/control/randomをプレイヤーの役割に割り当てるmixedを各12初期乱数で比較した。value/controlは独立した重み付けの感度検証であり、最適AIや人間の技能を再現したものではない。

同じ乱数の座席ローテーションは対応があり、独立試合ではない。参考区間は初期乱数単位のクラスターブートストラップ4,000回。多重比較の調整はしておらず、機械的に最小値の盤面を最適と認定しない。元の公開エンジンを `source/` に固定して比較した。

## 先手勝率・全座席の偏り

勝率は同点で按分。公平な目安は2人50%、3人33.3%、4人25%。「先手」は第1巡に最初に動いた人を意味し、以後の開始者が変わる案でも同じプレイヤーを追跡する。

| 人数 | 盤 | 使い放題・固定 | 有限・固定 | 使い放題・開始者循環 | 有限・開始者循環 | 使い放題・逆順交代 | 有限・逆順交代 |
|---:|---:|---:|---:|---:|---:|---:|---:|
'''
variants=['unlimited-fixed','finite-fixed','unlimited-cyclic','finite-cyclic','unlimited-snake','finite-snake']
for count in [2,3,4]:
 for size in [7,8,9]:
  r=[next(x for x in rows if (x['dataset'],x['count'],x['size'],x['policy'],x['variant'])==('screen',count,size,'collect',v)) for v in variants]
  text+=f'| {count} | {size} | '+' | '.join(f"{x['first']:.1%}" for x in r)+' |\n'
text+='''
## 行動・圧勝・回収の比較

圧勝は「1位と2位が6点差以上」と定義した。連続使用率は同じプレイヤーの連続したカード行動で同じ種類を選ぶ割合（パス・救済は除く）。これが下がっても、戦略の奥深さを証明するものではない。探査・妨害は直接得点がないため、使用率だけから価値を認定しない。

| 人数 | 盤 | 使い放題→有限循環の全座席勝率差 | 平均点差 | 6点差以上 | 同じカードの連続使用 | 星回収率 | パス/試合 |
|---:|---:|---|---|---|---|---|---|
'''
for count in [2,3,4]:
 for size in [7,8,9]:
  a,b=[next(x for x in rows if (x['dataset'],x['count'],x['size'],x['policy'],x['variant'])==('screen',count,size,'collect',v)) for v in ['unlimited-fixed','finite-cyclic']]
  text+=f'| {count} | {size} | '+ ' | '.join([f"{a['spread']:.1%}→{b['spread']:.1%}",f"{a['margin']:.2f}→{b['margin']:.2f}",f"{a['blowout']:.1%}→{b['blowout']:.1%}",f"{a['repeat']:.1%}→{b['repeat']:.1%}",f"{a['capture']:.1%}→{b['capture']:.1%}",f"{a['passes']:.2f}→{b['passes']:.2f}"])+ ' |\n'
text+='''
## 別方策と公開Web配置による確認

| 人数 | 盤 | 方策 | 使い放題・固定→有限・開始者循環の先手勝率 | 全座席勝率差 | 点差 |
|---:|---:|---|---|---|---|
'''
for count in [2,3,4]:
 for size in [7,8,9]:
  for policy in ['value','mixed']:
   a,b=[next(x for x in rows if (x['dataset'],x['count'],x['size'],x['policy'],x['variant'])==('skill-web',count,size,policy,v)) for v in ['unlimited-fixed','finite-cyclic']]
   text+=f'| {count} | {size} | {policy} | '+ ' | '.join([f"{a['first']:.1%}→{b['first']:.1%}",f"{a['spread']:.1%}→{b['spread']:.1%}",f"{a['margin']:.2f}→{b['margin']:.2f}"])+ ' |\n'
text+='''
## 再現・原記録

```bash
node tests/strategy-balance-engine.cjs
node scripts/strategy-balance.cjs --seeds=24 --variants=unlimited-fixed,finite-fixed,unlimited-cyclic --out=docs/balance-2026-10-15/screen-a
node scripts/strategy-balance.cjs --seeds=24 --variants=finite-cyclic,unlimited-snake,finite-snake --out=docs/balance-2026-10-15/screen-b
node scripts/strategy-balance.cjs --seeds=12 --variants=unlimited-fixed,finite-cyclic --policies=value,mixed --opening=web --out=docs/balance-2026-10-15/skill-web
python3 scripts/strategy-balance-report.py
```

各 `games.json.gz` に全試合の得点・獲得・行動・巡別順序・手札残数・初期局面ハッシュを保存。得点保存、全員同じ巡数、有限カードの各半の使用上限を各試合の実行中にも検証。詳細な勝率・区間・実際に異なる初期局面数は `comparison.csv`、対応あり差の参考区間は `paired-differences.csv`。

人間の再戦希望、考える時間、同点の体感、駆け引きの楽しさは未測定。これらのCPU試合を「面白さを保証した検証」とは扱わない。
'''
(root/'REPORT.md').write_text(text)
print('Generated report: '+str(sum(map(len,games.values())))+' saved simulation records')

# Supplementary experiments report separately; treatments have different budgets
# or placement policies, so their rows must not be pooled into one win rate.
extra = '''
## 追加監査で見つかった問題と暫定採用

合計27,168試合（主比較16,704＋後半先手変更2,976＋手数比較5,184＋競合配置1,152＋前後半だけ交代1,152）。既存データを含めた検証件数であり、すべてを新規に実行した件数ではない。

**カードを有限にし、毎巡の開始者を交代する案を、比較試遊として追加した。バランス完成版とは認定しない。** 有限版はゲームセットから選べる。公開反映・CIの状況は [PR #1](https://github.com/stusaurus/hoshi-no-meikyu/pull/1) を参照。基本の星の配布・公開、設置枚数は変更しない。前半6巡・後半6巡、各半8枚の同一手札、未使用カードは持ち越さず後半でリセットする。

従来の表の「先手勝率」は引き分けを按分する。50%付近でも引き分けが多ければ、競り合いを保証しない。追加比較では、独占勝利と引き分けを別に記録した。2人7×7、48初期乱数×4回転＝各条件192試合。

| 配置・判断 | 方式 | 先手単独勝ち | 引き分け | 後手単独勝ち | 先手の按分勝率 |
|---|---|---:|---:|---:|---:|
'''
for dataset,policy in [('horizon-6','collect'),('horizon-6','value'),('contested','value'),('contested','control')]:
 for variant in ['unlimited-fixed','finite-cyclic']:
  gs=[g for g in games[dataset] if g['policy']==policy and g['variant']==variant]
  solo=lambda id:mean([g['winners']==[id] for g in gs])
  label=('通常候補配置' if dataset=='horizon-6' else '競合する配置')+'/'+policy
  extra+=f"| {label} | {'使い放題・固定順' if variant=='unlimited-fixed' else '有限・毎巡交代'} | {solo(0):.1%} | {mean([len(g['winners'])>1 for g in gs]):.1%} | {solo(1):.1%} | {mean([win(g) for g in gs]):.1%} |\n"
extra+='''
通常候補配置では有限案の先手按分勝率はほぼ50%だが、約8割が引き分け。競合配置では引き分けは減る一方、先手より後手が有利になる条件もある。「先手差を解消した」「最適盤面は7×7」と断定できない。

競合配置は星を両者から等距離に近い中央寄りの合法マスに置くCPU方策。新しい配置制限や星のランダム配布を導入したわけではない。星を置く考え方で結果が大きく変わることを調べる感度分析であり、人間が必ずそのように配置するという予測ではない。controlは近接争奪とトラクター妨害を重視する方策。

### 手数だけを短縮しても解決しない

| 各半の最大巡数 | 使い放題・固定順の引き分け | 有限・毎巡交代の引き分け | 有限・毎巡交代の星回収率 |
|---:|---:|---:|---:|
'''
for half in [4,5,6]:
 a,b=[next(r for r in rows if r['dataset']==f'horizon-{half}' and r['policy']=='collect' and r['variant']==v) for v in ['unlimited-fixed','finite-cyclic']]
 extra+=f"| {half} | {a['draw']:.1%} | {b['draw']:.1%} | {b['capture']:.1%} |\n"
extra+='''
4巡でも星は約98%回収され、引き分けが多い。短くするだけで争奪やカード温存の価値が十分増えるとは言えない。手数変更は公開試遊へ採用しない。

### 判断差と順番差を分ける

value対randomを、方策・初期位置・壁供給を入れ替えて実行した（duel）。randomは合法行動候補から選ぶだけで、配置と脱出救済は通常CPUと同じ。valueは多手先探索AIではない。
'''
for v in ['unlimited-fixed','finite-cyclic']:
 gs=[g for g in games['horizon-6'] if g['policy']=='duel' and g['variant']==v]
 share=mean([win(g,g['identities'].index(0)) for g in gs])
 extra+=f"- {'使い放題・固定順' if v=='unlimited-fixed' else '有限・毎巡交代'}：value側の按分勝率 {share:.1%}。\n"
extra+='''
判断の有無は結果に効くが、有限カードの方が人間にとって奥深いとはこの比較だけでは証明しない。value/control/collectも一手評価の近い親戚であり、方策の独立性には限界がある。

後半の先手を逆転しつつ毎巡交代するfinite-phaseも2,976試合比較したが、3人・4人の全座席偏りや、2人の引き分けを一貫して改善しない。さらに「前半は順番固定、後半だけ逆転」のfinite-halvesは通常配置で約50%でも競合配置では先手按分勝率60.9〜62.5%。いずれも試遊の標準順には採用しない。実装した比較試遊の順番は全人数で「毎巡、開始者を1人ずらす」にそろえた。

### 残る設計課題

有限カードで連打は減らせるが、同点の多さ・配置方策への依存・後手偏りは残る。次の設計対象は「同じ星を奪い合う価値があるか」「移動以外の1手を使うと勝ちに近づくか」。星配置制限、探査・トラクターの効果、移動量の変更はこの比較では最終決定していない。点数への後付け補正や例外ルールを急いで増やさない。

### 追加比較の再現

```bash
for h in 4 5 6; do
  node scripts/strategy-balance.cjs --seeds=48 --counts=2 --sizes=7 --variants=unlimited-fixed,finite-cyclic,finite-phase --policies=collect,value,duel --halfTurns=$h --out=docs/balance-2026-10-15/horizon-$h
done
node scripts/strategy-balance.cjs --seeds=24 --variants=finite-phase --out=docs/balance-2026-10-15/phase-screen
node scripts/strategy-balance.cjs --seeds=24 --counts=2 --sizes=7 --variants=finite-phase --policies=collect,value,mixed --opening=web --out=docs/balance-2026-10-15/phase-web-2p
node scripts/strategy-balance.cjs --seeds=12 --counts=3,4 --sizes=7 --variants=finite-phase --policies=value,mixed --opening=web --out=docs/balance-2026-10-15/phase-web-multi
node scripts/strategy-balance.cjs --seeds=48 --counts=2 --sizes=7 --variants=unlimited-fixed,finite-cyclic --policies=value,control,mixed --opening=contested --out=docs/balance-2026-10-15/contested
node scripts/strategy-balance.cjs --seeds=48 --counts=2 --sizes=7 --variants=finite-halves --policies=collect,value,control --out=docs/balance-2026-10-15/halves-varied
node scripts/strategy-balance.cjs --seeds=48 --counts=2 --sizes=7 --variants=finite-halves --policies=value,control,mixed --opening=contested --out=docs/balance-2026-10-15/halves-contested
python3 scripts/strategy-balance-report.py
node tests/strategy-balance-data.cjs
node tests/balanced.cjs
```
'''
with (root/'REPORT.md').open('a') as f:f.write(extra)
