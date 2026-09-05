export const CATEGORY_ART: Record<string, string> = {
  PC: "/images/cat-pc-tall.png",
  SERVER: "/images/cat-server-tall.png",
  MOBILE: "/images/cat-mobile-tall.png",
  TABLET: "/images/cat-tablet-tall.png",
  PARTS: "/images/cat-parts-tall.png",
};

export function categoryArt(code: string): string {
  return CATEGORY_ART[code] ?? CATEGORY_ART.PC;
}

export const SELLER_SITES = [
  { code: "JP", ja: "日本", en: "Japan", zh: "日本" },
  { code: "SG", ja: "シンガポール", en: "Singapore", zh: "新加坡" },
  { code: "AU", ja: "オーストラリア", en: "Australia", zh: "澳大利亚" },
  { code: "NZ", ja: "ニュージーランド", en: "New Zealand", zh: "新西兰" },
  { code: "KR", ja: "韓国", en: "Korea", zh: "韩国" },
  { code: "ID", ja: "インドネシア", en: "Indonesia", zh: "印度尼西亚" },
  { code: "MY", ja: "マレーシア", en: "Malaysia", zh: "马来西亚" },
  { code: "TH", ja: "タイ", en: "Thailand", zh: "泰国" },
  { code: "VN", ja: "ベトナム", en: "Vietnam", zh: "越南" },
  { code: "KH", ja: "カンボジア", en: "Cambodia", zh: "柬埔寨" },
  { code: "PH", ja: "フィリピン", en: "Philippines", zh: "菲律宾" },
  { code: "TW", ja: "台湾", en: "Taiwan", zh: "台湾" },
  { code: "CN", ja: "中国", en: "China", zh: "中国" },
  { code: "HK", ja: "香港", en: "Hong Kong", zh: "香港" },
  { code: "US", ja: "米国", en: "United States", zh: "美国" },
  { code: "GB", ja: "イギリス", en: "United Kingdom", zh: "英国" },
  { code: "FR", ja: "フランス", en: "France", zh: "法国" },
  { code: "DE", ja: "ドイツ", en: "Germany", zh: "德国" },
  { code: "IT", ja: "イタリア", en: "Italy", zh: "意大利" },
  { code: "ES", ja: "スペイン", en: "Spain", zh: "西班牙" },
  { code: "DK", ja: "デンマーク", en: "Denmark", zh: "丹麦" },
  { code: "IE", ja: "アイルランド", en: "Ireland", zh: "爱尔兰" },
] as const;
