export type TabKey = 'discover' | 'trips' | 'plan' | 'tools';

export interface FlightLeg {
  dateLabel: string;
  flightNo: string;
  departTime: string;
  arriveTime: string;
  duration: string;
  departCountry: string;
  departCode: string;
  departCity: string;
  departTerminal?: string;
  arriveCountry: string;
  arriveCode: string;
  arriveCity: string;
  arriveTerminal?: string;
  perkLabel: string;
}

export interface StayInfo {
  stars: number;
  category: string;
  hotelName: string;
  subTitle: string;
  tag1: string;
  tag2: string;
  checkIn: string;
  checkOut: string;
  address: string;
  insiderScoop: string;
  paidStatus: string;
  photoUrl: string;
}

export interface TripMeta {
  memoryTag: string;
  statusTag: string;
  dateRangeLabel: string;
  startDate: string;
  endDate: string;
  destinationTitle: string;
  subtitle: string;
  heroPhotoUrl?: string;
  weatherTitle: string;
  weatherSub: string;
  weatherBadge: string;
  airlineLabel: string;
  baggageLabel: string;
  icocaTitle: string;
  icocaSub: string;
  icocaBalance: number;
}

export interface PlanActivity {
  id: string;
  dayIndex: number; // 0 = Day 1, 1 = Day 2, etc.
  dateIso?: string;
  time: string;
  endTime?: string;
  transport?: string;
  dotColor: 'orange' | 'green' | 'blue';
  kicker: string;
  duration: string;
  badgeText: string;
  title: string;
  location: string;
  note: string;
  photoUrl: string;
  photoBadge: string;
  cost?: number;
  lat?: number;
  lng?: number;
  sourceDestId?: string;
}

// 對應使用者原本的「目的地清單」與另一個 PWA 匯入格式 (參考 文字.txt)
export interface SavedDestinationScheduled {
  date: string;      // YYYY-MM-DD or Day key
  dayIndex: number;  // 0, 1, 2...
  start: string;     // e.g. '12:00'
  end: string;       // e.g. '13:30'
  transport: string; // '地鐵' | '巴士' | '計程車' | '步行'
  cost: string;      // 預算字串
}

export interface SavedDestination {
  id: string;
  name: string;
  customName?: string;
  customCity?: string;
  customArea?: string;
  customTags?: string[];
  country?: string;
  addressComponents?: {
    longText: string;
    types?: string[];
  }[];
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  location?: {
    lat: number;
    lng: number;
  };
  weekdayDescriptions?: string[];
  openNow?: boolean;
  scheduled: SavedDestinationScheduled | null;
  photoUrl?: string;
  photoBadge?: string;
}

export type ExpenseCategoryKey = 'shopping' | 'dining' | 'transport' | 'gifts';

export interface ExpenseItem {
  id: string;
  title: string;
  shopOrNote: string;
  amountJPY: number;
  originalAmount: number;
  originalCurrency: string;
  category: ExpenseCategoryKey;
  createdAt: string;
  quantity?: number;
  photoUrl?: string;
}

export interface TabiState {
  enableSwipeFlip: boolean; // 控制 StPageFlip 是否支援手指左右滑動翻頁 (預設 false 關閉防誤觸)
  swipeEdgeOnly?: boolean;  // 開啟滑動時，是否僅限左右兩側邊緣 (24px) 觸發翻頁 (預設 true)
  swipePolicyVersion?: number;
  trip: TripMeta;
  outbound: FlightLeg;
  inbound: FlightLeg;
  stay: StayInfo;
  destinations: SavedDestination[]; // 目的地清單 (可手動輸入或從 Location PWA 匯入並編排日期)
  activities: PlanActivity[];
  expenses: ExpenseItem[];
  totalBudgetJPY: number;
  currencyA: string;
  currencyB: string;
  exchangeAmount: number;
}

