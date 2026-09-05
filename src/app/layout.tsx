import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getDictionary, getLocale } from "@/i18n";
import { AmbientFX } from "@/components/visual/AmbientFX";

export const metadata: Metadata = {
  title: {
    default: "SK TES Global Auction | グローバルIT機器 封印入札プラットフォーム",
    template: "%s | SK TES Global Auction",
  },
  description:
    "SK TESグループが世界21カ国の拠点から出品するパソコン・サーバー・モバイル端末・パーツを、審査済みのグローバルバイヤーが入札・購入できる法人向け競売プラットフォームです。",
  keywords: [
    "ITAD",
    "IT asset disposition",
    "auction",
    "sealed bid",
    "used server",
    "refurbished PC",
    "封印入札",
    "オークション",
    "中古IT機器",
  ],
  openGraph: {
    type: "website",
    siteName: "SK TES Global Auction",
    title: "SK TES Global Auction",
    description:
      "世界21拠点のIT資産を、公正な封印入札で。審査済みのグローバルバイヤー向け法人競売プラットフォーム。",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1a48ad" },
    { media: "(prefers-color-scheme: dark)", color: "#080e1a" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const dict = await getDictionary();

  return (
    <html lang={locale === "ja" ? "ja" : locale === "zh" ? "zh-CN" : "en"} data-theme="light">
      <body className="min-h-dvh antialiased">
        {/*
          Some CDNs rewrite anything that looks like an email address in the
          HTML on its way to the browser. The markup React then finds no longer
          matches what the server sent, so it discards the server rendering and
          starts over on the client. These two comments are the documented way
          to switch that rewriting off for the page.
        */}
        <span hidden dangerouslySetInnerHTML={{ __html: "<!--email_off-->" }} />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-on-brand"
        >
          {dict.common.skipToContent}
        </a>
        <AmbientFX />
        {children}
        <span hidden dangerouslySetInnerHTML={{ __html: "<!--email_on-->" }} />
      </body>
    </html>
  );
}
