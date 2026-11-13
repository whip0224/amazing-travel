export interface HotelCandidate {
  id: string;
  name: string;
  branchNote?: string;
  address: string;
  lat?: number;
  lng?: number;
}

// 內建熱門亞洲/日本/台灣/韓國連鎖與公寓式飯店資料庫
// (包含使用者測試的 Weekly Green In Namba ウィークリーグリーンインなんば 及難波/心齋橋/梅田/京都/東京熱門住宿)
const BUILTIN_HOTEL_DIRECTORY: HotelCandidate[] = [
  // Weekly Green In Namba (ウィークリーグリーンインなんば)
  {
    id: 'weekly-green-namba',
    name: 'Weekly Green In Namba (ウィークリーグリーンインなんば)',
    branchNote: '大阪難波・大國町館',
    address: '〒556-0011 大阪府大阪市浪速区難波中3-12-9 (3-12-9 Nanbanaka, Naniwa Ward, Osaka)',
    lat: 34.6611,
    lng: 135.4986,
  },

  // 大阪難波・心齋橋・道頓堀・梅田熱門飯店
  {
    id: 'swissotel-nankai-osaka',
    name: 'Swissotel Nankai Osaka (大阪南海瑞士酒店)',
    branchNote: '南海難波站直結',
    address: '〒542-0076 大阪府大阪市中央区難波5-1-60',
    lat: 34.6644,
    lng: 135.5015,
  },
  {
    id: 'cross-hotel-osaka',
    name: 'Cross Hotel Osaka (大阪十字酒店)',
    branchNote: '大阪道頓堀・心齋橋筋',
    address: '〒542-0085 大阪府大阪市中央区心斎橋筋2-5-15',
    lat: 34.6694,
    lng: 135.5011,
  },
  {
    id: 'citadines-namba-osaka',
    name: 'Citadines Namba Osaka (大阪難波馨樂庭公寓酒店)',
    branchNote: '大阪難波日本橋館',
    address: '〒556-0005 大阪府大阪市浪速区日本橋3-5-25',
    lat: 34.6632,
    lng: 135.5056,
  },
  {
    id: 'sotetsu-fresa-namba',
    name: 'Sotetsu Fresa Inn Osaka Namba Ekimae (相鐵FRESA INN 大阪難波站前)',
    branchNote: '大阪難波站前館',
    address: '〒556-0011 大阪府大阪市浪速区難波中1-6-5',
    lat: 34.6657,
    lng: 135.4995,
  },
  {
    id: 'richmond-namba',
    name: 'Richmond Hotel Namba Daikokucho (難波大國町里士滿飯店)',
    branchNote: '大阪難波敷津東館',
    address: '〒556-0012 大阪府大阪市浪速区敷津東1-8-31',
    lat: 34.6584,
    lng: 135.5004,
  },
  {
    id: 'monterey-grasmere-osaka',
    name: 'Hotel Monterey Grasmere Osaka (大阪蒙特利格拉斯米爾酒店)',
    branchNote: 'JR難波站直結',
    address: '〒556-0017 大阪府大阪市浪速区湊町1-2-3',
    lat: 34.6669,
    lng: 135.4952,
  },
  {
    id: 'candeo-osaka-namba',
    name: 'Candeo Hotels Osaka Namba (大阪難波光芒飯店)',
    branchNote: '大阪日本橋・心齋橋館',
    address: '〒542-0083 大阪府大阪市中央区東心斎橋2-2-5',
    lat: 34.6705,
    lng: 135.5059,
  },
  {
    id: 'karaksa-osaka-namba',
    name: 'Karaksa Hotel Osaka Namba (唐草飯店大阪難波)',
    branchNote: '道頓堀・心齋橋館',
    address: '〒542-0086 大阪府大阪市中央区西心斎橋2-9-13',
    lat: 34.6702,
    lng: 135.4988,
  },
  {
    id: 'vessel-inn-shinsaibashi',
    name: 'Vessel Inn Shinsaibashi (心齋橋船舶酒店)',
    branchNote: '大阪心齋橋北館',
    address: '〒542-0081 大阪府大阪市中央区南船場2-12-11',
    lat: 34.6765,
    lng: 135.5035,
  },
  {
    id: 'hankyu-respire-osaka',
    name: 'Hotel Hankyu RESPIRE OSAKA (大阪阪急龍仕柏飯店)',
    branchNote: '大阪梅田 Yodobashi 直結',
    address: '〒530-0011 大阪府大阪市北区大深町1-1',
    lat: 34.7043,
    lng: 135.4961,
  },

  // The Gate Hotel 系列
  {
    id: 'gate-kyoto',
    name: 'The Gate Hotel Kyoto Takasegawa',
    branchNote: '京都高瀨川館 (河原町/木屋町)',
    address: '〒604-8005 京都市中京区蛸薬師通河原町東入備前島町310-2',
    lat: 35.0062,
    lng: 135.7707,
  },
  {
    id: 'gate-asakusa',
    name: 'The Gate Hotel Asakusa Kaminarimon',
    branchNote: '東京淺草雷門館',
    address: '〒111-0034 東京都台東区雷門2-16-11',
    lat: 35.7107,
    lng: 139.7962,
  },
  {
    id: 'gate-tokyo',
    name: 'The Gate Hotel Tokyo by HULIC',
    branchNote: '東京銀座/有樂町館',
    address: '〒100-0006 東京都千代田区有楽町2-2-3',
    lat: 35.6725,
    lng: 139.7614,
  },
  {
    id: 'gate-ryogoku',
    name: 'The Gate Hotel Ryogoku by HULIC',
    branchNote: '東京兩國隅田川館',
    address: '〒130-0015 東京都墨田区横網1-2-13',
    lat: 35.6968,
    lng: 139.7916,
  },

  // APA Hotel (阿帕酒店) 系列
  {
    id: 'apa-kyoto-ekimae',
    name: 'APA Hotel Kyoto Ekimae (アパホテル京都駅前)',
    branchNote: '京都站前館',
    address: '〒600-8234 京都市下京区南不動堂町806',
    lat: 34.9858,
    lng: 135.7552,
  },
  {
    id: 'apa-kyoto-gion',
    name: 'APA Hotel Kyoto Gion Excellent (アパホテル京都祇園)',
    branchNote: '京都祇園八坂神社前館',
    address: '〒605-0073 京都市東山区祇園町南側555',
    lat: 35.0036,
    lng: 135.7755,
  },
  {
    id: 'apa-kyoto-ekikita',
    name: 'APA Hotel Kyoto Ekikita (アパホテル京都駅北)',
    branchNote: '京都站北口館',
    address: '〒600-8216 京都市下京区東塩小路町597-2',
    lat: 34.9875,
    lng: 135.7589,
  },
  {
    id: 'apa-osaka-namba',
    name: 'APA Hotel & Resort Osaka Namba Ekimae Tower',
    branchNote: '大阪難波站前塔館',
    address: '〒556-0017 大阪市浪速区湊町1-2-13',
    lat: 34.6669,
    lng: 135.4961,
  },
  {
    id: 'apa-shinjuku',
    name: 'APA Hotel Shinjuku Kabukicho Tower',
    branchNote: '東京新宿歌舞伎町塔館',
    address: '〒160-0021 東京都新宿区歌舞伎町1-20-2',
    lat: 35.6955,
    lng: 139.7024,
  },

  // 東橫INN (Toyoko Inn) 系列
  {
    id: 'toyoko-kyoto-shijo',
    name: '東橫INN 京都四條烏丸 (Toyoko Inn Kyoto Shijo-karasuma)',
    branchNote: '京都四條烏丸店',
    address: '〒600-8008 京都市下京区四条通烏丸東入長刀鉾町28',
    lat: 35.0039,
    lng: 135.7607,
  },
  {
    id: 'toyoko-kyoto-gojo',
    name: '東橫INN 京都五條烏丸 (Toyoko Inn Kyoto Gojo-karasuma)',
    branchNote: '京都五條烏丸店',
    address: '〒600-8418 京都市下京区烏丸通松原下る五条烏丸町393',
    lat: 34.9985,
    lng: 135.7596,
  },
  {
    id: 'toyoko-osaka-namba',
    name: '東橫INN 大阪難波 (Toyoko Inn Osaka Namba)',
    branchNote: '大阪難波店',
    address: '〒542-0076 大阪市中央区難波2-3-9',
    lat: 34.6675,
    lng: 135.4992,
  },

  // Dormy Inn (多美迎) 系列
  {
    id: 'dormy-kyoto',
    name: '天然溫泉 蓮花之湯 御宿野乃京都七條 (Dormy Inn Premium Kyoto)',
    branchNote: '京都站前七條館',
    address: '〒600-8146 京都市下京区材木町491',
    lat: 34.9889,
    lng: 135.7623,
  },
  {
    id: 'dormy-osaka-namba',
    name: '天然溫泉 夕霧之湯 Dormy Inn PREMIUM 難波',
    branchNote: '大阪難波本店',
    address: '〒542-0082 大阪市中央区島之内2-14-23',
    lat: 34.6708,
    lng: 135.5067,
  },

  // OMO by 星野集團
  {
    id: 'omo5-gion',
    name: 'OMO5 京都祇園 by 星野集團',
    branchNote: '京都祇園四條館',
    address: '〒605-0073 京都市東山区四条通大和大路東入祇園町北側288',
    lat: 35.0038,
    lng: 135.7745,
  },
  {
    id: 'omo5-sanjo',
    name: 'OMO5 京都三條 by 星野集團',
    branchNote: '京都河原町三條館',
    address: '〒604-8005 京都市中京区河原町通三条上る恵比須町434-1',
    lat: 35.0091,
    lng: 135.7695,
  },
  {
    id: 'omo7-osaka',
    name: 'OMO7 大阪 by 星野集團',
    branchNote: '大阪新今宮站前館',
    address: '〒556-0003 大阪市浪速区恵美須西3-16-30',
    lat: 34.6508,
    lng: 135.5006,
  },

  // 三井花園飯店 (Mitsui Garden Hotel)
  {
    id: 'mitsui-kyoto-shinmachi',
    name: '三井花園飯店京都新町別邸 (Mitsui Garden Hotel Kyoto Shinmachi Bettei)',
    branchNote: '京都新町別邸',
    address: '〒604-8212 京都市中京区新町通六角下る六角町361',
    lat: 35.0056,
    lng: 135.7568,
  },
  {
    id: 'mitsui-kyoto-shijo',
    name: '三井花園飯店京都四條 (Mitsui Garden Hotel Kyoto Shijo)',
    branchNote: '京都四條館',
    address: '〒600-8472 京都市下京区西洞院通四条下る妙伝寺町707-1',
    lat: 35.0018,
    lng: 135.7549,
  },

  // 東京新宿・淺草熱門飯店
  {
    id: 'gracery-shinjuku',
    name: 'Hotel Gracery Shinjuku (新宿格拉斯麗飯店・哥吉拉飯店)',
    branchNote: '東京新宿東口館',
    address: '〒160-8466 東京都新宿区歌舞伎町1-19-1',
    lat: 35.6954,
    lng: 139.7021,
  },

  // 台北熱門飯店
  {
    id: 'taipei-regent',
    name: '台北晶華酒店 (Regent Taipei)',
    branchNote: '台北中山區本館',
    address: '104台灣臺北市中山區中山北路二段39巷3號',
    lat: 25.0542,
    lng: 121.5245,
  },
  {
    id: 'taipei-grand',
    name: '台北圓山大飯店 (The Grand Hotel Taipei)',
    branchNote: '台北劍潭山館',
    address: '104台灣臺北市中山區中山北路四段1號',
    lat: 25.0794,
    lng: 121.5262,
  },
];

