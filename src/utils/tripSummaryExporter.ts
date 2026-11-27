import type {
  ExpenseCategoryKey,
  PlanActivity,
  StickerItem,
  TabiState,
} from '../types/tabi';
import type { DailyWeatherForecast } from './weatherService';
import type { JournalSummaryAIResult } from './geminiClient';
import {
  TRANSPORT_MODE_META,
  getLegTransportMode,
  getTripTransportMode,
} from './landTransportPresets';
import { getStayNights, normalizeStaysList } from './stayHelpers';

export type SummaryTheme = 'mint' | 'suitcase';

export interface SummaryDayItem {
  index: number;
  iso: string;
  label: string;
  dateDisp: string;
  zhDisp: string;
}

export interface SummarySectionOptions {
  includeFlights: boolean;
  includeStay: boolean;
  includeItinerary: boolean;
  includeBudgetOverview: boolean;
  includeExpenseDetails: boolean;
}

export interface SummaryGeneratorInput {
  state: TabiState;
  tripDays: SummaryDayItem[];
  weatherByDate: Record<string, DailyWeatherForecast>;
  convertAmount: (amount: number, fromCode: string, toCode: string) => number;
  options: SummarySectionOptions;
  theme?: SummaryTheme;
  stickers?: StickerItem[];
  aiSummary?: JournalSummaryAIResult | null;
  useAiCopy?: boolean;
  activityStickerMap?: Record<string, string>;
  dayStickerMap?: Record<number, string>;
  heroStickerId?: string;
}

export const SUITCASE_DAY_COLORS = [
  '#E37868',
  '#4F9B96',
  '#D99B38',
  '#6C9A6E',
  '#B07C95',
];

const CATEGORY_META: Record<
  ExpenseCategoryKey,
  { label: string; emoji: string; color: string; suitcaseColor: string; bg: string }
> = {
  shopping: {
    label: '購物 Shopping',
    emoji: '🛍️',
    color: '#DF6437',
    suitcaseColor: '#E37868',
    bg: '#FCE8DF',
  },
  dining: {
    label: '餐飲 Dining',
    emoji: '🍜',
    color: '#1A5D42',
    suitcaseColor: '#4F9B96',
    bg: '#DFF3E9',
  },
  transport: {
    label: '交通 Transport',
    emoji: '🚆',
    color: '#2563EB',
    suitcaseColor: '#5B7C99',
    bg: '#E3ECFD',
  },
  gifts: {
    label: '伴手禮 Gifts',
    emoji: '🎁',
    color: '#D97706',
    suitcaseColor: '#D99B38',
    bg: '#FEF3C7',
  },
};

function escapeHtml(text: string | undefined | null): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(amount: number, currency: string): string {
  const noDecimal = currency === 'JPY' || currency === 'KRW' || currency === 'TWD';
  const rounded = noDecimal ? Math.round(amount) : Number(amount.toFixed(2));
  return `${rounded.toLocaleString(undefined, {
    minimumFractionDigits: noDecimal ? 0 : 2,
    maximumFractionDigits: noDecimal ? 0 : 2,
  })} ${currency}`;
}

