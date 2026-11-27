import type { FlightLeg, TransportMode } from '../types/tabi';
import { formatFlightDateLabel } from './flightLookup';

export interface TransportModeMeta {
  mode: TransportMode;
  label: string;
  shortLabel: string;
  icon: string;
  enHeading: string;
  zhHeading: string;
  suitcaseHeading: string;
  routeSymbol: string;
  codeBadgeLabel: string;
  operatorPlaceholder: string;
  defaultOperatorLabel: string;
  numberPlaceholder: string;
  departTimeLabel: string;
  arriveTimeLabel: string;
  passBtnTitle: string;
  passBtnIcon: string;
  passModalTitle: string;
  passSeatOrNote: string;
}

export const TRANSPORT_MODE_META: Record<TransportMode, TransportModeMeta> = {
  flight: {
    mode: 'flight',
    label: '飛機航班',
    shortLabel: '飛機',
    icon: '✈️',
    enHeading: 'Round-trip flights',
    zhHeading: '來回航班資訊',
    suitcaseHeading: '登機證與來回航班',
    routeSymbol: '✈',
    codeBadgeLabel: '航廈',
    operatorPlaceholder: '航空公司 (如 ANA · Economy)',
    defaultOperatorLabel: 'ANA · Economy',
    numberPlaceholder: '例如：CX506、UO686、NH991、BR198...',
    departTimeLabel: '起飛時間',
    arriveTimeLabel: '抵達時間',
    passBtnTitle: 'Boarding Pass',
    passBtnIcon: '🎫',
    passModalTitle: '電子登機證 Boarding Pass',
    passSeatOrNote: 'SEAT 18A (Window)',
  },
  hsr: {
    mode: 'hsr',
    label: '高鐵 / 城軌',
    shortLabel: '高鐵',
    icon: '🚄',
    enHeading: 'Round-trip rail',
    zhHeading: '來回高鐵 / 城軌資訊',
    suitcaseHeading: '車票與來回高鐵城軌',
    routeSymbol: '🚄',
    codeBadgeLabel: '月台',
    operatorPlaceholder: '鐵路 / 席別 (如 復興號 / 廣珠城軌二等座)',
    defaultOperatorLabel: '高鐵 / 城軌 · 二等座',
    numberPlaceholder: '例如：G6340、C7618、G80、THSR 621...',
    departTimeLabel: '發車時間',
    arriveTimeLabel: '到站時間',
    passBtnTitle: '電子車票',
    passBtnIcon: '🚄',
    passModalTitle: '高鐵 / 城軌乘車憑證',
    passSeatOrNote: '證件直接刷閘進站 · 請預留安檢時間',
  },
  bus: {
    mode: 'bus',
    label: '跨境巴士 / 金巴',
    shortLabel: '巴士',
    icon: '🚌',
    enHeading: 'Round-trip coach',
    zhHeading: '來回跨境巴士 / 金巴',
    suitcaseHeading: '車票與來回跨境巴士',
    routeSymbol: '🚌',
    codeBadgeLabel: '口岸/站點',
    operatorPlaceholder: '巴士線 / 公司 (如 港珠澳金巴 / 永東 / 環島中港通)',
    defaultOperatorLabel: '港珠澳大橋金巴 HZMB',
    numberPlaceholder: '例如：港珠澳金巴、永東直通巴 09:30、中旅巴士...',
    departTimeLabel: '發車時間',
    arriveTimeLabel: '抵達時間',
    passBtnTitle: '乘車二維碼',
    passBtnIcon: '🚌',
    passModalTitle: '跨境巴士 / 金巴電子車票',
    passSeatOrNote: '憑購票二維碼於口岸／上車點掃碼乘車',
  },
  car: {
    mode: 'car',
    label: '自駕 / 包車接送',
    shortLabel: '自駕',
    icon: '🚗',
    enHeading: 'Round-trip drive',
    zhHeading: '來回自駕 / 包車交通',
    suitcaseHeading: '行車路線與通關紀錄',
    routeSymbol: '🚗',
    codeBadgeLabel: '口岸',
    operatorPlaceholder: '車型 / 接送備註 (如 港車北上 / 7人商務包車)',
    defaultOperatorLabel: '港車北上 / 專車接送',
    numberPlaceholder: '例如：港車北上 (粵港牌)、商務專車、自駕...',
    departTimeLabel: '出發時間',
    arriveTimeLabel: '預計抵達',
    passBtnTitle: '行車通關備忘',
    passBtnIcon: '🚗',
    passModalTitle: '自駕 / 包車通關備忘',
    passSeatOrNote: '請確認預約大橋通關配額與證件有效期',
  },
  ferry: {
    mode: 'ferry',
    label: '高速客輪 / 渡輪',
    shortLabel: '船班',
    icon: '⛴️',
    enHeading: 'Round-trip ferry',
    zhHeading: '來回高速客輪資訊',
    suitcaseHeading: '船票與來回客輪航線',
    routeSymbol: '⛴️',
    codeBadgeLabel: '碼頭',
    operatorPlaceholder: '船公司 / 艙等 (如 九洲藍色幹線 / 噴射飛航)',
    defaultOperatorLabel: '九洲藍色幹線 · 普通艙',
    numberPlaceholder: '例如：CKS 09:30 班次、九洲港快船...',
    departTimeLabel: '開船時間',
    arriveTimeLabel: '靠岸時間',
    passBtnTitle: '電子船票',
    passBtnIcon: '⛴️',
    passModalTitle: '高速客輪電子船票',
    passSeatOrNote: '請提前 30 分鐘抵達碼頭辦理出入境',
  },
};

