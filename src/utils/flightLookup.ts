import { AIRPORTS_BY_COUNTRY } from '../airports.js';
import type { FlightLeg } from '../types/tabi';

export interface FlightLookupResult {
  matched: boolean;
  source: 'schedule_db' | 'open_api' | 'airline_inferred';
  airlineLabel: string;
  updates: Partial<FlightLeg>;
  pairedReturnFlightNo?: string;
  pairedReturnUpdates?: Partial<FlightLeg>;
  message: string;
}

// 機場時區偏移量 (UTC 小時)，用於根據起降時間自動計算真實飛行時間
const AIRPORT_UTC_OFFSET: Record<string, number> = {
  HND: 9,
  NRT: 9,
  KIX: 9,
  ITM: 9,
  FUK: 9,
  CTS: 9,
  NGO: 9,
  OKA: 9,
  ICN: 9,
  GMP: 9,
  PUS: 9,
  CJU: 9,
  HKG: 8,
  MFM: 8,
  TPE: 8,
  TSA: 8,
  KHH: 8,
  RMQ: 8,
  SIN: 8,
  KUL: 8,
  BKK: 7,
  DMK: 7,
  CNX: 7,
  SYD: 10,
  LHR: 0,
  CDG: 1,
  LAX: -8,
  SFO: -8,
};

// 航空公司代碼 (IATA / ICAO) 對照表
export const AIRLINE_DIRECTORY: Record<
  string,
  { iata: string; icao: string; label: string; perkOutbound: string; perkInbound: string }
> = {
  CX: {
    iata: 'CX',
    icao: 'CPA',
    label: 'Cathay Pacific · Economy',
    perkOutbound: '含機上餐飲與娛樂系統 🎬',
    perkInbound: '23kg 寄艙行李戰利品滿載 🎁',
  },
  UO: {
    iata: 'UO',
    icao: 'HKE',
    label: 'HK Express · Economy',
    perkOutbound: 'Gotta Go 輕便直航出發 ⚡',
    perkInbound: '預購寄艙行李伴手禮滿載 🛍️',
  },
  HX: {
    iata: 'HX',
    icao: 'CRK',
    label: 'Hong Kong Airlines · Economy',
    perkOutbound: '含機上輕食與寄艙行李 🥐',
    perkInbound: '戰利品伴手禮滿載而歸 🎁',
  },
  HB: {
    iata: 'HB',
    icao: 'HGB',
    label: 'Greater Bay Airlines · Economy',
    perkOutbound: '波音客機直航出發 ✈️',
    perkInbound: '戰利品伴手禮滿載 🎁',
  },
  NH: {
    iata: 'NH',
    icao: 'ANA',
    label: 'ANA · Economy',
    perkOutbound: '含日式機上餐與咖啡 ☕',
    perkInbound: '2x23kg 戰利品伴手禮滿載 🎁',
  },
  JL: {
    iata: 'JL',
    icao: 'JAL',
    label: 'Japan Airlines · Economy',
    perkOutbound: '含 JAL 特製機上餐與飲品 🍱',
    perkInbound: '2x23kg 戰利品伴手禮滿載 🎁',
  },
  BR: {
    iata: 'BR',
    icao: 'EVA',
    label: 'EVA Air · Economy',
    perkOutbound: '含機上熱餐與娛樂系統 🍽️',
    perkInbound: '戰利品伴手禮滿載 🎁',
  },
  CI: {
    iata: 'CI',
    icao: 'CAL',
    label: 'China Airlines · Economy',
    perkOutbound: '含機上精緻餐點與飲品 ☕',
    perkInbound: '戰利品伴手禮滿載 🎁',
  },
  JX: {
    iata: 'JX',
    icao: 'SJX',
    label: 'STARLUX · Economy',
    perkOutbound: '含胡同燒肉機上餐與特調 🍸',
    perkInbound: '戰利品伴手禮滿載 🎁',
  },
  MM: {
    iata: 'MM',
    icao: 'APJ',
    label: 'Peach Aviation · Economy',
    perkOutbound: '日本樂桃直航出發 🍑',
    perkInbound: '關西伴手禮滿載而歸 🛍️',
  },
  IT: {
    iata: 'IT',
    icao: 'TTW',
    label: 'Tigerair Taiwan · Economy',
    perkOutbound: '台灣虎航直飛出發 🐯',
    perkInbound: '戰利品伴手禮滿載 🛍️',
  },
  TR: {
    iata: 'TR',
    icao: 'TGW',
    label: 'Scoot · Economy',
    perkOutbound: '酷航波音 787 夢幻客機 ✈️',
    perkInbound: '戰利品伴手禮滿載 🎁',
  },
  GK: {
    iata: 'GK',
    icao: 'JJP',
    label: 'Jetstar Japan · Economy',
    perkOutbound: '捷星日本直航出發 ⭐',
    perkInbound: '戰利品伴手禮滿載 🛍️',
  },
  SQ: {
    iata: 'SQ',
    icao: 'SIA',
    label: 'Singapore Airlines · Economy',
    perkOutbound: '含新航機上美饌與調酒 🍹',
    perkInbound: '戰利品伴手禮滿載 🎁',
  },
  KE: {
    iata: 'KE',
    icao: 'KAL',
    label: 'Korean Air · Economy',
    perkOutbound: '含韓式拌飯機上餐 🥘',
    perkInbound: '戰利品伴手禮滿載 🎁',
  },
  OZ: {
    iata: 'OZ',
    icao: 'AAR',
    label: 'Asiana Airlines · Economy',
    perkOutbound: '含韓式機上熱餐与飲品 🍱',
    perkInbound: '戰利品伴手禮滿載 🎁',
  },
  TG: {
    iata: 'TG',
    icao: 'THA',
    label: 'Thai Airways · Economy',
    perkOutbound: '含泰式機上風味餐 🍛',
    perkInbound: '戰利品伴手禮滿載 🎁',
  },
};