// 英文飯店詞彙與日本地名 -> 日文片假名/漢字對照表
// 解決像「Weekly Green In Namba」在 OpenStreetMap 上僅以日文「ウィークリーグリーンインなんば」登錄而用英文搜不到的問題
const EN_TO_JA_TOKEN_MAP: Record<string, string> = {
  weekly: 'ウィークリー',
  green: 'グリーン',
  in: 'イン',
  inn: 'イン',
  hotel: 'ホテル',
  namba: 'なんば',
  nanba: '難波',
  osaka: '大阪',
  umeda: '梅田',
  shinsaibashi: '心斎橋',
  dotonbori: '道頓堀',
  tennoji: '天王寺',
  nipponbashi: '日本橋',
  daikokucho: '大国町',
  shinimamiya: '新今宮',
  kyoto: '京都',
  kawaramachi: '河原町',
  gion: '祇園',
  karasuma: '烏丸',
  shijo: '四条',
  gojo: '五条',
  shinjuku: '新宿',
  shibuya: '渋谷',
  asakusa: '浅草',
  ueno: '上野',
  ginza: '銀座',
  ikebukuro: '池袋',
  tokyo: '東京',
  hakata: '博多',
  tenjin: '天神',
  fukuoka: '福岡',
  sapporo: '札幌',
  susukino: 'すすきの',
  otaru: '小樽',
  naha: '那覇',
  okinawa: '沖縄',
  grand: 'グランド',
  palace: 'パレス',
  plaza: 'プラザ',
  resort: 'リゾート',
  royal: 'ロイヤル',
  sunroute: 'サンルート',
  tokyu: '東急',
  stay: 'ステイ',
  mystays: 'マイステイズ',
  livemax: 'リブマックス',
  fresa: 'フレッサ',
  sotetsu: '相鉄',
  daiwa: 'ダイワ',
  roynet: 'ロイネット',
  richmond: 'リッチモンド',
  vessel: 'ベッセル',
  gracery: 'グレイスリー',
  monterey: 'モントレ',
  candeo: 'カンデオ',
  apa: 'アパ',
  toyoko: '東横',
  dormy: 'ドーミー',
};

