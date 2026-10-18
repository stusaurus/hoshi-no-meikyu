"""Generate audit tables from actual VM game records. No rules are changed."""
import json, csv, gzip, random, statistics, hashlib
from pathlib import Path
root=Path('docs/audit-2026-10-14')
names=['data-current','data-baseline','data-experiment','data-fairness-extra','data-standard-control']
def raw(n):
 p=root/n/'games.json'
 return p.read_bytes() if p.exists() else gzip.decompress(p.with_suffix('.json.gz').read_bytes())
data={n:json.loads(raw(n)) for n in names}
meta={n:json.loads((root/n/'summary.json').read_text()) for n in names}
avg=lambda a:statistics.mean(a) if a else 0
pct=lambda x:f'{x*100:.1f}%'
share=lambda g,i:1/len(g['winners']) if i in g['winners'] else 0
subset=lambda n,p,s,policy:[g for g in data[n] if g['count']==p and g['size']==s and g['policy']==policy]
def ci(games):
    groups={}
    for g in games:groups.setdefault(g['seed'],[]).append(share(g,0))
    a=[avg(v) for v in groups.values()];rng=random.Random(9917)
    means=sorted(avg([rng.choice(a) for _ in a]) for _ in range(2000))
    return f'{pct(means[49])}〜{pct(means[1949])}'
def strict_reverse(g):
    if len(g['roundScores'])<2:return False
    scores=g['roundScores'][-2]['scores'];leaders={i for i,v in enumerate(scores) if v==max(scores)}
    return not leaders.intersection(g['winners'])
def summarise(g):
    return [pct(avg([x['capture'] for x in g])),pct(avg([share(x,0) for x in g])),f'{avg([x["round"] for x in g]):.2f}',f'{avg([x["margin"] for x in g]):.2f}',pct(avg([strict_reverse(x) for x in g]))]
# Older raw records used the same key for claim counts and claim events.
# Recover counts exactly from recorded successful claims; no new matches are invented.
for name,games in data.items():
 for g in games:
  if 'claimCounts' not in g:g['claimCounts']=[sum(c['id']==i for c in g['claims']) for i in range(g['count'])]
 for row in meta[name]['summary']:
  group=[g for g in games if g['count']==row['count'] and g['size']==row['size'] and g['policy']==row['policy']]
  row['claims']=[avg([g['claimCounts'][i] for g in group]) for i in range(row['count'])]
 (root/name/'summary.json').write_text(json.dumps(meta[name],ensure_ascii=False,indent=2))
