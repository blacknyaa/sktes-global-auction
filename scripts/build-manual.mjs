import JSZip from "jszip";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Builds the Word document we hand to the client.
 *
 *   node scripts/build-manual.mjs
 *
 * The wording below is the only copy of it. Edit it here, run the script, and
 * send the file it writes.
 */

const OUT = path.join("docs", "SK TES グローバル競売 デモ操作マニュアル.docx");

// ---------------------------------------------------------------- xml helpers
const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Splits "ここは **太字** です" into runs. */
function runs(text, extra = "") {
  return text
    .split(/(\*\*[^*]+\*\*)/)
    .filter(Boolean)
    .map((part) => {
      const bold = part.startsWith("**") && part.endsWith("**");
      const body = bold ? part.slice(2, -2) : part;
      const props = `${bold ? "<w:b/>" : ""}${extra}`;
      return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ""}<w:t xml:space="preserve">${esc(body)}</w:t></w:r>`;
    })
    .join("");
}

const para = (text, style = "Body", extra = "") =>
  `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr>${runs(text, extra)}</w:p>`;

const title = (text) => para(text, "DocTitle");
const h1 = (text) => para(text, "Head1");
const h2 = (text) => para(text, "Head2");
const body = (text) => para(text, "Body");
const bullet = (text) => para(`・${text}`, "Bullet");
const mono = (text) =>
  `<w:p><w:pPr><w:pStyle w:val="Body"/></w:pPr>${runs(text, '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>')}</w:p>`;

function cell(text, { header = false, width = 3000 } = {}) {
  const shade = header ? '<w:shd w:val="clear" w:fill="EAF3FF"/>' : "";
  const content = header ? `**${text}**` : text;
  return (
    `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${shade}` +
    `<w:vAlign w:val="center"/></w:tcPr>${para(content, "TableCell")}</w:tc>`
  );
}

function table(rows, widths) {
  const borders =
    '<w:tblBorders>' +
    ["top", "left", "bottom", "right", "insideH", "insideV"]
      .map((s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="C9D9EC"/>`)
      .join("") +
    "</w:tblBorders>";
  const trs = rows
    .map((cells, i) =>
      `<w:tr>${cells.map((t, j) => cell(t, { header: i === 0, width: widths[j] })).join("")}</w:tr>`
    )
    .join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>${borders}</w:tblPr>${trs}</w:tbl>`;
}

/** A step: a small bold heading, then its explanation. */
const step = (n, heading, ...lines) => h2(`${n}. ${heading}`) + lines.map(body).join("");

// ------------------------------------------------------------------- content
const content = [
  title("SK TES グローバル競売　デモ環境 操作マニュアル"),
  body(
    "このマニュアルは、お渡ししたデモ環境をご自身で触っていただくためのものです。" +
      "上から順に進めていただくと、会員の審査から出品、封印入札、落札、請求書の発行まで、" +
      "ひととおりの流れをご確認いただけます。ざっと触るだけなら20分ほどです。"
  ),

  h1("1. サイトに入る"),
  body("**URL**　https://sktes-global-auction-theta.vercel.app"),
  body(
    "トップページの右上にある「ログイン」を押してください。" +
      "ログイン画面に「デモ用・ワンクリックで入力」という欄があり、" +
      "そこの「管理者」「出品者」「応札者」のボタンを押すと、その役割のメールアドレスとパスワードが入ります。"
  ),
  body("手で入力される場合は次のとおりです。パスワードは3つとも共通です。"),
  table(
    [
      ["役割", "メールアドレス", "パスワード"],
      ["管理者（SK TES 日本）", "admin@sktes-demo.com", "Demo!2026"],
      ["出品者（SK TES 各国拠点）", "seller@sktes-demo.com", "Demo!2026"],
      ["応札者（海外バイヤー）", "buyer@sktes-demo.com", "Demo!2026"],
    ],
    [2600, 3400, 2000]
  ),
  body("役割を切り替えるときは、画面左下の「ログアウト」から入り直してください。"),
  body(
    "画面右上のボタンで、日本語・英語・中国語を切り替えられます。" +
      "スマートフォンやタブレットでも同じ操作ができます。"
  ),

  h1("2. 応札者としてロットを探し、入札する"),
  body("buyer@sktes-demo.com でログインしてください。"),
  step(1, "ロットを探す", "左のメニューから「出品一覧」を開きます。カテゴリー・コンディション・国で絞り込めます。"),
  step(
    2,
    "ロットの中身で絞り込む",
    "一覧の上にある「ロットの中身で絞り込む」を開いて、メーカーに Dell、RAM下限に 16 と入れて検索してみてください。",
    "ロットに入っている一台一台のスペックを横断して探すので、「第8世代Core i5以上」「DDR4 16GB以上」といった条件でロットを見つけられます。条件に一致した台数が、そのままカードに表示されます。"
  ),
  step(
    3,
    "明細を見る",
    "ロットの詳細を開くと「ロット明細」があります。出品者がアップロードしたExcelを1行ずつ取り込んだもので、画面の中で検索でき、そのままExcelに書き出せます。"
  ),
  step(
    4,
    "入札する",
    "右側の「入札」から金額を入れて送信します。送信した瞬間に暗号化されるため、**ご自身でも金額を読み直すことはできません**。",
    "代わりに「改ざん検知ハッシュ」が表示されます。これが、締切後に開封された金額が入札時のものと同一であることの証拠になります。金額を変えたいときは、同じ画面から入札し直してください（前の入札は無効になります）。"
  ),
  step(
    5,
    "入札履歴を見る",
    "左のメニューの「入札履歴」です。締切前の入札は金額欄が「封印中」のままで、開封後に金額と結果が入ります。"
  ),

  h1("3. 出品者として出品し、封印を解いて落札者を決める"),
  body("seller@sktes-demo.com でログインしてください。"),
  step(
    1,
    "Excelから出品する",
    "「出品管理」→「新規出品」と進みます。2ステップ目でExcelを取り込みます。",
    "列の順番は自由で、日本語・英語どちらの見出しでも読み取ります。読み取れなかった行は取り込み前のプレビューに一覧で出るので、気づかないうちに捨てられることはありません。"
  ),
  step(
    2,
    "入札の条件を決める",
    "封印入札（フェーズ1）と通常のオークション（フェーズ2）を切り替えられます。締切間際の入札で自動延長する設定も、ここで指定します。",
    "日時はご自身のタイムゾーンで入力していただき、内部では協定世界時で保持します。"
  ),
  step(
    3,
    "封印を解除する",
    "締切を過ぎたロットの詳細に「締切につき封印を解除する」が出ます。締切前は押しても開きません。権限の設定ではなく、鍵そのものが開かない仕組みです。",
    "解除すると全社の金額が一斉に表示され、操作は監査ログに残ります。"
  ),
  step(
    4,
    "落札者を決める",
    "開封後の一覧から落札者を選びます。最高額以外の会社を選ぶこともできますが、その場合は理由の入力が必須で、入力した理由は監査ログに残ります。",
    "確定すると契約と請求書が作られ、応札した全社に通知が飛びます。"
  ),

  h1("4. 管理者として会員を審査し、記録を確認する"),
  body("admin@sktes-demo.com でログインしてください。"),
  step(
    1,
    "会員を審査する",
    "「会員管理」を開きます。仮登録 → 書類審査 → 本登録という流れです。提出書類は1件ずつ承認・差し戻しができます。",
    "書類がまだ揃っていない会社には、入札上限つきの仮承認も出せます。上限を超える入札は、その場で理由を示して拒否されます。"
  ),
  step(
    2,
    "ダッシュボードを見る",
    "国別の出品数、ステータスの分布、期間別の落札金額が出ます。審査待ちの会員と、まもなく締切のロットもここに並びます。"
  ),
  step(
    3,
    "不正を監視する",
    "「不正監視」では、法人番号の重複、同じIPアドレスからの複数会員の入札、中央値から大きく外れた入札、ログイン失敗の集中を、その場で計算して表示します。"
  ),
  step(
    4,
    "監査ログを確認する",
    "ログイン、出品、入札、落札確定、管理者の操作を検索できます。各行に保存期限（7年）が入っています。"
  ),
  step(
    5,
    "通知を確認する",
    "「通知」には、システムが送ったメールがすべて残ります。デモ環境ではメールサーバーにつないでいないため、実際の送信は行いません。"
  ),
  step(
    6,
    "請求書を見る",
    "「成約管理」から契約を開くと請求書が出ます。国内のバイヤーには適格請求書（消費税10%・登録番号入り）、海外のバイヤーには輸出免税の書式が出ます。管理者は両方の契約を見られます。"
  ),

  h1("5. 覚えておいていただきたい仕組み"),
  h2("封印入札"),
  body(
    "入札金額はロットごとに作った鍵で暗号化して保管します。データベースを直接開いても、そこにあるのは暗号文だけです。" +
      "復号の鍵はデータベースの外に置いてあり、締切の時刻と結びつけてあります。締切を書き換えると鍵が開かなくなります。" +
      "締切前に金額を表示する画面は、どの役割にも用意していません。"
  ),
  h2("自動延長"),
  body(
    "締切の直前に入札が入ると、締切を自動で後ろへずらします。何分前の入札で何分延ばすかは、出品ごとに指定できます。"
  ),
  h2("入札上限"),
  body("仮承認の会社には、1回の入札額に上限を設けられます。上限を超える入札は保存されず、理由を示して断ります。"),
  h2("多要素認証"),
  body(
    "設定画面から実際に有効にできます。表示されるQRコードは本物なので、Google Authenticator などのアプリでそのまま読み取れます。"
  ),
  h2("支払い方法"),
  body(
    "金額が一定額を超えると、クレジットカードとPayPalは選べなくなります。手数料の影響が大きいためです。" +
      "銀行振込か請求書払いをお選びいただきます。"
  ),

  h1("6. デモ環境についてのお断り"),
  bullet("会員・出品・入札のデータはすべて動作確認のために作った架空のものです。実在の取引や企業ではありません。"),
  bullet("メールは実際には送信しません。送ったはずの内容は「通知」に残ります。"),
  bullet(
    "触っているうちに状態がわからなくなったときは、管理者でログインして「デモ設定」→「初期状態に戻す」で元に戻せます。" +
      "会員も出品も入札もすべて作り直すため、実行するとログイン画面に戻ります。作られる内容は毎回同じです。"
  ),
  bullet("この「デモ設定」の画面は、本番構成では存在しません。"),

  body(""),
  body(
    "ご不明な点や、動きが想定と違うところがありましたら、どの画面で何をされたかだけお知らせください。こちらで確認いたします。"
  ),
].join("");

// -------------------------------------------------------------------- styles
const FONT = '<w:rFonts w:ascii="Yu Gothic" w:eastAsia="Yu Gothic" w:hAnsi="Yu Gothic" w:cs="Yu Gothic"/>';

const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr>${FONT}<w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="288" w:lineRule="auto"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Body">
    <w:name w:val="Body"/>
    <w:pPr><w:spacing w:after="120" w:line="288" w:lineRule="auto"/></w:pPr>
    <w:rPr>${FONT}<w:sz w:val="21"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="DocTitle">
    <w:name w:val="Doc Title"/>
    <w:pPr>
      <w:spacing w:after="360"/>
      <w:pBdr><w:bottom w:val="single" w:sz="12" w:space="6" w:color="163A6B"/></w:pBdr>
    </w:pPr>
    <w:rPr>${FONT}<w:b/><w:sz w:val="36"/><w:color w:val="163A6B"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Head1">
    <w:name w:val="Heading 1"/>
    <w:pPr><w:spacing w:before="400" w:after="160"/><w:keepNext/></w:pPr>
    <w:rPr>${FONT}<w:b/><w:sz w:val="27"/><w:color w:val="163A6B"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Head2">
    <w:name w:val="Heading 2"/>
    <w:pPr><w:spacing w:before="240" w:after="80"/><w:keepNext/></w:pPr>
    <w:rPr>${FONT}<w:b/><w:sz w:val="22"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Bullet">
    <w:name w:val="Bullet"/>
    <w:pPr><w:spacing w:after="100" w:line="288" w:lineRule="auto"/><w:ind w:left="284" w:hanging="284"/></w:pPr>
    <w:rPr>${FONT}<w:sz w:val="21"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="TableCell">
    <w:name w:val="Table Cell"/>
    <w:pPr><w:spacing w:before="60" w:after="60" w:line="240" w:lineRule="auto"/></w:pPr>
    <w:rPr>${FONT}<w:sz w:val="20"/></w:rPr>
  </w:style>
</w:styles>`;

const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${content}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1418" w:right="1276" w:bottom="1418" w:left="1276" w:header="851" w:footer="851" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`;

const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`;

const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>SK TES グローバル競売 デモ環境 操作マニュアル</dc:title>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`;

// ---------------------------------------------------------------------- write
const zip = new JSZip();
zip.file("[Content_Types].xml", contentTypes);
zip.folder("_rels").file(".rels", rootRels);
zip.folder("docProps").file("core.xml", core);
const word = zip.folder("word");
word.file("document.xml", document);
word.file("styles.xml", styles);
word.folder("_rels").file("document.xml.rels", docRels);

mkdirSync("docs", { recursive: true });
const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
writeFileSync(OUT, buffer);
console.log(`${OUT} — ${(buffer.length / 1024).toFixed(1)} KB`);