interface KnownFlightSchedule {
  airlineCode: string;
  number: string;
  departCode: string;
  departTerminal: string;
  arriveCode: string;
  arriveTerminal: string;
  departTime: string;
  arriveTime: string;
  pairedFlight?: string;
}

// 常用台港日韓泰熱門真實航班時刻資料庫（離線亦可秒速自動帶入）
const KNOWN_FLIGHT_SCHEDULES: Record<string, KnownFlightSchedule> = {
  // === 國泰航空 Cathay Pacific (香港 HKG <-> 日本 / 台灣 / 韓國 / 泰國) ===
  CX504: { airlineCode: 'CX', number: '504', departCode: 'HKG', departTerminal: 'T1', arriveCode: 'NRT', arriveTerminal: 'T2', departTime: '09:05', arriveTime: '14:25', pairedFlight: 'CX505' },
  CX505: { airlineCode: 'CX', number: '505', departCode: 'NRT', departTerminal: 'T2', arriveCode: 'HKG', arriveTerminal: 'T1', departTime: '18:15', arriveTime: '22:15', pairedFlight: 'CX504' },
  CX520: { airlineCode: 'CX', number: '520', departCode: 'HKG', departTerminal: 'T1', arriveCode: 'NRT', arriveTerminal: 'T2', departTime: '10:30', arriveTime: '15:55', pairedFlight: 'CX521' },
  CX521: { airlineCode: 'CX', number: '521', departCode: 'NRT', departTerminal: 'T2', arriveCode: 'HKG', arriveTerminal: 'T1', departTime: '17:00', arriveTime: '21:00', pairedFlight: 'CX520' },
  CX548: { airlineCode: 'CX', number: '548', departCode: 'HKG', departTerminal: 'T1', arriveCode: 'HND', arriveTerminal: 'T3', departTime: '08:40', arriveTime: '13:45', pairedFlight: 'CX549' },
  CX549: { airlineCode: 'CX', number: '549', departCode: 'HND', departTerminal: 'T3', arriveCode: 'HKG', arriveTerminal: 'T1', departTime: '16:25', arriveTime: '20:15', pairedFlight: 'CX548' },
  CX542: { airlineCode: 'CX', number: '542', departCode: 'HKG', departTerminal: 'T1', arriveCode: 'HND', arriveTerminal: 'T3', departTime: '16:25', arriveTime: '21:30', pairedFlight: 'CX543' },
  CX543: { airlineCode: 'CX', number: '543', departCode: 'HND', departTerminal: 'T3', arriveCode: 'HKG', arriveTerminal: 'T1', departTime: '10:35', arriveTime: '14:30', pairedFlight: 'CX542' },
  CX506: { airlineCode: 'CX', number: '506', departCode: 'HKG', departTerminal: 'T1', arriveCode: 'KIX', arriveTerminal: 'T1', departTime: '10:15', arriveTime: '15:00', pairedFlight: 'CX507' },
  CX507: { airlineCode: 'CX', number: '507', departCode: 'KIX', departTerminal: 'T1', arriveCode: 'HKG', arriveTerminal: 'T1', departTime: '18:00', arriveTime: '21:15', pairedFlight: 'CX506' },
  CX596: { airlineCode: 'CX', number: '596', departCode: 'HKG', departTerminal: 'T1', arriveCode: 'KIX', arriveTerminal: 'T1', departTime: '08:10', arriveTime: '12:55', pairedFlight: 'CX595' },
  CX595: { airlineCode: 'CX', number: '595', departCode: 'KIX', departTerminal: 'T1', arriveCode: 'HKG', arriveTerminal: 'T1', departTime: '15:10', arriveTime: '18:20', pairedFlight: 'CX596' },
  CX502: { airlineCode: 'CX', number: '502', departCode: 'HKG', departTerminal: 'T1', arriveCode: 'KIX', arriveTerminal: 'T1', departTime: '16:30', arriveTime: '21:15', pairedFlight: 'CX503' },
  CX503: { airlineCode: 'CX', number: '503', departCode: 'KIX', departTerminal: 'T1', arriveCode: 'HKG', arriveTerminal: 'T1', departTime: '10:00', arriveTime: '13:15', pairedFlight: 'CX502' },
  CX588: { airlineCode: 'CX', number: '588', departCode: 'HKG', departTerminal: 'T1', arriveCode: 'FUK', arriveTerminal: "Int'l", departTime: '11:00', arriveTime: '15:25', pairedFlight: 'CX589' },
  CX589: { airlineCode: 'CX', number: '589', departCode: 'FUK', departTerminal: "Int'l", arriveCode: 'HKG', arriveTerminal: 'T1', departTime: '16:35', arriveTime: '19:25', pairedFlight: 'CX588' },
  CX580: { airlineCode: 'CX', number: '580', departCode: 'HKG', departTerminal: 'T1', arriveCode: 'CTS', arriveTerminal: "Int'l", departTime: '09:15', arriveTime: '15:10', pairedFlight: 'CX581' },
  CX581: { airlineCode: 'CX', number: '581', departCode: 'CTS', departTerminal: "Int'l", arriveCode: 'HKG', arriveTerminal: 'T1', departTime: '16:20', arriveTime: '20:55', pairedFlight: 'CX580' },
  CX536: { airlineCode: 'CX', number: '536', departCode: 'HKG', departTerminal: 'T1', arriveCode: 'NGO', arriveTerminal: 'T1', departTime: '10:15', arriveTime: '15:10', pairedFlight: 'CX539' },
  CX539: { airlineCode: 'CX', number: '539', departCode: 'NGO', departTerminal: 'T1', arriveCode: 'HKG', arriveTerminal: 'T1', departTime: '16:15', arriveTime: '19:40', pairedFlight: 'CX536' },
  CX494: { airlineCode: 'CX', number: '494', departCode: 'HKG', departTerminal: 'T1', arriveCode: 'TPE', arriveTerminal: 'T1', departTime: '10:20', arriveTime: '12:15', pairedFlight: 'CX495' },
  CX495: { airlineCode: 'CX', number: '495', departCode: 'TPE', departTerminal: 'T1', arriveCode: 'HKG', arriveTerminal: 'T1', departTime: '13:20', arriveTime: '15:20', pairedFlight: 'CX494' },
  CX410: { airlineCode: 'CX', number: '410', departCode: 'HKG', departTerminal: 'T1', arriveCode: 'ICN', arriveTerminal: 'T1/T2', departTime: '09:25', arriveTime: '14:05', pairedFlight: 'CX411' },
  CX411: { airlineCode: 'CX', number: '411', departCode: 'ICN', departTerminal: 'T1/T2', arriveCode: 'HKG', arriveTerminal: 'T1', departTime: '15:15', arriveTime: '18:05', pairedFlight: 'CX410' },
  CX705: { airlineCode: 'CX', number: '705', departCode: 'HKG', departTerminal: 'T1', arriveCode: 'BKK', arriveTerminal: 'Main', departTime: '08:15', arriveTime: '10:15', pairedFlight: 'CX704' },
  CX704: { airlineCode: 'CX', number: '704', departCode: 'BKK', departTerminal: 'Main', arriveCode: 'HKG', arriveTerminal: 'T1', departTime: '16:15', arriveTime: '20:05', pairedFlight: 'CX705' },

  // === 香港快運 HK Express (UO) ===
  UO686: { airlineCode: 'UO', number: '686', departCode: 'HKG', departTerminal: 'T1', arriveCode: 'KIX', arriveTerminal: 'T1', departTime: '09:15', arriveTime: '14:05', pairedFlight: 'UO687' },
  UO687: { airlineCode: 'UO', number: '687', departCode: 'KIX', departTerminal: 'T1', arriveCode: 'HKG', arriveTerminal: 'T1', departTime: '14:50', arriveTime: '18:00', pairedFlight: 'UO686' },
  UO898: { airlineCode: 'UO', number: '898', departCode: 'HKG', departTerminal: 'T1', arriveCode: 'KIX', arriveTerminal: 'T1', departTime: '14:20', arriveTime: '19:05', pairedFlight: 'UO899' },
  UO899: { airlineCode: 'UO', number: '899', departCode: 'KIX', departTerminal: 'T1', arriveCode: 'HKG', arriveTerminal: 'T1', departTime: '20:05', arriveTime: '23:10', pairedFlight: 'UO898' },
  UO848: { airlineCode: 'UO', number: '848', departCode: 'HKG', departTerminal: 'T1', arriveCode: 'NRT', arriveTerminal: 'T2', departTime: '09:15', arriveTime: '14:40', pairedFlight: 'UO849' },
  UO849: { airlineCode: 'UO', number: '849', departCode: 'NRT', departTerminal: 'T2', arriveCode: 'HKG', arriveTerminal: 'T1', departTime: '15:25', arriveTime: '19:40', pairedFlight: 'UO848' },
  UO622: { airlineCode: 'UO', number: '622', departCode: 'HKG', departTerminal: 'T1', arriveCode: 'HND', arriveTerminal: 'T3', departTime: '18:00', arriveTime: '23:10', pairedFlight: 'UO623' },
  UO623: { airlineCode: 'UO', number: '623', departCode: 'HND', departTerminal: 'T3', arriveCode: 'HKG', arriveTerminal: 'T1', departTime: '01:00', arriveTime: '04:45', pairedFlight: 'UO622' },
  UO600: { airlineCode: 'UO', number: '600', departCode: 'HKG', departTerminal: 'T1', arriveCode: 'FUK', arriveTerminal: "Int'l", departTime: '07:45', arriveTime: '12:05', pairedFlight: 'UO601' },
  UO601: { airlineCode: 'UO', number: '601', departCode: 'FUK', departTerminal: "Int'l", arriveCode: 'HKG', arriveTerminal: 'T1', departTime: '13:00', arriveTime: '15:45', pairedFlight: 'UO600' },
  UO820: { airlineCode: 'UO', number: '820', departCode: 'HKG', departTerminal: 'T1', arriveCode: 'OKA', arriveTerminal: "Int'l", departTime: '07:15', arriveTime: '10:45', pairedFlight: 'UO821' },
  UO821: { airlineCode: 'UO', number: '821', departCode: 'OKA', departTerminal: "Int'l", arriveCode: 'HKG', arriveTerminal: 'T1', departTime: '11:40', arriveTime: '13:25', pairedFlight: 'UO820' },
  UO110: { airlineCode: 'UO', number: '110', departCode: 'HKG', departTerminal: 'T1', arriveCode: 'TPE', arriveTerminal: 'T1', departTime: '08:00', arriveTime: '09:55', pairedFlight: 'UO111' },
  UO111: { airlineCode: 'UO', number: '111', departCode: 'TPE', departTerminal: 'T1', arriveCode: 'HKG', arriveTerminal: 'T1', departTime: '10:50', arriveTime: '12:50', pairedFlight: 'UO110' },

  // === 香港航空 Hong Kong Airlines (HX) & 大灣區航空 (HB) ===
  HX614: { airlineCode: 'HX', number: '614', departCode: 'HKG', departTerminal: 'T1', arriveCode: 'KIX', arriveTerminal: 'T1', departTime: '09:10', arriveTime: '13:55', pairedFlight: 'HX615' },
  HX615: { airlineCode: 'HX', number: '615', departCode: 'KIX', departTerminal: 'T1', arriveCode: 'HKG', arriveTerminal: 'T1', departTime: '14:55', arriveTime: '18:10', pairedFlight: 'HX614' },
  HX618: { airlineCode: 'HX', number: '618', departCode: 'HKG', departTerminal: 'T1', arriveCode: 'KIX', arriveTerminal: 'T1', departTime: '11:30', arriveTime: '16:20', pairedFlight: 'HX619' },
  HX619: { airlineCode: 'HX', number: '619', departCode: 'KIX', departTerminal: 'T1', arriveCode: 'HKG', arriveTerminal: 'T1', departTime: '17:20', arriveTime: '20:35', pairedFlight: 'HX618' },
  HX608: { airlineCode: 'HX', number: '608', departCode: 'HKG', departTerminal: 'T1', arriveCode: 'NRT', arriveTerminal: 'T2', departTime: '09:15', arriveTime: '14:55', pairedFlight: 'HX609' },
  HX609: { airlineCode: 'HX', number: '609', departCode: 'NRT', departTerminal: 'T2', arriveCode: 'HKG', arriveTerminal: 'T1', departTime: '15:55', arriveTime: '20:05', pairedFlight: 'HX608' },
  HB340: { airlineCode: 'HB', number: '340', departCode: 'HKG', departTerminal: 'T1', arriveCode: 'KIX', arriveTerminal: 'T1', departTime: '09:15', arriveTime: '14:00', pairedFlight: 'HB341' },
  HB341: { airlineCode: 'HB', number: '341', departCode: 'KIX', departTerminal: 'T1', arriveCode: 'HKG', arriveTerminal: 'T1', departTime: '15:00', arriveTime: '18:15', pairedFlight: 'HB340' },
  HB320: { airlineCode: 'HB', number: '320', departCode: 'HKG', departTerminal: 'T1', arriveCode: 'NRT', arriveTerminal: 'T2', departTime: '09:20', arriveTime: '14:50', pairedFlight: 'HB321' },
  HB321: { airlineCode: 'HB', number: '321', departCode: 'NRT', departTerminal: 'T2', arriveCode: 'HKG', arriveTerminal: 'T1', departTime: '16:00', arriveTime: '20:15', pairedFlight: 'HB320' },

  // === 全日空 ANA (NH) & 日本航空 JAL (JL) ===
  NH991: { airlineCode: 'NH', number: '991', departCode: 'HND', departTerminal: 'T3', arriveCode: 'KIX', arriveTerminal: 'T1', departTime: '09:00', arriveTime: '10:25', pairedFlight: 'NH992' },
  NH992: { airlineCode: 'NH', number: '992', departCode: 'KIX', departTerminal: 'T1', arriveCode: 'HND', arriveTerminal: 'T3', departTime: '17:00', arriveTime: '18:25', pairedFlight: 'NH991' },
  NH999: { airlineCode: 'NH', number: '999', departCode: 'HND', departTerminal: 'T2', arriveCode: 'CTS', arriveTerminal: "Int'l", departTime: '20:00', arriveTime: '21:35', pairedFlight: 'NH998' },
  NH859: { airlineCode: 'NH', number: '859', departCode: 'HND', departTerminal: 'T3', arriveCode: 'HKG', arriveTerminal: 'T1', departTime: '08:50', arriveTime: '12:55', pairedFlight: 'NH860' },
  NH860: { airlineCode: 'NH', number: '860', departCode: 'HKG', departTerminal: 'T1', arriveCode: 'HND', arriveTerminal: 'T3', departTime: '14:25', arriveTime: '19:30', pairedFlight: 'NH859' },
  NH811: { airlineCode: 'NH', number: '811', departCode: 'NRT', departTerminal: 'T1/T2', arriveCode: 'HKG', arriveTerminal: 'T1', departTime: '18:25', arriveTime: '22:40', pairedFlight: 'NH812' },
  NH812: { airlineCode: 'NH', number: '812', departCode: 'HKG', departTerminal: 'T1', arriveCode: 'NRT', arriveTerminal: 'T1/T2', departTime: '09:30', arriveTime: '14:50', pairedFlight: 'NH811' },
  NH851: { airlineCode: 'NH', number: '851', departCode: 'HND', departTerminal: 'T3', arriveCode: 'TSA', arriveTerminal: 'T1', departTime: '09:40', arriveTime: '12:10', pairedFlight: 'NH852' },
  NH852: { airlineCode: 'NH', number: '852', departCode: 'TSA', departTerminal: 'T1', arriveCode: 'HND', arriveTerminal: 'T3', departTime: '13:35', arriveTime: '17:45', pairedFlight: 'NH851' },
  JL26: { airlineCode: 'JL', number: '26', departCode: 'HKG', departTerminal: 'T1', arriveCode: 'HND', arriveTerminal: 'T3', departTime: '15:15', arriveTime: '20:25', pairedFlight: 'JL29' },
  JL29: { airlineCode: 'JL', number: '29', departCode: 'HND', departTerminal: 'T3', arriveCode: 'HKG', arriveTerminal: 'T1', departTime: '09:55', arriveTime: '13:55', pairedFlight: 'JL26' },
  JL736: { airlineCode: 'JL', number: '736', departCode: 'HKG', departTerminal: 'T1', arriveCode: 'NRT', arriveTerminal: 'T2', departTime: '10:40', arriveTime: '16:05', pairedFlight: 'JL735' },
  JL735: { airlineCode: 'JL', number: '735', departCode: 'NRT', departTerminal: 'T2', arriveCode: 'HKG', arriveTerminal: 'T1', departTime: '18:10', arriveTime: '22:00', pairedFlight: 'JL736' },
  JL802: { airlineCode: 'JL', number: '802', departCode: 'TPE', departTerminal: 'T2', arriveCode: 'NRT', arriveTerminal: 'T2', departTime: '10:00', arriveTime: '14:20', pairedFlight: 'JL809' },
  JL809: { airlineCode: 'JL', number: '809', departCode: 'NRT', departTerminal: 'T2', arriveCode: 'TPE', arriveTerminal: 'T2', departTime: '18:00', arriveTime: '20:55', pairedFlight: 'JL802' },

  // === 長榮 BR / 華航 CI / 星宇 JX / 樂桃 MM (台灣 <-> 日本) ===
  BR178: { airlineCode: 'BR', number: '178', departCode: 'TPE', departTerminal: 'T2', arriveCode: 'KIX', arriveTerminal: 'T1', departTime: '06:30', arriveTime: '10:10', pairedFlight: 'BR177' },
  BR177: { airlineCode: 'BR', number: '177', departCode: 'KIX', departTerminal: 'T1', arriveCode: 'TPE', arriveTerminal: 'T2', departTime: '11:10', arriveTime: '13:05', pairedFlight: 'BR178' },
  BR132: { airlineCode: 'BR', number: '132', departCode: 'TPE', departTerminal: 'T2', arriveCode: 'KIX', arriveTerminal: 'T1', departTime: '08:30', arriveTime: '12:10', pairedFlight: 'BR131' },
  BR131: { airlineCode: 'BR', number: '131', departCode: 'KIX', departTerminal: 'T1', arriveCode: 'TPE', arriveTerminal: 'T2', departTime: '13:10', arriveTime: '15:05', pairedFlight: 'BR132' },
  BR198: { airlineCode: 'BR', number: '198', departCode: 'TPE', departTerminal: 'T2', arriveCode: 'NRT', arriveTerminal: 'T1/T2', departTime: '08:50', arriveTime: '13:15', pairedFlight: 'BR197' },
  BR197: { airlineCode: 'BR', number: '197', departCode: 'NRT', departTerminal: 'T1/T2', arriveCode: 'TPE', arriveTerminal: 'T2', departTime: '14:15', arriveTime: '16:55', pairedFlight: 'BR198' },
  CI156: { airlineCode: 'CI', number: '156', departCode: 'TPE', departTerminal: 'T2', arriveCode: 'KIX', arriveTerminal: 'T1', departTime: '08:10', arriveTime: '11:50', pairedFlight: 'CI157' },
  CI157: { airlineCode: 'CI', number: '157', departCode: 'KIX', departTerminal: 'T1', arriveCode: 'TPE', arriveTerminal: 'T2', departTime: '12:55', arriveTime: '15:00', pairedFlight: 'CI156' },
  CI100: { airlineCode: 'CI', number: '100', departCode: 'TPE', departTerminal: 'T2', arriveCode: 'NRT', arriveTerminal: 'T2', departTime: '09:30', arriveTime: '13:30', pairedFlight: 'CI101' },
  CI101: { airlineCode: 'CI', number: '101', departCode: 'NRT', departTerminal: 'T2', arriveCode: 'TPE', arriveTerminal: 'T2', departTime: '14:35', arriveTime: '17:40', pairedFlight: 'CI100' },
  JX820: { airlineCode: 'JX', number: '820', departCode: 'TPE', departTerminal: 'T1', arriveCode: 'KIX', arriveTerminal: 'T1', departTime: '07:40', arriveTime: '11:10', pairedFlight: 'JX821' },
  JX821: { airlineCode: 'JX', number: '821', departCode: 'KIX', departTerminal: 'T1', arriveCode: 'TPE', arriveTerminal: 'T1', departTime: '12:20', arriveTime: '14:15', pairedFlight: 'JX820' },
  JX800: { airlineCode: 'JX', number: '800', departCode: 'TPE', departTerminal: 'T1', arriveCode: 'NRT', arriveTerminal: 'T2', departTime: '08:30', arriveTime: '12:45', pairedFlight: 'JX801' },
  JX801: { airlineCode: 'JX', number: '801', departCode: 'NRT', departTerminal: 'T2', arriveCode: 'TPE', arriveTerminal: 'T1', departTime: '13:55', arriveTime: '16:35', pairedFlight: 'JX800' },
  MM68: { airlineCode: 'MM', number: '68', departCode: 'HKG', departTerminal: 'T1', arriveCode: 'KIX', arriveTerminal: 'T2', departTime: '01:35', arriveTime: '06:25', pairedFlight: 'MM67' },
  MM67: { airlineCode: 'MM', number: '67', departCode: 'KIX', departTerminal: 'T2', arriveCode: 'HKG', arriveTerminal: 'T1', departTime: '21:10', arriveTime: '00:25', pairedFlight: 'MM68' },
  MM22: { airlineCode: 'MM', number: '22', departCode: 'TPE', departTerminal: 'T1', arriveCode: 'KIX', arriveTerminal: 'T2', departTime: '09:15', arriveTime: '12:55', pairedFlight: 'MM27' },
  MM27: { airlineCode: 'MM', number: '27', departCode: 'KIX', departTerminal: 'T2', arriveCode: 'TPE', arriveTerminal: 'T1', departTime: '15:55', arriveTime: '17:55', pairedFlight: 'MM22' },
};

