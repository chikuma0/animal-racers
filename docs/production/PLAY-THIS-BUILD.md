# Animal Racers — gameplay revision 3

A short western championship: race to the saloon, then settle it in a duel. The race and duel each contribute half the trophy score. Winning the race helps; it does not decide the entire match.

## はじめる

動物をえらび、**あそぶ**→**スタート！**を押します。案内は絵と短い日本語で、スクロールせず開始できます。「⚙ あいて・つよさ」を開くと、相手と「やさしい・ふつう・つよい」を変えられます。初期設定は「やさしい」です。

## バトルだけ遊ぶ

**バトルだけ あそぶ**→**たたかう！**で、体力いっぱいのバトルを始めます。レースの点数や大会のトロフィーは出ません。

- **←・→（矢印/A/D）**：左右に動きます。
- **たたく（J）**：1回押すと、最大2.6秒だけ相手に近づき、届く距離でパンチします。守っている相手には既存の強いパンチを使います。押しっぱなしでは繰り返しません。
- 左右を押すと自動の接近は止まります。左右を押しながら「たたく」も使えます。遠ければ空振りします。
- 新しくもう一度押すと、次のパンチを予約できます。画面を離れたり、試合が終わったりすると予約は消えます。

自分のパンチが当たると音・動き・光と「あたった！」、自分が当てられた時は「だいじょうぶ！」で伝えます。攻撃の威力・射程・得点のルールは変えていません。

## レースから遊ぶ

自動で走るので、**←・→**で障害物をよけ、**ジャンプ（Space/W）**で低い障害物を越えます。レース開始から自分の動物を画面内に表示します。

レースの後はバトルへ進み、2つの点数を合わせて勝者を決めます。結果画面は4秒間と、すべての指・キーを離して600ms経つまで待ちます。その後、**もういちど**か**どうぶつを えらぶ**を新しく押して離すと進みます。

## ともだちと遊ぶ

2人が同じ版を開き、**ともだちと あそぶ**でリンクか10文字のコードを渡します。2人とも**じゅんびOK！**を押すと始まります。再戦には2人とも**もういちど**を押します。バトルだけの練習は1人用です。

## Review boundary

This revision addresses the owner’s rejected duel/control/character pass. The previous review remains a comparison, not visual acceptance. Physical iPhone touch, sustained performance, separate-device internet play and the owner’s judgment of fun and reference quality remain required. See QA-REPORT.md and DEVICE-TEST.md for the exact build and evidence.
