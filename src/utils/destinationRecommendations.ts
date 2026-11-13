import type { ExpenseCategoryKey, SavedDestination } from '../types/tabi';

export interface CuratedGemItem {
  id: string;
  name: string;
  address: string;
  rating: number;
  tag: string;
  category: 'spot' | 'food';
}

export interface DestinationTreatItem {
  id: string;
  title: string;
  shop: string;
  amountJPY: number;
  localPriceHint: string;
  category: ExpenseCategoryKey;
  photoUrl: string;
}

export interface SeasonalBannerInfo {
  emoji: string;
  weatherTitle: string;
  weatherSub: string;
  weatherBadge: string;
}

export type DestRegionKey =
  | 'kyoto'
  | 'osaka'
  | 'tokyo'
  | 'hokkaido'
  | 'fukuoka'
  | 'okinawa'
  | 'taipei'
  | 'taiwan_south'
  | 'seoul'
  | 'bangkok'
  | 'hongkong';

export function detectDestinationRegion(
  destinationTitle: string,
  destinations: SavedDestination[] = []
): string {
  const combined = `${destinationTitle} ${destinations
    .slice(0, 5)
    .map((d) => `${d.customCity || ''} ${d.name || ''} ${d.formattedAddress || ''}`)
    .join(' ')}`.toLowerCase();

  if (combined.includes('osaka') || combined.includes('大阪') || combined.includes('難波') || combined.includes('梅田') || combined.includes('心齋橋')) {
    return 'osaka';
  }
  if (combined.includes('tokyo') || combined.includes('東京') || combined.includes('新宿') || combined.includes('淺草') || combined.includes('澀谷') || combined.includes('銀座')) {
    return 'tokyo';
  }
  if (combined.includes('hokkaido') || combined.includes('北海道') || combined.includes('札幌') || combined.includes('小樽') || combined.includes('函館') || combined.includes('富良野')) {
    return 'hokkaido';
  }
  if (combined.includes('fukuoka') || combined.includes('福岡') || combined.includes('九州') || combined.includes('博多') || combined.includes('由布院') || combined.includes('熊本')) {
    return 'fukuoka';
  }
  if (combined.includes('okinawa') || combined.includes('沖繩') || combined.includes('那霸') || combined.includes('美國村')) {
    return 'okinawa';
  }
  if (combined.includes('台南') || combined.includes('高雄') || combined.includes('台中') || combined.includes('tainan') || combined.includes('kaohsiung') || combined.includes('taichung')) {
    return 'taiwan_south';
  }
  if (combined.includes('taipei') || combined.includes('台北') || combined.includes('台灣') || combined.includes('西門') || combined.includes('大同區') || combined.includes('信義區')) {
    return 'taipei';
  }
  if (combined.includes('seoul') || combined.includes('首爾') || combined.includes('韓國') || combined.includes('釜山') || combined.includes('busan') || combined.includes('弘大') || combined.includes('明洞')) {
    return 'seoul';
  }
  if (combined.includes('bangkok') || combined.includes('曼谷') || combined.includes('泰國') || combined.includes('清邁')) {
    return 'bangkok';
  }
  if (combined.includes('hong kong') || combined.includes('香港') || combined.includes('尖沙咀') || combined.includes('中環')) {
    return 'hongkong';
  }
  return 'kyoto';
}

/**
 * 根據「目的地」與「出發月份」動態產生專屬季節/氣候提示列（不再死板固定顯示櫻花黃金週）
 */
