"""Generate the isolated rules comparison from saved synthetic CPU games."""
import csv, gzip, hashlib, json, random
from pathlib import Path
root = Path("docs/audit-2026-10-15")
variants = ["current", "alternating", "passable-flags", "alternating-passable-flags"]
labels = ["現行：2行動・旗で封鎖", "1行動交代・旗で封鎖", "2行動・旗を通行", "1行動交代・旗を通行"]
data = {v: json.loads(gzip.decompress((root / ("data-"+v) / "games.json.gz").read_bytes())) for v in variants}
rows = []
for count in [2,3,4]:
 for size in [7,8,9]:
  for v,label in zip(variants,labels):
   games = [g for g in data[v] if (g["count"],g["size"]) == (count,size)]
   wins = [sum((1/len(g["winners"]) if i in g["winners"] else 0) for g in games)/len(games) for i in range(count)]
   rows.append(dict(count=count,size=size,variant=v,label=label,n=len(games),first=wins[0],capture=sum(g["capture"] for g in games)/len(games),spread=max(wins)-min(wins),logical_round=sum(g["logicalRound"] for g in games)/len(games)))
with (root/"comparison.csv").open("w") as f:
 w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
text = """# 星の迷宮：シンプルさと戦略性の比較再開（2026-10-15）

## 結論

**次の有力候補は「1アクションごとに交代＋旗は障害物として残す」。正式採用にはまだ不足がある。** 先手差は小さくなる傾向がある一方、星がほぼ全回収される問題は残る。旗を通行可能にしても公平性が一貫して改善せず、取得した星で通路を変える戦略を失うため、現段階での優先候補にはしない。

「小学生が理解でき、少ないルールから多くの戦略が生まれる」を基準に、次の説明を核とする：カードを1枚使って行動したら交代。止まった星を獲得し、旗を立てる。旗は全員の道を塞ぐ。星の得点は自分が配置・探査して知った分だけ確認でき、終了時に全員へ公開する。これは候補の説明で、公開Webの正式ルールを変更したものではない。

## 引き継ぎと試合数

前チャット画像には22,533試合完了とあるが、再開時のGitHub HEAD `7e67026` には8,613試合の監査原データしか確認できなかった。欠落した比較データを確認済み扱いにせず、今回4条件×696＝**2,784試合を再実行**した。696試合は既存8,613試合に含まれる現行回収方策の対照再実行、2,088試合は新しい条件のデータ。既存と今回を独立試合として加算しない。22,533試合は今回の検証済み件数ではない。

各人数・盤面で独立した初期乱数は8個。人数²の座席・持ち物ローテーションは同じ乱数を共有する。勝率は同点で按分。人間の面白さや習熟差は測定していない。回収CPU1方策のみであり、最適戦略を示さない。

## 実験の統制

- 現行は6周×最大2行動。交代案は12周×最大1行動で、各人の最大行動枠12を維持する。
- 交代案の補充は各人の偶数周終了時。追加配置は6周後、7周開始前。山札・秘密の星・壁の供給・開始位置集合・初期手札は現行と同じ。
- 緊急脱出は2行動分を使い、交代案では奇数周にのみ使用できる。使用者の次の周を休み、12行動枠を超えない。これは2行動コストを維持する実験上の取り決めで、最終ルールの採用案ではない。
- 全星獲得による早期終了は追加配置以後、全員が同じ周を終えてから判定。12周案では奇数周終了も認めるため、行動枠の総上限は等しいが終了時の補充タイミングが完全には一致しない。
- 通行可能案では `isFlag` の通行判定だけをVM内で無効化。獲得所有・得点・終了判定は残す。Webで旗の絵や効果文を変更していない。
- 1アクション交代は1歩交代ではない。てくてくの2歩、ダッシュ、ジャンプはそれぞれカード1枚の行動。
- 公開Webの `game.js` / `cpu.js` は変更なし。検証用スクリプトの隔離アダプターだけで比較した。

## 結果

| 人数 | 盤 | 試合/案 | 現行の先手 | 1行動・封鎖 | 2行動・通行 | 1行動・通行 | 1行動・封鎖の回収率 |
|---:|---:|---:|---:|---:|---:|---:|---:|
"""
for count in [2,3,4]:
 for size in [7,8,9]:
  r=[next(x for x in rows if (x["count"],x["size"],x["variant"])==(count,size,v)) for v in variants]
  text+=f"| {count} | {size} | {r[0]['n']} | "+" | ".join(f"{x['first']:.1%}" for x in r)+f" | {r[1]['capture']:.1%} |\n"