export function getLegTransportMode(leg?: Partial<FlightLeg>): TransportMode {
  const m = leg?.transportMode;
  if (m === 'hsr' || m === 'bus' || m === 'car' || m === 'ferry' || m === 'flight') {
    return m;
  }
  return 'flight';
}

export function getTripTransportMode(outbound?: FlightLeg, inbound?: FlightLeg): TransportMode {
  return getLegTransportMode(outbound) !== 'flight'
    ? getLegTransportMode(outbound)
    : getLegTransportMode(inbound);
}

export interface LandHubItem {
  code: string;
  name: string;
  cityLabel: string;
  terminal: string;
  country: string;
  modes: TransportMode[];
}

export interface LandHubGroup {
  region: string;
  flag: string;
  hubs: LandHubItem[];
}

export const LAND_HUBS_BY_REGION: LandHubGroup[] = [
  {
    region: '珠海 / 澳門口岸與車站',
    flag: '🇨🇳',
    hubs: [
      {
        code: 'ZH口岸',
        name: '港珠澳大橋珠海公路口岸',
        cityLabel: '珠海公路口岸',
        terminal: '珠港大廳',
        country: '中國珠海 (Zhuhai)',
        modes: ['bus', 'car'],
      },
      {
        code: '珠海站',
        name: '高鐵/城軌珠海站 (拱北口岸)',
        cityLabel: '珠海拱北',
        terminal: '拱北口岸旁',
        country: '中國珠海 (Zhuhai)',
        modes: ['hsr', 'bus', 'car'],
      },
      {
        code: '橫琴口岸',
        name: '橫琴口岸 / 長隆渡假區',
        cityLabel: '珠海橫琴',
        terminal: '24H通關',
        country: '中國珠海 (Zhuhai)',
        modes: ['bus', 'car', 'hsr'],
      },
      {
        code: '九洲港',
        name: '珠海九洲港客運碼頭',
        cityLabel: '珠海情侶路',
        terminal: '客運碼頭',
        country: '中國珠海 (Zhuhai)',
        modes: ['ferry', 'bus'],
      },
      {
        code: '珠海北',
        name: '廣珠城軌珠海北站 / 唐家灣',
        cityLabel: '珠海高新區',
        terminal: '城軌站',
        country: '中國珠海 (Zhuhai)',
        modes: ['hsr'],
      },
      {
        code: '青茂口岸',
        name: '珠澳青茂口岸',
        cityLabel: '珠海/澳門',
        terminal: '24H電子通道',
        country: '中國珠海/澳門',
        modes: ['bus', 'car'],
      },
      {
        code: '外港/氹仔',
        name: '澳門外港 / 氹仔客運碼頭',
        cityLabel: '澳門 Macau',
        terminal: '客運碼頭',
        country: '中國澳門 (Macau)',
        modes: ['ferry', 'bus'],
      },
    ],
  },
  {
    region: '香港口岸 / 車站 / 碼頭',
    flag: '🇭🇰',
    hubs: [
      {
        code: 'HK口岸',
        name: '港珠澳大橋香港口岸',
        cityLabel: '香港大嶼山',
        terminal: '旅檢大樓',
        country: '中國香港 (Hong Kong)',
        modes: ['bus', 'car'],
      },
      {
        code: 'HK市區',
        name: '香港市區跨境巴 (太子/尖沙咀/荃灣/觀塘)',
        cityLabel: '香港市區上車點',
        terminal: '直通巴站',
        country: '中國香港 (Hong Kong)',
        modes: ['bus'],
      },
      {
        code: '西九龍',
        name: '香港西九龍高鐵站',
        cityLabel: 'Hong Kong West Kowloon',
        terminal: 'B3離境',
        country: '中國香港 (Hong Kong)',
        modes: ['hsr'],
      },
      {
        code: '中港城',
        name: '尖沙咀中港城 / 上環港澳碼頭',
        cityLabel: '香港市區碼頭',
        terminal: '客運碼頭',
        country: '中國香港 (Hong Kong)',
        modes: ['ferry'],
      },
      {
        code: '深圳灣',
        name: '深圳灣口岸',
        cityLabel: '香港/深圳',
        terminal: '旅檢大樓',
        country: '中國香港/深圳',
        modes: ['bus', 'car'],
      },
    ],
  },
  {
    region: '廣州 / 深圳 / 大灣區樞紐',
    flag: '🚄',
    hubs: [
      {
        code: '廣州南',
        name: '高鐵廣州南站 (轉乘廣珠城軌)',
        cityLabel: '廣州南站',
        terminal: '城軌換乘',
        country: '中國廣州 (Guangzhou)',
        modes: ['hsr'],
      },
      {
        code: '深圳北',
        name: '高鐵深圳北站',
        cityLabel: '深圳北站',
        terminal: '高鐵大廳',
        country: '中國深圳 (Shenzhen)',
        modes: ['hsr', 'car'],
      },
      {
        code: '蛇口港',
        name: '深圳蛇口郵輪母港',
        cityLabel: '深圳蛇口',
        terminal: '高速客輪',
        country: '中國深圳 (Shenzhen)',
        modes: ['ferry'],
      },
    ],
  },
  {
    region: '台灣高鐵 / 日本新幹線常用站',
    flag: '🌏',
    hubs: [
      {
        code: '台北站',
        name: '台灣高鐵 台北車站',
        cityLabel: 'Taipei Station',
        terminal: 'B3月台',
        country: '台灣 (Taiwan)',
        modes: ['hsr', 'bus', 'car'],
      },
      {
        code: '左營站',
        name: '台灣高鐵 左營站 (高雄)',
        cityLabel: 'Kaohsiung Zuoying',
        terminal: '高鐵月台',
        country: '台灣 (Taiwan)',
        modes: ['hsr', 'bus', 'car'],
      },
      {
        code: '東京駅',
        name: 'JR 東京駅 (新幹線)',
        cityLabel: 'Tokyo Station',
        terminal: '新幹線口',
        country: '日本 (Japan)',
        modes: ['hsr', 'bus'],
      },
      {
        code: '京都駅',
        name: 'JR 京都駅 (新幹線)',
        cityLabel: 'Kyoto Station',
        terminal: '八條口',
        country: '日本 (Japan)',
        modes: ['hsr', 'bus'],
      },
    ],
  },
];