lines=['# 星の迷宮 ゲーム性・デザイン・UX監査（2026-10-14）',
'', '**結論：初期55点 → 改善後65点。Web試遊は改善したが、正式製品化は保留。先手公平性と秘密情報の戦略価値が残る。**',
'', '13分野を等重み平均し四捨五入。点数はコード・対戦データ・画面を基にした専門判断で、人間の満足度測定ではない。既存アートを変更せず、正式ルール・盤面サイズも変更していない。',
'', '## 採点（100点満点）','', '| 分野 | 初期 | 改善後 | 根拠・残る条件 |','|---|---:|---:|---|']
rows=[('ゲーム性・戦略性',60,60,'旗と秘密壁の組合せは有望。ほぼ全星回収で探査の機会費用が重い'),('ランダム性と実力',55,55,'配点と配置運を含む。独立した強いCPU／人間の技能差を未測定'),('先手・後手公平性',40,30,'新スターターの32乱数×座席×手番で偏りが残る。配置順・手番・CPU方策の因果分解は未完'),('リプレイ性',60,60,'毎回配置は変わるが、人間の再戦希望は未測定'),('初心者理解',50,70,'壁の境界操作、途中星を拾わないこと、補充を説明。初心者被験者は未実施'),('操作快適さ',50,75,'盤面／手札移動、拡大縮小、選択状態、無効化、再開始の縮小状態リセット'),('CPU対戦の面白さ',45,50,'秘密参照・バリア失効を修正。Web CPUの基本方策・先読み深さは従来と同じ'),('ビジュアル統一',75,80,'同じアトラスのまま壁の縦横比を維持。元高解像度シートとの一致は未確認'),('キャラクター魅力',80,80,'白機体・黒窓・4色・茶色の足を維持。絵そのものは変更なし'),('カード・星・壁・旗視認性',45,75,'可読な効果文、駒拡大、公開壁の実線／秘密壁の点線、壁選択一覧'),('スマホ完成度',40,70,'320px9盤セル26→44.4px。全盤を一度に見るには縮小または横移動が必要。実機タッチ未検証'),('技術品質',65,85,'両セット全18盤面人数条件、ブラウザ18条件、秘密情報回帰、ZIPのfile://動作とCI確認'),('実物製造可能性',55,55,'部品構成は整理済。高解像度印刷データ・旗供給・駒原型・見積・実物試作は未検証')]
for a,b,c,d in rows:lines.append(f'| {a} | {b} | {c} | {d} |')
lines+=['',f'初期平均 {avg([x[1] for x in rows]):.2f}、改善後平均 {avg([x[2] for x in rows]):.2f}。公平性の新データは評価を下げた。100点に合わせる採点はしていない。',
'', '## 重大問題と修正','', '| 優先度 | 問題 | 対応 |','|---|---|---|',
'| P1 | ZIP・Pages組み立てに画像なし | assetsの相対パスを保って同梱。ZIP内画像が元とバイト一致、展開file://で840px画像読込・ゲーム開始を確認 |',
'| P1 | CPUトラクターが相手だけが知る壁を参照 | 移動する相手と情報を読むCPUを分離。秘密種類を書き換えて候補が変わらない回帰テスト |',
'| P1 | CPUバリアが次手番に失効しない | CPU手番開始で解除。標準版のみのバグを修正 |',
'| P1 | スマホ盤の駒と操作が小さい | 44px以上のマスを標準に。盤内部横移動・全体縮小・手札への移動を追加 |',
'| P1・未解決 | 先手偏り・情報行動の価値 | ルール変更は承認待ち。サイズだけで解決すると断言しない |',
'| P2 | 壁画像の縦横変形 | 元の174:88（表）／174:90（裏）を維持、境界の縦壁は回転 |',
'| P2 | 選択した歩行カード消費後に次カードが選択表示される | 消費後は他カードを選択表示しない。移動途中は別カードを無効化 |',
'| P2 | 縮小状態が再戦へ残りボタン表示と不一致 | 再開始で拡大とaria-pressedを同期 |',
'| P2 | 交代中の裏画面にキーボード操作が残る | mainにinert、交代ボタンへ焦点移動。開く／終了／タイトルで解除 |',
'| P2 | 探査済みの壁を再確認しにくい | 自分が知る壁のメモ、探査時の44px一覧ボタン（未観測種類を含めない） |',
'| P2 | 同点結果に勝者全員の表示なし | 同点全員を列挙、終了時の得点公開説明を修正 |',
'| P2・未解決 | 初心者理解・15〜20分・製造データ不足 | 試遊シナリオと記録シート、製造BOMを作成 |',
'','P0（致命的停止・データ破壊）は今回の再現ケースではなし。これは全状態の無欠陥保証ではない。',
'', '## 新規スターター対戦の方法','',
'初期コード `74b93a489f7be7f87b5f47abd7f5586d224e10bb` と修正後のgame.js/cpu.jsをNode VMで実行。表示renderのみ省略し、カード合法性・配置・得点・補充・終了はWebと同じエンジン。候補の重み付けだけをVM内部で変更し、Web正式設定にCPU難易度や実験ルールを追加していない。',
'', '- 回収：既存CPU。妨害：得点しそうな相手を遠ざけるトラクター候補に加点。探索：未観測の星／壁の探査候補に加点。ランダム：合法候補からランダム。混合：同一試合にこれらの方策を割当。',
'- 開始位置集合を固定し、その所有者を循環。さらに私的な星／壁の持ち物・CPU方策を含むプレイヤーを手番スロットへ循環し、位置と手番を別々に比較。3人では下辺中央と上角の非対称な開始集合を維持。',
'- 乱数はLCG、`20261014 + 人数*1000000 + 盤サイズ*10000 + seedIndex*8191`。初手は現行の各カード1枚、青3＋紫2。',
'- 同じseedのローテーションは対応ありで相関する。試合数を独立サンプル数とみなさない。探索・妨害の強い加点は感度確認用で、人間の最適戦略ではない。',
'- 探索／トラクターの将来の因果的得点貢献は未推定。直接得点と方策別勝率は代理指標。ランダム候補はカード別の一様抽選ではない。',
'', '| データ | 完了試合 | 初期乱数/人数・盤面 | 内容 |','|---|---:|---:|---|']
for n,label in [('data-current','修正後スターター'),('data-fairness-extra','公平性の追加回収方策'),('data-baseline','修正前スターター'),('data-experiment','5ラウンド実験'),('data-standard-control','従来標準版の別対照')]:
 m=meta[n];lines.append(f'| [{label}]({n}/summary.json) | {m["completed"]} | {m["seeds"]} | エラー {len(m["failures"])}・{m["seconds"]:.1f}秒 |')