// 從 airports.js 查詢機場詳情
export function findAirportDetailsByCode(code: string) {
  const upper = code.trim().toUpperCase();
  for (const grp of AIRPORTS_BY_COUNTRY) {
    for (const ap of grp.airports) {
      const disp = (ap.displayCode || ap.code).toUpperCase();
      if (ap.code.toUpperCase() === upper || disp === upper) {
        return {
          country: grp.country,
          code: disp,
          city: ap.enName,
          name: ap.name,
          terminal: ap.terminal || 'T1',
        };
      }
    }
  }
  return null;
}

// 根據出發或回程 ISO 日期，自動格式化為航班頂部日期標籤 (如 OUTBOUND · MON, APR 12)
export function formatFlightDateLabel(
  isoDate: string | undefined,
  leg: 'outbound' | 'inbound'
): string | undefined {
  if (!isoDate) return undefined;
  const d = new Date(`${isoDate}T00:00:00`);
  if (isNaN(d.getTime())) return undefined;
  const prefix = leg === 'outbound' ? 'OUTBOUND' : 'RETURN';
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = d.getDate();
  return `${prefix} · ${weekday}, ${month} ${day}`;
}

// 根據起飛時間、抵達時間與起降機場時區，自動計算航程時間文字 (如 3h 45m non-stop)
export function calculateFlightDuration(
  departTime: string,
  arriveTime: string,
  departCode: string,
  arriveCode: string
): string {
  const m1 = /^(\d{1,2}):(\d{2})$/.exec(departTime.trim());
  const m2 = /^(\d{1,2}):(\d{2})$/.exec(arriveTime.trim());
  if (!m1 || !m2) return '直航 non-stop';

  const depMins = parseInt(m1[1], 10) * 60 + parseInt(m1[2], 10);
  const arrMins = parseInt(m2[1], 10) * 60 + parseInt(m2[2], 10);

  const depTz = AIRPORT_UTC_OFFSET[departCode.toUpperCase()] ?? 8;
  const arrTz = AIRPORT_UTC_OFFSET[arriveCode.toUpperCase()] ?? 9;
  const tzDiffMins = (arrTz - depTz) * 60;

  // 轉換為同一時區後的實際飛行分鐘數
  let diff = arrMins - depMins - tzDiffMins;
  while (diff <= 0) {
    diff += 24 * 60;
  }
  // 防呆：如果因為時差跨日超過 18 小時但屬於亞洲短程線，修正回合理區間
  if (diff > 18 * 60 && Math.abs(arrTz - depTz) <= 2) {
    diff = ((arrMins - depMins) + 24 * 60) % (24 * 60);
  }

  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  if (hours > 0 && mins > 0) {
    return `${hours}h ${mins}m non-stop`;
  }
  if (hours > 0) {
    return `${hours}h 00m non-stop`;
  }
  return `${mins}m non-stop`;
}