export interface QuickLandRoutePreset {
  id: string;
  title: string;
  subtitle: string;
  mode: TransportMode;
  airlineLabel: string;
  baggageLabel?: string;
  outbound: Omit<FlightLeg, 'dateLabel'>;
  inbound: Omit<FlightLeg, 'dateLabel'>;
}

export const QUICK_LAND_ROUTES: QuickLandRoutePreset[] = [
  {
    id: 'hzmb-jinba-zhuhai',
    title: '🚌 港珠澳大橋金巴 ⇄ 珠海口岸',
    subtitle: '45分鐘跨海直達 · 24小時流水發車',
    mode: 'bus',
    airlineLabel: '港珠澳大橋金巴 HZMB',
    baggageLabel: '隨身行李 · 帶齊回鄉證/護照',
    outbound: {
      transportMode: 'bus',
      flightNo: '港珠澳金巴 HZMB',
      departTime: '09:30',
      arriveTime: '10:15',
      duration: '45m 經港珠澳大橋',
      departCountry: '中國香港 (Hong Kong)',
      departCode: 'HK口岸',
      departCity: '香港口岸旅檢大樓',
      departTerminal: '金巴站',
      arriveCountry: '中國珠海 (Zhuhai)',
      arriveCode: 'ZH口岸',
      arriveCity: '珠海公路口岸',
      arriveTerminal: '珠港大廳',
      perkLabel: 'HK$65 · 過關後可搭專線巴士/計程車進市區 🚌',
    },
    inbound: {
      transportMode: 'bus',
      flightNo: '港珠澳金巴 HZMB',
      departTime: '18:30',
      arriveTime: '19:15',
      duration: '45m 經港珠澳大橋',
      departCountry: '中國珠海 (Zhuhai)',
      departCode: 'ZH口岸',
      departCity: '珠海公路口岸',
      departTerminal: '旅檢出境',
      arriveCountry: '中國香港 (Hong Kong)',
      arriveCode: 'HK口岸',
      arriveCity: '香港口岸旅檢大樓',
      arriveTerminal: 'B5/A車接駁',
      perkLabel: '戰利品滿載 · 預留口岸通關時間 🎁',
    },
  },
  {
    id: 'coach-hk-zhuhai',
    title: '🚌 香港市區跨境直通巴 ⇄ 珠海拱北/長隆',
    subtitle: '太子/尖沙咀/荃灣上車 · 免轉車進珠海',
    mode: 'bus',
    airlineLabel: '跨境直通巴士 (中旅/環島/永東)',
    baggageLabel: '隨身+寄艙行李1件 · 帶回鄉證',
    outbound: {
      transportMode: 'bus',
      flightNo: '跨境直通巴 09:00',
      departTime: '09:00',
      arriveTime: '10:50',
      duration: '1h 50m 含過關',
      departCountry: '中國香港 (Hong Kong)',
      departCode: 'HK市區',
      departCity: '太子 / 尖沙咀上車點',
      departTerminal: '直通巴站',
      arriveCountry: '中國珠海 (Zhuhai)',
      arriveCode: '珠海拱北',
      arriveCity: '拱北口岸 / 珠海市區',
      arriveTerminal: '直達站點',
      perkLabel: '經港珠澳大橋直達珠海核心區 🚌',
    },
    inbound: {
      transportMode: 'bus',
      flightNo: '跨境直通巴 17:30',
      departTime: '17:30',
      arriveTime: '19:20',
      duration: '1h 50m 含過關',
      departCountry: '中國珠海 (Zhuhai)',
      departCode: '珠海拱北',
      departCity: '拱北口岸 / 飯店站點',
      departTerminal: '上車處',
      arriveCountry: '中國香港 (Hong Kong)',
      arriveCode: 'HK市區',
      arriveCity: '太子 / 尖沙咀落車點',
      arriveTerminal: '市區返回',
      perkLabel: '直返香港市區 · 伴手禮免搬轉車 🛍️',
    },
  },
  {
    id: 'hsr-zhuhai',
    title: '🚄 高鐵 / 廣珠城軌 ⇄ 珠海站',
    subtitle: '西九龍/廣州南出發 · 出站即達拱北口岸',
    mode: 'hsr',
    airlineLabel: '高鐵 / 廣珠城軌 · 二等座',
    baggageLabel: '隨身行李箱 · 刷證件進站',
    outbound: {
      transportMode: 'hsr',
      flightNo: '高鐵 G6340',
      departTime: '09:15',
      arriveTime: '10:45',
      duration: '1h 30m 高鐵直達',
      departCountry: '中國香港 (Hong Kong)',
      departCode: '西九龍',
      departCity: '香港西九龍站',
      departTerminal: 'B3離境',
      arriveCountry: '中國珠海 (Zhuhai)',
      arriveCode: '珠海站',
      arriveCity: '高鐵珠海站 (拱北)',
      arriveTerminal: 'A出口',
      perkLabel: '一地兩檢快速通關 · 二等座含冷氣 🚄',
    },
    inbound: {
      transportMode: 'hsr',
      flightNo: '高鐵 G6339',
      departTime: '18:05',
      arriveTime: '19:35',
      duration: '1h 30m 高鐵直達',
      departCountry: '中國珠海 (Zhuhai)',
      departCode: '珠海站',
      departCity: '高鐵珠海站 (拱北)',
      arriveCountry: '中國香港 (Hong Kong)',
      departTerminal: '候車廳',
      arriveCode: '西九龍',
      arriveCity: '香港西九龍站',
      arriveTerminal: '一地兩檢',
      perkLabel: '提前 25 分鐘進站安檢 🎫',
    },
  },
  {
    id: 'car-zhuhai',
    title: '🚗 港車北上 / 包車接送 ⇄ 珠海市區',
    subtitle: '點對點直達情侶路、長隆或飯店門口',
    mode: 'car',
    airlineLabel: '港車北上 / 7人商務專車',
    baggageLabel: '後車廂大空間 · 帶回鄉證/駕照',
    outbound: {
      transportMode: 'car',
      flightNo: '專車 / 自駕出發',
      departTime: '09:30',
      arriveTime: '10:45',
      duration: '1h 15m 經港珠澳大橋',
      departCountry: '中國香港 (Hong Kong)',
      departCode: 'HK出發',
      departCity: '香港出發點 ➔ 大橋',
      departTerminal: '港珠澳',
      arriveCountry: '中國珠海 (Zhuhai)',
      arriveCode: '珠海市區',
      arriveCity: '情侶路 / 拱北 / 長隆',
      arriveTerminal: '自駕直達',
      perkLabel: '點對點免搬行李 · 注意預約大橋通行時段 🚗',
    },
    inbound: {
      transportMode: 'car',
      flightNo: '專車 / 自駕回程',
      departTime: '18:00',
      arriveTime: '19:20',
      duration: '1h 20m 經港珠澳大橋',
      departCountry: '中國珠海 (Zhuhai)',
      departCode: '珠海市區',
      departCity: '珠海飯店 / 口岸出發',
      departTerminal: '港珠澳',
      arriveCountry: '中國香港 (Hong Kong)',
      arriveCode: 'HK返抵',
      arriveCity: '香港市區返抵',
      arriveTerminal: '大橋入境',
      perkLabel: '回程時間彈性 · 戰利品滿載直返家門 🎁',
    },
  },
  {
    id: 'ferry-jiuzhou',
    title: '⛴️ 高速客輪（中港城 / 港澳碼頭 ⇄ 珠海九洲港）',
    subtitle: '70分鐘海路直達情侶路商圈 · 舒適免塞車',
    mode: 'ferry',
    airlineLabel: '九洲藍色幹線高速客輪',
    baggageLabel: '含免費手提與標準行李 🧳',
    outbound: {
      transportMode: 'ferry',
      flightNo: '藍色幹線 09:30',
      departTime: '09:30',
      arriveTime: '10:40',
      duration: '1h 10m 高速客輪',
      departCountry: '中國香港 (Hong Kong)',
      departCode: '中港城',
      departCity: '尖沙咀中港城碼頭',
      departTerminal: '離境閘口',
      arriveCountry: '中國珠海 (Zhuhai)',
      arriveCode: '九洲港',
      arriveCity: '珠海九洲港客運碼頭',
      arriveTerminal: '市區碼頭',
      perkLabel: '海上航行免塞車 · 出碼頭即情侶路 ⛴️',
    },
    inbound: {
      transportMode: 'ferry',
      flightNo: '藍色幹線 18:00',
      departTime: '18:00',
      arriveTime: '19:10',
      duration: '1h 10m 高速客輪',
      departCountry: '中國珠海 (Zhuhai)',
      departCode: '九洲港',
      departCity: '珠海九洲港客運碼頭',
      departTerminal: '出境大廳',
      arriveCountry: '中國香港 (Hong Kong)',
      arriveCode: '中港城',
      arriveCity: '尖沙咀中港城碼頭',
      arriveTerminal: '市區抵港',
      perkLabel: '提前 30 分鐘抵達碼頭辦理通關 ⚓',
    },
  },
];

