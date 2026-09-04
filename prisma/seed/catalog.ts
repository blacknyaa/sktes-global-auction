/**
 * Hardware catalogue used to generate realistic lot manifests.
 * Every generated LotItem row comes from here, which is why spec search in
 * the demo returns sensible results instead of noise.
 */

export type ModelSpec = {
  maker: string;
  model: string;
  cpu?: string;
  ramGb?: number;
  storage?: string;
  gpu?: string;
  screen?: string;
  unitLowUsd: number;
  unitHighUsd: number;
};

export const PC_MODELS: ModelSpec[] = [
  { maker: "Dell", model: "Latitude 5420", cpu: "Core i5-1135G7", ramGb: 16, storage: "SSD 256GB NVMe", screen: "14 inch", unitLowUsd: 118, unitHighUsd: 186 },
  { maker: "Dell", model: "Latitude 7420", cpu: "Core i7-1185G7", ramGb: 16, storage: "SSD 512GB NVMe", screen: "14 inch", unitLowUsd: 168, unitHighUsd: 252 },
  { maker: "Dell", model: "Latitude 5520", cpu: "Core i5-1145G7", ramGb: 8, storage: "SSD 256GB NVMe", screen: "15.6 inch", unitLowUsd: 104, unitHighUsd: 162 },
  { maker: "Dell", model: "OptiPlex 7080 SFF", cpu: "Core i7-10700", ramGb: 16, storage: "SSD 512GB", unitLowUsd: 132, unitHighUsd: 205 },
  { maker: "Dell", model: "Precision 3560", cpu: "Core i7-1165G7", ramGb: 32, storage: "SSD 512GB NVMe", gpu: "NVIDIA T500", screen: "15.6 inch", unitLowUsd: 214, unitHighUsd: 318 },
  { maker: "HP", model: "EliteBook 840 G7", cpu: "Core i5-10310U", ramGb: 16, storage: "SSD 256GB NVMe", screen: "14 inch", unitLowUsd: 112, unitHighUsd: 178 },
  { maker: "HP", model: "EliteBook 840 G8", cpu: "Core i7-1165G7", ramGb: 16, storage: "SSD 512GB NVMe", screen: "14 inch", unitLowUsd: 158, unitHighUsd: 242 },
  { maker: "HP", model: "ProBook 450 G8", cpu: "Core i5-1135G7", ramGb: 8, storage: "SSD 256GB NVMe", screen: "15.6 inch", unitLowUsd: 96, unitHighUsd: 148 },
  { maker: "HP", model: "EliteDesk 800 G6 Mini", cpu: "Core i5-10500T", ramGb: 16, storage: "SSD 256GB", unitLowUsd: 118, unitHighUsd: 182 },
  { maker: "Lenovo", model: "ThinkPad T14 Gen 2", cpu: "Ryzen 5 PRO 5650U", ramGb: 16, storage: "SSD 512GB NVMe", screen: "14 inch", unitLowUsd: 138, unitHighUsd: 214 },
  { maker: "Lenovo", model: "ThinkPad X1 Carbon Gen 9", cpu: "Core i7-1165G7", ramGb: 16, storage: "SSD 1TB NVMe", screen: "14 inch", unitLowUsd: 224, unitHighUsd: 336 },
  { maker: "Lenovo", model: "ThinkCentre M720q", cpu: "Core i5-9500T", ramGb: 8, storage: "SSD 256GB", unitLowUsd: 88, unitHighUsd: 136 },
  { maker: "Apple", model: "MacBook Air M1 2020", cpu: "Apple M1", ramGb: 8, storage: "SSD 256GB", screen: "13.3 inch", unitLowUsd: 268, unitHighUsd: 392 },
  { maker: "Apple", model: "MacBook Pro 13 2020", cpu: "Core i5-1038NG7", ramGb: 16, storage: "SSD 512GB", screen: "13.3 inch", unitLowUsd: 296, unitHighUsd: 428 },
  { maker: "Fujitsu", model: "LIFEBOOK U939", cpu: "Core i5-8265U", ramGb: 8, storage: "SSD 256GB", screen: "13.3 inch", unitLowUsd: 82, unitHighUsd: 128 },
  { maker: "Panasonic", model: "Let's note CF-SV8", cpu: "Core i5-8365U", ramGb: 16, storage: "SSD 256GB", screen: "12.1 inch", unitLowUsd: 126, unitHighUsd: 196 },
  { maker: "NEC", model: "VersaPro VKT16", cpu: "Core i5-8250U", ramGb: 8, storage: "SSD 256GB", screen: "13.3 inch", unitLowUsd: 74, unitHighUsd: 118 },
  { maker: "Microsoft", model: "Surface Laptop 4", cpu: "Ryzen 5 4680U", ramGb: 8, storage: "SSD 256GB", screen: "13.5 inch", unitLowUsd: 154, unitHighUsd: 232 },
];

