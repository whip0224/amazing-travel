export interface DailyWeatherForecast {
  date: string; // YYYY-MM-DD (requested trip date)
  weatherCode: number;
  emoji: string;
  conditionText: string;
  tempMin: number;
  tempMax: number;
  precipProb?: number;
  sourceType: 'forecast' | 'historical_same_date' | 'past_observed';
  sourceLabel: string; // 例如：'即時預報' | '往年同期' | '歷史紀錄'
  cityName: string;
}

interface GeoCoords {
  name: string;
  latitude: number;
  longitude: number;
}

const GEO_CACHE_KEY = 'tabi_weather_geo_v2';
const WEATHER_CACHE_KEY = 'tabi_weather_daily_v2';
const FORECAST_TTL_MS = 2 * 60 * 60 * 1000; // 2 小時
const ARCHIVE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天

// 常用旅遊城市座標快查（秒回，且可避免中英文混打、旅遊描述詞或同名小鎮誤配）
const KNOWN_CITIES: Array<{ keywords: string[]; coords: GeoCoords }> = [
  { keywords: ['kyoto', '京都'], coords: { name: '京都', latitude: 35.0116, longitude: 135.7681 } },
  { keywords: ['osaka', '大阪'], coords: { name: '大阪', latitude: 34.6937, longitude: 135.5023 } },
  { keywords: ['tokyo', '東京'], coords: { name: '東京', latitude: 35.6762, longitude: 139.6503 } },
  { keywords: ['sapporo', 'hokkaido', '札幌', '北海道'], coords: { name: '札幌', latitude: 43.0618, longitude: 141.3545 } },
  { keywords: ['fukuoka', '福岡', '博多'], coords: { name: '福岡', latitude: 33.5902, longitude: 130.4017 } },
  { keywords: ['okinawa', 'naha', '沖繩', '那霸'], coords: { name: '那霸', latitude: 26.2124, longitude: 127.6809 } },
  { keywords: ['nagoya', '名古屋'], coords: { name: '名古屋', latitude: 35.1815, longitude: 136.9066 } },
  { keywords: ['kanazawa', '金澤'], coords: { name: '金澤', latitude: 36.5613, longitude: 136.6562 } },
  { keywords: ['kobe', '神戶'], coords: { name: '神戶', latitude: 34.6901, longitude: 135.1955 } },
  { keywords: ['nara', '奈良'], coords: { name: '奈良', latitude: 34.6851, longitude: 135.8048 } },
  { keywords: ['hiroshima', '廣島'], coords: { name: '廣島', latitude: 34.3853, longitude: 132.4553 } },
  { keywords: ['kumamoto', '熊本'], coords: { name: '熊本', latitude: 32.8032, longitude: 130.7079 } },
  { keywords: ['kagoshima', '鹿兒島'], coords: { name: '鹿兒島', latitude: 31.5966, longitude: 130.5571 } },
  { keywords: ['hakone', '箱根'], coords: { name: '箱根', latitude: 35.2324, longitude: 139.1069 } },
  { keywords: ['karuizawa', '輕井澤'], coords: { name: '輕井澤', latitude: 36.3489, longitude: 138.5967 } },
  { keywords: ['kawaguchiko', 'mt fuji', '河口湖', '富士山'], coords: { name: '河口湖', latitude: 35.4981, longitude: 138.7686 } },
  { keywords: ['zhuhai', '珠海', '橫琴', '拱北'], coords: { name: '珠海', latitude: 22.2769, longitude: 113.5678 } },
  { keywords: ['macau', 'macao', '澳門'], coords: { name: '澳門', latitude: 22.1987, longitude: 113.5439 } },
  { keywords: ['hong kong', '香港'], coords: { name: '香港', latitude: 22.3193, longitude: 114.1694 } },
  { keywords: ['shenzhen', '深圳'], coords: { name: '深圳', latitude: 22.5431, longitude: 114.0579 } },
  { keywords: ['guangzhou', 'canton', '廣州'], coords: { name: '廣州', latitude: 23.1291, longitude: 113.2644 } },
  { keywords: ['zhongshan', '中山'], coords: { name: '中山', latitude: 22.5176, longitude: 113.3928 } },
  { keywords: ['foshan', '佛山'], coords: { name: '佛山', latitude: 23.0215, longitude: 113.1214 } },
  { keywords: ['dongguan', '東莞'], coords: { name: '東莞', latitude: 23.0207, longitude: 113.7518 } },
  { keywords: ['shanghai', '上海'], coords: { name: '上海', latitude: 31.2304, longitude: 121.4737 } },
  { keywords: ['beijing', 'peking', '北京'], coords: { name: '北京', latitude: 39.9042, longitude: 116.4074 } },
  { keywords: ['chengdu', '成都'], coords: { name: '成都', latitude: 30.5728, longitude: 104.0668 } },
  { keywords: ['chongqing', '重慶'], coords: { name: '重慶', latitude: 29.563, longitude: 106.5516 } },
  { keywords: ['hangzhou', '杭州'], coords: { name: '杭州', latitude: 30.2741, longitude: 120.1551 } },
  { keywords: ['xiamen', '廈門'], coords: { name: '廈門', latitude: 24.4798, longitude: 118.0894 } },
  { keywords: ['changsha', '長沙'], coords: { name: '長沙', latitude: 28.2282, longitude: 112.9388 } },
  { keywords: ['new taipei', '新北'], coords: { name: '新北', latitude: 25.0169, longitude: 121.4628 } },
  { keywords: ['taipei', '台北', '臺北'], coords: { name: '台北', latitude: 25.033, longitude: 121.5654 } },
  { keywords: ['taoyuan', '桃園'], coords: { name: '桃園', latitude: 24.9936, longitude: 121.301 } },
  { keywords: ['taichung', '台中', '臺中'], coords: { name: '台中', latitude: 24.1477, longitude: 120.6736 } },
  { keywords: ['tainan', '台南', '臺南'], coords: { name: '台南', latitude: 22.9999, longitude: 120.2269 } },
  { keywords: ['kaohsiung', '高雄'], coords: { name: '高雄', latitude: 22.6273, longitude: 120.3014 } },
  { keywords: ['yilan', '宜蘭'], coords: { name: '宜蘭', latitude: 24.757, longitude: 121.753 } },
  { keywords: ['hualien', '花蓮'], coords: { name: '花蓮', latitude: 23.9872, longitude: 121.6016 } },
  { keywords: ['taitung', '台東', '臺東'], coords: { name: '台東', latitude: 22.7583, longitude: 121.1444 } },
  { keywords: ['seoul', '首爾'], coords: { name: '首爾', latitude: 37.5665, longitude: 126.978 } },
  { keywords: ['busan', '釜山'], coords: { name: '釜山', latitude: 35.1796, longitude: 129.0756 } },
  { keywords: ['jeju', '濟州'], coords: { name: '濟州', latitude: 33.4996, longitude: 126.5312 } },
  { keywords: ['bangkok', '曼谷'], coords: { name: '曼谷', latitude: 13.7563, longitude: 100.5018 } },
  { keywords: ['chiang mai', '清邁'], coords: { name: '清邁', latitude: 18.7883, longitude: 98.9853 } },
  { keywords: ['singapore', '新加坡'], coords: { name: '新加坡', latitude: 1.3521, longitude: 103.8198 } },
  { keywords: ['kuala lumpur', '吉隆坡'], coords: { name: '吉隆坡', latitude: 3.139, longitude: 101.6869 } },
  { keywords: ['ho chi minh', '胡志明'], coords: { name: '胡志明市', latitude: 10.8231, longitude: 106.6297 } },
  { keywords: ['hanoi', '河內'], coords: { name: '河內', latitude: 21.0285, longitude: 105.8542 } },
  { keywords: ['da nang', '峴港'], coords: { name: '峴港', latitude: 16.0544, longitude: 108.2022 } },
  { keywords: ['paris', '巴黎'], coords: { name: '巴黎', latitude: 48.8566, longitude: 2.3522 } },
  { keywords: ['london', '倫敦'], coords: { name: '倫敦', latitude: 51.5072, longitude: -0.1276 } },
];