lines+=['',f'合計 {sum(x["completed"] for x in meta.values()):,} 試合。修正後スターターは5方策3,480＋回収追加2,088＝5,568試合。公平性の回収方策は32独立初期乱数、2人128／3人288／4人512試合を各盤面で比較。32乱数以外の方策は8乱数のため精密な技能推定には不足。',
'', f'実行環境：{meta["data-current"]["environment"]}。機械処理時間を人間の対戦時間と読み替えない。再現コマンドは本書末尾。',
'', '## 先手・サイズ別（回収方策、32初期乱数）','',
'勝率は同点勝者で按分。区間は初期seed単位のクラスターブートストラップ2,000回、95%参考区間。CPU・配置方策を固定した比較であり、ルールのみの因果効果ではない。',
'', '| 人数 | 盤 | 試合 | 手番別勝率（先→後） | 先手区間 | 手番別平均点 | 手番別獲得星 | 確保率 | 点差 | 終了R | 独占逆転 |','|---:|---:|---:|---|---|---|---|---:|---:|---:|---:|']
for p in [2,3,4]:
 for s in [7,8,9]:
  g=subset('data-current',p,s,'collect')+subset('data-fairness-extra',p,s,'collect')
  win=' / '.join(pct(avg([share(x,i) for x in g])) for i in range(p));scores=' / '.join(f'{avg([x["scores"][i] for x in g]):.2f}' for i in range(p));claims=' / '.join(f'{avg([x["claimCounts"][i] for x in g]):.2f}' for i in range(p));z=summarise(g)
  lines.append(f'| {p} | {s} | {len(g)} | {win} | {ci(g)} | {scores} | {claims} | {z[0]} | {z[3]} | {z[2]} | {z[4]} |')
lines+=['','独占逆転＝最後の直前ラウンドの実得点首位と最終勝者に重なりがない試合。未公開得点を事後計算した指標で、プレイヤーの体感逆転ではない。原データのreversalは同点首位への新規参入も含むため区別した。',
'', '公平な目安は2人50%、3人33.3%、4人25%。多くの条件で先手比率が高い。7→8→9の単調な改善ではないため、盤面を広げるだけで解決すると言えない。初手行動・私的配置・到達位置・後半配置順・CPUの近距離回収の影響を人間比較と個別実験で切り分ける。',
'', '## 方策別の全45条件','', '| 人数 | 盤 | 方策 | 試合 | 確保率 | 先手 | 終了R | 点差 | 独占逆転 | 壁公開率 | 包囲手番/戦 | 不動・カード未消費手番/戦 |','|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|']
for r in meta['data-current']['summary']:
 g=subset('data-current',r['count'],r['size'],r['policy']);z=summarise(g)
 lines.append(f'| {r["count"]} | {r["size"]} | {r["policy"]} | {r["n"]} | '+ ' | '.join(z) +f' | {pct(r["wallReveal"])} | {r["blocked"]:.2f} | {r["noAction"]:.2f} |')
lines+=['','包囲＝手番開始時に公開情報で通常歩行出口なし。未消費不動には戦略的パスも含まれ、完全な行き詰まりと同一ではない。緊急ブースト／帰還はJSONのrescuesに分離保存。',
'', '## カード5種類の使用と価値','', '| カード | 本来効果の使用 | 1歩代用 | 本来効果で自分移動成功 | 新情報確認 | 相手移動成功 | 本来効果の直接得点 | 1歩代用の得点 | 相手へ渡した点 |','|---|---:|---:|---:|---:|---:|---:|---:|---:|']
actions=[a for g in data['data-current'] for a in g['actions']]
for card in ['walk','dash','jump','scan','tractor']:
 a=[x for x in actions if x['card']==card];effect=[x for x in a if not x['basic']];basic=[x for x in a if x['basic']]
 lines.append(f'| {card} | {len(effect)} | {len(basic)} | {sum(x["moved"] for x in effect)} | {sum(x["learned"] for x in effect)} | {sum(x["rivalMoved"] for x in effect)} | {sum(x["points"] for x in effect)} | {sum(x["points"] for x in basic)} | {sum(x["giftPoints"] for x in effect)} |')
