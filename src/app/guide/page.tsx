import Link from "next/link";
import type { Metadata } from "next";
import { getDictionary, getLocale } from "@/i18n";
import { PublicHeader } from "@/components/PublicHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Badge, Card, Container } from "@/components/ui";
import { CornerMarks, Fuda, KanjiNum } from "@/components/visual/Ornaments";
import { WaTitle } from "@/components/visual/AmbientFX";
import type { Locale } from "@/lib/constants";

export const metadata: Metadata = {
  title: "ご利用ガイド",
  description:
    "SK TES Global Auction の使い方。会員登録から書類審査、封印入札、落札、請求、引渡しまでの流れと、デモ環境の歩き方をまとめています。",
};

type Step = { title: string; body: string; href?: string; linkLabel?: string };
type Section = { role: string; badge: string; steps: Step[] };

const CONTENT: Record<Locale, { lead: string; sections: Section[]; notes: string[] }> = {
  ja: {
    lead: "デモ環境は3つの役割で入れます。それぞれの画面でできることを順番にまとめました。上から順に触っていただければ、システム全体をひととおりご確認いただけます。",
    sections: [
      {
        role: "応札者（海外バイヤー）",
        badge: "ID: buyer",
        steps: [
          { title: "出品を探す", body: "出品一覧から、カテゴリー・コンディション・国で絞り込めます。ここまでは普通の一覧画面です。", href: "/lots", linkLabel: "出品一覧を開く" },
          { title: "ロットの中身で絞り込む", body: "「ロットの中身で絞り込む」を開いて、メーカーに Dell、RAM下限に 16 と入れてみてください。ロットに含まれる個体のスペックで横断検索します。一致した明細の台数もカードに出ます。", href: "/lots?maker=Dell&minRam=16", linkLabel: "Dell・16GB以上で検索" },
          { title: "明細を確認する", body: "ロット詳細のロット明細は、出品者がアップロードしたExcelを1行ずつ取り込んだものです。画面内で検索でき、Excelとして書き出せます。" },
          { title: "入札する", body: "金額を入れて送信すると、その場で暗号化されて保管されます。ご自身でも金額を再表示できません。表示される改ざん検知ハッシュが、開封時に金額が一致することの証明になります。" },
          { title: "入札履歴を見る", body: "封印中の入札は金額欄が「封印中」のままです。開封後に金額と結果が入ります。", href: "/bids", linkLabel: "入札履歴" },
        ],
      },
      {
        role: "出品者（SK TES 各国拠点）",
        badge: "ID: seller",
        steps: [
          { title: "Excelから出品する", body: "新規出品の2ステップ目でExcelを取り込みます。列の順番は自由で、日本語・英語どちらのヘッダーでも読み取ります。読めなかった行はプレビューに一覧表示され、黙って捨てられることはありません。", href: "/listings/new", linkLabel: "新規出品" },
          { title: "入札条件を決める", body: "封印入札（フェーズ1）とオークション（フェーズ2）を切り替えられます。締切間際の入札で自動延長する設定もここです。日時はご自身のタイムゾーンで入力し、内部では協定世界時に直します。" },
          { title: "締切後に封印を解除する", body: "締切を過ぎたロットの詳細画面に「封印を解除する」が出ます。締切前は押しても解除できません。権限の問題ではなく、鍵が開かない仕組みです。" },
          { title: "落札者を選ぶ", body: "最高額以外を選ぶこともできますが、その場合は理由の入力が必須です。理由は監査ログに残ります。" },
        ],
      },
      {
        role: "管理者（SK TES 日本）",
        badge: "ID: admin",
        steps: [
          { title: "会員を審査する", body: "仮登録 → 書類審査 → 本登録の流れです。書類を1件ずつ承認・差し戻しでき、入札上限つきの仮承認もできます。", href: "/admin/members", linkLabel: "会員管理" },
          { title: "ダッシュボードを見る", body: "国別の出品数、ステータス分布、月別の落札金額を表示します。", href: "/dashboard", linkLabel: "ダッシュボード" },
          { title: "不正を監視する", body: "法人番号の重複、同一IPからの複数会員の入札、中央値から外れた入札、ログイン失敗の集中を、その場で計算して表示します。", href: "/admin/fraud", linkLabel: "不正監視" },
          { title: "監査ログを確認する", body: "ログイン、出品、入札、落札確定、管理者操作を検索できます。各行に保存期限（7年）が入っています。", href: "/admin/audit", linkLabel: "監査ログ" },
          { title: "送信済みの通知を見る", body: "システムが送ったメールはすべて残ります。デモ環境ではSMTPに接続していないため、実際の送信は行いません。", href: "/admin/notifications", linkLabel: "通知アウトボックス" },
        ],
      },
    ],
    notes: [
      "MFA（多要素認証）は設定画面から実際に有効にできます。表示されるQRコードは本物なので、Google Authenticator などで読み取れます。",
      "請求書は、国内バイヤーには適格請求書（消費税10%・登録番号入り）、海外バイヤーには輸出免税の書式が出ます。同じ画面から別の書類が出ることをご確認ください。",
      "クレジットカードとPayPalは、金額が上限を超えると選べません。手数料の影響が大きいためです。",
    ],
  },
  en: {
    lead: "The demo has three roles. Work down this page and you will have seen the whole system.",
    sections: [
      {
        role: "Bidder (overseas buyer)",
        badge: "ID: buyer",
        steps: [
          { title: "Find a lot", body: "Filter the lot list by category, condition and country.", href: "/lots", linkLabel: "Open lot list" },
          { title: "Search inside the lot", body: "Open the spec filter and try maker Dell with a 16GB RAM floor. The search runs across the contents of every lot, and each card shows how many matching units it holds.", href: "/lots?maker=Dell&minRam=16", linkLabel: "Search Dell, 16GB+" },
          { title: "Read the manifest", body: "The manifest is the seller Excel parsed line by line. It is searchable in place and exports back to Excel." },
          { title: "Place a bid", body: "The amount is encrypted the moment it is submitted. Even you cannot read it back. The tamper-check hash shown to you is what proves the amount at opening time." },
          { title: "Review your bids", body: "Sealed bids show no amount until the lot is opened.", href: "/bids", linkLabel: "Bid history" },
        ],
      },
      {
        role: "Seller (SK TES country site)",
        badge: "ID: seller",
        steps: [
          { title: "List from Excel", body: "Step two of the new-listing wizard imports a workbook. Column order is free, headers may be Japanese or English, and any row that cannot be read is listed rather than dropped.", href: "/listings/new", linkLabel: "New listing" },
          { title: "Set the terms", body: "Switch between sealed bid (phase 1) and open auction (phase 2), and turn on soft close. Times are entered in your own zone and stored in UTC." },
          { title: "Open the seal", body: "After the deadline the lot detail offers to open the seal. Before the deadline it simply cannot be opened - the key will not decrypt." },
          { title: "Pick the winner", body: "You may select any bidder, but choosing anyone other than the highest requires a written reason, which is stored in the audit log." },
        ],
      },
      {
        role: "Administrator (SK TES Japan)",
        badge: "ID: admin",
        steps: [
          { title: "Review members", body: "Provisional entry, document review, then full approval - or conditional approval with a bid cap.", href: "/admin/members", linkLabel: "Members" },
          { title: "Read the dashboard", body: "Lots by country, status distribution and awarded value by month.", href: "/dashboard", linkLabel: "Dashboard" },
          { title: "Watch for fraud", body: "Duplicate company numbers, several members bidding from one address, bids far off the median, and clusters of failed sign-ins - all computed live.", href: "/admin/fraud", linkLabel: "Fraud monitoring" },
          { title: "Search the audit log", body: "Every sign-in, listing, bid, award and administrator action, each row carrying its own seven-year retention date.", href: "/admin/audit", linkLabel: "Audit log" },
          { title: "Check the outbox", body: "Every message the platform sent. The demo has no mail server attached.", href: "/admin/notifications", linkLabel: "Notification outbox" },
        ],
      },
    ],
    notes: [
      "MFA can genuinely be switched on from the settings screen; the QR code is real and scans into any authenticator app.",
      "Invoices differ by buyer: a Japanese qualified invoice with 10% tax and a registration number, or an export-exempt document. Same screen, different paperwork.",
      "Card and PayPal are unavailable above the configured ceiling, because the processing fee on a large lot is not small.",
    ],
  },
  zh: {
    lead: "演示环境提供三种角色。按本页顺序操作，即可完整体验整个系统。",
    sections: [
      {
        role: "投标方（海外买家）",
        badge: "ID: buyer",
        steps: [
          { title: "查找标的", body: "可按类别、成色与国家筛选标的一览。", href: "/lots", linkLabel: "打开标的一览" },
          { title: "按标的内容检索", body: "展开「按标的内容筛选」，尝试厂商填 Dell、RAM下限填 16。系统会跨标的检索其中单品的规格，并在卡片上显示匹配数量。", href: "/lots?maker=Dell&minRam=16", linkLabel: "检索 Dell 16GB 以上" },
          { title: "查看明细", body: "明细来自出品方上传的Excel逐行导入，可在页面内检索，也可导出为Excel。" },
          { title: "参与投标", body: "金额提交后立即加密保存，您本人也无法再次查看。显示的防篡改哈希即为开封时金额一致的凭据。" },
          { title: "查看投标记录", body: "密封中的投标在开封前不显示金额。", href: "/bids", linkLabel: "投标记录" },
        ],
      },
      {
        role: "出品方（SK TES 各国据点）",
        badge: "ID: seller",
        steps: [
          { title: "用Excel上架", body: "新增上架第二步导入工作簿。列顺序自由，表头支持中日英，无法读取的行会列出而非丢弃。", href: "/listings/new", linkLabel: "新增上架" },
          { title: "设定投标条件", body: "可切换密封投标（第一阶段）与公开竞拍（第二阶段），并开启自动延时。时间按您所在时区输入，内部以协定世界时保存。" },
          { title: "截止后解除密封", body: "过了截止时间，标的详情会出现解除密封的按钮；截止前无法解除，因为密钥不会解密。" },
          { title: "选定成交方", body: "可选择任意投标方，但若非最高价则必须填写理由，理由会记入审计日志。" },
        ],
      },
      {
        role: "管理员（SK TES 日本）",
        badge: "ID: admin",
        steps: [
          { title: "审核会员", body: "临时注册 → 资料审核 → 正式注册，也可设投标上限临时批准。", href: "/admin/members", linkLabel: "会员管理" },
          { title: "查看仪表板", body: "按国家的上架数、状态分布与按月成交金额。", href: "/dashboard", linkLabel: "仪表板" },
          { title: "监控异常", body: "法人编号重复、同一IP多会员投标、偏离中位数的投标、集中的登录失败，均实时计算。", href: "/admin/fraud", linkLabel: "异常监控" },
          { title: "检索审计日志", body: "登录、上架、投标、成交确定与管理员操作，每行都带7年保存期限。", href: "/admin/audit", linkLabel: "审计日志" },
          { title: "查看发件箱", body: "平台发送的全部消息。演示环境未接入邮件服务器。", href: "/admin/notifications", linkLabel: "通知发件箱" },
        ],
      },
    ],
    notes: [
      "可在设置页真实启用MFA，二维码可直接用认证应用扫描。",
      "发票按买家区分：日本国内为含10%消费税与登记编号的合规发票，海外为出口免税单据。",
      "金额超过上限时无法选择信用卡与PayPal，因为大额交易的手续费影响显著。",
    ],
  },
};