// 常見旅遊城市與商圈座標地址保底庫（當線上 API 因無門牌資料而查無特定小型民宿時，仍能提供該商圈精準座標與地址）
const AREA_FALLBACK_DIRECTORY: Array<{
  keywords: string[];
  areaLabel: string;
  address: string;
  lat: number;
  lng: number;
}> = [
  {
    keywords: ['namba', 'nanba', '難波', 'なんば'],
    areaLabel: '大阪難波商圈 (Namba, Osaka)',
    address: '〒556-0011 大阪府大阪市浪速区難波中 (Osaka Namba Area)',
    lat: 34.6659,
    lng: 135.5013,
  },
  {
    keywords: ['shinsaibashi', '心齋橋', '心斎橋'],
    areaLabel: '大阪心齋橋商圈 (Shinsaibashi, Osaka)',
    address: '〒542-0085 大阪府大阪市中央区心斎橋筋 (Osaka Shinsaibashi Area)',
    lat: 34.6723,
    lng: 135.5012,
  },
  {
    keywords: ['umeda', '梅田'],
    areaLabel: '大阪梅田站商圈 (Umeda, Osaka)',
    address: '〒530-0001 大阪府大阪市北区梅田 (Osaka Umeda Area)',
    lat: 34.7025,
    lng: 135.4959,
  },
  {
    keywords: ['dotonbori', '道頓堀'],
    areaLabel: '大阪道頓堀商圈 (Dotonbori, Osaka)',
    address: '〒542-0071 大阪府大阪市中央区道頓堀 (Osaka Dotonbori Area)',
    lat: 34.6687,
    lng: 135.5013,
  },
  {
    keywords: ['kawaramachi', '河原町', 'shijo', '四條', '四条'],
    areaLabel: '京都四條河原町商圈',
    address: '〒600-8001 京都府京都市下京区四条河原町 (Kyoto Shijo-Kawaramachi)',
    lat: 35.0037,
    lng: 135.7686,
  },
  {
    keywords: ['gion', '祇園'],
    areaLabel: '京都祇園商圈',
    address: '〒605-0073 京都府京都市東山区祇園町 (Kyoto Gion Area)',
    lat: 35.0037,
    lng: 135.7785,
  },
  {
    keywords: ['shinjuku', '新宿'],
    areaLabel: '東京新宿商圈',
    address: '〒160-0022 東京都新宿区新宿 (Tokyo Shinjuku Area)',
    lat: 35.6938,
    lng: 139.7034,
  },
  {
    keywords: ['asakusa', '淺草', '浅草'],
    areaLabel: '東京淺草雷門商圈',
    address: '〒111-0032 東京都台東区浅草 (Tokyo Asakusa Area)',
    lat: 35.7148,
    lng: 139.7967,
  },
  {
    keywords: ['shibuya', '澀谷', '渋谷'],
    areaLabel: '東京澀谷商圈',
    address: '〒150-0002 東京都渋谷区渋谷 (Tokyo Shibuya Area)',
    lat: 35.658,
    lng: 139.7016,
  },
  {
    keywords: ['ueno', '上野'],
    areaLabel: '東京上野商圈',
    address: '〒110-0005 東京都台東区上野 (Tokyo Ueno Area)',
    lat: 35.7141,
    lng: 139.7774,
  },
  {
    keywords: ['hakata', '博多', 'tenjin', '天神', 'fukuoka', '福岡'],
    areaLabel: '福岡博多・天神商圈',
    address: '〒812-0011 福岡県福岡市博多区博多駅前 (Fukuoka Hakata Area)',
    lat: 33.5902,
    lng: 130.4207,
  },
  {
    keywords: ['sapporo', '札幌', 'susukino', '薄野', 'すすきの'],
    areaLabel: '北海道札幌・薄野商圈',
    address: '〒060-0063 北海道札幌市中央区南3条西 (Sapporo Susukino Area)',
    lat: 43.0555,
    lng: 141.3534,
  },
];