// 來自「文字.txt」的標準匯入格式範例資料
export const SAMPLE_LOCATION_TXT_DATA = [
  {
    id: 'ChIJ1X46NoSpQjQRTUQ5RsEZLTA',
    nationalPhoneNumber: '0955 731 921',
    formattedAddress: '103台灣臺北市大同區建明里長安西路220巷9號',
    location: { latitude: 25.0511648, longitude: 121.51470959999997 },
    rating: 4.9,
    regularOpeningHours: {
      openNow: true,
      weekdayDescriptions: [
        '星期一: 11:00 – 18:00',
        '星期二: 11:00 – 18:00',
        '星期三: 11:00 – 18:00',
        '星期四: 休息',
        '星期五: 11:00 – 18:00',
        '星期六: 11:00 – 18:00',
        '星期日: 11:00 – 18:00',
      ],
    },
    userRatingCount: 550,
    displayName: { text: '王師父脆皮豬｜台北大同區美食', languageCode: 'zh-TW' },
  },
  {
    id: 'ChIJbdo3rDmpQjQRKSiluw7p2iE',
    nationalPhoneNumber: '02 2597 2519',
    formattedAddress: '103台灣臺北市大同區國慶里民族西路296號',
    location: { latitude: 25.0685155, longitude: 121.51110979999999 },
    rating: 4,
    regularOpeningHours: {
      openNow: false,
      weekdayDescriptions: [
        '星期一: 休息',
        '星期二: 11:00 – 20:30',
        '星期三: 11:00 – 20:30',
        '星期四: 11:00 – 20:30',
        '星期五: 11:00 – 20:30',
        '星期六: 11:00 – 20:30',
        '星期日: 11:00 – 20:30',
      ],
    },
    userRatingCount: 6541,
    displayName: { text: '老牌張豬腳飯', languageCode: 'zh-TW' },
  },
  {
    id: 'ChIJ1aYzmiupQjQR_kyvvmCTgVg',
    nationalPhoneNumber: '02 2559 8810',
    formattedAddress: '103台灣臺北市大同區建泰里南京西路64巷16-3號',
    location: { latitude: 25.0517306, longitude: 121.51851919999999 },
    rating: 4.2,
    regularOpeningHours: {
      openNow: false,
      weekdayDescriptions: [
        '星期一: 11:00 – 14:00, 17:00 – 20:00',
        '星期二: 11:00 – 14:00, 17:00 – 20:00',
        '星期三: 11:00 – 14:00, 17:00 – 20:00',
        '星期四: 11:00 – 14:00, 17:00 – 20:00',
        '星期五: 11:00 – 14:00, 17:00 – 20:00',
        '星期六: 11:00 – 14:00, 17:00 – 20:00',
        '星期日: 11:00 – 14:00, 17:00 – 20:00',
      ],
    },
    userRatingCount: 2524,
    displayName: { text: 'KATSU鑫 熟成豬排蓋飯｜中山店', languageCode: 'zh-TW' },
  },
];

