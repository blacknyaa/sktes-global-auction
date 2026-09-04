# 公開手順

クライアントに URL を渡すための手順です。ローカルでは `npm run dev` で動きますが、
先方に触っていただくには外から見える場所に置く必要があります。

---

## 選択肢A：Vercel（いちばん早い・無料枠で足ります）

所要 15 分ほど。アカウントは依頼者側（あなた）のものが必要です。

### 1. データベースを用意する

SQLite はサーバーレス環境では使えないため、PostgreSQL に切り替えます。

無料で使える PostgreSQL は Neon（neon.tech）か Supabase。どちらでも構いません。
作成すると `postgresql://...` の接続文字列が発行されます。

```bash
npm run db:use-postgres      # schema.prisma の provider を切り替え
```

`.env` の `DATABASE_URL` を発行された接続文字列に置き換えて、

```bash
npx prisma db push
npm run db:seed
```

### 2. デプロイ

```bash
npm i -g vercel
vercel login
vercel            # 初回、プロジェクトを作成
vercel --prod
```

### 3. 環境変数を設定

Vercel のプロジェクト設定 → Environment Variables に以下を登録します。

| 変数 | 値 |
|---|---|
| `DATABASE_URL` | PostgreSQL の接続文字列 |
| `SESSION_SECRET` | 長いランダム文字列 |
| `SEAL_MASTER_KEY` | 64桁の16進文字列（下記コマンドで生成） |
| `DEMO_MODE` | `true`（デモ用。本番では設定しない） |
| `SITE_URL` | 発行された `https://xxx.vercel.app` |

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> `SEAL_MASTER_KEY` は封印入札の秘密鍵を包む鍵です。これが漏れると封印の意味が
> なくなるので、リポジトリには絶対に置かず、本番では Azure Key Vault などの
> シークレットストアに置いてください。デモの値は使い回さないこと。

### 4. 確認

```bash
BASE_URL=https://xxx.vercel.app npm run e2e
```

38項目の通し確認が走り、`screenshots/` に全画面が保存されます。

---

## 選択肢B：手元のPCをそのまま見せる（10分・データベースの移行不要）

短時間だけ見てもらう場合は、トンネルを張るのがいちばん手軽です。SQLite のまま動きます。

```bash
npm run build
npm start                                  # 別のターミナルで
npx cloudflared tunnel --url http://localhost:3000
```

`https://xxxx.trycloudflare.com` が発行されるので、その URL を伝えます。
PC を閉じると止まるため、面談中や短期間の確認向けです。

---

## 本番構成にするとき

提案書に書いた構成に寄せる場合の対応表です。

| 項目 | デモの実装 | 本番での置き換え |
|---|---|---|
| データベース | SQLite | Azure Database for PostgreSQL（`npm run db:use-postgres`） |
| ファイル保管 | ローカルディスク | Azure Blob Storage（`src/lib/storage.ts` のみ変更） |
| メール送信 | アウトボックスに記録のみ | SendGrid / Azure Communication Services（`src/lib/notify.ts` の `notify()` に配信処理を追加） |
| 封印鍵 | 環境変数 | Azure Key Vault |
| 出品の自動開始・締切 | 画面表示時に判定 | タイマー実行（Azure Functions / Vercel Cron） |
| 認証 | ID/パスワード＋TOTP | 出品者は Microsoft Entra ID の SSO、バイヤーは現行のまま |
| 監査ログ | 同一データベース | 直近1年はDB、以前は書き換え不可のストレージへ退避 |

いずれも1ファイルの差し替えで済むように分離してあります。
「あとで直せばいい」ではなく、最初からその形で書いてあります。