export const SERVER_MODELS: ModelSpec[] = [
  { maker: "Dell", model: "PowerEdge R640", cpu: "Xeon Silver 4210 x2", ramGb: 128, storage: "SSD 480GB x2", unitLowUsd: 620, unitHighUsd: 980 },
  { maker: "Dell", model: "PowerEdge R740", cpu: "Xeon Gold 6248 x2", ramGb: 256, storage: "SAS 1.2TB x8", unitLowUsd: 1180, unitHighUsd: 1760 },
  { maker: "Dell", model: "PowerEdge R440", cpu: "Xeon Silver 4114", ramGb: 64, storage: "SSD 480GB x2", unitLowUsd: 430, unitHighUsd: 690 },
  { maker: "HPE", model: "ProLiant DL360 Gen10", cpu: "Xeon Gold 6230 x2", ramGb: 192, storage: "SSD 960GB x4", unitLowUsd: 940, unitHighUsd: 1480 },
  { maker: "HPE", model: "ProLiant DL380 Gen10", cpu: "Xeon Silver 4214 x2", ramGb: 128, storage: "SAS 900GB x6", unitLowUsd: 860, unitHighUsd: 1340 },
  { maker: "Lenovo", model: "ThinkSystem SR650", cpu: "Xeon Gold 5218 x2", ramGb: 192, storage: "SSD 960GB x4", unitLowUsd: 880, unitHighUsd: 1390 },
  { maker: "Supermicro", model: "SYS-1029U-TRT", cpu: "Xeon Silver 4208 x2", ramGb: 96, storage: "SSD 480GB x2", unitLowUsd: 520, unitHighUsd: 830 },
  { maker: "Cisco", model: "UCS C220 M5", cpu: "Xeon Gold 6142 x2", ramGb: 256, storage: "SSD 800GB x4", unitLowUsd: 780, unitHighUsd: 1220 },
];

export const MOBILE_MODELS: ModelSpec[] = [
  { maker: "Apple", model: "iPhone 11 64GB", storage: "64GB", unitLowUsd: 132, unitHighUsd: 198 },
  { maker: "Apple", model: "iPhone 12 128GB", storage: "128GB", unitLowUsd: 208, unitHighUsd: 296 },
  { maker: "Apple", model: "iPhone 13 128GB", storage: "128GB", unitLowUsd: 288, unitHighUsd: 402 },
  { maker: "Samsung", model: "Galaxy S21 5G 256GB", storage: "256GB", unitLowUsd: 168, unitHighUsd: 254 },
  { maker: "Samsung", model: "Galaxy S22 128GB", storage: "128GB", unitLowUsd: 224, unitHighUsd: 328 },
  { maker: "Google", model: "Pixel 6 128GB", storage: "128GB", unitLowUsd: 146, unitHighUsd: 218 },
  { maker: "Sony", model: "Xperia 10 III", storage: "128GB", unitLowUsd: 98, unitHighUsd: 152 },
  { maker: "Xiaomi", model: "Redmi Note 11 128GB", storage: "128GB", unitLowUsd: 62, unitHighUsd: 98 },
];

