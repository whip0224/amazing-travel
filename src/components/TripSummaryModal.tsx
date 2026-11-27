import React, { useMemo, useRef, useState } from 'react';
import {
  X,
  Printer,
  Image as ImageIcon,
  MessageSquare,
  PlaneTakeoff,
  BedDouble,
  MapPin,
  Wallet,
  Check,
  Loader2,
  FileCode2,
  Palette,
  Sparkles,
  Sticker,
  Upload,
  Trash2,
  RotateCcw,
  Wand2,
} from 'lucide-react';
import type {
  TabiState,
  ExpenseCategoryKey,
  StickerCategory,
  StickerItem,
} from '../types/tabi';
import type { DailyWeatherForecast } from '../utils/weatherService';
import {
  DEFAULT_STICKERS,
  compressStickerUpload,
  pickFallbackStickerForActivity,
} from '../utils/defaultStickers';
import {
  generateJournalSummaryWithGemini,
  type JournalSummaryAIResult,
} from '../utils/geminiClient';
import {
  buildWhatsAppSummaryText,
  computeExpenseMetrics,
  downloadTextFile,
  generateTripSummaryHtml,
  groupActivitiesByDay,
  printTripSummaryHtml,
  renderTripSummaryToPngBlob,
  resolveStickerByIdOrName,
  SUITCASE_DAY_COLORS,
  type SummaryDayItem,
  type SummarySectionOptions,
  type SummaryTheme,
} from '../utils/tripSummaryExporter';
import {
  TRANSPORT_MODE_META,
  getLegTransportMode,
  getTripTransportMode,
} from '../utils/landTransportPresets';
import { getStayNights, normalizeStaysList } from '../utils/stayHelpers';

interface TripSummaryModalProps {
  open: boolean;
  onClose: () => void;
  state: TabiState;
  tripDays: SummaryDayItem[];
  weatherByDate: Record<string, DailyWeatherForecast>;
  convertAmount: (amount: number, fromCode: string, toCode: string) => number;
  stickers: StickerItem[];
  onUpdateStickers: React.Dispatch<React.SetStateAction<StickerItem[]>>;
  onToast: (msg: string) => void;
}

const EXPENSE_BADGES: Record<
  ExpenseCategoryKey,
  { label: string; emoji: string; color: string; suitcaseColor: string; bg: string }
> = {
  shopping: {
    label: '購物',
    emoji: '🛍️',
    color: '#DF6437',
    suitcaseColor: '#E37868',
    bg: '#FCE8DF',
  },
  dining: {
    label: '餐飲',
    emoji: '🍜',
    color: '#1A5D42',
    suitcaseColor: '#4F9B96',
    bg: '#DFF3E9',
  },
  transport: {
    label: '交通',
    emoji: '🚆',
    color: '#2563EB',
    suitcaseColor: '#5B7C99',
    bg: '#E3ECFD',
  },
  gifts: {
    label: '伴手禮',
    emoji: '🎁',
    color: '#D97706',
    suitcaseColor: '#D99B38',
    bg: '#FEF3C7',
  },
};

const STICKER_CATEGORY_LABELS: Record<StickerCategory, string> = {
  food: '美食',
  cafe: '咖啡甜點',
  shrine: '神社古寺',
  shopping: '逛街購物',
  transport: '交通電車',
  landmark: '風景打卡',
  decor: '旅遊裝飾',
};