// 計算陸路 / 海路行程時間（同區域不套用跨國機場時區偏移）
export function calculateLandTravelDuration(
  departTime: string,
  arriveTime: string,
  mode: TransportMode
): string {
  const m1 = /^(\d{1,2}):(\d{2})$/.exec((departTime || '').trim());
  const m2 = /^(\d{1,2}):(\d{2})$/.exec((arriveTime || '').trim());
  const suffixMap: Record<TransportMode, string> = {
    flight: 'non-stop',
    hsr: '高鐵直達',
    bus: '跨境車程',
    car: '預計車程',
    ferry: '高速客輪',
  };
  const suffix = suffixMap[mode] || '行程時間';
  if (!m1 || !m2) return suffix;

  const depMins = parseInt(m1[1], 10) * 60 + parseInt(m1[2], 10);
  const arrMins = parseInt(m2[1], 10) * 60 + parseInt(m2[2], 10);
  let diff = arrMins - depMins;
  if (diff <= 0) diff += 24 * 60;

  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m ${suffix}`;
  if (hours > 0) return `${hours}h 00m ${suffix}`;
  return `${mins}m ${suffix}`;
}

export function buildPresetLegsWithDates(
  preset: QuickLandRoutePreset,
  startDate?: string,
  endDate?: string
): { outbound: FlightLeg; inbound: FlightLeg } {
  const outDate = formatFlightDateLabel(startDate, 'outbound') || 'OUTBOUND';
  const inDate = formatFlightDateLabel(endDate, 'inbound') || 'RETURN';
  return {
    outbound: { ...preset.outbound, dateLabel: outDate },
    inbound: { ...preset.inbound, dateLabel: inDate },
  };
}