export const TABLET_MODELS: ModelSpec[] = [
  { maker: "Apple", model: "iPad 9th Gen 64GB", storage: "64GB", screen: "10.2 inch", unitLowUsd: 148, unitHighUsd: 218 },
  { maker: "Apple", model: "iPad Air 4 64GB", storage: "64GB", screen: "10.9 inch", unitLowUsd: 232, unitHighUsd: 336 },
  { maker: "Apple", model: "iPad Pro 11 2020 128GB", storage: "128GB", screen: "11 inch", unitLowUsd: 348, unitHighUsd: 496 },
  { maker: "Samsung", model: "Galaxy Tab S7 128GB", storage: "128GB", screen: "11 inch", unitLowUsd: 186, unitHighUsd: 272 },
  { maker: "Microsoft", model: "Surface Pro 7", cpu: "Core i5-1035G4", ramGb: 8, storage: "SSD 128GB", screen: "12.3 inch", unitLowUsd: 174, unitHighUsd: 258 },
  { maker: "Lenovo", model: "Tab P11 128GB", storage: "128GB", screen: "11 inch", unitLowUsd: 78, unitHighUsd: 122 },
];

export const PARTS_MODELS: ModelSpec[] = [
  { maker: "Samsung", model: "M393A4K40BB2-CTD 32GB DDR4-2666 RDIMM", ramGb: 32, unitLowUsd: 28, unitHighUsd: 46 },
  { maker: "Samsung", model: "M393A2K43BB1-CTD 16GB DDR4-2666 RDIMM", ramGb: 16, unitLowUsd: 15, unitHighUsd: 26 },
  { maker: "Micron", model: "MTA18ASF2G72PDZ 16GB DDR4-2933", ramGb: 16, unitLowUsd: 16, unitHighUsd: 27 },
  { maker: "Hynix", model: "HMA84GR7CJR4N 32GB DDR4-2933 RDIMM", ramGb: 32, unitLowUsd: 29, unitHighUsd: 48 },
  { maker: "Kingston", model: "KVR26N19D8/16 16GB DDR4-2666 UDIMM", ramGb: 16, unitLowUsd: 13, unitHighUsd: 22 },
  { maker: "Intel", model: "Xeon Gold 6230 20C 2.1GHz", cpu: "Xeon Gold 6230", unitLowUsd: 96, unitHighUsd: 158 },
  { maker: "Intel", model: "Xeon Silver 4210 10C 2.2GHz", cpu: "Xeon Silver 4210", unitLowUsd: 42, unitHighUsd: 74 },
  { maker: "Intel", model: "Core i7-9700 8C 3.0GHz", cpu: "Core i7-9700", unitLowUsd: 58, unitHighUsd: 92 },
  { maker: "AMD", model: "Ryzen 7 3700X 8C 3.6GHz", cpu: "Ryzen 7 3700X", unitLowUsd: 62, unitHighUsd: 98 },
  { maker: "NVIDIA", model: "Tesla T4 16GB", gpu: "Tesla T4 16GB", unitLowUsd: 342, unitHighUsd: 512 },
  { maker: "NVIDIA", model: "RTX A4000 16GB", gpu: "RTX A4000 16GB", unitLowUsd: 468, unitHighUsd: 668 },
  { maker: "NVIDIA", model: "Quadro P2000 5GB", gpu: "Quadro P2000 5GB", unitLowUsd: 78, unitHighUsd: 124 },
  { maker: "NVIDIA", model: "GeForce GTX 1660 6GB", gpu: "GTX 1660 6GB", unitLowUsd: 68, unitHighUsd: 108 },
];

export const CATALOG: Record<string, ModelSpec[]> = {
  PC: PC_MODELS,
  SERVER: SERVER_MODELS,
  MOBILE: MOBILE_MODELS,
  TABLET: TABLET_MODELS,
  PARTS: PARTS_MODELS,
};

export const CATEGORIES = [
  { code: "PC", nameJa: "パソコン", nameEn: "PC", nameZh: "个人电脑", sortOrder: 1 },
  { code: "SERVER", nameJa: "サーバー", nameEn: "Server", nameZh: "服务器", sortOrder: 2 },
  { code: "MOBILE", nameJa: "携帯電話", nameEn: "Mobile phone", nameZh: "手机", sortOrder: 3 },
  { code: "TABLET", nameJa: "タブレット", nameEn: "Tablet", nameZh: "平板电脑", sortOrder: 4 },
  { code: "PARTS", nameJa: "パーツ", nameEn: "Components", nameZh: "配件", sortOrder: 5 },
];