lines+=['', '本来効果の使用＝カードが消費された行動。成功は移動／新情報／相手移動という別指標で表示。例えば通常壁への歩行は消費されても移動成功ではない。青・紫カードを捨てて基本1歩に代用した点を本来効果へ加算しない。',
'', '- **てくてく**：曲がれる・止まれるため狙った星で終える価値がある。弱い代用カードとは断定できない。壁に阻まれても残る1歩を別方向へ使えるが、CPUは事前に決めた2歩で再最適化しない。',
'- **流星ダッシュ**：長距離移動に強いが途中の星を拾わず、停止位置が旗／壁に依存。直接回収数だけで万能とは言えない。ダッシュの壁に対するリスク評価は粗い。',
'- **ジェットジャンプ**：1障害物・最大2マス・着地に旗不可。2連続壁は越えられず、壁全部の価値を消す実装ではない。未知幻影も「置かれたタイル」として障害物数に数えるのは現行ルール。変更候補にするなら承認が必要。',
'- **宇宙探査**：情報取得には成功するが直接得点ゼロ。本来効果を使わず基本1歩として捨てるケースあり。全星回収率が高いほど「どれを取るか」の価値が薄い。探索重視の勝率は情報を強制的に集める機会費用を含み、カード無価値の証明ではない。',
'- **トラクタービーム**：本来効果は基本的に相手移動。CPUは意図的に星を贈る移動を避けるため、相手獲得の危険を人間同等には測定していない。反発に押された先の星獲得を含むgiftPointsを記録。直接自分得点ゼロでも位置妨害の将来価値は未推定。',
'- **移動3＋効果2**：移動事故を減らすが、効果を保持したまま青2枚消費ができる。そのため探査／トラクターを保持する機会費用と、使う1アクションの費用は別。手札比率が適正かを今回のCPUだけで確定しない。',
'', '## 壁・旗・秘密星の読み合い','', '| 条件 | 通常境界への移動試行 | 反発境界 | 幻影境界 | 平均壁公開率 | ブースト | 帰還 |','|---|---:|---:|---:|---:|---:|---:|']
for policy in ['collect','sabotage','explore','random','mixed']:
 g=[x for x in data['data-current'] if x['policy']==policy];contacts=[c for x in g for c in x['contacts']];resc=[c for x in g for c in x['rescues']]
 lines.append(f'| {policy} | {sum(x["kind"]=="solid" for x in contacts)} | {sum(x["kind"]=="bounce" for x in contacts)} | {sum(x["kind"]=="phantom" for x in contacts)} | {pct(avg([x["wallRevealed"]/x["wallCount"] for x in g]))} | {resc.count("boost")} | {resc.count("return")} |')
lines+=['','境界試行はstep呼出しの始終マス間に壁がある回数。着地の旗／他ロケットで先に阻まれる場合も含み、物理的壁接触の上限推定。公開率は実際のfaceUpを測定。ジャンプは接触・公開なし。この計測限界は隠さない。',
'', '- 通常壁は通路制約、反発壁は停止＋押し戻し、幻影壁は正体が不明の間のブラフ。反発の後方に壁や駒があると押し戻さず止まる。今回から「反発が常に1歩後退」と書かない。',
'- 幻影は公開後に通行を妨げない。公開前の威嚇価値・相手の挑戦判断はCPU候補の粗い期待値に依存し、対人ブラフは未測定。公開率だけで弱すぎると確定しない。',
'- 旗は本人を含む全員の着地／歩行を妨げる。旗のマスから出ることは可能。停止位置を作る戦略は成立するが、多くの旗が立つことと面白い封鎖が成立することは別。',
'- 0点星は偽装や旗での封鎖に使える可能性がある。しかし回収CPUは既知0点でも獲得への高い加点を残すため、合理的な0点回避を完全には再現していない。',
'- 星の画像は全て終了まで共通裏面。得点テキストは自分が配置／探査して知った分だけ、交代時はmainを隠す。JSの内部状態は開発者ツールから読めるローカル試作であり、不正耐性のある遠隔対戦ではない。',
'', '## 5ラウンド案の隔離比較（承認していない）','',
'実験はVM内で終了条件の6を5に変更しただけ。星・壁・手札・後半配置は同じ。Webの正式ルールは6ラウンドのまま。8乱数の現行版から最初の4乱数を取り出し、実験の4乱数と同じ座席／手番／方策を対応させた。',
'', '| 人数 | 盤 | 現行→実験の確保率 | 現行→実験の先手 | 現行→実験の独占逆転 | 現行→実験の終了R |','|---:|---:|---|---|---|---|']
for p in [2,3,4]:
 for s in [7,8,9]:
  exp=subset('data-experiment',p,s,'collect');seeds={x['seed'] for x in exp};cur=[g for g in subset('data-current',p,s,'collect') if g['seed'] in seeds];a=summarise(cur);b=summarise(exp)
  lines.append(f'| {p} | {s} | {a[0]} → {b[0]} | {a[1]} → {b[1]} | {a[4]} → {b[4]} | {a[2]} → {b[2]} |')