function buildJapaneseQueryVariants(rawQuery: string): string[] {
  const words = rawQuery
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return [];

  let translatedCount = 0;
  const jaTokens = words.map((w) => {
    if (EN_TO_JA_TOKEN_MAP[w]) {
      translatedCount++;
      return EN_TO_JA_TOKEN_MAP[w];
    }
    return w;
  });

  if (translatedCount === 0) return [];

  const joinedNoSpace = jaTokens.join('');
  const joinedWithSpace = jaTokens.join(' ');
  return Array.from(new Set([joinedNoSpace, joinedWithSpace]));
}

// 判斷使用者輸入的飯店名稱是否已經自帶明確城市或地區（避免當主行程設為 Kyoto 時，搜尋 Namba 飯店被錯誤加上 Kyoto）
function queryAlreadyHasLocationKeyword(qLower: string): boolean {
  const locKeywords = [
    'namba',
    'nanba',
    'osaka',
    'umeda',
    'shinsaibashi',
    'dotonbori',
    'tennoji',
    'kyoto',
    'gion',
    'kawaramachi',
    'karasuma',
    'tokyo',
    'shinjuku',
    'shibuya',
    'asakusa',
    'ueno',
    'ginza',
    'ikebukuro',
    'hakata',
    'tenjin',
    'fukuoka',
    'sapporo',
    'otaru',
    'hakodate',
    'okinawa',
    'naha',
    'taipei',
    'ximending',
    'taichung',
    'tainan',
    'kaohsiung',
    'seoul',
    'myeongdong',
    'hongdae',
    'bangkok',
    '難波',
    'なんば',
    '大阪',
    '梅田',
    '心齋橋',
    '心斎橋',
    '道頓堀',
    '京都',
    '東京',
    '新宿',
    '淺草',
    '浅草',
    '澀谷',
    '渋谷',
    '上野',
    '銀座',
    '福岡',
    '博多',
    '札幌',
    '沖繩',
    '那霸',
    '台北',
    '首爾',
    '曼谷',
    '香港',
  ];
  return locKeywords.some((kw) => qLower.includes(kw));
}