/** Fictional buyer companies. None of these are real businesses. */
export const BUYER_COMPANIES: { name: string; nameEn: string; country: string }[] = [
  { name: "Meridian IT Trading Pte Ltd", nameEn: "Meridian IT Trading Pte Ltd", country: "SG" },
  { name: "Al Nahda Electronics FZE", nameEn: "Al Nahda Electronics FZE", country: "AE" },
  { name: "Vertex Asset Recovery LLC", nameEn: "Vertex Asset Recovery LLC", country: "US" },
  { name: "Northline Refurb Ltd", nameEn: "Northline Refurb Ltd", country: "GB" },
  { name: "Baltic Circular Tech Sp. z o.o.", nameEn: "Baltic Circular Tech", country: "PL" },
  { name: "Sahara Digital Traders", nameEn: "Sahara Digital Traders", country: "EG" },
  { name: "Lagos Tech Imports Ltd", nameEn: "Lagos Tech Imports Ltd", country: "NG" },
  { name: "Cape Reboot Pty Ltd", nameEn: "Cape Reboot Pty Ltd", country: "ZA" },
  { name: "Andes Computacion SAC", nameEn: "Andes Computacion SAC", country: "PE" },
  { name: "Sao Paulo Recicla Tec Ltda", nameEn: "Sao Paulo Recicla Tec Ltda", country: "BR" },
  { name: "Cordillera Hardware SpA", nameEn: "Cordillera Hardware SpA", country: "CL" },
  { name: "Guadalajara Componentes SA", nameEn: "Guadalajara Componentes SA", country: "MX" },
  { name: "Maple Ridge Technology Inc.", nameEn: "Maple Ridge Technology Inc.", country: "CA" },
  { name: "株式会社リユーステック東京", nameEn: "Reuse Tech Tokyo Inc.", country: "JP" },
  { name: "株式会社ジャパンPCリファービッシュ", nameEn: "Japan PC Refurbish Co., Ltd.", country: "JP" },
  { name: "有限会社モバイルリンク大阪", nameEn: "Mobile Link Osaka Ltd.", country: "JP" },
  { name: "Hanoi Green Electronics JSC", nameEn: "Hanoi Green Electronics JSC", country: "VN" },
  { name: "Bangkok Component Exchange Co.", nameEn: "Bangkok Component Exchange Co.", country: "TH" },
  { name: "Selangor ITAD Sdn Bhd", nameEn: "Selangor ITAD Sdn Bhd", country: "MY" },
  { name: "Jakarta Digital Nusantara PT", nameEn: "Jakarta Digital Nusantara PT", country: "ID" },
  { name: "Manila Circuit Trading Corp.", nameEn: "Manila Circuit Trading Corp.", country: "PH" },
  { name: "Taipei Precision Recycle Co.", nameEn: "Taipei Precision Recycle Co.", country: "TW" },
  { name: "Shenzhen Yuanhe Technology Co.", nameEn: "Shenzhen Yuanhe Technology Co.", country: "CN" },
  { name: "Hong Kong Everbright Devices Ltd", nameEn: "Hong Kong Everbright Devices Ltd", country: "HK" },
  { name: "Seoul Nextlife Electronics Inc.", nameEn: "Seoul Nextlife Electronics Inc.", country: "KR" },
  { name: "Mumbai Silicon Traders Pvt Ltd", nameEn: "Mumbai Silicon Traders Pvt Ltd", country: "IN" },
  { name: "Karachi Hardware House", nameEn: "Karachi Hardware House", country: "PK" },
  { name: "Dhaka Tech Source Ltd", nameEn: "Dhaka Tech Source Ltd", country: "BD" },
  { name: "Rotterdam Circular Devices BV", nameEn: "Rotterdam Circular Devices BV", country: "NL" },
  { name: "Istanbul Bilisim Ticaret AS", nameEn: "Istanbul Bilisim Ticaret AS", country: "TR" },
  { name: "Riyadh Advanced Systems Co.", nameEn: "Riyadh Advanced Systems Co.", country: "SA" },
  { name: "Nairobi Digital Supply Ltd", nameEn: "Nairobi Digital Supply Ltd", country: "KE" },
  { name: "Accra Tech Bridge Ltd", nameEn: "Accra Tech Bridge Ltd", country: "GH" },
  { name: "Sydney Asset Lifecycle Pty", nameEn: "Sydney Asset Lifecycle Pty", country: "AU" },
  { name: "Auckland Reboot Ltd", nameEn: "Auckland Reboot Ltd", country: "NZ" },
  { name: "Dublin Renew IT Ltd", nameEn: "Dublin Renew IT Ltd", country: "IE" },
  { name: "Copenhagen Genbrug Tech ApS", nameEn: "Copenhagen Genbrug Tech ApS", country: "DK" },
  { name: "Milano Ricondizionati Srl", nameEn: "Milano Ricondizionati Srl", country: "IT" },
  { name: "Barcelona Segunda Vida SL", nameEn: "Barcelona Segunda Vida SL", country: "ES" },
  { name: "Lyon Reconditionne SARL", nameEn: "Lyon Reconditionne SARL", country: "FR" },
  { name: "Frankfurt IT Wiederaufbereitung GmbH", nameEn: "Frankfurt IT Wiederaufbereitung GmbH", country: "DE" },
  { name: "Phnom Penh Device Trading Co.", nameEn: "Phnom Penh Device Trading Co.", country: "KH" },
  { name: "Gulf Stream Components DMCC", nameEn: "Gulf Stream Components DMCC", country: "AE" },
  { name: "Pacific Rim Hardware LLC", nameEn: "Pacific Rim Hardware LLC", country: "US" },
  { name: "Atlantic Server Exchange Ltd", nameEn: "Atlantic Server Exchange Ltd", country: "GB" },
  { name: "Delta Components Nigeria Ltd", nameEn: "Delta Components Nigeria Ltd", country: "NG" },
  { name: "Andalus Trading Egypt", nameEn: "Andalus Trading Egypt", country: "EG" },
  { name: "株式会社サーバーワークス九州", nameEn: "Server Works Kyushu Inc.", country: "JP" },
  { name: "Warsaw Data Centre Surplus Sp. z o.o.", nameEn: "Warsaw Data Centre Surplus", country: "PL" },
  { name: "Toronto Lifecycle Partners Inc.", nameEn: "Toronto Lifecycle Partners Inc.", country: "CA" },
  { name: "Bogota Andina Tech SAS", nameEn: "Bogota Andina Tech SAS", country: "PE" },
  { name: "Kuala Lumpur Chipworks Sdn Bhd", nameEn: "Kuala Lumpur Chipworks Sdn Bhd", country: "MY" },
  { name: "Taichung Memory Trading Co.", nameEn: "Taichung Memory Trading Co.", country: "TW" },
  { name: "Busan Component Line Inc.", nameEn: "Busan Component Line Inc.", country: "KR" },
  { name: "Chennai Enterprise Systems Pvt", nameEn: "Chennai Enterprise Systems Pvt", country: "IN" },
];

export const CONTACT_NAMES = [
  "Daniel Okafor", "Aiko Tanaka", "Rahul Menon", "Sofia Marchetti", "Liam O'Connell",
  "Wei Zhang", "Ahmed Hassan", "Marta Kowalska", "Kenji Yamamoto", "Priya Nair",
  "Lucas Silva", "Hannah Nielsen", "Omar Al Farsi", "Chen Yu Ting", "Min Jun Park",
  "Thomas Muller", "Isabelle Dubois", "Carlos Ramirez", "Nguyen Van Thanh", "Siti Rahayu",
  "James Whitfield", "Elena Popova", "Yuki Sato", "Arjun Sharma", "Grace Mwangi",
  "Pedro Alvarez", "Fatima Zahra", "Robert Lang", "Mei Lin Ho", "Sanjay Gupta",
];
