import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { getDictionary, getLocale } from "@/i18n";
import { PublicHeader } from "@/components/PublicHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Badge, Container, Stat } from "@/components/ui";
import { Countdown } from "@/components/Countdown";
import { cipherFingerprint } from "@/lib/seal";
import { countryFlag, formatNumber } from "@/lib/format";
import { countdown, formatDateTime, zoneLabel } from "@/lib/datetime";
import { CATEGORY_ART, SELLER_SITES } from "@/components/visual/art";
import { Hanko } from "@/components/visual/Hanko";
import { WaTitle } from "@/components/visual/AmbientFX";
import {
  CornerMarks,
  Crane,
  Fuda,
  KanjiNum,
  KumoDivider,
  NorenHang,
  Sensu,
} from "@/components/visual/Ornaments";
import type { Locale } from "@/lib/constants";

export const dynamic = "force-dynamic";

type LandingData = {
  sellerCountries: number;
  openLots: { _sum: { quantity: number | null }; _count: number };
  approvedBuyers: number;
  buyerRegions: { region: string }[];
  featured: Awaited<ReturnType<typeof loadFeaturedLot>>;
  degraded: boolean;
};

function loadFeaturedLot() {
  return prisma.lot.findFirst({
    where: { status: "OPEN" },
    orderBy: { endAt: "asc" },
    include: {
      country: true,
      sellerCompany: true,
      bids: { where: { status: "SEALED" }, select: { ciphertext: true } },
      _count: { select: { bids: true, items: true } },
    },
  });
}

async function loadLandingData(): Promise<LandingData> {
  try {
    const [sellerCountries, openLots, approvedBuyers, buyerRegions, featured] =
      await Promise.all([
        prisma.country.count({ where: { isSellerSite: true } }),
        prisma.lot.aggregate({
          where: { status: "OPEN" },
          _sum: { quantity: true },
          _count: true,
        }),
        prisma.company.count({
          where: { type: "BUYER", status: { in: ["APPROVED", "PROVISIONAL"] } },
        }),
        prisma.country.findMany({
          where: { companies: { some: { type: "BUYER" } } },
          select: { region: true },
          distinct: ["region"],
        }),
        loadFeaturedLot(),
      ]);
    return {
      sellerCountries,
      openLots,
      approvedBuyers,
      buyerRegions,
      featured,
      degraded: false,
    };
  } catch (e) {
    console.error("[landing] database unavailable:", (e as Error).message);
    return {
      sellerCountries: 0,
      openLots: { _sum: { quantity: 0 }, _count: 0 },
      approvedBuyers: 0,
      buyerRegions: [],
      featured: null,
      degraded: true,
    };
  }
}

const EXTRA: Record<
  Locale,
  {
    catalogTitle: string;
    catalogLead: string;
    processTitle: string;
    processLead: string;
    steps: { n: string; title: string; body: string }[];
    season: string;
    greeting: string;
    hashira: string;
    footprintTitle: string;
    footprintLead: string;
    trust: { title: string; body: string }[];
    ctaTitle: string;
    ctaLead: string;
    featuredTitle: string;
    sealedHint: string;
    nowOpen: string;
    purpose: string;
    pills: string[];
    listedNow: string;
  }