export async function searchHotelCandidates(
  rawQuery: string,
  destinationHint?: string
): Promise<HotelCandidate[]> {
  const q = rawQuery.trim();
  if (!q) return [];

  const qLower = q.toLowerCase();
  const stopWords = new Set(['in', 'inn', 'hotel', 'the', 'at', 'by', 'and', '&', 'of']);
  const meaningfulKeywords = qLower
    .split(/[\s,.-]+/)
    .filter((kw) => kw.length >= 2 && !stopWords.has(kw));

  const results: HotelCandidate[] = [];
  const seenAddresses = new Set<string>();

  // 1. 先從內建連鎖/熱門飯店資料庫做智慧關鍵字權重比對
  const scoredBuiltins: Array<{ item: HotelCandidate; score: number }> = [];
  BUILTIN_HOTEL_DIRECTORY.forEach((item) => {
    const hay = `${item.name} ${item.branchNote || ''} ${item.address}`.toLowerCase();
    if (hay.includes(qLower)) {
      scoredBuiltins.push({ item, score: 100 });
      return;
    }
    if (meaningfulKeywords.length > 0) {
      const matchedCount = meaningfulKeywords.filter((kw) => hay.includes(kw)).length;
      if (
        matchedCount === meaningfulKeywords.length ||
        (meaningfulKeywords.length >= 2 && matchedCount >= 2)
      ) {
        scoredBuiltins.push({ item, score: matchedCount * 20 });
      }
    }
  });

  scoredBuiltins
    .sort((a, b) => b.score - a.score)
    .forEach(({ item }) => {
      if (!seenAddresses.has(item.address)) {
        seenAddresses.add(item.address);
        results.push(item);
      }
    });

  // 2. 若在線上，組合多語系與寬鬆版查詢字串（解決英文介係詞 In/Inn 或僅有日文片假名地標問題）
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    const searchQueries: string[] = [q];

    // 產生日文片假名轉換查詢 (例如 "Weekly Green In Namba" -> "ウィークリーグリーンインなんば")
    const jaVariants = buildJapaneseQueryVariants(q);
    jaVariants.forEach((v) => {
      if (!searchQueries.includes(v)) searchQueries.push(v);
    });

    // 產生移除英文介係詞/贅字版查詢 (例如 "Weekly Green In Namba" -> "Weekly Green Namba")
    if (meaningfulKeywords.length >= 2) {
      const strippedQuery = meaningfulKeywords.join(' ');
      if (strippedQuery !== qLower && !searchQueries.includes(strippedQuery)) {
        searchQueries.push(strippedQuery);
      }
    }

    // 只有當輸入字串本身「沒有包含任何城市/商圈名稱」時，才附加目前旅程目的地作為輔助搜尋
    if (destinationHint && !queryAlreadyHasLocationKeyword(qLower)) {
      const cleanDest = destinationHint.split(',')[0].trim();
      if (cleanDest) {
        searchQueries.push(`${q} ${cleanDest}`);
      }
    }

    // 2A. 優先查詢 OpenStreetMap Nominatim
    try {
      for (const queryStr of searchQueries.slice(0, 4)) {
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&accept-language=zh-TW,ja,en&q=${encodeURIComponent(
          queryStr
        )}`;
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        if (!Array.isArray(data)) continue;

        data.forEach((row: any, idx: number) => {
          const dispName: string = row.display_name || '';
          if (!dispName) return;

          const parts = dispName.split(',').map((s: string) => s.trim());
          const mainName = row.name || parts[0] || q;
          const dedupeKey = parts.slice(0, 4).join(', ') || dispName;

          if (seenAddresses.has(dedupeKey)) return;
          seenAddresses.add(dedupeKey);

          const cityOrSuburb =
            row.address?.city ||
            row.address?.ward ||
            row.address?.suburb ||
            row.address?.town ||
            parts[1] ||
            '';

          results.push({
            id: `nom-${row.place_id || idx}-${Date.now()}`,
            name: mainName,
            branchNote: cityOrSuburb ? `${cityOrSuburb}` : undefined,
            address: dispName,
            lat: row.lat ? Number(row.lat) : undefined,
            lng: row.lon ? Number(row.lon) : undefined,
          });
        });

        if (results.length >= 4) break;
      }
    } catch {
      // ignore Nominatim error and continue to Photon fallback
    }

    // 2B. 若 Nominatim 因嚴格關鍵字匹配無結果，自動改用 Photon 模糊地理檢索 API (支援拼字容錯與部分詞彙匹配)
    if (results.length === 0) {
      try {
        for (const queryStr of searchQueries.slice(0, 3)) {
          const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
            queryStr
          )}&limit=5`;
          const res = await fetch(photonUrl);
          if (!res.ok) continue;
          const geojson = await res.json();
          const features = geojson?.features;
          if (!Array.isArray(features)) continue;

          features.forEach((feat: any, idx: number) => {
            const props = feat?.properties;
            const coords = feat?.geometry?.coordinates;
            if (!props) return;

            const name = props.name || q;
            const addressParts = [
              props.postcode ? `〒${props.postcode}` : '',
              props.country || '',
              props.state || '',
              props.city || '',
              props.district || '',
              props.street || '',
              props.housenumber || '',
            ].filter(Boolean);

            const formattedAddr =
              addressParts.length > 0 ? addressParts.join(' ') : `${name} (${props.city || ''})`;
            if (seenAddresses.has(formattedAddr)) return;
            seenAddresses.add(formattedAddr);

            results.push({
              id: `photon-${props.osm_id || idx}-${Date.now()}`,
              name,
              branchNote: props.city || props.district || '地標檢索結果',
              address: formattedAddr,
              lat: Array.isArray(coords) ? Number(coords[1]) : undefined,
              lng: Array.isArray(coords) ? Number(coords[0]) : undefined,
            });
          });

          if (results.length >= 3) break;
        }
      } catch {
        // ignore Photon error
      }
    }
  }

  // 3. 若瀏覽器已載入 Google Maps Places Service，也一併查詢補充
  try {
    const g = (window as any).google;
    if (g?.maps?.places?.PlacesService) {
      const dummy = document.createElement('div');
      const service = new g.maps.places.PlacesService(dummy);
      const gResults = await new Promise<HotelCandidate[]>((resolve) => {
        const timer = setTimeout(() => resolve([]), 1600);
        service.textSearch({ query: q }, (places: any, status: any) => {
          clearTimeout(timer);
          if (status === g.maps.places.PlacesServiceStatus.OK && Array.isArray(places)) {
            resolve(
              places.slice(0, 5).map((p: any, i: number) => ({
                id: p.place_id || `gplace-${i}`,
                name: p.name || q,
                branchNote: p.rating ? `⭐ ${p.rating}` : undefined,
                address: p.formatted_address || '',
              }))
            );
          } else {
            resolve([]);
          }
        });
      });

      gResults.forEach((gr) => {
        if (gr.address && !seenAddresses.has(gr.address)) {
          seenAddresses.add(gr.address);
          results.push(gr);
        }
      });
    }
  } catch {
    // ignore
  }

  // 4. 商圈智慧保底：若輸入的是小型民宿/新開業公寓且名稱含有商圈地名 (如 Namba、Shinjuku、Umeda 等)，自動提供該商圈定位地址
  if (results.length === 0) {
    for (const area of AREA_FALLBACK_DIRECTORY) {
      if (area.keywords.some((kw) => qLower.includes(kw))) {
        results.push({
          id: `area-fallback-${Date.now()}`,
          name: q,
          branchNote: `${area.areaLabel} 周邊定位`,
          address: `${area.address} · ${q}`,
          lat: area.lat,
          lng: area.lng,
        });
        break;
      }
    }
  }

  return results.slice(0, 6);
}