// 嘗試把本地或可讀取的圖片轉為壓縮 Base64 Data URL，確保匯出單檔 HTML 可 100% 離線看圖
export async function inlineImageToDataUrl(
  url: string | undefined,
  maxDim = 900
): Promise<string> {
  const clean = (url || '').trim();
  if (!clean) return '';
  if (clean.startsWith('data:image/')) return clean;

  const tryCanvasConvert = (imgEl: HTMLImageElement, preserveAlpha: boolean): string => {
    const w = imgEl.naturalWidth || imgEl.width;
    const h = imgEl.naturalHeight || imgEl.height;
    if (!w || !h) return '';
    let targetW = w;
    let targetH = h;
    if (w > maxDim || h > maxDim) {
      if (w >= h) {
        targetW = maxDim;
        targetH = Math.round((h * maxDim) / w);
      } else {
        targetH = maxDim;
        targetW = Math.round((w * maxDim) / h);
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.clearRect(0, 0, targetW, targetH);
    ctx.drawImage(imgEl, 0, 0, targetW, targetH);
    return preserveAlpha
      ? canvas.toDataURL('image/png')
      : canvas.toDataURL('image/jpeg', 0.82);
  };

  try {
    const resolvedUrl = clean.startsWith('/')
      ? `${window.location.origin}${clean}`
      : clean;
    const preserveAlpha = /\.(png|webp|svg)(\?|$)/i.test(clean);

    const img = await new Promise<HTMLImageElement | null>((resolve) => {
      const el = new Image();
      const timer = window.setTimeout(() => resolve(null), 3500);
      if (!resolvedUrl.startsWith(window.location.origin)) {
        el.crossOrigin = 'anonymous';
      }
      el.onload = () => {
        window.clearTimeout(timer);
        resolve(el);
      };
      el.onerror = () => {
        window.clearTimeout(timer);
        resolve(null);
      };
      el.src = resolvedUrl;
    });

    if (img) {
      try {
        const dataUrl = tryCanvasConvert(img, preserveAlpha);
        if (dataUrl) return dataUrl;
      } catch {
        // Cross-origin tainted canvas — fall back to original URL
      }
    }
  } catch {
    // ignore fetch/cors error
  }

  return clean;
}

export function resolveStickerByIdOrName(
  stickers: StickerItem[] | undefined,
  idOrName: string | undefined
): StickerItem | null {
  if (!stickers || stickers.length === 0 || !idOrName) return null;
  const target = idOrName.trim();
  if (!target) return null;
  return (
    stickers.find((s) => s.id === target) ||
    stickers.find((s) => s.name === target) ||
    stickers.find((s) => s.name.toLowerCase() === target.toLowerCase()) ||
    null
  );
}

function getHeroSticker(input: SummaryGeneratorInput): StickerItem | null {
  const id = input.heroStickerId || input.aiSummary?.heroStickerId;
  return resolveStickerByIdOrName(input.stickers, id);
}

function getDaySticker(dayIndex: number, input: SummaryGeneratorInput): StickerItem | null {
  const manualId = input.dayStickerMap?.[dayIndex];
  if (manualId) {
    return resolveStickerByIdOrName(input.stickers, manualId);
  }
  const aiDay = input.aiSummary?.daySummaries?.find((d) => d.dayIndex === dayIndex);
  return resolveStickerByIdOrName(input.stickers, aiDay?.dayStickerId);
}

function getActivitySticker(actId: string, input: SummaryGeneratorInput): StickerItem | null {
  const manualId = input.activityStickerMap?.[actId];
  if (manualId) {
    return resolveStickerByIdOrName(input.stickers, manualId);
  }
  const aiAct = input.aiSummary?.activitySuggestions?.find((a) => a.activityId === actId);
  if (!aiAct) return null;
  return (
    resolveStickerByIdOrName(input.stickers, aiAct.stickerId) ||
    resolveStickerByIdOrName(input.stickers, aiAct.stickerName)
  );
}

async function resolveAllSummaryPhotos(
  input: SummaryGeneratorInput
): Promise<Map<string, string>> {
  const urls = new Set<string>();
  const { state, options, stickers } = input;
  if (state.trip.heroPhotoUrl) urls.add(state.trip.heroPhotoUrl);
  if (options.includeStay) {
    normalizeStaysList(state).forEach((s) => {
      if (s.photoUrl) urls.add(s.photoUrl);
    });
  }
  if (options.includeItinerary) {
    state.activities.forEach((a) => {
      if (a.photoUrl) urls.add(a.photoUrl);
    });
  }
  if (options.includeExpenseDetails) {
    state.expenses.forEach((e) => {
      if (e.photoUrl) urls.add(e.photoUrl);
    });
  }
  if (stickers && stickers.length > 0) {
    stickers.forEach((s) => {
      if (s.imageUrl) urls.add(s.imageUrl);
    });
  }

  const entries = await Promise.all(
    Array.from(urls).map(async (u) => {
      const resolved = await inlineImageToDataUrl(u, 900);
      return [u, resolved || u] as const;
    })
  );

  return new Map<string, string>(entries);
}

export function computeExpenseMetrics(input: SummaryGeneratorInput) {
  const { state, convertAmount, theme = 'mint' } = input;
  const totalSpentJPY = state.expenses.reduce(
    (sum, item) => sum + (Number(item.amountJPY) || 0),
    0
  );
  const activityEstimateJPY = state.activities.reduce(
    (sum, act) => sum + (Number(act.cost) || 0),
    0
  );
  const remainingBudgetJPY = Math.max(0, state.totalBudgetJPY - totalSpentJPY);
  const spentPercent = Math.min(
    100,
    Math.round((totalSpentJPY / Math.max(1, state.totalBudgetJPY)) * 100)
  );
  const targetCurrency = state.currencyB || 'HKD';
  const totalSpentConverted = convertAmount(totalSpentJPY, 'JPY', targetCurrency);
  const totalBudgetConverted = convertAmount(state.totalBudgetJPY, 'JPY', targetCurrency);
  const remainingConverted = convertAmount(remainingBudgetJPY, 'JPY', targetCurrency);

  const byCategory: Record<ExpenseCategoryKey, number> = {
    shopping: 0,
    dining: 0,
    transport: 0,
    gifts: 0,
  };
  state.expenses.forEach((exp) => {
    if (byCategory[exp.category] !== undefined) {
      byCategory[exp.category] += Number(exp.amountJPY) || 0;
    }
  });

  const slices = (Object.keys(CATEGORY_META) as ExpenseCategoryKey[]).map((key) => {
    const amountJPY = byCategory[key];
    const percent = totalSpentJPY > 0 ? Math.round((amountJPY / totalSpentJPY) * 100) : 0;
    const meta = CATEGORY_META[key];
    return {
      key,
      ...meta,
      color: theme === 'suitcase' ? meta.suitcaseColor : meta.color,
      amountJPY,
      converted: convertAmount(amountJPY, 'JPY', targetCurrency),
      percent,
    };
  });

  return {
    totalSpentJPY,
    activityEstimateJPY,
    remainingBudgetJPY,
    spentPercent,
    targetCurrency,
    totalSpentConverted,
    totalBudgetConverted,
    remainingConverted,
    slices,
  };
}

function buildExpenseDonutSvg(
  slices: ReturnType<typeof computeExpenseMetrics>['slices'],
  totalSpentJPY: number,
  theme: SummaryTheme
): string {
  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const r = 56;
  const circumference = 2 * Math.PI * r;
  const trackColor = theme === 'suitcase' ? '#EFE2CA' : '#EEF5F1';
  const labelColor = theme === 'suitcase' ? '#6D543E' : '#547063';
  const valColor = theme === 'suitcase' ? '#2A1F17' : '#14241D';

  let offset = 0;
  const nonZero = slices.filter((s) => s.amountJPY > 0);
  const arcs =
    totalSpentJPY > 0 && nonZero.length > 0
      ? nonZero
          .map((slice) => {
            const frac = slice.amountJPY / totalSpentJPY;
            const dash = frac * circumference;
            const gap = circumference - dash;
            const circle = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${slice.color}" stroke-width="22" stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})" />`;
            offset += dash;
            return circle;
          })
          .join('')
      : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${trackColor}" stroke-width="22" />`;

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="display:block;flex-shrink:0;">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${trackColor}" stroke-width="22" />
    ${arcs}
    <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="11" font-weight="700" fill="${labelColor}">總支出</text>
    <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="13" font-weight="800" fill="${valColor}">¥${totalSpentJPY.toLocaleString()}</text>
  </svg>`;
}

export function groupActivitiesByDay(
  activities: PlanActivity[],
  tripDays: SummaryDayItem[]
) {
  return tripDays.map((day) => {
    const items = activities
      .filter((act) => act.dayIndex === day.index)
      .slice()
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    const dayCostJPY = items.reduce((s, a) => s + (Number(a.cost) || 0), 0);
    return { day, items, dayCostJPY };
  });
}

function buildPassportStampSvg(topText: string, centerCode: string, bottomText: string, color: string): string {
  const centerFontSize = centerCode.length > 4 ? '11.5' : centerCode.length === 4 ? '13.5' : '16';
  return `<svg width="86" height="86" viewBox="0 0 86 86" xmlns="http://www.w3.org/2000/svg" style="display:block;opacity:0.86;">
    <circle cx="43" cy="43" r="39" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="4 2" />
    <circle cx="43" cy="43" r="32" fill="none" stroke="${color}" stroke-width="1.2" />
    <text x="43" y="25" text-anchor="middle" font-size="8.5" font-weight="800" fill="${color}" letter-spacing="1">${escapeHtml(topText)}</text>
    <text x="43" y="48" text-anchor="middle" font-size="${centerFontSize}" font-weight="900" fill="${color}" letter-spacing="0.5">${escapeHtml(centerCode)}</text>
    <text x="43" y="65" text-anchor="middle" font-size="8" font-weight="800" fill="${color}" letter-spacing="0.8">${escapeHtml(bottomText)}</text>
  </svg>`;
}

async function generateSuitcaseSummaryHtml(
  input: SummaryGeneratorInput,
  photoMap: Map<string, string>
): Promise<string> {
  const { state, tripDays, weatherByDate, options, aiSummary, useAiCopy = true } = input;
  const metrics = computeExpenseMetrics(input);
  const groupedDays = groupActivitiesByDay(state.activities, tripDays);
  const heroSrc = photoMap.get(state.trip.heroPhotoUrl || '') || state.trip.heroPhotoUrl || '';
  const staysList = normalizeStaysList(state);
  const heroSticker = getHeroSticker(input);
  const heroStickerSrc = heroSticker
    ? photoMap.get(heroSticker.imageUrl) || heroSticker.imageUrl
    : '';
  const generatedAt = new Date().toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const aiIntroHtml =
    useAiCopy && aiSummary
      ? `<section class="ai-journal-note section-block">
          <div class="ai-note-body">
            <div class="ai-note-kicker">✨ AI 手札引言 · ${escapeHtml(aiSummary.journalTitle)}</div>
            <p class="ai-note-quote">${escapeHtml(aiSummary.introQuote)}</p>
            ${
              aiSummary.budgetHighlight
                ? `<div class="ai-note-budget">💡 ${escapeHtml(aiSummary.budgetHighlight)}</div>`
                : ''
            }
          </div>
          ${
            heroStickerSrc
              ? `<div class="ai-hero-sticker"><img src="${escapeHtml(heroStickerSrc)}" alt="${escapeHtml(heroSticker?.name || '貼紙')}" /><span>${escapeHtml(heroSticker?.name || '')}</span></div>`
              : ''
          }
        </section>`
      : heroStickerSrc
      ? `<section class="ai-journal-note section-block">
          <div class="ai-note-body">
            <div class="ai-note-kicker">🏷️ 本趟主打旅行貼紙</div>
            <p class="ai-note-quote">${escapeHtml(state.trip.subtitle || state.trip.destinationTitle)}</p>
          </div>
          <div class="ai-hero-sticker"><img src="${escapeHtml(heroStickerSrc)}" alt="${escapeHtml(heroSticker?.name || '貼紙')}" /><span>${escapeHtml(heroSticker?.name || '')}</span></div>
        </section>`
      : '';

  const tripMode = getTripTransportMode(state.outbound, state.inbound);
  const tripModeMeta = TRANSPORT_MODE_META[tripMode];

  const flightsHtml = options.includeFlights
    ? `<section class="kraft-panel section-block">
        <div class="kraft-head">
          <h2>${tripModeMeta.icon} ${escapeHtml(tripModeMeta.suitcaseHeading)}</h2>
          <span class="kraft-meta">${escapeHtml(state.trip.airlineLabel)} · ${escapeHtml(state.trip.baggageLabel)}</span>
        </div>
        <div class="ticket-grid">
          ${[
            { title: 'OUTBOUND 去程', leg: state.outbound, color: '#4F9B96' },
            { title: 'INBOUND 回程', leg: state.inbound, color: '#C95A49' },
          ]
            .map(({ title, leg, color }) => {
              const legMeta = TRANSPORT_MODE_META[getLegTransportMode(leg)];
              return `
            <div class="luggage-ticket">
              <div class="ticket-head" style="background:${color};">
                <span>${escapeHtml(title)}</span>
                <span>${escapeHtml(leg.flightNo)}</span>
              </div>
              <div class="ticket-body">
                <div class="ticket-route">
                  <div>
                    <div class="t-iata">${escapeHtml(leg.departCode)}</div>
                    <div class="t-city">${escapeHtml(leg.departCity)}${leg.departTerminal ? ` · ${escapeHtml(leg.departTerminal)}` : ''}</div>
                    <div class="t-time">${escapeHtml(leg.departTime)}</div>
                  </div>
                  <div class="t-mid">
                    <div>${escapeHtml(leg.duration)}</div>
                    <div>${legMeta.routeSymbol}</div>
                  </div>
                  <div style="text-align:right;">
                    <div class="t-iata">${escapeHtml(leg.arriveCode)}</div>
                    <div class="t-city">${escapeHtml(leg.arriveCity)}${leg.arriveTerminal ? ` · ${escapeHtml(leg.arriveTerminal)}` : ''}</div>
                    <div class="t-time">${escapeHtml(leg.arriveTime)}</div>
                  </div>
                </div>
                <div class="t-foot">${escapeHtml(leg.dateLabel)}${leg.perkLabel ? ` · ${escapeHtml(leg.perkLabel)}` : ''}</div>
              </div>
            </div>`;
            })
            .join('')}
        </div>
      </section>`
    : '';

  const stayHtml = options.includeStay
    ? `<section class="kraft-panel section-block">
        <div class="kraft-head">
          <h2>🏨 住宿飯店手札</h2>
          <span class="kraft-meta">${
            staysList.length > 1
              ? `共 ${staysList.length} 間住宿`
              : `${'★'.repeat(Math.max(1, staysList[0]?.stars || 4))} · ${escapeHtml(
                  staysList[0]?.category || 'Hotel'
                )}`
          }</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:16px;">
          ${staysList
            .map((s, idx) => {
              const sSrc = photoMap.get(s.photoUrl || '') || s.photoUrl || '';
              const nights = getStayNights(s);
              return `<div class="polaroid-stay" style="${
                idx > 0 ? 'padding-top:16px;border-top:1.5px dashed #D6C1A0;' : ''
              }">
                <div class="polaroid-frame">
                  <div class="washi-pin"></div>
                  ${
                    sSrc
                      ? `<img src="${escapeHtml(sSrc)}" alt="${escapeHtml(s.hotelName)}" />`
                      : `<div class="polaroid-fallback">🏨</div>`
                  }
                </div>
                <div class="stay-copy">
                  ${
                    staysList.length > 1
                      ? `<div style="font-size:11px;font-weight:900;color:#B84B39;margin-bottom:2px;">第 ${
                          idx + 1
                        } 間住宿${nights > 0 ? ` · ${nights} 晚` : ''}</div>`
                      : ''
                  }
                  <div class="stay-name">${escapeHtml(s.hotelName || '未命名飯店')}</div>
                  <div class="stay-sub">${escapeHtml(s.subTitle)}</div>
                  <div class="stay-dates">入住：<strong>${escapeHtml(s.checkIn)}</strong> · 退房：<strong>${escapeHtml(s.checkOut)}</strong> · ${escapeHtml(s.paidStatus)}</div>
                  <div class="stay-addr">📍 <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.hotelName + ' ' + s.address)}" target="_blank" rel="noopener">${escapeHtml(s.address)}</a></div>
                  ${s.insiderScoop ? `<div class="stay-scoop">💡 ${escapeHtml(s.insiderScoop)}</div>` : ''}
                </div>
              </div>`;
            })
            .join('')}
        </div>
      </section>`
    : '';

  const itineraryHtml = options.includeItinerary
    ? `<section class="kraft-panel section-block">
        <div class="kraft-head">
          <h2>🗺️ 每日行程剪貼簿</h2>
          <span class="kraft-meta">共 ${tripDays.length} 天 · ${state.activities.length} 站 · 預估行程費 ¥${metrics.activityEstimateJPY.toLocaleString()}</span>
        </div>
        <div class="scrap-days">
          ${groupedDays
            .map(({ day, items, dayCostJPY }, dIdx) => {
              const tabColor = SUITCASE_DAY_COLORS[dIdx % SUITCASE_DAY_COLORS.length];
              const weather = weatherByDate[day.iso];
              const weatherText = weather
                ? `${weather.emoji} ${weather.tempMin}°–${weather.tempMax}°C ${weather.conditionText}`
                : '';
              const aiDay = aiSummary?.daySummaries?.find((d) => d.dayIndex === day.index);
              const daySticker = getDaySticker(day.index, input);
              const dayStickerSrc = daySticker
                ? photoMap.get(daySticker.imageUrl) || daySticker.imageUrl
                : '';
              const itemsMarkup =
                items.length === 0
                  ? `<div class="empty-slip">這天保留彈性漫步與探索時間</div>`
                  : items
                      .map((act) => {
                        const actSrc = photoMap.get(act.photoUrl || '') || act.photoUrl || '';
                        const aiAct = aiSummary?.activitySuggestions?.find(
                          (a) => a.activityId === act.id
                        );
                        const actSticker = getActivitySticker(act.id, input);
                        const actStickerSrc = actSticker
                          ? photoMap.get(actSticker.imageUrl) || actSticker.imageUrl
                          : '';
                        return `<div class="slip-item">
                          <div class="slip-time">
                            <div class="st-main">${escapeHtml(act.time)}</div>
                            ${act.duration ? `<div class="st-dur">${escapeHtml(act.duration)}</div>` : ''}
                          </div>
                          ${
                            actSrc
                              ? `<img class="sticker-thumb" src="${escapeHtml(actSrc)}" alt="${escapeHtml(act.title)}" />`
                              : `<div class="sticker-thumb sticker-fallback">📍</div>`
                          }
                          <div class="slip-body">
                            <div class="slip-title-row">
                              <span class="slip-title">${escapeHtml(act.title)}</span>
                              ${act.cost ? `<span class="slip-cost">¥${Number(act.cost).toLocaleString()}</span>` : ''}
                            </div>
                            <div class="slip-meta">${escapeHtml(act.kicker)} · ${escapeHtml(act.location)}${act.transport ? ` · ${escapeHtml(act.transport)}` : ''}</div>
                            ${
                              useAiCopy && aiAct?.conciseLine
                                ? `<div class="slip-ai-line">✍️ ${escapeHtml(aiAct.conciseLine)}</div>`
                                : act.note
                                ? `<div class="slip-note">${escapeHtml(act.note)}</div>`
                                : ''
                            }
                          </div>
                          ${
                            actStickerSrc
                              ? `<div class="act-sticker-diecut" title="${escapeHtml(actSticker?.name || '')}">
                                  <img src="${escapeHtml(actStickerSrc)}" alt="${escapeHtml(actSticker?.name || '貼紙')}" />
                                  <span>${escapeHtml(actSticker?.name || '')}</span>
                                </div>`
                              : '<div></div>'
                          }
                        </div>`;
                      })
                      .join('');

              return `<div class="day-slip">
                <div class="day-tape-bar" style="background:${tabColor};">
                  <div class="dt-left">
                    ${
                      dayStickerSrc
                        ? `<img class="day-sticker-mini" src="${escapeHtml(dayStickerSrc)}" alt="${escapeHtml(daySticker?.name || '')}" />`
                        : ''
                    }
                    <div>
                      <span class="dt-label">${escapeHtml(day.label)}</span>
                      <span class="dt-date">${escapeHtml(day.zhDisp)}</span>
                      ${useAiCopy && aiDay?.dayHeadline ? `<span class="dt-headline">· ${escapeHtml(aiDay.dayHeadline)}</span>` : ''}
                      ${weatherText ? `<span class="dt-weather">${escapeHtml(weatherText)}</span>` : ''}
                    </div>
                  </div>
                  <div class="dt-cost">當日預估 ¥${dayCostJPY.toLocaleString()}</div>
                </div>
                <div class="slip-body-list">${itemsMarkup}</div>
              </div>`;
            })
            .join('')}
        </div>
      </section>`
    : '';

  const budgetHtml = options.includeBudgetOverview
    ? `<section class="kraft-panel section-block">
        <div class="kraft-head">
          <h2>💰 旅行經費與戰利品帳本</h2>
          <span class="kraft-meta">總預算 ¥${state.totalBudgetJPY.toLocaleString()}（約 ${formatMoney(metrics.totalBudgetConverted, metrics.targetCurrency)}）</span>
        </div>
        <div class="ledger-overview">
          ${buildExpenseDonutSvg(metrics.slices, metrics.totalSpentJPY, 'suitcase')}
          <div class="ledger-bars">
            ${metrics.slices
              .map(
                (s) => `<div class="cat-row">
                  <div class="cat-top">
                    <span>${s.emoji} ${escapeHtml(s.label)}</span>
                    <span class="num">¥${s.amountJPY.toLocaleString()} (${s.percent}%) · ${formatMoney(s.converted, metrics.targetCurrency)}</span>
                  </div>
                  <div class="bar-track"><div class="bar-fill" style="width:${s.percent}%;background:${s.color};"></div></div>
                </div>`
              )
              .join('')}
            <div class="ledger-foot">
              <span>已花費：<strong>¥${metrics.totalSpentJPY.toLocaleString()}</strong> (${formatMoney(metrics.totalSpentConverted, metrics.targetCurrency)})</span>
              <span>剩餘預算：<strong style="color:#4F9B96;">¥${metrics.remainingBudgetJPY.toLocaleString()}</strong> (${formatMoney(metrics.remainingConverted, metrics.targetCurrency)})</span>
            </div>
          </div>
        </div>
        ${
          options.includeExpenseDetails
            ? `<div class="exp-list-wrap">
                <h3>🛍️ 購物與消費貼紙牆（${state.expenses.length} 筆）</h3>
                ${
                  state.expenses.length === 0
                    ? `<div class="empty-slip">尚未記錄消費明細</div>`
                    : `<div class="exp-grid">
                        ${state.expenses
                          .map((exp) => {
                            const cat = CATEGORY_META[exp.category] || CATEGORY_META.shopping;
                            const expSrc = exp.photoUrl
                              ? photoMap.get(exp.photoUrl) || exp.photoUrl
                              : '';
                            return `<div class="exp-sticker">
                              ${
                                expSrc
                                  ? `<img class="exp-photo" src="${escapeHtml(expSrc)}" alt="${escapeHtml(exp.title)}" />`
                                  : `<div class="exp-photo exp-icon" style="background:${cat.bg};color:${cat.suitcaseColor};">${cat.emoji}</div>`
                              }
                              <div class="exp-info">
                                <div class="exp-title">${escapeHtml(exp.title)}${exp.quantity && exp.quantity > 1 ? ` ×${exp.quantity}` : ''}</div>
                                <div class="exp-sub">${escapeHtml(cat.label)} · ${escapeHtml(exp.shopOrNote || '旅途消費')}</div>
                              </div>
                              <div class="exp-amt">
                                <div class="jpy">¥${Number(exp.amountJPY).toLocaleString()}</div>
                                ${
                                  exp.originalCurrency && exp.originalCurrency !== 'JPY'
                                    ? `<div class="orig">${formatMoney(exp.originalAmount, exp.originalCurrency)}</div>`
                                    : ''
                                }
                              </div>
                            </div>`;
                          })
                          .join('')}
                      </div>`
                }
              </div>`
            : ''
        }
      </section>`
    : '';

  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(state.trip.destinationTitle)} — 復古行李箱旅遊手札</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 28px 14px 48px;
      font-family: -apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", "Noto Sans TC", "PingFang TC", sans-serif;
      background: #DFD1BD;
      color: #2A1F17;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .suitcase-wrap {
      max-width: 900px;
      margin: 0 auto;
      position: relative;
    }
    .suitcase-handle {
      width: 170px; height: 26px; margin: 0 auto -6px;
      background: linear-gradient(180deg, #4B3427 0%, #2E1E16 100%);
      border-radius: 14px 14px 4px 4px;
      border: 3px solid #6E503E;
      box-shadow: 0 4px 10px rgba(42,31,23,0.25);
    }
    .suitcase-shell {
      background: linear-gradient(180deg, #EFE3CF 0%, #E3D2BA 100%);
      border: 4px solid #B79C7C;
      border-radius: 34px;
      padding: 18px;
      box-shadow: 0 18px 40px rgba(56, 38, 22, 0.22), inset 0 0 0 3px #F7EFE0;
      position: relative;
      overflow: hidden;
    }
    .corner {
      position: absolute; width: 42px; height: 42px;
      background: #6A4B38; border: 2px solid #4A3224; z-index: 2;
    }
    .c-tl { top: -4px; left: -4px; border-bottom-right-radius: 26px; }
    .c-tr { top: -4px; right: -4px; border-bottom-left-radius: 26px; }
    .c-bl { bottom: -4px; left: -4px; border-top-right-radius: 26px; }
    .c-br { bottom: -4px; right: -4px; border-top-left-radius: 26px; }
    .kraft-canvas {
      background: #F7EEDD;
      border: 1.5px dashed #CBB799;
      border-radius: 24px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 18px;
      position: relative;
    }
    .scrap-header {
      background: #EFE2C4;
      border: 2px solid #D5C19B;
      border-radius: 18px;
      padding: 18px 20px;
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 16px;
      align-items: center;
      box-shadow: 0 4px 12px rgba(74,50,36,0.08);
    }
    .hero-polaroid {
      width: 112px; background: #FFFFFF; padding: 6px 6px 14px;
      border-radius: 8px; box-shadow: 0 4px 10px rgba(42,31,23,0.16);
      transform: rotate(-2.5deg);
    }
    .hero-polaroid img { width: 100%; height: 82px; object-fit: cover; border-radius: 4px; display: block; }
    .header-center { text-align: center; }
    .header-tag { font-size: 11.5px; font-weight: 800; letter-spacing: 0.08em; color: #7C5C42; text-transform: uppercase; }
    .header-title { font-size: 28px; font-weight: 900; color: #1E2D3B; margin: 4px 0; line-height: 1.15; }
    .header-sub { font-size: 13.5px; color: #5C4634; margin: 0; font-weight: 600; }
    .header-kpis {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;
      background: #FBF5E8; border: 1.5px solid #DECAA8; border-radius: 14px; padding: 12px 16px;
    }
    .hk-item { border-right: 1px dashed #D6C1A0; padding-right: 8px; }
    .hk-item:last-child { border-right: none; }
    .hk-label { font-size: 11px; color: #7C5C42; font-weight: 700; }
    .hk-val { font-size: 17px; font-weight: 900; color: #2A1F17; font-variant-numeric: tabular-nums; margin-top: 2px; }
    .kraft-panel {
      background: #FBF6EA;
      border: 1.5px solid #DECAA8;
      border-radius: 18px;
      padding: 18px;
      box-shadow: 0 3px 10px rgba(60, 40, 20, 0.06);
    }
    .section-block { break-inside: avoid; }
    .kraft-head {
      display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between;
      gap: 8px; border-bottom: 1.5px dashed #D6C1A0; padding-bottom: 10px; margin-bottom: 14px;
    }
    .kraft-head h2 { margin: 0; font-size: 17px; font-weight: 900; color: #2A1F17; }
    .kraft-meta { font-size: 12px; color: #7C5C42; font-weight: 700; }
    .ticket-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
    .luggage-ticket {
      background: #FFFFFF; border: 2px solid #D6C1A0; border-radius: 14px; overflow: hidden;
      box-shadow: 0 3px 8px rgba(42,31,23,0.08);
    }
    .ticket-head {
      color: #FFFFFF; padding: 7px 14px; display: flex; justify-content: space-between;
      font-size: 11.5px; font-weight: 900; letter-spacing: 0.04em;
    }
    .ticket-body { padding: 12px 14px; }
    .ticket-route { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; }
    .t-iata { font-size: 22px; font-weight: 900; color: #1E2D3B; }
    .t-city { font-size: 11px; color: #6E5845; font-weight: 600; }
    .t-time { font-size: 14.5px; font-weight: 800; color: #4F9B96; font-variant-numeric: tabular-nums; margin-top: 2px; }
    .t-mid { text-align: center; font-size: 11px; color: #8C735B; font-weight: 700; }
    .t-foot { margin-top: 10px; padding-top: 8px; border-top: 1px dashed #E2D2B8; font-size: 11.5px; color: #6E5845; }
    .polaroid-stay { display: grid; grid-template-columns: 190px 1fr; gap: 18px; align-items: center; }
    .polaroid-frame {
      position: relative; background: #FFFFFF; padding: 8px 8px 18px; border-radius: 8px;
      box-shadow: 0 5px 14px rgba(42,31,23,0.14); border: 1px solid #E5D6BE;
    }
    .washi-pin {
      position: absolute; top: -8px; left: 50%; transform: translateX(-50%) rotate(-3deg);
      width: 64px; height: 16px; background: rgba(227, 120, 104, 0.72); border-radius: 2px;
    }
    .polaroid-frame img { width: 100%; height: 132px; object-fit: cover; border-radius: 4px; display: block; }
    .polaroid-fallback { height: 132px; background: #EFE2C4; display: flex; align-items: center; justify-content: center; font-size: 36px; border-radius: 4px; }
    .stay-name { font-size: 18px; font-weight: 900; color: #1E2D3B; }
    .stay-sub { font-size: 13px; color: #6E5845; margin-top: 2px; }
    .stay-dates { font-size: 13px; color: #4F9B96; margin-top: 8px; }
    .stay-addr { font-size: 12.5px; margin-top: 6px; }
    .stay-addr a { color: #2B5E8C; text-decoration: none; }
    .stay-scoop { margin-top: 8px; font-size: 12px; color: #5C4634; background: #F2E7CF; padding: 8px 12px; border-radius: 10px; }
    .scrap-days { display: flex; flex-direction: column; gap: 14px; }
    .day-slip {
      background: #FFFFFF; border: 1.5px solid #DECAA8; border-radius: 16px;
      overflow: hidden; box-shadow: 0 3px 10px rgba(42,31,23,0.06); break-inside: avoid;
    }
    .day-tape-bar {
      color: #FFFFFF; padding: 9px 16px; display: flex; flex-wrap: wrap;
      justify-content: space-between; align-items: center; gap: 8px;
    }
    .dt-left { display: flex; align-items: center; gap: 8px; }
    .day-sticker-mini {
      width: 30px; height: 30px; object-fit: contain; border-radius: 999px;
      background: #FFFFFF; padding: 2px; box-shadow: 0 2px 5px rgba(42,31,23,0.22);
    }
    .dt-label { font-size: 14px; font-weight: 900; letter-spacing: 0.04em; margin-right: 8px; }
    .dt-date { font-size: 13px; font-weight: 700; margin-right: 8px; }
    .dt-headline { font-size: 12.5px; font-weight: 800; opacity: 0.96; margin-right: 8px; }
    .dt-weather { font-size: 12px; opacity: 0.94; font-weight: 600; }
    .dt-cost { font-size: 12.5px; font-weight: 800; font-variant-numeric: tabular-nums; }
    .slip-body-list { padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
    .slip-item {
      display: grid; grid-template-columns: 56px 64px 1fr 56px; gap: 12px; align-items: center;
      padding-bottom: 10px; border-bottom: 1px dashed #EBDEC7;
    }
    .slip-item:last-child { border-bottom: none; padding-bottom: 0; }
    .slip-time { text-align: center; font-variant-numeric: tabular-nums; }
    .st-main { font-size: 14px; font-weight: 900; color: #1E2D3B; }
    .st-dur { font-size: 10.5px; color: #7C5C42; font-weight: 700; }
    .sticker-thumb {
      width: 64px; height: 64px; object-fit: cover; border-radius: 12px;
      border: 3px solid #FFFFFF; box-shadow: 0 3px 8px rgba(42,31,23,0.18); background: #F2E7CF;
    }
    .sticker-fallback { display: flex; align-items: center; justify-content: center; font-size: 22px; }
    .slip-title-row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
    .slip-title { font-size: 14.5px; font-weight: 900; color: #1E2D3B; }
    .slip-cost { font-size: 13px; font-weight: 800; color: #C95A49; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .slip-meta { font-size: 12px; color: #6E5845; margin-top: 2px; }
    .slip-note { font-size: 12px; color: #4A3A2C; margin-top: 4px; }
    .slip-ai-line {
      margin-top: 5px; font-size: 12px; font-weight: 700; color: #6A4B38;
      background: #FBF2DE; border-left: 3px solid #D99B38; padding: 3px 8px; border-radius: 6px;
    }
    .act-sticker-diecut {
      display: flex; flex-direction: column; align-items: center; gap: 2px;
      transform: rotate(3deg);
    }
    .act-sticker-diecut img {
      width: 50px; height: 50px; object-fit: contain;
      filter: drop-shadow(0 2px 4px rgba(42,31,23,0.2));
    }
    .act-sticker-diecut span {
      font-size: 9.5px; font-weight: 800; color: #7C5C42; max-width: 56px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center;
    }
    .ai-journal-note {
      background: #FFF9EE; border: 1.5px dashed #C9A97E; border-radius: 16px;
      padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 16px;
    }
    .ai-note-kicker { font-size: 11.5px; font-weight: 900; color: #B84B39; letter-spacing: 0.04em; }
    .ai-note-quote { margin: 5px 0 0; font-size: 13.5px; font-weight: 700; color: #2A1F17; line-height: 1.55; }
    .ai-note-budget {
      margin-top: 8px; display: inline-block; font-size: 12px; font-weight: 800; color: #4F9B96;
      background: #EDF7F6; padding: 4px 10px; border-radius: 8px;
    }
    .ai-hero-sticker {
      display: flex; flex-direction: column; align-items: center; flex-shrink: 0;
      transform: rotate(-4deg);
    }
    .ai-hero-sticker img {
      width: 68px; height: 68px; object-fit: contain;
      filter: drop-shadow(0 3px 6px rgba(42,31,23,0.22));
    }
    .ai-hero-sticker span { font-size: 10px; font-weight: 800; color: #7C5C42; margin-top: 2px; }
    .empty-slip { font-size: 12.5px; color: #7C5C42; padding: 6px 2px; }
    .ledger-overview { display: flex; gap: 22px; align-items: center; flex-wrap: wrap; }
    .ledger-bars { flex: 1; min-width: 240px; display: flex; flex-direction: column; gap: 10px; }
    .cat-top { display: flex; justify-content: space-between; font-size: 12.5px; font-weight: 700; margin-bottom: 4px; gap: 8px; }
    .cat-top .num { font-variant-numeric: tabular-nums; color: #4A3A2C; }
    .bar-track { height: 8px; border-radius: 999px; background: #EFE2CA; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 999px; }
    .ledger-foot {
      margin-top: 6px; padding-top: 10px; border-top: 1px dashed #D6C1A0;
      display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; font-size: 13px;
    }
    .exp-list-wrap { margin-top: 18px; padding-top: 14px; border-top: 1.5px dashed #D6C1A0; }
    .exp-list-wrap h3 { margin: 0 0 12px; font-size: 15px; font-weight: 900; color: #2A1F17; }
    .exp-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .exp-sticker {
      display: grid; grid-template-columns: 48px 1fr auto; gap: 10px; align-items: center;
      padding: 10px; border-radius: 14px; background: #FFFFFF;
      border: 1.5px solid #E2D2B8; box-shadow: 0 2px 6px rgba(42,31,23,0.06);
    }
    .exp-photo { width: 48px; height: 48px; border-radius: 10px; object-fit: cover; border: 2px solid #FFFFFF; box-shadow: 0 2px 5px rgba(42,31,23,0.12); }
    .exp-icon { display: flex; align-items: center; justify-content: center; font-size: 20px; }
    .exp-title { font-size: 13px; font-weight: 800; color: #1E2D3B; }
    .exp-sub { font-size: 11.5px; color: #6E5845; margin-top: 2px; }
    .exp-amt { text-align: right; font-variant-numeric: tabular-nums; }
    .exp-amt .jpy { font-size: 13.5px; font-weight: 900; color: #1E2D3B; }
    .exp-amt .orig { font-size: 11px; color: #6E5845; }
    .sticker-footer {
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px;
      padding-top: 6px;
    }
    .badge-strip { display: flex; flex-wrap: wrap; gap: 8px; }
    .travel-sticker {
      padding: 5px 12px; border-radius: 8px; font-size: 11px; font-weight: 900;
      letter-spacing: 0.06em; color: #FFFFFF; border: 2px solid #FFFFFF;
      box-shadow: 0 2px 6px rgba(42,31,23,0.18);
    }
    .footer-meta { font-size: 11.5px; color: #7C5C42; font-weight: 600; }
    @media (max-width: 640px) {
      .scrap-header { grid-template-columns: 1fr; text-align: center; justify-items: center; }
      .header-kpis { grid-template-columns: repeat(2, 1fr); }
      .ticket-grid, .polaroid-stay, .exp-grid { grid-template-columns: 1fr; }
      .slip-item { grid-template-columns: 48px 52px 1fr 48px; gap: 8px; }
      .sticker-thumb { width: 52px; height: 52px; }
      .act-sticker-diecut img { width: 42px; height: 42px; }
    }
    @media print {
      body { background: #FFFFFF; padding: 0; }
      .suitcase-shell { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="suitcase-wrap">
    <div class="suitcase-handle"></div>
    <div class="suitcase-shell">
      <div class="corner c-tl"></div>
      <div class="corner c-tr"></div>
      <div class="corner c-bl"></div>
      <div class="corner c-br"></div>

      <div class="kraft-canvas">
        <header class="scrap-header">
          <div class="hero-polaroid">
            ${
              heroSrc
                ? `<img src="${escapeHtml(heroSrc)}" alt="${escapeHtml(state.trip.destinationTitle)}" />`
                : `<div style="height:82px;background:#4F9B96;border-radius:4px;"></div>`
            }
          </div>
          <div class="header-center">
            <div class="header-tag">${escapeHtml(state.trip.memoryTag)} · ${escapeHtml(state.trip.dateRangeLabel)}</div>
            <h1 class="header-title">${escapeHtml(state.trip.destinationTitle)}</h1>
            <p class="header-sub">${escapeHtml(state.trip.subtitle)}</p>
          </div>
          <div>
            ${buildPassportStampSvg('ARRIVED', state.outbound.arriveCode || 'KIX', 'TRAVEL LOG', '#B84B39')}
          </div>
        </header>

        <div class="header-kpis">
          <div class="hk-item">
            <div class="hk-label">旅行天數</div>
            <div class="hk-val">${tripDays.length} 天</div>
          </div>
          <div class="hk-item">
            <div class="hk-label">行程站點</div>
            <div class="hk-val">${state.activities.length} 站</div>
          </div>
          <div class="hk-item">
            <div class="hk-label">已記帳花費</div>
            <div class="hk-val">¥${metrics.totalSpentJPY.toLocaleString()}</div>
          </div>
          <div class="hk-item">
            <div class="hk-label">ICOCA 餘額</div>
            <div class="hk-val">¥${(state.trip.icocaBalance || 0).toLocaleString()}</div>
          </div>
        </div>

        ${aiIntroHtml}
        ${flightsHtml}
        ${stayHtml}
        ${itineraryHtml}
        ${budgetHtml}

        <footer class="sticker-footer">
          <div class="badge-strip">
            <span class="travel-sticker" style="background:#C95A49;transform:rotate(-2deg);">TRAVEL</span>
            <span class="travel-sticker" style="background:#4F9B96;transform:rotate(1.5deg);">GOOD TRIP!</span>
            <span class="travel-sticker" style="background:#D99B38;transform:rotate(-1deg);">LET'S GO!</span>
          </div>
          <div class="footer-meta">去旅行啦 Amazing Travel · ${escapeHtml(generatedAt)}</div>
        </footer>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export async function generateTripSummaryHtml(
  input: SummaryGeneratorInput
): Promise<string> {
  const { state, tripDays, weatherByDate, options, theme = 'mint', aiSummary, useAiCopy = true } = input;
  const photoMap = await resolveAllSummaryPhotos(input);

  if (theme === 'suitcase') {
    return generateSuitcaseSummaryHtml(input, photoMap);
  }

  const metrics = computeExpenseMetrics(input);
  const groupedDays = groupActivitiesByDay(state.activities, tripDays);
  const heroSrc = photoMap.get(state.trip.heroPhotoUrl || '') || state.trip.heroPhotoUrl || '';
  const staysList = normalizeStaysList(state);
  const heroSticker = getHeroSticker(input);
  const heroStickerSrc = heroSticker
    ? photoMap.get(heroSticker.imageUrl) || heroSticker.imageUrl
    : '';
  const generatedAt = new Date().toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const aiIntroHtml =
    useAiCopy && aiSummary
      ? `<section class="card section-block mint-ai-card">
          <div class="mint-ai-copy">
            <div class="mint-ai-kicker">✨ AI 手札引言 · ${escapeHtml(aiSummary.journalTitle)}</div>
            <p class="mint-ai-quote">${escapeHtml(aiSummary.introQuote)}</p>
            ${
              aiSummary.budgetHighlight
                ? `<div class="mint-ai-budget">💡 ${escapeHtml(aiSummary.budgetHighlight)}</div>`
                : ''
            }
          </div>
          ${
            heroStickerSrc
              ? `<div class="mint-hero-sticker"><img src="${escapeHtml(heroStickerSrc)}" alt="${escapeHtml(heroSticker?.name || '貼紙')}" /><span>${escapeHtml(heroSticker?.name || '')}</span></div>`
              : ''
          }
        </section>`
      : heroStickerSrc
      ? `<section class="card section-block mint-ai-card">
          <div class="mint-ai-copy">
            <div class="mint-ai-kicker">🏷️ 本趟主打旅行貼紙</div>
            <p class="mint-ai-quote">${escapeHtml(state.trip.subtitle || state.trip.destinationTitle)}</p>
          </div>
          <div class="mint-hero-sticker"><img src="${escapeHtml(heroStickerSrc)}" alt="${escapeHtml(heroSticker?.name || '貼紙')}" /><span>${escapeHtml(heroSticker?.name || '')}</span></div>
        </section>`
      : '';

  const tripMode = getTripTransportMode(state.outbound, state.inbound);
  const tripModeMeta = TRANSPORT_MODE_META[tripMode];

  const flightsHtml = options.includeFlights
    ? `<section class="card section-block">
        <div class="section-head">
          <h2>${tripModeMeta.icon} ${escapeHtml(tripModeMeta.zhHeading)}</h2>
          <span class="meta-line">${escapeHtml(state.trip.airlineLabel)} · ${escapeHtml(state.trip.baggageLabel)}</span>
        </div>
        <div class="flight-grid">
          ${[
            { title: '去程 Outbound', leg: state.outbound, accent: '#1A5D42' },
            { title: '回程 Inbound', leg: state.inbound, accent: '#DF6437' },
          ]
            .map(({ title, leg, accent }) => {
              const legMeta = TRANSPORT_MODE_META[getLegTransportMode(leg)];
              return `
            <div class="flight-pass">
              <div class="flight-top">
                <span class="flight-tag" style="color:${accent};">${escapeHtml(title)}</span>
                <span class="flight-no">${escapeHtml(leg.flightNo)} · ${escapeHtml(leg.dateLabel)}</span>
              </div>
              <div class="flight-route">
                <div>
                  <div class="iata">${escapeHtml(leg.departCode)}</div>
                  <div class="city">${escapeHtml(leg.departCity)}${leg.departTerminal ? ` (${escapeHtml(leg.departTerminal)})` : ''}</div>
                  <div class="time">${escapeHtml(leg.departTime)}</div>
                </div>
                <div class="flight-arrow">
                  <div class="duration">${escapeHtml(leg.duration)}</div>
                  <div class="line">──────── ${legMeta.routeSymbol} ────────</div>
                </div>
                <div style="text-align:right;">
                  <div class="iata">${escapeHtml(leg.arriveCode)}</div>
                  <div class="city">${escapeHtml(leg.arriveCity)}${leg.arriveTerminal ? ` (${escapeHtml(leg.arriveTerminal)})` : ''}</div>
                  <div class="time">${escapeHtml(leg.arriveTime)}</div>
                </div>
              </div>
              ${leg.perkLabel ? `<div class="flight-perk">${escapeHtml(leg.perkLabel)}</div>` : ''}
            </div>`;
            })
            .join('')}
        </div>
      </section>`
    : '';

  const stayHtml = options.includeStay
    ? `<section class="card section-block">
        <div class="section-head">
          <h2>🏨 住宿飯店資訊</h2>
          <span class="meta-line">${
            staysList.length > 1
              ? `共 ${staysList.length} 間住宿`
              : `${'★'.repeat(Math.max(1, staysList[0]?.stars || 4))} · ${escapeHtml(
                  staysList[0]?.category || 'Hotel'
                )}`
          }</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:16px;">
          ${staysList
            .map((s, idx) => {
              const sSrc = photoMap.get(s.photoUrl || '') || s.photoUrl || '';
              const nights = getStayNights(s);
              return `<div class="stay-card" style="${
                idx > 0 ? 'padding-top:16px;border-top:1px solid #E8F1EC;' : ''
              }">
                ${
                  sSrc
                    ? `<img class="stay-photo" src="${escapeHtml(sSrc)}" alt="${escapeHtml(s.hotelName)}" />`
                    : `<div class="stay-photo stay-fallback">🏨</div>`
                }
                <div class="stay-info">
                  ${
                    staysList.length > 1
                      ? `<div style="font-size:11px;font-weight:800;color:#1A5D42;margin-bottom:2px;">第 ${
                          idx + 1
                        } 間住宿${nights > 0 ? ` · ${nights} 晚` : ''}</div>`
                      : ''
                  }
                  <div class="stay-title">${escapeHtml(s.hotelName || '未命名飯店')}</div>
                  <div class="stay-sub">${escapeHtml(s.subTitle)}</div>
                  <div class="stay-dates">入住：<strong>${escapeHtml(s.checkIn)}</strong> &nbsp;·&nbsp; 退房：<strong>${escapeHtml(s.checkOut)}</strong> &nbsp;·&nbsp; ${escapeHtml(s.paidStatus)}</div>
                  <div class="stay-addr">📍 <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.hotelName + ' ' + s.address)}" target="_blank" rel="noopener">${escapeHtml(s.address)}</a></div>
                  ${s.insiderScoop ? `<div class="stay-note">💡 ${escapeHtml(s.insiderScoop)}</div>` : ''}
                </div>
              </div>`;
            })
            .join('')}
        </div>
      </section>`
    : '';

  const itineraryHtml = options.includeItinerary
    ? `<section class="card section-block">
        <div class="section-head">
          <h2>🗺️ 每日圖文行程</h2>
          <span class="meta-line">共 ${tripDays.length} 天 · ${state.activities.length} 個行程站點 · 預估行程經費 ¥${metrics.activityEstimateJPY.toLocaleString()}</span>
        </div>
        <div class="days-list">
          ${groupedDays
            .map(({ day, items, dayCostJPY }) => {
              const weather = weatherByDate[day.iso];
              const weatherText = weather
                ? `${weather.emoji} ${weather.tempMin}°–${weather.tempMax}°C ${weather.conditionText}`
                : '';
              const aiDay = aiSummary?.daySummaries?.find((d) => d.dayIndex === day.index);
              const daySticker = getDaySticker(day.index, input);
              const dayStickerSrc = daySticker
                ? photoMap.get(daySticker.imageUrl) || daySticker.imageUrl
                : '';
              const itemsMarkup =
                items.length === 0
                  ? `<div class="empty-day">這天尚未安排行程，保留自由散步與探索時間。</div>`
                  : items
                      .map((act) => {
                        const actSrc = photoMap.get(act.photoUrl || '') || act.photoUrl || '';
                        const aiAct = aiSummary?.activitySuggestions?.find(
                          (a) => a.activityId === act.id
                        );
                        const actSticker = getActivitySticker(act.id, input);
                        const actStickerSrc = actSticker
                          ? photoMap.get(actSticker.imageUrl) || actSticker.imageUrl
                          : '';
                        return `<div class="act-row">
                          <div class="act-time">
                            <div class="t-main">${escapeHtml(act.time)}</div>
                            ${act.endTime ? `<div class="t-end">~${escapeHtml(act.endTime)}</div>` : ''}
                            <div class="t-dur">${escapeHtml(act.duration || '')}</div>
                          </div>
                          ${
                            actSrc
                              ? `<img class="act-img" src="${escapeHtml(actSrc)}" alt="${escapeHtml(act.title)}" />`
                              : `<div class="act-img act-fallback">📍</div>`
                          }
                          <div class="act-body">
                            <div class="act-title-row">
                              <span class="act-title">${escapeHtml(act.title)}</span>
                              ${act.cost ? `<span class="act-cost">¥${Number(act.cost).toLocaleString()}</span>` : ''}
                            </div>
                            <div class="act-meta">${escapeHtml(act.kicker)} · ${escapeHtml(act.location)}${act.transport ? ` · 🚆 ${escapeHtml(act.transport)}` : ''}</div>
                            ${
                              useAiCopy && aiAct?.conciseLine
                                ? `<div class="act-ai-line">✍️ ${escapeHtml(aiAct.conciseLine)}</div>`
                                : act.note
                                ? `<div class="act-note">${escapeHtml(act.note)}</div>`
                                : ''
                            }
                          </div>
                          ${
                            actStickerSrc
                              ? `<div class="mint-act-sticker" title="${escapeHtml(actSticker?.name || '')}">
                                  <img src="${escapeHtml(actStickerSrc)}" alt="${escapeHtml(actSticker?.name || '貼紙')}" />
                                  <span>${escapeHtml(actSticker?.name || '')}</span>
                                </div>`
                              : '<div></div>'
                          }
                        </div>`;
                      })
                      .join('');
              return `<div class="day-group">
                <div class="day-header">
                  <div class="day-head-left">
                    ${
                      dayStickerSrc
                        ? `<img class="mint-day-sticker" src="${escapeHtml(dayStickerSrc)}" alt="${escapeHtml(daySticker?.name || '')}" />`
                        : ''
                    }
                    <div>
                      <span class="day-label">${escapeHtml(day.label)}</span>
                      <span class="day-date">${escapeHtml(day.zhDisp)} (${escapeHtml(day.iso)})</span>
                      ${useAiCopy && aiDay?.dayHeadline ? `<span class="day-headline">· ${escapeHtml(aiDay.dayHeadline)}</span>` : ''}
                      ${weatherText ? `<span class="day-weather">${escapeHtml(weatherText)}</span>` : ''}
                    </div>
                  </div>
                  <div class="day-cost">當日預估：¥${dayCostJPY.toLocaleString()}</div>
                </div>
                <div class="act-stack">${itemsMarkup}</div>
              </div>`;
            })
            .join('')}
        </div>
      </section>`
    : '';

  const budgetHtml = options.includeBudgetOverview
    ? `<section class="card section-block">
        <div class="section-head">
          <h2>💰 旅遊經費與消費分佈</h2>
          <span class="meta-line">總預算 ¥${state.totalBudgetJPY.toLocaleString()}（約 ${formatMoney(metrics.totalBudgetConverted, metrics.targetCurrency)}）</span>
        </div>
        <div class="expense-overview">
          ${buildExpenseDonutSvg(metrics.slices, metrics.totalSpentJPY, 'mint')}
          <div class="expense-bars">
            ${metrics.slices
              .map(
                (s) => `<div class="cat-row">
                  <div class="cat-top">
                    <span>${s.emoji} ${escapeHtml(s.label)}</span>
                    <span class="num">¥${s.amountJPY.toLocaleString()} (${s.percent}%) · 約 ${formatMoney(s.converted, metrics.targetCurrency)}</span>
                  </div>
                  <div class="bar-track"><div class="bar-fill" style="width:${s.percent}%;background:${s.color};"></div></div>
                </div>`
              )
              .join('')}
            <div class="budget-summary-line">
              <span>已花費：<strong>¥${metrics.totalSpentJPY.toLocaleString()}</strong> (${formatMoney(metrics.totalSpentConverted, metrics.targetCurrency)})</span>
              <span>剩餘預算：<strong style="color:#1A5D42;">¥${metrics.remainingBudgetJPY.toLocaleString()}</strong> (${formatMoney(metrics.remainingConverted, metrics.targetCurrency)})</span>
            </div>
          </div>
        </div>
        ${
          options.includeExpenseDetails
            ? `<div class="exp-list-wrap">
                <h3>🛍️ 購物與消費明細（${state.expenses.length} 筆）</h3>
                ${
                  state.expenses.length === 0
                    ? `<div class="empty-day">尚未記錄消費明細。</div>`
                    : `<div class="exp-grid">
                        ${state.expenses
                          .map((exp) => {
                            const cat = CATEGORY_META[exp.category] || CATEGORY_META.shopping;
                            const expSrc = exp.photoUrl
                              ? photoMap.get(exp.photoUrl) || exp.photoUrl
                              : '';
                            return `<div class="exp-item">
                              ${
                                expSrc
                                  ? `<img class="exp-photo" src="${escapeHtml(expSrc)}" alt="${escapeHtml(exp.title)}" />`
                                  : `<div class="exp-photo exp-icon" style="background:${cat.bg};color:${cat.color};">${cat.emoji}</div>`
                              }
                              <div class="exp-info">
                                <div class="exp-title">${escapeHtml(exp.title)}${exp.quantity && exp.quantity > 1 ? ` ×${exp.quantity}` : ''}</div>
                                <div class="exp-sub">${escapeHtml(cat.label)} · ${escapeHtml(exp.shopOrNote || '旅途消費')}</div>
                              </div>
                              <div class="exp-amt">
                                <div class="jpy">¥${Number(exp.amountJPY).toLocaleString()}</div>
                                ${
                                  exp.originalCurrency && exp.originalCurrency !== 'JPY'
                                    ? `<div class="orig">${formatMoney(exp.originalAmount, exp.originalCurrency)}</div>`
                                    : ''
                                }
                              </div>
                            </div>`;
                          })
                          .join('')}
                      </div>`
                }
              </div>`
            : ''
        }
      </section>`
    : '';

  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(state.trip.destinationTitle)} — 去旅行啦 旅遊手札總結</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px 16px 48px;
      font-family: -apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", "Noto Sans TC", "PingFang TC", sans-serif;
      background: #EDF6F1;
      color: #162A22;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .container { max-width: 880px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
    .hero {
      position: relative;
      border-radius: 24px;
      overflow: hidden;
      background: #1A5D42;
      color: #FFFFFF;
      box-shadow: 0 10px 28px rgba(20, 44, 34, 0.14);
    }
    .hero-img { width: 100%; height: 260px; object-fit: cover; display: block; }
    .hero-overlay {
      position: absolute; inset: 0;
      background: linear-gradient(to top, rgba(14, 36, 27, 0.9) 10%, rgba(14, 36, 27, 0.35) 55%, rgba(14, 36, 27, 0.1) 100%);
      display: flex; flex-direction: column; justify-content: flex-end; padding: 24px;
    }
    .hero-kicker { font-size: 12px; font-weight: 700; letter-spacing: 0.06em; color: #BCEAD5; text-transform: uppercase; }
    .hero-title { font-size: 30px; font-weight: 900; margin: 4px 0; line-height: 1.15; }
    .hero-sub { font-size: 14px; color: #E4F2EB; margin: 0; }
    .kpi-strip {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
      background: #FFFFFF; padding: 16px 20px; border-top: 1px solid #DCEAE2; color: #162A22;
    }
    .kpi-item { border-right: 1px solid #E8F1EC; padding-right: 10px; }
    .kpi-item:last-child { border-right: none; }
    .kpi-label { font-size: 11px; color: #547063; font-weight: 700; }
    .kpi-val { font-size: 18px; font-weight: 900; font-variant-numeric: tabular-nums; margin-top: 2px; color: #14241D; }
    .card {
      background: #FFFFFF;
      border-radius: 22px;
      padding: 22px;
      border: 1px solid #DCEAE2;
      box-shadow: 0 2px 10px rgba(20, 44, 34, 0.04);
    }
    .section-block { break-inside: avoid; }
    .section-head {
      display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between;
      gap: 8px; border-bottom: 1px solid #E8F1EC; padding-bottom: 12px; margin-bottom: 16px;
    }
    .section-head h2 { margin: 0; font-size: 18px; font-weight: 900; color: #14241D; }
    .meta-line { font-size: 12px; color: #547063; font-weight: 600; }
    .flight-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
    .flight-pass {
      background: #F6FBF8; border: 1px solid #DCEAE2; border-radius: 16px; padding: 14px 16px;
    }
    .flight-top { display: flex; justify-content: space-between; font-size: 12px; font-weight: 800; margin-bottom: 10px; }
    .flight-no { color: #547063; }
    .flight-route { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px; }
    .iata { font-size: 24px; font-weight: 900; letter-spacing: 0.02em; color: #14241D; }
    .city { font-size: 11.5px; color: #547063; font-weight: 600; }
    .time { font-size: 15px; font-weight: 800; color: #1A5D42; margin-top: 2px; font-variant-numeric: tabular-nums; }
    .flight-arrow { text-align: center; font-size: 11px; color: #6B8579; }
    .flight-arrow .line { letter-spacing: -1px; margin-top: 2px; }
    .flight-perk { margin-top: 10px; padding-top: 8px; border-top: 1px dashed #CFE3D8; font-size: 12px; color: #476357; }
    .stay-card { display: grid; grid-template-columns: 200px 1fr; gap: 18px; align-items: stretch; }
    .stay-photo { width: 100%; height: 150px; object-fit: cover; border-radius: 16px; background: #E3F1EC; }
    .stay-fallback { display: flex; align-items: center; justify-content: center; font-size: 40px; }
    .stay-title { font-size: 18px; font-weight: 900; color: #14241D; }
    .stay-sub { font-size: 13px; color: #547063; margin-top: 2px; }
    .stay-dates { font-size: 13px; color: #1A5D42; margin-top: 8px; }
    .stay-addr { font-size: 12.5px; margin-top: 6px; }
    .stay-addr a { color: #2563EB; text-decoration: none; }
    .stay-note { margin-top: 8px; font-size: 12.5px; color: #476357; background: #F5FAF7; padding: 8px 12px; border-radius: 10px; }
    .days-list { display: flex; flex-direction: column; gap: 18px; }
    .day-group { border: 1px solid #E3EFE8; border-radius: 16px; overflow: hidden; break-inside: avoid; }
    .day-header {
      background: #F3FAF6; padding: 10px 16px; display: flex; flex-wrap: wrap;
      justify-content: space-between; align-items: center; gap: 8px; border-bottom: 1px solid #E3EFE8;
    }
    .day-head-left { display: flex; align-items: center; gap: 8px; }
    .mint-day-sticker {
      width: 30px; height: 30px; object-fit: contain; border-radius: 999px;
      background: #FFFFFF; padding: 2px; box-shadow: 0 2px 5px rgba(20,44,34,0.12);
    }
    .day-label { font-size: 14px; font-weight: 900; color: #1A5D42; margin-right: 8px; }
    .day-date { font-size: 13px; font-weight: 700; color: #14241D; margin-right: 8px; }
    .day-headline { font-size: 12.5px; font-weight: 800; color: #1A5D42; margin-right: 8px; }
    .day-weather { font-size: 12px; color: #547063; font-weight: 600; }
    .day-cost { font-size: 12.5px; font-weight: 800; color: #DF6437; font-variant-numeric: tabular-nums; }
    .act-stack { padding: 10px 14px; display: flex; flex-direction: column; gap: 10px; }
    .act-row {
      display: grid; grid-template-columns: 62px 68px 1fr 56px; gap: 12px; align-items: center;
      padding-bottom: 10px; border-bottom: 1px solid #F0F6F2;
    }
    .act-row:last-child { border-bottom: none; padding-bottom: 0; }
    .act-time { text-align: center; font-variant-numeric: tabular-nums; }
    .t-main { font-size: 14px; font-weight: 900; color: #14241D; }
    .t-end { font-size: 11px; color: #6B8579; }
    .t-dur { font-size: 10.5px; color: #1A5D42; font-weight: 700; margin-top: 2px; }
    .act-img { width: 68px; height: 68px; border-radius: 12px; object-fit: cover; background: #EAF4EF; }
    .act-fallback { display: flex; align-items: center; justify-content: center; font-size: 22px; }
    .act-title-row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
    .act-title { font-size: 14.5px; font-weight: 800; color: #14241D; }
    .act-cost { font-size: 13px; font-weight: 800; color: #DF6437; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .act-meta { font-size: 12px; color: #547063; margin-top: 2px; }
    .act-note { font-size: 12px; color: #364E43; margin-top: 4px; }
    .act-ai-line {
      margin-top: 5px; font-size: 12px; font-weight: 700; color: #144B34;
      background: #EDF8F2; border-left: 3px solid #1A5D42; padding: 3px 8px; border-radius: 6px;
    }
    .mint-act-sticker {
      display: flex; flex-direction: column; align-items: center; gap: 2px;
    }
    .mint-act-sticker img {
      width: 50px; height: 50px; object-fit: contain;
      filter: drop-shadow(0 2px 5px rgba(20,44,34,0.16));
    }
    .mint-act-sticker span {
      font-size: 9.5px; font-weight: 700; color: #547063; max-width: 56px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center;
    }
    .mint-ai-card {
      background: linear-gradient(135deg, #FFFFFF 0%, #F2FAF5 100%);
      border: 1px solid #C6E5D4; display: flex; align-items: center; justify-content: space-between; gap: 16px;
    }
    .mint-ai-kicker { font-size: 12px; font-weight: 800; color: #1A5D42; }
    .mint-ai-quote { margin: 6px 0 0; font-size: 14px; font-weight: 700; color: #14241D; line-height: 1.55; }
    .mint-ai-budget {
      margin-top: 8px; display: inline-block; font-size: 12px; font-weight: 800; color: #DF6437;
      background: #FDF1EC; padding: 4px 10px; border-radius: 8px;
    }
    .mint-hero-sticker { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
    .mint-hero-sticker img {
      width: 68px; height: 68px; object-fit: contain;
      filter: drop-shadow(0 3px 6px rgba(20,44,34,0.18));
    }
    .mint-hero-sticker span { font-size: 10px; font-weight: 700; color: #547063; margin-top: 2px; }
    .empty-day { font-size: 12.5px; color: #6B8579; padding: 8px 4px; }
    .expense-overview { display: flex; gap: 24px; align-items: center; flex-wrap: wrap; }
    .expense-bars { flex: 1; min-width: 240px; display: flex; flex-direction: column; gap: 10px; }
    .cat-top { display: flex; justify-content: space-between; font-size: 12.5px; font-weight: 700; margin-bottom: 4px; gap: 8px; }
    .cat-top .num { font-variant-numeric: tabular-nums; color: #364E43; }
    .bar-track { height: 8px; border-radius: 999px; background: #ECF3EF; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 999px; }
    .budget-summary-line {
      margin-top: 6px; padding-top: 10px; border-top: 1px dashed #D6E7DE;
      display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; font-size: 13px;
    }
    .exp-list-wrap { margin-top: 20px; padding-top: 16px; border-top: 1px solid #E8F1EC; }
    .exp-list-wrap h3 { margin: 0 0 12px; font-size: 15px; font-weight: 800; color: #14241D; }
    .exp-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .exp-item {
      display: grid; grid-template-columns: 48px 1fr auto; gap: 10px; align-items: center;
      padding: 10px; border-radius: 14px; background: #F8FBF9; border: 1px solid #E4EFE9;
    }
    .exp-photo { width: 48px; height: 48px; border-radius: 10px; object-fit: cover; }
    .exp-icon { display: flex; align-items: center; justify-content: center; font-size: 20px; }
    .exp-title { font-size: 13px; font-weight: 800; color: #14241D; }
    .exp-sub { font-size: 11.5px; color: #547063; margin-top: 2px; }
    .exp-amt { text-align: right; font-variant-numeric: tabular-nums; }
    .exp-amt .jpy { font-size: 13.5px; font-weight: 900; color: #14241D; }
    .exp-amt .orig { font-size: 11px; color: #547063; }
    .footer-note { text-align: center; font-size: 12px; color: #6B8579; padding-top: 6px; }
    @media (max-width: 640px) {
      .kpi-strip { grid-template-columns: repeat(2, 1fr); }
      .flight-grid, .stay-card, .exp-grid { grid-template-columns: 1fr; }
      .act-row { grid-template-columns: 48px 52px 1fr 48px; gap: 8px; }
      .act-img { width: 52px; height: 52px; }
      .mint-act-sticker img { width: 42px; height: 42px; }
    }
    @media print {
      body { background: #FFFFFF; padding: 0; }
      .container { max-width: 100%; }
      .card, .hero { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="hero">
      ${
        heroSrc
          ? `<img class="hero-img" src="${escapeHtml(heroSrc)}" alt="${escapeHtml(state.trip.destinationTitle)}" />`
          : `<div class="hero-img" style="background:linear-gradient(135deg,#1A5D42,#2B7A59);"></div>`
      }
      <div class="hero-overlay" style="height:260px;top:0;bottom:auto;">
        <div class="hero-kicker">${escapeHtml(state.trip.memoryTag)} · ${escapeHtml(state.trip.dateRangeLabel)}</div>
        <h1 class="hero-title">${escapeHtml(state.trip.destinationTitle)}</h1>
        <p class="hero-sub">${escapeHtml(state.trip.subtitle)}</p>
      </div>
      <div class="kpi-strip">
        <div class="kpi-item">
          <div class="kpi-label">旅行天數</div>
          <div class="kpi-val">${tripDays.length} 天</div>
        </div>
        <div class="kpi-item">
          <div class="kpi-label">行程站點</div>
          <div class="kpi-val">${state.activities.length} 站</div>
        </div>
        <div class="kpi-item">
          <div class="kpi-label">已記帳花費</div>
          <div class="kpi-val">¥${metrics.totalSpentJPY.toLocaleString()}</div>
        </div>
        <div class="kpi-item">
          <div class="kpi-label">ICOCA 餘額</div>
          <div class="kpi-val">¥${(state.trip.icocaBalance || 0).toLocaleString()}</div>
        </div>
      </div>
    </header>

    ${aiIntroHtml}
    ${flightsHtml}
    ${stayHtml}
    ${itineraryHtml}
    ${budgetHtml}

    <footer class="footer-note">
      由「去旅行啦 Amazing Travel PWA」於 ${escapeHtml(generatedAt)} 匯出 · 離線亦可完整瀏覽
    </footer>
  </div>
</body>
</html>`;
}

export function downloadTextFile(
  filename: string,
  content: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// 透過隱藏 iframe 列印 / 另存 PDF（避免使用 window.open 被 iFrame 阻擋）
export function printTripSummaryHtml(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.srcdoc = html;
  document.body.appendChild(iframe);
  iframe.onload = () => {
    window.setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        window.setTimeout(() => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        }, 2000);
      }
    }, 300);
  };
}

// 產生乾淨易讀的 WhatsApp 群組行程與經費摘要文字
export function buildWhatsAppSummaryText(input: SummaryGeneratorInput): string {
  const { state, tripDays, options, aiSummary, useAiCopy = true } = input;
  const metrics = computeExpenseMetrics(input);
  const groupedDays = groupActivitiesByDay(state.activities, tripDays);
  const tripMode = getTripTransportMode(state.outbound, state.inbound);
  const tripModeMeta = TRANSPORT_MODE_META[tripMode];
  const lines: string[] = [];

  lines.push(`${tripModeMeta.icon} *${state.trip.destinationTitle}*（${state.trip.dateRangeLabel}）`);
  if (useAiCopy && aiSummary?.introQuote) {
    lines.push(`✨ ${aiSummary.introQuote}`);
  } else if (state.trip.subtitle) {
    lines.push(state.trip.subtitle);
  }
  lines.push('');

  if (options.includeFlights) {
    lines.push(tripMode === 'flight' ? '🛫 *航班資訊*' : `${tripModeMeta.icon} *${tripModeMeta.zhHeading}*`);
    lines.push(
      `• 去程：${state.outbound.flightNo}｜${state.outbound.departCode} ${state.outbound.departTime} ➔ ${state.outbound.arriveCode} ${state.outbound.arriveTime}`
    );
    lines.push(
      `• 回程：${state.inbound.flightNo}｜${state.inbound.departCode} ${state.inbound.departTime} ➔ ${state.inbound.arriveCode} ${state.inbound.arriveTime}`
    );
    lines.push('');
  }

  if (options.includeStay) {
    const staysList = normalizeStaysList(state);
    lines.push(staysList.length > 1 ? `🏨 *住宿飯店（共 ${staysList.length} 間）*` : '🏨 *住宿飯店*');
    staysList.forEach((s, idx) => {
      const prefix = staysList.length > 1 ? `${idx + 1}. ` : '';
      lines.push(
        `• ${prefix}${s.hotelName || '未命名飯店'}（${s.checkIn} ~ ${s.checkOut}）`
      );
      if (s.address) lines.push(`  地址：${s.address}`);
    });
    lines.push('');
  }

  if (options.includeItinerary) {
    lines.push('🗓️ *每日行程重點*');
    groupedDays.forEach(({ day, items, dayCostJPY }) => {
      lines.push(
        `*${day.label}* (${day.zhDisp})｜預估經費 ¥${dayCostJPY.toLocaleString()}`
      );
      if (items.length === 0) {
        lines.push('  - 自由安排時間');
      } else {
        items.forEach((act) => {
          const costPart = act.cost ? ` · ¥${Number(act.cost).toLocaleString()}` : '';
          lines.push(`  - ${act.time} ${act.title}${costPart}`);
        });
      }
    });
    lines.push('');
  }

  if (options.includeBudgetOverview) {
    lines.push('💰 *經費總結*');
    lines.push(
      `• 總預算：¥${state.totalBudgetJPY.toLocaleString()}（約 ${formatMoney(metrics.totalBudgetConverted, metrics.targetCurrency)}）`
    );
    lines.push(
      `• 已記帳總花費：¥${metrics.totalSpentJPY.toLocaleString()}（約 ${formatMoney(metrics.totalSpentConverted, metrics.targetCurrency)}）`
    );
    lines.push(
      `• 剩餘預算：¥${metrics.remainingBudgetJPY.toLocaleString()}（約 ${formatMoney(metrics.remainingConverted, metrics.targetCurrency)}）`
    );
    metrics.slices.forEach((s) => {
      if (s.amountJPY > 0) {
        lines.push(`  - ${s.emoji} ${s.label}：¥${s.amountJPY.toLocaleString()} (${s.percent}%)`);
      }
    });
    if (useAiCopy && aiSummary?.budgetHighlight) {
      lines.push(`💡 ${aiSummary.budgetHighlight}`);
    }
  }

  return lines.join('\n').trim();
}

// 使用純 Canvas 2D 繪製高解析分享長圖 PNG（支援「清新薄荷手札」與「復古行李箱貼紙」雙主題）
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

async function loadSafeCanvasImage(url?: string): Promise<HTMLImageElement | null> {
  const dataUrl = await inlineImageToDataUrl(url, 800);
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.save();
  drawRoundedRect(ctx, x, y, w, h, r);
  ctx.clip();
  const scale = Math.max(w / img.width, h / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  ctx.drawImage(img, x + (w - drawW) / 2, y + (h - drawH) / 2, drawW, drawH);
  ctx.restore();
}

function truncateCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(out + '…').width > maxWidth) {
    out = out.slice(0, -1);
  }
  return out + '…';
}

