export type CountrySeed = {
  code: string;
  nameJa: string;
  nameEn: string;
  nameZh: string;
  region: string;
  timezone: string;
  currency: string;
  isSellerSite: boolean;
  privacyRegime: string;
  city: string;
};

/**
 * The brief lists the SK TES selling sites as "21 countries" in the heading
 * but names 22 of them in the body (and "20 countries" in the overview).
 * We seed all 22 that are actually named, and flag the discrepancy in the
 * demo notes rather than silently picking one.
 */
export const COUNTRIES: CountrySeed[] = [
  // --- SK TES selling sites (22 named in the brief) ---
  { code: "JP", nameJa: "日本", nameEn: "Japan", nameZh: "日本", region: "ASIA", timezone: "Asia/Tokyo", currency: "JPY", isSellerSite: true, privacyRegime: "APPI", city: "Chiba" },
  { code: "SG", nameJa: "シンガポール", nameEn: "Singapore", nameZh: "新加坡", region: "ASIA", timezone: "Asia/Singapore", currency: "SGD", isSellerSite: true, privacyRegime: "NONE", city: "Tuas" },
  { code: "AU", nameJa: "オーストラリア", nameEn: "Australia", nameZh: "澳大利亚", region: "OCEANIA", timezone: "Australia/Sydney", currency: "AUD", isSellerSite: true, privacyRegime: "NONE", city: "Sydney" },
  { code: "NZ", nameJa: "ニュージーランド", nameEn: "New Zealand", nameZh: "新西兰", region: "OCEANIA", timezone: "Pacific/Auckland", currency: "NZD", isSellerSite: true, privacyRegime: "NONE", city: "Auckland" },
  { code: "KR", nameJa: "韓国", nameEn: "South Korea", nameZh: "韩国", region: "ASIA", timezone: "Asia/Seoul", currency: "KRW", isSellerSite: true, privacyRegime: "PIPA", city: "Incheon" },
  { code: "ID", nameJa: "インドネシア", nameEn: "Indonesia", nameZh: "印度尼西亚", region: "ASIA", timezone: "Asia/Jakarta", currency: "IDR", isSellerSite: true, privacyRegime: "NONE", city: "Jakarta" },
  { code: "MY", nameJa: "マレーシア", nameEn: "Malaysia", nameZh: "马来西亚", region: "ASIA", timezone: "Asia/Kuala_Lumpur", currency: "MYR", isSellerSite: true, privacyRegime: "NONE", city: "Selangor" },
  { code: "TH", nameJa: "タイ", nameEn: "Thailand", nameZh: "泰国", region: "ASIA", timezone: "Asia/Bangkok", currency: "THB", isSellerSite: true, privacyRegime: "NONE", city: "Chonburi" },
  { code: "VN", nameJa: "ベトナム", nameEn: "Vietnam", nameZh: "越南", region: "ASIA", timezone: "Asia/Ho_Chi_Minh", currency: "VND", isSellerSite: true, privacyRegime: "NONE", city: "Ho Chi Minh City" },
  { code: "KH", nameJa: "カンボジア", nameEn: "Cambodia", nameZh: "柬埔寨", region: "ASIA", timezone: "Asia/Phnom_Penh", currency: "USD", isSellerSite: true, privacyRegime: "NONE", city: "Phnom Penh" },
  { code: "PH", nameJa: "フィリピン", nameEn: "Philippines", nameZh: "菲律宾", region: "ASIA", timezone: "Asia/Manila", currency: "PHP", isSellerSite: true, privacyRegime: "NONE", city: "Laguna" },
  { code: "TW", nameJa: "台湾", nameEn: "Taiwan", nameZh: "台湾", region: "ASIA", timezone: "Asia/Taipei", currency: "TWD", isSellerSite: true, privacyRegime: "NONE", city: "Taoyuan" },
  { code: "CN", nameJa: "中国", nameEn: "China", nameZh: "中国", region: "ASIA", timezone: "Asia/Shanghai", currency: "CNY", isSellerSite: true, privacyRegime: "PIPL", city: "Suzhou" },
  { code: "HK", nameJa: "香港", nameEn: "Hong Kong", nameZh: "香港", region: "ASIA", timezone: "Asia/Hong_Kong", currency: "HKD", isSellerSite: true, privacyRegime: "NONE", city: "Kwai Chung" },
  { code: "US", nameJa: "米国", nameEn: "United States", nameZh: "美国", region: "NORTH_AMERICA", timezone: "America/Chicago", currency: "USD", isSellerSite: true, privacyRegime: "NONE", city: "Fredericksburg" },
  { code: "GB", nameJa: "イギリス", nameEn: "United Kingdom", nameZh: "英国", region: "EUROPE", timezone: "Europe/London", currency: "GBP", isSellerSite: true, privacyRegime: "UK_GDPR", city: "Wednesbury" },
  { code: "FR", nameJa: "フランス", nameEn: "France", nameZh: "法国", region: "EUROPE", timezone: "Europe/Paris", currency: "EUR", isSellerSite: true, privacyRegime: "GDPR", city: "Lyon" },
  { code: "DE", nameJa: "ドイツ", nameEn: "Germany", nameZh: "德国", region: "EUROPE", timezone: "Europe/Berlin", currency: "EUR", isSellerSite: true, privacyRegime: "GDPR", city: "Frankfurt" },
  { code: "IT", nameJa: "イタリア", nameEn: "Italy", nameZh: "意大利", region: "EUROPE", timezone: "Europe/Rome", currency: "EUR", isSellerSite: true, privacyRegime: "GDPR", city: "Milan" },
  { code: "ES", nameJa: "スペイン", nameEn: "Spain", nameZh: "西班牙", region: "EUROPE", timezone: "Europe/Madrid", currency: "EUR", isSellerSite: true, privacyRegime: "GDPR", city: "Barcelona" },
  { code: "DK", nameJa: "デンマーク", nameEn: "Denmark", nameZh: "丹麦", region: "EUROPE", timezone: "Europe/Copenhagen", currency: "DKK", isSellerSite: true, privacyRegime: "GDPR", city: "Aarhus" },
  { code: "IE", nameJa: "アイルランド", nameEn: "Ireland", nameZh: "爱尔兰", region: "EUROPE", timezone: "Europe/Dublin", currency: "EUR", isSellerSite: true, privacyRegime: "GDPR", city: "Dublin" },

  // --- buyer-only countries ---
  { code: "AE", nameJa: "アラブ首長国連邦", nameEn: "United Arab Emirates", nameZh: "阿联酋", region: "MIDDLE_EAST", timezone: "Asia/Dubai", currency: "AED", isSellerSite: false, privacyRegime: "NONE", city: "Dubai" },
  { code: "SA", nameJa: "サウジアラビア", nameEn: "Saudi Arabia", nameZh: "沙特阿拉伯", region: "MIDDLE_EAST", timezone: "Asia/Riyadh", currency: "SAR", isSellerSite: false, privacyRegime: "NONE", city: "Riyadh" },
  { code: "TR", nameJa: "トルコ", nameEn: "Turkey", nameZh: "土耳其", region: "MIDDLE_EAST", timezone: "Europe/Istanbul", currency: "TRY", isSellerSite: false, privacyRegime: "NONE", city: "Istanbul" },
  { code: "IN", nameJa: "インド", nameEn: "India", nameZh: "印度", region: "ASIA", timezone: "Asia/Kolkata", currency: "INR", isSellerSite: false, privacyRegime: "DPDP", city: "Mumbai" },
  { code: "PK", nameJa: "パキスタン", nameEn: "Pakistan", nameZh: "巴基斯坦", region: "ASIA", timezone: "Asia/Karachi", currency: "PKR", isSellerSite: false, privacyRegime: "NONE", city: "Karachi" },
  { code: "BD", nameJa: "バングラデシュ", nameEn: "Bangladesh", nameZh: "孟加拉国", region: "ASIA", timezone: "Asia/Dhaka", currency: "BDT", isSellerSite: false, privacyRegime: "NONE", city: "Dhaka" },
  { code: "CA", nameJa: "カナダ", nameEn: "Canada", nameZh: "加拿大", region: "NORTH_AMERICA", timezone: "America/Toronto", currency: "CAD", isSellerSite: false, privacyRegime: "PIPEDA", city: "Toronto" },
  { code: "MX", nameJa: "メキシコ", nameEn: "Mexico", nameZh: "墨西哥", region: "NORTH_AMERICA", timezone: "America/Mexico_City", currency: "MXN", isSellerSite: false, privacyRegime: "NONE", city: "Guadalajara" },
  { code: "BR", nameJa: "ブラジル", nameEn: "Brazil", nameZh: "巴西", region: "SOUTH_AMERICA", timezone: "America/Sao_Paulo", currency: "BRL", isSellerSite: false, privacyRegime: "LGPD", city: "Sao Paulo" },
  { code: "CL", nameJa: "チリ", nameEn: "Chile", nameZh: "智利", region: "SOUTH_AMERICA", timezone: "America/Santiago", currency: "CLP", isSellerSite: false, privacyRegime: "NONE", city: "Santiago" },
  { code: "PE", nameJa: "ペルー", nameEn: "Peru", nameZh: "秘鲁", region: "SOUTH_AMERICA", timezone: "America/Lima", currency: "PEN", isSellerSite: false, privacyRegime: "NONE", city: "Lima" },
  { code: "NL", nameJa: "オランダ", nameEn: "Netherlands", nameZh: "荷兰", region: "EUROPE", timezone: "Europe/Amsterdam", currency: "EUR", isSellerSite: false, privacyRegime: "GDPR", city: "Rotterdam" },
  { code: "PL", nameJa: "ポーランド", nameEn: "Poland", nameZh: "波兰", region: "EUROPE", timezone: "Europe/Warsaw", currency: "PLN", isSellerSite: false, privacyRegime: "GDPR", city: "Warsaw" },
  { code: "EG", nameJa: "エジプト", nameEn: "Egypt", nameZh: "埃及", region: "AFRICA", timezone: "Africa/Cairo", currency: "EGP", isSellerSite: false, privacyRegime: "NONE", city: "Cairo" },
  { code: "NG", nameJa: "ナイジェリア", nameEn: "Nigeria", nameZh: "尼日利亚", region: "AFRICA", timezone: "Africa/Lagos", currency: "NGN", isSellerSite: false, privacyRegime: "NDPR", city: "Lagos" },
  { code: "ZA", nameJa: "南アフリカ", nameEn: "South Africa", nameZh: "南非", region: "AFRICA", timezone: "Africa/Johannesburg", currency: "ZAR", isSellerSite: false, privacyRegime: "POPIA", city: "Johannesburg" },
  { code: "KE", nameJa: "ケニア", nameEn: "Kenya", nameZh: "肯尼亚", region: "AFRICA", timezone: "Africa/Nairobi", currency: "KES", isSellerSite: false, privacyRegime: "NONE", city: "Nairobi" },
  { code: "GH", nameJa: "ガーナ", nameEn: "Ghana", nameZh: "加纳", region: "AFRICA", timezone: "Africa/Accra", currency: "GHS", isSellerSite: false, privacyRegime: "NONE", city: "Accra" },
];

export const SELLER_COUNTRIES = COUNTRIES.filter((c) => c.isSellerSite);
export const BUYER_COUNTRIES = COUNTRIES;