export default async function GuidePage() {
  const locale = await getLocale();
  const dict = await getDictionary();
  const content = CONTENT[locale];

  return (
    <>
      <PublicHeader />
      <main id="main">
        <section className="border-b border-line bg-surface">
          <div className="grid lg:grid-cols-2">
            <div className="px-5 py-14 sm:px-10 lg:py-20">
              <WaTitle as="h1" tate="案内" kicker={dict.footer.demoNotice} title={dict.nav.guide} lead={content.lead} />
              <div className="mt-6 flex flex-wrap gap-2">
                <Link href="/login" className="btn btn-primary">
                  {dict.home.ctaPrimary}
                </Link>
                <Link href="/lots" className="btn btn-ghost">
                  {dict.home.ctaSecondary}
                </Link>
              </div>
            </div>
            <div className="relative min-h-[16rem] overflow-hidden lg:min-h-full">
              <CornerMarks />
              <img
                src="/images/hero-bright.png"
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
              <span className="hashira-banner">ご利用ガイド</span>
            </div>
          </div>
        </section>

        <Container className="py-12">
          <div className="space-y-8">
            {content.sections.map((section) => (
              <Card key={section.role} className="tilt reveal relative overflow-hidden">
                <CornerMarks />
                <div className="ichimatsu-band flex flex-wrap items-center gap-3 border-b border-line px-6 py-4">
                  <Fuda>{section.role.split(/[（(]/)[0] ?? section.role}</Fuda>
                  <h2 className="font-serif text-lg font-bold text-ink">{section.role}</h2>
                  <Badge tone="brand">
                    <span className="font-mono">{section.badge}</span>
                  </Badge>
                  <span className="text-xs text-muted">
                    {dict.home.demoPassword}:{" "}
                    <span className="font-mono font-semibold">Demo!2026</span>
                  </span>
                </div>

                <ol className="divide-y divide-line">
                  {section.steps.map((step, i) => (
                    <li key={step.title} className="flex gap-4 px-6 py-5">
                      <KanjiNum n={["一", "二", "三", "四", "五", "六"][i] ?? String(i + 1)} />
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-ink">{step.title}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-ink-2">
                          {step.body}
                        </p>
                        {step.href && (
                          <Link
                            href={step.href}
                            className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
                          >
                            {step.linkLabel}
                            <span aria-hidden="true">→</span>
                          </Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </Card>
            ))}

            <Card className="p-6">
              <h2 className="text-base font-bold text-ink">
                {dict.home.noticeTitle}
              </h2>
              <ul className="mt-3 space-y-2">
                {content.notes.map((n) => (
                  <li key={n} className="flex gap-2 text-sm leading-relaxed text-ink-2">
                    <span className="text-brand" aria-hidden="true">
                      ·
                    </span>
                    {n}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