export const DEFAULT_TABI_STATE: TabiState = {
  enableSwipeFlip: false,
  swipeEdgeOnly: true,
  swipePolicyVersion: 3,
  trip: {
    memoryTag: '去旅行啦 MEMORY #04',
    statusTag: 'Confirmed & Hyped!',
    dateRangeLabel: 'Apr 12–17, 2027 · 5 Nights',
    startDate: '2027-04-12',
    endDate: '2027-04-17',
    destinationTitle: 'Kyoto, Japan',
    subtitle: '古寺神社、青苔庭園與深夜拉麵巡禮',
    heroPhotoUrl: '/assets/tabi/hero_kyoto.png',
    weatherTitle: '櫻花滿開黃金週！',
    weatherSub: '京都 22°C · 微風徐徐、陽光和煦',
    weatherBadge: '絕佳時機！',
    airlineLabel: 'ANA · Economy',
    baggageLabel: 'Baggage 2x23kg',
    icocaTitle: 'ICOCA 交通卡已儲值！',
    icocaSub: '¥5,000 隨時可搭地鐵、巴士與投販賣機',
    icocaBalance: 5000,
  },
  outbound: {
    dateLabel: 'OUTBOUND · MON, APR 12',
    flightNo: 'Flight NH 991',
    departTime: '09:00',
    arriveTime: '10:25',
    duration: '1h 25m non-stop',
    departCountry: '日本 (Japan)',
    departCode: 'HND',
    departCity: 'Tokyo Haneda',
    departTerminal: 'T3',
    arriveCountry: '日本 (Japan)',
    arriveCode: 'KIX',
    arriveCity: 'Osaka Kansai',
    arriveTerminal: 'T1',
    perkLabel: '含機上輕食與咖啡 ☕',
  },
  inbound: {
    dateLabel: 'RETURN · SAT, APR 17',
    flightNo: 'Flight NH 992',
    departTime: '17:00',
    arriveTime: '18:25',
    duration: '1h 25m non-stop',
    departCountry: '日本 (Japan)',
    departCode: 'KIX',
    departCity: 'Osaka Kansai',
    arriveCountry: '日本 (Japan)',
    departTerminal: 'T1',
    arriveCode: 'HND',
    arriveCity: 'Tokyo Haneda',
    arriveTerminal: 'T3',
    perkLabel: '戰利品伴手禮滿載 🎁',
  },
  stay: {
    stars: 4,
    category: 'Boutique Hotel',
    hotelName: 'The Gate Hotel Kyoto',
    subTitle: 'Takasegawa by HULIC · Deluxe King',
    tag1: '高瀨川河景房',
    tag2: '含免費精緻早餐',
    checkIn: 'Apr 12 · 3:00 PM',
    checkOut: 'Apr 17 · 11:00 AM',
    address: '310-2 Bizenjimacho, Nakagyo-ku, Kyoto',
    insiderScoop: '櫃檯人員有私房宇治抹茶名店清單，下雨天還能免費借用木屐與和傘！',
    paidStatus: 'Paid & Booked',
    photoUrl: '/assets/tabi/hotel_kyoto.png',
  },
  destinations: [
    {
      id: 'dest-kyoto-1',
      name: '錦市場 (Nishiki Market)',
      formattedAddress: '京都市中京區錦小路通',
      rating: 4.5,
      userRatingCount: 18420,
      location: { lat: 35.005, lng: 135.7649 },
      scheduled: {
        date: '2027-04-12',
        dayIndex: 0,
        start: '12:30',
        end: '13:30',
        transport: '地鐵',
        cost: '3200',
      },
      photoUrl: '/assets/tabi/plan_market.png',
      photoBadge: '必吃美食 🐙',
    },
    {
      id: 'dest-kyoto-2',
      name: '清水寺 (Kiyomizu-dera)',
      formattedAddress: '京都市東山區清水1丁目294',
      rating: 4.7,
      userRatingCount: 42100,
      location: { lat: 34.9949, lng: 135.785 },
      scheduled: {
        date: '2027-04-12',
        dayIndex: 0,
        start: '14:00',
        end: '15:30',
        transport: '巴士',
        cost: '1500',
      },
      photoUrl: '/assets/tabi/plan_temple.png',
      photoBadge: '古都絕景 🌿',
    },
    {
      id: 'dest-kyoto-3',
      name: '祇園花見小路 (Hanamikoji Street)',
      formattedAddress: '京都市東山區祇園町南側',
      rating: 4.6,
      userRatingCount: 15300,
      location: { lat: 35.0037, lng: 135.7756 },
      scheduled: {
        date: '2027-04-12',
        dayIndex: 0,
        start: '17:00',
        end: '19:00',
        transport: '步行',
        cost: '4800',
      },
      photoUrl: '/assets/tabi/plan_gion.png',
      photoBadge: '夕暮燈籠 ✨',
    },
    {
      id: 'ChIJ1X46NoSpQjQRTUQ5RsEZLTA',
      name: '王師父脆皮豬｜台北大同區美食',
      formattedAddress: '103台灣臺北市大同區建明里長安西路220巷9號',
      nationalPhoneNumber: '0955 731 921',
      rating: 4.9,
      userRatingCount: 550,
      location: { lat: 25.0511648, lng: 121.51470959999997 },
      openNow: true,
      weekdayDescriptions: [
        '星期一: 11:00 – 18:00',
        '星期二: 11:00 – 18:00',
        '星期三: 11:00 – 18:00',
        '星期四: 休息',
        '星期五: 11:00 – 18:00',
        '星期六: 11:00 – 18:00',
        '星期日: 11:00 – 18:00',
      ],
      scheduled: null,
    },
    {
      id: 'ChIJbdo3rDmpQjQRKSiluw7p2iE',
      name: '老牌張豬腳飯',
      formattedAddress: '103台灣臺北市大同區國慶里民族西路296號',
      nationalPhoneNumber: '02 2597 2519',
      rating: 4.0,
      userRatingCount: 6541,
      location: { lat: 25.0685155, lng: 121.51110979999999 },
      openNow: false,
      weekdayDescriptions: [
        '星期一: 休息',
        '星期二: 11:00 – 20:30',
        '星期三: 11:00 – 20:30',
        '星期四: 11:00 – 20:30',
        '星期五: 11:00 – 20:30',
        '星期六: 11:00 – 20:30',
        '星期日: 11:00 – 20:30',
      ],
      scheduled: null,
    },
    {
      id: 'ChIJ1aYzmiupQjQR_kyvvmCTgVg',
      name: 'KATSU鑫 熟成豬排蓋飯｜中山店',
      formattedAddress: '103台灣臺北市大同區建泰里南京西路64巷16-3號',
      nationalPhoneNumber: '02 2559 8810',
      rating: 4.2,
      userRatingCount: 2524,
      location: { lat: 25.0517306, lng: 121.51851919999999 },
      openNow: false,
      weekdayDescriptions: [
        '星期一: 11:00 – 14:00, 17:00 – 20:00',
        '星期二: 11:00 – 14:00, 17:00 – 20:00',
        '星期三: 11:00 – 14:00, 17:00 – 20:00',
        '星期四: 11:00 – 14:00, 17:00 – 20:00',
        '星期五: 11:00 – 14:00, 17:00 – 20:00',
        '星期六: 11:00 – 14:00, 17:00 – 20:00',
        '星期日: 11:00 – 14:00, 17:00 – 20:00',
      ],
      scheduled: null,
    },
  ],
  activities: [
    {
      id: 'act-1',
      dayIndex: 0,
      dateIso: '2027-04-12',
      time: '12:30',
      endTime: '13:30',
      transport: '地鐵',
      dotColor: 'orange',
      kicker: '京都味覺巡禮',
      duration: '1 小時',
      badgeText: '🥢 吃貨天堂',
      title: '錦市場在地午餐尋味',
      location: '錦市場 (Nishiki Market)',
      note: '小貼士：邊走邊吃京都傳統小吃，千萬別錯過現煎高湯玉子燒與章魚小丸子串！🍳',
      photoUrl: '/assets/tabi/plan_market.png',
      photoBadge: '必吃美食 🐙',
      cost: 3200,
      lat: 35.005,
      lng: 135.7649,
      sourceDestId: 'dest-kyoto-1',
    },
    {
      id: 'act-2',
      dayIndex: 0,
      dateIso: '2027-04-12',
      time: '14:00',
      endTime: '15:30',
      transport: '巴士',
      dotColor: 'green',
      kicker: '古都慢步散策',
      duration: '1.5 小時',
      badgeText: '⛩️ 禪意時光',
      title: '清水寺舞台與二三年坂石坂道',
      location: '清水寺 (Kiyomizu-dera)',
      note: '小貼士：從清水舞台遠眺京都全景超壯觀！石階坡道較多，記得穿好走的運動鞋喔！👟',
      photoUrl: '/assets/tabi/plan_temple.png',
      photoBadge: '古都絕景 🌿',
      cost: 1500,
      lat: 34.9949,
      lng: 135.785,
      sourceDestId: 'dest-kyoto-2',
    },
    {
      id: 'act-3',
      dayIndex: 0,
      dateIso: '2027-04-12',
      time: '17:00',
      endTime: '19:00',
      transport: '步行',
      dotColor: 'blue',
      kicker: '魔幻夕暮時刻',
      duration: '2 小時',
      badgeText: '🏮 町家風情',
      title: '祇園花見小路與白川夜散策',
      location: '祇園花見小路 (Hanamikoji Street)',
      note: '小貼士：紅燈籠點亮的木造町家巷弄超有氣氛，漫步時留意往來的人力車與私人小巷禮儀！🛺',
      photoUrl: '/assets/tabi/plan_gion.png',
      photoBadge: '夕暮燈籠 ✨',
      cost: 4800,
      lat: 35.0037,
      lng: 135.7756,
      sourceDestId: 'dest-kyoto-3',
    },
  ],
  expenses: [
    {
      id: 'exp-1',
      title: '唐吉訶德藥妝與伴手禮',
      shopOrNote: 'Don Quijote Kyoto Avanti',
      amountJPY: 16800,
      originalAmount: 16800,
      originalCurrency: 'JPY',
      category: 'shopping',
      createdAt: '2027-04-12 20:15',
    },
    {
      id: 'exp-2',
      title: 'SOU・SOU 京都限定足袋與布包',
      shopOrNote: 'SOU・SOU 河原町',
      amountJPY: 8000,
      originalAmount: 8000,
      originalCurrency: 'JPY',
      category: 'shopping',
      createdAt: '2027-04-12 16:10',
    },
    {
      id: 'exp-3',
      title: '一蘭拉麵 & 和牛燒肉晚餐',
      shopOrNote: '先斗町・河原町本店',
      amountJPY: 16350,
      originalAmount: 16350,
      originalCurrency: 'JPY',
      category: 'dining',
      createdAt: '2027-04-12 19:00',
    },
    {
      id: 'exp-4',
      title: '宇治抹茶芭菲 × 2',
      shopOrNote: '祇園辻利',
      amountJPY: 1850,
      originalAmount: 1850,
      originalCurrency: 'JPY',
      category: 'dining',
      createdAt: '2027-04-12 15:30',
      quantity: 2,
      photoUrl: '/assets/tabi/matcha_parfait.png',
    },
    {
      id: 'exp-5',
      title: 'HARUKA 特急 & ICOCA 儲值',
      shopOrNote: 'JR 西日本・關西機場',
      amountJPY: 9400,
      originalAmount: 9400,
      originalCurrency: 'JPY',
      category: 'transport',
      createdAt: '2027-04-12 11:00',
    },
    {
      id: 'exp-6',
      title: '清水寺戀愛御守 & 宇治抹茶生八橋',
      shopOrNote: '清水坂參道・本家西尾八ッ橋',
      amountJPY: 7500,
      originalAmount: 7500,
      originalCurrency: 'JPY',
      category: 'gifts',
      createdAt: '2027-04-12 14:50',
    },
  ],
  totalBudgetJPY: 103000,
  currencyA: 'JPY',
  currencyB: 'USD',
  exchangeAmount: 15000,
};

