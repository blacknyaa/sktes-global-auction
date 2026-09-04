import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getDictionary, getLocale } from "@/i18n";
import { PublicHeader } from "@/components/PublicHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Badge, Container, Stat } from "@/components/ui";
import { Countdown } from "@/components/Countdown";
import { cipherFingerprint } from "@/lib/seal";
import { formatNumber } from "@/lib/format";
import { countdown, formatDateTime, zoneLabel } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const locale = await getLocale();
  const dict = await getDictionary();
  const now = new Date();

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
      prisma.lot.findFirst({
        where: { status: "OPEN" },
        orderBy: { endAt: "asc" },
        include: {
          country: true,
          sellerCompany: true,
          bids: { where: { status: "SEALED" }, select: { ciphertext: true } },
          _count: { select: { bids: true, items: true } },
        },
      }),
    ]);

  const featuredCountdown = featured
    ? countdown(featured.endAt, now)
    : null;
  const initialCountdown = featuredCountdown
    ? featuredCountdown.days > 0
      ? `${featuredCountdown.days}d ${String(featuredCountdown.hours).padStart(2, "0")}:${String(featuredCountdown.minutes).padStart(2, "0")}:${String(featuredCountdown.seconds).padStart(2, "0")}`
      : `${String(featuredCountdown.hours).padStart(2, "0")}:${String(featuredCountdown.minutes).padStart(2, "0")}:${String(featuredCountdown.seconds).padStart(2, "0")}`
    : "--:--:--";

  const features = [
    { key: "seal", title: dict.home.features.sealTitle, body: dict.home.features.sealBody, icon: <IconLock /> },
    { key: "search", title: dict.home.features.searchTitle, body: dict.home.features.searchBody, icon: <IconSearch /> },
    { key: "tz", title: dict.home.features.timezoneTitle, body: dict.home.features.timezoneBody, icon: <IconGlobe /> },
    { key: "audit", title: dict.home.features.auditTitle, body: dict.home.features.auditBody, icon: <IconShield /> },
    { key: "mfa", title: dict.home.features.mfaTitle, body: dict.home.features.mfaBody, icon: <IconKey /> },
    { key: "i18n", title: dict.home.features.i18nTitle, body: dict.home.features.i18nBody, icon: <IconLang /> },
  ];

  return (
    <>
      <PublicHeader />

      <main id="main">
        {/* ---- hero ---- */}
        <section className="relative overflow-hidden bg-brand-950 text-white">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.16]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.7) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
              maskImage:
                "radial-gradient(ellipse 80% 60% at 30% 0%, #000 40%, transparent 100%)",
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-40 -top-40 size-[36rem] rounded-full opacity-40 blur-3xl"
            style={{
              background:
                "radial-gradient(circle, var(--brand-500) 0%, transparent 65%)",
            }}
          />

          <Container wide className="relative grid gap-12 py-16 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:py-24">
            <div>
              <span className="badge bg-white/10 text-brand-200 ring-1 ring-inset ring-white/15">
                <span className="size-1.5 rounded-full bg-brand-300" />
                {dict.home.heroBadge}
              </span>

              <h1 className="mt-5 whitespace-pre-line text-balance text-3xl font-bold leading-[1.25] tracking-tight sm:text-4xl lg:text-[2.9rem]">
                {dict.home.heroTitle}
              </h1>

              <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-brand-100/90">
                {dict.home.heroLead}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className="btn bg-white text-brand-900 hover:bg-brand-50"
                >
                  {dict.home.ctaPrimary}
                </Link>
                <Link
                  href="/lots"
                  className="btn border-white/25 bg-white/5 text-white hover:bg-white/10"
                >
                  {dict.home.ctaSecondary}
                </Link>
              </div>

              <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
                {[
                  { l: dict.home.statsCountries, v: sellerCountries, u: dict.home.statsCountriesUnit },
                  { l: dict.home.statsUnits, v: formatNumber(openLots._sum.quantity ?? 0, locale), u: dict.home.statsUnitsUnit },
                  { l: dict.home.statsBuyers, v: approvedBuyers, u: dict.home.statsBuyersUnit },
                  { l: dict.home.statsRegions, v: buyerRegions.length, u: dict.home.statsRegionsUnit },
                ].map((s) => (
                  <div key={s.l}>
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-brand-300">
                      {s.l}
                    </dt>
                    <dd className="mt-1 flex items-baseline gap-1">
                      <span className="tnum text-2xl font-bold">{s.v}</span>
                      <span className="text-xs text-brand-200/80">{s.u}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* sealed-bid showcase card */}
            {featured && (
              <div className="relative">
                <div className="rounded-2xl border border-white/12 bg-white/[0.07] p-5 shadow-2xl backdrop-blur-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs text-brand-300">
                        {featured.lotNumber}
                      </p>
                      <p className="mt-1 text-sm font-semibold leading-snug">
                        {locale === "ja" ? featured.title : featured.titleEn}
                      </p>
                    </div>
                    <span className="badge shrink-0 bg-emerald-400/15 text-emerald-300">
                      {dict.lotStatus.OPEN}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-lg bg-black/20 px-3 py-2">
                      <p className="text-brand-300">{dict.lot.remaining}</p>
                      <Countdown
                        endAt={featured.endAt.toISOString()}
                        initial={initialCountdown}
                        urgency={false}
                        className="mt-0.5 block text-base text-white"
                      />
                    </div>
                    <div className="rounded-lg bg-black/20 px-3 py-2">
                      <p className="text-brand-300">{dict.lot.bidCount}</p>
                      <p className="tnum mt-0.5 text-base font-semibold">
                        {featured._count.bids}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-brand-300">
                    Sealed bids in storage
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {featured.bids.slice(0, 3).map((b, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-2 rounded-lg bg-black/25 px-3 py-2"
                      >
                        <IconLock small />
                        <span className="font-mono text-[11px] tracking-wider text-brand-200">
                          {cipherFingerprint(b.ciphertext)}
                        </span>
                        <span className="ml-auto animate-seal font-mono text-[11px] text-brand-300">
                          ENCRYPTED
                        </span>
                      </li>
                    ))}
                    {featured.bids.length === 0 && (
                      <li className="rounded-lg bg-black/25 px-3 py-2 text-[11px] text-brand-200">
                        no bids yet
                      </li>
                    )}
                  </ul>

                  <p className="mt-4 border-t border-white/10 pt-3 text-[11px] leading-relaxed text-brand-200/80">
                    {locale === "ja"
                      ? "金額はロット専用の鍵で暗号化されています。締切まで復号できません。"
                      : locale === "zh"
                        ? "金额以标的专属密钥加密，截止前无法解密。"
                        : "Amounts are encrypted under a key unique to this lot and cannot be decrypted before the deadline."}
                  </p>
                </div>

                <p className="mt-3 text-center text-[11px] text-brand-300">
                  {featured.country.nameEn} ·{" "}
                  {formatDateTime(featured.endAt, featured.country.timezone, locale)}{" "}
                  {zoneLabel(featured.endAt, featured.country.timezone)}
                </p>
              </div>
            )}
          </Container>
        </section>

        {/* ---- features ---- */}
        <section className="py-16 sm:py-20">
          <Container wide>
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
                Platform
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                {dict.home.featureTitle}
              </h2>
            </div>

            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <li key={f.key} className="card p-6">
                  <span className="inline-flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    {f.icon}
                  </span>
                  <h3 className="mt-4 text-[15px] font-bold text-ink">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">{f.body}</p>
                </li>
              ))}
            </ul>
          </Container>
        </section>

        {/* ---- demo accounts ---- */}
        <section className="pb-20">
          <Container wide>
            <div className="card overflow-hidden">
              <div className="border-b border-line bg-surface-2 px-6 py-5">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-lg font-bold text-ink">{dict.home.demoTitle}</h2>
                  <Badge tone="warn" dot>
                    {dict.footer.demoNotice}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted">{dict.home.demoLead}</p>
              </div>

              <div className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                {[
                  { role: dict.home.demoAdmin, email: "admin@sktes-demo.com", tone: "brand" as const },
                  { role: dict.home.demoSeller, email: "seller@sktes-demo.com", tone: "info" as const },
                  { role: dict.home.demoBidder, email: "buyer@sktes-demo.com", tone: "success" as const },
                ].map((a) => (
                  <div key={a.email} className="p-6">
                    <Badge tone={a.tone}>{a.role}</Badge>
                    <p className="mt-3 select-all font-mono text-sm font-semibold text-ink">
                      {a.email}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {dict.home.demoPassword}:{" "}
                      <span className="select-all font-mono font-semibold text-ink-2">
                        Demo!2026
                      </span>
                    </p>
                  </div>
                ))}
              </div>

              <div className="border-t border-line bg-warn-bg px-6 py-4">
                <p className="text-sm font-semibold text-warn">
                  {dict.home.noticeTitle}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-warn">
                  {dict.home.noticeBody}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
      </main>

      <SiteFooter />
    </>
  );
}

/* --- icons (inline so the page ships no icon library) --- */

function IconLock({ small = false }: { small?: boolean }) {
  return (
    <svg
      width={small ? 13 : 20}
      height={small ? 13 : 20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      className={small ? "text-brand-300" : undefined}
    >
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
function IconSearch() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" />
    </svg>
  );
}
function IconGlobe() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6l7-3Z" />
      <path d="m9 12 2 2 4-4" strokeLinecap="round" />
    </svg>
  );
}
function IconKey() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="8" cy="12" r="4" />
      <path d="M12 12h9M18 12v3M15.5 12v2" />
    </svg>
  );
}
function IconLang() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 6h10M9 4v2c0 4-2 7-5 9M6 11c1.5 2.5 3.5 4 6 5" />
      <path d="m13 21 4-10 4 10M14.6 18h4.8" />
    </svg>
  );
}