> = {
  ja: {
    catalogTitle: "出品している商材",
    catalogLead: "パソコン・サーバー・携帯・タブレット・パーツ。100〜500台のロット単位です。",
    processTitle: "ご利用の流れ",
    processLead: "仮登録 → 書類審査 → 封印入札 → 落札。審査を通った法人だけが入札できます。",
    season: "令和八年・長月",
    greeting: "秋の気配とともに、公正なお取引を。",
    hashira: "グローバル競売",
    steps: [
      { n: "一", title: "仮登録", body: "会社名、担当者、輸出先、輸入ライセンスの有無を入力します。" },
      { n: "二", title: "書類審査", body: "登記簿、身分証、輸入ライセンス。日本国内は古物商許可証も必要です。" },
      { n: "三", title: "封印入札", body: "入札額は締切まで暗号化され、出品者にも管理者にも見えません。" },
      { n: "四", title: "落札と通知", body: "出品者が落札者を選び、理由を記録して通知します。" },
    ],
    footprintTitle: "出品拠点（21カ国）",
    footprintLead: "締切は世界標準時で保持し、画面では各国の現地時刻で表示します。",
    trust: [
      { title: "封印入札", body: "締切まで金額は暗号化。誰も先に読めません。" },
      { title: "多要素認証", body: "ID／パスワードに加え、認証アプリの6桁が必要です。" },
      { title: "監査ログ7年", body: "ログイン・出品・入札・落札を改ざんできない形で保管します。" },
      { title: "税務を自動で分ける", body: "国内は適格請求書、海外は輸出免税の書式です。" },
    ],
    ctaTitle: "デモで操作を確認する",
    ctaLead: "管理者・出品者・応札者の3アカウントを用意しています。パスワードは共通です。",
    featuredTitle: "まもなく締切のロット",
    sealedHint: "入札額はロット専用の鍵で暗号化されています。締切まで復号できません。",
    nowOpen: "入札受付中",
    purpose:
      "SK TESが世界21拠点で回収した中古パソコン・サーバー・携帯を、審査済みの法人だけが封印入札で競うクローズド市場です。",
    pills: ["法人限定", "封印入札", "世界21拠点", "100〜500台ロット"],
    listedNow: "いま出品中",
  },
  en: {
    catalogTitle: "What is listed",
    catalogLead: "PCs, servers, phones, tablets and parts, in lots of 100–500 units.",
    processTitle: "How to use the platform",
    processLead: "Register → document review → sealed bid → award. Only approved companies can bid.",
    season: "Reiwa 8 · Nagatsuki",
    greeting: "Autumn has arrived. Fair dealing, as ever.",
    hashira: "Global Auction",
    steps: [
      { n: "一", title: "Register", body: "Company, contact, export destinations, import-licence status." },
      { n: "二", title: "Review", body: "Registry, ID, import licence. Japan buyers also need an antique-dealer permit." },
      { n: "三", title: "Sealed bid", body: "The amount is encrypted until the deadline. Nobody can read it early." },
      { n: "四", title: "Award", body: "The seller picks a winner, records the reason, and notices go out." },
    ],
    footprintTitle: "Selling sites (21 countries)",
    footprintLead: "Deadlines are stored in UTC and shown in each viewer’s local time.",
    trust: [
      { title: "Sealed bids", body: "Amounts stay encrypted until the deadline." },
      { title: "MFA", body: "Password plus a six-digit authenticator code." },
      { title: "7-year audit log", body: "Sign-ins, listings, bids and awards are tamper-evident." },
      { title: "Tax split", body: "Qualified invoice for Japan, export-exempt for overseas." },
    ],
    ctaTitle: "Try the demo",
    ctaLead: "Three accounts: administrator, seller, bidder. Same password for all.",
    featuredTitle: "Lot closing soon",
    sealedHint: "The amount is encrypted under a key unique to this lot until the deadline.",
    nowOpen: "Open for bids",
    purpose:
      "A closed market where approved companies sealed-bid for used PCs, servers and phones recovered by SK TES at 21 sites.",
    pills: ["Corporate only", "Sealed bid", "21 countries", "Lots of 100–500"],
    listedNow: "On the floor now",
  },
  zh: {
    catalogTitle: "正在上架的商品",
    catalogLead: "电脑、服务器、手机、平板与配件，以100至500台为一批。",
    processTitle: "使用流程",
    processLead: "临时注册 → 资料审核 → 密封投标 → 成交。仅通过审核的企业可以投标。",
    season: "令和八年・长月",
    greeting: "秋意渐浓，公平交易如常。",
    hashira: "全球竞卖",
    steps: [
      { n: "一", title: "临时注册", body: "填写公司、联系人、出口目的地与进口许可。" },
      { n: "二", title: "资料审核", body: "登记簿、身份证明、进口许可。日本国内还需古物商许可。" },
      { n: "三", title: "密封投标", body: "金额在截止前加密，出品方与管理员均无法查看。" },
      { n: "四", title: "成交通知", body: "出品方选定成交方，记录理由并发送通知。" },
    ],
    footprintTitle: "出品据点（21个国家）",
    footprintLead: "截止时间以协定世界时保存，屏幕上显示为当地时间。",
    trust: [
      { title: "密封投标", body: "截止前金额加密，无人可提前读取。" },
      { title: "多因素认证", body: "密码之外还需认证应用的6位验证码。" },
      { title: "7年审计日志", body: "登录、上架、投标、成交以防篡改方式保存。" },
      { title: "税务自动区分", body: "日本国内开具合规发票，海外为出口免税。" },
    ],
    ctaTitle: "用演示账号操作",
    ctaLead: "管理员、出品方、投标方三个账号，密码相同。",
    featuredTitle: "即将截止的标的",
    sealedHint: "金额以标的专属密钥加密，截止前无法解密。",
    nowOpen: "正在接受投标",
    purpose:
      "经审核的企业以密封投标竞购SK TES在全球21个据点回收的二手电脑、服务器与手机。仅限法人。",
    pills: ["仅限企业", "密封投标", "全球21据点", "100至500台一批"],
    listedNow: "正在上架",
  },
};

