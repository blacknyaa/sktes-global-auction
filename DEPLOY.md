# 公開手順（Vercel）

クライアントに URL を渡すための手順です。

## 設定なしでも動きます

**環境変数を1つも設定しなくても、デプロイすればそのまま動きます。**
ビルド時に初期データ入りのデータベースを同梱し、起動時に書き込み可能な
一時領域へ展開するためです。ログイン・入札・封印解除・落札まで、
すべての機能がそのまま使えます。

ただし**書き込みは保持されません**。

サーバーレスは1回の閲覧でもリクエストごとに別インスタンスへ振り分けられ
（実測で9〜20インスタンス）、同梱データベースはインスタンスごとに別物です。
そのため読み取りは全インスタンスで同一・完璧ですが、書き込みは次の
リクエストが同じインスタンスに当たったときしか残りません。

実測値：入札を1件入れて10回再読み込みしたところ、残っていたのは1回。

| | 設定なし | `DATABASE_URL` を設定 |
|---|---|---|
| 全画面の閲覧 | ○ | ○ |
| ログイン・言語切替・検索 | ○ | ○ |
| 入札・承認などの保持 | **×（消える）** | ○ |
| 新規会員登録 | **×（他インスタンスから見えない）** | ○ |

設定なしのときは、その旨を画面上部に表示します（黙って壊れているように
見せないため）。**先方に触ってもらうなら、下記の設定を必ず行ってください。**
所要2分です。

現在の動作モードは `/api/health` の `mode` で確認できます。

---

## 手順1：PostgreSQL を用意する（任意・5分）

**いちばん簡単な方法**：Vercel のプロジェクト画面上部の **Storage** タブ →
**Create Database** → **Neon**。これだけで `DATABASE_URL` が自動的に
環境変数へ登録されます。

手動で用意する場合は以下のとおりです。

無料枠で足ります。Neon（https://neon.tech）が最短です。

1. Neon でアカウントを作成し、プロジェクトを1つ作る
2. 発行される接続文字列（`postgresql://...` で始まる文字列）を控える
   - **Pooled connection**（`-pooler` が入っているほう）を選ぶこと。
     サーバーレスからは接続が短命に大量発生するため、プーラー経由が必要です

Supabase でも同じことができます。接続文字列の形式が同じであれば何でも構いません。

## 手順2：鍵を2つ生成する（PostgreSQL を使う場合のみ）

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # SEAL_MASTER_KEY
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"  # SESSION_SECRET
```

> `SEAL_MASTER_KEY` は封印入札の秘密鍵を包む鍵です。
> **一度決めたら変更しないでください。** 変更すると、それ以前に投じられた
> 入札は復号できなくなります（設計上そうなっています）。
> リポジトリには絶対に置かず、本番では Azure Key Vault などに保管します。

## 手順3：Vercel に環境変数を登録する（PostgreSQL を使う場合のみ）

Vercel のプロジェクト設定 → Settings → Environment Variables に、
**Production / Preview / Development すべてにチェックを入れて**登録します。

| 変数 | 値 |
|---|---|
| `DATABASE_URL` | 手順1の接続文字列（pooled） |
| `SEAL_MASTER_KEY` | 手順2で生成した64桁の16進文字列 |
| `SESSION_SECRET` | 手順2で生成した長いランダム文字列 |
| `DEMO_MODE` | `true` |
| `SITE_URL` | `https://<プロジェクト名>.vercel.app` |

`DATABASE_URL` が `postgres` で始まっていれば、ビルド時に Prisma の
データベース種別が自動で PostgreSQL に切り替わります
（`scripts/prepare-datasource.mjs`）。手動でスキーマを書き換える必要はありません。

## 手順4：データベースに表を作り、デモデータを入れる

**手元のPCから**リモートのデータベースに対して実行します。
Vercel のビルド中には実行されません（ビルドのたびにデータが消えないようにするため）。

PowerShell の場合:

```powershell
$env:DATABASE_URL = "postgresql://...（手順1の接続文字列）"
$env:SEAL_MASTER_KEY = "...（手順2の鍵。Vercel に登録したものと同一）"
npm run db:deploy
```

bash の場合:

```bash
DATABASE_URL="postgresql://..." SEAL_MASTER_KEY="..." npm run db:deploy
```

