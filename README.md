# SK TES Global Auction — 動作するプロトタイプ

「オンライングローバル競売プラットフォームの構築」案件（依頼番号 5588001）のために作成した、
実際に動くプロトタイプです。画面のモックではなく、データベース・認証・暗号化・帳票まで
つながった状態で動きます。

---

## 起動

```bash
npm install
npm run db:push      # SQLite にスキーマを作成
npm run db:seed      # デモデータを投入
npm run dev          # http://localhost:3000
```

### デモアカウント（パスワードは共通で `Demo!2026`）

| 役割 | メールアドレス |
|---|---|
| 管理者（SK TES 日本） | `admin@sktes-demo.com` |
| 出品者（SK TES 日本拠点） | `seller@sktes-demo.com` |
| 応札者（海外バイヤー） | `buyer@sktes-demo.com` |

バイヤー各社は `buyer1@buyer-demo.com` 〜 `buyer55@buyer-demo.com`、
出品拠点は `seller.jp@sktes-demo.com` のように国コードで並んでいます。

`/guide` に、3つの役割それぞれの歩き方をまとめています。

---

## 要件との対応

| 要件書の項目 | 実装 |
|---|---|
| 8. 会員管理（登録・添付書類・承認フロー） | 3ステップの登録ウィザード、書類アップロード、仮登録→書類審査→本登録、入札上限つき仮承認 |
| 8. ログイン（MFA・ロック・再設定） | bcrypt、TOTP による多要素認証（実際にスキャンできるQR）、5回失敗で15分ロック、再設定リンク |
| 8. 権限管理 | 出品者・応札者・管理者の3ロール、画面とサーバーアクションの両方で判定 |
| 9. 出品管理 | 出品登録、Excel明細の取り込み、6種のコンディション、保管・引渡し場所、開始/終了日時、キャンセル |
| 10. 落札処理 | 封印入札、締切後の一斉開封、落札者の任意決定（理由の記録を強制）、落札・落選通知 |
| 10. 成約管理 | 落札 → 契約中 → 入金待ち → 引渡し済 → 完了 |
| 11. 決済 | 銀行振込・カード・PayPal・請求書払い、請求書と領収書、適格請求書（国内）と輸出免税（海外）の出し分け |
| 12. 引渡し・物流 | 発送依頼、集荷依頼、出荷完了報告、受領確認、不具合申告 |
| 13. 管理者機能 | ダッシュボード（国別・ステータス別・月別）、会員管理、不正監視（多重アカウント・異常入札・アクセスログ） |
| 14. 通知 | 全通知をアウトボックスに記録。SMS/Teams/LINE/WhatsApp/WeChat はアダプタ追加のみで対応できる構造 |
| 15. レポート | 出品者向け（落札者名・落札金額・平均落札額・今後のやりとり）、応札者向け（入札・落札・支払・発送・受領の履歴） |
| 16. セキュリティ | パスワードのハッシュ化、MFA、監査ログ、書類のアクセス制御、セッション破棄 |
| 17. 監査ログ | ログイン・出品・入札・金額変更・落札確定・管理者操作を記録、行ごとに7年の保存期限 |
| 18. 非機能 | 全時刻をUTC保持・閲覧者ローカル表示、インデックス設計、SQLite→PostgreSQL はデータソース定義の変更のみ |
| 19. 追加確認事項 | 多言語（日英中）を初期実装、API前提の構造、マルチテナント（21拠点）分離 |

---

## 封印入札の仕組み

このプロトタイプの中心です。「締切まで誰も金額を見られない」を、運用ルールではなく
仕組みとして実装しています。

1. 出品を公開するとき、そのロット専用の RSA-2048 鍵ペアを生成します。
2. 入札金額は公開鍵で暗号化（RSA-OAEP / SHA-256）してから保存します。**平文の金額列は存在しません。**
3. 秘密鍵はマスター鍵で AES-256-GCM 暗号化し、**締切時刻を認証付きデータとして結びつけます。**
   締切を後から書き換えると、秘密鍵は復号できなくなります。
4. 開封は締切を過ぎるまで例外で拒否されます。権限チェックではありません。
5. 各入札には金額とノンスの SHA-256 ハッシュを保存し、開封後に金額が改ざんされていないことを検証します。

この4点は、次のコマンドで実際に検証できます。

```bash
npm run verify:seal
```

```
=== 1. Bids on an open lot are unreadable ===
  ok  no amount stored in plaintext
  ok  no nonce stored before opening
  ok  ciphertext present for every bid
=== 2. The seal refuses to open early ===
  ok  opening before the deadline throws
  ok  moving the deadline invalidates the key
=== 3. Opened bids still match their commitment ===
  ok  every revealed amount matches its commitment
```

---

## ロット明細の取り込み

出品者はすでに Excel で在庫を管理しています。フォームに400行を打ち直させるのではなく、
そのまま取り込みます。

- 列の順番は自由。ヘッダー名で自動判別します（`メーカー` / `Maker` どちらでも可）。
- 表の上にタイトル行があっても、上から20行以内にヘッダーがあれば認識します。
- 読み取れなかった行は取り込み前のプレビューに一覧表示されます。黙って捨てません。
- 取り込んだ明細は1行ずつデータになるので、**「Dell の RAM 16GB 以上を含むロット」**
  といった横断検索ができます。バイヤーが探せることは、そのまま落札単価に効きます。

テンプレートは `/api/manifest-template` からダウンロードできます。

---

## 構成

```
prisma/schema.prisma      24テーブルのドメインモデル
prisma/seed/              40カ国・77社・44出品・209入札の生成
src/lib/seal.ts           封印入札の暗号化エンジン
src/lib/totp.ts           RFC 6238 の多要素認証（自前実装・監査可能）
src/lib/manifest.ts       Excel の取り込みと書き出し
src/lib/fraud.ts          不正検知（ルールベース）
src/lib/audit.ts          監査ログ
src/lib/notify.ts         通知（チャネル追加はアダプタ1つ）
src/app/(console)/        ログイン後の画面
src/app/                  公開ページ・認証・請求書
scripts/verify-seal.ts    封印入札の性質を検証
scripts/e2e.mjs           実ブラウザでの通し確認とスクリーンショット
```

技術構成は TypeScript / Next.js 15 (App Router) / React 19 / Tailwind CSS v4 / Prisma。
デモは SQLite ですが、`datasource` の変更だけで PostgreSQL に載せ替えられるよう、
列挙型を使わず文字列＋TypeScript の型で表現しています。

---

## 確認用コマンド

```bash
npm run verify:seal   # 封印入札の性質を検証
npm run e2e           # 実ブラウザで全画面を通し、screenshots/ に保存
npm run build         # 本番ビルド
npm run db:reset      # デモデータを初期状態に戻す
```

管理者でログインすると `/admin/demo` からも初期化できます。

---

## デモ環境についての注意

実在の取引データは含まれていません。会社名・担当者名・金額・書類はすべて動作確認用に
生成したものです。SK TES グループおよび各社との関係を示すものではありません。