export function getDynamicSeasonalBanner(
  destinationTitle: string,
  startDateIso: string
): SeasonalBannerInfo {
  const cleanCity = destinationTitle.split(',')[0].trim() || '旅途目的地';
  const month = startDateIso ? new Date(startDateIso).getMonth() + 1 : 4;
  const region = detectDestinationRegion(destinationTitle);

  // 台灣目的地
  if (region === 'taipei' || region === 'taiwan_south') {
    if (month >= 3 && month <= 5) {
      return {
        emoji: '🌿',
        weatherTitle: `${cleanCity} 春日散步好時光！`,
        weatherSub: `${cleanCity} 24°C · 溫暖微風適合老街與夜市巡禮`,
        weatherBadge: '美食季節！',
      };
    }
    if (month >= 6 && month <= 9) {
      return {
        emoji: '🍧',
        weatherTitle: `${cleanCity} 盛夏芒果冰與夜市季！`,
        weatherSub: `${cleanCity} 31°C · 午後建議室內逛街、夜晚逛市集`,
        weatherBadge: '清涼必吃！',
      };
    }
    if (month >= 10 && month <= 11) {
      return {
        emoji: '🍂',
        weatherTitle: `${cleanCity} 秋高氣爽最舒適！`,
        weatherSub: `${cleanCity} 23°C · 涼爽少雨，最適合戶外漫遊`,
        weatherBadge: '黃金氣候！',
      };
    }
    return {
      emoji: '♨️',
      weatherTitle: `${cleanCity} 冬日暖湯與鍋物季！`,
      weatherSub: `${cleanCity} 18°C · 微涼舒適，適合泡湯與熱騰騰美食`,
      weatherBadge: '暖心之旅！',
    };
  }

  // 韓國目的地
  if (region === 'seoul') {
    if (month >= 3 && month <= 5) {
      return {
        emoji: '🌸',
        weatherTitle: `${cleanCity} 春櫻與漢江野餐季！`,
        weatherSub: `${cleanCity} 18°C · 陽光和煦，適合咖啡廳巡禮`,
        weatherBadge: '浪漫花季！',
      };
    }
    if (month >= 9 && month <= 11) {
      return {
        emoji: '🍁',
        weatherTitle: `${cleanCity} 銀杏與楓紅全盛期！`,
        weatherSub: `${cleanCity} 16°C · 街道金黃浪漫，早晚記得加件薄外套`,
        weatherBadge: '絕美秋色！',
      };
    }
    if (month === 12 || month <= 2) {
      return {
        emoji: '❄️',
        weatherTitle: `${cleanCity} 浪漫初雪與街頭魚板季！`,
        weatherSub: `${cleanCity} 2°C · 乾冷清爽，推薦韓式烤肉與熱湯`,
        weatherBadge: '冬日浪漫！',
      };
    }
    return {
      emoji: '☀️',
      weatherTitle: `${cleanCity} 潮流逛街與夜生活季！`,
      weatherSub: `${cleanCity} 27°C · 聖水洞與弘大商圈活力滿滿`,
      weatherBadge: '購物好時節！',
    };
  }

  // 泰國/曼谷
  if (region === 'bangkok') {
    return {
      emoji: '🥥',
      weatherTitle: `${cleanCity} 陽光泰式按摩與河畔夜市！`,
      weatherSub: `${cleanCity} 30°C · 熱帶渡假氛圍，必喝泰奶與高空酒吧`,
      weatherBadge: '渡假模式！',
    };
  }

  // 香港
  if (region === 'hongkong') {
    return {
      emoji: '🇭🇰',
      weatherTitle: `${cleanCity} 維港夜景與茶餐廳巡禮！`,
      weatherSub: `${cleanCity} 24°C · 海風微拂，適合搭天星小輪與叮叮車`,
      weatherBadge: '美食天堂！',
    };
  }

  // 日本與其他地區：依月份自動切換春櫻 / 初夏新綠 / 秋楓 / 冬雪
  if (month === 3 || month === 4) {
    return {
      emoji: '🌸',
      weatherTitle: `${cleanCity} 櫻花盛開浪漫週間！`,
      weatherSub: `${cleanCity} 20°C · 微風晴朗，最適合散策與拍照`,
      weatherBadge: '最佳旅遊時節！',
    };
  }
  if (month === 5 || month === 6) {
    return {
      emoji: '🍵',
      weatherTitle: `${cleanCity} 初夏新綠與清爽散策！`,
      weatherSub: `${cleanCity} 24°C · 翠綠庭園與川床料理正當時`,
      weatherBadge: '舒適宜人！',
    };
  }
  if (month === 7 || month === 8) {
    return {
      emoji: '🎆',
      weatherTitle: `${cleanCity} 夏日祭典與花火大會季！`,
      weatherSub: `${cleanCity} 29°C · 體驗浴衣漫步與清涼宇治金時刨冰`,
      weatherBadge: '夏日限定！',
    };
  }
  if (month >= 9 && month <= 11) {
    return {
      emoji: '🍁',
      weatherTitle: `${cleanCity} 絕美楓紅與銀杏見頃！`,
      weatherSub: `${cleanCity} 18°C · 秋高氣爽，古寺夜楓與秋日栗子甜點必訪`,
      weatherBadge: '賞楓黃金期！',
    };
  }
  return {
    emoji: '❄️',
    weatherTitle: `${cleanCity} 冬日雪景與暖心湯豆腐・壽喜燒！`,
    weatherSub: `${cleanCity} 8°C · 靜謐冬景搭配熱騰騰美食超療癒`,
    weatherBadge: '冬日限定！',
  };
}

/**
 * 各大熱門目的地專屬「私房景點與美食靈感」資料庫（每個地區至少 8~12 個，支援「換一批」與「景點/美食」篩選）
 */
