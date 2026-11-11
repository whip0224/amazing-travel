import { GoogleGenAI, Type } from '@google/genai';
import type { SavedDestination } from '../types/tabi';

export interface TripDayOption {
  index: number;
  iso: string;
  label: string;
  dateDisp: string;
  zhDisp: string;
}

export type OptimizeMode = 'fill_and_reorder' | 'rebalance_all';

export interface OptimizedStopSuggestion {
  destId: string;
  destName: string;
  address?: string;
  dayIndex: number;
  dateIso: string;
  dayLabel: string;
  start: string;
  end: string;
  durationLabel: string;
  transport: string;
  cost: string;
  reason: string;
  wasPreviouslyUnscheduled: boolean;
  distanceFromPrevKm?: number;
}

export interface AIOptimizationResult {
  summaryTitle: string;
  summaryPoints: string[];
  estimatedSavedMinutes: number;
  unscheduledAssignedCount: number;
  reorderedCount: number;
  closedDayAvoidedCount: number;
  usedModel: 'gemini' | 'smart-geo-engine';
  suggestionsByDay: Record<number, OptimizedStopSuggestion[]>;
  allSuggestions: OptimizedStopSuggestion[];
}

// 計算兩組經緯度之間的直線距離 (Haversine 公式，單位 km)
function calcDistanceKm(
  a?: { lat: number; lng: number },
  b?: { lat: number; lng: number }
): number | null {
  if (!a || !b) return null;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return Math.round(R * c * 10) / 10;
}

type TimeSlotBucket = 'morning' | 'lunch' | 'afternoon' | 'evening';

// 根據名稱與地址判斷最適合造訪的時段類別
function detectBestTimeSlotBucket(dest: SavedDestination): {
  bucket: TimeSlotBucket;
  durationMins: number;
  defaultCost: string;
  categoryReason: string;
} {
  const text = `${dest.customName || dest.name} ${dest.formattedAddress || ''}`.toLowerCase();

  // 1. 正餐 / 市場 / 熟食名店 -> 優先排入午餐或晚餐時段
  if (
    /脆皮豬|豬腳|豬排|蓋飯|拉麵|市場|nishiki|market|食堂|定食|壽司|燒肉|牛排|飯|麵|便當|小籠包/.test(
      text
    )
  ) {
    return {
      bucket: 'lunch',
      durationMins: 75,
      defaultCost: '1800',
      categoryReason: '🍜 人氣美食品嚐時段，避開尖峰排隊人潮',
    };
  }

  // 2. 傍晚 / 夜間老街 / 河畔料理
  if (/祇園|gion|花見小路|hanamikoji|先斗町|鴨川|納涼床|夜市|夜景|居酒屋|展望台|晚/.test(text)) {
    return {
      bucket: 'evening',
      durationMins: 105,
      defaultCost: '3200',
      categoryReason: '🏮 傍晚至夜間黃金時段，燈籠街景與晚間氣氛最佳',
    };
  }

  // 3. 下午茶 / 抹茶 / 甜點 / 逛街
  if (/抹茶|中村藤吉|甜點|芭菲|咖啡|茶屋|表參道|百貨|商圈|伴手禮|カフェ/.test(text)) {
    return {
      bucket: 'afternoon',
      durationMins: 90,
      defaultCost: '1500',
      categoryReason: '🍵 午後悠閒甜點與散步時段，銜接上午行程補充體力',
    };
  }

  // 4. 神社 / 寺院 / 竹林 / 自然名勝 -> 優先排入早晨或上午
  if (/寺|神社|大社|稻荷|嵐山|竹林|渡月橋|公園|宮|城|山|院|kiyomizu/.test(text)) {
    return {
      bucket: 'morning',
      durationMins: 105,
      defaultCost: '1000',
      categoryReason: '⛩️ 上午光線柔和且人潮較少，最適合參拜與拍照散策',
    };
  }

  return {
    bucket: 'afternoon',
    durationMins: 90,
    defaultCost: '1200',
    categoryReason: '🗺️ 核心順路探索時段，動線銜接最順暢',
  };
}