export default async function HomePage() {
  const locale = await getLocale();
  const dict = await getDictionary();
  const extra = EXTRA[locale];
  const now = new Date();

  const landing = await loadLandingData();
  const { sellerCountries, openLots, approvedBuyers, buyerRegions, featured } =
    landing;

  const featuredCountdown = featured ? countdown(featured.endAt, now) : null;
  const initialCountdown = featuredCountdown
    ? featuredCountdown.days > 0
      ? `${featuredCountdown.days}d ${String(featuredCountdown.hours).padStart(2, "0")}:${String(featuredCountdown.minutes).padStart(2, "0")}:${String(featuredCountdown.seconds).padStart(2, "0")}`
      : `${String(featuredCountdown.hours).padStart(2, "0")}:${String(featuredCountdown.minutes).padStart(2, "0")}:${String(featuredCountdown.seconds).padStart(2, "0")}`
    : "--:--:--";

  const features = [
    { key: "seal", title: dict.home.features.sealTitle, body: dict.home.features.sealBody },
    { key: "search", title: dict.home.features.searchTitle, body: dict.home.features.searchBody },
    { key: "tz", title: dict.home.features.timezoneTitle, body: dict.home.features.timezoneBody },
    { key: "audit", title: dict.home.features.auditTitle, body: dict.home.features.auditBody },
    { key: "mfa", title: dict.home.features.mfaTitle, body: dict.home.features.mfaBody },
    { key: "i18n", title: dict.home.features.i18nTitle, body: dict.home.features.i18nBody },
  ];

  const categories = [
    { code: "PC" as const, href: "/lots?category=PC" },
    { code: "SERVER" as const, href: "/lots?category=SERVER" },
    { code: "MOBILE" as const, href: "/lots?category=MOBILE" },
    { code: "TABLET" as const, href: "/lots?category=TABLET" },
    { code: "PARTS" as const, href: "/lots?category=PARTS" },
  ];

  const stats = [
    { l: dict.home.statsCountries, v: sellerCountries, u: dict.home.statsCountriesUnit },
    { l: dict.home.statsUnits, v: formatNumber(openLots._sum.quantity ?? 0, locale), u: dict.home.statsUnitsUnit },
    { l: dict.home.statsBuyers, v: approvedBuyers, u: dict.home.statsBuyersUnit },
    { l: dict.home.statsRegions, v: buyerRegions.length, u: dict.home.statsRegionsUnit },
  ];

  return (
    <>
      <PublicHeader />

      <main id="main">
        {landing.degraded && (
          <div className="border-b border-warn/30 bg-warn-bg">
            <Container wide className="py-3">
              <p className="text-sm font-semibold text-warn">デモデータを読み込めませんでした</p>
              <p className="mt-0.5 text-xs text-warn">
                データベースに接続できません。{" "}
                <a href="/api/health" className="font-semibold underline">/api/health</a>
              </p>
            </Container>
          </div>
        )}

        <section className="bg-white">
          <div className="wave-band" />
          <div className="border-y border-line bg-brand-50">
            <Container wide className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
              <p className="font-serif text-sm font-bold tracking-wide text-[var(--indigo)]">
                {extra.purpose}
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {extra.pills.map((pill) => (
                  <li key={pill}>
                    <Fuda className="!min-w-0 !px-2.5 !py-0.5 !text-[11px] !tracking-wider">{pill}</Fuda>
                  </li>
                ))}
              </ul>
            </Container>
          </div>

          <div className="flex flex-col-reverse lg:grid lg:min-h-[calc(100dvh-9.5rem)] lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <div className="relative flex flex-col justify-center px-5 py-8 sm:px-10 lg:px-12 xl:px-16">
              <Sensu className="absolute right-6 top-6 hidden opacity-60 lg:block" />
              <div className="flex items-start gap-4">
                <span className="tategaki hidden text-sm text-[var(--vermilion)] sm:block">
                  封印入札
                </span>
                <div className="min-w-0">
                  <p className="wa-kicker">{dict.home.heroBadge}</p>
                  <h1 className="font-serif mt-3 whitespace-pre-line text-[1.85rem] font-bold leading-[1.35] tracking-wide text-ink sm:text-4xl lg:text-[2.65rem]">
                    {dict.home.heroTitle}
                  </h1>
                  <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-2">
                    {dict.home.heroLead}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link href="/login" className="btn btn-primary px-6 py-3">
                      {dict.home.ctaPrimary}
                    </Link>
                    <Link href="/lots" className="btn btn-ghost px-6 py-3">
                      {dict.home.ctaSecondary}
                    </Link>
                  </div>
                  <dl className="mt-6 grid grid-cols-2 gap-2 xl:grid-cols-4">
                    {stats.map((s) => (
                      <div key={s.l} className="fx tilt rounded-xl bg-brand-50 px-3 py-2.5">
                        <dt className="text-[11px] font-bold text-brand-700">{s.l}</dt>
                        <dd className="mt-0.5 flex items-baseline gap-1">
                          <span className="tnum text-xl font-extrabold text-ink">{s.v}</span>
                          <span className="text-[10px] text-muted">{s.u}</span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {featured && (
                    <Link
                      href={`/lots/${featured.id}`}
                      className="card tilt mt-5 flex overflow-hidden"
                    >
                      <span className="relative hidden w-28 shrink-0 sm:block">
                        <Image
                          src={CATEGORY_ART[featured.categoryCode] ?? "/images/cat-pc-tall.png"}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="112px"
                        />
                      </span>
                      <span className="min-w-0 flex-1 p-3">
                        <span className="text-[11px] font-bold text-seal">{extra.nowOpen}</span>
                        <span className="mt-0.5 block truncate text-sm font-extrabold text-ink">
                          {locale === "ja" ? featured.title : featured.titleEn}
                        </span>
                        <Countdown
                          endAt={featured.endAt.toISOString()}
                          initial={initialCountdown}
                          urgency={false}
                          className="mt-1 block text-sm text-ink"
                        />
                      </span>
                    </Link>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-rows-[minmax(14rem,1.35fr)_7.5rem] gap-2 p-2 sm:grid-rows-[minmax(18rem,1.45fr)_8.5rem] sm:p-3 lg:min-h-0 lg:p-4">
              <div className="relative overflow-hidden rounded-2xl">
                <CornerMarks />
                <Image
                  src="/images/hero-bright.png"
                  alt="SK TESのIT機器倉庫"
                  fill
                  priority
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 55vw"
                />
                <span className="hashira-banner">{extra.hashira}</span>
                <Hanko className="stamp-in absolute bottom-4 right-4 z-10" size={92} />
                <p className="absolute bottom-4 left-20 z-10 rounded-full bg-white/94 px-3 py-1 text-xs font-bold text-ink shadow-sm sm:left-24">
                  {extra.listedNow}
                </p>
              </div>
              <ul className="grid h-full grid-cols-5 gap-2">
                {categories.map((c) => (
                  <li key={c.code} className="h-full">
                    <Link
                      href={c.href}
                      className="relative block h-full overflow-hidden rounded-xl"
                    >
                      <Image
                        src={CATEGORY_ART[c.code]}
                        alt={dict.category[c.code]}
                        fill
                        priority
                        className="object-cover"
                        sizes="20vw"
                      />
                      <Fuda className="absolute inset-x-1 bottom-1 z-10 !min-w-0 !px-1 !py-0.5 !text-[10px] !tracking-normal">
                        {dict.category[c.code]}
                      </Fuda>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
        <div className="bg-white text-brand-50">
          <KumoDivider />
        </div>

        {featured && (
          <section className="bg-brand-50 py-12 sm:py-16">
            <Container wide>
              <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                <WaTitle tate="出品" kicker={extra.nowOpen} title={extra.featuredTitle} />
                <Link href={`/lots/${featured.id}`} className="btn btn-primary">
                  {dict.common.detail}
                </Link>
              </div>
              <div className="card tilt relative overflow-hidden lg:grid lg:grid-cols-2">
                <Hanko className="stamp-in absolute right-4 top-4 z-10" size={84} />
                <div className="relative min-h-[22rem] lg:min-h-[32rem]">
                  <CornerMarks />
                  <Image
                    src={CATEGORY_ART[featured.categoryCode] ?? "/images/cat-pc-tall.png"}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                  <Fuda className="absolute bottom-4 left-4 z-10">{extra.nowOpen}</Fuda>
                </div>
                <div className="flex flex-col justify-center p-6 sm:p-10">
                  <p className="font-mono text-sm text-brand-700">{featured.lotNumber}</p>
                  <h3 className="mt-2 text-2xl font-extrabold leading-snug text-ink">
                    {locale === "ja" ? featured.title : featured.titleEn}
                  </h3>
                  <p className="mt-2 text-sm text-ink-2">
                    {featured.country.nameEn} · {formatDateTime(featured.endAt, featured.country.timezone, locale)}{" "}
                    {zoneLabel(featured.endAt, featured.country.timezone)}
                  </p>
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-brand-50 p-4">
                      <p className="text-xs font-bold text-brand-700">{dict.lot.remaining}</p>
                      <Countdown
                        endAt={featured.endAt.toISOString()}
                        initial={initialCountdown}
                        urgency={false}
                        className="mt-1 block text-xl text-ink"
                      />
                    </div>
                    <div className="rounded-2xl bg-brand-50 p-4">
                      <p className="text-xs font-bold text-brand-700">{dict.lot.bidCount}</p>
                      <p className="tnum mt-1 text-xl font-extrabold">{featured._count.bids}</p>
                    </div>
                  </div>
                  <ul className="mt-5 space-y-2">
                    {featured.bids.slice(0, 3).map((b, i) => (
                      <li key={i} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2 font-mono text-xs">
                        <span>{cipherFingerprint(b.ciphertext)}</span>
                        <span className="animate-seal font-sans font-bold text-seal">封印</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-sm text-ink-2">{extra.sealedHint}</p>
                </div>
              </div>
            </Container>
          </section>
        )}

        <div className="bg-brand-50 text-white">
          <KumoDivider />
        </div>

        <section className="bg-white py-14 sm:py-16">
          <Container wide>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {extra.trust.map((t, i) => (
                <li key={t.title} className="card fx tilt reveal kumiko p-5">
                  <Hanko label={["封印", "認証", "監査", "税務"][i] ?? "印"} size={56} />
                  <p className="font-serif mt-3 text-xl text-[var(--vermilion)]">{t.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">{t.body}</p>
                </li>
              ))}
            </ul>
          </Container>
        </section>

        <section className="bg-bg py-16 sm:py-20">
          <Container wide>
            <WaTitle tate="商材" kicker="品目" title={extra.catalogTitle} lead={extra.catalogLead} />
            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((c) => (
                <li key={c.code} className={c.code === "PC" || c.code === "SERVER" ? "lg:col-span-1" : ""}>
                  <Link href={c.href} className="card card-hover tilt reveal block overflow-hidden">
                    <div className="relative h-72 sm:h-80">
                      <CornerMarks />
                      <Image
                        src={CATEGORY_ART[c.code]}
                        alt={dict.category[c.code]}
                        fill
                        className="object-cover"
                        sizes="(max-width: 1024px) 100vw, 33vw"
                      />
                      <Fuda className="absolute bottom-4 left-4 z-10">{dict.category[c.code]}</Fuda>
                    </div>
                    <div className="flex items-center justify-between px-5 py-4">
                      <p className="font-serif text-xl font-bold text-ink">{dict.category[c.code]}</p>
                      <span className="text-sm font-bold text-brand-600">{dict.common.open}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </section>

        <section className="bg-white py-16 sm:py-20">
          <Container wide>
            <WaTitle tate="流れ" kicker="手順" title={extra.processTitle} lead={extra.processLead} />
            <ol className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {extra.steps.map((step) => (
                <li key={step.title} className="fx tilt reveal rounded-2xl bg-brand-50 p-6">
                  <KanjiNum n={step.n} />
                  <h3 className="font-serif mt-4 text-lg font-bold text-ink">{step.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-ink-2">{step.body}</p>
                </li>
              ))}
            </ol>
          </Container>
        </section>

        <section className="bg-bg py-16 sm:py-20">
          <Container wide>
            <WaTitle tate="仕組み" kicker="機能" title={dict.home.featureTitle} />
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <li key={f.key} className="card fx tilt reveal kumiko p-6">
                  <h3 className="text-lg font-extrabold text-ink">{f.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-ink-2">{f.body}</p>
                </li>
              ))}
            </ul>
          </Container>
        </section>

        <section className="bg-white py-16 sm:py-20">
          <Container wide>
            <div className="tilt relative overflow-hidden rounded-3xl border border-line bg-brand-50 lg:grid lg:grid-cols-2">
              <div className="relative min-h-[20rem] lg:min-h-[28rem]">
                <CornerMarks />
                <Image
                  src="/images/atrium-bright.png"
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
              <div className="p-6 sm:p-10">
                <WaTitle tate="世界" kicker="拠点" title={extra.footprintTitle} lead={extra.footprintLead} />
                <ul className="mt-6 flex flex-wrap gap-2">
                  {SELLER_SITES.map((s) => (
                    <li
                      key={s.code}
                      className="fx rounded-full bg-white px-3 py-1.5 text-sm font-medium text-ink shadow-sm"
                    >
                      {countryFlag(s.code)}{" "}
                      {locale === "ja" ? s.ja : locale === "zh" ? s.zh : s.en}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Container>
        </section>

        <section className="bg-bg py-16 sm:py-20">
          <Container wide>
            <div className="washi-scroll relative overflow-hidden rounded-3xl">
              <CornerMarks />
              <div className="border-b border-line px-6 py-5 sm:px-8">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-extrabold text-ink">{dict.home.demoTitle}</h2>
                  <Badge tone="warn">{dict.footer.demoNotice}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted">{dict.home.demoLead}</p>
              </div>
              <div className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                {[
                  { role: dict.home.demoAdmin, email: "admin@sktes-demo.com", tone: "brand" as const },
                  { role: dict.home.demoSeller, email: "seller@sktes-demo.com", tone: "info" as const },
                  { role: dict.home.demoBidder, email: "buyer@sktes-demo.com", tone: "success" as const },
                ].map((a) => (
                  <div key={a.email} className="p-6">
                    <Badge tone={a.tone}>{a.role}</Badge>
                    <p className="mt-3 select-all font-mono text-sm font-semibold">{a.email}</p>
                    <p className="mt-1 text-xs text-muted">
                      {dict.home.demoPassword}:{" "}
                      <span className="select-all font-mono font-semibold">Demo!2026</span>
                    </p>
                  </div>
                ))}
              </div>
              <div className="border-t border-line bg-warn-bg px-6 py-4">
                <p className="text-sm font-semibold text-warn">{dict.home.noticeTitle}</p>
                <p className="mt-0.5 text-xs text-warn">{dict.home.noticeBody}</p>
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label={dict.nav.lots} value={openLots._count} unit="lots" hint={dict.lotStatus.OPEN} />
              <Stat
                label={dict.lot.manifest}
                value={formatNumber(featured?._count.items ?? 0, locale)}
                unit="lines"
                hint={dict.home.features.searchTitle}
              />
              <Stat label={dict.common.company} value={approvedBuyers} unit={dict.home.statsBuyersUnit} />
              <Stat label={dict.common.country} value={sellerCountries} unit={dict.home.statsCountriesUnit} />
            </div>
          </Container>
        </section>

        <section className="cta-noren py-16 text-white">
          <NorenHang labels={["入", "場", "審", "査", "入", "札"]} />
          <Container wide className="relative pt-8">
            <Crane size={72} className="absolute right-6 top-0 text-amber-200" />
            <h2 className="font-serif text-3xl font-bold tracking-wide sm:text-4xl">{extra.ctaTitle}</h2>
            <span className="mizuhiki" />
            <p className="mt-3 max-w-2xl text-base text-white/90">{extra.ctaLead}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="btn bg-white px-6 py-3 text-brand-700 hover:bg-brand-50">
                {dict.home.ctaPrimary}
              </Link>
              <Link href="/register" className="btn border-white/40 bg-transparent px-6 py-3 text-white hover:bg-white/10">
                {dict.common.register}
              </Link>
            </div>
          </Container>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
