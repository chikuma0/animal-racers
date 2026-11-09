# Animal Racers — gameplay revision 3

The owner rejected revision2 because the duel still felt primitive, the controls were too small, and the character defects remained visible. This revision prioritizes the actual exchange. A small input vocabulary must produce useful decisions, responsive movement and convincing contact. Adding buttons alone does not meet that goal. Owner acceptance remains open.

## The short brief

Two animal rivals race through a western canyon, then settle their rivalry in a saloon. Racing rewards a clean line and timely obstacle choices. Fighting rewards getting into range, finding an opening and choosing how much to commit. Both events contribute equally to the championship; losing the race never weakens your fighter.

Mario Kart8 Deluxe remains the racing-rivalry reference; ARMS and Punch-Out!! inform readable commitment and punish opportunities. Street Fighter6 illustrates that accessible controls can retain distinct tactical choices. The commission's Street Fighter/KOF/Tekken references set expectations for spacing, anticipation, weight and contact. These are design lessons, not claims that this build matches their quality or systems.

## 子ども向けのバトル操作（2026-10-20）

日本語を使う3歳くらいからを想定し、画面の操作は左右と大きな「たたく」に絞ります。Guard/Power/Evadeの選択を子どもに求めません。最初の案内も絵と一文にし、開始ボタンをスクロールせず押せるようにします。対象年齢での使いやすさと面白さは、実際の子どものプレイで検証する項目です。

「たたく」1回は最大2.6秒の接近と1回の攻撃を予約します。射程に入ったら既存のquick攻撃を出し、相手がguard/ward中なら既存のpowerを使います。左右入力は接近予約を取り消しますが、新しい攻撃入力は受け付けます。押しっぱなしで連続攻撃はしません。フェーズ変更・画面離脱・切断で接近予約を止めます。

この補助はUI入力を既存の入力パケットへ変換する層です。オンラインのホストが勝敗を判定する仕組み、攻撃威力、射程、CPU設定、得点は維持します。以下のGuard/Evadeやキャラクター固有攻撃は、CPUを含むゲーム内部のルールであり、子ども向け画面の追加ボタンではありません。

Fire Lion's Sunset Drive is a heavy step-in body blow with strong guard pressure. Water Wolf's Frost Sweep recovers sooner and briefly slows movement on hit. Rainbow Unicorn's Prism Push uses a hoof and a short ward that can absorb one quick hit at a guard cost; another Power can break through. Element effects follow the physical action and cannot imply extra invisible reach.

Quick startup remains .14–.18 seconds. Powers start at .64–.70 seconds: the longer tell gives a delayed online opponent time to answer, while the attacking body continues to coil and transfer weight. Contact pauses both fighters briefly. Both the normal and faster earned reply animation must meet the authoritative contact time. The CPU uses the same actions and statistics, with explicit reaction/decision delays; scripted policy victories are balance diagnostics, not proof of human enjoyment.

Duel Practice is available from the character menu. It uses the same fight, selectable rival and fresh rematch, with honest duel-only results and no invented race score or championship cup. It exists to let the owner iterate on the priority without repeating a race.

## Race: choose the line, clear the hazard, earn the pass

Automatic running, steering and one leap action remain. Twelve spaced hazard rows create frequent line decisions: leap low timber and steer around loaded wagons. Lateral movement uses the same pace budget as forward travel, so unnecessary weaving loses ground.

Following a rival grants a modest pursuit benefit only while directly behind them. It fades before close passing distance and cannot be stored as an exit boost. A fall must not create a faster route to the lead. Passing comes from a better line or obstacle decision; short recovery keeps one mistake from deciding the whole championship. Both players have the same rules. The rival-distance HUD and pursuit trail explain proximity without promising a free slingshot.

## Championship and acceptance

The bounded50-point race pool and50-point duel pool remain. Race normalization is4seconds: a1.2-second lead yields32.5/17.5 race points; losing the duel by26HP yields18.5/31.5 fight points, leaving a51/49 championship win. Race results never grant combat stat advantages. Ties, timeouts, nonfinishers, simultaneous hits, forfeits and rematches remain tested.

Revision2's immutable preview stays available as the comparison. Each new review build needs an exact source/asset fingerprint and ordinary-control complete recordings. Defect repairs require full motion and in-game scale review, not attractive stills alone. Human enjoyment/art acceptance, separate-device internet play and sustained physical iPhone13Pro performance remain distinct required gates.