lines+=['','短縮は未回収星を増やすが、先手偏りが十分に改善する証拠にはならない。採用推奨は保留。次の人間比較では終了ラウンドと情報行動の価値を1項目ずつ検討する。新カードや新壁の追加で問題を覆わない。',
'', '## 修正前後のゲームデータ','', '| 人数 | 盤 | 修正前→後の先手 | 修正前→後の確保率 |','|---:|---:|---|---|']
for p in [2,3,4]:
 for s in [7,8,9]:
  old=subset('data-baseline',p,s,'collect');seeds={g['seed'] for g in old};cur=[g for g in subset('data-current',p,s,'collect') if g['seed'] in seeds];a=summarise(old);b=summarise(cur)
  lines.append(f'| {p} | {s} | {a[1]} → {b[1]} | {a[0]} → {b[0]} |')
lines+=['','対応する2乱数のみの比較なので公平性が改善したという根拠にはしない。UI修正はルールを変更していない。CPU秘密参照と標準版バリアの修正は、正しい情報制限とルール動作への回復。',
'', '## 実画面・画像の前後','',
'Playwright 1.56.1＋Chromium 141で1280×900、390×844、320×844のタイトル／秘密配置／盤を記録。盤画像は重なり・境界・秘密状態を再現する固定fixture。実際の操作での配置・移動・探査・交代・補充・終了は別のE2Eで検証。fixture画像を人間試遊と称していない。日本語フォントNoto Sans CJK JPを環境へ導入。承認アトラスassets/art.webpの内容は一切変更なし。',
'', '| 幅 | 修正前 | 改善後 |','|---:|---|---|']
for w in [1280,390,320]:lines.append(f'| {w}px | [盤面](before/board-{w}.png)・[タイトル](before/title-{w}.png)・[配置](before/placement-{w}.png) | [盤面](after/board-{w}.png)・[タイトル](after/title-{w}.png)・[配置](after/placement-{w}.png) |')
lines+=['', '| 320px・9盤 | 修正前 | 修正後 |','|---|---:|---:|']
bef=json.loads((root/'before/metrics-320.json').read_text());aft=json.loads((root/'after/metrics-320.json').read_text())
for k,label in [('cell','マス'),('rocket','ロケット'),('flag','旗'),('wall','壁タップ領域')]:lines.append(f'| {label} | {bef[k]["width"]:.1f}×{bef[k]["height"]:.1f}px | {aft[k]["width"]:.1f}×{aft[k]["height"]:.1f}px |')
lines+=['', 'マスは44px以上。壁の直接領域は24px幅のため完全な44×44pxではない。重なりを避け、探査時に44px高の壁一覧を代替提供。縮小時はマスも小さくなるので全体確認用。スマホ実機のタップ精度は未検証。',
'', '## 最終QA・CI','',
'- 成功：starter/standard×2/3/4人×7/8/9の18条件、別山札と捨て札・補充・44カード保存、星0〜3・得点秘匿・旗の所有／通行妨害・壁公開とジャンプ・トラクター相手獲得・緊急脱出の既存回帰。',
'- 成功：Playwright既存のPC/390/320ローカル操作、CPU1体と3体の終了、タイトル復帰。新規4人ホットシート×2セット×3盤×3幅の18E2E、壁接触／探査、2行動後無効化、交代inert、終了／再開始、横にはみ出しなし。',
'- 成功：NodeではCPU1〜3体、実ブラウザではCPU1体/2体/3体。CPU2体も390pxの専用ブラウザケースを追加し、終了まで成功。',
'- 成功：ZIP必要ファイルと元画像のバイト一致。展開したfile://で画像と開始。ZIPでの全試合完走は通常HTTP E2Eと同一ソースによる間接確認で、file://の全モード終了は未検証。',
'- 修正前のローカルChromium導入は当初失敗（CDNの一経路から不完全ZIP）。公式の別配信経路から1.56.1用Chromiumを導入後、ブラウザ試験は成功。失敗をゲーム不具合と混同しない。',
'- 人間被験者、スマホ実機、スクリーンリーダー操作、製造見積／物理試作、完全な対人CPU戦略モデルは未検証。',
'', '初回修正コミット6b73fedのCI（全成功）：[Browser QA](https://github.com/stusaurus/hoshi-no-meikyu/actions/runs/38569763085) / [ルール回帰](https://github.com/stusaurus/hoshi-no-meikyu/actions/runs/38569763002) / [Web smoke](https://github.com/stusaurus/hoshi-no-meikyu/actions/runs/38569763140) / [Pages](https://github.com/stusaurus/hoshi-no-meikyu/actions/runs/38569756382)。最終コミットのCIと公開HTTP照合はQA追記へ記録。',
'', '## 残る判断・製品化','',
'**保留**。P1の先手偏り、探査の戦略価値、0点星／幻影壁の読み合いはUIを整えても解決しない。手番や星・壁・旗のルールを承認なしに変えていない。盤面サイズも未確定。',
'', '次の承認材料は[人間試遊計画](HUMAN-PLAYTEST.md)の実測。初心者の説明時間、配置の迷い、15〜20分の対戦、負けても再戦したいか、秘密の得点公開の驚きを確認する。5ラウンド案・開始位置対称化・手番補正は個別比較後に判断。',
'', '[製造監査](MANUFACTURING.md)：44枚の行動カード、最大11星／8壁、4色駒、旗の供給を整理。各色で全星を所有できる仕様なら各11旗（計44）か同等の所有表示が必要。高解像度元絵・カードの2種裏面・塗足し・駒原型・厚紙・4つ折りの折線を実物で確認してから見積。費用の架空推定はしていない。',
'', '## 再現','', '```bash',
'node scripts/audit-simulate.cjs --seeds=8 --out=docs/audit-2026-10-14/data-current',
'node scripts/audit-simulate.cjs --seeds=24 --seedOffset=8 --policies=collect --out=docs/audit-2026-10-14/data-fairness-extra',
'node scripts/audit-simulate.cjs --seeds=4 --variant=five-rounds --out=docs/audit-2026-10-14/data-experiment',
'node scripts/audit-simulate.cjs --seeds=1 --set=standard --out=docs/audit-2026-10-14/data-standard-control',
'git show 74b93a4:game.js > /tmp/hoshi-game-before.js',
'git show 74b93a4:cpu.js > /tmp/hoshi-cpu-before.js',
'node scripts/audit-simulate.cjs --seeds=2 --gameSource=/tmp/hoshi-game-before.js --cpuSource=/tmp/hoshi-cpu-before.js --out=docs/audit-2026-10-14/data-baseline',
'python3 scripts/audit-report.py',
'```',
'', '全試合・行動記録は各データフォルダのgames.json.gz（gzip圧縮JSON）、集約値はsummary.jsonと全条件CSVに保存。情報の種類を匿名化する必要のない合成CPU試合。初期の計測試行／中断実行は最終サンプルに含めない。']
(root/'REPORT.md').write_text('\n'.join(lines)+'\n')
with (root/'conditions.csv').open('w',newline='') as f:
 w=csv.writer(f);w.writerow(['dataset','players','size','policy','completed','first_win_share','capture','margin','rounds','wall_reveal','blocked_turns','no_action_turns'])
 for name,m in meta.items():
  for r in m['summary']:w.writerow([name,r['count'],r['size'],r['policy'],r['n'],r['winShare'][0],r['capture'],r['margin'],r['rounds'],r['wallReveal'],r['blocked'],r['noAction']])
for name in names:
 p=root/name/'games.json'
 target=p.with_suffix('.json.gz');temp=target.with_suffix('.gz.tmp')
 temp.write_bytes(gzip.compress(json.dumps(data[name],separators=(',',':')).encode(),compresslevel=9,mtime=0));temp.replace(target)
print('Generated report, conditions.csv and losslessly compressed match records.')