export async function renderTripSummaryToPngBlob(
  input: SummaryGeneratorInput
): Promise<Blob> {
  const { state, tripDays, options, theme = 'mint', aiSummary, useAiCopy = true } = input;
  const isSuitcase = theme === 'suitcase';
  const metrics = computeExpenseMetrics(input);
  const groupedDays = groupActivitiesByDay(state.activities, tripDays);

  const width = 840;
  const pad = isSuitcase ? 44 : 32;
  const cardW = width - pad * 2;
  const font = '"Plus Jakarta Sans", "Noto Sans TC", sans-serif';

  const staysList = normalizeStaysList(state);
  const heroSticker = getHeroSticker(input);
  const [heroImg, stayImgs, heroStickerImg] = await Promise.all([
    loadSafeCanvasImage(state.trip.heroPhotoUrl),
    options.includeStay
      ? Promise.all(staysList.map((s) => loadSafeCanvasImage(s.photoUrl)))
      : Promise.resolve([]),
    heroSticker ? loadSafeCanvasImage(heroSticker.imageUrl) : Promise.resolve(null),
  ]);

  const actImgMap = new Map<string, HTMLImageElement | null>();
  const stickerImgMap = new Map<string, HTMLImageElement | null>();
  if (options.includeItinerary) {
    const stickerUrls = new Set<string>();
    state.activities.forEach((act) => {
      const stk = getActivitySticker(act.id, input);
      if (stk?.imageUrl) stickerUrls.add(stk.imageUrl);
    });
    tripDays.forEach((d) => {
      const dStk = getDaySticker(d.index, input);
      if (dStk?.imageUrl) stickerUrls.add(dStk.imageUrl);
    });
    await Promise.all([
      ...state.activities.map(async (act) => {
        if (act.photoUrl && !actImgMap.has(act.photoUrl)) {
          actImgMap.set(act.photoUrl, await loadSafeCanvasImage(act.photoUrl));
        }
      }),
      ...Array.from(stickerUrls).map(async (u) => {
        stickerImgMap.set(u, await loadSafeCanvasImage(u));
      }),
    ]);
  }

  const hasAiIntro = Boolean(useAiCopy && aiSummary);
  let totalH = isSuitcase ? 64 + 260 + 20 : 36 + 340 + 20;
  if (hasAiIntro) totalH += 116 + 20;
  if (options.includeFlights) totalH += 210 + 20;
  if (options.includeStay) totalH += 56 + staysList.length * 134 + 20;
  if (options.includeItinerary) {
    totalH += 68;
    groupedDays.forEach(({ items }) => {
      totalH += 46 + Math.max(1, items.length) * 76 + 18;
    });
    totalH += 20;
  }
  if (options.includeBudgetOverview) {
    totalH += 270 + 20;
    if (options.includeExpenseDetails && state.expenses.length > 0) {
      totalH += 56 + Math.min(state.expenses.length, 24) * 52 + 24;
    }
  }
  totalH += isSuitcase ? 96 : 64;

  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = totalH * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');

  ctx.scale(scale, scale);

  if (isSuitcase) {
    ctx.fillStyle = '#DFD1BD';
    ctx.fillRect(0, 0, width, totalH);

    // Top handle
    drawRoundedRect(ctx, width / 2 - 85, 10, 170, 26, 12);
    ctx.fillStyle = '#3E2A20';
    ctx.fill();
    ctx.strokeStyle = '#6E503E';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Suitcase shell
    drawRoundedRect(ctx, 16, 28, width - 32, totalH - 44, 34);
    ctx.fillStyle = '#E8DAC6';
    ctx.fill();
    ctx.strokeStyle = '#B79C7C';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Kraft interior
    drawRoundedRect(ctx, 30, 44, width - 60, totalH - 76, 22);
    ctx.fillStyle = '#F7EEDD';
    ctx.fill();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = '#CBB799';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    ctx.fillStyle = '#EDF6F1';
    ctx.fillRect(0, 0, width, totalH);
  }

  let y = isSuitcase ? 62 : 32;

  if (isSuitcase) {
    // Scrapbook banner + KPI strip
    drawRoundedRect(ctx, pad, y, cardW, 162, 18);
    ctx.fillStyle = '#EFE2C4';
    ctx.fill();
    ctx.strokeStyle = '#D5C19B';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (heroImg) {
      drawRoundedRect(ctx, pad + 18, y + 18, 126, 126, 8);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      drawCoverImage(ctx, heroImg, pad + 24, y + 24, 114, 96, 4);
    } else {
      drawRoundedRect(ctx, pad + 18, y + 18, 126, 126, 8);
      ctx.fillStyle = '#4F9B96';
      ctx.fill();
    }

    const hx = pad + 164;
    const hw = cardW - 280;
    ctx.fillStyle = '#7C5C42';
    ctx.font = `800 12px ${font}`;
    ctx.fillText(truncateCanvasText(ctx, `${state.trip.memoryTag} · ${state.trip.dateRangeLabel}`, hw), hx, y + 48);
    ctx.fillStyle = '#1E2D3B';
    ctx.font = `900 28px ${font}`;
    ctx.fillText(truncateCanvasText(ctx, state.trip.destinationTitle, hw), hx, y + 86);
    ctx.fillStyle = '#5C4634';
    ctx.font = `600 14px ${font}`;
    ctx.fillText(truncateCanvasText(ctx, state.trip.subtitle, hw), hx, y + 116);

    // Stamp circle on top right
    const stx = pad + cardW - 60;
    const sty = y + 80;
    const stampCode = state.outbound.arriveCode || 'KIX';
    const stampFontSize = stampCode.length > 4 ? 11.5 : stampCode.length === 4 ? 14 : 17;
    ctx.save();
    ctx.strokeStyle = '#B84B39';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(stx, sty, 38, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#B84B39';
    ctx.textAlign = 'center';
    ctx.font = `800 9px ${font}`;
    ctx.fillText('ARRIVED', stx, sty - 16);
    ctx.font = `900 ${stampFontSize}px ${font}`;
    ctx.fillText(stampCode, stx, sty + 6);
    ctx.font = `800 8px ${font}`;
    ctx.fillText('TRAVEL LOG', stx, sty + 22);
    ctx.restore();
    ctx.textAlign = 'left';

    // KPI row
    drawRoundedRect(ctx, pad, y + 174, cardW, 84, 14);
    ctx.fillStyle = '#FBF5E8';
    ctx.fill();
    ctx.strokeStyle = '#DECAA8';
    ctx.stroke();

    const kpis = [
      { label: '旅行天數', val: `${tripDays.length} 天` },
      { label: '行程站點', val: `${state.activities.length} 站` },
      { label: '已記帳花費', val: `¥${metrics.totalSpentJPY.toLocaleString()}` },
      { label: '剩餘預算', val: `¥${metrics.remainingBudgetJPY.toLocaleString()}` },
    ];
    const colW = cardW / 4;
    kpis.forEach((k, idx) => {
      const kx = pad + idx * colW + 20;
      if (idx > 0) {
        ctx.strokeStyle = '#DECAA8';
        ctx.beginPath();
        ctx.moveTo(pad + idx * colW, y + 188);
        ctx.lineTo(pad + idx * colW, y + 244);
        ctx.stroke();
      }
      ctx.fillStyle = '#7C5C42';
      ctx.font = `700 12px ${font}`;
      ctx.fillText(k.label, kx, y + 206);
      ctx.fillStyle = '#2A1F17';
      ctx.font = `900 19px ${font}`;
      ctx.fillText(k.val, kx, y + 234);
    });
    y += 278;
  } else {
    // Mint Hero + KPI Card
    drawRoundedRect(ctx, pad, y, cardW, 340, 26);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = '#DCEAE2';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (heroImg) {
      drawCoverImage(ctx, heroImg, pad, y, cardW, 240, 26);
    } else {
      ctx.save();
      drawRoundedRect(ctx, pad, y, cardW, 240, 26);
      ctx.clip();
      const grad = ctx.createLinearGradient(pad, y, pad + cardW, y + 240);
      grad.addColorStop(0, '#1A5D42');
      grad.addColorStop(1, '#2D7A59');
      ctx.fillStyle = grad;
      ctx.fillRect(pad, y, cardW, 240);
      ctx.restore();
    }

    ctx.save();
    drawRoundedRect(ctx, pad, y, cardW, 240, 26);
    ctx.clip();
    const scrim = ctx.createLinearGradient(0, y + 40, 0, y + 240);
    scrim.addColorStop(0, 'rgba(12,32,24,0.15)');
    scrim.addColorStop(1, 'rgba(12,32,24,0.88)');
    ctx.fillStyle = scrim;
    ctx.fillRect(pad, y, cardW, 240);
    ctx.restore();

    ctx.fillStyle = '#BCEAD5';
    ctx.font = `700 13px ${font}`;
    ctx.fillText(
      truncateCanvasText(ctx, `${state.trip.memoryTag} · ${state.trip.dateRangeLabel}`, cardW - 48),
      pad + 26,
      y + 150
    );
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `900 32px ${font}`;
    ctx.fillText(truncateCanvasText(ctx, state.trip.destinationTitle, cardW - 48), pad + 26, y + 190);
    ctx.fillStyle = '#E4F2EB';
    ctx.font = `500 15px ${font}`;
    ctx.fillText(truncateCanvasText(ctx, state.trip.subtitle, cardW - 48), pad + 26, y + 218);

    const kpis = [
      { label: '旅行天數', val: `${tripDays.length} 天` },
      { label: '行程站點', val: `${state.activities.length} 站` },
      { label: '已記帳花費', val: `¥${metrics.totalSpentJPY.toLocaleString()}` },
      { label: '剩餘預算', val: `¥${metrics.remainingBudgetJPY.toLocaleString()}` },
    ];
    const colW = cardW / 4;
    kpis.forEach((k, idx) => {
      const kx = pad + idx * colW + 24;
      if (idx > 0) {
        ctx.strokeStyle = '#E7F0EB';
        ctx.beginPath();
        ctx.moveTo(pad + idx * colW, y + 258);
        ctx.lineTo(pad + idx * colW, y + 322);
        ctx.stroke();
      }
      ctx.fillStyle = '#547063';
      ctx.font = `700 12px ${font}`;
      ctx.fillText(k.label, kx, y + 276);
      ctx.fillStyle = '#14241D';
      ctx.font = `900 20px ${font}`;
      ctx.fillText(k.val, kx, y + 306);
    });
    y += 360;
  }

  const cardBg = isSuitcase ? '#FBF6EA' : '#FFFFFF';
  const cardBorder = isSuitcase ? '#DECAA8' : '#DCEAE2';
  const headingColor = isSuitcase ? '#2A1F17' : '#14241D';
  const mutedColor = isSuitcase ? '#7C5C42' : '#547063';

  // 1.5 AI Journal Intro Card (when enabled)
  if (hasAiIntro && aiSummary) {
    drawRoundedRect(ctx, pad, y, cardW, 116, 18);
    ctx.fillStyle = isSuitcase ? '#FFF9EE' : '#F4FBF7';
    ctx.fill();
    ctx.strokeStyle = isSuitcase ? '#C9A97E' : '#BCE0CC';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const textMaxW = heroStickerImg ? cardW - 120 : cardW - 44;
    ctx.fillStyle = isSuitcase ? '#B84B39' : '#1A5D42';
    ctx.font = `800 12px ${font}`;
    ctx.fillText(
      truncateCanvasText(ctx, `✨ AI 手札引言 · ${aiSummary.journalTitle}`, textMaxW),
      pad + 20,
      y + 28
    );

    ctx.fillStyle = headingColor;
    ctx.font = `700 13.5px ${font}`;
    const q = aiSummary.introQuote || '';
    const line1 = truncateCanvasText(ctx, q, textMaxW);
    ctx.fillText(line1, pad + 20, y + 54);
    const rem = q.startsWith(line1) ? q.slice(line1.length) : '';
    if (rem) {
      ctx.fillText(truncateCanvasText(ctx, rem, textMaxW), pad + 20, y + 74);
    }
    if (aiSummary.budgetHighlight) {
      ctx.fillStyle = isSuitcase ? '#4F9B96' : '#DF6437';
      ctx.font = `800 12px ${font}`;
      ctx.fillText(
        truncateCanvasText(ctx, `💡 ${aiSummary.budgetHighlight}`, textMaxW),
        pad + 20,
        y + 98
      );
    }

    if (heroStickerImg) {
      ctx.drawImage(heroStickerImg, pad + cardW - 88, y + 22, 68, 68);
    }
    y += 136;
  }

  // 2. Flights / Land & Ferry Transport
  if (options.includeFlights) {
    const tripMode = getTripTransportMode(state.outbound, state.inbound);
    const tripModeMeta = TRANSPORT_MODE_META[tripMode];

    drawRoundedRect(ctx, pad, y, cardW, 210, 20);
    ctx.fillStyle = cardBg;
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.stroke();

    const transportTitle = `${tripModeMeta.icon} ${tripModeMeta.zhHeading}`;
    ctx.fillStyle = headingColor;
    ctx.font = `900 18px ${font}`;
    ctx.fillText(transportTitle, pad + 22, y + 34);
    const titleW = ctx.measureText(transportTitle).width;

    ctx.fillStyle = mutedColor;
    ctx.font = `600 12px ${font}`;
    ctx.fillText(
      truncateCanvasText(
        ctx,
        `${state.trip.airlineLabel} · ${state.trip.baggageLabel}`,
        cardW - 44 - titleW - 14
      ),
      pad + 22 + titleW + 14,
      y + 34
    );

    const legs = [
      { title: '去程', leg: state.outbound, color: isSuitcase ? '#4F9B96' : '#1A5D42', x: pad + 22 },
      { title: '回程', leg: state.inbound, color: isSuitcase ? '#C95A49' : '#DF6437', x: pad + cardW / 2 + 8 },
    ];
    const boxW = cardW / 2 - 30;
    legs.forEach(({ title, leg, color, x }) => {
      const legMeta = TRANSPORT_MODE_META[getLegTransportMode(leg)];
      drawRoundedRect(ctx, x, y + 54, boxW, 134, 14);
      ctx.fillStyle = isSuitcase ? '#FFFFFF' : '#F6FBF8';
      ctx.fill();
      ctx.strokeStyle = cardBorder;
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.font = `800 13px ${font}`;
      ctx.fillText(truncateCanvasText(ctx, `${title} · ${leg.flightNo}`, boxW - 32), x + 16, y + 80);

      const routeLine = `${leg.departCode}  ${legMeta.routeSymbol}  ${leg.arriveCode}`;
      ctx.fillStyle = headingColor;
      ctx.font = `900 ${routeLine.length > 13 ? 19 : 23}px ${font}`;
      ctx.fillText(truncateCanvasText(ctx, routeLine, boxW - 32), x + 16, y + 116);

      ctx.fillStyle = color;
      ctx.font = `800 14px ${font}`;
      ctx.fillText(
        truncateCanvasText(ctx, `${leg.departTime} — ${leg.arriveTime} (${leg.duration})`, boxW - 32),
        x + 16,
        y + 144
      );

      ctx.fillStyle = mutedColor;
      ctx.font = `600 12px ${font}`;
      ctx.fillText(truncateCanvasText(ctx, leg.dateLabel, boxW - 32), x + 16, y + 170);
    });
    y += 230;
  }

  // 3. Stay (支援多間酒店)
  if (options.includeStay) {
    const stayBoxH = 56 + staysList.length * 134;
    drawRoundedRect(ctx, pad, y, cardW, stayBoxH, 20);
    ctx.fillStyle = cardBg;
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.stroke();

    ctx.fillStyle = headingColor;
    ctx.font = `900 18px ${font}`;
    ctx.fillText(
      staysList.length > 1 ? `🏨 住宿飯店資訊（共 ${staysList.length} 間）` : '🏨 住宿飯店資訊',
      pad + 22,
      y + 34
    );

    staysList.forEach((s, idx) => {
      const sy = y + 52 + idx * 134;
      if (idx > 0) {
        ctx.strokeStyle = cardBorder;
        ctx.beginPath();
        ctx.moveTo(pad + 22, sy - 8);
        ctx.lineTo(pad + cardW - 22, sy - 8);
        ctx.stroke();
      }
      const sImg = stayImgs[idx] || null;
      if (sImg) {
        drawCoverImage(ctx, sImg, pad + 22, sy, 168, 114, 12);
      } else {
        drawRoundedRect(ctx, pad + 22, sy, 168, 114, 12);
        ctx.fillStyle = isSuitcase ? '#EFE2C4' : '#E5F2EC';
        ctx.fill();
        ctx.fillStyle = headingColor;
        ctx.font = `800 32px ${font}`;
        ctx.fillText('🏨', pad + 90, sy + 66);
      }

      const sx = pad + 208;
      const sw = cardW - 230;
      const titlePrefix = staysList.length > 1 ? `#${idx + 1} ` : '';
      ctx.fillStyle = headingColor;
      ctx.font = `900 18px ${font}`;
      ctx.fillText(
        truncateCanvasText(ctx, `${titlePrefix}${s.hotelName || '未命名飯店'}`, sw),
        sx,
        sy + 22
      );
      ctx.fillStyle = mutedColor;
      ctx.font = `600 13px ${font}`;
      ctx.fillText(truncateCanvasText(ctx, s.subTitle, sw), sx, sy + 46);
      ctx.fillStyle = isSuitcase ? '#4F9B96' : '#1A5D42';
      ctx.font = `700 13px ${font}`;
      ctx.fillText(
        truncateCanvasText(ctx, `入住 ${s.checkIn} · 退房 ${s.checkOut}`, sw),
        sx,
        sy + 72
      );
      ctx.fillStyle = headingColor;
      ctx.font = `500 12.5px ${font}`;
      ctx.fillText(truncateCanvasText(ctx, `📍 ${s.address}`, sw), sx, sy + 98);
    });

    y += stayBoxH + 20;
  }

  // 4. Itinerary
  if (options.includeItinerary) {
    let itH = 68;
    groupedDays.forEach(({ items }) => {
      itH += 46 + Math.max(1, items.length) * 76 + 18;
    });

    drawRoundedRect(ctx, pad, y, cardW, itH, 20);
    ctx.fillStyle = cardBg;
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.stroke();

    ctx.fillStyle = headingColor;
    ctx.font = `900 18px ${font}`;
    ctx.fillText(isSuitcase ? '🗺️ 每日行程剪貼簿' : '🗺️ 每日圖文行程', pad + 22, y + 36);
    ctx.fillStyle = mutedColor;
    ctx.font = `600 12.5px ${font}`;
    ctx.fillText(
      `共 ${tripDays.length} 天 · ${state.activities.length} 個站點 · 預估 ¥${metrics.activityEstimateJPY.toLocaleString()}`,
      pad + 200,
      y + 36
    );

    let dy = y + 58;
    groupedDays.forEach(({ day, items, dayCostJPY }, dIdx) => {
      const boxH = 44 + Math.max(1, items.length) * 76;
      const dayColor = isSuitcase
        ? SUITCASE_DAY_COLORS[dIdx % SUITCASE_DAY_COLORS.length]
        : '#F3FAF6';

      drawRoundedRect(ctx, pad + 20, dy, cardW - 40, boxH, 14);
      ctx.fillStyle = isSuitcase ? '#FFFFFF' : '#F8FBF9';
      ctx.fill();
      ctx.strokeStyle = cardBorder;
      ctx.stroke();

      if (isSuitcase) {
        drawRoundedRect(ctx, pad + 20, dy, cardW - 40, 38, 14);
        ctx.fillStyle = dayColor;
        ctx.fill();
        ctx.fillRect(pad + 20, dy + 22, cardW - 40, 16);
      }

      ctx.fillStyle = isSuitcase ? '#FFFFFF' : '#1A5D42';
      ctx.font = `900 14px ${font}`;
      const aiDay = aiSummary?.daySummaries?.find((d) => d.dayIndex === day.index);
      const dayTitleText =
        useAiCopy && aiDay?.dayHeadline
          ? `${day.label} · ${day.zhDisp} · ${aiDay.dayHeadline}`
          : `${day.label} · ${day.zhDisp}`;
      ctx.fillText(truncateCanvasText(ctx, dayTitleText, cardW - 210), pad + 36, dy + 26);
      ctx.fillStyle = isSuitcase ? '#FFFFFF' : '#DF6437';
      ctx.font = `800 13px ${font}`;
      const costStr = `當日預估 ¥${dayCostJPY.toLocaleString()}`;
      ctx.fillText(costStr, pad + cardW - 40 - ctx.measureText(costStr).width, dy + 26);

      if (items.length === 0) {
        ctx.fillStyle = mutedColor;
        ctx.font = `500 13px ${font}`;
        ctx.fillText('自由安排時間', pad + 36, dy + 82);
      } else {
        items.forEach((act, idx) => {
          const ay = dy + 48 + idx * 76;
          ctx.fillStyle = headingColor;
          ctx.font = `900 14px ${font}`;
          ctx.fillText(act.time, pad + 36, ay + 28);
          ctx.fillStyle = mutedColor;
          ctx.font = `600 11px ${font}`;
          ctx.fillText(act.duration || '', pad + 36, ay + 46);

          const actImg = act.photoUrl ? actImgMap.get(act.photoUrl) || null : null;
          if (actImg) {
            if (isSuitcase) {
              drawRoundedRect(ctx, pad + 95, ay + 1, 62, 62, 11);
              ctx.fillStyle = '#FFFFFF';
              ctx.fill();
              ctx.strokeStyle = '#DECAA8';
              ctx.stroke();
            }
            drawCoverImage(ctx, actImg, pad + 98, ay + 4, 56, 56, 10);
          } else {
            drawRoundedRect(ctx, pad + 98, ay + 4, 56, 56, 10);
            ctx.fillStyle = isSuitcase ? '#EFE2C4' : '#E3F1EC';
            ctx.fill();
            ctx.fillStyle = headingColor;
            ctx.font = `700 20px ${font}`;
            ctx.fillText('📍', pad + 116, ay + 39);
          }

          const actSticker = getActivitySticker(act.id, input);
          const actStickerImg = actSticker?.imageUrl
            ? stickerImgMap.get(actSticker.imageUrl) || null
            : null;
          const stickerSlotW = actStickerImg ? 64 : 0;

          const tx = pad + 170;
          const tw = cardW - 220 - stickerSlotW;
          ctx.fillStyle = headingColor;
          ctx.font = `800 14.5px ${font}`;
          ctx.fillText(truncateCanvasText(ctx, act.title, tw - 85), tx, ay + 24);
          if (act.cost) {
            ctx.fillStyle = isSuitcase ? '#C95A49' : '#DF6437';
            ctx.font = `800 13px ${font}`;
            const cText = `¥${Number(act.cost).toLocaleString()}`;
            ctx.fillText(
              cText,
              pad + cardW - 40 - stickerSlotW - ctx.measureText(cText).width,
              ay + 24
            );
          }
          const aiAct = aiSummary?.activitySuggestions?.find(
            (a) => a.activityId === act.id
          );
          const subLine =
            useAiCopy && aiAct?.conciseLine
              ? `✍️ ${aiAct.conciseLine}`
              : `${act.location}${act.transport ? ` · ${act.transport}` : ''}`;
          ctx.fillStyle = useAiCopy && aiAct?.conciseLine ? (isSuitcase ? '#6A4B38' : '#1A5D42') : mutedColor;
          ctx.font = `600 12px ${font}`;
          ctx.fillText(truncateCanvasText(ctx, subLine, tw), tx, ay + 46);

          if (actStickerImg) {
            ctx.drawImage(actStickerImg, pad + cardW - 88, ay + 7, 50, 50);
          }
        });
      }

      dy += boxH + 18;
    });
    y += itH + 20;
  }

  // 5. Budget & Expense
  if (options.includeBudgetOverview) {
    const expRows =
      options.includeExpenseDetails && state.expenses.length > 0
        ? Math.min(state.expenses.length, 24)
        : 0;
    const expCardH = 270 + (expRows > 0 ? 56 + expRows * 52 + 24 : 0);

    drawRoundedRect(ctx, pad, y, cardW, expCardH, 20);
    ctx.fillStyle = cardBg;
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.stroke();

    ctx.fillStyle = headingColor;
    ctx.font = `900 18px ${font}`;
    ctx.fillText('💰 旅遊經費與消費分佈', pad + 22, y + 36);
    ctx.fillStyle = mutedColor;
    ctx.font = `600 12.5px ${font}`;
    ctx.fillText(
      `總預算 ¥${state.totalBudgetJPY.toLocaleString()}（約 ${formatMoney(metrics.totalBudgetConverted, metrics.targetCurrency)}）`,
      pad + 230,
      y + 36
    );

    const dcx = pad + 104;
    const dcy = y + 148;
    const dr = 58;
    let startAngle = -Math.PI / 2;
    const nonZero = metrics.slices.filter((s) => s.amountJPY > 0);
    if (metrics.totalSpentJPY > 0 && nonZero.length > 0) {
      nonZero.forEach((s) => {
        const angle = (s.amountJPY / metrics.totalSpentJPY) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(dcx, dcy, dr, startAngle, startAngle + angle);
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 22;
        ctx.stroke();
        startAngle += angle;
      });
    } else {
      ctx.beginPath();
      ctx.arc(dcx, dcy, dr, 0, Math.PI * 2);
      ctx.strokeStyle = isSuitcase ? '#EFE2CA' : '#DCEAE2';
      ctx.lineWidth = 22;
      ctx.stroke();
    }
    ctx.fillStyle = mutedColor;
    ctx.font = `700 11px ${font}`;
    ctx.textAlign = 'center';
    ctx.fillText('總支出', dcx, dcy - 4);
    ctx.fillStyle = headingColor;
    ctx.font = `900 14px ${font}`;
    ctx.fillText(`¥${metrics.totalSpentJPY.toLocaleString()}`, dcx, dcy + 14);
    ctx.textAlign = 'left';

    const bx = pad + 206;
    const bw = cardW - 232;
    metrics.slices.forEach((s, idx) => {
      const by = y + 72 + idx * 42;
      ctx.fillStyle = headingColor;
      ctx.font = `700 13px ${font}`;
      ctx.fillText(`${s.emoji} ${s.label}`, bx, by + 12);

      const valLabel = `¥${s.amountJPY.toLocaleString()} (${s.percent}%)`;
      ctx.fillStyle = mutedColor;
      ctx.font = `700 12.5px ${font}`;
      ctx.fillText(valLabel, bx + bw - ctx.measureText(valLabel).width, by + 12);

      drawRoundedRect(ctx, bx, by + 20, bw, 8, 4);
      ctx.fillStyle = isSuitcase ? '#EFE2CA' : '#ECF3EF';
      ctx.fill();
      if (s.percent > 0) {
        drawRoundedRect(ctx, bx, by + 20, Math.max(8, (bw * s.percent) / 100), 8, 4);
        ctx.fillStyle = s.color;
        ctx.fill();
      }
    });

    ctx.fillStyle = isSuitcase ? '#4F9B96' : '#1A5D42';
    ctx.font = `800 13px ${font}`;
    ctx.fillText(
      `已花費 ¥${metrics.totalSpentJPY.toLocaleString()} (${formatMoney(metrics.totalSpentConverted, metrics.targetCurrency)})  ·  剩餘 ¥${metrics.remainingBudgetJPY.toLocaleString()}`,
      bx,
      y + 250
    );

    if (expRows > 0) {
      let ey = y + 290;
      ctx.fillStyle = headingColor;
      ctx.font = `800 15px ${font}`;
      ctx.fillText(`🛍️ 購物與消費明細（顯示前 ${expRows} 筆）`, pad + 22, ey);
      ey += 22;

      state.expenses.slice(0, expRows).forEach((exp) => {
        const cat = CATEGORY_META[exp.category] || CATEGORY_META.shopping;
        drawRoundedRect(ctx, pad + 22, ey, cardW - 44, 44, 10);
        ctx.fillStyle = isSuitcase ? '#FFFFFF' : '#F8FBF9';
        ctx.fill();
        ctx.strokeStyle = cardBorder;
        ctx.stroke();

        ctx.fillStyle = headingColor;
        ctx.font = `700 13px ${font}`;
        ctx.fillText(
          truncateCanvasText(
            ctx,
            `${cat.emoji} ${exp.title}${exp.quantity && exp.quantity > 1 ? ` ×${exp.quantity}` : ''} · ${exp.shopOrNote || ''}`,
            cardW - 190
          ),
          pad + 36,
          ey + 27
        );
        ctx.fillStyle = headingColor;
        ctx.font = `900 13px ${font}`;
        const jpyText = `¥${Number(exp.amountJPY).toLocaleString()}`;
        ctx.fillText(jpyText, pad + cardW - 40 - ctx.measureText(jpyText).width, ey + 27);
        ey += 52;
      });
    }

    y += expCardH + 20;
  }

  if (isSuitcase) {
    const badges = [
      { text: 'TRAVEL', bg: '#C95A49', x: pad },
      { text: 'GOOD TRIP!', bg: '#4F9B96', x: pad + 102 },
      { text: "LET'S GO!", bg: '#D99B38', x: pad + 230 },
    ];
    badges.forEach((b) => {
      drawRoundedRect(ctx, b.x, y, 94, 28, 8);
      ctx.fillStyle = b.bg;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `900 11px ${font}`;
      ctx.textAlign = 'center';
      ctx.fillText(b.text, b.x + 47, y + 18);
    });
    ctx.textAlign = 'right';
    ctx.fillStyle = '#7C5C42';
    ctx.font = `600 12px ${font}`;
    ctx.fillText('去旅行啦 Amazing Travel PWA', pad + cardW, y + 18);
    ctx.textAlign = 'left';
  } else {
    ctx.fillStyle = '#6B8579';
    ctx.font = `600 12px ${font}`;
    ctx.textAlign = 'center';
    ctx.fillText('由「去旅行啦 Amazing Travel PWA」一鍵生成', width / 2, y + 24);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('無法匯出 PNG 圖片'));
    }, 'image/png');
  });
}
