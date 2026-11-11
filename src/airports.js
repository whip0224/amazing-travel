// src/airports.js
export const AIRPORTS_BY_COUNTRY = [
  {
    country: "日本 (Japan)",
    countryCode: "JP",
    flag: "🇯🇵",
    airports: [
      { code: "HND", name: "東京羽田機場 (HND)", enName: "Tokyo Haneda", terminal: "T3" },
      { code: "NRT", name: "東京成田機場 (NRT)", enName: "Tokyo Narita", terminal: "T1/T2" },
      { code: "KIX", name: "大阪關西機場 (KIX)", enName: "Osaka Kansai", terminal: "T1" },
      { code: "ITM", name: "大阪伊丹機場 (ITM)", enName: "Osaka Itami", terminal: "Main" },
      { code: "FUK", name: "福岡機場 (FUK)", enName: "Fukuoka Int'l", terminal: "Int'l" },
      { code: "CTS", name: "札幌新千歲機場 (CTS)", enName: "Sapporo Chitose", terminal: "Int'l" },
      { code: "NGO", name: "名古屋中部機場 (NGO)", enName: "Nagoya Centrair", terminal: "T1" },
      { code: "OKA", name: "沖繩那霸機場 (OKA)", enName: "Okinawa Naha", terminal: "Int'l" }
    ]
  },
  {
    country: "台灣 (Taiwan)",
    countryCode: "TW",
    flag: "🇹🇼",
    airports: [
      { code: "TPE", name: "台北桃園機場 (TPE) T1", enName: "Taipei Taoyuan T1", terminal: "T1" },
      { code: "TPE2", displayCode: "TPE", name: "台北桃園機場 (TPE) T2", enName: "Taipei Taoyuan T2", terminal: "T2" },
      { code: "TSA", name: "台北松山機場 (TSA)", enName: "Taipei Songshan", terminal: "T1" },
      { code: "KHH", name: "高雄小港機場 (KHH)", enName: "Kaohsiung Int'l", terminal: "Int'l" },
      { code: "RMQ", name: "台中國際機場 (RMQ)", enName: "Taichung Int'l", terminal: "Int'l" }
    ]
  },
  {
    country: "香港 / 澳門 (HK & MO)",
    countryCode: "HK",
    flag: "🇭🇰",
    airports: [
      { code: "HKG", name: "香港國際機場 (HKG) T1", enName: "Hong Kong Int'l T1", terminal: "T1" },
      { code: "MFM", name: "澳門國際機場 (MFM)", enName: "Macau Int'l", terminal: "Main" }
    ]
  },
  {
    country: "韓國 (Korea)",
    countryCode: "KR",
    flag: "🇰🇷",
    airports: [
      { code: "ICN", name: "首爾仁川機場 (ICN)", enName: "Seoul Incheon", terminal: "T1/T2" },
      { code: "GMP", name: "首爾金浦機場 (GMP)", enName: "Seoul Gimpo", terminal: "Int'l" },
      { code: "PUS", name: "釜山金海機場 (PUS)", enName: "Busan Gimhae", terminal: "Int'l" },
      { code: "CJU", name: "濟州國際機場 (CJU)", enName: "Jeju Int'l", terminal: "Int'l" }
    ]
  },
  {
    country: "泰國 / 東南亞 (SEA)",
    countryCode: "TH",
    flag: "🇹🇭",
    airports: [
      { code: "BKK", name: "曼谷蘇凡納布 (BKK)", enName: "Bangkok Suvarnabhumi", terminal: "Main" },
      { code: "DMK", name: "曼谷廊曼 (DMK)", enName: "Bangkok Don Mueang", terminal: "T1" },
      { code: "CNX", name: "清邁國際機場 (CNX)", enName: "Chiang Mai Int'l", terminal: "Int'l" },
      { code: "SIN", name: "新加坡樟宜機場 (SIN)", enName: "Singapore Changi", terminal: "T3" },
      { code: "KUL", name: "吉隆坡國際機場 (KUL)", enName: "Kuala Lumpur KLIA", terminal: "T1" }
    ]
  },
  {
    country: "歐美 / 澳洲 (Global)",
    countryCode: "US",
    flag: "🌍",
    airports: [
      { code: "LAX", name: "洛杉磯國際機場 (LAX)", enName: "Los Angeles Int'l", terminal: "TBIT" },
      { code: "SFO", name: "舊金山國際機場 (SFO)", enName: "San Francisco Int'l", terminal: "Int'l" },
      { code: "LHR", name: "倫敦希斯洛機場 (LHR)", enName: "London Heathrow", terminal: "T2" },
      { code: "CDG", name: "巴黎戴高樂機場 (CDG)", enName: "Paris Charles de Gaulle", terminal: "T2E" },
      { code: "SYD", name: "雪梨國際機場 (SYD)", enName: "Sydney Kingsford Smith", terminal: "T1" }
    ]
  }
];

export const CURRENCIES = [
  { code: "JPY", symbol: "¥", flag: "🇯🇵", name: "日圓 (Japanese Yen)", rateFromUSD: 155.40 },
  { code: "USD", symbol: "$", flag: "🇺🇸", name: "美金 (US Dollar)", rateFromUSD: 1.00 },
  { code: "TWD", symbol: "NT$", flag: "🇹🇼", name: "新台幣 (New Taiwan Dollar)", rateFromUSD: 32.15 },
  { code: "HKD", symbol: "HK$", flag: "🇭🇰", name: "港幣 (Hong Kong Dollar)", rateFromUSD: 7.78 },
  { code: "KRW", symbol: "₩", flag: "🇰🇷", name: "韓元 (South Korean Won)", rateFromUSD: 1385.00 },
  { code: "THB", symbol: "฿", flag: "🇹🇭", name: "泰銖 (Thai Baht)", rateFromUSD: 34.80 },
  { code: "SGD", symbol: "S$", flag: "🇸🇬", name: "新幣 (Singapore Dollar)", rateFromUSD: 1.34 },
  { code: "EUR", symbol: "€", flag: "🇪🇺", name: "歐元 (Euro)", rateFromUSD: 0.93 },
  { code: "GBP", symbol: "£", flag: "🇬🇧", name: "英鎊 (British Pound)", rateFromUSD: 0.79 },
  { code: "AUD", symbol: "A$", flag: "🇦🇺", name: "澳幣 (Australian Dollar)", rateFromUSD: 1.52 },
  { code: "CNY", symbol: "¥", flag: "🇨🇳", name: "人民幣 (Chinese Yuan)", rateFromUSD: 7.24 }
];

// Backwards-compatible default export for existing code
export default AIRPORTS_BY_COUNTRY.map(group => ({
  country: group.country,
  airports: group.airports.map(a => a.name)
}));