const GEMS_BY_REGION: Record<string, CuratedGemItem[]> = {
  kyoto: [
    {
      id: 'kyoto-fushimi',
      name: '伏見稻荷大社・千本鳥居',
      address: '京都市伏見區深草藪之內町68',
      rating: 4.8,
      tag: '⛩️ 必訪名所 · 建議清晨或傍晚避開人潮',
      category: 'spot',
    },
    {
      id: 'kyoto-arashiyama',
      name: '嵐山竹林小徑 & 渡月橋',
      address: '京都市右京區嵯峨天龍寺芒之馬場町',
      rating: 4.7,
      tag: '🎋 自然散策 · 可搭配嵐山小火車與人力車',
      category: 'spot',
    },
    {
      id: 'kyoto-uji-matcha',
      name: '中村藤吉本店（宇治抹茶芭菲）',
      address: '京都府宇治市宇治壹番十番地',
      rating: 4.6,
      tag: '🍵 百年茗茶 · 必吃竹筒抹茶生茶凍',
      category: 'food',
    },
    {
      id: 'kyoto-pontocho',
      name: '先斗町・鴨川納涼床料理',
      address: '京都市中京區先斗町通',
      rating: 4.7,
      tag: '🏮 夜間美食 · 河畔町家微醺夜色',
      category: 'food',
    },
    {
      id: 'kyoto-kinkakuji',
      name: '金閣寺（鹿苑寺・舍利殿）',
      address: '京都市北區金閣寺町1',
      rating: 4.8,
      tag: '✨ 世界遺產 · 鏡湖池倒映金箔絕景',
      category: 'spot',
    },
    {
      id: 'kyoto-duck-noodles',
      name: 'Gion Duck Noodles 法式鴨肉拉麵',
      address: '京都市東山區祇園北側329',
      rating: 4.7,
      tag: '🍜 私房拉麵 · 濃郁鴨湯與莓果沾麵超驚艷',
      category: 'food',
    },
    {
      id: 'kyoto-kifune',
      name: '貴船神社 & 川床流水麵',
      address: '京都市左京區鞍馬貴船町180',
      rating: 4.8,
      tag: '🌊 森林秘境 · 水占卜與春日朱紅獻燈參道',
      category: 'spot',
    },
    {
      id: 'kyoto-maccha-house',
      name: 'MACCHA HOUSE 抹茶館（抹茶提拉米蘇）',
      address: '京都市中京區河原町通四条上ル米屋町382-2',
      rating: 4.5,
      tag: '🍰 人氣甜點 · 檜木盒濃郁爆漿抹茶提拉米蘇',
      category: 'food',
    },
    {
      id: 'kyoto-ine-funaya',
      name: '伊根舟屋 & 天橋立海之京都',
      address: '京都府與謝郡伊根町字平田',
      rating: 4.9,
      tag: '⛵ 夢幻海灣 · 搭遊覽船餵海鷗賞水上舟屋',
      category: 'spot',
    },
    {
      id: 'kyoto-mishimatei',
      name: '三嶋亭本店（百年黑毛和牛壽喜燒）',
      address: '京都市中京區寺町通三條下ル櫻之町405',
      rating: 4.7,
      tag: '🥩 老舗名店 · 入口即化霜降和牛壽喜燒',
      category: 'food',
    },
    {
      id: 'kyoto-nanzenji',
      name: '南禪寺・水路閣紅磚拱橋',
      address: '京都市左京區南禪寺福地町86',
      rating: 4.7,
      tag: '📸 復古建築 · 明治紅磚水道橋與順正湯豆腐',
      category: 'spot',
    },
    {
      id: 'kyoto-inoda',
      name: 'INODA COFFEE 本店（京都職人早餐）',
      address: '京都市中京區堺町通三條下ル道祐町140',
      rating: 4.6,
      tag: '☕ 昭和喫茶 · 阿拉伯珍珠咖啡配可頌火腿早餐',
      category: 'food',
    },
  ],
  osaka: [
    {
      id: 'osaka-dotonbori',
      name: '道頓堀固力果跑跑人 & 戎橋筋',
      address: '大阪市中央區道頓堀1丁目',
      rating: 4.7,
      tag: '📸 大阪地標 · 夜晚霓虹看板與水上觀光船',
      category: 'spot',
    },
    {
      id: 'osaka-kuromon',
      name: '黑門市場（現烤海膽・黑毛和牛串）',
      address: '大阪市中央區日本橋2丁目4-1',
      rating: 4.5,
      tag: '🦀 吃貨天堂 · 現剖生蠔、海膽與草莓大福',
      category: 'food',
    },
    {
      id: 'osaka-castle',
      name: '大阪城天守閣 & 西之丸庭園',
      address: '大阪市中央區大阪城1-1',
      rating: 4.7,
      tag: '🏯 歷史名城 · 搭乘御座船環遊護城河',
      category: 'spot',
    },
    {
      id: 'osaka-daruma',
      name: '新世界元祖炸串 だるま (Daruma)',
      address: '大阪市浪速區惠美須東2-3-9',
      rating: 4.6,
      tag: '🍢 在地必吃 · 通天閣下酥脆炸串配冰生啤',
      category: 'food',
    },
    {
      id: 'osaka-umeda-sky',
      name: '梅田藍天大廈・空中庭園展望台',
      address: '大阪市北區大淀中1-1-88',
      rating: 4.7,
      tag: '🌃 360度夜景 · 夕陽與大阪灣百萬夜景首選',
      category: 'spot',
    },
    {
      id: 'osaka-rikuro',
      name: 'りくろーおじさん 老爺爺現烤起司蛋糕',
      address: '大阪市中央區難波3-2-28',
      rating: 4.8,
      tag: '🧀 排隊甜點 · 出爐搖鈴蓬鬆雲朵起司蛋糕',
      category: 'food',
    },
    {
      id: 'osaka-nakazakicho',
      name: '中崎町昭和復古咖啡街散策',
      address: '大阪市北區中崎西',
      rating: 4.6,
      tag: '☕ 文青秘境 · 古民家改造雜貨店與手工甜點',
      category: 'spot',
    },
    {
      id: 'osaka-kiji',
      name: 'きじ (Kiji) 木地大阪燒',
      address: '大阪市北區大淀中1-1-90 滝見小路',
      rating: 4.7,
      tag: '🥞 職人鐵板 · 酥香豚玉大阪燒與日式炒麵',
      category: 'food',
    },
  ],
  tokyo: [
    {
      id: 'tokyo-sensoji',
      name: '淺草寺雷門 & 仲見世通商店街',
      address: '東京都台東區淺草2-3-1',
      rating: 4.8,
      tag: '🏮 東京必訪 · 大紅燈籠與現烤人形燒散策',
      category: 'spot',
    },
    {
      id: 'tokyo-tsukiji',
      name: '築地場外市場（厚切海膽鮪魚丼・玉子燒）',
      address: '東京都中央區築地4丁目',
      rating: 4.6,
      tag: '🍣 海鮮朝食 · 滿滿海膽丼飯與丸武現煎玉子燒',
      category: 'food',
    },
    {
      id: 'tokyo-shibuya-sky',
      name: 'SHIBUYA SKY 澀谷高空展望台',
      address: '東京都澀谷區澀谷2-24-12',
      rating: 4.9,
      tag: '🌇 絕美天際線 · 俯瞰澀谷十字路口與東京鐵塔',
      category: 'spot',
    },
    {
      id: 'tokyo-afuri',
      name: 'AFURI 阿夫利（柚子鹽味拉麵）',
      address: '東京都澀谷區惠比壽1-1-7',
      rating: 4.6,
      tag: '🍜 清爽名店 · 炭火炙燒叉燒配清香柚子雞湯',
      category: 'food',
    },
    {
      id: 'tokyo-meiji',
      name: '明治神宮 & 表參道林蔭大道',
      address: '東京都澀谷區代代木神園町1-1',
      rating: 4.8,
      tag: '🌲 城市森林 · 巨大鳥居參道與精品建築巡禮',
      category: 'spot',
    },
    {
      id: 'tokyo-gariguette',
      name: 'GARIGUETTE 表參道（現烤法式千層酥）',
      address: '東京都港區北青山3-7-2',
      rating: 4.7,
      tag: '🍓 人氣甜點 · 草莓卡士達拿破崙千層派',
      category: 'food',
    },
    {
      id: 'tokyo-teamlab',
      name: '麻布台 Hills & 東京鐵塔夜景散步',
      address: '東京都港區麻布台1丁目',
      rating: 4.8,
      tag: '🗼 最新地標 · 近距離欣賞東京鐵塔璀璨光影',
      category: 'spot',
    },
    {
      id: 'tokyo-gyukatsu',
      name: '炸牛排 もと村 (Motomura) 石板炙燒',
      address: '東京都新宿區歌舞伎町1-25-3',
      rating: 4.8,
      tag: '🥩 排隊美食 · 外酥內嫩半熟炸牛排配山藥泥飯',
      category: 'food',
    },
  ],
  hokkaido: [
    {
      id: 'hkd-otaru',
      name: '小樽運河紅磚倉庫 & 北一硝子',
      address: '北海道小樽市港町',
      rating: 4.7,
      tag: '⛄ 浪漫運河 · 煤氣燈夜景與音樂盒堂巡禮',
      category: 'spot',
    },
    {
      id: 'hkd-daruma',
      name: '成吉思汗だるま (Daruma) 炭火烤羊肉',
      address: '北海道札幌市中央區南5條西4',
      rating: 4.6,
      tag: '🥩 札幌名物 · 鮮嫩小羔羊肉配北海道生啤酒',
      category: 'food',
    },
    {
      id: 'hkd-hakodate',
      name: '函館山百萬夜景纜車',
      address: '北海道函館市函館山',
      rating: 4.8,
      tag: '🌃 世界三大夜景 · 雙海灣包夾的璀璨腰身夜景',
      category: 'spot',
    },
    {
      id: 'hkd-letao',
      name: 'LeTAO 本店（雙層起司蛋糕 & 紅茶巧克力）',
      address: '北海道小樽市堺町7-16',
      rating: 4.8,
      tag: '🍰 必吃甜點 · 入口即化北海道十勝鮮奶乳酪',
      category: 'food',
    },
    {
      id: 'hkd-suage',
      name: 'Suage+ 札幌湯咖哩（炙燒知床雞腿）',
      address: '北海道札幌市中央區南4條西5',
      rating: 4.7,
      tag: '🍛 道產食材 · 濃郁香料湯咖哩配炸北海道野菜',
      category: 'food',
    },
    {
      id: 'hkd-biei',
      name: '美瑛白金青池 & 四季彩之丘',
      address: '北海道上川郡美瑛町白金',
      rating: 4.8,
      tag: '💎 夢幻秘境 · 蒂芬妮藍池水與白樺樹倒影',
      category: 'spot',
    },
  ],
  fukuoka: [
    {
      id: 'fuk-dazaifu',
      name: '太宰府天滿宮 & 隈研吾星巴克',
      address: '福岡縣太宰府市宰府4-7-1',
      rating: 4.7,
      tag: '⛩️ 九州名所 · 必吃現烤梅枝餅與木構建築',
      category: 'spot',
    },
    {
      id: 'fuk-shinshin',
      name: '博多純情拉麵 Shin-Shin 天神本店',
      address: '福岡市中央區天神3-2-19',
      rating: 4.6,
      tag: '🍜 豚骨拉麵 · 濃而不膩極細麵配半熟溏心蛋',
      category: 'food',
    },
    {
      id: 'fuk-yufuin',
      name: '由布院金鱗湖晨霧 & 湯之坪街道',
      address: '大分縣由布市湯布院町川上',
      rating: 4.8,
      tag: '♨️ 溫泉童話村 · B-speak生乳捲與湖畔散步',
      category: 'spot',
    },
    {
      id: 'fuk-motsunabe',
      name: '博多牛腸鍋 樂天地（もつ鍋）',
      address: '福岡市中央區天神1-10-14',
      rating: 4.6,
      tag: '🍲 九州名物 · 滿滿韭菜大蒜牛腸鍋配強棒麵',
      category: 'food',
    },
  ],
  okinawa: [
    {
      id: 'oki-churaumi',
      name: '沖繩美麗海水族館（黑潮之海鯨鯊）',
      address: '沖繩縣國頭郡本部町石川424',
      rating: 4.8,
      tag: '🐋 必訪海景 · 巨型水槽鯨鯊與海豚劇場',
      category: 'spot',
    },
    {
      id: 'oki-kouri-shrimp',
      name: 'Kouri Shrimp 古宇利島蒜香蝦餐車',
      address: '沖繩縣國頭郡今歸仁村古宇利314',
      rating: 4.6,
      tag: '🦐 海景美食 · 眺望古宇利大橋大啖奶油蒜香蝦',
      category: 'food',
    },
    {
      id: 'oki-american',
      name: '北谷美國村夕陽步道 & 異國街區',
      address: '沖繩縣中頭郡北谷町美濱',
      rating: 4.7,
      tag: '🌅 渡假風情 · 彩色建築、海景咖啡與落日海灘',
      category: 'spot',
    },
    {
      id: 'oki-pork-egg',
      name: 'Pork Tamago Onigiri 沖繩豬肉蛋飯糰',
      address: '沖繩縣那霸市松尾2-8-35',
      rating: 4.6,
      tag: '🍙 人氣朝食 · 炸蝦塔塔醬與苦瓜天婦羅飯糰',
      category: 'food',
    },
  ],
  taipei: [
    {
      id: 'tpe-dadaocheng',
      name: '大稻埕迪化街老屋 & 碼頭貨櫃市集夕陽',
      address: '台北市大同區迪化街一段 & 民生西路底',
      rating: 4.8,
      tag: '🌅 河岸微醺 · 巴洛克老街巡禮與淡水河絕美晚霞',
      category: 'spot',
    },
    {
      id: 'tpe-wang-pork',
      name: '王師父脆皮豬｜台北大同區人氣美食',
      address: '103台灣臺北市大同區民生西路392號',
      rating: 4.9,
      tag: '🥩 咔滋脆皮 · 大稻埕周邊必吃超人氣脆皮燒肉',
      category: 'food',
    },
    {
      id: 'tpe-jiufen',
      name: '九份老街阿妹茶樓 & 豎崎路山海夜景',
      address: '新北市瑞芳區基山街',
      rating: 4.7,
      tag: '🏮 山城秘境 · 紅燈籠階梯與賴阿婆手工芋圓',
      category: 'spot',
    },
    {
      id: 'tpe-fuhang',
      name: '阜杭豆漿（厚餅夾蛋・鹹豆漿）',
      address: '台北市中正區忠孝東路一段108號2樓',
      rating: 4.5,
      tag: '🥟 米其林必比登 · 炭烤焦香厚燒餅配熱豆漿',
      category: 'food',
    },
    {
      id: 'tpe-songshan',
      name: '松山文創園區 & 誠品生活松菸',
      address: '台北市信義區光復南路133號',
      rating: 4.7,
      tag: '🎨 文創展覽 · 古蹟菸廠花園與設計選物店',
      category: 'spot',
    },
    {
      id: 'tpe-ningxia',
      name: '寧夏夜市（劉芋仔蛋黃芋餅・圓環邊蚵仔煎）',
      address: '台北市大同區寧夏路',
      rating: 4.6,
      tag: '🍢 夜市美食王 · 台北老字號經典小吃一條街',
      category: 'food',
    },
    {
      id: 'tpe-elephant',
      name: '象山親山步道・六巨石 101 夕陽全景',
      address: '台北市信義區信義路五段150巷',
      rating: 4.8,
      tag: '🏙️ 絕佳視角 · 20 分鐘登頂飽覽台北 101 暮色',
      category: 'spot',
    },
    {
      id: 'tpe-din-tai-fung',
      name: '鼎泰豐信義遠百店（黃金18摺小籠包）',
      address: '台北市信義區松仁路58號B1',
      rating: 4.8,
      tag: '🥟 台灣之光 · 排骨蛋炒飯、小籠包與巧克力小籠包',
      category: 'food',
    },
  ],
  taiwan_south: [
    {
      id: 'tws-shennong',
      name: '台南神農街老屋燈籠 & 國華街散步',
      address: '台南市中西區神農街',
      rating: 4.7,
      tag: '🏮 府城古韻 · 百年木造街屋與文青酒吧小巷',
      category: 'spot',
    },
    {
      id: 'tws-beef-soup',
      name: '文章牛肉湯 / 六千泓佐溫體牛肉湯',
      address: '台南市安平區安平路300號',
      rating: 4.6,
      tag: '🍲 台南必吃 · 鮮甜粉紅溫體牛肉湯配牛肉燥飯',
      category: 'food',
    },
    {
      id: 'tws-pier2',
      name: '高雄駁二藝術特區 & 大港橋旋轉秀',
      address: '高雄市鹽埕區大勇路1號',
      rating: 4.8,
      tag: '⚓ 海港文創 · 輕軌漫遊倉庫群與夕陽海風',
      category: 'spot',
    },
    {
      id: 'tws-miyahara',
      name: '台中宮原眼科（復古書櫃冰淇淋）',
      address: '台中市中區中山路20號',
      rating: 4.7,
      tag: '🍨 華麗建築 · 巨型紅磚木書櫃配日出乳酪蛋糕冰淇淋',
      category: 'food',
    },
  ],
  seoul: [
    {
      id: 'sel-bukchon',
      name: '北村韓屋村 & 景福宮韓服體驗',
      address: '首爾特別市鐘路區桂洞街37',
      rating: 4.7,
      tag: '🎎 穿韓服免門票 · 傳統韓屋巷弄眺望首爾塔',
      category: 'spot',
    },
    {
      id: 'sel-seongsu-bread',
      name: 'Jayeondo 自然島鹽可頌 & 聖水洞咖啡街',
      address: '首爾特別市城東區演武場街56-1',
      rating: 4.8,
      tag: '🥐 首爾最潮 · 剛出爐奶油脆底鹽可頌香氣撲鼻',
      category: 'food',
    },
    {
      id: 'sel-gwangjang',
      name: '廣藏市場（生牛肉章魚唐唐伊・綠豆煎餅）',
      address: '首爾特別市鐘路區昌慶宮路88',
      rating: 4.6,
      tag: '🥞 在地市場 · 必吃麻藥飯捲、生拌牛肉與現炸扭結糖餅',
      category: 'food',
    },
    {
      id: 'sel-namsan',
      name: 'N首爾塔（南山公園纜車夜景）',
      address: '首爾特別市龍山區南山公園街105',
      rating: 4.7,
      tag: '🌃 韓劇浪漫地標 · 愛情鎖牆與漢江萬家燈火',
      category: 'spot',
    },
    {
      id: 'sel-tosokchon',
      name: '土俗村蔘雞湯（景福宮百年韓屋名店）',
      address: '首爾特別市鐘路區紫霞門路5街5',
      rating: 4.5,
      tag: '🍲 暖胃補氣 · 濃郁糯米人蔘雞湯配海鮮煎餅',
      category: 'food',
    },
    {
      id: 'sel-hongdae',
      name: '弘大延南洞文青小巷 & 街頭表演',
      address: '首爾特別市麻浦區延南洞',
      rating: 4.7,
      tag: '🎶 青春活力 · 京義線林蔭道野餐與獨立小店巡禮',
      category: 'spot',
    },
  ],
  bangkok: [
    {
      id: 'bkk-wat-arun',
      name: '鄭王廟（黎明寺）泰服夕陽河畔攝影',
      address: '158 Thanon Wang Doem, Bangkok',
      rating: 4.8,
      tag: '🛕 湄南河絕景 · 純白雕花佛塔與對岸河景餐廳',
      category: 'spot',
    },
    {
      id: 'bkk-jodd-fairs',
      name: '喬德夜市 JODD FAIRS（火山排骨・水果冰沙）',
      address: 'Rama IX Rd, Huai Khwang, Bangkok',
      rating: 4.6,
      tag: '🌶️ 曼谷必逛 · 酸辣過癮火山排骨與泰式生醃海鮮',
      category: 'food',
    },
    {
      id: 'bkk-iconsiam',
      name: 'ICONSIAM 暹羅天地室內水上市場',
      address: '299 Charoen Nakhon Rd, Bangkok',
      rating: 4.8,
      tag: '🛶 冷氣水上市場 · 一次吃遍全泰小吃與船麵',
      category: 'spot',
    },
    {
      id: 'bkk-roast-shrimp',
      name: '朱拉隆功大學美食街（Mama 酸辣海鮮泡麵鍋）',
      address: 'Banthat Thong Rd, Pathum Wan, Bangkok',
      rating: 4.7,
      tag: '🦐 在地排隊王 · Jek O Chula 滿滿脆皮燒肉海鮮鍋',
      category: 'food',
    },
  ],
  hongkong: [
    {
      id: 'hkg-peak',
      name: '太平山頂纜車 & 凌霄閣摩天台夜景',
      address: '香港山頂道128號',
      rating: 4.8,
      tag: '🌃 世界級夜景 · 第六代全景山頂纜車俯瞰維多利亞港',
      category: 'spot',
    },
    {
      id: 'hkg-bakehouse',
      name: 'Bakehouse 中環/尖沙咀（酸種葡式蛋撻）',
      address: '香港中環士丹頓街5號',
      rating: 4.7,
      tag: '🥧 香港最夯 · 酥脆多層酸種餅皮配滑嫩焦糖蛋漿',
      category: 'food',
    },
    {
      id: 'hkg-starferry',
      name: '天星小輪渡維港 & 尖沙咀星光大道',
      address: '香港尖沙咀天星碼頭',
      rating: 4.8,
      tag: '⛴️ 百年經典 · 吹著海風橫渡維港最超值浪漫體驗',
      category: 'spot',
    },
    {
      id: 'hkg-australian',
      name: '澳洲牛奶公司（炒蛋多士・蛋白燉鮮奶）',
      address: '香港佐敦白加士街47號',
      rating: 4.5,
      tag: '🍳 傳奇茶餐廳 · 滑嫩牛油炒蛋厚多士配冰花奶茶',
      category: 'food',
    },
  ],
};