export function interpretWmoCode(code: number): { emoji: string; text: string } {
  if (code === 0) return { emoji: '☀️', text: '晴朗' };
  if (code === 1 || code === 2) return { emoji: '🌤️', text: '晴時多雲' };
  if (code === 3) return { emoji: '☁️', text: '多雲陰天' };
  if (code === 45 || code === 48) return { emoji: '🌫️', text: '有霧' };
  if (code >= 51 && code <= 57) return { emoji: '🌦️', text: '微雨' };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { emoji: '🌧️', text: '有雨' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { emoji: '❄️', text: '降雪' };
  if (code >= 95) return { emoji: '⛈️', text: '雷雨' };
  return { emoji: '🌤️', text: '多雲時晴' };
}

function readCacheMap<T>(key: string): Record<string, { ts: number; data: T }> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeCacheEntry<T>(key: string, entryKey: string, data: T): void {
  try {
    const map = readCacheMap<T>(key);
    map[entryKey] = { ts: Date.now(), data };
    // 控制快取大小，保留最新 60 筆
    const keys = Object.keys(map);
    if (keys.length > 60) {
      keys
        .sort((a, b) => map[a].ts - map[b].ts)
        .slice(0, keys.length - 60)
        .forEach((k) => delete map[k]);
    }
    localStorage.setItem(key, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

function extractCityQuery(destinationTitle: string): string {
  const cleaned = destinationTitle
    .split(/[,，/|｜·(（]/)[0]
    .replace(/\s*(自由行|親子遊|深度遊|慢旅|小旅行|旅遊|旅行|攻略|行程|\d+天\d+夜|\d+日遊|\d+日)$/i, '')
    .replace(/\s+(中國大陸|中國|香港|澳門|日本|台灣|臺灣|韓國|泰國|越南|馬來西亞|新加坡|China|Japan|Taiwan|Korea|Thailand|Vietnam|Malaysia|Singapore)$/i, '')
    .trim();
  return cleaned.length > 2 && cleaned.endsWith('市') ? cleaned.slice(0, -1) : cleaned;
}

function scoreGeoCandidate(candidate: any): number {
  const pop = typeof candidate?.population === 'number' ? candidate.population : 0;
  const fc = String(candidate?.feature_code || '');
  const adminBonus =
    fc === 'PPLC' ? 5_000_000 : fc === 'PPLA' ? 2_000_000 : fc === 'PPLA2' ? 1_000_000 : fc === 'PPLA3' ? 300_000 : 0;
  return pop + adminBonus;
}

export async function geocodeDestination(
  destinationTitle: string,
  signal?: AbortSignal
): Promise<GeoCoords | null> {
  const raw = destinationTitle.trim();
  if (!raw) return null;

  const lower = raw.toLowerCase();
  for (const item of KNOWN_CITIES) {
    if (item.keywords.some((kw) => lower.includes(kw))) {
      return item.coords;
    }
  }

  const cleanCity = extractCityQuery(raw) || raw;
  const cacheKey = cleanCity.toLowerCase();
  const cachedMap = readCacheMap<GeoCoords>(GEO_CACHE_KEY);
  const cached = cachedMap[cacheKey];
  if (cached && Date.now() - cached.ts < ARCHIVE_TTL_MS) {
    return cached.data;
  }

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      cleanCity
    )}&count=5&language=zh&format=json`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const json: any = await res.json();
    const candidates: any[] = Array.isArray(json?.results) ? json.results : [];
    const valid = candidates.filter(
      (r) => typeof r?.latitude === 'number' && typeof r?.longitude === 'number'
    );
    if (valid.length === 0) {
      return null;
    }
    const best = valid.sort((a, b) => scoreGeoCandidate(b) - scoreGeoCandidate(a))[0];
    const coords: GeoCoords = {
      name: best.name || cleanCity,
      latitude: best.latitude,
      longitude: best.longitude,
    };
    writeCacheEntry(GEO_CACHE_KEY, cacheKey, coords);
    return coords;
  } catch {
    return null;
  }
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIsoParts(iso: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || '').trim());
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function diffDaysFromToday(iso: string): number {
  const parts = parseIsoParts(iso);
  if (!parts) return 999;
  const target = new Date(parts.y, parts.m - 1, parts.d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function mapToMostRecentPastSameDate(iso: string): string {
  const parts = parseIsoParts(iso);
  if (!parts) return iso;
  const now = new Date();
  const safePastCutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 5);
  let y = now.getFullYear();
  // 處理 2/29 閏年
  const day = parts.m === 2 && parts.d === 29 ? 28 : parts.d;
  let candidate = new Date(y, parts.m - 1, day);
  if (candidate > safePastCutoff) {
    y -= 1;
    candidate = new Date(y, parts.m - 1, day);
  }
  return toIsoDate(candidate);
}

/**
 * 根據「目的地」與「日期陣列 (YYYY-MM-DD[])」透過 Open-Meteo 天氣 API 取得每日預測或同期氣候
 */
export async function fetchWeatherForDates(
  destinationTitle: string,
  datesIso: string[],
  signal?: AbortSignal
): Promise<Record<string, DailyWeatherForecast>> {
  const uniqueDates = Array.from(
    new Set(datesIso.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))
  ).sort();

  if (!destinationTitle.trim() || uniqueDates.length === 0) {
    return {};
  }

  const coords = await geocodeDestination(destinationTitle, signal);
  if (!coords) return {};

  const result: Record<string, DailyWeatherForecast> = {};
  const weatherCache = readCacheMap<DailyWeatherForecast>(WEATHER_CACHE_KEY);
  const coordKey = `${coords.latitude.toFixed(2)},${coords.longitude.toFixed(2)}`;

  const needForecastDates: string[] = [];
  const needArchivePairs: Array<{ requestedIso: string; queryIso: string; isPast: boolean }> = [];

  for (const iso of uniqueDates) {
    const cacheId = `${coordKey}:${iso}`;
    const diff = diffDaysFromToday(iso);
    const cached = weatherCache[cacheId];
    const ttl = diff >= -5 && diff <= 15 ? FORECAST_TTL_MS : ARCHIVE_TTL_MS;
    if (cached && Date.now() - cached.ts < ttl) {
      result[iso] = cached.data;
      continue;
    }

    if (diff >= -5 && diff <= 15) {
      needForecastDates.push(iso);
    } else if (diff < -5) {
      needArchivePairs.push({ requestedIso: iso, queryIso: iso, isPast: true });
    } else {
      needArchivePairs.push({
        requestedIso: iso,
        queryIso: mapToMostRecentPastSameDate(iso),
        isPast: false,
      });
    }
  }

  // 1. 16 天內：即時 Open-Meteo Forecast API
  if (needForecastDates.length > 0) {
    const startDate = needForecastDates[0];
    const endDate = needForecastDates[needForecastDates.length - 1];
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&start_date=${startDate}&end_date=${endDate}`;
      const res = await fetch(url, { signal });
      if (res.ok) {
        const json: any = await res.json();
        const times: string[] = json?.daily?.time || [];
        const codes: number[] = json?.daily?.weather_code || [];
        const maxes: number[] = json?.daily?.temperature_2m_max || [];
        const mins: number[] = json?.daily?.temperature_2m_min || [];
        const precips: number[] = json?.daily?.precipitation_probability_max || [];

        times.forEach((t, idx) => {
          if (!needForecastDates.includes(t)) return;
          const code = Number(codes[idx] ?? 1);
          const info = interpretWmoCode(code);
          const entry: DailyWeatherForecast = {
            date: t,
            weatherCode: code,
            emoji: info.emoji,
            conditionText: info.text,
            tempMin: Math.round(Number(mins[idx] ?? 15)),
            tempMax: Math.round(Number(maxes[idx] ?? 22)),
            precipProb: typeof precips[idx] === 'number' ? Math.round(precips[idx]) : undefined,
            sourceType: 'forecast',
            sourceLabel: '即時預報',
            cityName: coords.name,
          };
          result[t] = entry;
          writeCacheEntry(WEATHER_CACHE_KEY, `${coordKey}:${t}`, entry);
        });
      }
    } catch {
      // ignore fetch error (offline or aborted)
    }
  }

  // 2. 超過 16 天或過去日期：Open-Meteo Archive API（取得往年同期實測氣候）
  if (needArchivePairs.length > 0) {
    // 依日期分組查詢範圍（通常連假是連續日期，一次請求就全部取得）
    const sortedQueryIsos = Array.from(new Set(needArchivePairs.map((p) => p.queryIso))).sort();
    // 若跨年（例如 12/30 ~ 01/03），分開連續區間最多兩次請求即可
    const ranges: Array<{ start: string; end: string }> = [];
    for (const qIso of sortedQueryIsos) {
      const last = ranges[ranges.length - 1];
      if (!last) {
        ranges.push({ start: qIso, end: qIso });
      } else {
        const dPrev = new Date(`${last.end}T00:00:00`).getTime();
        const dCurr = new Date(`${qIso}T00:00:00`).getTime();
        if (dCurr - dPrev <= 7 * 86400000) {
          last.end = qIso;
        } else {
          ranges.push({ start: qIso, end: qIso });
        }
      }
    }

    const archiveByQueryIso: Record<string, { code: number; min: number; max: number }> = {};
    for (const range of ranges) {
      try {
        const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${coords.latitude}&longitude=${coords.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&start_date=${range.start}&end_date=${range.end}`;
        const res = await fetch(url, { signal });
        if (res.ok) {
          const json: any = await res.json();
          const times: string[] = json?.daily?.time || [];
          const codes: number[] = json?.daily?.weather_code || [];
          const maxes: number[] = json?.daily?.temperature_2m_max || [];
          const mins: number[] = json?.daily?.temperature_2m_min || [];
          times.forEach((t, idx) => {
            if (typeof maxes[idx] === 'number' && typeof mins[idx] === 'number') {
              archiveByQueryIso[t] = {
                code: Number(codes[idx] ?? 1),
                min: Math.round(mins[idx]),
                max: Math.round(maxes[idx]),
              };
            }
          });
        }
      } catch {
        // ignore fetch error
      }
    }

    for (const pair of needArchivePairs) {
      const found = archiveByQueryIso[pair.queryIso];
      if (!found) continue;
      const info = interpretWmoCode(found.code);
      const entry: DailyWeatherForecast = {
        date: pair.requestedIso,
        weatherCode: found.code,
        emoji: info.emoji,
        conditionText: info.text,
        tempMin: found.min,
        tempMax: found.max,
        sourceType: pair.isPast ? 'past_observed' : 'historical_same_date',
        sourceLabel: pair.isPast ? '歷史天氣' : '往年同期',
        cityName: coords.name,
      };
      result[pair.requestedIso] = entry;
      writeCacheEntry(WEATHER_CACHE_KEY, `${coordKey}:${pair.requestedIso}`, entry);
    }
  }

  return result;
}