// 解析使用者輸入的航班編號 (如 "Flight CX 506" -> { prefix: "CX", num: "506", normalized: "CX506", display: "Flight CX 506" })
export function parseFlightCode(raw: string): {
  prefix: string;
  num: string;
  normalized: string;
  display: string;
} | null {
  const cleaned = raw
    .replace(/^flight\s+/i, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
  const match = /^([A-Z]{2,3})0*(\d{1,4}[A-Z]?)$/.exec(cleaned);
  if (!match) return null;
  let prefix = match[1];
  const num = match[2];

  // 若輸入了 3 碼 ICAO (如 CPA506 / ANA991 / HKE686)，自動轉為 2 碼 IATA
  const byIcao = Object.values(AIRLINE_DIRECTORY).find((a) => a.icao === prefix);
  if (byIcao) {
    prefix = byIcao.iata;
  }

  return {
    prefix,
    num,
    normalized: `${prefix}${num}`,
    display: `Flight ${prefix} ${num}`,
  };
}

function buildLegUpdatesFromSchedule(
  sched: KnownFlightSchedule,
  leg: 'outbound' | 'inbound',
  tripDateIso?: string
): Partial<FlightLeg> {
  const depAp = findAirportDetailsByCode(sched.departCode);
  const arrAp = findAirportDetailsByCode(sched.arriveCode);
  const airline = AIRLINE_DIRECTORY[sched.airlineCode];
  const dateLabel = formatFlightDateLabel(tripDateIso, leg);
  const duration = calculateFlightDuration(
    sched.departTime,
    sched.arriveTime,
    sched.departCode,
    sched.arriveCode
  );

  return {
    ...(dateLabel ? { dateLabel } : {}),
    flightNo: `Flight ${sched.airlineCode} ${sched.number}`,
    departTime: sched.departTime,
    arriveTime: sched.arriveTime,
    duration,
    ...(depAp
      ? {
          departCountry: depAp.country,
          departCode: depAp.code,
          departCity: depAp.city,
          departTerminal: sched.departTerminal || depAp.terminal,
        }
      : {
          departCode: sched.departCode,
          departTerminal: sched.departTerminal,
        }),
    ...(arrAp
      ? {
          arriveCountry: arrAp.country,
          arriveCode: arrAp.code,
          arriveCity: arrAp.city,
          arriveTerminal: sched.arriveTerminal || arrAp.terminal,
        }
      : {
          arriveCode: sched.arriveCode,
          arriveTerminal: sched.arriveTerminal,
        }),
    ...(airline
      ? {
          perkLabel: leg === 'outbound' ? airline.perkOutbound : airline.perkInbound,
        }
      : {}),
  };
}

// 智慧查詢航班編號：支援內建熱門時刻表 + 開放航空航線 API (adsbdb) + 航空公司與時差自動推算
export async function lookupFlightByNumber(
  rawFlightNo: string,
  leg: 'outbound' | 'inbound',
  currentLeg: FlightLeg,
  outboundDateIso?: string,
  inboundDateIso?: string
): Promise<FlightLookupResult> {
  const parsed = parseFlightCode(rawFlightNo);
  const activeDateIso = leg === 'outbound' ? outboundDateIso : inboundDateIso;
  const dateLabel = formatFlightDateLabel(activeDateIso, leg);

  if (!parsed) {
    return {
      matched: false,
      source: 'airline_inferred',
      airlineLabel: '',
      updates: dateLabel ? { dateLabel } : {},
      message: '⚠️ 請輸入有效的航班編號格式（例如：CX506、UO686、HX618、NH991、BR198）',
    };
  }

  const airlineInfo = AIRLINE_DIRECTORY[parsed.prefix];
  const airlineLabel = airlineInfo?.label || `${parsed.prefix} Airlines · Economy`;

  // 1. 優先查詢內建熱門航班時刻表（秒速、支援離線）
  const known = KNOWN_FLIGHT_SCHEDULES[parsed.normalized];
  if (known) {
    const updates = buildLegUpdatesFromSchedule(known, leg, activeDateIso);
    let pairedReturnFlightNo: string | undefined;
    let pairedReturnUpdates: Partial<FlightLeg> | undefined;

    if (leg === 'outbound' && known.pairedFlight && KNOWN_FLIGHT_SCHEDULES[known.pairedFlight]) {
      const pairedSched = KNOWN_FLIGHT_SCHEDULES[known.pairedFlight];
      pairedReturnFlightNo = `Flight ${pairedSched.airlineCode} ${pairedSched.number}`;
      pairedReturnUpdates = buildLegUpdatesFromSchedule(pairedSched, 'inbound', inboundDateIso);
    }

    return {
      matched: true,
      source: 'schedule_db',
      airlineLabel,
      updates,
      pairedReturnFlightNo,
      pairedReturnUpdates,
      message: `✈️ 已自動帶入 ${parsed.display} (${known.departCode} ➔ ${known.arriveCode} · ${known.departTime}–${known.arriveTime})`,
    };
  }

  // 2. 若不在內建表，嘗試透過免費公開航空 API (adsbdb) 查詢起降機場
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    const callsignCandidates = airlineInfo
      ? [`${airlineInfo.icao}${parsed.num}`, parsed.normalized]
      : [parsed.normalized];

    for (const cs of callsignCandidates) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3200);
        const res = await fetch(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(cs)}`, {
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          const route = data?.response?.flightroute;
          const origIata: string | undefined = route?.origin?.iata_code;
          const destIata: string | undefined = route?.destination?.iata_code;

          if (origIata && destIata) {
            const depAp = findAirportDetailsByCode(origIata);
            const arrAp = findAirportDetailsByCode(destIata);
            const duration = calculateFlightDuration(
              currentLeg.departTime,
              currentLeg.arriveTime,
              origIata,
              destIata
            );
            const updates: Partial<FlightLeg> = {
              ...(dateLabel ? { dateLabel } : {}),
              flightNo: parsed.display,
              duration,
              departCountry: depAp?.country || route?.origin?.country_name || currentLeg.departCountry,
              departCode: origIata.toUpperCase(),
              departCity: depAp?.city || route?.origin?.municipality || origIata,
              departTerminal: depAp?.terminal || currentLeg.departTerminal || 'T1',
              arriveCountry: arrAp?.country || route?.destination?.country_name || currentLeg.arriveCountry,
              arriveCode: destIata.toUpperCase(),
              arriveCity: arrAp?.city || route?.destination?.municipality || destIata,
              arriveTerminal: arrAp?.terminal || currentLeg.arriveTerminal || 'T1',
              ...(airlineInfo
                ? {
                    perkLabel:
                      leg === 'outbound' ? airlineInfo.perkOutbound : airlineInfo.perkInbound,
                  }
                : {}),
            };
            return {
              matched: true,
              source: 'open_api',
              airlineLabel,
              updates,
              message: `✈️ 已從航空資料庫帶入 ${parsed.display} 航線 (${origIata} ➔ ${destIata})`,
            };
          }
        }
      } catch {
        // 忽略網路逾時，進入智慧推算後備
      }
    }
  }

  // 3. 離線或自訂航班號：自動格式化航班號、識別航空公司、同步來回日期與計算飛行時間
  const duration = calculateFlightDuration(
    currentLeg.departTime,
    currentLeg.arriveTime,
    currentLeg.departCode,
    currentLeg.arriveCode
  );
  const updates: Partial<FlightLeg> = {
    ...(dateLabel ? { dateLabel } : {}),
    flightNo: parsed.display,
    duration,
    ...(airlineInfo
      ? {
          perkLabel: leg === 'outbound' ? airlineInfo.perkOutbound : airlineInfo.perkInbound,
        }
      : {}),
  };

  return {
    matched: Boolean(airlineInfo),
    source: 'airline_inferred',
    airlineLabel,
    updates,
    message: airlineInfo
      ? `✈️ 已識別為 ${airlineLabel.split('·')[0].trim()} (${parsed.display}) 並同步日期與航程時間`
      : `✈️ 已更新航班編號為 ${parsed.display} 並重新計算飛行時間`,
  };
}