export function getCuratedGemsForDestination(
  destinationTitle: string,
  destinations: SavedDestination[] = []
): { regionLabel: string; gems: CuratedGemItem[] } {
  const region = detectDestinationRegion(destinationTitle, destinations);
  const regionNames: Record<string, string> = {
    kyoto: '京都・宇治',
    osaka: '大阪・難波梅田',
    tokyo: '東京・淺草澀谷',
    hokkaido: '北海道・札幌小樽',
    fukuoka: '福岡・北九州',
    okinawa: '沖繩・那霸古宇利',
    taipei: '台北・大稻埕信義',
    taiwan_south: '台中・台南・高雄',
    seoul: '首爾・聖水弘大',
    bangkok: '曼谷・湄南河畔',
    hongkong: '香港・維港中環',
  };

  return {
    regionLabel: regionNames[region] || destinationTitle.split(',')[0].trim() || '精選目的地',
    gems: GEMS_BY_REGION[region] || GEMS_BY_REGION.kyoto,
  };
}

/**
 * 根據目的地動態推薦「今日目的地小確幸」（Tools 記帳頁底部推薦卡，不再固定只有宇治抹茶芭菲）
 */
const TREATS_BY_REGION: Record<string, DestinationTreatItem[]> = {
  kyoto: [
    {
      id: 'treat-kyoto-1',
      title: '宇治抹茶芭菲 × 2',
      shop: '祇園辻利本店',
      amountJPY: 1850,
      localPriceHint: '¥1,850 · 記在「飲食」',
      category: 'dining',
      photoUrl: '/assets/tabi/matcha_parfait.png',
    },
    {
      id: 'treat-kyoto-2',
      title: '嵐山 % Arabica 京都拿鐵 × 2',
      shop: '嵐山渡月橋畔',
      amountJPY: 1200,
      localPriceHint: '¥1,200 · 記在「飲食」',
      category: 'dining',
      photoUrl: '/assets/tabi/plan_market.png',
    },
    {
      id: 'treat-kyoto-3',
      title: '清水寺櫻花鈴鐺御守 & 生八橋禮盒',
      shop: '清水坂參道・本家西尾',
      amountJPY: 2600,
      localPriceHint: '¥2,600 · 記在「手信」',
      category: 'gifts',
      photoUrl: '/assets/tabi/plan_temple.png',
    },
    {
      id: 'treat-kyoto-4',
      title: '先斗町鴨川精釀啤酒 & 炭火燒鳥',
      shop: '先斗町河畔居酒屋',
      amountJPY: 3400,
      localPriceHint: '¥3,400 · 記在「飲食」',
      category: 'dining',
      photoUrl: '/assets/tabi/plan_gion.png',
    },
  ],
  osaka: [
    {
      id: 'treat-osaka-1',
      title: '道頓堀章魚燒 12 顆 & 冰生啤',
      shop: '道頓堀 くれおーる',
      amountJPY: 1650,
      localPriceHint: '¥1,650 · 記在「飲食」',
      category: 'dining',
      photoUrl: '/assets/tabi/plan_market.png',
    },
    {
      id: 'treat-osaka-2',
      title: '老爺爺現烤蓬鬆起司蛋糕 × 1 模',
      shop: '難波戎橋本店 りくろーおじさん',
      amountJPY: 965,
      localPriceHint: '¥965 · 記在「飲食」',
      category: 'dining',
      photoUrl: '/assets/tabi/matcha_parfait.png',
    },
    {
      id: 'treat-osaka-3',
      title: '黑門市場現烤海膽干貝串',
      shop: '黑門三平水產',
      amountJPY: 2800,
      localPriceHint: '¥2,800 · 記在「飲食」',
      category: 'dining',
      photoUrl: '/assets/tabi/plan_gion.png',
    },
  ],
  tokyo: [
    {
      id: 'treat-tokyo-1',
      title: '表參道法式草莓千層酥 × 2',
      shop: 'GARIGUETTE 表參道',
      amountJPY: 2600,
      localPriceHint: '¥2,600 · 記在「飲食」',
      category: 'dining',
      photoUrl: '/assets/tabi/matcha_parfait.png',
    },
    {
      id: 'treat-tokyo-2',
      title: '淺草 7 號超濃抹茶義式冰淇淋',
      shop: '淺草 壽々喜園 × ななや',
      amountJPY: 1350,
      localPriceHint: '¥1,350 · 記在「飲食」',
      category: 'dining',
      photoUrl: '/assets/tabi/plan_market.png',
    },
    {
      id: 'treat-tokyo-3',
      title: '東京車站 NY Perfect Cheese 伴手禮',
      shop: '東京車站一番街',
      amountJPY: 3200,
      localPriceHint: '¥3,200 · 記在「手信」',
      category: 'gifts',
      photoUrl: '/assets/tabi/plan_gion.png',
    },
  ],
  hokkaido: [
    {
      id: 'treat-hkd-1',
      title: '小樽 LeTAO 雙層乳酪蛋糕下午茶',
      shop: '小樽堺町通本店',
      amountJPY: 1950,
      localPriceHint: '¥1,950 · 記在「飲食」',
      category: 'dining',
      photoUrl: '/assets/tabi/matcha_parfait.png',
    },
    {
      id: 'treat-hkd-2',
      title: '夕張哈密瓜鮮奶霜淇淋 × 2',
      shop: '小樽運河プラザ',
      amountJPY: 1100,
      localPriceHint: '¥1,100 · 記在「飲食」',
      category: 'dining',
      photoUrl: '/assets/tabi/plan_market.png',
    },
  ],
  fukuoka: [
    {
      id: 'treat-fuk-1',
      title: '太宰府現烤梅枝餅 & 博多草莓大福',
      shop: '太宰府表參道・甘木屋',
      amountJPY: 1150,
      localPriceHint: '¥1,150 · 記在「飲食」',
      category: 'dining',
      photoUrl: '/assets/tabi/matcha_parfait.png',
    },
    {
      id: 'treat-fuk-2',
      title: '由布院 B-speak 招牌原味生乳捲',
      shop: '由布院 湯之坪街道',
      amountJPY: 1620,
      localPriceHint: '¥1,620 · 記在「飲食」',
      category: 'dining',
      photoUrl: '/assets/tabi/plan_market.png',
    },
  ],
  okinawa: [
    {
      id: 'treat-oki-1',
      title: 'Blue Seal 沖繩海鹽金楚糕雙球冰淇淋',
      shop: '北谷美國村店',
      amountJPY: 1100,
      localPriceHint: '¥1,100 · 記在「飲食」',
      category: 'dining',
      photoUrl: '/assets/tabi/matcha_parfait.png',
    },
    {
      id: 'treat-oki-2',
      title: '國際通現炸黑糖沙翁 & 紅芋塔禮盒',
      shop: '御菓子御殿 國際通松尾店',
      amountJPY: 2200,
      localPriceHint: '¥2,200 · 記在「手信」',
      category: 'gifts',
      photoUrl: '/assets/tabi/plan_market.png',
    },
  ],
  taipei: [
    {
      id: 'treat-tpe-1',
      title: '大同區王師父脆皮燒肉 & 古早味紅茶',
      shop: '大稻埕民生西路',
      amountJPY: 1450,
      localPriceHint: '約 NT$300 (折合 ¥1,450) · 記在「飲食」',
      category: 'dining',
      photoUrl: '/assets/tabi/plan_market.png',
    },
    {
      id: 'treat-tpe-2',
      title: '永康街新鮮芒果雪花冰 × 2',
      shop: '永康商圈 思慕昔本館',
      amountJPY: 1200,
      localPriceHint: '約 NT$250 (折合 ¥1,200) · 記在「飲食」',
      category: 'dining',
      photoUrl: '/assets/tabi/matcha_parfait.png',
    },
    {
      id: 'treat-tpe-3',
      title: '大稻埕碼頭微醺精釀啤酒 × 2',
      shop: '大稻埕碼頭貨櫃市集',
      amountJPY: 1850,
      localPriceHint: '約 NT$380 (折合 ¥1,850) · 記在「飲食」',
      category: 'dining',
      photoUrl: '/assets/tabi/plan_gion.png',
    },
  ],
  taiwan_south: [
    {
      id: 'treat-tws-1',
      title: '台南國華街蜷尾家散步霜淇淋 × 2',
      shop: '台南中西區正興街',
      amountJPY: 980,
      localPriceHint: '約 NT$200 (折合 ¥980) · 記在「飲食」',
      category: 'dining',
      photoUrl: '/assets/tabi/matcha_parfait.png',
    },
    {
      id: 'treat-tws-2',
      title: '台中宮原眼科三球聖代加乳酪蛋糕',
      shop: '台中綠川旁 宮原眼科',
      amountJPY: 1400,
      localPriceHint: '約 NT$290 (折合 ¥1,400) · 記在「飲食」',
      category: 'dining',
      photoUrl: '/assets/tabi/plan_market.png',
    },
  ],
  seoul: [
    {
      id: 'treat-sel-1',
      title: '聖水洞剛出爐海鹽奶油可頌 × 4 袋裝',
      shop: '聖水洞 Jayeondo 自然島',
      amountJPY: 1350,
      localPriceHint: '約 ₩12,000 (折合 ¥1,350) · 記在「飲食」',
      category: 'dining',
      photoUrl: '/assets/tabi/matcha_parfait.png',
    },
    {
      id: 'treat-sel-2',
      title: '弘大蜂蜜蒜味韓式炸雞配生啤',
      shop: '弘大商圈 橋村炸雞',
      amountJPY: 2600,
      localPriceHint: '約 ₩23,000 (折合 ¥2,600) · 記在「飲食」',
      category: 'dining',
      photoUrl: '/assets/tabi/plan_gion.png',
    },
  ],
  bangkok: [
    {
      id: 'treat-bkk-1',
      title: 'After You 泰式奶茶雪花冰 & 蜜糖吐司',
      shop: 'Siam Paragon 暹羅百麗宮',
      amountJPY: 1400,
      localPriceHint: '約 ฿325 (折合 ¥1,400) · 記在「飲食」',
      category: 'dining',
      photoUrl: '/assets/tabi/matcha_parfait.png',
    },
  ],
  hongkong: [
    {
      id: 'treat-hkg-1',
      title: '中環 Bakehouse 酸種葡式蛋撻 × 4 盒裝',
      shop: '中環士丹頓街 Bakehouse',
      amountJPY: 1050,
      localPriceHint: '約 HK$50 (折合 ¥1,050) · 記在「飲食」',
      category: 'dining',
      photoUrl: '/assets/tabi/matcha_parfait.png',
    },
  ],
};

export function getTreatsForDestination(
  destinationTitle: string,
  destinations: SavedDestination[] = []
): DestinationTreatItem[] {
  const region = detectDestinationRegion(destinationTitle, destinations);
  return TREATS_BY_REGION[region] || TREATS_BY_REGION.kyoto;
}