export const TripSummaryModal: React.FC<TripSummaryModalProps> = ({
  open,
  onClose,
  state,
  tripDays,
  weatherByDate,
  convertAmount,
  stickers,
  onUpdateStickers,
  onToast,
}) => {
  const [theme, setTheme] = useState<SummaryTheme>('mint');
  const [presetMode, setPresetMode] = useState<'personal' | 'whatsapp'>('personal');
  const [options, setOptions] = useState<SummarySectionOptions>({
    includeFlights: true,
    includeStay: true,
    includeItinerary: true,
    includeBudgetOverview: true,
    includeExpenseDetails: true,
  });
  const [busyAction, setBusyAction] = useState<'html' | 'pdf' | 'png' | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  // 貼紙庫選取、自訂上傳與 AI 手札文案配對狀態
  const [showStickerPanel, setShowStickerPanel] = useState(false);
  const [disabledStickerIds, setDisabledStickerIds] = useState<Record<string, boolean>>({});
  const [newStickerName, setNewStickerName] = useState('');
  const [newStickerCategory, setNewStickerCategory] = useState<StickerCategory>('food');
  const [isUploadingSticker, setIsUploadingSticker] = useState(false);
  const stickerFileInputRef = useRef<HTMLInputElement>(null);

  const [aiSummary, setAiSummary] = useState<JournalSummaryAIResult | null>(null);
  const [useAiCopy, setUseAiCopy] = useState(true);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [heroStickerId, setHeroStickerId] = useState<string>('');
  const [dayStickerMap, setDayStickerMap] = useState<Record<number, string>>({});
  const [activityStickerMap, setActivityStickerMap] = useState<Record<string, string>>({});
  const [editingStickerActivityId, setEditingStickerActivityId] = useState<string | null>(null);

  const activeStickers = useMemo(
    () => stickers.filter((s) => !disabledStickerIds[s.id]),
    [stickers, disabledStickerIds]
  );

  const metrics = useMemo(
    () =>
      computeExpenseMetrics({
        state,
        tripDays,
        weatherByDate,
        convertAmount,
        options,
        theme,
      }),
    [state, tripDays, weatherByDate, convertAmount, options, theme]
  );

  const groupedDays = useMemo(
    () => groupActivitiesByDay(state.activities, tripDays),
    [state.activities, tripDays]
  );

  const staysList = useMemo(
    () => normalizeStaysList(state),
    [state.stay, state.stays, state.trip.startDate, state.trip.endDate]
  );

  if (!open) return null;

  const isSuitcase = theme === 'suitcase';
  const tripTransportMode = getTripTransportMode(state.outbound, state.inbound);
  const tripModeMeta = TRANSPORT_MODE_META[tripTransportMode];
  const arriveStampCode = state.outbound.arriveCode || 'KIX';

  const summaryExportInput = {
    state,
    tripDays,
    weatherByDate,
    convertAmount,
    options,
    theme,
    stickers,
    aiSummary,
    useAiCopy,
    activityStickerMap,
    dayStickerMap,
    heroStickerId,
  };

  const applyPreset = (mode: 'personal' | 'whatsapp') => {
    setPresetMode(mode);
    if (mode === 'personal') {
      setOptions({
        includeFlights: true,
        includeStay: true,
        includeItinerary: true,
        includeBudgetOverview: true,
        includeExpenseDetails: true,
      });
    } else {
      setOptions({
        includeFlights: true,
        includeStay: true,
        includeItinerary: true,
        includeBudgetOverview: true,
        includeExpenseDetails: false,
      });
    }
  };

  const toggleOption = (key: keyof SummarySectionOptions) => {
    setOptions((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (key === 'includeBudgetOverview' && !next.includeBudgetOverview) {
        next.includeExpenseDetails = false;
      }
      if (key === 'includeExpenseDetails' && next.includeExpenseDetails) {
        next.includeBudgetOverview = true;
      }
      return next;
    });
  };

  const safeSlug = (state.trip.destinationTitle || 'travel-summary')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-')
    .replace(/^-+|-+$/g, '');

  const toggleStickerEnabled = (id: string) => {
    setDisabledStickerIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleStickerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setIsUploadingSticker(true);
    try {
      const created: StickerItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const dataUrl = await compressStickerUpload(file, 360);
        const baseName = file.name.replace(/\.[^.]+$/, '').slice(0, 18) || `自訂貼紙 ${i + 1}`;
        const label =
          files.length === 1 && newStickerName.trim()
            ? newStickerName.trim()
            : baseName;
        created.push({
          id: `stk-custom-${Date.now()}-${i}`,
          name: label,
          category: newStickerCategory,
          keywords: [label],
          imageUrl: dataUrl,
          isCustom: true,
        });
      }
      onUpdateStickers((prev) => [...created, ...prev]);
      setNewStickerName('');
      onToast(`已新增 ${created.length} 張貼紙到貼紙庫`);
    } catch (err: any) {
      onToast(err?.message || '上傳貼紙失敗，請確認圖片格式');
    } finally {
      setIsUploadingSticker(false);
      if (stickerFileInputRef.current) {
        stickerFileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveSticker = (id: string) => {
    if (stickers.length <= 1) {
      onToast('貼紙庫至少需保留 1 張貼紙');
      return;
    }
    onUpdateStickers((prev) => prev.filter((s) => s.id !== id));
    setActivityStickerMap((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (next[k] === id) delete next[k];
      });
      return next;
    });
    if (heroStickerId === id) setHeroStickerId('');
    onToast('已從貼紙庫移除該貼紙');
  };

  const handleResetDefaultStickers = () => {
    onUpdateStickers(DEFAULT_STICKERS);
    setDisabledStickerIds({});
    onToast('已還原內建預設貼紙插畫庫');
  };

  const handleAutoAssignLocalStickers = () => {
    if (activeStickers.length === 0) {
      onToast('請先在「選擇貼紙」至少啟用 1 張貼紙');
      setShowStickerPanel(true);
      return;
    }
    const nextActMap: Record<string, string> = {};
    state.activities.forEach((act) => {
      const picked = pickFallbackStickerForActivity(act, activeStickers);
      if (picked) nextActMap[act.id] = picked.id;
    });
    const nextDayMap: Record<number, string> = {};
    groupedDays.forEach(({ day, items }) => {
      const firstAct = items[0];
      if (firstAct && nextActMap[firstAct.id]) {
        nextDayMap[day.index] = nextActMap[firstAct.id];
      } else {
        nextDayMap[day.index] = activeStickers[day.index % activeStickers.length].id;
      }
    });
    setActivityStickerMap(nextActMap);
    setDayStickerMap(nextDayMap);
    setHeroStickerId(activeStickers[0].id);
    onToast('已依景點關鍵字自動套用貼紙！');
  };

  const handleGenerateAiJournal = async () => {
    if (activeStickers.length === 0) {
      setShowStickerPanel(true);
      onToast('請先在「選擇貼紙」至少勾選 1 張貼紙供 AI 配對');
      return;
    }
    setIsGeneratingAI(true);
    setAiError(null);
    try {
      const res = await generateJournalSummaryWithGemini({
        tripMeta: {
          destinationTitle: state.trip.destinationTitle,
          subtitle: state.trip.subtitle,
          dateRangeLabel: state.trip.dateRangeLabel,
          hotelName:
            staysList
              .map((s) => s.hotelName)
              .filter(Boolean)
              .join(' / ') || state.stay.hotelName,
          totalBudgetJPY: state.totalBudgetJPY,
          totalSpentJPY: metrics.totalSpentJPY,
          remainingBudgetJPY: metrics.remainingBudgetJPY,
          targetCurrency: metrics.targetCurrency,
        },
        days: groupedDays.map(({ day, items, dayCostJPY }) => ({
          dayIndex: day.index,
          label: day.label,
          zhDisp: day.zhDisp,
          dayCostJPY,
          stopCount: items.length,
        })),
        activities: state.activities.map((a) => ({
          activityId: a.id,
          dayIndex: a.dayIndex,
          time: a.time,
          title: a.title,
          kicker: a.kicker,
          location: a.location,
          note: a.note,
          cost: a.cost || 0,
        })),
        stickers: activeStickers.map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category,
          keywords: s.keywords || [],
        })),
      });

      if (!res.ok || !res.data) {
        const msg = res.errorMessage || 'AI 生成手札文案失敗，您仍可使用本地關鍵字自動配對貼紙。';
        setAiError(msg);
        onToast(msg);
        return;
      }

      const data = res.data;
      setAiSummary(data);
      setUseAiCopy(true);

      const resolvedHero =
        resolveStickerByIdOrName(activeStickers, data.heroStickerId) || activeStickers[0];
      if (resolvedHero) setHeroStickerId(resolvedHero.id);

      const nextDayMap: Record<number, string> = {};
      (data.daySummaries || []).forEach((d) => {
        const matched = resolveStickerByIdOrName(activeStickers, d.dayStickerId);
        if (matched) nextDayMap[d.dayIndex] = matched.id;
      });
      setDayStickerMap(nextDayMap);

      const nextActMap: Record<string, string> = {};
      state.activities.forEach((act) => {
        const sug = (data.activitySuggestions || []).find((s) => s.activityId === act.id);
        const matched =
          (sug &&
            (resolveStickerByIdOrName(activeStickers, sug.stickerId) ||
              resolveStickerByIdOrName(activeStickers, sug.stickerName))) ||
          pickFallbackStickerForActivity(act, activeStickers);
        if (matched) nextActMap[act.id] = matched.id;
      });
      setActivityStickerMap(nextActMap);
      onToast('✨ AI 已完成手札文案精煉並為各景點插入貼紙！');
    } catch {
      const msg = '呼叫 AI 服務時發生錯誤，已保留原有離線預覽功能。';
      setAiError(msg);
      onToast(msg);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleDownloadHtml = async () => {
    setBusyAction('html');
    try {
      const html = await generateTripSummaryHtml(summaryExportInput);
      downloadTextFile(
        `${safeSlug || 'trip'}-${theme}-summary.html`,
        html,
        'text/html;charset=utf-8'
      );
      onToast(
        isSuitcase
          ? '已匯出「復古行李箱貼紙風」離線圖文 HTML'
          : '已匯出「清新薄荷手札風」離線圖文 HTML'
      );
    } catch {
      onToast('匯出 HTML 失敗，請稍後再試');
    } finally {
      setBusyAction(null);
    }
  };

  const handlePrintPdf = async () => {
    setBusyAction('pdf');
    try {
      const html = await generateTripSummaryHtml(summaryExportInput);
      printTripSummaryHtml(html);
      onToast('已開啟列印視窗，可選擇「另存為 PDF」');
    } catch {
      onToast('開啟 PDF 列印失敗，請稍後再試');
    } finally {
      setBusyAction(null);
    }
  };

  const handleExportPng = async () => {
    setBusyAction('png');
    try {
      const blob = await renderTripSummaryToPngBlob(summaryExportInput);
      const filename = `${safeSlug || 'trip'}-${theme}-summary.png`;
      const file = new File([blob], filename, { type: 'image/png' });

      if (
        typeof navigator !== 'undefined' &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        try {
          await navigator.share({
            files: [file],
            title: `${state.trip.destinationTitle} 旅程總結`,
          });
          onToast('已呼叫系統分享長圖 PNG');
          return;
        } catch {
          // User cancelled share or unsupported; fall back to direct download
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      onToast('已下載高畫質長圖 PNG，可直接發到 WhatsApp 群組');
    } catch {
      onToast('匯出長圖 PNG 失敗，請改用 HTML 或 PDF');
    } finally {
      setBusyAction(null);
    }
  };

  const handleCopyWhatsApp = async () => {
    const text = buildWhatsAppSummaryText(summaryExportInput);
    try {
      await navigator.clipboard.writeText(text);
      onToast('已複製 WhatsApp 行程與經費摘要，可直接貼到群組');
    } catch {
      onToast('無法存取剪貼簿，請改用長圖 PNG 或下載 HTML');
    }
  };

  const markBroken = (key: string) => {
    setBrokenImages((prev) => ({ ...prev, [key]: true }));
  };

  const resolvePreviewHeroSticker = (): StickerItem | null => {
    const id = heroStickerId || aiSummary?.heroStickerId;
    return resolveStickerByIdOrName(stickers, id);
  };

  const resolvePreviewDaySticker = (dayIndex: number): StickerItem | null => {
    const manual = dayStickerMap[dayIndex];
    if (manual) return resolveStickerByIdOrName(stickers, manual);
    const aiDay = aiSummary?.daySummaries?.find((d) => d.dayIndex === dayIndex);
    return resolveStickerByIdOrName(stickers, aiDay?.dayStickerId);
  };

  const resolvePreviewActSticker = (actId: string): StickerItem | null => {
    const manual = activityStickerMap[actId];
    if (manual) return resolveStickerByIdOrName(stickers, manual);
    const sug = aiSummary?.activitySuggestions?.find((s) => s.activityId === actId);
    if (!sug) return null;
    return (
      resolveStickerByIdOrName(stickers, sug.stickerId) ||
      resolveStickerByIdOrName(stickers, sug.stickerName)
    );
  };

  const previewHeroSticker = resolvePreviewHeroSticker();

  const donutCircumference = 2 * Math.PI * 44;
  let donutOffset = 0;

  return (
    <div
      className="fixed inset-0 z-[210] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
      data-no-flip="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full sm:max-w-3xl max-h-[92vh] rounded-t-3xl sm:rounded-3xl shadow-2xl border flex flex-col overflow-hidden transition-colors ${
          isSuitcase
            ? 'bg-[#DFD1BD] border-[#B79C7C]'
            : 'bg-[#EDF6F1] border-[#CFE3D8]'
        }`}
      >
        {/* Top Modal Header */}
        <div className="bg-white/95 backdrop-blur-md px-5 py-3 border-b border-[#DCEAE2] flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="text-[17px] font-black text-[#14241D] truncate">
              一鍵旅程總結與匯出
            </h2>
            <p className="text-[12px] text-[#547063] truncate">
              自由切換版面風格與區塊 · 匯出離線圖文 HTML、PDF 與長圖
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉總結預覽"
            className="min-w-[44px] min-h-[44px] rounded-full bg-[#F2F8F5] hover:bg-[#E1EFE8] text-[#2B453A] flex items-center justify-center transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Style Switcher + Preset & Section Filter Controls */}
        <div className="bg-white px-5 py-3 border-b border-[#DCEAE2] space-y-2.5 shrink-0">
          {/* 風格切換按鈕 */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-center gap-1.5 text-[12px] font-extrabold text-[#476357] shrink-0">
              <Palette className="w-3.5 h-3.5 text-[#1A5D42]" />
              <span>手札風格</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#F3F5F2] rounded-xl flex-1">
              <button
                type="button"
                onClick={() => setTheme('mint')}
                className={`min-h-[38px] px-3 py-1.5 rounded-lg text-[12px] font-extrabold transition whitespace-nowrap truncate ${
                  theme === 'mint'
                    ? 'bg-[#1A5D42] text-white shadow-xs'
                    : 'text-[#4F6B5D] hover:text-[#14241D]'
                }`}
              >
                🌿 清新薄荷手札
              </button>
              <button
                type="button"
                onClick={() => setTheme('suitcase')}
                className={`min-h-[38px] px-3 py-1.5 rounded-lg text-[12px] font-extrabold transition whitespace-nowrap truncate ${
                  theme === 'suitcase'
                    ? 'bg-[#6A4B38] text-[#FFF9EE] shadow-xs'
                    : 'text-[#6E5845] hover:text-[#2A1F17]'
                }`}
              >
                🧳 復古行李箱貼紙
              </button>
            </div>
          </div>

          {/* 分享對象模式 */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#EDF6F1] rounded-xl">
            <button
              type="button"
              onClick={() => applyPreset('personal')}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg text-[12px] font-extrabold transition whitespace-nowrap truncate ${
                presetMode === 'personal'
                  ? 'bg-white text-[#14241D] shadow-xs'
                  : 'text-[#4F6B5D] hover:text-[#14241D]'
              }`}
            >
              自己留存完整版
            </button>
            <button
              type="button"
              onClick={() => applyPreset('whatsapp')}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg text-[12px] font-extrabold transition whitespace-nowrap truncate ${
                presetMode === 'whatsapp'
                  ? 'bg-white text-[#1A5D42] shadow-xs'
                  : 'text-[#4F6B5D] hover:text-[#14241D]'
              }`}
            >
              WhatsApp 群組（行程＋經費）
            </button>
          </div>

          {/* 區塊勾選 */}
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                {
                  key: 'includeFlights',
                  label:
                    tripTransportMode === 'flight'
                      ? '來回航班'
                      : `來回${tripModeMeta.shortLabel}`,
                },
                { key: 'includeStay', label: '住宿飯店' },
                { key: 'includeItinerary', label: '每日圖文行程' },
                { key: 'includeBudgetOverview', label: '經費總覽與圖表' },
                { key: 'includeExpenseDetails', label: '購物消費明細' },
              ] as const
            ).map((item) => {
              const active = options[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => toggleOption(item.key)}
                  className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11.5px] font-bold flex items-center gap-1.5 border transition whitespace-nowrap ${
                    active
                      ? isSuitcase
                        ? 'bg-[#F5E8D0] border-[#C9AF89] text-[#4A3224]'
                        : 'bg-[#E2F3EA] border-[#9AD8BA] text-[#144B34]'
                      : 'bg-[#F8FBF9] border-[#DCEAE2] text-[#647D71]'
                  }`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center ${
                      active
                        ? isSuitcase
                          ? 'bg-[#6A4B38] text-white'
                          : 'bg-[#1A5D42] text-white'
                        : 'bg-white border border-[#BFD3C9] text-transparent'
                    }`}
                  >
                    <Check className="w-2.5 h-2.5" />
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* 貼紙庫管理 + AI 手札文案生成操作列 */}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => setShowStickerPanel((v) => !v)}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl text-[12px] font-extrabold flex items-center gap-1.5 border transition whitespace-nowrap ${
                showStickerPanel
                  ? isSuitcase
                    ? 'bg-[#6A4B38] border-[#4A3224] text-white'
                    : 'bg-[#1A5D42] border-[#134631] text-white'
                  : 'bg-[#F7FAF8] border-[#CFE3D8] text-[#1E3B2E] hover:bg-[#EAF4EF]'
              }`}
            >
              <Sticker className="w-3.5 h-3.5" />
              <span>
                選擇貼紙 ({activeStickers.length}/{stickers.length})
              </span>
            </button>

            <button
              type="button"
              disabled={isGeneratingAI}
              onClick={handleGenerateAiJournal}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-[12px] font-extrabold flex items-center gap-1.5 shadow-xs transition whitespace-nowrap disabled:opacity-60 ${
                isSuitcase
                  ? 'bg-gradient-to-r from-[#C95A49] to-[#D99B38] text-white hover:brightness-105'
                  : 'bg-gradient-to-r from-[#1A5D42] to-[#2B8A63] text-white hover:brightness-105'
              }`}
            >
              {isGeneratingAI ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>
                {isGeneratingAI
                  ? 'AI 撰寫手札與配對貼紙中...'
                  : aiSummary
                  ? '重新生成 AI 文案與貼紙'
                  : 'AI 生成手札文案與配對貼紙'}
              </span>
            </button>

            {aiSummary && (
              <button
                type="button"
                onClick={() => setUseAiCopy((v) => !v)}
                className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-bold border transition whitespace-nowrap ${
                  useAiCopy
                    ? 'bg-[#E6F5ED] border-[#9AD8BA] text-[#144B34]'
                    : 'bg-[#F4F6F5] border-[#DCE5E0] text-[#547063]'
                }`}
              >
                {useAiCopy ? '✓ 顯示 AI 精煉文案' : '已切回原始備註'}
              </button>
            )}
          </div>

          {aiError && (
            <div className="text-[11.5px] font-bold text-[#A83815] bg-[#FDF1EC] border border-[#F5C6B8] rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2">
              <span className="flex-1 min-w-0">{aiError}</span>
              <button
                type="button"
                onClick={handleAutoAssignLocalStickers}
                className="px-2.5 py-1 rounded-lg bg-white border border-[#E7B6A6] text-[#8E2E11] text-[11px] font-extrabold shrink-0"
              >
                🪄 改用本地關鍵字配貼紙
              </button>
            </div>
          )}

          {/* 展開「選擇貼紙」與自訂上傳抽屜 */}
          {showStickerPanel && (
            <div className="rounded-2xl bg-[#F8FBF9] border border-[#CFE3D8] p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[12px] font-extrabold text-[#14241D]">
                  貼紙插畫庫（勾選啟用貼紙，AI 與自動配對將從中挑選並渲染至手札）
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleAutoAssignLocalStickers}
                    className="px-2.5 py-1 rounded-lg bg-[#E3F1EC] hover:bg-[#d2e7df] text-[#144B34] text-[11px] font-extrabold flex items-center gap-1"
                  >
                    <Wand2 className="w-3 h-3" />
                    <span>依關鍵字一鍵貼上</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetDefaultStickers}
                    className="px-2 py-1 rounded-lg bg-white border border-[#DCEAE2] text-[#547063] hover:text-[#14241D] text-[11px] font-bold flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>還原預設</span>
                  </button>
                </div>
              </div>

              {/* 貼紙列表 */}
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-44 overflow-y-auto tabi-scroll pr-1">
                {stickers.map((stk) => {
                  const enabled = !disabledStickerIds[stk.id];
                  return (
                    <div
                      key={stk.id}
                      onClick={() => toggleStickerEnabled(stk.id)}
                      className={`relative rounded-xl p-1.5 border cursor-pointer flex flex-col items-center gap-1 transition ${
                        enabled
                          ? 'bg-white border-[#68C39F] shadow-2xs'
                          : 'bg-[#F0F4F2] border-[#DCE5E0] opacity-55'
                      }`}
                    >
                      <span
                        className={`absolute top-1 left-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                          enabled
                            ? 'bg-[#1A5D42] text-white'
                            : 'bg-white border border-[#BFD3C9] text-transparent'
                        }`}
                      >
                        <Check className="w-2.5 h-2.5" />
                      </span>
                      {stk.isCustom && (
                        <button
                          type="button"
                          aria-label={`移除 ${stk.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveSticker(stk.id);
                          }}
                          className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#FCE3DA] text-[#B53D1B] flex items-center justify-center hover:bg-[#f7c8b8]"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      )}
                      <img
                        src={stk.imageUrl}
                        alt={stk.name}
                        className="w-11 h-11 object-contain mt-1"
                      />
                      <span className="text-[10px] font-extrabold text-[#14241D] truncate w-full text-center">
                        {stk.name}
                      </span>
                      <span className="text-[9px] text-[#547063]">
                        {STICKER_CATEGORY_LABELS[stk.category] || stk.category}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* 上傳自訂貼紙 (PNG 透明去背圖自動保留透明背景) */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E2EFE8]">
                <input
                  type="text"
                  value={newStickerName}
                  onChange={(e) => setNewStickerName(e.target.value)}
                  placeholder="新貼紙名稱 (選填，如：史努比 / 拉麵)"
                  className="flex-1 min-w-[140px] px-2.5 py-1.5 rounded-lg bg-white border border-[#CFE3D8] text-[11.5px] font-bold text-[#14241D] placeholder:text-[#758C81] focus:outline-none focus:border-[#1A5D42]"
                />
                <select
                  value={newStickerCategory}
                  onChange={(e) => setNewStickerCategory(e.target.value as StickerCategory)}
                  className="px-2 py-1.5 rounded-lg bg-white border border-[#CFE3D8] text-[11.5px] font-bold text-[#14241D]"
                >
                  {(Object.keys(STICKER_CATEGORY_LABELS) as StickerCategory[]).map((cat) => (
                    <option key={cat} value={cat}>
                      {STICKER_CATEGORY_LABELS[cat]}
                    </option>
                  ))}
                </select>
                <input
                  ref={stickerFileInputRef}
                  type="file"
                  accept="image/png,image/webp,image/jpeg,image/svg+xml"
                  multiple
                  onChange={handleStickerUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isUploadingSticker}
                  onClick={() => stickerFileInputRef.current?.click()}
                  className="min-h-[34px] px-3 py-1.5 rounded-lg bg-[#1A5D42] hover:bg-[#134631] text-white text-[11.5px] font-extrabold flex items-center gap-1.5 shrink-0 disabled:opacity-60"
                >
                  {isUploadingSticker ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span>上傳自訂貼紙 PNG</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Visual Preview Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 tabi-scroll">
          <div
            className={
              isSuitcase
                ? 'mx-auto space-y-3'
                : 'space-y-4'
            }
          >
            {/* 行李箱頂部手把 (Suitcase 風格專屬) */}
            {isSuitcase && (
              <div className="w-36 h-5 mx-auto -mb-4 rounded-t-xl bg-gradient-to-b from-[#4B3427] to-[#2E1E16] border-2 border-[#6E503E] shadow-sm relative z-10" />
            )}

            <div
              className={
                isSuitcase
                  ? 'relative rounded-[28px] bg-gradient-to-b from-[#EFE3CF] to-[#E3D2BA] border-[3px] border-[#B79C7C] p-3 sm:p-4 shadow-lg overflow-hidden'
                  : 'space-y-4'
              }
            >
              {/* 行李箱四個皮革護角 */}
              {isSuitcase && (
                <>
                  <span className="pointer-events-none absolute -top-1 -left-1 w-8 h-8 rounded-br-2xl bg-[#6A4B38] border-2 border-[#4A3224] z-10" />
                  <span className="pointer-events-none absolute -top-1 -right-1 w-8 h-8 rounded-bl-2xl bg-[#6A4B38] border-2 border-[#4A3224] z-10" />
                  <span className="pointer-events-none absolute -bottom-1 -left-1 w-8 h-8 rounded-tr-2xl bg-[#6A4B38] border-2 border-[#4A3224] z-10" />
                  <span className="pointer-events-none absolute -bottom-1 -right-1 w-8 h-8 rounded-tl-2xl bg-[#6A4B38] border-2 border-[#4A3224] z-10" />
                </>
              )}

              <div
                className={
                  isSuitcase
                    ? 'rounded-[20px] bg-[#F7EEDD] border border-dashed border-[#CBB799] p-3.5 sm:p-4 space-y-4'
                    : 'space-y-4'
                }
              >
                {/* 1. Hero + KPI Summary */}
                {isSuitcase ? (
                  <div className="space-y-3">
                    <div className="rounded-2xl bg-[#EFE2C4] border-2 border-[#D5C19B] p-4 grid grid-cols-1 sm:grid-cols-[106px_1fr_82px] gap-3 items-center shadow-xs">
                      <div className="w-24 sm:w-full mx-auto bg-white p-1.5 pb-3 rounded-lg shadow-md -rotate-2 border border-[#E5D6BE]">
                        {state.trip.heroPhotoUrl && !brokenImages['hero'] ? (
                          <img
                            src={state.trip.heroPhotoUrl}
                            alt={state.trip.destinationTitle}
                            referrerPolicy="no-referrer"
                            onError={() => markBroken('hero')}
                            className="w-full h-20 object-cover rounded"
                          />
                        ) : (
                          <div className="w-full h-20 rounded bg-[#4F9B96]" />
                        )}
                      </div>

                      <div className="text-center min-w-0">
                        <div className="text-[11px] font-extrabold text-[#7C5C42] tracking-wider uppercase">
                          {state.trip.memoryTag} · {state.trip.dateRangeLabel}
                        </div>
                        <h3 className="text-2xl font-black text-[#1E2D3B] leading-tight mt-0.5">
                          {state.trip.destinationTitle}
                        </h3>
                        <p className="text-[12.5px] text-[#5C4634] font-semibold mt-0.5 line-clamp-1">
                          {state.trip.subtitle}
                        </p>
                      </div>

                      <div className="hidden sm:flex justify-end">
                        <svg width="78" height="78" viewBox="0 0 86 86" className="opacity-85">
                          <circle
                            cx="43"
                            cy="43"
                            r="39"
                            fill="none"
                            stroke="#B84B39"
                            strokeWidth="2"
                            strokeDasharray="4 2"
                          />
                          <circle cx="43" cy="43" r="32" fill="none" stroke="#B84B39" strokeWidth="1.2" />
                          <text x="43" y="25" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#B84B39">
                            ARRIVED
                          </text>
                          <text
                            x="43"
                            y="48"
                            textAnchor="middle"
                            fontSize={arriveStampCode.length > 4 ? '11.5' : arriveStampCode.length === 4 ? '13.5' : '16'}
                            fontWeight="900"
                            fill="#B84B39"
                          >
                            {arriveStampCode}
                          </text>
                          <text x="43" y="65" textAnchor="middle" fontSize="8" fontWeight="800" fill="#B84B39">
                            TRAVEL LOG
                          </text>
                        </svg>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-dashed divide-[#D6C1A0] rounded-2xl bg-[#FBF5E8] border border-[#DECAA8]">
                      <div className="p-3">
                        <div className="text-[11px] font-bold text-[#7C5C42]">旅行天數</div>
                        <div className="text-[16px] font-black text-[#2A1F17] tabular-nums mt-0.5">
                          {tripDays.length} 天
                        </div>
                      </div>
                      <div className="p-3">
                        <div className="text-[11px] font-bold text-[#7C5C42]">行程站點</div>
                        <div className="text-[16px] font-black text-[#2A1F17] tabular-nums mt-0.5">
                          {state.activities.length} 站
                        </div>
                      </div>
                      <div className="p-3">
                        <div className="text-[11px] font-bold text-[#7C5C42]">已記帳花費</div>
                        <div className="text-[16px] font-black text-[#C95A49] tabular-nums mt-0.5">
                          ¥{metrics.totalSpentJPY.toLocaleString()}
                        </div>
                      </div>
                      <div className="p-3">
                        <div className="text-[11px] font-bold text-[#7C5C42]">剩餘預算</div>
                        <div className="text-[16px] font-black text-[#4F9B96] tabular-nums mt-0.5">
                          ¥{metrics.remainingBudgetJPY.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-3xl bg-white border border-[#DCEAE2] overflow-hidden shadow-xs">
                    <div className="relative h-44 sm:h-52 bg-[#1A5D42]">
                      {state.trip.heroPhotoUrl && !brokenImages['hero'] ? (
                        <img
                          src={state.trip.heroPhotoUrl}
                          alt={state.trip.destinationTitle}
                          referrerPolicy="no-referrer"
                          onError={() => markBroken('hero')}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#1A5D42] to-[#2C7B59]" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent flex flex-col justify-end p-5 text-white">
                        <div className="text-[11.5px] font-bold text-[#BCEAD5] tracking-wide">
                          {state.trip.memoryTag} · {state.trip.dateRangeLabel}
                        </div>
                        <h3 className="text-2xl font-black leading-tight mt-0.5">
                          {state.trip.destinationTitle}
                        </h3>
                        <p className="text-[13px] text-[#E4F2EB] mt-0.5 line-clamp-1">
                          {state.trip.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#E8F1EC]">
                      <div className="p-3.5">
                        <div className="text-[11px] font-bold text-[#547063]">旅行天數</div>
                        <div className="text-[17px] font-black text-[#14241D] tabular-nums mt-0.5">
                          {tripDays.length} 天
                        </div>
                      </div>
                      <div className="p-3.5">
                        <div className="text-[11px] font-bold text-[#547063]">行程站點</div>
                        <div className="text-[17px] font-black text-[#14241D] tabular-nums mt-0.5">
                          {state.activities.length} 站
                        </div>
                      </div>
                      <div className="p-3.5">
                        <div className="text-[11px] font-bold text-[#547063]">已記帳花費</div>
                        <div className="text-[17px] font-black text-[#DF6437] tabular-nums mt-0.5">
                          ¥{metrics.totalSpentJPY.toLocaleString()}
                        </div>
                      </div>
                      <div className="p-3.5">
                        <div className="text-[11px] font-bold text-[#547063]">剩餘預算</div>
                        <div className="text-[17px] font-black text-[#1A5D42] tabular-nums mt-0.5">
                          ¥{metrics.remainingBudgetJPY.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 1.5 AI 手札引言與主題貼紙卡 */}
                {((useAiCopy && aiSummary) || previewHeroSticker) && (
                  <div
                    className={`rounded-2xl p-4 flex items-center justify-between gap-4 border ${
                      isSuitcase
                        ? 'bg-[#FFF9EE] border-dashed border-[#C9A97E]'
                        : 'bg-gradient-to-br from-white to-[#F2FAF5] border-[#C6E5D4]'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div
                        className={`text-[11.5px] font-black tracking-wide ${
                          isSuitcase ? 'text-[#B84B39]' : 'text-[#1A5D42]'
                        }`}
                      >
                        {useAiCopy && aiSummary
                          ? `✨ AI 手札引言 · ${aiSummary.journalTitle}`
                          : '🏷️ 本趟主打旅行貼紙'}
                      </div>
                      <p
                        className={`text-[13px] font-bold leading-relaxed ${
                          isSuitcase ? 'text-[#2A1F17]' : 'text-[#14241D]'
                        }`}
                      >
                        {useAiCopy && aiSummary
                          ? aiSummary.introQuote
                          : state.trip.subtitle || state.trip.destinationTitle}
                      </p>
                      {useAiCopy && aiSummary?.budgetHighlight && (
                        <div
                          className={`inline-block text-[11.5px] font-extrabold px-2.5 py-1 rounded-lg ${
                            isSuitcase
                              ? 'bg-[#EDF7F6] text-[#4F9B96]'
                              : 'bg-[#FDF1EC] text-[#DF6437]'
                          }`}
                        >
                          💡 {aiSummary.budgetHighlight}
                        </div>
                      )}
                    </div>
                    {previewHeroSticker && (
                      <div className="flex flex-col items-center shrink-0 -rotate-3">
                        <img
                          src={previewHeroSticker.imageUrl}
                          alt={previewHeroSticker.name}
                          className="w-16 h-16 object-contain drop-shadow-md"
                        />
                        <span
                          className={`text-[10px] font-extrabold mt-0.5 ${
                            isSuitcase ? 'text-[#7C5C42]' : 'text-[#547063]'
                          }`}
                        >
                          {previewHeroSticker.name}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Flights */}
                {options.includeFlights && (
                  <div
                    className={`rounded-2xl p-4 sm:p-5 space-y-3 border ${
                      isSuitcase
                        ? 'bg-[#FBF6EA] border-[#DECAA8]'
                        : 'bg-white border-[#DCEAE2] rounded-3xl'
                    }`}
                  >
                    <div
                      className={`flex flex-wrap items-baseline justify-between gap-2 pb-2.5 ${
                        isSuitcase
                          ? 'border-b border-dashed border-[#D6C1A0]'
                          : 'border-b border-[#E8F1EC]'
                      }`}
                    >
                      <h4
                        className={`text-[16px] font-black flex items-center gap-2 ${
                          isSuitcase ? 'text-[#2A1F17]' : 'text-[#14241D]'
                        }`}
                      >
                        {tripTransportMode === 'flight' ? (
                          <PlaneTakeoff
                            className={`w-4 h-4 ${isSuitcase ? 'text-[#4F9B96]' : 'text-[#1A5D42]'}`}
                          />
                        ) : (
                          <span className="text-[16px] leading-none">{tripModeMeta.icon}</span>
                        )}
                        <span>
                          {isSuitcase ? tripModeMeta.suitcaseHeading : tripModeMeta.zhHeading}
                        </span>
                      </h4>
                      <span
                        className={`text-[12px] font-medium ${
                          isSuitcase ? 'text-[#7C5C42]' : 'text-[#547063]'
                        }`}
                      >
                        {state.trip.airlineLabel} · {state.trip.baggageLabel}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        {
                          label: '去程 Outbound',
                          leg: state.outbound,
                          color: isSuitcase ? 'text-[#4F9B96]' : 'text-[#1A5D42]',
                          barBg: 'bg-[#4F9B96]',
                        },
                        {
                          label: '回程 Inbound',
                          leg: state.inbound,
                          color: isSuitcase ? 'text-[#C95A49]' : 'text-[#DF6437]',
                          barBg: 'bg-[#C95A49]',
                        },
                      ].map(({ label, leg, color, barBg }) => {
                        const legModeMeta = TRANSPORT_MODE_META[getLegTransportMode(leg)];
                        const depLen = (leg.departCode || '').length;
                        const arrLen = (leg.arriveCode || '').length;
                        return (
                          <div
                            key={label}
                            className={`rounded-2xl overflow-hidden border ${
                              isSuitcase
                                ? 'bg-white border-[#D6C1A0]'
                                : 'bg-[#F6FBF8] border-[#DCEAE2]'
                            }`}
                          >
                            {isSuitcase && (
                              <div
                                className={`${barBg} text-white px-3.5 py-1.5 flex items-center justify-between text-[11px] font-black`}
                              >
                                <span>{label}</span>
                                <span>{leg.flightNo}</span>
                              </div>
                            )}
                            <div className="p-3.5 space-y-2">
                              {!isSuitcase && (
                                <div className="flex items-center justify-between text-[11.5px] font-bold">
                                  <span className={color}>{label}</span>
                                  <span className="text-[#547063]">
                                    {leg.flightNo} · {leg.dateLabel}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div
                                    className={`${
                                      depLen > 4 ? 'text-[16px]' : 'text-[20px]'
                                    } font-black text-[#14241D] tabular-nums truncate`}
                                  >
                                    {leg.departCode}
                                  </div>
                                  <div className="text-[11.5px] text-[#547063]">
                                    {leg.departCity}
                                    {leg.departTerminal ? ` (${leg.departTerminal})` : ''}
                                  </div>
                                  <div className={`text-[13.5px] font-extrabold tabular-nums ${color}`}>
                                    {leg.departTime}
                                  </div>
                                </div>
                                <div className="text-center text-[11px] text-[#6B8579] px-1 shrink-0">
                                  <div>{leg.duration}</div>
                                  <div>──── {legModeMeta.routeSymbol} ────</div>
                                </div>
                                <div className="text-right min-w-0">
                                  <div
                                    className={`${
                                      arrLen > 4 ? 'text-[16px]' : 'text-[20px]'
                                    } font-black text-[#14241D] tabular-nums truncate`}
                                  >
                                    {leg.arriveCode}
                                  </div>
                                  <div className="text-[11.5px] text-[#547063]">
                                    {leg.arriveCity}
                                    {leg.arriveTerminal ? ` (${leg.arriveTerminal})` : ''}
                                  </div>
                                  <div className={`text-[13.5px] font-extrabold tabular-nums ${color}`}>
                                    {leg.arriveTime}
                                  </div>
                                </div>
                              </div>
                              {isSuitcase && (
                                <div className="pt-1.5 border-t border-dashed border-[#E2D2B8] text-[11px] text-[#6E5845]">
                                  {leg.dateLabel}
                                  {leg.perkLabel ? ` · ${leg.perkLabel}` : ''}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. Stay (支援多間酒店) */}
                {options.includeStay && (
                  <div
                    className={`rounded-2xl p-4 sm:p-5 space-y-3 border ${
                      isSuitcase
                        ? 'bg-[#FBF6EA] border-[#DECAA8]'
                        : 'bg-white border-[#DCEAE2] rounded-3xl'
                    }`}
                  >
                    <div
                      className={`flex flex-wrap items-baseline justify-between gap-2 pb-2.5 ${
                        isSuitcase
                          ? 'border-b border-dashed border-[#D6C1A0]'
                          : 'border-b border-[#E8F1EC]'
                      }`}
                    >
                      <h4
                        className={`text-[16px] font-black flex items-center gap-2 ${
                          isSuitcase ? 'text-[#2A1F17]' : 'text-[#14241D]'
                        }`}
                      >
                        <BedDouble
                          className={`w-4 h-4 ${isSuitcase ? 'text-[#4F9B96]' : 'text-[#1A5D42]'}`}
                        />
                        <span>{isSuitcase ? '住宿飯店手札' : '住宿飯店資訊'}</span>
                      </h4>
                      <span
                        className={`text-[12px] font-medium ${
                          isSuitcase ? 'text-[#7C5C42]' : 'text-[#547063]'
                        }`}
                      >
                        {staysList.length > 1
                          ? `共 ${staysList.length} 間住宿`
                          : `${'★'.repeat(Math.max(1, staysList[0]?.stars || 4))} · ${
                              staysList[0]?.category || 'Hotel'
                            }`}
                      </span>
                    </div>

                    <div className="space-y-4">
                      {staysList.map((stayItem, idx) => {
                        const stayImgKey = `stay-${idx}`;
                        const nights = getStayNights(stayItem);
                        return (
                          <div
                            key={stayItem.id || idx}
                            className={`grid grid-cols-1 sm:grid-cols-[164px_1fr] gap-4 items-center ${
                              idx > 0
                                ? isSuitcase
                                  ? 'pt-4 border-t border-dashed border-[#D6C1A0]'
                                  : 'pt-4 border-t border-[#E8F1EC]'
                                : ''
                            }`}
                          >
                            <div
                              className={
                                isSuitcase
                                  ? 'relative bg-white p-2 pb-4 rounded-lg border border-[#E5D6BE] shadow-sm'
                                  : ''
                              }
                            >
                              {isSuitcase && (
                                <span className="absolute -top-2 left-1/2 -translate-x-1/2 -rotate-2 w-14 h-3.5 bg-[#E37868]/75 rounded-xs" />
                              )}
                              {stayItem.photoUrl && !brokenImages[stayImgKey] ? (
                                <img
                                  src={stayItem.photoUrl}
                                  alt={stayItem.hotelName || '住宿圖片'}
                                  referrerPolicy="no-referrer"
                                  onError={() => markBroken(stayImgKey)}
                                  className={`w-full h-32 object-cover ${
                                    isSuitcase ? 'rounded' : 'rounded-2xl h-36'
                                  } bg-[#E5F2EC]`}
                                />
                              ) : (
                                <div className="w-full h-32 rounded-xl bg-[#EFE2C4] flex items-center justify-center text-3xl">
                                  🏨
                                </div>
                              )}
                            </div>
                            <div className="space-y-1.5 min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {staysList.length > 1 && (
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10.5px] font-extrabold ${
                                      isSuitcase
                                        ? 'bg-[#EFE2CA] text-[#5C4634]'
                                        : 'bg-[#E3F1EC] text-[#1A5D42]'
                                    }`}
                                  >
                                    第 {idx + 1} 間{nights > 0 ? ` · ${nights} 晚` : ''}
                                  </span>
                                )}
                                <span className="text-[11px] font-bold text-[#7C5C42]">
                                  {'★'.repeat(Math.max(1, stayItem.stars || 4))} · {stayItem.category}
                                </span>
                              </div>
                              <div className="text-[17px] font-black text-[#1E2D3B]">
                                {stayItem.hotelName || '未命名飯店'}
                              </div>
                              {stayItem.subTitle && (
                                <div className="text-[12.5px] text-[#6E5845]">
                                  {stayItem.subTitle}
                                </div>
                              )}
                              <div
                                className={`text-[12.5px] font-bold ${
                                  isSuitcase ? 'text-[#4F9B96]' : 'text-[#1A5D42]'
                                }`}
                              >
                                入住 {stayItem.checkIn} · 退房 {stayItem.checkOut} ·{' '}
                                {stayItem.paidStatus}
                              </div>
                              {stayItem.address && (
                                <div className="text-[12px] text-[#364E43] break-words">
                                  📍 {stayItem.address}
                                </div>
                              )}
                              {stayItem.insiderScoop && (
                                <div
                                  className={`text-[12px] px-3 py-2 rounded-xl mt-1 ${
                                    isSuitcase
                                      ? 'text-[#5C4634] bg-[#F2E7CF]'
                                      : 'text-[#476357] bg-[#F5FAF7]'
                                  }`}
                                >
                                  💡 {stayItem.insiderScoop}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 4. Day-by-Day Illustrated Itinerary */}
                {options.includeItinerary && (
                  <div
                    className={`rounded-2xl p-4 sm:p-5 space-y-3.5 border ${
                      isSuitcase
                        ? 'bg-[#FBF6EA] border-[#DECAA8]'
                        : 'bg-white border-[#DCEAE2] rounded-3xl'
                    }`}
                  >
                    <div
                      className={`flex flex-wrap items-baseline justify-between gap-2 pb-2.5 ${
                        isSuitcase
                          ? 'border-b border-dashed border-[#D6C1A0]'
                          : 'border-b border-[#E8F1EC]'
                      }`}
                    >
                      <h4
                        className={`text-[16px] font-black flex items-center gap-2 ${
                          isSuitcase ? 'text-[#2A1F17]' : 'text-[#14241D]'
                        }`}
                      >
                        <MapPin
                          className={`w-4 h-4 ${isSuitcase ? 'text-[#C95A49]' : 'text-[#DF6437]'}`}
                        />
                        <span>{isSuitcase ? '每日行程剪貼簿' : '每日圖文行程'}</span>
                      </h4>
                      <span
                        className={`text-[12px] font-medium tabular-nums ${
                          isSuitcase ? 'text-[#7C5C42]' : 'text-[#547063]'
                        }`}
                      >
                        共 {tripDays.length} 天 · {state.activities.length} 站 · 預估行程費 ¥
                        {metrics.activityEstimateJPY.toLocaleString()}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {groupedDays.map(({ day, items, dayCostJPY }, dIdx) => {
                        const weather = weatherByDate[day.iso];
                        const tapeColor =
                          SUITCASE_DAY_COLORS[dIdx % SUITCASE_DAY_COLORS.length];
                        const aiDay = aiSummary?.daySummaries?.find(
                          (d) => d.dayIndex === day.index
                        );
                        const daySticker = resolvePreviewDaySticker(day.index);
                        return (
                          <div
                            key={day.iso}
                            className={`rounded-2xl overflow-hidden border bg-white ${
                              isSuitcase ? 'border-[#DECAA8] shadow-xs' : 'border-[#E3EFE8]'
                            }`}
                          >
                            <div
                              style={isSuitcase ? { backgroundColor: tapeColor } : undefined}
                              className={`px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 ${
                                isSuitcase
                                  ? 'text-white'
                                  : 'bg-[#F3FAF6] border-b border-[#E3EFE8]'
                              }`}
                            >
                              <div className="flex items-center gap-2 text-[13px] font-extrabold">
                                {daySticker && (
                                  <img
                                    src={daySticker.imageUrl}
                                    alt={daySticker.name}
                                    className="w-7 h-7 object-contain rounded-full bg-white p-0.5 shadow-xs shrink-0"
                                  />
                                )}
                                <div>
                                  <span
                                    className={`mr-2 ${
                                      isSuitcase ? 'text-white' : 'text-[#1A5D42]'
                                    }`}
                                  >
                                    {day.label}
                                  </span>
                                  <span className={isSuitcase ? 'text-white' : 'text-[#14241D]'}>
                                    {day.zhDisp}
                                  </span>
                                  {useAiCopy && aiDay?.dayHeadline && (
                                    <span
                                      className={`ml-2 text-[12px] font-bold ${
                                        isSuitcase ? 'text-white/95' : 'text-[#1A5D42]'
                                      }`}
                                    >
                                      · {aiDay.dayHeadline}
                                    </span>
                                  )}
                                  {weather && (
                                    <span
                                      className={`text-[12px] font-medium ml-2 ${
                                        isSuitcase ? 'text-white/90' : 'text-[#547063]'
                                      }`}
                                    >
                                      · {weather.emoji} {weather.tempMin}°–{weather.tempMax}°C
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div
                                className={`text-[12px] font-extrabold tabular-nums ${
                                  isSuitcase ? 'text-white' : 'text-[#DF6437]'
                                }`}
                              >
                                當日預估 ¥{dayCostJPY.toLocaleString()}
                              </div>
                            </div>

                            <div className="p-3 space-y-2.5">
                              {items.length === 0 ? (
                                <div className="text-[12.5px] text-[#6B8579] py-1">
                                  自由散步與彈性探索時間
                                </div>
                              ) : (
                                items.map((act) => {
                                  const imgKey = `act-${act.id}`;
                                  const aiAct = aiSummary?.activitySuggestions?.find(
                                    (s) => s.activityId === act.id
                                  );
                                  const actSticker = resolvePreviewActSticker(act.id);
                                  const isPickingSticker = editingStickerActivityId === act.id;
                                  return (
                                    <div
                                      key={act.id}
                                      className={`pb-2.5 last:border-b-0 last:pb-0 space-y-2 ${
                                        isSuitcase
                                          ? 'border-b border-dashed border-[#EBDEC7]'
                                          : 'border-b border-[#F0F6F2]'
                                      }`}
                                    >
                                      <div className="grid grid-cols-[50px_54px_1fr_54px] gap-2.5 items-center">
                                        <div className="text-center tabular-nums">
                                          <div className="text-[13px] font-black text-[#14241D]">
                                            {act.time}
                                          </div>
                                          {act.endTime && (
                                            <div className="text-[10px] text-[#6B8579]">
                                              ~{act.endTime}
                                            </div>
                                          )}
                                          {act.duration && (
                                            <div
                                              className={`text-[10px] font-bold ${
                                                isSuitcase ? 'text-[#7C5C42]' : 'text-[#1A5D42]'
                                              }`}
                                            >
                                              {act.duration}
                                            </div>
                                          )}
                                        </div>

                                        {act.photoUrl && !brokenImages[imgKey] ? (
                                          <img
                                            src={act.photoUrl}
                                            alt={act.title}
                                            referrerPolicy="no-referrer"
                                            onError={() => markBroken(imgKey)}
                                            className={`w-13 h-13 rounded-xl object-cover ${
                                              isSuitcase
                                                ? 'border-2 border-white shadow-md bg-[#F2E7CF]'
                                                : 'bg-[#EAF4EF]'
                                            }`}
                                          />
                                        ) : (
                                          <div
                                            className={`w-13 h-13 rounded-xl flex items-center justify-center text-lg ${
                                              isSuitcase ? 'bg-[#F2E7CF]' : 'bg-[#EAF4EF]'
                                            }`}
                                          >
                                            📍
                                          </div>
                                        )}

                                        <div className="min-w-0">
                                          <div className="flex items-baseline justify-between gap-2">
                                            <div className="text-[13.5px] font-extrabold text-[#14241D] truncate">
                                              {act.title}
                                            </div>
                                            {act.cost ? (
                                              <span
                                                className={`text-[12px] font-extrabold tabular-nums shrink-0 ${
                                                  isSuitcase ? 'text-[#C95A49]' : 'text-[#DF6437]'
                                                }`}
                                              >
                                                ¥{Number(act.cost).toLocaleString()}
                                              </span>
                                            ) : null}
                                          </div>
                                          <div className="text-[11px] text-[#547063] truncate">
                                            {act.kicker} · {act.location}
                                            {act.transport ? ` · ${act.transport}` : ''}
                                          </div>
                                          {useAiCopy && aiAct?.conciseLine ? (
                                            <div
                                              className={`text-[11.5px] font-bold px-2 py-0.5 rounded-md mt-1 border-l-2 ${
                                                isSuitcase
                                                  ? 'bg-[#FBF2DE] border-[#D99B38] text-[#6A4B38]'
                                                  : 'bg-[#EDF8F2] border-[#1A5D42] text-[#144B34]'
                                              }`}
                                            >
                                              ✍️ {aiAct.conciseLine}
                                            </div>
                                          ) : act.note ? (
                                            <div className="text-[11.5px] text-[#364E43] line-clamp-2 mt-0.5">
                                              {act.note}
                                            </div>
                                          ) : null}
                                        </div>

                                        {/* 貼紙槽位（點擊可手動替換/清除貼紙） */}
                                        <button
                                          type="button"
                                          title={actSticker ? `更換貼紙（${actSticker.name}）` : '點此貼上貼紙'}
                                          onClick={() =>
                                            setEditingStickerActivityId(
                                              isPickingSticker ? null : act.id
                                            )
                                          }
                                          className={`flex flex-col items-center justify-center rounded-xl p-1 transition ${
                                            actSticker
                                              ? 'hover:bg-[#F4FAF6] rotate-3'
                                              : 'border border-dashed border-[#CBDAD2] bg-[#F9FCFA] text-[#6E867B] hover:border-[#1A5D42] min-h-[48px]'
                                          }`}
                                        >
                                          {actSticker ? (
                                            <>
                                              <img
                                                src={actSticker.imageUrl}
                                                alt={actSticker.name}
                                                className="w-11 h-11 object-contain drop-shadow-xs"
                                              />
                                              <span className="text-[9px] font-bold text-[#547063] max-w-[52px] truncate">
                                                {actSticker.name}
                                              </span>
                                            </>
                                          ) : (
                                            <span className="text-[10px] font-extrabold">+貼紙</span>
                                          )}
                                        </button>
                                      </div>

                                      {/* 單一景點快速貼紙選擇列 */}
                                      {isPickingSticker && (
                                        <div className="flex items-center gap-1.5 overflow-x-auto p-2 rounded-xl bg-[#F4FAF6] border border-[#CFE3D8] tabi-scroll">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActivityStickerMap((prev) => {
                                                const next = { ...prev };
                                                delete next[act.id];
                                                return next;
                                              });
                                              setEditingStickerActivityId(null);
                                            }}
                                            className="px-2 py-1 rounded-lg bg-white border border-[#DCEAE2] text-[10.5px] font-bold text-[#6B8579] shrink-0"
                                          >
                                            清除
                                          </button>
                                          {stickers.map((stk) => {
                                            const selected = actSticker?.id === stk.id;
                                            return (
                                              <button
                                                key={stk.id}
                                                type="button"
                                                onClick={() => {
                                                  setActivityStickerMap((prev) => ({
                                                    ...prev,
                                                    [act.id]: stk.id,
                                                  }));
                                                  setEditingStickerActivityId(null);
                                                }}
                                                className={`flex items-center gap-1 px-2 py-1 rounded-lg border shrink-0 transition ${
                                                  selected
                                                    ? 'bg-[#E2F3EA] border-[#1A5D42] text-[#144B34]'
                                                    : 'bg-white border-[#DCEAE2] text-[#14241D] hover:bg-[#EAF4EF]'
                                                }`}
                                              >
                                                <img
                                                  src={stk.imageUrl}
                                                  alt={stk.name}
                                                  className="w-6 h-6 object-contain"
                                                />
                                                <span className="text-[10.5px] font-bold whitespace-nowrap">
                                                  {stk.name}
                                                </span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 5. Budget & Expense Overview */}
                {options.includeBudgetOverview && (
                  <div
                    className={`rounded-2xl p-4 sm:p-5 space-y-4 border ${
                      isSuitcase
                        ? 'bg-[#FBF6EA] border-[#DECAA8]'
                        : 'bg-white border-[#DCEAE2] rounded-3xl'
                    }`}
                  >
                    <div
                      className={`flex flex-wrap items-baseline justify-between gap-2 pb-2.5 ${
                        isSuitcase
                          ? 'border-b border-dashed border-[#D6C1A0]'
                          : 'border-b border-[#E8F1EC]'
                      }`}
                    >
                      <h4
                        className={`text-[16px] font-black flex items-center gap-2 ${
                          isSuitcase ? 'text-[#2A1F17]' : 'text-[#14241D]'
                        }`}
                      >
                        <Wallet
                          className={`w-4 h-4 ${isSuitcase ? 'text-[#4F9B96]' : 'text-[#1A5D42]'}`}
                        />
                        <span>{isSuitcase ? '旅行經費與戰利品帳本' : '旅遊經費與消費分佈'}</span>
                      </h4>
                      <span
                        className={`text-[12px] font-medium tabular-nums ${
                          isSuitcase ? 'text-[#7C5C42]' : 'text-[#547063]'
                        }`}
                      >
                        總預算 ¥{state.totalBudgetJPY.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-5">
                      <svg
                        width="126"
                        height="126"
                        viewBox="0 0 126 126"
                        className="shrink-0"
                      >
                        <circle
                          cx="63"
                          cy="63"
                          r="44"
                          fill="none"
                          stroke={isSuitcase ? '#EFE2CA' : '#EEF5F1'}
                          strokeWidth="18"
                        />
                        {metrics.totalSpentJPY > 0 &&
                          metrics.slices
                            .filter((s) => s.amountJPY > 0)
                            .map((slice) => {
                              const dash =
                                (slice.amountJPY / metrics.totalSpentJPY) * donutCircumference;
                              const gap = donutCircumference - dash;
                              const currentOffset = donutOffset;
                              donutOffset += dash;
                              return (
                                <circle
                                  key={slice.key}
                                  cx="63"
                                  cy="63"
                                  r="44"
                                  fill="none"
                                  stroke={slice.color}
                                  strokeWidth="18"
                                  strokeDasharray={`${dash} ${gap}`}
                                  strokeDashoffset={-currentOffset}
                                  transform="rotate(-90 63 63)"
                                />
                              );
                            })}
                        <text
                          x="63"
                          y="59"
                          textAnchor="middle"
                          fontSize="10"
                          fontWeight="700"
                          fill={isSuitcase ? '#7C5C42' : '#547063'}
                        >
                          總支出
                        </text>
                        <text
                          x="63"
                          y="75"
                          textAnchor="middle"
                          fontSize="12"
                          fontWeight="900"
                          fill={isSuitcase ? '#2A1F17' : '#14241D'}
                        >
                          ¥{metrics.totalSpentJPY.toLocaleString()}
                        </text>
                      </svg>

                      <div className="flex-1 w-full space-y-2.5">
                        {metrics.slices.map((s) => (
                          <div key={s.key} className="space-y-1">
                            <div className="flex items-center justify-between text-[12px] font-bold">
                              <span className="text-[#14241D]">
                                {s.emoji} {s.label}
                              </span>
                              <span className="text-[#364E43] tabular-nums">
                                ¥{s.amountJPY.toLocaleString()} ({s.percent}%)
                              </span>
                            </div>
                            <div
                              className={`h-2 rounded-full overflow-hidden ${
                                isSuitcase ? 'bg-[#EFE2CA]' : 'bg-[#ECF3EF]'
                              }`}
                            >
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${s.percent}%`, backgroundColor: s.color }}
                              />
                            </div>
                          </div>
                        ))}
                        <div
                          className={`pt-2 border-t border-dashed flex flex-wrap justify-between gap-2 text-[12px] font-bold tabular-nums ${
                            isSuitcase ? 'border-[#D6C1A0]' : 'border-[#D6E7DE]'
                          }`}
                        >
                          <span className="text-[#14241D]">
                            已花費 ¥{metrics.totalSpentJPY.toLocaleString()} (約{' '}
                            {Math.round(metrics.totalSpentConverted).toLocaleString()}{' '}
                            {metrics.targetCurrency})
                          </span>
                          <span className={isSuitcase ? 'text-[#4F9B96]' : 'text-[#1A5D42]'}>
                            剩餘 ¥{metrics.remainingBudgetJPY.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {options.includeExpenseDetails && (
                      <div
                        className={`pt-3 space-y-2.5 ${
                          isSuitcase
                            ? 'border-t border-dashed border-[#D6C1A0]'
                            : 'border-t border-[#E8F1EC]'
                        }`}
                      >
                        <div className="text-[13.5px] font-extrabold text-[#14241D]">
                          購物與消費明細（{state.expenses.length} 筆）
                        </div>
                        {state.expenses.length === 0 ? (
                          <div className="text-[12px] text-[#6B8579]">尚未記錄消費明細</div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {state.expenses.map((exp) => {
                              const cat = EXPENSE_BADGES[exp.category] || EXPENSE_BADGES.shopping;
                              const expKey = `exp-${exp.id}`;
                              const catColor = isSuitcase ? cat.suitcaseColor : cat.color;
                              return (
                                <div
                                  key={exp.id}
                                  className={`flex items-center gap-2.5 p-2.5 rounded-2xl border ${
                                    isSuitcase
                                      ? 'bg-white border-[#E2D2B8] shadow-2xs'
                                      : 'bg-[#F8FBF9] border-[#E4EFE9]'
                                  }`}
                                >
                                  {exp.photoUrl && !brokenImages[expKey] ? (
                                    <img
                                      src={exp.photoUrl}
                                      alt={exp.title}
                                      referrerPolicy="no-referrer"
                                      onError={() => markBroken(expKey)}
                                      className="w-11 h-11 rounded-xl object-cover shrink-0 border border-white shadow-xs"
                                    />
                                  ) : (
                                    <div
                                      className="w-11 h-11 rounded-xl flex items-center justify-center text-lg shrink-0"
                                      style={{ backgroundColor: cat.bg, color: catColor }}
                                    >
                                      {cat.emoji}
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="text-[12.5px] font-extrabold text-[#14241D] truncate">
                                      {exp.title}
                                      {exp.quantity && exp.quantity > 1 ? ` ×${exp.quantity}` : ''}
                                    </div>
                                    <div className="text-[11px] text-[#547063] truncate">
                                      {cat.label} · {exp.shopOrNote || '旅途消費'}
                                    </div>
                                  </div>
                                  <div className="text-right tabular-nums shrink-0">
                                    <div className="text-[13px] font-black text-[#14241D]">
                                      ¥{Number(exp.amountJPY).toLocaleString()}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Suitcase footer badges */}
                {isSuitcase && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-md bg-[#C95A49] text-white text-[10.5px] font-black border-2 border-white shadow-xs -rotate-2">
                        TRAVEL
                      </span>
                      <span className="px-2.5 py-1 rounded-md bg-[#4F9B96] text-white text-[10.5px] font-black border-2 border-white shadow-xs rotate-1">
                        GOOD TRIP!
                      </span>
                      <span className="px-2.5 py-1 rounded-md bg-[#D99B38] text-white text-[10.5px] font-black border-2 border-white shadow-xs -rotate-1">
                        LET&apos;S GO!
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-[#7C5C42]">
                      去旅行啦 Amazing Travel
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Bottom Export Bar */}
        <div className="bg-white/95 backdrop-blur-md px-4 sm:px-5 py-3 border-t border-[#DCEAE2] grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={handleDownloadHtml}
            className="min-h-[44px] px-3 py-2 rounded-xl bg-[#1A5D42] hover:bg-[#144832] disabled:opacity-60 text-white text-[12.5px] font-extrabold flex items-center justify-center gap-1.5 transition whitespace-nowrap"
          >
            {busyAction === 'html' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileCode2 className="w-4 h-4" />
            )}
            <span>匯出圖文 HTML</span>
          </button>

          <button
            type="button"
            disabled={busyAction !== null}
            onClick={handlePrintPdf}
            className="min-h-[44px] px-3 py-2 rounded-xl bg-[#E3F1EC] hover:bg-[#d2e7df] disabled:opacity-60 text-[#144B34] text-[12.5px] font-extrabold flex items-center justify-center gap-1.5 transition whitespace-nowrap"
          >
            {busyAction === 'pdf' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Printer className="w-4 h-4" />
            )}
            <span>存成 PDF</span>
          </button>

          <button
            type="button"
            disabled={busyAction !== null}
            onClick={handleExportPng}
            className="min-h-[44px] px-3 py-2 rounded-xl bg-[#FCE3DA] hover:bg-[#f7d0c1] disabled:opacity-60 text-[#A83815] text-[12.5px] font-extrabold flex items-center justify-center gap-1.5 transition whitespace-nowrap"
          >
            {busyAction === 'png' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ImageIcon className="w-4 h-4" />
            )}
            <span>長圖 PNG</span>
          </button>

          <button
            type="button"
            disabled={busyAction !== null}
            onClick={handleCopyWhatsApp}
            className="min-h-[44px] px-3 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white text-[12.5px] font-extrabold flex items-center justify-center gap-1.5 transition whitespace-nowrap"
          >
            <MessageSquare className="w-4 h-4" />
            <span>複製 WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
};