text+="""
公平性は先手だけで判断しない。全座席の最大勝率差もCSVに記録した。盤面を広げれば常に公平になる結果ではなく、人数別の盤面は未確定。

## シンプルさから奥深さを作る次の設計

1. **手番を短くする**：カード1枚→交代を第一候補にする。連続回収の先手優位を弱め、相手の変化に応じて考え直す機会を増やす。CPU傾向の改善は確認できても、待ち時間・楽しさの実測は別に必要。
2. **旗を残す位置選択を核にする**：同じ星でも、獲得して通路を閉じる時期と場所で次の移動が変わる。自分の旗も自分を妨げるので、単純な領地拡大とは異なる。ただし回収CPUはこの長期価値を十分に評価していない。
3. **情報を使う判断を作る**：ほぼ全星を取れる現状では、探査で得点を知る価値が薄い。「どの星を取り、どれを残すか」が生まれる取得上限・行動枠の短縮を、次に別々の実験として比較する。取得上限は一律固定すると旗数・終盤の封鎖まで変えるため、初めから採用しない。
4. **例外の説明コストを下げる**：2行動コストの緊急脱出は1行動交代と相性が悪い。全状態で行き詰まりを避ける別の救済案を検証してからルールを確定する。今回の「次の周を休む」を初心者向けの完成ルールとしない。

カードや壁を追加して戦略の種類を増やす段階ではない。現行5カード・3壁の相互作用を保ち、回収・情報・封鎖がそれぞれ勝ちに寄与するかを確認する。0点星は偽装や通路封鎖の候補だが、既知0点でも回収に高い加点を与える現行CPUの限界を含むため、この比較から有効性を断定しない。

## 保存・検証・再現

原記録は `data-*/games.json.gz`、集計は各 `summary.json`、比較は `comparison.csv`。`tests/rules-comparison.cjs` で4条件の対応キー、得点保存、獲得数、手番ごとの行動上限、緊急脱出の休み、最大12行動、勝率再集計を検証する。総件数だけの検証ではない。

```bash
for v in current alternating passable-flags alternating-passable-flags; do
  node scripts/audit-simulate.cjs --seeds=8 --policies=collect --variant=$v --out=docs/audit-2026-10-15/data-$v
done
python3 - <<'PYCOMPRESS'
import gzip
from pathlib import Path
for p in Path('docs/audit-2026-10-15').glob('data-*/games.json'):
    p.with_suffix('.json.gz').write_bytes(gzip.compress(p.read_bytes(), mtime=0))
PYCOMPRESS
node tests/rules-comparison.cjs
python3 scripts/rules-comparison-report.py
```

ローカルブラウザ再検証はChromium配信の不完全ZIP／403により実行できなかった。既存HEADのBrowser QAは成功を確認。今回コミットのBrowser QAはGitHub Actionsで改めて確認し、結果を追記する。Nodeの現行ゲーム・CPU・スターター・画像付きZIPの回帰は成功。試験結果と人間による面白さの評価は区別する。
"""
(root/"COMPARISON.md").write_text(text)
manifest={"base_commit":"7e67026befb0996e0e91de7c889862b789e85e93","comparison_records":2784,"repeated_control_records":696,"initial_seeds_per_condition":8,"sha256":{name:hashlib.sha256(Path(name).read_bytes()).hexdigest() for name in ["game.js","cpu.js","scripts/audit-simulate.cjs"]}}
(root/"provenance.json").write_text(json.dumps(manifest,indent=2)+"\n")
print("Generated comparison from 2784 records")