`db:deploy` は「種別の切り替え → 表の作成 → デモデータ投入」をまとめて行います。
最後に `Seed complete` と件数の表が出れば成功です。

> **`SEAL_MASTER_KEY` は Vercel に登録したものと必ず同じ値にしてください。**
> 違う値で投入すると、封印入札を開封する画面でエラーになります。

## 手順5：デプロイ

```bash
npm i -g vercel
vercel login
vercel --prod
```

すでに GitHub と連携している場合は、`main` に push すれば自動でデプロイされます。
**環境変数を後から追加・変更した場合は、再デプロイが必要です**
（Vercel の Deployments → 最新の … → Redeploy）。

## 手順6：確認

```bash
BASE_URL=https://xxx.vercel.app npm run e2e
```

38項目の通し確認が走り、`screenshots/` に全画面が保存されます。
業務フロー全体（35項目）も確認する場合:

```bash
BASE_URL=https://xxx.vercel.app node scripts/flow.mjs --no-seed
```

> `--no-seed` を付けないと、リモートのデータベースを初期化してしまいます。

---

## うまくいかないときの切り分け

| 症状 | 原因 | 対処 |
|---|---|---|
| 環境変数を登録したのに反映されない | **変数名だけ作られて値が空** | `/api/health` の `valueLengths` を見る。長さが `0` なら値が空。値を入れ直し、Production にチェックを入れて保存し Redeploy |
| 同上（値は入っている） | Production 以外の環境にだけ登録された | 同じ変数を Production にも登録 |
| `Application error: a server-side exception` | 同梱データベースが壊れているか、DATABASE_URL の設定が誤っている | `/api/health` の `diagnosis` を確認 |
| 画面は出るがログインできない | デモデータが入っていない | 手順4を実行 |
| 封印解除でエラー | `SEAL_MASTER_KEY` が投入時と実行時で違う | 同じ鍵に揃えて手順4をやり直す |
| ログインしてもすぐログアウトされる | `SESSION_SECRET` 未設定 | 手順3で登録し、再デプロイ |
| ビルドは通るが起動時に落ちる | 環境変数の反映漏れ | Redeploy（環境変数の変更は再デプロイで反映） |

Vercel のログは Deployments → 該当デプロイ → Runtime Logs で見られます。
`Digest: xxxxx` の実際の内容もそこに出ます。

---

## 短時間だけ見せる場合（データベース移行なし・10分）

面談中に見せるだけなら、手元の PC をそのままトンネルで公開するのが最短です。
SQLite のまま動きます。

```bash
npm run build
npm start                                  # 別のターミナルで
npx cloudflared tunnel --url http://localhost:3000
```

`https://xxxx.trycloudflare.com` が発行されるので、その URL を伝えます。
PC を閉じると止まります。

> トンネル経由のときだけ、ブラウザの開発者ツールに React の警告
> （Minified React error #418）が出ることがあります。Cloudflare がページ内の
> メールアドレスを自動的に難読化して HTML を書き換えるため、サーバーが返した
> 内容とブラウザ側が食い違うのが原因で、アプリの不具合ではありません。
> 画面の動作にも影響しません。Vercel など通常のホスティングでは出ません
> （`npm run audit` を Vercel に対して実行して確認済み）。

---

## 本番構成にするとき

提案書に書いた構成に寄せる場合の対応表です。

| 項目 | デモの実装 | 本番での置き換え |
|---|---|---|
| データベース | SQLite / PostgreSQL 自動切替 | Azure Database for PostgreSQL |
| ファイル保管 | データベース内（`StoredBlob`） | Azure Blob Storage（`src/lib/storage.ts` のみ変更） |
| メール送信 | アウトボックスに記録のみ | SendGrid / Azure Communication Services（`src/lib/notify.ts` の `notify()` に配信処理を追加） |
| 封印鍵 | 環境変数 | Azure Key Vault |
| 出品の自動開始・締切 | 画面表示時に判定 | タイマー実行（Azure Functions / Vercel Cron） |
| 認証 | ID/パスワード＋TOTP | 出品者は Microsoft Entra ID の SSO、バイヤーは現行のまま |
| 監査ログ | 同一データベース | 直近1年はDB、以前は書き換え不可のストレージへ退避 |

いずれも1ファイルの差し替えで済むように分離してあります。
「あとで直せばいい」ではなく、最初からその形で書いてあります。