// 檢查該景點在指定日期 (YYYY-MM-DD) 是否公休
function isClosedOnDate(dest: SavedDestination, dateIso: string): boolean {
  if (!dest.weekdayDescriptions || dest.weekdayDescriptions.length === 0) return false;
  const dt = new Date(dateIso);
  if (isNaN(dt.getTime())) return false;
  const dayNames = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const targetDayName = dayNames[dt.getDay()];
  const line = dest.weekdayDescriptions.find((d) => d.includes(targetDayName));
  if (!line) return false;
  return line.includes('休息') || line.toLowerCase().includes('closed');
}

// 將分鐘數轉為 HH:MM
function minsToTimeStr(totalMins: number): string {
  const clamped = Math.max(8 * 60, Math.min(22 * 60 + 30, Math.round(totalMins / 15) * 15));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function timeStrToMins(timeStr: string): number {
  const [h, m] = (timeStr || '10:00').split(':').map(Number);
  if (isNaN(h)) return 600;
  return h * 60 + (isNaN(m) ? 0 : m);
}

// 提取地址中的行政區關鍵字，協助同區群集同日安排
function extractDistrictKey(dest: SavedDestination): string {
  const addr = `${dest.formattedAddress || ''} ${dest.name}`;
  const match = addr.match(
    /(大同區|中山區|中正區|大安區|信義區|萬華區|中京區|東山區|伏見區|右京區|左京區|下京區|宇治市|嵐山|祇園)/
  );
  return match ? match[1] : 'general';
}

// 智慧地理與時段演算法引擎 (支援離線與即時分析)
export function runSmartGeoTimeOptimization(
  destinations: SavedDestination[],
  tripDays: TripDayOption[],
  mode: OptimizeMode
): AIOptimizationResult {
  const days =
    tripDays.length > 0
      ? tripDays
      : [
          {
            index: 0,
            iso: '2027-04-12',
            label: 'Day 1',
            dateDisp: 'Mon, Apr 12',
            zhDisp: '4月12日 (週一)',
          },
        ];

  const dayBuckets: Record<number, SavedDestination[]> = {};
  days.forEach((d) => {
    dayBuckets[d.index] = [];
  });

  let unscheduledAssignedCount = 0;
  let closedDayAvoidedCount = 0;

  const scheduledList: SavedDestination[] = [];
  const unscheduledList: SavedDestination[] = [];

  destinations.forEach((dest) => {
    if (mode === 'fill_and_reorder' && dest.scheduled) {
      const matchedDay = days.find((d) => d.iso === dest.scheduled?.date);
      const dayIdx =
        matchedDay !== undefined
          ? matchedDay.index
          : Math.min(days.length - 1, Math.max(0, dest.scheduled.dayIndex || 0));
      dayBuckets[dayIdx].push(dest);
      scheduledList.push(dest);
    } else {
      unscheduledList.push(dest);
    }
  });

  // 將未排程景點依地理位置 (經緯度 / 行政區) 排序，讓相近景點優先排在同一天
  const sortedUnscheduled = [...unscheduledList].sort((a, b) => {
    const distA = extractDistrictKey(a);
    const distB = extractDistrictKey(b);
    if (distA !== distB) return distA.localeCompare(distB);
    if (a.location && b.location) {
      return a.location.lat - b.location.lat || a.location.lng - b.location.lng;
    }
    return 0;
  });

  // 分配未排程景點至最適合的日期 (優先選擇：1. 當日未公休 2. 已有同行政區/鄰近景點 3. 當日行程數較少)
  sortedUnscheduled.forEach((dest) => {
    unscheduledAssignedCount++;
    const destDistrict = extractDistrictKey(dest);

    let bestDayIdx = 0;
    let bestScore = -999999;

    days.forEach((day) => {
      const currentItems = dayBuckets[day.index] || [];
      let score = 0;

      // 景點數量負載平衡 (每多 1 個景點扣分，避免單日塞太滿)
      score -= currentItems.length * 35;

      // 檢查是否公休
      const closed = isClosedOnDate(dest, day.iso);
      if (closed) {
        score -= 500;
      }

      // 若當日已有同區或距離 < 3km 的景點，大幅加分 (同區順遊)
      currentItems.forEach((existing) => {
        if (extractDistrictKey(existing) === destDistrict && destDistrict !== 'general') {
          score += 28;
        }
        const distKm = calcDistanceKm(dest.location, existing.location);
        if (distKm !== null && distKm <= 2.5) {
          score += 32;
        }
      });

      if (score > bestScore) {
        bestScore = score;
        bestDayIdx = day.index;
      }
    });

    // 若原本第一順位的日期公休，但幫它避開了公休日，紀錄次數
    if (
      days.some((d) => isClosedOnDate(dest, d.iso)) &&
      !isClosedOnDate(dest, days[bestDayIdx].iso)
    ) {
      closedDayAvoidedCount++;
    }

    dayBuckets[bestDayIdx].push(dest);
  });

  // 對每一天的景點進行「時段分組 + 最近鄰居順路排序 (Nearest-Neighbor Route)」並分配合理時間段
  const suggestionsByDay: Record<number, OptimizedStopSuggestion[]> = {};
  const allSuggestions: OptimizedStopSuggestion[] = [];
  let reorderedCount = 0;
  let estimatedSavedMinutes = 0;

  const bucketPriority: Record<TimeSlotBucket, number> = {
    morning: 1,
    lunch: 2,
    afternoon: 3,
    evening: 4,
  };

  days.forEach((day) => {
    const rawItems = dayBuckets[day.index] || [];
    if (rawItems.length === 0) {
      suggestionsByDay[day.index] = [];
      return;
    }

    // 先依最佳造訪時段 (早 -> 午 -> 下午 -> 晚) 與地理距離做順路排序
    const annotated = rawItems.map((item) => ({
      item,
      meta: detectBestTimeSlotBucket(item),
    }));

    annotated.sort((a, b) => {
      const pDiff = bucketPriority[a.meta.bucket] - bucketPriority[b.meta.bucket];
      if (pDiff !== 0) return pDiff;
      if (a.item.location && b.item.location) {
        return a.item.location.lat - b.item.location.lat;
      }
      return 0;
    });

    // 在同一個時段內利用最近鄰居法 (Nearest-Neighbor) 減少折返移動
    const ordered: typeof annotated = [];
    const pool = [...annotated];
    while (pool.length > 0) {
      if (ordered.length === 0) {
        ordered.push(pool.shift()!);
      } else {
        const prev = ordered[ordered.length - 1];
        // 在最優先的時段候選中挑距離最近的一站
        const nextBucket = pool[0].meta.bucket;
        let bestIdx = 0;
        let minDist = Infinity;
        pool.forEach((cand, idx) => {
          if (cand.meta.bucket !== nextBucket) return;
          const d = calcDistanceKm(prev.item.location, cand.item.location);
          if (d !== null && d < minDist) {
            minDist = d;
            bestIdx = idx;
          }
        });
        ordered.push(pool.splice(bestIdx, 1)[0]);
      }
    }

    // 分配不重疊且符合真實旅遊節奏的時間區間
    let cursorMins = 9 * 60 + 30; // 預設 09:30 出發
    const daySuggestions: OptimizedStopSuggestion[] = [];

    ordered.forEach((entry, idx) => {
      const { item, meta } = entry;
      const wasUnscheduled = !item.scheduled;

      // 根據景點性質調整理想起始時間基準
      if (idx === 0 && meta.bucket === 'lunch' && ordered.length <= 2) {
        cursorMins = Math.max(cursorMins, 11 * 60 + 30);
      } else if (meta.bucket === 'lunch' && cursorMins < 11 * 60 + 15) {
        cursorMins = 11 * 60 + 45;
      } else if (meta.bucket === 'afternoon' && cursorMins < 13 * 60 + 30) {
        cursorMins = 14 * 60;
      } else if (meta.bucket === 'evening' && cursorMins < 16 * 60 + 30) {
        cursorMins = 17 * 60;
      }

      const startStr = minsToTimeStr(cursorMins);
      const endMins = cursorMins + meta.durationMins;
      const endStr = minsToTimeStr(endMins);

      // 計算與上一站的距離與建議交通方式
      const prevItem = idx > 0 ? ordered[idx - 1].item : undefined;
      const distKm = prevItem ? calcDistanceKm(prevItem.location, item.location) : null;

      let transport = item.scheduled?.transport || '地鐵';
      let routeNote = '';
      if (distKm !== null) {
        if (distKm <= 0.9) {
          transport = '步行';
          routeNote = `距離上一站僅 ${distKm} km（步行約 ${Math.max(4, Math.round(distKm * 12))} 分鐘）`;
          estimatedSavedMinutes += 12;
        } else if (distKm <= 3.2) {
          transport = '巴士';
          routeNote = `與上一站相距 ${distKm} km，順路直達不繞路`;
          estimatedSavedMinutes += 15;
        } else {
          transport = '地鐵';
          routeNote = `跨區移動約 ${distKm} km，建議搭乘地鐵最省時`;
          estimatedSavedMinutes += 10;
        }
      } else {
        const distKey = extractDistrictKey(item);
        if (distKey !== 'general') {
          routeNote = `集中於「${distKey}」順遊動線`;
          estimatedSavedMinutes += 10;
        }
      }

      const closedCheck = !isClosedOnDate(item, day.iso) && item.weekdayDescriptions?.length;
      const openReason = closedCheck ? ' · 已確認當日正常營業' : '';

      const reasonParts = [
        meta.categoryReason,
        routeNote ? ` · ${routeNote}` : '',
        openReason,
      ].join('');

      if (
        item.scheduled &&
        (item.scheduled.start !== startStr || item.scheduled.date !== day.iso)
      ) {
        reorderedCount++;
      }

      const hours = Math.round((meta.durationMins / 60) * 10) / 10;
      daySuggestions.push({
        destId: item.id,
        destName: item.customName || item.name,
        address: item.formattedAddress,
        dayIndex: day.index,
        dateIso: day.iso,
        dayLabel: `${day.label} (${day.zhDisp})`,
        start: startStr,
        end: endStr,
        durationLabel: `${hours} hours`,
        transport,
        cost: item.scheduled?.cost || meta.defaultCost,
        reason: reasonParts,
        wasPreviouslyUnscheduled: wasUnscheduled,
        distanceFromPrevKm: distKm ?? undefined,
      });

      // 下一站預留 30 分鐘交通與緩衝時間
      cursorMins = endMins + 30;
    });

    suggestionsByDay[day.index] = daySuggestions;
    allSuggestions.push(...daySuggestions);
  });

  const summaryPoints: string[] = [
    `📍 共分析 ${destinations.length} 個目的地，將相鄰行政區與經緯度景點自動群集同日順遊`,
    unscheduledAssignedCount > 0
      ? `⏰ 自動為 ${unscheduledAssignedCount} 個未排程景點配置最佳日期與黃金時段（早參拜、午美食、晚夜景）`
      : `✨ 已針對現有排程完成黃金時段與最近鄰居動線微調`,
  ];
  if (closedDayAvoidedCount > 0) {
    summaryPoints.push(`🛡️ 根據營業時間（文字.txt 資料）自動避開了 ${closedDayAvoidedCount} 個店家公休日`);
  }

  return {
    summaryTitle: '✨ AI 智慧順路動線 & 黃金時段優化完成',
    summaryPoints,
    estimatedSavedMinutes: Math.max(25, estimatedSavedMinutes),
    unscheduledAssignedCount,
    reorderedCount,
    closedDayAvoidedCount,
    usedModel: 'smart-geo-engine',
    suggestionsByDay,
    allSuggestions,
  };
}

// 結合 Gemini API (若環境有提供 API Key 且連線中) 與本地智慧地理引擎的雙核心優化函式
export async function optimizeItineraryWithAI(
  destinations: SavedDestination[],
  tripDays: TripDayOption[],
  mode: OptimizeMode
): Promise<AIOptimizationResult> {
  // 先執行本地高精度地理與時段演算法作為基準結果 (同時確保毫秒級保底與離線可用)
  const baseResult = runSmartGeoTimeOptimization(destinations, tripDays, mode);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !navigator.onLine || destinations.length === 0) {
    return baseResult;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const placesPayload = destinations.map((d) => ({
      id: d.id,
      name: d.customName || d.name,
      address: d.formattedAddress || '',
      lat: d.location?.lat,
      lng: d.location?.lng,
      weekdayDescriptions: d.weekdayDescriptions || [],
      currentScheduled: mode === 'fill_and_reorder' ? d.scheduled : null,
    }));

    const daysPayload = tripDays.map((d) => ({
      dayIndex: d.index,
      iso: d.iso,
      label: d.label,
      zhDisp: d.zhDisp,
    }));

    const prompt = `你是一位專業的日本與亞洲旅遊動線規劃師。請分析以下「目的地清單」與「可用旅行日期」，為使用者規劃最順路（減少折返交通）、避開店家公休日、且符合景點性質（上午神社寺院、中午市場/正餐美食、下午甜點散策、傍晚夜景老街）的最佳訪問順序與建議時間段。
模式：${
      mode === 'fill_and_reorder'
        ? '保留已指定日期的景點在原日期，並為未排程景點分配最佳日期與時間，同時優化每日訪問順序與時間段'
        : '全行程重新最佳化分配至各天'
    }。
請確保每個輸入的景點 id 都有被安排，且同一天的時間段不重疊（格式 HH:MM，24小時制）。

可用日期：${JSON.stringify(daysPayload)}
目的地清單：${JSON.stringify(placesPayload)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summaryPoints: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            estimatedSavedMinutes: { type: Type.INTEGER },
            stops: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  destId: { type: Type.STRING },
                  dayIndex: { type: Type.INTEGER },
                  start: { type: Type.STRING },
                  end: { type: Type.STRING },
                  transport: { type: Type.STRING },
                  cost: { type: Type.STRING },
                  reason: { type: Type.STRING },
                },
                required: ['destId', 'dayIndex', 'start', 'end', 'transport', 'cost', 'reason'],
              },
            },
          },
          required: ['summaryPoints', 'estimatedSavedMinutes', 'stops'],
        },
      },
    });

    if (!response.text) return baseResult;
    const parsed = JSON.parse(response.text);
    if (!Array.isArray(parsed.stops) || parsed.stops.length === 0) {
      return baseResult;
    }

    const suggestionsByDay: Record<number, OptimizedStopSuggestion[]> = {};
    tripDays.forEach((d) => {
      suggestionsByDay[d.index] = [];
    });
    const allSuggestions: OptimizedStopSuggestion[] = [];

    parsed.stops.forEach((s: any) => {
      const dest = destinations.find((d) => d.id === s.destId);
      if (!dest) return;
      const safeDayIdx = Math.min(tripDays.length - 1, Math.max(0, Number(s.dayIndex) || 0));
      const dayObj = tripDays[safeDayIdx] || tripDays[0];
      const durMins = Math.max(30, timeStrToMins(s.end) - timeStrToMins(s.start));
      const hours = Math.round((durMins / 60) * 10) / 10;

      const itemSuggestion: OptimizedStopSuggestion = {
        destId: dest.id,
        destName: dest.customName || dest.name,
        address: dest.formattedAddress,
        dayIndex: safeDayIdx,
        dateIso: dayObj.iso,
        dayLabel: `${dayObj.label} (${dayObj.zhDisp})`,
        start: s.start || '10:00',
        end: s.end || '11:30',
        durationLabel: `${hours} hours`,
        transport: s.transport || '地鐵',
        cost: String(s.cost || '1500').replace(/[^0-9]/g, '') || '1500',
        reason: s.reason || '✨ AI 順路動線與最佳時段推薦',
        wasPreviouslyUnscheduled: !dest.scheduled,
      };
      suggestionsByDay[safeDayIdx].push(itemSuggestion);
      allSuggestions.push(itemSuggestion);
    });

    // 按時間排序每日建議
    Object.keys(suggestionsByDay).forEach((k) => {
      const idx = Number(k);
      suggestionsByDay[idx].sort((a, b) => a.start.localeCompare(b.start));
    });

    return {
      ...baseResult,
      summaryTitle: '🤖 Gemini AI 智慧動線 & 黃金時段優化建議',
      summaryPoints:
        Array.isArray(parsed.summaryPoints) && parsed.summaryPoints.length > 0
          ? parsed.summaryPoints
          : baseResult.summaryPoints,
      estimatedSavedMinutes: Number(parsed.estimatedSavedMinutes) || baseResult.estimatedSavedMinutes,
      usedModel: 'gemini',
      suggestionsByDay,
      allSuggestions,
    };
  } catch {
    return baseResult;
  }
}