export const SURPRISE_SPOTS: Omit<PlanActivity, 'id' | 'dayIndex'>[] = [
  {
    time: '19:30',
    dotColor: 'orange',
    kicker: '深夜私房拉麵',
    duration: '1 小時',
    badgeText: '🍜 隱藏名店',
    title: 'Gion Duck Noodles (祇園法式鴨肉拉麵)',
    location: 'Gion Kitagawa, Kyoto',
    note: '小貼士：隱身在祇園小巷的法式濃郁鴨湯拉麵與煙燻鴨叉燒，菜單全用可愛 Emoji 呈現！',
    photoUrl: '/assets/tabi/plan_market.png',
    photoBadge: '私房秘境 🦆',
    cost: 2200,
    lat: 35.0045,
    lng: 135.7741,
  },
  {
    time: '20:00',
    dotColor: 'blue',
    kicker: '夜間河畔散策',
    duration: '1.5 小時',
    badgeText: '🏮 燈籠小巷',
    title: '先斗町石疊小路 & 鴨川納涼漫步',
    location: 'Pontocho Alley, Kyoto',
    note: '小貼士：紅燈籠倒映在鴨川水面與古老石板路，吹著晚風散步超級放鬆愜意。',
    photoUrl: '/assets/tabi/plan_gion.png',
    photoBadge: '微醺夜色 🌙',
    cost: 0,
    lat: 35.0056,
    lng: 135.771,
  },
  {
    time: '16:00',
    dotColor: 'green',
    kicker: '青苔庭園秘境',
    duration: '1 小時',
    badgeText: '🌿 靜謐綠洲',
    title: '法然院茅葺山門 & 哲學之道',
    location: 'Sakyo Ward, Kyoto',
    note: '小貼士：覆滿翠綠青苔的茅草山門與白砂壇，遊客稀少，能感受最純粹的京都幽靜。',
    photoUrl: '/assets/tabi/plan_temple.png',
    photoBadge: '禪意秘境 🍃',
    cost: 500,
    lat: 35.026,
    lng: 135.798,
  },
];
