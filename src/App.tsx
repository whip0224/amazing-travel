import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { PageFlip } from 'page-flip';
import {
  Bell,
  Compass,
  Luggage,
  CalendarCheck,
  Calculator,
  Share2,
  Send,
  Ticket,
  Briefcase,
  BedDouble,
  MapPin,
  Sparkles,
  Plus,
  Utensils,
  Landmark,
  Sunset,
  Dices,
  Shuffle,
  Zap,
  ArrowUpDown,
  ShoppingCart,
  TrainFront,
  Gift,
  CheckCircle2,
  Trash2,
  Edit3,
  BookOpen,
  Download,
  WifiOff,
  ChevronLeft,
  ChevronRight,
  PlaneTakeoff,
  X,
  Check,
  Wallet,
  Image as ImageIcon,
  Loader2,
  Phone,
  Star,
  FileText,
  ArrowUp,
  ArrowDown,
  Wand2,
  Hand,
} from 'lucide-react';
import { CURRENCIES, type AirportItem } from './airports.js';
import {
  DEFAULT_TABI_STATE,
  SURPRISE_SPOTS,
  SAMPLE_LOCATION_TXT_DATA,
  type TabiState,
  type TabKey,
  type PlanActivity,
  type SavedDestination,
  type ExpenseItem,
  type ExpenseCategoryKey,
  type FlightLeg,
} from './types/tabi';
import { usePWAInstall } from './hooks/usePWAInstall';
import { IntegrationGuideModal } from './components/IntegrationGuideModal';
import { AirportSearchModal, type AirportTargetSlot } from './components/AirportSearchModal';
import { findDestinationPhoto } from './utils/photoFinder';
import {
  optimizeItineraryWithAI,
  type AIOptimizationResult,
  type OptimizeMode,
} from './utils/aiItineraryOptimizer';

// --- Firebase 初始化 (保留原有專案雲端連線架構) ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-offline-key',
  authDomain: 'amazingtravel-whip0224.firebaseapp.com',
  projectId: 'amazingtravel-whip0224',
  storageBucket: 'amazingtravel-whip0224.firebasestorage.app',
  messagingSenderId: '1054814538508',
  appId: '1:1054814538508:web:6cccb3b84034a2fcfed729',
};

let auth: ReturnType<typeof getAuth> | null = null;
let db: ReturnType<typeof getFirestore> | null = null;
try {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch {
  // Offline fallback when Firebase key is not configured
}

const STORAGE_KEY_V2 = 'tabi_pwa_state_v2';
const LEGACY_STORAGE_KEY = 'at_local_data_final_v1';

// 讀取 LocalStorage 初始資料 (確保 F5 重整或離線時資料完整保留)
const loadInitialTabiState = (): TabiState => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_V2);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...DEFAULT_TABI_STATE,
        ...parsed,
        enableSwipeFlip:
          parsed.swipePolicyVersion === 3 && typeof parsed.enableSwipeFlip === 'boolean'
            ? parsed.enableSwipeFlip
            : false,
        swipeEdgeOnly:
          typeof parsed.swipeEdgeOnly === 'boolean' ? parsed.swipeEdgeOnly : true,
        swipePolicyVersion: 3,
        trip: {
          ...DEFAULT_TABI_STATE.trip,
          ...(parsed.trip || {}),
          memoryTag: (parsed.trip?.memoryTag || DEFAULT_TABI_STATE.trip.memoryTag).replace(
            /^TABI/i,
            '去旅行啦'
          ),
        },
        outbound: { ...DEFAULT_TABI_STATE.outbound, ...(parsed.outbound || {}) },
        inbound: { ...DEFAULT_TABI_STATE.inbound, ...(parsed.inbound || {}) },
        stay: { ...DEFAULT_TABI_STATE.stay, ...(parsed.stay || {}) },
        destinations:
          Array.isArray(parsed.destinations) && parsed.destinations.length > 0
            ? parsed.destinations
            : DEFAULT_TABI_STATE.destinations,
        activities:
          Array.isArray(parsed.activities) && parsed.activities.length > 0
            ? parsed.activities
            : DEFAULT_TABI_STATE.activities,
        expenses: Array.isArray(parsed.expenses) ? parsed.expenses : DEFAULT_TABI_STATE.expenses,
      };
    }
  } catch (e) {
    console.error('Failed to read local state:', e);
  }
  return DEFAULT_TABI_STATE;
};

// Book Page Index 對應:
// Page 0 -> 'trips' (1. 來回程與住宿資訊頁)
// Page 1 -> 'plan'  (2. 行程編排頁)
// Page 2 -> 'tools' (3. 工具與行程消費)
// Page 3 -> 'discover' (4. 目的地清單與匯入管理)
const PAGE_ORDER: TabKey[] = ['trips', 'plan', 'tools', 'discover'];

const EXPENSE_CATEGORIES: {
  key: ExpenseCategoryKey;
  zhTitle: string;
  enTitle: string;
  badgeText: string;
  badgeBg: string;
  badgeColor: string;
  iconBg: string;
  iconColor: string;
  desc: string;
}[] = [
  {
    key: 'shopping',
    zhTitle: '購物 Shopping',
    enTitle: 'Shopping',
    badgeText: '藥妝·伴手禮',
    badgeBg: 'bg-[#F7C8B6]',
    badgeColor: 'text-[#8C2D12]',
    iconBg: 'bg-[#FDE6DC]',
    iconColor: 'text-[#C84B24]',
    desc: 'Souvenirs, Donki & cosmetics',
  },
  {
    key: 'dining',
    zhTitle: '飲食 Dining',
    enTitle: 'Dining',
    badgeText: '拉麵·甜品',
    badgeBg: 'bg-[#CBEBD9]',
    badgeColor: 'text-[#185B3E]',
    iconBg: 'bg-[#DCF2E6]',
    iconColor: 'text-[#1E6B4B]',
    desc: 'Ichiran ramen, matcha & wagyu',
  },
  {
    key: 'transport',
    zhTitle: '交通 Transport',
    enTitle: 'Transport',
    badgeText: 'Suica·新幹線',
    badgeBg: 'bg-[#A3CEF1]',
    badgeColor: 'text-[#164A7A]',
    iconBg: 'bg-[#DCECFB]',
    iconColor: 'text-[#225E96]',
    desc: 'Shinkansen & Suica card top-ups',
  },
  {
    key: 'gifts',
    zhTitle: '手信 Gifts & Souvenirs',
    enTitle: 'Gifts',
    badgeText: '御守·點心',
    badgeBg: 'bg-[#D8E2DC]',
    badgeColor: 'text-[#2E473B]',
    iconBg: 'bg-[#E6ECE9]',
    iconColor: 'text-[#3B594B]',
    desc: 'KitKats, temple charms & postcards',
  },
];

export default function App() {
  const [state, setState] = useState<TabiState>(loadInitialTabiState);
  const [activeTab, setActiveTab] = useState<TabKey>('trips');
  const [selectedDay, setSelectedDay] = useState<number>(0);

  // 匯率表 (以 1 USD 為基準，支援離線與即時更新)
  const [ratesFromUSD, setRatesFromUSD] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    CURRENCIES.forEach((c) => {
      map[c.code] = c.rateFromUSD;
    });
    return map;
  });
  const [fxLiveStatus, setFxLiveStatus] = useState<string>('Live update');

  // Firebase 與雲端共享狀態
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentMode, setCurrentMode] = useState<'private' | 'shared'>('private');
  const [currentShareId, setCurrentShareId] = useState<string>('');
  const [cloudOnline, setCloudOnline] = useState<boolean>(false);

  // 機場搜尋過濾 Modal 狀態
  const [airportModalOpen, setAirportModalOpen] = useState(false);
  const [airportTargetSlot, setAirportTargetSlot] = useState<AirportTargetSlot>({
    leg: 'outbound',
    direction: 'depart',
  });

  // 其他 Modals 狀態
  const [showStayModal, setShowStayModal] = useState(false);
  const [showTripModal, setShowTripModal] = useState(false);
  const [showBoardingModal, setShowBoardingModal] = useState(false);
  const [showBaggageModal, setShowBaggageModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showExpenseDetailList, setShowExpenseDetailList] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<
    ExpenseCategoryKey | 'all'
  >('all');
  const [showCloudShareModal, setShowCloudShareModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showBudgetEditModal, setShowBudgetEditModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // --- 📋 目的地清單 (Destination Pool) 與排程狀態 ---
  const [manualDestInput, setManualDestInput] = useState('');
  const [isSearchingPlace, setIsSearchingPlace] = useState(false);
  const [expandedDestId, setExpandedDestId] = useState<string | null>(null);
  const [planDestPoolExpanded, setPlanDestPoolExpanded] = useState<boolean>(true);
  const [showImportJsonModal, setShowImportJsonModal] = useState<boolean>(false);
  const [importJsonText, setImportJsonText] = useState<string>('');

  // 排程與預算設定彈出視窗 (📅 安排與預算)
  const [scheduleModalDest, setScheduleModalDest] = useState<SavedDestination | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    date: '',
    dayIndex: 0,
    start: '11:30',
    end: '13:00',
    transport: '地鐵',
    cost: '1500',
  });

  // 更改景點名稱彈出視窗 (✏️ 編輯名稱)
  const [renameModalDest, setRenameModalDest] = useState<SavedDestination | null>(null);
  const [renameInputVal, setRenameInputVal] = useState('');

  // 🖼️ 自動搜尋/生成行程相關圖片狀態
  const [isGeneratingPhotos, setIsGeneratingPhotos] = useState(false);
  const [photoGenProgress, setPhotoGenProgress] = useState('');

  // 🤖 AI 行程優化狀態與預覽 Modal
  const [showAIOptimizeModal, setShowAIOptimizeModal] = useState(false);
  const [aiOptimizeMode, setAiOptimizeMode] = useState<OptimizeMode>('fill_and_reorder');
  const [isRunningAIOptimize, setIsRunningAIOptimize] = useState(false);
  const [aiOptResult, setAiOptResult] = useState<AIOptimizationResult | null>(null);

  // Plan 頁面：水平日期捲軸 Ref 與滑鼠拖曳狀態 (解決超過 4 天無法左右滑動選擇的問題)
  const dayStripRef = useRef<HTMLDivElement | null>(null);
  const dayStripDragRef = useRef<{ isDown: boolean; startX: number; scrollLeft: number; moved: boolean }>({
    isDown: false,
    startX: 0,
    scrollLeft: 0,
    moved: false,
  });

  // 新增支出表單
  const [newExpForm, setNewExpForm] = useState({
    title: '',
    shopOrNote: '',
    amount: '',
    currency: 'JPY',
    category: 'dining' as ExpenseCategoryKey,
  });

  // PWA 安裝與離線狀態
  const { isInstallable, isOnline, install } = usePWAInstall();

  // Discover 頁面：行前必備檢查清單 (儲存於 LocalStorage，離線可用)
  const [checkedPrepIds, setCheckedPrepIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('tabi_prep_checklist_v1');
      return saved ? JSON.parse(saved) : ['passport', 'vjw', 'icoca'];
    } catch {
      return ['passport', 'vjw', 'icoca'];
    }
  });
  const [activePhraseModal, setActivePhraseModal] = useState<{
    zh: string;
    jp: string;
    romaji: string;
    tag: string;
  } | null>(null);

  const togglePrepItem = (id: string) => {
    setCheckedPrepIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem('tabi_prep_checklist_v1', JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  // StPageFlip 3D 書本翻頁 Ref 與手勢開關 Ref
  const bookContainerRef = useRef<HTMLDivElement | null>(null);
  const pageFlipRef = useRef<PageFlip | null>(null);
  const enableSwipeFlipRef = useRef<boolean>(state.enableSwipeFlip);
  const swipeEdgeOnlyRef = useRef<boolean>(state.swipeEdgeOnly !== false);

  useEffect(() => {
    enableSwipeFlipRef.current = state.enableSwipeFlip;
    swipeEdgeOnlyRef.current = state.swipeEdgeOnly !== false;
  }, [state.enableSwipeFlip, state.swipeEdgeOnly]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  // --- 🗓️ 根據使用者設定的 Start Date 與 End Date 動態產生旅行天數 ---
  const tripDays = useMemo(() => {
    const startStr = state.trip.startDate || '2027-04-12';
    const endStr = state.trip.endDate || '2027-04-16';
    const s = new Date(startStr);
    const e = new Date(endStr);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) {
      return [
        { index: 0, iso: '2027-04-12', label: 'Day 1', dateDisp: 'Mon, Apr 12', zhDisp: '4月12日 (週一)' },
        { index: 1, iso: '2027-04-13', label: 'Day 2', dateDisp: 'Tue, Apr 13', zhDisp: '4月13日 (週二)' },
        { index: 2, iso: '2027-04-14', label: 'Day 3', dateDisp: 'Wed, Apr 14', zhDisp: '4月14日 (週三)' },
        { index: 3, iso: '2027-04-15', label: 'Day 4', dateDisp: 'Thu, Apr 15', zhDisp: '4月15日 (週四)' },
        { index: 4, iso: '2027-04-16', label: 'Day 5', dateDisp: 'Fri, Apr 16', zhDisp: '4月16日 (週五)' },
      ];
    }
    const arr = [];
    const curr = new Date(s);
    let idx = 0;
    // 支援最多 30 天長途旅行
    while (curr <= e && idx < 30) {
      const iso = curr.toISOString().split('T')[0];
      const enDisp = curr.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      const zhDisp = curr.toLocaleDateString('zh-TW', {
        month: 'short',
        day: 'numeric',
        weekday: 'short',
      });
      arr.push({
        index: idx,
        iso,
        label: `Day ${idx + 1}`,
        dateDisp: enDisp,
        zhDisp,
      });
      curr.setDate(curr.getDate() + 1);
      idx++;
    }
    return arr;
  }, [state.trip.startDate, state.trip.endDate]);

  // 當選中的 Day 超出新的日期範圍時自動修正，並自動將水平日期列捲動至選中的日期按鈕中央
  useEffect(() => {
    if (selectedDay >= tripDays.length) {
      setSelectedDay(Math.max(0, tripDays.length - 1));
      return;
    }
    const strip = dayStripRef.current;
    if (!strip) return;
    const activeBtn = strip.querySelector(`[data-day-idx="${selectedDay}"]`) as HTMLElement | null;
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [selectedDay, tripDays.length]);

  const scrollDayStripBy = (deltaPx: number) => {
    if (dayStripRef.current) {
      dayStripRef.current.scrollBy({ left: deltaPx, behavior: 'smooth' });
    }
  };

  // --- 初始化 StPageFlip 3D 書本翻頁引擎 + 防誤觸與邊緣觸發控制 ---
  useEffect(() => {
    const container = bookContainerRef.current;
    if (!container) return;

    // 判斷此次點擊/觸控是否允許觸發 StPageFlip 翻頁：
    // 1. 預設 enableSwipeFlip = false：完全關閉手指/滑鼠滑動翻頁，100% 不誤觸，僅由底部導覽列切換
    // 2. 任何針對 input, textarea, select, button, a, label 或 [data-no-flip="true"] 的操作一律不觸發翻頁
    // 3. 當開啟滑動且設定為「僅左右兩邊邊緣觸發 (swipeEdgeOnly = true)」時，只允許在畫面最左/最右側 24px 書邊區域啟動拖曳翻頁
    const EDGE_TRIGGER_WIDTH_PX = 24;
    const canStartFlipGesture = (clientX: number, target: EventTarget | null, rectEl: HTMLElement): boolean => {
      if (!enableSwipeFlipRef.current) return false;
      if (target instanceof HTMLElement) {
        const isInteractiveControl = target.closest(
          'input, textarea, select, button, a, label, [data-no-flip="true"]'
        );
        if (isInteractiveControl) return false;
      }
      if (swipeEdgeOnlyRef.current) {
        const rect = rectEl.getBoundingClientRect();
        const relX = clientX - rect.left;
        const isLeftEdge = relX >= 0 && relX <= EDGE_TRIGGER_WIDTH_PX;
        const isRightEdge = relX >= rect.width - EDGE_TRIGGER_WIDTH_PX && relX <= rect.width;
        if (!isLeftEdge && !isRightEdge) {
          return false;
        }
      }
      return true;
    };

    const timer = setTimeout(() => {
      if (!bookContainerRef.current) return;
      try {
        const pf = new PageFlip(bookContainerRef.current, {
          width: 420,
          height: 820,
          size: 'stretch',
          minWidth: 320,
          maxWidth: 460,
          minHeight: 640,
          maxHeight: 920,
          maxShadowOpacity: 0.35,
          showCover: false,
          mobileScrollSupport: true,
          swipeDistance: 45,
          clickEventForward: true,
          useMouseEvents: true,
          showPageCorners: false,
          // 關鍵：StPageFlip 在 portrait 模式下若開啟 disableFlipByClick: true，
          // 會因內部 isPointOnCorners({x:10,y:1}) 座標換算瑕疵導致 flipPrev() 與往回切換頁面失效！
          // 因此這裡設為 false，並改由下方 userStop 與 onMouseDown 攔截單擊翻頁。
          disableFlipByClick: false,
          usePortrait: true,
          flippingTime: 550,
          startPage: 0,
        });

        const pages = bookContainerRef.current.querySelectorAll('.tabi-book-page');
        if (pages.length > 0) {
          pf.loadFromHTML(pages as unknown as HTMLElement[]);

          // 攔截 userStop：當使用者只是單純點擊畫面而沒有拖曳 (isUserMove === false) 時，絕不觸發點擊翻頁
          (pf as any).userStop = function (_pos: any, isSwipe = false) {
            if (this.isUserTouch) {
              this.isUserTouch = false;
              if (!isSwipe) {
                if (this.isUserMove) {
                  this.flipController.stopMove();
                } else {
                  this.flipController.reset();
                }
              }
            }
          };

          // 深度攔截 StPageFlip 內部 UI 事件 (.stf__block)，徹底解決點擊或捲動時誤觸翻頁的問題
          const ui = (pf as any).ui;
          if (ui && typeof ui.removeHandlers === 'function' && typeof ui.setHandlers === 'function') {
            ui.removeHandlers();
            const origMouseDown = ui.onMouseDown;
            const origTouchStart = ui.onTouchStart;

            ui.onMouseDown = (e: MouseEvent) => {
              const distEl = ui.distElement || bookContainerRef.current;
              if (!distEl || !canStartFlipGesture(e.clientX, e.target, distEl)) {
                ui.touchPoint = null;
                (pf as any).isUserTouch = false;
                return;
              }
              origMouseDown(e);
            };

            ui.onTouchStart = (e: TouchEvent) => {
              const distEl = ui.distElement || bookContainerRef.current;
              const touch = e.changedTouches && e.changedTouches[0];
              if (!distEl || !touch || !canStartFlipGesture(touch.clientX, e.target, distEl)) {
                ui.touchPoint = null;
                (pf as any).isUserTouch = false;
                return;
              }
              origTouchStart(e);
            };

            ui.setHandlers();
          }

          pf.on('flip', (e: any) => {
            const pageIdx = Number(e.data);
            const tab = PAGE_ORDER[pageIdx] || 'trips';
            setActiveTab(tab);
          });
          pageFlipRef.current = pf;
        }
      } catch (err) {
        console.error('StPageFlip init error:', err);
      }
    }, 60);

    return () => {
      clearTimeout(timer);
      if (pageFlipRef.current) {
        try {
          pageFlipRef.current.destroy();
        } catch {
          // ignore cleanup errors
        }
        pageFlipRef.current = null;
      }
    };
  }, []);

  // 切換書頁輔助函式 (底部導覽列始終可直接選擇並觸發 3D 翻頁，包含防卡死保護)
  const navigateToTab = (tab: TabKey) => {
    setActiveTab(tab);
    const targetIdx = PAGE_ORDER.indexOf(tab);
    const pf = pageFlipRef.current;
    if (targetIdx !== -1 && pf) {
      try {
        // 1. 若前一次翻頁動畫還在進行中，先立即完成它，避免 StPageFlip 內部 currentSpreadIndex 錯位
        const render = (pf as any).getRender?.();
        if (render && render.animation) {
          render.finishAnimation();
        }
        const flipCtrl = (pf as any).getFlipController?.();
        if (flipCtrl && flipCtrl.getState?.() !== 'read') {
          flipCtrl.reset?.();
        }

        const currentIdx = pf.getCurrentPageIndex();
        if (currentIdx !== targetIdx) {
          // 若跨多頁切換，先將鄰近頁同步至底層再執行 3D 翻頁動畫
          if (Math.abs(targetIdx - currentIdx) > 1) {
            pf.turnToPage(targetIdx > currentIdx ? targetIdx - 1 : targetIdx + 1);
          }
          if (targetIdx > currentIdx) {
            pf.flipNext();
          } else {
            pf.flipPrev();
          }

          // 2. 雙重保險：若翻頁動畫未成功啟動，立即使用 turnToPage 切換到位
          const stateAfter = flipCtrl?.getState?.();
          if (stateAfter !== 'flipping') {
            pf.turnToPage(targetIdx);
          } else {
            setTimeout(() => {
              try {
                if (pageFlipRef.current && pageFlipRef.current.getCurrentPageIndex() !== targetIdx) {
                  const r = (pageFlipRef.current as any).getRender?.();
                  if (r && !r.animation) {
                    pageFlipRef.current.turnToPage(targetIdx);
                  }
                }
              } catch {
                // ignore
              }
            }, 600);
          }
        }
      } catch {
        try {
          pf.turnToPage(targetIdx);
        } catch {
          // ignore
        }
      }
    }
  };

  const flipPrevPage = () => {
    const pf = pageFlipRef.current;
    if (!pf) return;
    try {
      const render = (pf as any).getRender?.();
      if (render && render.animation) render.finishAnimation();
      const curr = pf.getCurrentPageIndex();
      if (curr > 0) {
        navigateToTab(PAGE_ORDER[curr - 1]);
      }
    } catch {
      // ignore
    }
  };

  const flipNextPage = () => {
    const pf = pageFlipRef.current;
    if (!pf) return;
    try {
      const render = (pf as any).getRender?.();
      if (render && render.animation) render.finishAnimation();
      const curr = pf.getCurrentPageIndex();
      if (curr < PAGE_ORDER.length - 1) {
        navigateToTab(PAGE_ORDER[curr + 1]);
      }
    } catch {
      // ignore
    }
  };

  // --- 自動儲存至 LocalStorage 與舊版相容格式 ---
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(state));
      const legacyCompat = {
        inputs: {
          startDate: state.trip.startDate,
          endDate: state.trip.endDate,
          hotelName: state.stay.hotelName,
          departCountry: state.outbound.departCountry,
          departLocation: `${state.outbound.departCity} (${state.outbound.departCode})`,
          departTime: state.outbound.departTime,
          returnCountry: state.inbound.departCountry,
          returnLocation: `${state.inbound.departCity} (${state.inbound.departCode})`,
          returnTime: state.inbound.departTime,
        },
        destinations: state.destinations.map((d) => ({
          name: d.customName || d.name,
          scheduled: d.scheduled,
          meta: d,
        })),
        dailyOrder: {},
      };
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacyCompat));
    } catch (e) {
      console.error('LocalStorage save failed:', e);
    }

    if (currentUser && cloudOnline && db) {
      const path =
        currentMode === 'private'
          ? doc(db, 'artifacts', 'amazing-travel-v1', 'users', currentUser.uid, 'active_trip', 'tabi_v2')
          : doc(db, 'artifacts', 'amazing-travel-v1', 'public', 'data', 'shares', currentShareId || 'demo');
      setDoc(path, { ...state, updatedAt: Date.now() }).catch(() => {});
    }
  }, [state, currentUser, cloudOnline, currentMode, currentShareId]);

  // --- Firebase 匿名登入與雲端監聽 ---
  useEffect(() => {
    if (!auth) return;
    signInAnonymously(auth).catch(() => setCloudOnline(false));
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        setCloudOnline(true);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!currentUser || !db || currentMode !== 'shared' || !currentShareId) return;
    const path = doc(db, 'artifacts', 'amazing-travel-v1', 'public', 'data', 'shares', currentShareId);
    const unsub = onSnapshot(path, (snap) => {
      if (snap.metadata.hasPendingWrites) return;
      if (snap.exists()) {
        const data = snap.data() as Partial<TabiState>;
        if (data.trip && data.expenses) {
          setState((prev) => ({
            ...prev,
            ...data,
          }));
        }
      }
    });
    return () => unsub();
  }, [currentUser, currentMode, currentShareId]);

  // --- 抓取即時匯率 ---
  useEffect(() => {
    let active = true;
    const fetchLiveRates = async () => {
      try {
        const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        if (!res.ok) throw new Error('FX fetch failed');
        const data = await res.json();
        if (active && data && data.rates) {
          setRatesFromUSD((prev) => ({ ...prev, ...data.rates }));
          setFxLiveStatus('Live update');
        }
      } catch {
        if (active) setFxLiveStatus('Offline FX cached');
      }
    };
    fetchLiveRates();
    return () => {
      active = false;
    };
  }, []);

  // --- 匯率與預算計算 ---
  const curAObj = useMemo(
    () => CURRENCIES.find((c) => c.code === state.currencyA) || CURRENCIES[0],
    [state.currencyA]
  );
  const curBObj = useMemo(
    () => CURRENCIES.find((c) => c.code === state.currencyB) || CURRENCIES[1],
    [state.currencyB]
  );

  const convertAmount = (amount: number, fromCode: string, toCode: string) => {
    const rFrom = ratesFromUSD[fromCode] || 1;
    const rTo = ratesFromUSD[toCode] || 1;
    const inUSD = amount / rFrom;
    return inUSD * rTo;
  };

  const convertedValueB = useMemo(() => {
    const val = convertAmount(state.exchangeAmount, state.currencyA, state.currencyB);
    return val.toLocaleString(undefined, {
      minimumFractionDigits: state.currencyB === 'JPY' || state.currencyB === 'KRW' ? 0 : 2,
      maximumFractionDigits: state.currencyB === 'JPY' || state.currencyB === 'KRW' ? 0 : 2,
    });
  }, [state.exchangeAmount, state.currencyA, state.currencyB, ratesFromUSD]);

  const unitRateBannerText = useMemo(() => {
    if (state.currencyA === 'JPY' && state.currencyB === 'USD') {
      const rate = convertAmount(1, 'USD', 'JPY');
      return `1 USD ≈ ${rate.toFixed(2)} JPY · ${fxLiveStatus}`;
    }
    const rate = convertAmount(1, state.currencyB, state.currencyA);
    return `1 ${state.currencyB} ≈ ${rate.toFixed(2)} ${state.currencyA} · ${fxLiveStatus}`;
  }, [state.currencyA, state.currencyB, ratesFromUSD, fxLiveStatus]);

  // 消費統計
  const totalSpentJPY = useMemo(
    () => state.expenses.reduce((sum, item) => sum + (Number(item.amountJPY) || 0), 0),
    [state.expenses]
  );
  const remainingBudgetJPY = Math.max(0, state.totalBudgetJPY - totalSpentJPY);
  const budgetSpentPercent = Math.min(
    100,
    Math.round((totalSpentJPY / Math.max(1, state.totalBudgetJPY)) * 100)
  );

  const categoryTotals = useMemo(() => {
    const map: Record<ExpenseCategoryKey, number> = {
      shopping: 0,
      dining: 0,
      transport: 0,
      gifts: 0,
    };
    state.expenses.forEach((exp) => {
      if (map[exp.category] !== undefined) {
        map[exp.category] += Number(exp.amountJPY) || 0;
      }
    });
    return map;
  }, [state.expenses]);

  const latestExpense = useMemo(() => {
    const matchaItem = state.expenses.find((e) => e.id === 'exp-4');
    if (state.expenses.length > 0 && state.expenses[state.expenses.length - 1].id !== 'exp-6') {
      return state.expenses[state.expenses.length - 1];
    }
    return matchaItem || state.expenses[0] || null;
  }, [state.expenses]);

  // --- 互動功能 Handlers ---
  const openGoogleMaps = (query: string) => {
    if (!query) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      window.location.href = url;
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // 開啟包含搜尋過濾功能的國際機場選擇器 Modal
  const openAirportPicker = (leg: 'outbound' | 'inbound', direction: 'depart' | 'arrive') => {
    setAirportTargetSlot({ leg, direction });
    setAirportModalOpen(true);
  };

  const handleSelectAirportFromModal = (
    leg: 'outbound' | 'inbound',
    direction: 'depart' | 'arrive',
    airport: AirportItem,
    country: string,
    selectedTerminal: string
  ) => {
    const displayCode = airport.displayCode || airport.code;
    setState((prev) => {
      const currentLeg: FlightLeg = prev[leg];
      const updatedLeg: FlightLeg =
        direction === 'depart'
          ? {
              ...currentLeg,
              departCountry: country,
              departCode: displayCode,
              departCity: airport.enName,
              departTerminal: selectedTerminal,
            }
          : {
              ...currentLeg,
              arriveCountry: country,
              arriveCode: displayCode,
              arriveCity: airport.enName,
              arriveTerminal: selectedTerminal,
            };
      return { ...prev, [leg]: updatedLeg };
    });
    showToast(`✈️ 已設定為 ${displayCode} (${airport.name} · 航廈 ${selectedTerminal})`);
  };

  const handleUpdateFlightMeta = (leg: 'outbound' | 'inbound', updates: Partial<FlightLeg>) => {
    setState((prev) => ({
      ...prev,
      [leg]: { ...prev[leg], ...updates },
    }));
  };

  // --- 📍 目的地清單：手動輸入新增地點 (支援逗號分隔多個地點 & 自動抓 Google Places 資訊) ---
  const handleManualAddDestinations = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const val = manualDestInput.trim();
    if (!val) {
      showToast('⚠️ 請先在輸入框輸入地點名稱');
      return;
    }
    const names = val
      .split(/[,，、]/)
      .map((n) => n.trim())
      .filter(Boolean);
    if (names.length === 0) return;

    setIsSearchingPlace(true);
    const addedItems: SavedDestination[] = [];

    try {
      const g = (window as any).google;
      const hasPlacesService = Boolean(g?.maps?.places?.PlacesService);
      const dummyDiv = hasPlacesService ? document.createElement('div') : null;
      const service =
        hasPlacesService && dummyDiv ? new g.maps.places.PlacesService(dummyDiv) : null;

      for (const name of names) {
        if (
          state.destinations.some(
            (d) => d.name === name || d.customName === name
          )
        ) {
          continue;
        }

        if (service) {
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
              addedItems.push({
                id: `dest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                name,
                scheduled: null,
              });
              resolve();
            }, 1800);

            service.textSearch({ query: name }, (results: any, status: any) => {
              clearTimeout(timeout);
              if (
                status === g.maps.places.PlacesServiceStatus.OK &&
                Array.isArray(results) &&
                results.length > 0
              ) {
                const p = results[0];
                addedItems.push({
                  id: p.place_id || `dest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  name: p.name || name,
                  customName: name,
                  formattedAddress: p.formatted_address,
                  rating: p.rating,
                  userRatingCount: p.user_ratings_total,
                  location: p.geometry?.location
                    ? {
                        lat:
                          typeof p.geometry.location.lat === 'function'
                            ? p.geometry.location.lat()
                            : p.geometry.location.lat,
                        lng:
                          typeof p.geometry.location.lng === 'function'
                            ? p.geometry.location.lng()
                            : p.geometry.location.lng,
                      }
                    : undefined,
                  scheduled: null,
                });
              } else {
                addedItems.push({
                  id: `dest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  name,
                  scheduled: null,
                });
              }
              resolve();
            });
          });
        } else {
          addedItems.push({
            id: `dest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name,
            scheduled: null,
          });
        }
      }

      if (addedItems.length > 0) {
        setState((prev) => ({
          ...prev,
          destinations: [...addedItems, ...prev.destinations],
        }));
        showToast(`✅ 已新增 ${addedItems.length} 個地點至「目的地清單」！`);
      } else {
        showToast('ℹ️ 該地點已在目的地清單中');
      }
      setManualDestInput('');
    } finally {
      setIsSearchingPlace(false);
    }
  };

  // --- 📥 匯入另一個 PWA 的地點資料 (支援「文字.txt」Google Places JSON 格式) ---
  const parseAndImportPlacesArray = (rawArray: any[]) => {
    if (!Array.isArray(rawArray) || rawArray.length === 0) {
      showToast('⚠️ 找不到有效的地點陣列資料');
      return false;
    }

    const existingNames = new Set(
      state.destinations.map((d) => (d.customName || d.name).trim())
    );
    const newDests: SavedDestination[] = [];

    rawArray.forEach((p: any, idx: number) => {
      const displayName =
        p.customName ||
        p.displayName?.text ||
        (typeof p.displayName === 'string' ? p.displayName : '') ||
        p.name ||
        `匯入地點 #${idx + 1}`;

      if (existingNames.has(displayName.trim())) return;
      existingNames.add(displayName.trim());

      const lat =
        p.location?.latitude ?? p.location?.lat ?? p.geometry?.location?.lat;
      const lng =
        p.location?.longitude ?? p.location?.lng ?? p.geometry?.location?.lng;

      newDests.push({
        id: p.id || `import-${Date.now()}-${idx}`,
        name: displayName,
        customName: p.customName || undefined,
        formattedAddress: p.formattedAddress || p.formatted_address || '',
        nationalPhoneNumber: p.nationalPhoneNumber || p.formatted_phone_number || '',
        rating: typeof p.rating === 'number' ? p.rating : undefined,
        userRatingCount:
          typeof p.userRatingCount === 'number'
            ? p.userRatingCount
            : p.user_ratings_total,
        location:
          typeof lat === 'number' && typeof lng === 'number'
            ? { lat, lng }
            : undefined,
        openNow: p.regularOpeningHours?.openNow,
        weekdayDescriptions: Array.isArray(p.regularOpeningHours?.weekdayDescriptions)
          ? p.regularOpeningHours.weekdayDescriptions
          : undefined,
        scheduled: null,
      });
    });

    if (newDests.length > 0) {
      setState((prev) => ({
        ...prev,
        destinations: [...newDests, ...prev.destinations],
      }));
      showToast(`🎉 成功匯入 ${newDests.length} 個地點至目的地清單！`);
    } else {
      showToast('ℹ️ 所有匯入的地點都已在清單中囉！');
    }
    return true;
  };

  const handleImportFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setShowImportJsonModal(true);
        return;
      }
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        parseAndImportPlacesArray(parsed);
      } else if (parsed.destinations && Array.isArray(parsed.destinations)) {
        setState((prev) => ({ ...prev, ...parsed }));
        showToast('🎉 已還原完整「去旅行啦」行程備份！');
      } else {
        setImportJsonText(text);
        setShowImportJsonModal(true);
      }
    } catch {
      // 若瀏覽器權限阻擋剪貼簿或非 JSON，開啟手動貼上/上傳「文字.txt」視窗
      setShowImportJsonModal(true);
    }
  };

  // --- 📅 開啟「安排與預算」排程視窗 (將目的地排入指定日期與時間) ---
  const openScheduleModal = (dest: SavedDestination) => {
    const defaultDay = tripDays[selectedDay] || tripDays[0];
    const existingDayIdx = dest.scheduled?.date
      ? tripDays.findIndex((d) => d.iso === dest.scheduled?.date)
      : selectedDay;
    const validDayIdx = existingDayIdx >= 0 ? existingDayIdx : selectedDay;

    setScheduleModalDest(dest);
    setScheduleForm({
      date: dest.scheduled?.date || tripDays[validDayIdx]?.iso || defaultDay.iso,
      dayIndex: validDayIdx,
      start: dest.scheduled?.start || '12:00',
      end: dest.scheduled?.end || '13:30',
      transport: dest.scheduled?.transport || '地鐵',
      cost: dest.scheduled?.cost || '1500',
    });
  };

  const handleSaveSchedule = () => {
    if (!scheduleModalDest) return;
    if (!scheduleForm.date) {
      showToast('⚠️ 請選擇要排入的日期');
      return;
    }

    const matchedDay =
      tripDays.find((d) => d.iso === scheduleForm.date) ||
      tripDays[scheduleForm.dayIndex] ||
      tripDays[0];
    const targetDayIndex = matchedDay ? matchedDay.index : 0;

    const updatedSchedule = {
      date: scheduleForm.date,
      dayIndex: targetDayIndex,
      start: scheduleForm.start,
      end: scheduleForm.end,
      transport: scheduleForm.transport,
      cost: scheduleForm.cost,
    };

    const dispTitle = scheduleModalDest.customName || scheduleModalDest.name;
    const transportEmoji =
      scheduleForm.transport === '地鐵'
        ? '🚇 地鐵'
        : scheduleForm.transport === '巴士'
        ? '🚌 巴士'
        : scheduleForm.transport === '計程車'
        ? '🚕 計程車'
        : '🚶 步行';

    setState((prev) => {
      // 1. 更新 destinations 裡的 scheduled 狀態
      const nextDestinations = prev.destinations.map((d) =>
        d.id === scheduleModalDest.id ? { ...d, scheduled: updatedSchedule } : d
      );

      // 2. 同步新增或更新 Plan 時間軸裡的 activities
      const existingActIdx = prev.activities.findIndex(
        (a) => a.sourceDestId === scheduleModalDest.id || a.location === dispTitle || a.title === dispTitle
      );

      const newActivityObj: PlanActivity = {
        id: existingActIdx >= 0 ? prev.activities[existingActIdx].id : `act-${Date.now()}`,
        sourceDestId: scheduleModalDest.id,
        dayIndex: targetDayIndex,
        dateIso: scheduleForm.date,
        time: scheduleForm.start,
        endTime: scheduleForm.end,
        transport: scheduleForm.transport,
        dotColor:
          scheduleForm.transport === '地鐵'
            ? 'orange'
            : scheduleForm.transport === '巴士'
            ? 'green'
            : 'blue',
        kicker: `${scheduleForm.start} - ${scheduleForm.end}`,
        duration: `${transportEmoji}${scheduleForm.cost ? ` · ¥${Number(scheduleForm.cost).toLocaleString()}` : ''}`,
        badgeText: scheduleModalDest.rating ? `⭐ ${scheduleModalDest.rating}` : '📍 已排程',
        title: dispTitle,
        location: scheduleModalDest.formattedAddress || dispTitle,
        note:
          scheduleModalDest.weekdayDescriptions?.[0] ||
          `交通方式：${scheduleForm.transport}｜預算：${scheduleForm.cost || '0'}`,
        photoUrl:
          scheduleModalDest.photoUrl ||
          (existingActIdx >= 0
            ? prev.activities[existingActIdx].photoUrl
            : '/assets/tabi/plan_market.png'),
        photoBadge: scheduleModalDest.photoBadge || '精選行程 ✨',
        cost: Number(scheduleForm.cost) || 0,
        lat: scheduleModalDest.location?.lat,
        lng: scheduleModalDest.location?.lng,
      };

      let nextActivities: PlanActivity[];
      if (existingActIdx >= 0) {
        nextActivities = [...prev.activities];
        nextActivities[existingActIdx] = newActivityObj;
      } else {
        nextActivities = [...prev.activities, newActivityObj];
      }

      nextActivities.sort((a, b) => (a.time > b.time ? 1 : -1));

      return {
        ...prev,
        destinations: nextDestinations,
        activities: nextActivities,
      };
    });

    setSelectedDay(targetDayIndex);
    setScheduleModalDest(null);
    showToast(`📅 已將「${dispTitle}」排入 ${matchedDay.label} (${matchedDay.zhDisp})！`);
  };

  // 取消排定 (從當日時間軸移除，但保留在目的地清單中)
  const handleUnscheduleDestination = () => {
    if (!scheduleModalDest) return;
    const dispTitle = scheduleModalDest.customName || scheduleModalDest.name;
    setState((prev) => ({
      ...prev,
      destinations: prev.destinations.map((d) =>
        d.id === scheduleModalDest.id ? { ...d, scheduled: null } : d
      ),
      activities: prev.activities.filter(
        (a) => a.sourceDestId !== scheduleModalDest.id && a.title !== dispTitle
      ),
    }));
    setScheduleModalDest(null);
    showToast(`↩️ 已取消「${dispTitle}」的排程（仍保留於目的地清單）`);
  };

  // 刪除目的地清單項目
  const handleDeleteDestination = (dest: SavedDestination) => {
    const dispTitle = dest.customName || dest.name;
    setState((prev) => ({
      ...prev,
      destinations: prev.destinations.filter((d) => d.id !== dest.id),
      activities: prev.activities.filter(
        (a) => a.sourceDestId !== dest.id && a.title !== dispTitle
      ),
    }));
    showToast(`🗑️ 已從目的地清單刪除「${dispTitle}」`);
  };

  // 編輯景點名稱
  const handleConfirmRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameModalDest || !renameInputVal.trim()) return;
    const newName = renameInputVal.trim();
    const oldName = renameModalDest.customName || renameModalDest.name;

    setState((prev) => ({
      ...prev,
      destinations: prev.destinations.map((d) =>
        d.id === renameModalDest.id ? { ...d, name: newName, customName: newName } : d
      ),
      activities: prev.activities.map((a) =>
        a.sourceDestId === renameModalDest.id || a.title === oldName
          ? { ...a, title: newName }
          : a
      ),
    }));
    setRenameModalDest(null);
    showToast(`✏️ 已更新名稱為「${newName}」`);
  };

  // --- 🖼️ 一鍵根據目的地自動找尋/生成相關行程圖片 ---
  const handleGenerateItineraryPhotos = async () => {
    if (isGeneratingPhotos) return;
    setIsGeneratingPhotos(true);

    try {
      const dayActs = state.activities.filter((a) => a.dayIndex === selectedDay);
      const targets = dayActs.length > 0 ? dayActs : state.activities;

      if (targets.length === 0 && state.destinations.length === 0) {
        showToast('⚠️ 請先在目的地清單新增或排入行程');
        return;
      }

      const updatedActPhotos: Record<string, { photoUrl: string; photoBadge: string }> = {};
      const updatedDestPhotos: Record<string, { photoUrl: string; photoBadge: string }> = {};

      let count = 0;
      const total = targets.length + state.destinations.filter((d) => !d.photoUrl).length;

      for (const act of targets) {
        count++;
        setPhotoGenProgress(`${count}/${Math.max(count, total)}`);
        const res = await findDestinationPhoto(act.title, act.location);
        updatedActPhotos[act.id] = res;
        if (act.sourceDestId) {
          updatedDestPhotos[act.sourceDestId] = res;
        }
      }

      for (const dest of state.destinations) {
        if (!updatedDestPhotos[dest.id]) {
          count++;
          setPhotoGenProgress(`${count}/${Math.max(count, total)}`);
          const res = await findDestinationPhoto(
            dest.customName || dest.name,
            dest.formattedAddress
          );
          updatedDestPhotos[dest.id] = res;
        }
      }

      setState((prev) => ({
        ...prev,
        activities: prev.activities.map((a) =>
          updatedActPhotos[a.id]
            ? {
                ...a,
                photoUrl: updatedActPhotos[a.id].photoUrl,
                photoBadge: updatedActPhotos[a.id].photoBadge,
              }
            : a
        ),
        destinations: prev.destinations.map((d) =>
          updatedDestPhotos[d.id]
            ? {
                ...d,
                photoUrl: updatedDestPhotos[d.id].photoUrl,
                photoBadge: updatedDestPhotos[d.id].photoBadge,
              }
            : d
        ),
      }));

      showToast('🖼️ 已根據目的地名稱自動找尋並更新所有行程相關圖片！');
    } catch (err) {
      console.error(err);
      showToast('⚠️ 圖片搜尋過程中發生部分錯誤，已套用備用插畫');
    } finally {
      setIsGeneratingPhotos(false);
      setPhotoGenProgress('');
    }
  };

  // 單一卡片刷新相關圖片
  const handleRefreshSingleActivityPhoto = async (act: PlanActivity) => {
    showToast(`🔍 正在為「${act.title}」尋找相關圖片...`);
    const res = await findDestinationPhoto(act.title, act.location);
    setState((prev) => ({
      ...prev,
      activities: prev.activities.map((a) =>
        a.id === act.id ? { ...a, photoUrl: res.photoUrl, photoBadge: res.photoBadge } : a
      ),
      destinations: prev.destinations.map((d) =>
        d.id === act.sourceDestId
          ? { ...d, photoUrl: res.photoUrl, photoBadge: res.photoBadge }
          : d
      ),
    }));
    showToast(`✅ 已更新「${act.title}」的專屬圖片！`);
  };

  // --- 🪄 當日行程順序調整與地理位置最佳化排序 ---
  const handleMoveActivityOrder = (actId: string, direction: -1 | 1) => {
    setState((prev) => {
      const dayActs = prev.activities.filter((a) => a.dayIndex === selectedDay);
      const otherActs = prev.activities.filter((a) => a.dayIndex !== selectedDay);
      const idx = dayActs.findIndex((a) => a.id === actId);
      const targetIdx = idx + direction;
      if (idx === -1 || targetIdx < 0 || targetIdx >= dayActs.length) return prev;

      const reordered = [...dayActs];
      // 交換時間與順序
      const tempTime = reordered[idx].time;
      reordered[idx] = { ...reordered[idx], time: reordered[targetIdx].time };
      reordered[targetIdx] = { ...reordered[targetIdx], time: tempTime };
      [reordered[idx], reordered[targetIdx]] = [reordered[targetIdx], reordered[idx]];

      return {
        ...prev,
        activities: [...otherActs, ...reordered],
      };
    });
  };

  const handleOptimizeDayRoute = () => {
    const dayActs = state.activities.filter((a) => a.dayIndex === selectedDay);
    if (dayActs.length < 2) {
      showToast('ℹ️ 這天的行程不到 2 個，不需要排序喔！');
      return;
    }
    const withCoords = dayActs.filter(
      (a) => typeof a.lat === 'number' && typeof a.lng === 'number'
    );
    const withoutCoords = dayActs.filter(
      (a) => typeof a.lat !== 'number' || typeof a.lng !== 'number'
    );
    if (withCoords.length < 2) {
      showToast('ℹ️ 具備座標的地點不足 2 個，建議使用上下箭頭手動調整順序');
      return;
    }

    const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const originalTimes = dayActs.map((a) => a.time).sort();
    const unvisited = [...withCoords];
    const ordered: PlanActivity[] = [unvisited.shift()!];

    while (unvisited.length > 0) {
      const curr = ordered[ordered.length - 1];
      let nearestIdx = 0;
      let minDist = Infinity;
      unvisited.forEach((cand, i) => {
        const d = getDistance(curr.lat!, curr.lng!, cand.lat!, cand.lng!);
        if (d < minDist) {
          minDist = d;
          nearestIdx = i;
        }
      });
      ordered.push(unvisited.splice(nearestIdx, 1)[0]);
    }

    const finalDayActs = [...ordered, ...withoutCoords].map((act, idx) => ({
      ...act,
      time: originalTimes[idx] || act.time,
    }));

    setState((prev) => ({
      ...prev,
      activities: [
        ...prev.activities.filter((a) => a.dayIndex !== selectedDay),
        ...finalDayActs,
      ],
    }));
    showToast('✨ 已根據景點座標距離完成路線最佳化排序！');
  };

  // --- 🤖 AI 行程優化：分析目的地清單、建議最佳訪問順序與自動分配未排程景點時段 ---
  const handleOpenAIOptimizer = async (modeOverride?: OptimizeMode) => {
    if (state.destinations.length === 0) {
      showToast('⚠️ 目的地清單目前為空，請先加入幾個景點再執行 AI 優化！');
      return;
    }
    const targetMode = modeOverride || aiOptimizeMode;
    setAiOptimizeMode(targetMode);
    setShowAIOptimizeModal(true);
    setIsRunningAIOptimize(true);
    try {
      const result = await optimizeItineraryWithAI(state.destinations, tripDays, targetMode);
      setAiOptResult(result);
    } catch (err) {
      console.error('AI optimize error:', err);
      showToast('⚠️ 優化分析發生問題，請稍後再試');
    } finally {
      setIsRunningAIOptimize(false);
    }
  };

  const handleApplyAIOptimization = () => {
    if (!aiOptResult || aiOptResult.allSuggestions.length === 0) return;

    const suggestionMap = new Map(
      aiOptResult.allSuggestions.map((s) => [s.destId, s])
    );

    setState((prev) => {
      // 1. 更新所有目的地清單項目的 scheduled 狀態
      const nextDestinations = prev.destinations.map((dest) => {
        const sug = suggestionMap.get(dest.id);
        if (!sug) return dest;
        return {
          ...dest,
          scheduled: {
            date: sug.dateIso,
            dayIndex: sug.dayIndex,
            start: sug.start,
            end: sug.end,
            transport: sug.transport,
            cost: sug.cost,
          },
        };
      });

      // 2. 同步建立或更新 Plan 頁面的 activities 時間軸
      const keptNonPoolActivities = prev.activities.filter(
        (act) => !act.sourceDestId || !suggestionMap.has(act.sourceDestId)
      );

      const optimizedActivities: PlanActivity[] = aiOptResult.allSuggestions.map((sug) => {
        const dest = prev.destinations.find((d) => d.id === sug.destId);
        const existingAct = prev.activities.find(
          (a) => a.sourceDestId === sug.destId || a.title === sug.destName
        );
        const transportEmoji =
          sug.transport === '地鐵'
            ? '🚇 地鐵'
            : sug.transport === '巴士'
            ? '🚌 巴士'
            : sug.transport === '計程車'
            ? '🚕 計程車'
            : '🚶 步行';

        return {
          id: existingAct ? existingAct.id : `act-ai-${sug.destId}-${Date.now()}`,
          sourceDestId: sug.destId,
          dayIndex: sug.dayIndex,
          dateIso: sug.dateIso,
          time: sug.start,
          endTime: sug.end,
          transport: sug.transport,
          dotColor:
            sug.transport === '地鐵'
              ? 'orange'
              : sug.transport === '巴士'
              ? 'green'
              : 'blue',
          kicker: `${sug.start} - ${sug.end}`,
          duration: `${transportEmoji}${sug.cost ? ` · ¥${Number(sug.cost).toLocaleString()}` : ''}`,
          badgeText: sug.wasPreviouslyUnscheduled
            ? '🤖 AI 自動排程'
            : dest?.rating
            ? `⭐ ${dest.rating}`
            : '✨ AI 順路優化',
          title: sug.destName,
          location: sug.address || dest?.formattedAddress || sug.destName,
          note: sug.reason,
          photoUrl:
            dest?.photoUrl ||
            existingAct?.photoUrl ||
            '/assets/tabi/plan_temple.png',
          photoBadge: dest?.photoBadge || 'AI 最佳化動線 ✨',
          cost: Number(sug.cost) || 0,
          lat: dest?.location?.lat,
          lng: dest?.location?.lng,
        };
      });

      const merged = [...keptNonPoolActivities, ...optimizedActivities].sort((a, b) =>
        a.time > b.time ? 1 : -1
      );

      return {
        ...prev,
        destinations: nextDestinations,
        activities: merged,
      };
    });

    setShowAIOptimizeModal(false);
    showToast(
      `🎉 已套用 AI 最佳化行程！自動安排了 ${aiOptResult.unscheduledAssignedCount} 個未排程景點並完成順路排序`
    );
  };

  // 交換貨幣 A 與 B
  const handleSwapCurrencies = () => {
    setState((prev) => ({
      ...prev,
      currencyA: prev.currencyB,
      currencyB: prev.currencyA,
    }));
  };

  // 新增一筆消費紀錄
  const handleAddExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawAmt = Number(newExpForm.amount);
    if (!newExpForm.title.trim() || !rawAmt || rawAmt <= 0) {
      showToast('⚠️ 請輸入有效的消費項目名稱與金額');
      return;
    }

    const amountInJPY = Math.round(convertAmount(rawAmt, newExpForm.currency, 'JPY'));
    const newItem: ExpenseItem = {
      id: `exp-${Date.now()}`,
      title: newExpForm.title.trim(),
      shopOrNote: newExpForm.shopOrNote.trim() || '旅途消費',
      amountJPY: amountInJPY,
      originalAmount: rawAmt,
      originalCurrency: newExpForm.currency,
      category: newExpForm.category,
      createdAt: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
      photoUrl: '/assets/tabi/matcha_parfait.png',
    };

    setState((prev) => ({
      ...prev,
      expenses: [...prev.expenses, newItem],
    }));
    setNewExpForm({
      title: '',
      shopOrNote: '',
      amount: '',
      currency: state.currencyA,
      category: 'dining',
    });
    setShowAddExpenseModal(false);
    showToast(`✅ 已新增支出「${newItem.title}」(¥${amountInJPY.toLocaleString()})`);
  };

  const handleDeleteExpense = (id: string) => {
    setState((prev) => ({
      ...prev,
      expenses: prev.expenses.filter((item) => item.id !== id),
    }));
    showToast('🗑️ 已刪除該筆消費紀錄');
  };

  const handleDeleteActivity = (id: string) => {
    setState((prev) => {
      const targetAct = prev.activities.find((a) => a.id === id);
      return {
        ...prev,
        activities: prev.activities.filter((a) => a.id !== id),
        destinations: targetAct?.sourceDestId
          ? prev.destinations.map((d) =>
              d.id === targetAct.sourceDestId ? { ...d, scheduled: null } : d
            )
          : prev.destinations,
      };
    });
    showToast('🗑️ 已從當日時間軸移除（若為清單景點已設回未排程）');
  };

  // Shuffle Surprise 隨機驚喜行程
  const handleShuffleSurprise = () => {
    const randomSpot = SURPRISE_SPOTS[Math.floor(Math.random() * SURPRISE_SPOTS.length)];
    const newAct: PlanActivity = {
      ...randomSpot,
      id: `act-surprise-${Date.now()}`,
      dayIndex: selectedDay,
    };
    setState((prev) => ({
      ...prev,
      activities: [...prev.activities, newAct].sort((a, b) => (a.time > b.time ? 1 : -1)),
    }));
    showToast(`🎲 驚喜抽中：「${newAct.title}」已加入 Day ${selectedDay + 1}！`);
  };

  // 匯出 JSON 備份
  const handleExportJSON = () => {
    const dataStr = JSON.stringify(state, null, 2);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(dataStr).catch(() => {});
    }
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `go-travel-pwa-backup.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📤 已匯出完整行程 JSON 並複製到剪貼簿！');
  };

  const dayActivities = useMemo(
    () =>
      state.activities
        .filter((a) => a.dayIndex === selectedDay)
        .sort((a, b) => (a.time > b.time ? 1 : -1)),
    [state.activities, selectedDay]
  );

  const dayBudgetTotal = useMemo(
    () => dayActivities.reduce((sum, a) => sum + (Number(a.cost) || 0), 0),
    [dayActivities]
  );

  // 共用頂部導覽列 (品牌名稱已改為「去旅行啦」)
  const renderPageHeader = (badgeText: 'TRIPS' | 'PLAN' | 'TOOLS' | 'DISCOVER') => (
    <div className="flex items-center justify-between px-5 pt-4 pb-2.5">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-white shadow-xs border border-[#E2ECE7] flex items-center justify-center overflow-hidden shrink-0">
          <img
            src="/assets/tabi/logo.png"
            alt="去旅行啦 Logo"
            className="w-7 h-7 object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
        <span className="text-[20px] font-black tracking-tight text-[#162921]">
          去旅行啦
        </span>
        <span className="px-2.5 py-0.5 rounded-full bg-[#FADBD0] text-[#C24726] text-[10.5px] font-extrabold tracking-wider uppercase">
          {badgeText}
        </span>
      </div>

      <div className="flex items-center gap-2" data-no-flip="true">
        {!isOnline && (
          <span
            title="離線模式：使用 LocalStorage 快取"
            className="px-2 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center gap-1"
          >
            <WifiOff className="w-3 h-3" /> 離線
          </span>
        )}
        {isInstallable && (
          <button
            type="button"
            onClick={install}
            className="px-2.5 py-1 rounded-full bg-[#1A5D42] text-white text-[11px] font-bold flex items-center gap-1 shadow-xs hover:bg-[#134631] transition"
          >
            <Download className="w-3 h-3" /> 安裝
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowGuideModal(true)}
          title="查看專案檔案結構與 PWA 覆蓋指南"
          className="w-9 h-9 rounded-full bg-white/80 hover:bg-white text-[#253B32] flex items-center justify-center shadow-2xs transition"
        >
          <Bell className="w-[18px] h-[18px] stroke-[2.2]" />
        </button>
        <button
          type="button"
          onClick={() => setShowTripModal(true)}
          className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-[#CBE8DA] shadow-xs shrink-0"
        >
          <img
            src="/assets/tabi/avatar.png"
            alt="User Avatar"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </button>
      </div>
    </div>
  );

  // 共用「📋 目的地清單 (Destination Pool)」渲染區塊 (保留原本功能：手動輸入、從另一個 PWA 匯入 文字.txt 格式、展開編排日期與預算)
  const renderDestinationPoolSection = () => (
    <div
      className="bg-white rounded-[26px] p-4 shadow-sm border border-[#DCEAE2] space-y-3"
      data-no-flip="true"
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setPlanDestPoolExpanded((prev) => !prev)}
          className="flex items-center gap-2 text-left"
        >
          <span className="text-[16px] font-extrabold text-[#14241D]">
            📋 目的地清單 ({state.destinations.length})
          </span>
          <span className="text-xs text-[#1A5D42] font-bold">
            {planDestPoolExpanded ? '▼ 收起' : '▲ 展開編排'}
          </span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleImportFromClipboard}
            className="px-2.5 py-1.5 rounded-xl bg-[#EDE5F8] hover:bg-[#dfd2f3] text-[#5B2E91] text-[11px] font-extrabold flex items-center gap-1 transition"
          >
            <span>📥</span>
            <span>匯入 Location</span>
          </button>
          <button
            type="button"
            onClick={() => setShowImportJsonModal(true)}
            className="px-2.5 py-1.5 rounded-xl bg-[#FADBD0] hover:bg-[#f4c7b7] text-[#A83815] text-[11px] font-extrabold flex items-center gap-1 transition"
          >
            <FileText className="w-3 h-3" />
            <span>文字.txt</span>
          </button>
        </div>
      </div>

      {planDestPoolExpanded && (
        <div className="space-y-3 pt-1 border-t border-[#EBF3EE]">
          {/* 🤖 AI 行程優化快捷橫幅按鈕 (一鍵分析目的地清單、排入未安排景點與最佳化訪問順序) */}
          <div className="p-2.5 rounded-2xl bg-gradient-to-r from-[#E3F3EB] via-[#EAF5F0] to-[#FCE9E1] border border-[#C6E3D4] flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[12px] font-extrabold text-[#143D2B] flex items-center gap-1">
                <Wand2 className="w-3.5 h-3.5 text-[#C24726] shrink-0" />
                <span>AI 智慧行程優化</span>
                {state.destinations.filter((d) => !d.scheduled).length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-[#C24726] text-white text-[9.5px] font-black">
                    {state.destinations.filter((d) => !d.scheduled).length} 待排時段
                  </span>
                )}
              </div>
              <p className="text-[10.5px] text-[#4E685C] truncate mt-0.5">
                自動建議順路訪問順序，並為未安排景點配置最佳時段
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleOpenAIOptimizer('fill_and_reorder')}
              className="px-3 py-1.5 rounded-xl bg-[#1A5D42] hover:bg-[#124430] text-white text-[11px] font-extrabold shrink-0 shadow-2xs flex items-center gap-1 transition"
            >
              <Sparkles className="w-3 h-3" />
              <span>AI 行程優化</span>
            </button>
          </div>

          {/* 手動輸入新增目的地表單 */}
          <form onSubmit={handleManualAddDestinations} className="flex gap-2">
            <input
              type="text"
              value={manualDestInput}
              onChange={(e) => setManualDestInput(e.target.value)}
              disabled={isSearchingPlace}
              placeholder="手動輸入地點 (多個用逗號分隔，如：金閣寺, 鴨川)..."
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#F4FAF6] border border-[#CFE3D8] text-xs font-bold text-[#14241D] placeholder:text-[#758C81] focus:outline-none focus:border-[#1A5D42] focus:bg-white"
            />
            <button
              type="submit"
              disabled={isSearchingPlace}
              className="px-4 py-2.5 rounded-xl bg-[#1A5D42] hover:bg-[#134631] text-white text-xs font-extrabold shrink-0 transition"
            >
              {isSearchingPlace ? '搜尋中...' : '＋ 新增'}
            </button>
          </form>

          {/* 目的地清單卡片列表 */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-0.5 tabi-scroll">
            {state.destinations.map((dest) => {
              const isExpanded = expandedDestId === dest.id;
              const dispName = dest.customName || dest.name;
              const scheduledDayObj = dest.scheduled?.date
                ? tripDays.find((d) => d.iso === dest.scheduled?.date)
                : null;

              return (
                <div
                  key={dest.id}
                  className={`rounded-2xl border transition overflow-hidden ${
                    dest.scheduled
                      ? 'bg-[#F3FAF6] border-[#68C39F]'
                      : 'bg-white border-[#E0ECE5]'
                  }`}
                >
                  <div
                    onClick={() =>
                      setExpandedDestId(isExpanded ? null : dest.id)
                    }
                    className="p-3 flex items-center justify-between gap-2 cursor-pointer hover:bg-[#EAF4EF]/60 transition"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-extrabold text-[13.5px] text-[#14241D] truncate">
                          {dispName}
                        </h4>
                        {dest.rating && (
                          <span className="px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 text-[10px] font-extrabold flex items-center gap-0.5 shrink-0">
                            <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                            {dest.rating}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-bold mt-0.5 flex items-center gap-2">
                        {dest.scheduled ? (
                          <span className="text-[#166646]">
                            📅 已安排：{scheduledDayObj ? `${scheduledDayObj.label} (${scheduledDayObj.zhDisp})` : dest.scheduled.date}{' '}
                            {dest.scheduled.start}~{dest.scheduled.end} · {dest.scheduled.transport}
                          </span>
                        ) : (
                          <span className="text-[#B85D19]">
                            ⚠️ 未安排 (點擊展開並排入行程日期)
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openScheduleModal(dest);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#1A5D42] hover:bg-[#134631] text-white text-[11px] font-extrabold shrink-0 shadow-2xs transition"
                    >
                      📅 排程
                    </button>
                  </div>

                  {/* 展開詳細資訊與操作列 */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-2 border-t border-[#E2EFE8] bg-white/90 space-y-2 text-xs">
                      {dest.formattedAddress && (
                        <div className="text-[#455E52] flex items-start gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#C24726] shrink-0 mt-0.5" />
                          <span>{dest.formattedAddress}</span>
                        </div>
                      )}
                      {dest.nationalPhoneNumber && (
                        <div className="text-[#455E52] flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-[#1A5D42] shrink-0" />
                          <span>
                            {dest.nationalPhoneNumber}
                            {dest.userRatingCount
                              ? ` · 共 ${dest.userRatingCount.toLocaleString()} 則評論`
                              : ''}
                          </span>
                        </div>
                      )}
                      {dest.weekdayDescriptions && dest.weekdayDescriptions.length > 0 && (
                        <details className="text-[11px] text-[#5A7066] bg-[#F4FAF6] p-2 rounded-xl">
                          <summary className="font-bold cursor-pointer text-[#1A5D42]">
                            🕒 查看營業時間 ({dest.openNow ? '營業中' : '休息中'})
                          </summary>
                          <ul className="mt-1 space-y-0.5 pl-2">
                            {dest.weekdayDescriptions.map((line, i) => (
                              <li key={i}>{line}</li>
                            ))}
                          </ul>
                        </details>
                      )}

                      <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => openGoogleMaps(`${dispName} ${dest.formattedAddress || ''}`)}
                          className="px-2.5 py-1.5 rounded-xl bg-[#E6F1FA] text-[#1D5B96] font-extrabold text-[11px]"
                        >
                          🗺️ 地圖
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRenameModalDest(dest);
                            setRenameInputVal(dispName);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-[#EEF4F1] text-[#355245] font-extrabold text-[11px]"
                        >
                          ✏️ 編輯名稱
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDestination(dest)}
                          className="px-2.5 py-1.5 rounded-xl bg-[#FBE4DF] text-[#B53D1B] font-extrabold text-[11px]"
                        >
                          🗑 刪除
                        </button>
                        <button
                          type="button"
                          onClick={() => openScheduleModal(dest)}
                          className="px-3 py-1.5 rounded-xl bg-[#C24726] text-white font-extrabold text-[11px] shadow-2xs"
                        >
                          📅 安排與預算
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#DFECE5] text-[#162A22] flex flex-col items-center justify-start md:py-5 select-none">
      {/* 頂部桌面端輔助控制列 */}
      <div className="w-full max-w-[438px] px-3 pt-2 pb-1.5 flex items-center justify-between text-xs text-[#2D5444]">
        <button
          type="button"
          onClick={() => {
            const nextVal = !state.enableSwipeFlip;
            setState((prev) => ({
              ...prev,
              enableSwipeFlip: nextVal,
              swipeEdgeOnly: true,
              swipePolicyVersion: 3,
            }));
            showToast(
              nextVal
                ? '📐 已開啟「僅左右 24px 邊緣」滑動翻頁'
                : '🔒 已關閉手指滑動翻頁（僅底部導覽列切換，防誤觸）'
            );
          }}
          className="flex items-center gap-1.5 font-bold bg-white/75 hover:bg-white px-2.5 py-1 rounded-lg shadow-2xs transition cursor-pointer"
          title="點擊快速切換滑動翻頁模式"
        >
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              state.enableSwipeFlip ? 'bg-[#1F7A54]' : 'bg-[#C24726]'
            }`}
          />
          <span>
            {state.enableSwipeFlip
              ? state.swipeEdgeOnly !== false
                ? '滑動翻頁：僅左右邊緣 (24px)'
                : '滑動翻頁：全畫面開啟'
              : '滑動翻頁：已關閉 (僅底部切換)'}
          </span>
        </button>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={flipPrevPage}
            className="px-2 py-1 rounded-lg bg-white/80 hover:bg-white text-[#1A5D42] font-bold flex items-center shadow-2xs transition"
            title="上一頁 (3D 翻頁)"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={flipNextPage}
            className="px-2 py-1 rounded-lg bg-white/80 hover:bg-white text-[#1A5D42] font-bold flex items-center shadow-2xs transition"
            title="下一頁 (3D 翻頁)"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setShowGuideModal(true)}
            className="px-2.5 py-1 rounded-lg bg-[#1A5D42] text-white font-bold flex items-center gap-1 shadow-xs hover:bg-[#144732] transition"
          >
            <BookOpen className="w-3.5 h-3.5" /> 整合指南
          </button>
        </div>
      </div>

      {/* Toast 即時回饋訊息 */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[250] bg-[#162A22] text-white px-4 py-2.5 rounded-2xl shadow-xl text-xs font-bold flex items-center gap-2 border border-[#325E4C]">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 📱 手機主框架 (內嵌 StPageFlip 3D 書本翻頁容器 + 固定底部導覽列) */}
      <div className="relative w-full max-w-[438px] bg-[#EDF6F1] md:rounded-[38px] md:shadow-[0_24px_60px_rgba(18,52,38,0.16)] md:border-[6px] md:border-white/90 overflow-hidden flex flex-col">
        {/* 當開啟「左右兩側邊緣觸發 (24px)」時，顯示淡淡的左右邊緣觸發區視覺提示線 */}
        {state.enableSwipeFlip && state.swipeEdgeOnly !== false && (
          <>
            <div
              className="pointer-events-none absolute left-0 top-14 bottom-20 w-[24px] z-30 border-r border-dashed border-[#1A5D42]/25 bg-gradient-to-r from-[#1A5D42]/10 to-transparent flex items-center justify-center"
              aria-hidden="true"
            >
              <span className="text-[9px] font-extrabold text-[#1A5D42]/50 [writing-mode:vertical-rl] tracking-widest">
                ◀ 邊緣翻頁區
              </span>
            </div>
            <div
              className="pointer-events-none absolute right-0 top-14 bottom-20 w-[24px] z-30 border-l border-dashed border-[#1A5D42]/25 bg-gradient-to-l from-[#1A5D42]/10 to-transparent flex items-center justify-center"
              aria-hidden="true"
            >
              <span className="text-[9px] font-extrabold text-[#1A5D42]/50 [writing-mode:vertical-rl] tracking-widest">
                邊緣翻頁區 ▶
              </span>
            </div>
          </>
        )}

        {/* 📖 StPageFlip 3D 書本容器 */}
        <div ref={bookContainerRef} className="w-full flex-1">
          {/* =====================================================================
              PAGE 1 (Index 0): 來回程與住宿資訊頁 (TRIPS - 1:1 還原 Figma 截圖 1)
             ===================================================================== */}
          <div className="tabi-book-page w-full h-full">
            <div className="h-[780px] overflow-y-auto pb-24 tabi-scroll bg-[#EDF6F1]">
              {renderPageHeader('TRIPS')}

              <div className="px-5 space-y-4">
                {/* 頂部雙按鈕列：Ready to wander! + 匯出/匯入 共享行程 */}
                <div className="flex items-center justify-between gap-2.5 pt-1" data-no-flip="true">
                  <button
                    type="button"
                    onClick={() => setShowTripModal(true)}
                    className="px-4 py-2 rounded-full bg-[#AEE5CE] hover:bg-[#9ddbc1] text-[#154D36] text-[13px] font-bold flex items-center gap-1.5 shadow-2xs transition"
                  >
                    <span>✈️</span>
                    <span>Ready to wander!</span>
                    <span>✨</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowCloudShareModal(true)}
                    className="px-4 py-2 rounded-full bg-white hover:bg-[#F9FCFA] text-[#1C2E26] text-[13px] font-bold flex items-center gap-1.5 shadow-xs border border-[#E2EDE7] transition"
                  >
                    <Share2 className="w-3.5 h-3.5 text-[#D8562B]" />
                    <span>匯出/匯入 共享行程</span>
                  </button>
                </div>

                {/* 🌸 主視覺記憶卡片 (Hero Card) */}
                <div className="rounded-[28px] bg-white shadow-sm border border-[#E2EFE8] overflow-hidden">
                  <div
                    className="relative h-[242px] w-full bg-cover bg-center flex flex-col justify-between p-4"
                    style={{
                      backgroundImage: `url('/assets/tabi/hero_kyoto.png')`,
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/10 pointer-events-none" />

                    {/* 上方雙膠囊標籤 */}
                    <div className="relative z-10 flex items-center justify-between gap-2" data-no-flip="true">
                      <button
                        type="button"
                        onClick={() => setShowTripModal(true)}
                        className="px-3.5 py-1.5 rounded-2xl bg-[#FFFDF9]/95 text-[#A53816] text-[12px] font-extrabold leading-tight flex items-center gap-2 shadow-sm text-left"
                      >
                        <Ticket className="w-4 h-4 text-[#C84B24] shrink-0" />
                        <span>
                          {state.trip.memoryTag.split('#')[0]}
                          <br />#{state.trip.memoryTag.split('#')[1] || '04'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowTripModal(true)}
                        className="px-3.5 py-1.5 rounded-2xl bg-[#AEE8D1]/95 text-[#14533A] text-[12px] font-extrabold leading-tight flex items-center gap-1.5 shadow-sm"
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-[#155E42] inline-block" />
                        <span className="text-left">
                          {state.trip.statusTag}
                          <br />
                          <span className="inline-block w-3 h-3 rounded-full bg-[#7CB518] align-middle" />
                        </span>
                      </button>
                    </div>

                    {/* 下方目的地大標題與日期 */}
                    <div
                      className="relative z-10 text-white cursor-pointer"
                      onClick={() => setShowTripModal(true)}
                      data-no-flip="true"
                    >
                      <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#FCE5DC] drop-shadow-xs mb-0.5">
                        <CalendarCheck className="w-4 h-4 text-[#FADBD0]" />
                        <span>{state.trip.dateRangeLabel}</span>
                      </div>
                      <h1 className="text-[31px] font-extrabold tracking-tight leading-none drop-shadow-sm">
                        {state.trip.destinationTitle}
                      </h1>
                      <p className="text-[12.5px] text-white/90 font-medium mt-1.5 truncate">
                        {state.trip.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* 櫻花氣候提示底欄 */}
                  <div className="px-4 py-3 bg-white flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-2xl shrink-0">🌸</span>
                      <div className="min-w-0">
                        <div className="text-[13px] font-extrabold text-[#182B23] truncate">
                          {state.trip.weatherTitle}
                        </div>
                        <div className="text-[11.5px] text-[#5B7368] truncate">
                          {state.trip.weatherSub}
                        </div>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-[#FCE3DA] text-[#B83E1B] text-[11px] font-extrabold shrink-0">
                      {state.trip.weatherBadge}
                    </span>
                  </div>
                </div>

                {/* ✈️ Round-trip flights (升級為點擊觸發「包含即時搜尋過濾與航廈資訊的國際機場 Modal」) */}
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-2.5" data-no-flip="true">
                    <div className="flex items-center gap-2.5">
                      <span className="w-9 h-9 rounded-full bg-[#FCE1D6] text-[#C84A23] flex items-center justify-center shadow-2xs">
                        <Send className="w-4 h-4 -rotate-12" />
                      </span>
                      <h2 className="text-[19px] font-extrabold text-[#162921] tracking-tight">
                        Round-trip flights
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => openAirportPicker('outbound', 'depart')}
                      className="px-3 py-1 rounded-full bg-[#E1EFE8] hover:bg-[#d2e7dc] text-[#2F5243] text-[12px] font-bold flex items-center gap-1 transition"
                    >
                      <span>{state.trip.airlineLabel}</span>
                      <Edit3 className="w-3 h-3 ml-0.5" />
                    </button>
                  </div>

                  <div className="bg-white rounded-[28px] p-4 shadow-sm border border-[#E2EFE8] space-y-4">
                    {/* OUTBOUND 去程 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11.5px] font-extrabold tracking-wider text-[#1C6748] uppercase">
                          {state.outbound.dateLabel}
                        </span>
                        <button
                          type="button"
                          onClick={() => openAirportPicker('outbound', 'depart')}
                          data-no-flip="true"
                          className="px-2.5 py-0.5 rounded-full bg-[#D8F3E5] text-[#186043] text-[11px] font-extrabold hover:brightness-95 transition"
                        >
                          {state.outbound.flightNo}
                        </button>
                      </div>

                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                        {/* 去程出發時間與機場 (點擊開啟搜尋過濾 Modal) */}
                        <div data-no-flip="true">
                          <div className="text-[28px] font-black tracking-tight text-[#14241D] leading-tight tabular-nums">
                            {state.outbound.departTime}
                          </div>
                          <button
                            type="button"
                            onClick={() => openAirportPicker('outbound', 'depart')}
                            className="mt-0.5 inline-flex items-center gap-1 text-[16px] font-extrabold text-[#B8431F] hover:bg-[#FCE1D6]/50 px-1.5 py-0.5 -ml-1.5 rounded-lg transition"
                          >
                            <span>{state.outbound.departCode}</span>
                            {state.outbound.departTerminal && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#FCE1D6] text-[#9E3516] font-extrabold">
                                {state.outbound.departTerminal}
                              </span>
                            )}
                            <span className="text-[10px]">🔍</span>
                          </button>
                          <div className="text-[12px] text-[#647A70] font-medium truncate">
                            {state.outbound.departCity}
                          </div>
                        </div>

                        {/* 航程線 */}
                        <div className="flex flex-col items-center px-2">
                          <span className="text-[11px] font-bold text-[#5E4037] mb-1">
                            {state.outbound.duration}
                          </span>
                          <div className="w-28 flex items-center">
                            <div className="h-[2px] flex-1 bg-[#74C6A3]" />
                            <span className="mx-1 text-[#1E6F4E] text-xs font-bold">▷</span>
                            <div className="h-[2px] flex-1 bg-[#74C6A3]" />
                          </div>
                          <span className="text-[11.5px] font-bold text-[#22694B] mt-1">
                            {state.outbound.perkLabel}
                          </span>
                        </div>

                        {/* 去程抵達時間與機場 (點擊開啟搜尋過濾 Modal) */}
                        <div className="text-right" data-no-flip="true">
                          <div className="text-[28px] font-black tracking-tight text-[#14241D] leading-tight tabular-nums">
                            {state.outbound.arriveTime}
                          </div>
                          <button
                            type="button"
                            onClick={() => openAirportPicker('outbound', 'arrive')}
                            className="mt-0.5 inline-flex items-center justify-end gap-1 text-[16px] font-extrabold text-[#B8431F] hover:bg-[#FCE1D6]/50 px-1.5 py-0.5 -mr-1.5 rounded-lg transition"
                          >
                            <span>{state.outbound.arriveCode}</span>
                            {state.outbound.arriveTerminal && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#FCE1D6] text-[#9E3516] font-extrabold">
                                {state.outbound.arriveTerminal}
                              </span>
                            )}
                            <span className="text-[10px]">🔍</span>
                          </button>
                          <div className="text-[12px] text-[#647A70] font-medium truncate">
                            {state.outbound.arriveCity}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-dashed border-[#DCE8E2]" />

                    {/* RETURN 回程 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11.5px] font-extrabold tracking-wider text-[#1C5D99] uppercase">
                          {state.inbound.dateLabel}
                        </span>
                        <button
                          type="button"
                          onClick={() => openAirportPicker('inbound', 'depart')}
                          data-no-flip="true"
                          className="px-2.5 py-0.5 rounded-full bg-[#DCEBFA] text-[#1B5791] text-[11px] font-extrabold hover:brightness-95 transition"
                        >
                          {state.inbound.flightNo}
                        </button>
                      </div>

                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                        {/* 回程出發時間與機場 */}
                        <div data-no-flip="true">
                          <div className="text-[28px] font-black tracking-tight text-[#14241D] leading-tight tabular-nums">
                            {state.inbound.departTime}
                          </div>
                          <button
                            type="button"
                            onClick={() => openAirportPicker('inbound', 'depart')}
                            className="mt-0.5 inline-flex items-center gap-1 text-[16px] font-extrabold text-[#21609E] hover:bg-[#DCEBFA]/60 px-1.5 py-0.5 -ml-1.5 rounded-lg transition"
                          >
                            <span>{state.inbound.departCode}</span>
                            {state.inbound.departTerminal && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#DCEBFA] text-[#1B5791] font-extrabold">
                                {state.inbound.departTerminal}
                              </span>
                            )}
                            <span className="text-[10px]">🔍</span>
                          </button>
                          <div className="text-[12px] text-[#647A70] font-medium truncate">
                            {state.inbound.departCity}
                          </div>
                        </div>

                        {/* 航程線 */}
                        <div className="flex flex-col items-center px-2">
                          <span className="text-[11px] font-bold text-[#5E4037] mb-1">
                            {state.inbound.duration}
                          </span>
                          <div className="w-28 flex items-center">
                            <div className="h-[2px] flex-1 bg-[#7BB0E3]" />
                            <span className="mx-1 text-[#1E5C99] text-xs font-bold">▷</span>
                            <div className="h-[2px] flex-1 bg-[#7BB0E3]" />
                          </div>
                          <span className="text-[11.5px] font-bold text-[#225E96] mt-1">
                            {state.inbound.perkLabel}
                          </span>
                        </div>

                        {/* 回程抵達時間與機場 */}
                        <div className="text-right" data-no-flip="true">
                          <div className="text-[28px] font-black tracking-tight text-[#14241D] leading-tight tabular-nums">
                            {state.inbound.arriveTime}
                          </div>
                          <button
                            type="button"
                            onClick={() => openAirportPicker('inbound', 'arrive')}
                            className="mt-0.5 inline-flex items-center justify-end gap-1 text-[16px] font-extrabold text-[#21609E] hover:bg-[#DCEBFA]/60 px-1.5 py-0.5 -mr-1.5 rounded-lg transition"
                          >
                            <span>{state.inbound.arriveCode}</span>
                            {state.inbound.arriveTerminal && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#DCEBFA] text-[#1B5791] font-extrabold">
                                {state.inbound.arriveTerminal}
                              </span>
                            )}
                            <span className="text-[10px]">🔍</span>
                          </button>
                          <div className="text-[12px] text-[#647A70] font-medium truncate">
                            {state.inbound.arriveCity}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 底部登機證與行李按鈕 */}
                    <div className="grid grid-cols-2 gap-2.5 pt-1" data-no-flip="true">
                      <button
                        type="button"
                        onClick={() => setShowBoardingModal(true)}
                        className="py-2.5 px-3 rounded-2xl bg-[#E3F1EC] hover:bg-[#d5eae2] text-[#172B22] font-bold text-[12.5px] flex items-center justify-center gap-2 transition"
                      >
                        <Ticket className="w-4 h-4 text-[#B8431F] shrink-0" />
                        <div className="leading-tight text-center">
                          <div>Boarding Pass</div>
                          <span className="text-xs">🎫</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowBaggageModal(true)}
                        className="py-2.5 px-3 rounded-2xl bg-[#E3F1EC] hover:bg-[#d5eae2] text-[#172B22] font-bold text-[12.5px] flex items-center justify-center gap-2 transition"
                      >
                        <Briefcase className="w-4 h-4 text-[#1E6B4B] shrink-0" />
                        <div className="leading-tight text-center">
                          <div>{state.trip.baggageLabel}</div>
                          <span className="text-xs">🧳</span>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 🏨 Your stay (住宿資訊卡片) */}
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-2.5" data-no-flip="true">
                    <div className="flex items-center gap-2.5">
                      <span className="w-9 h-9 rounded-2xl bg-[#CBEBD9] text-[#185B3E] flex items-center justify-center shadow-2xs">
                        <BedDouble className="w-4 h-4" />
                      </span>
                      <h2 className="text-[19px] font-extrabold text-[#162921] tracking-tight">
                        Your stay
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowStayModal(true)}
                      className="px-3 py-1 rounded-full bg-[#BDE9D3] hover:bg-[#addfc6] text-[#15563B] text-[11.5px] font-extrabold flex items-center gap-1 transition"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{state.stay.paidStatus}</span>
                    </button>
                  </div>

                  <div className="bg-white rounded-[28px] p-4 shadow-sm border border-[#E2EFE8] space-y-3.5">
                    <div className="flex items-start gap-3.5">
                      <img
                        src={state.stay.photoUrl}
                        alt={state.stay.hotelName}
                        className="w-[88px] h-[88px] rounded-2xl object-cover shrink-0 shadow-xs"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] text-[#7D6B63] font-semibold flex items-center gap-1">
                          <span className="text-[#C85228] tracking-widest">☆☆☆☆</span>
                          <span>· {state.stay.category}</span>
                        </div>
                        <h3
                          onClick={() => setShowStayModal(true)}
                          className="text-[17px] font-extrabold text-[#152720] leading-snug mt-0.5 cursor-pointer hover:text-[#1D6B4B] truncate"
                          data-no-flip="true"
                        >
                          {state.stay.hotelName}
                        </h3>
                        <p className="text-[12px] text-[#665A54] truncate mt-0.5">
                          {state.stay.subTitle}
                        </p>

                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <span className="px-2.5 py-1 rounded-xl bg-[#DFF0E8] text-[#1D5E43] text-[11px] font-extrabold leading-tight">
                            {state.stay.tag1} 🌊
                          </span>
                          <span className="px-2.5 py-1 rounded-xl bg-[#FDE7DD] text-[#B33F1B] text-[11px] font-extrabold leading-tight">
                            {state.stay.tag2} 🥐
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* CHECK-IN / CHECK-OUT */}
                    <div
                      onClick={() => setShowStayModal(true)}
                      className="rounded-2xl bg-[#E3F1EC] px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-[#d9ebe4] transition"
                      data-no-flip="true"
                    >
                      <div>
                        <div className="text-[10.5px] font-bold tracking-wider text-[#436456] uppercase">
                          CHECK-IN
                        </div>
                        <div className="text-[14px] font-extrabold text-[#13251E] mt-0.5">
                          {state.stay.checkIn}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10.5px] font-bold tracking-wider text-[#436456] uppercase">
                          CHECK-OUT
                        </div>
                        <div className="text-[14px] font-extrabold text-[#13251E] mt-0.5">
                          {state.stay.checkOut}
                        </div>
                      </div>
                    </div>

                    {/* 地址與 Google Maps 導航按鈕 */}
                    <div
                      className="rounded-2xl bg-[#EEF6F2] px-3.5 py-2.5 flex items-center justify-between gap-2"
                      data-no-flip="true"
                    >
                      <div className="flex items-center gap-2 min-w-0 text-[12.5px] text-[#355245] font-medium">
                        <MapPin className="w-4 h-4 text-[#C24726] shrink-0" />
                        <span className="truncate">{state.stay.address}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => openGoogleMaps(`${state.stay.hotelName} ${state.stay.address}`)}
                        className="px-3 py-1 rounded-full bg-[#1C6748] hover:bg-[#144f37] text-white text-[11.5px] font-bold flex items-center gap-1 shrink-0 shadow-2xs transition"
                      >
                        <span>🗺️ Open</span>
                      </button>
                    </div>

                    {/* Insider Scoop 提示框 */}
                    <div className="rounded-2xl bg-[#FDF0E7] p-3.5 flex items-start gap-2.5 text-[12px] leading-relaxed text-[#5C3626]">
                      <span className="text-base shrink-0">💡</span>
                      <div>
                        <strong className="text-[#9E3516] font-extrabold">Insider Scoop: </strong>
                        {state.stay.insiderScoop}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 🍵 ICOCA Card reloaded! 底部交通卡橫幅 */}
                <div
                  onClick={() => {
                    setState((prev) => ({
                      ...prev,
                      trip: {
                        ...prev.trip,
                        icocaBalance: prev.trip.icocaBalance + 1000,
                        icocaSub: `¥${(prev.trip.icocaBalance + 1000).toLocaleString()} ready for subway & vending machines`,
                      },
                    }));
                    showToast('🍵 ICOCA 卡已加值 ¥1,000！');
                  }}
                  className="rounded-[26px] bg-gradient-to-r from-[#BCEAD5] to-[#D6F3E5] p-4 flex items-center justify-between gap-3 cursor-pointer shadow-xs hover:brightness-98 transition"
                  data-no-flip="true"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-white flex items-center justify-center text-xl shadow-2xs shrink-0">
                      🍵
                    </div>
                    <div>
                      <div className="text-[14.5px] font-extrabold text-[#16573C]">
                        {state.trip.icocaTitle}
                      </div>
                      <div className="text-[12px] text-[#2E6F54] font-medium">
                        {state.trip.icocaSub}
                      </div>
                    </div>
                  </div>
                  <span className="text-[#16573C] text-xl font-bold pr-1">→</span>
                </div>
              </div>
            </div>
          </div>

          {/* =====================================================================
              PAGE 2 (Index 1): 行程編排頁 (PLAN - 1:1 還原 Figma 截圖 2 + 目的地清單與一鍵生成圖片)
             ===================================================================== */}
          <div className="tabi-book-page w-full h-full">
            <div className="h-[780px] overflow-y-auto pb-24 tabi-scroll bg-[#EDF6F1]">
              {renderPageHeader('PLAN')}

              <div className="px-5 space-y-4">
                {/* 標題 + 右側「🖼️ 生成相關圖片」與「+ Fun」按鈕 */}
                <div className="flex items-start justify-between pt-1">
                  <div>
                    <h1 className="text-[26px] font-black tracking-tight text-[#14241D] leading-[1.12]">
                      A day to
                      <br />
                      remember
                    </h1>
                    <button
                      type="button"
                      onClick={() => setShowTripModal(true)}
                      data-no-flip="true"
                      className="flex items-center gap-1.5 text-[12px] text-[#5C473E] font-bold mt-1.5 hover:underline"
                    >
                      <MapPin className="w-3.5 h-3.5 text-[#C24726]" />
                      <span>{state.trip.destinationTitle}</span>
                      <span className="text-[#D4A999]">•</span>
                      <span>
                        {state.trip.startDate} ~ {state.trip.endDate} ✏️
                      </span>
                    </button>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 pt-0.5" data-no-flip="true">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-5 h-5 text-[#F5B82E] fill-[#F5B82E]" />
                      <button
                        type="button"
                        onClick={() => {
                          setPlanDestPoolExpanded(true);
                          const firstUnscheduled = state.destinations.find((d) => !d.scheduled);
                          if (firstUnscheduled) {
                            openScheduleModal(firstUnscheduled);
                          } else if (state.destinations[0]) {
                            openScheduleModal(state.destinations[0]);
                          }
                        }}
                        className="px-3.5 py-1.5 rounded-full bg-[#A83815] hover:bg-[#8f2e10] text-white font-extrabold text-[12px] flex items-center gap-1 shadow-sm transition"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>+ Fun 排程</span>
                      </button>
                    </div>

                    {/* 🤖 AI 行程優化 & 🖼️ 一鍵生成相關圖片按鈕列 */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenAIOptimizer('fill_and_reorder')}
                        className="px-3 py-1.5 rounded-full bg-[#C24726] hover:bg-[#a6391b] text-white text-[11px] font-extrabold flex items-center gap-1 shadow-xs transition"
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                        <span>AI 行程優化</span>
                      </button>

                      <button
                        type="button"
                        disabled={isGeneratingPhotos}
                        onClick={handleGenerateItineraryPhotos}
                        className="px-3 py-1.5 rounded-full bg-[#1A5D42] hover:bg-[#134631] disabled:opacity-60 text-white text-[11px] font-extrabold flex items-center gap-1 shadow-xs transition"
                      >
                        {isGeneratingPhotos ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>生成中 {photoGenProgress}</span>
                          </>
                        ) : (
                          <>
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>生成相關圖片</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 📋 目的地清單 (保留之前功能：手動輸入、從另一個 PWA 匯入 文字.txt 格式、自由編排行程日期) */}
                {renderDestinationPoolSection()}

                {/* 🗓️ 升級版：支援超過 4 天 (最多 30 天) 左右滑動 / 拖曳 / 箭頭切換的水平日期選擇器 */}
                <div className="space-y-1.5" data-no-flip="true">
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-[11px] font-extrabold text-[#3B594B] flex items-center gap-1">
                      <span>📅 行程日期（共 {tripDays.length} 天 · 可左右滑動選擇）</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedDay > 0) {
                            setSelectedDay(selectedDay - 1);
                          } else {
                            scrollDayStripBy(-160);
                          }
                        }}
                        className="w-6 h-6 rounded-lg bg-white hover:bg-[#E2EFE8] text-[#1A5D42] border border-[#CFE2D8] flex items-center justify-center shadow-2xs transition"
                        title="上一天 / 向左滑動"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[11px] font-black text-[#1A5D42] px-1 tabular-nums">
                        Day {selectedDay + 1}/{tripDays.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedDay < tripDays.length - 1) {
                            setSelectedDay(selectedDay + 1);
                          } else {
                            scrollDayStripBy(160);
                          }
                        }}
                        className="w-6 h-6 rounded-lg bg-white hover:bg-[#E2EFE8] text-[#1A5D42] border border-[#CFE2D8] flex items-center justify-center shadow-2xs transition"
                        title="下一天 / 向右滑動"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div
                    ref={dayStripRef}
                    onTouchStart={(e) => e.stopPropagation()}
                    onTouchMove={(e) => e.stopPropagation()}
                    onWheel={(e) => {
                      if (dayStripRef.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                        dayStripRef.current.scrollLeft += e.deltaY;
                      }
                    }}
                    onMouseDown={(e) => {
                      if (!dayStripRef.current) return;
                      dayStripDragRef.current = {
                        isDown: true,
                        startX: e.pageX - dayStripRef.current.offsetLeft,
                        scrollLeft: dayStripRef.current.scrollLeft,
                        moved: false,
                      };
                    }}
                    onMouseMove={(e) => {
                      if (!dayStripDragRef.current.isDown || !dayStripRef.current) return;
                      const x = e.pageX - dayStripRef.current.offsetLeft;
                      const walk = (x - dayStripDragRef.current.startX) * 1.4;
                      if (Math.abs(walk) > 5) {
                        dayStripDragRef.current.moved = true;
                        dayStripRef.current.scrollLeft = dayStripDragRef.current.scrollLeft - walk;
                      }
                    }}
                    onMouseUp={() => {
                      dayStripDragRef.current.isDown = false;
                    }}
                    onMouseLeave={() => {
                      dayStripDragRef.current.isDown = false;
                    }}
                    className="flex items-center gap-2.5 overflow-x-auto day-strip-scroll py-1.5 px-0.5 cursor-grab active:cursor-grabbing"
                  >
                    {tripDays.map((d) => {
                      const isSelected = selectedDay === d.index;
                      const countOnDay = state.activities.filter((a) => a.dayIndex === d.index).length;
                      return (
                        <button
                          key={d.iso}
                          type="button"
                          data-day-idx={d.index}
                          onClick={() => {
                            if (dayStripDragRef.current.moved) {
                              dayStripDragRef.current.moved = false;
                              return;
                            }
                            setSelectedDay(d.index);
                          }}
                          className={`px-4 py-2.5 rounded-2xl text-left shrink-0 transition ${
                            isSelected
                              ? 'bg-white shadow-sm border-2 border-[#1A5D42]'
                              : 'bg-[#E3EDE7] hover:bg-[#d8e6de] text-[#354C42] border border-transparent'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-[15px] font-extrabold text-[#162820]">
                            <span>{d.label}</span>
                            {isSelected ? (
                              <span className="w-2 h-2 rounded-full bg-[#E05A2B] inline-block" />
                            ) : countOnDay > 0 ? (
                              <span className="px-1.5 py-0.2 rounded-full bg-[#CBE2D6] text-[#1A5D42] text-[9.5px] font-black">
                                {countOnDay}
                              </span>
                            ) : null}
                          </div>
                          <div
                            className={`text-[11.5px] font-bold mt-0.5 whitespace-nowrap ${
                              isSelected ? 'text-[#B8411D]' : 'text-[#5A7066]'
                            }`}
                          >
                            {d.dateDisp}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Arrive. Settle in. Explore. 摘要橫幅 + 當日預算小計與自動排序 */}
                <div className="rounded-2xl bg-[#E4F0EA] p-3.5 space-y-2.5" data-no-flip="true">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#FADBD0] text-[#B8411D] flex items-center justify-center shrink-0">
                      <Compass className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-extrabold text-[#152720]">
                        Arrive. Settle in. Explore.
                      </div>
                      <div className="text-[11.5px] text-[#556B60] leading-snug mt-0.5">
                        {dayActivities.length} activities · 當日預算小計:{' '}
                        <span className="text-[#9E3516] font-extrabold">
                          ¥{dayBudgetTotal.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#D3E5DC]">
                    <span className="text-[11px] font-bold text-[#355245]">
                      💡 可按「AI 行程優化」自動分配未排時段景點與順路排序
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenAIOptimizer('fill_and_reorder')}
                        className="px-2.5 py-1 rounded-xl bg-[#1A5D42] hover:bg-[#134631] text-white text-[11px] font-extrabold flex items-center gap-1 shadow-2xs transition"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>AI 優化</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleOptimizeDayRoute}
                        className="px-2.5 py-1 rounded-xl bg-white hover:bg-[#F5FBF8] text-[#1A5D42] text-[11px] font-extrabold flex items-center gap-1 shadow-2xs border border-[#CBE2D6] transition"
                      >
                        <Wand2 className="w-3 h-3" />
                        <span>當日排序</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 🕒 垂直時間軸與行程卡片清單 */}
                <div className="relative pl-12 space-y-5 pt-1">
                  <div className="absolute left-[21px] top-6 bottom-8 w-[2px] bg-[#CFE0D7]" />

                  {dayActivities.length === 0 ? (
                    <div className="bg-white rounded-2xl p-6 text-center border border-dashed border-[#CBE2D6] text-xs text-[#5B7368] font-bold">
                      此日期尚無排程，請從上方「📋 目的地清單」點擊「📅 排程」將景點加入這一天！
                    </div>
                  ) : (
                    dayActivities.map((act, idx) => {
                      const dotColorClass =
                        act.dotColor === 'orange'
                          ? 'bg-[#C24726] ring-[#FADBD0]'
                          : act.dotColor === 'green'
                          ? 'bg-[#1D6B4B] ring-[#CBEBD9]'
                          : 'bg-[#21609E] ring-[#D6E8FA]';

                      const kickerColorClass =
                        act.dotColor === 'orange'
                          ? 'text-[#B8411D]'
                          : act.dotColor === 'green'
                          ? 'text-[#1D6B4B]'
                          : 'text-[#21609E]';

                      const iconBoxClass =
                        act.dotColor === 'orange'
                          ? 'bg-[#FDE4DA] text-[#B8411D]'
                          : act.dotColor === 'green'
                          ? 'bg-[#CBEBD9] text-[#185B3E]'
                          : 'bg-[#DCEBFA] text-[#1E5C99]';

                      const pillBadgeClass =
                        act.dotColor === 'orange'
                          ? 'bg-[#FDE4DA] text-[#8F2F12]'
                          : act.dotColor === 'green'
                          ? 'bg-[#BCEAD5] text-[#15543A]'
                          : 'bg-[#D7E8FA] text-[#194E82]';

                      return (
                        <div key={act.id} className="relative">
                          {/* 左側時間與圓點 */}
                          <div className="absolute -left-12 top-1 w-11 flex flex-col items-center">
                            <span className="text-[11.5px] font-extrabold text-[#1D3028] tabular-nums">
                              {act.time}
                            </span>
                            <span
                              className={`mt-1.5 w-3 h-3 rounded-full ring-4 ${dotColorClass}`}
                            />
                          </div>

                          {/* 右側白底行程卡片 */}
                          <div className="bg-white rounded-[26px] p-4 shadow-sm border border-[#E2EFE8] space-y-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBoxClass}`}
                                >
                                  {idx % 3 === 0 ? (
                                    <Utensils className="w-4 h-4" />
                                  ) : idx % 3 === 1 ? (
                                    <Landmark className="w-4 h-4" />
                                  ) : (
                                    <Sunset className="w-4 h-4" />
                                  )}
                                </div>
                                <div>
                                  <div
                                    className={`text-[11px] font-extrabold tracking-wider uppercase leading-tight ${kickerColorClass}`}
                                  >
                                    {act.kicker}
                                  </div>
                                  <div className="text-[11.5px] text-[#786860] font-medium">
                                    {act.duration}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1" data-no-flip="true">
                                <span
                                  className={`px-2.5 py-1 rounded-full text-[10.5px] font-extrabold ${pillBadgeClass}`}
                                >
                                  {act.badgeText}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleMoveActivityOrder(act.id, -1)}
                                  title="上移順序"
                                  className="p-1 text-[#789085] hover:text-[#1A5D42] rounded"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveActivityOrder(act.id, 1)}
                                  title="下移順序"
                                  className="p-1 text-[#789085] hover:text-[#1A5D42] rounded"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteActivity(act.id)}
                                  title="移除此排程"
                                  className="p-1 text-[#95A89F] hover:text-[#C24726] rounded-full transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div>
                              <h3 className="text-[18px] font-extrabold text-[#14251E] leading-snug">
                                {act.title}
                              </h3>
                              <button
                                type="button"
                                onClick={() => openGoogleMaps(`${act.title} ${act.location}`)}
                                className="flex items-center gap-1 text-[12.5px] font-bold text-[#1D6B4B] hover:underline mt-0.5 text-left"
                                data-no-flip="true"
                              >
                                <MapPin className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">{act.location}</span>
                              </button>
                            </div>

                            <div className="rounded-xl bg-[#EAF4EF] p-3 text-[12px] text-[#4A5E54] leading-relaxed">
                              {act.note}
                            </div>

                            {/* 景點照片與右下角標籤 + 單張圖片重新生成按鈕 */}
                            <div
                              className="relative rounded-2xl overflow-hidden h-[116px] w-full bg-[#DFECE5] group"
                              data-no-flip="true"
                            >
                              <img
                                src={act.photoUrl}
                                alt={act.title}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                              <button
                                type="button"
                                onClick={() => handleRefreshSingleActivityPhoto(act)}
                                className="absolute top-2 right-2 px-2.5 py-1 rounded-full bg-black/60 hover:bg-black/80 text-white text-[10.5px] font-bold flex items-center gap-1 backdrop-blur-xs transition"
                              >
                                <ImageIcon className="w-3 h-3" />
                                <span>自動配圖</span>
                              </button>
                              {act.photoBadge && (
                                <span className="absolute bottom-2 right-2 px-2.5 py-1 rounded-full bg-black/65 text-white text-[11px] font-extrabold backdrop-blur-xs">
                                  {act.photoBadge}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* 🎲 Room for a little spontaneity? 隨機驚喜卡片 */}
                <div className="rounded-[26px] bg-[#DFEEE6] p-5 text-center space-y-2.5 border border-[#CDE3D7]">
                  <div className="flex items-center justify-center gap-1.5 text-[15px] font-extrabold text-[#1A5D42]">
                    <Dices className="w-4 h-4" />
                    <span>Room for a little spontaneity?</span>
                  </div>
                  <p className="text-[12px] text-[#5C4B43] leading-relaxed px-2">
                    Tap the die to shuffle a secret local hidden gem for tonight! 🎲
                  </p>
                  <div className="pt-1" data-no-flip="true">
                    <button
                      type="button"
                      onClick={handleShuffleSurprise}
                      className="px-5 py-2.5 rounded-full bg-[#1C6748] hover:bg-[#144f37] text-white text-[12.5px] font-extrabold inline-flex items-center gap-1.5 shadow-sm transition active:scale-98"
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                      <span>Shuffle Surprise</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* =====================================================================
              PAGE 3 (Index 2): 工具與行程消費頁 (TOOLS - 1:1 還原 Figma 截圖 3 + StPageFlip 滑動開關 Option Box)
             ===================================================================== */}
          <div className="tabi-book-page w-full h-full">
            <div className="h-[780px] overflow-y-auto pb-24 tabi-scroll bg-[#EDF6F1]">
              {renderPageHeader('TOOLS')}

              <div className="px-5 space-y-4">
                {/* 標題與 Live FX 標籤 */}
                <div className="pt-1">
                  <div className="flex items-center justify-between gap-2">
                    <h1 className="text-[26px] font-black tracking-tight text-[#14241D]">
                      貨幣兌換 & 旅行記帳
                    </h1>
                    <span className="px-3 py-1 rounded-full bg-[#BDE9D3] text-[#14593D] text-[11.5px] font-extrabold flex items-center gap-1.5 shrink-0">
                      <span className="w-2 h-2 rounded-full bg-[#166947]" />
                      <span>Live FX</span>
                    </span>
                  </div>
                  <p className="text-[12.5px] text-[#5D4C44] font-medium mt-1">
                    Track your yen before the matcha lattes drain your wallet 🍵💸
                  </p>
                </div>

                {/* 📖 StPageFlip 手指滑動翻頁開關與邊緣觸發區設定 Option Box */}
                <div
                  className="bg-white rounded-[24px] p-3.5 shadow-xs border border-[#CFE3D8] space-y-2.5"
                  data-no-flip="true"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                          state.enableSwipeFlip
                            ? 'bg-[#CBEBD9] text-[#165C3E]'
                            : 'bg-[#FDE6DC] text-[#B8431F]'
                        }`}
                      >
                        <Hand className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-extrabold text-[#14241D] flex items-center gap-1.5 flex-wrap">
                          <span>StPageFlip 手指滑動翻頁</span>
                          <span
                            className={`px-2 py-0.2 rounded-full text-[10px] font-black ${
                              state.enableSwipeFlip
                                ? 'bg-[#D8F3E5] text-[#165C3E]'
                                : 'bg-[#FBE4DF] text-[#B53D1B]'
                            }`}
                          >
                            {state.enableSwipeFlip
                              ? state.swipeEdgeOnly !== false
                                ? '僅左右邊緣 24px'
                                : '全畫面滑動'
                              : '已關閉（預設防誤觸）'}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#5A7066] mt-0.5 leading-snug">
                          預設關閉手指滑動以避免測試與操作時誤觸轉頁；底部導覽列隨時可直接點選 3D 翻頁。
                        </p>
                      </div>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={state.enableSwipeFlip}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setState((prev) => ({
                            ...prev,
                            enableSwipeFlip: checked,
                            swipeEdgeOnly: true,
                            swipePolicyVersion: 3,
                          }));
                          showToast(
                            checked
                              ? '📐 已開啟「僅左右兩側 24px 邊緣」滑動 3D 翻頁'
                              : '🔒 已關閉手指滑動翻頁（保持底部導覽列直接切換）'
                          );
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-12 h-7 bg-[#D5E4DC] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5.5 after:w-5.5 after:transition-all peer-checked:bg-[#1A5D42]" />
                    </label>
                  </div>

                  {/* 觸發範圍快速選擇按鈕組 */}
                  <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-[#EBF3EE]">
                    <button
                      type="button"
                      onClick={() => {
                        setState((prev) => ({
                          ...prev,
                          enableSwipeFlip: false,
                          swipePolicyVersion: 3,
                        }));
                        showToast('🔒 已設為「關閉手指滑動翻頁」（僅底部切換）');
                      }}
                      className={`py-1.5 px-2 rounded-xl text-[11px] font-extrabold transition ${
                        !state.enableSwipeFlip
                          ? 'bg-[#1A5D42] text-white shadow-2xs'
                          : 'bg-[#EEF5F1] text-[#496558] hover:bg-[#E1EDE6]'
                      }`}
                    >
                      🔒 關閉滑動 (預設)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setState((prev) => ({
                          ...prev,
                          enableSwipeFlip: true,
                          swipeEdgeOnly: true,
                          swipePolicyVersion: 3,
                        }));
                        showToast('📐 已設為「僅左右兩側 24px 邊緣」觸發翻頁');
                      }}
                      className={`py-1.5 px-2 rounded-xl text-[11px] font-extrabold transition ${
                        state.enableSwipeFlip && state.swipeEdgeOnly !== false
                          ? 'bg-[#1A5D42] text-white shadow-2xs'
                          : 'bg-[#EEF5F1] text-[#496558] hover:bg-[#E1EDE6]'
                      }`}
                    >
                      📐 僅兩側邊緣 (24px)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setState((prev) => ({
                          ...prev,
                          enableSwipeFlip: true,
                          swipeEdgeOnly: false,
                          swipePolicyVersion: 3,
                        }));
                        showToast('🖐️ 已設為「全畫面左右滑動」翻頁');
                      }}
                      className={`py-1.5 px-2 rounded-xl text-[11px] font-extrabold transition ${
                        state.enableSwipeFlip && state.swipeEdgeOnly === false
                          ? 'bg-[#C24726] text-white shadow-2xs'
                          : 'bg-[#EEF5F1] text-[#496558] hover:bg-[#E1EDE6]'
                      }`}
                    >
                      🖐️ 全畫面滑動
                    </button>
                  </div>
                </div>

                {/* 💱 雙向貨幣兌換卡片 */}
                <div
                  className="bg-white rounded-[28px] p-4 shadow-sm border border-[#E2EFE8] space-y-3"
                  data-no-flip="true"
                >
                  {/* 頂部即時匯率列與常用幣別快速切換 */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="px-3 py-1.5 rounded-2xl bg-[#E3F2EA] text-[#186043] text-[11.5px] font-extrabold flex items-center gap-1.5 min-w-0">
                      <Zap className="w-3.5 h-3.5 text-[#186043] shrink-0" />
                      <span className="truncate">{unitRateBannerText} ⚡</span>
                    </div>

                    <select
                      aria-label="Quick Currency Pair Switch"
                      value={state.currencyB}
                      onChange={(e) =>
                        setState((prev) => ({ ...prev, currencyB: e.target.value }))
                      }
                      className="px-2.5 py-1.5 rounded-xl bg-[#FDF5F2] text-[#9E3516] text-[11.5px] font-extrabold cursor-pointer border border-[#F5DDD4] focus:outline-none"
                    >
                      <option value="USD">TWD / HKD ⌄</option>
                      <option value="TWD">🇹🇼 切換 TWD 新台幣</option>
                      <option value="HKD">🇭🇰 切換 HKD 港幣</option>
                      <option value="USD">🇺🇸 切換 USD 美金</option>
                      <option value="KRW">🇰🇷 切換 KRW 韓元</option>
                      <option value="THB">🇹🇭 切換 THB 泰銖</option>
                      <option value="SGD">🇸🇬 切換 SGD 新幣</option>
                      <option value="EUR">🇪🇺 切換 EUR 歐元</option>
                    </select>
                  </div>

                  {/* 貨幣 A 與 貨幣 B 上下雙框 + 中央交換按鈕 */}
                  <div className="relative space-y-2.5">
                    {/* 貨幣 A · 支出支付 (You pay) */}
                    <div className="rounded-2xl bg-[#E8F3EE] p-3.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] font-bold text-[#4F3B32]">
                          貨幣A · 支出支付 (You pay)
                        </span>
                        <div className="relative">
                          <select
                            aria-label="Select Currency A"
                            value={state.currencyA}
                            onChange={(e) =>
                              setState((prev) => ({ ...prev, currencyA: e.target.value }))
                            }
                            className="appearance-none bg-white pl-3 pr-7 py-1 rounded-full text-[13px] font-extrabold text-[#162921] shadow-2xs border border-[#DCE9E2] cursor-pointer focus:outline-none"
                          >
                            {CURRENCIES.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.flag} {c.code}
                              </option>
                            ))}
                          </select>
                          <span className="pointer-events-none absolute right-2.5 top-1.5 text-[11px] text-[#4E665B]">
                            ▾
                          </span>
                        </div>
                      </div>

                      <div className="flex items-baseline justify-between gap-2 pt-1">
                        <span className="text-[20px] font-extrabold text-[#B53D1B]">
                          {curAObj.symbol}
                        </span>
                        <input
                          type="number"
                          value={state.exchangeAmount || ''}
                          onChange={(e) =>
                            setState((prev) => ({
                              ...prev,
                              exchangeAmount: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          placeholder="0"
                          className="w-full text-right bg-transparent text-[32px] font-black tracking-tight text-[#14241D] focus:outline-none tabular-nums"
                        />
                      </div>
                    </div>

                    {/* 中央橘紅交換按鈕 */}
                    <button
                      type="button"
                      onClick={handleSwapCurrencies}
                      title="交換貨幣 A 與 B"
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-[#B53D1B] hover:bg-[#993113] text-white flex items-center justify-center shadow-md border-2 border-white transition active:scale-95"
                    >
                      <ArrowUpDown className="w-4 h-4" />
                    </button>

                    {/* 貨幣 B · 折合 (Equivalent) */}
                    <div className="rounded-2xl bg-[#E8F3EE] p-3.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] font-bold text-[#4F3B32]">
                          貨幣B · 折合 (Equivalent)
                        </span>
                        <div className="relative">
                          <select
                            aria-label="Select Currency B"
                            value={state.currencyB}
                            onChange={(e) =>
                              setState((prev) => ({ ...prev, currencyB: e.target.value }))
                            }
                            className="appearance-none bg-white pl-3 pr-7 py-1 rounded-full text-[13px] font-extrabold text-[#162921] shadow-2xs border border-[#DCE9E2] cursor-pointer focus:outline-none"
                          >
                            {CURRENCIES.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.flag} {c.code}
                              </option>
                            ))}
                          </select>
                          <span className="pointer-events-none absolute right-2.5 top-1.5 text-[11px] text-[#4E665B]">
                            ▾
                          </span>
                        </div>
                      </div>

                      <div className="flex items-baseline justify-between gap-2 pt-1">
                        <span className="text-[20px] font-extrabold text-[#1D6B4B]">
                          {curBObj.symbol}
                        </span>
                        <div className="text-[32px] font-black tracking-tight text-[#14241D] tabular-nums">
                          {convertedValueB}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 快捷金額累加列 (+¥1,000 / +¥5,000 / +¥10,000 / Clear) */}
                  <div className="flex items-center justify-between gap-1.5 pt-1">
                    {[1000, 5000, 10000].map((inc) => (
                      <button
                        key={inc}
                        type="button"
                        onClick={() =>
                          setState((prev) => ({
                            ...prev,
                            exchangeAmount: (Number(prev.exchangeAmount) || 0) + inc,
                          }))
                        }
                        className="flex-1 py-2 px-2 rounded-full bg-[#E5F1EC] hover:bg-[#d5e8e0] text-[#172C23] text-[12px] font-extrabold transition tabular-nums"
                      >
                        +{curAObj.symbol}
                        {inc.toLocaleString()}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setState((prev) => ({ ...prev, exchangeAmount: 0 }))}
                      className="py-2 px-3.5 rounded-full bg-[#FBE4DF] hover:bg-[#f6d3cb] text-[#B53D1B] text-[12px] font-extrabold transition shrink-0"
                    >
                      Clear 🧹
                    </button>
                  </div>
                </div>

                {/* 💳 總預算進度 (Budget) */}
                <div
                  onClick={() => setShowBudgetEditModal(true)}
                  className="rounded-[26px] bg-[#E5F2EC] p-4 space-y-2.5 border border-[#D4E8DF] cursor-pointer hover:brightness-98 transition"
                  data-no-flip="true"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[15px] font-extrabold text-[#152820]">
                      <Wallet className="w-4 h-4 text-[#1B6747]" />
                      <span>總預算進度 (Budget)</span>
                    </div>
                    <span className="text-[13.5px] font-extrabold text-[#B53D1B] tabular-nums">
                      {budgetSpentPercent}% spent
                    </span>
                  </div>

                  <div className="w-full h-2.5 rounded-full bg-[#D3E4DC] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#1D6B4B] via-[#287A58] to-[#DF6437] transition-all duration-300"
                      style={{ width: `${budgetSpentPercent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11.5px] font-extrabold pt-0.5">
                    <span className="text-[#593A2E] tabular-nums">
                      已花費: ¥{totalSpentJPY.toLocaleString()}
                    </span>
                    <span className="text-[#196444] tabular-nums">
                      剩餘: ¥{remainingBudgetJPY.toLocaleString()} · 🍦 放心喝抹茶拿鐵！
                    </span>
                  </div>
                </div>

                {/* 🧾 快速記帳 Quick Expense Log */}
                <div className="space-y-3 pt-1" data-no-flip="true">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h2 className="text-[18px] font-extrabold text-[#14241D]">
                        快速記帳 Quick Expense Log
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#FBE2D8] text-[#B53D1B] text-[11px] font-extrabold">
                        4 類別
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategoryFilter('all');
                        setShowExpenseDetailList((prev) => !prev);
                      }}
                      className="text-[12px] font-extrabold text-[#B53D1B] hover:underline"
                    >
                      {showExpenseDetailList ? '收起明細' : '查看明細'}
                    </button>
                  </div>

                  {/* 4 大消費類別總覽卡片 */}
                  <div className="space-y-2.5">
                    {EXPENSE_CATEGORIES.map((cat) => {
                      const catTotalJPY = categoryTotals[cat.key] || 0;
                      const catEquiv = convertAmount(catTotalJPY, 'JPY', state.currencyB);
                      return (
                        <div
                          key={cat.key}
                          onClick={() => {
                            setSelectedCategoryFilter(cat.key);
                            setShowExpenseDetailList(true);
                          }}
                          className="bg-white rounded-[24px] p-3.5 shadow-2xs border border-[#E2EFE8] flex items-center justify-between gap-3 cursor-pointer hover:border-[#B8DEC9] transition"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${cat.iconBg} ${cat.iconColor}`}
                            >
                              {cat.key === 'shopping' && <ShoppingCart className="w-5 h-5" />}
                              {cat.key === 'dining' && <Utensils className="w-5 h-5" />}
                              {cat.key === 'transport' && <TrainFront className="w-5 h-5" />}
                              {cat.key === 'gifts' && <Gift className="w-5 h-5" />}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[15.5px] font-extrabold text-[#152720] truncate">
                                  {cat.zhTitle}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-lg text-[10.5px] font-extrabold shrink-0 ${cat.badgeBg} ${cat.badgeColor}`}
                                >
                                  {cat.badgeText}
                                </span>
                              </div>
                              <div className="text-[12px] text-[#6E5D54] truncate mt-0.5">
                                {cat.desc}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-[16px] font-extrabold text-[#14241D] tabular-nums">
                              ¥{catTotalJPY.toLocaleString()}
                            </div>
                            <div className="text-[11.5px] text-[#6E5D54] font-medium tabular-nums">
                              ≈ {curBObj.symbol}
                              {catEquiv.toLocaleString(undefined, {
                                minimumFractionDigits:
                                  state.currencyB === 'JPY' || state.currencyB === 'KRW' ? 0 : 2,
                                maximumFractionDigits:
                                  state.currencyB === 'JPY' || state.currencyB === 'KRW' ? 0 : 2,
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 展開的單筆消費明細清單 */}
                  {showExpenseDetailList && (
                    <div className="bg-white rounded-[24px] p-4 border border-[#CFE3D8] shadow-xs space-y-2.5">
                      <div className="flex items-center justify-between border-b border-[#E6F0EB] pb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setSelectedCategoryFilter('all')}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              selectedCategoryFilter === 'all'
                                ? 'bg-[#1A5D42] text-white'
                                : 'bg-[#EAF4EF] text-[#355245]'
                            }`}
                          >
                            全部 ({state.expenses.length})
                          </button>
                          {EXPENSE_CATEGORIES.map((c) => (
                            <button
                              key={c.key}
                              type="button"
                              onClick={() => setSelectedCategoryFilter(c.key)}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                selectedCategoryFilter === c.key
                                  ? 'bg-[#1A5D42] text-white'
                                  : 'bg-[#EAF4EF] text-[#355245]'
                              }`}
                            >
                              {c.zhTitle.split(' ')[0]}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1 tabi-scroll">
                        {state.expenses
                          .filter((item) =>
                            selectedCategoryFilter === 'all'
                              ? true
                              : item.category === selectedCategoryFilter
                          )
                          .map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#F4FAF6] border border-[#E2EFE8]"
                            >
                              <div className="min-w-0">
                                <div className="text-[13.5px] font-extrabold text-[#162921] truncate">
                                  {item.title}
                                </div>
                                <div className="text-[11px] text-[#665850] truncate">
                                  {item.shopOrNote} · {item.createdAt}
                                </div>
                              </div>
                              <div className="flex items-center gap-2.5 shrink-0">
                                <div className="text-right">
                                  <div className="text-[13.5px] font-extrabold text-[#162921] tabular-nums">
                                    ¥{item.amountJPY.toLocaleString()}
                                  </div>
                                  {item.originalCurrency !== 'JPY' && (
                                    <div className="text-[10px] text-[#6E5D54] tabular-nums">
                                      ({item.originalAmount} {item.originalCurrency})
                                    </div>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteExpense(item.id)}
                                  title="刪除此筆消費"
                                  className="w-7 h-7 rounded-full bg-[#FBE4DF] hover:bg-[#f5cdc4] text-[#B53D1B] flex items-center justify-center transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        {state.expenses.length === 0 && (
                          <div className="text-center py-6 text-xs text-[#6E7F77]">
                            目前尚無消費紀錄，點擊下方按鈕新增第一筆支出！
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 🍵 今日最新小確幸 Highlight Card */}
                  {latestExpense && (
                    <div className="rounded-[24px] bg-[#E3F1EB] p-3.5 flex items-center justify-between gap-3 border border-[#CFE4DA]">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={latestExpense.photoUrl || '/assets/tabi/matcha_parfait.png'}
                          alt={latestExpense.title}
                          className="w-16 h-16 rounded-2xl object-cover shrink-0 shadow-2xs"
                          referrerPolicy="no-referrer"
                        />
                        <div className="min-w-0">
                          <div className="text-[11px] font-extrabold text-[#1A6646]">
                            今日最新小確幸
                          </div>
                          <div className="text-[16px] font-extrabold text-[#14241D] truncate">
                            {latestExpense.title}
                          </div>
                          <div className="text-[12px] text-[#66564E] truncate mt-0.5">
                            {latestExpense.shopOrNote} · ¥{latestExpense.amountJPY.toLocaleString()} · 記在「
                            {latestExpense.category === 'shopping'
                              ? '購物'
                              : latestExpense.category === 'dining'
                              ? '飲食'
                              : latestExpense.category === 'transport'
                              ? '交通'
                              : '手信'}
                            」
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowExpenseDetailList((prev) => !prev)}
                        className="w-7 h-7 rounded-full border-2 border-[#1A6646] text-[#1A6646] flex items-center justify-center shrink-0"
                        title="點擊展開/管理明細"
                      >
                        <Check className="w-4 h-4 stroke-[2.5]" />
                      </button>
                    </div>
                  )}

                  {/* ➕ ＋ 新增一筆支出 (Add Expense) 主按鈕 */}
                  <button
                    type="button"
                    onClick={() => setShowAddExpenseModal(true)}
                    className="w-full py-4 rounded-[22px] bg-[#DF6437] hover:bg-[#cc562b] text-white font-extrabold text-[15.5px] flex items-center justify-center gap-2 shadow-md transition active:scale-99"
                  >
                    <Plus className="w-5 h-5 stroke-[2.5] rounded-full border-2 border-white p-0.5" />
                    <span>＋ 新增一筆支出 (Add Expense)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* =====================================================================
              PAGE 4 (Index 3): 探索與行前百寶箱頁 (DISCOVER - 口袋清單 + 精選私房推薦 + 行前檢查表 + 實用手指日語)
             ===================================================================== */}
          <div className="tabi-book-page w-full h-full">
            <div className="h-[780px] overflow-y-auto pb-24 tabi-scroll bg-[#EDF6F1]">
              {renderPageHeader('DISCOVER')}

              <div className="px-5 space-y-4" data-no-flip="true">
                <div className="pt-1 flex items-center justify-between">
                  <div>
                    <h1 className="text-[25px] font-black tracking-tight text-[#14241D]">
                      口袋清單 & 旅途百寶箱
                    </h1>
                    <p className="text-[12px] text-[#5D4C44] font-medium mt-0.5">
                      跨 PWA 景點匯入、私房靈感推薦、行前檢查與實用日語卡 🧭
                    </p>
                  </div>
                </div>

                {/* 1. 完整目的地清單管理區 (手動輸入 / 文字.txt 匯入 / 日期編排) */}
                {renderDestinationPoolSection()}

                {/* 2. 🌸 當地私房靈感推薦 (一鍵加入目的地清單) */}
                <div className="bg-white rounded-[26px] p-4 shadow-sm border border-[#E2EFE8] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[15px] font-extrabold text-[#162921] flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#C24726]" />
                      <span>私房景點與美食靈感</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#E3F2EA] text-[#186043] text-[10.5px] font-extrabold">
                      一鍵收入清單
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {[
                      {
                        id: 'gem-fushimi',
                        name: '伏見稻荷大社・千本鳥居',
                        address: '京都市伏見區深草藪之內町68',
                        rating: 4.8,
                        tag: '⛩️ 必訪名所 · 建議清晨或傍晚',
                      },
                      {
                        id: 'gem-arashiyama',
                        name: '嵐山竹林小徑 & 渡月橋',
                        address: '京都市右京區嵯峨天龍寺芒之馬場町',
                        rating: 4.7,
                        tag: '🎋 自然散策 · 搭配嵐電小火車',
                      },
                      {
                        id: 'gem-uji-matcha',
                        name: '中村藤吉本店（宇治抹茶芭菲）',
                        address: '京都府宇治市宇治壹番十番地',
                        rating: 4.6,
                        tag: '🍵 百年茗茶 · 必吃竹筒抹茶凍',
                      },
                      {
                        id: 'gem-pontocho',
                        name: '先斗町・鴨川納涼床料理',
                        address: '京都市中京區先斗町通',
                        rating: 4.7,
                        tag: '🏮 夜間美食 · 河畔町家微醺夜',
                      },
                    ].map((gem) => {
                      const alreadyInPool = state.destinations.some(
                        (d) => d.name.includes(gem.name.split('・')[0]) || d.id === gem.id
                      );
                      return (
                        <div
                          key={gem.id}
                          className="p-3 rounded-2xl bg-[#F4FAF6] border border-[#DCEAE2] flex items-center justify-between gap-2.5"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[13px] font-extrabold text-[#14241D] truncate">
                                {gem.name}
                              </span>
                              <span className="text-[10.5px] font-extrabold text-[#B8431F] shrink-0">
                                ★ {gem.rating}
                              </span>
                            </div>
                            <div className="text-[11px] text-[#5B7368] truncate mt-0.5">
                              {gem.tag}
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={alreadyInPool}
                            onClick={() => {
                              if (alreadyInPool) return;
                              const newDest: SavedDestination = {
                                id: gem.id,
                                name: gem.name,
                                formattedAddress: gem.address,
                                rating: gem.rating,
                                openNow: true,
                                scheduled: null,
                              };
                              setState((prev) => ({
                                ...prev,
                                destinations: [newDest, ...prev.destinations],
                              }));
                              showToast(`✨ 已將「${gem.name}」加入目的地清單！`);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold shrink-0 transition ${
                              alreadyInPool
                                ? 'bg-[#DCEAE2] text-[#5B7368] cursor-default'
                                : 'bg-[#1A5D42] hover:bg-[#134631] text-white shadow-2xs'
                            }`}
                          >
                            {alreadyInPool ? '✓ 已在清單' : '＋ 加入清單'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. 🧳 行前必備檢查清單 (Pre-Trip Checklist，支援離線勾選保存) */}
                <div className="bg-white rounded-[26px] p-4 shadow-sm border border-[#E2EFE8] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[15px] font-extrabold text-[#162921] flex items-center gap-2">
                      <PlaneTakeoff className="w-4 h-4 text-[#1A5D42]" />
                      <span>行前必備檢查清單</span>
                    </div>
                    <span className="text-[11px] font-extrabold text-[#1A5D42]">
                      已完成 {checkedPrepIds.length} / 6
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'passport', label: '護照效期滿 6 個月' },
                      { id: 'vjw', label: 'VJW 入境 QR 截圖' },
                      { id: 'esim', label: 'eSIM / 漫遊網卡' },
                      { id: 'icoca', label: 'ICOCA / Suica 交通卡' },
                      { id: 'cash', label: '日幣現金 & 信用卡' },
                      { id: 'powerbank', label: '行動電源 (隨身攜帶)' },
                    ].map((item) => {
                      const checked = checkedPrepIds.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => togglePrepItem(item.id)}
                          className={`p-2.5 rounded-2xl border text-left flex items-center gap-2 transition ${
                            checked
                              ? 'bg-[#E3F3EB] border-[#98DEC2] text-[#134B35]'
                              : 'bg-[#F8FBF9] border-[#E2EFE8] text-[#4E645A]'
                          }`}
                        >
                          <span
                            className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 ${
                              checked
                                ? 'bg-[#1A5D42] text-white'
                                : 'border border-[#B5C9BF] bg-white text-transparent'
                            }`}
                          >
                            ✓
                          </span>
                          <span
                            className={`text-[11.5px] font-extrabold leading-tight ${
                              checked ? 'line-through opacity-80' : ''
                            }`}
                          >
                            {item.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. 🗣️ 旅途實用「手指日語」溝通大字卡 (點擊放大給店員看) */}
                <div className="bg-white rounded-[26px] p-4 shadow-sm border border-[#E2EFE8] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[15px] font-extrabold text-[#162921] flex items-center gap-2">
                      <span>🗣️</span>
                      <span>手指日語溝通卡（點擊放大）</span>
                    </div>
                    <span className="text-[10.5px] font-bold text-[#647A70]">離線可用</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      {
                        tag: '🛍️ 免稅退稅',
                        zh: '請問可以辦理免稅嗎？',
                        jp: '免税（めんぜい）できますか？',
                        romaji: 'Menzei dekimasu ka?',
                      },
                      {
                        tag: '🍜 餐廳點餐',
                        zh: '請給我推薦的人氣餐點！',
                        jp: 'おすすめのメニューをください！',
                        romaji: 'Osusume no menyū o kudasai!',
                      },
                      {
                        tag: '💳 結帳付款',
                        zh: '請問可以使用 ICOCA / 信用卡嗎？',
                        jp: 'ICOCAやクレジットカードは使えますか？',
                        romaji: 'ICOCA ya kurejitto kādo wa tsukaemasu ka?',
                      },
                      {
                        tag: '🚉 車站問路',
                        zh: '請問去這個地址要往哪裡走？',
                        jp: 'すみません、この場所へはどう行けばいいですか？',
                        romaji: 'Sumimasen, kono basho e wa dō ikeba ii desu ka?',
                      },
                    ].map((phrase) => (
                      <button
                        key={phrase.tag}
                        type="button"
                        onClick={() => setActivePhraseModal(phrase)}
                        className="p-3 rounded-2xl bg-[#FDF6F3] hover:bg-[#FCEBE4] border border-[#F5DCD2] text-left transition"
                      >
                        <div className="text-[10.5px] font-extrabold text-[#B8431F]">
                          {phrase.tag}
                        </div>
                        <div className="text-[12px] font-extrabold text-[#14241D] mt-0.5 line-clamp-1">
                          {phrase.zh}
                        </div>
                        <div className="text-[10.5px] text-[#6E5D54] truncate mt-0.5">
                          {phrase.jp}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =====================================================================
            固定底部導覽列 (保持底部直接選擇方式：Discover / Trips / Plan / Tools)
           ===================================================================== */}
        <nav
          className="fixed md:sticky bottom-0 left-1/2 md:left-0 -translate-x-1/2 md:translate-x-0 w-full max-w-[438px] z-40 bg-[#EDF6F1]/95 backdrop-blur-md border-t border-[#DAEAE1] px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
          data-no-flip="true"
        >
          <div className="grid grid-cols-4 items-center gap-1">
            {/* Tab 1: Discover */}
            <button
              type="button"
              onClick={() => navigateToTab('discover')}
              className="flex flex-col items-center justify-center py-1 group"
            >
              <div
                className={`px-4 py-1.5 rounded-full flex flex-col items-center transition ${
                  activeTab === 'discover'
                    ? 'bg-[#98DEC2] text-[#134B35]'
                    : 'text-[#553E35] hover:bg-[#E2EFE8]'
                }`}
              >
                <Compass className="w-5 h-5 stroke-[2.2]" />
                <span className="text-[11px] font-extrabold mt-0.5">Discover</span>
              </div>
            </button>

            {/* Tab 2: Trips */}
            <button
              type="button"
              onClick={() => navigateToTab('trips')}
              className="flex flex-col items-center justify-center py-1 group"
            >
              <div
                className={`px-4 py-1.5 rounded-full flex flex-col items-center transition ${
                  activeTab === 'trips'
                    ? 'bg-[#98DEC2] text-[#134B35]'
                    : 'text-[#553E35] hover:bg-[#E2EFE8]'
                }`}
              >
                <Luggage className="w-5 h-5 stroke-[2.2]" />
                <span className="text-[11px] font-extrabold mt-0.5">Trips</span>
              </div>
            </button>

            {/* Tab 3: Plan */}
            <button
              type="button"
              onClick={() => navigateToTab('plan')}
              className="flex flex-col items-center justify-center py-1 group"
            >
              <div
                className={`px-4 py-1.5 rounded-full flex flex-col items-center transition ${
                  activeTab === 'plan'
                    ? 'bg-[#98DEC2] text-[#134B35]'
                    : 'text-[#553E35] hover:bg-[#E2EFE8]'
                }`}
              >
                <CalendarCheck className="w-5 h-5 stroke-[2.2]" />
                <span className="text-[11px] font-extrabold mt-0.5">Plan</span>
              </div>
            </button>

            {/* Tab 4: Tools */}
            <button
              type="button"
              onClick={() => navigateToTab('tools')}
              className="flex flex-col items-center justify-center py-1 group"
            >
              <div
                className={`px-4 py-1.5 rounded-full flex flex-col items-center transition ${
                  activeTab === 'tools'
                    ? 'bg-[#98DEC2] text-[#134B35]'
                    : 'text-[#553E35] hover:bg-[#E2EFE8]'
                }`}
              >
                <Calculator className="w-5 h-5 stroke-[2.2]" />
                <span className="text-[11px] font-extrabold mt-0.5">Tools</span>
              </div>
            </button>
          </div>
        </nav>
      </div>

      {/* =====================================================================
          彈出視窗群 (Modals)
         ===================================================================== */}

      {/* 1. 升級版：包含即時搜尋過濾功能的國際機場與航廈選擇器 Modal */}
      <AirportSearchModal
        open={airportModalOpen}
        initialSlot={airportTargetSlot}
        outbound={state.outbound}
        inbound={state.inbound}
        airlineLabel={state.trip.airlineLabel}
        onSelectAirport={handleSelectAirportFromModal}
        onUpdateFlightMeta={handleUpdateFlightMeta}
        onUpdateAirlineLabel={(label) =>
          setState((prev) => ({
            ...prev,
            trip: { ...prev.trip, airlineLabel: label },
          }))
        }
        onClose={() => setAirportModalOpen(false)}
      />

      {/* 2. 📅 目的地清單「安排與預算」排程設定視窗 (保留使用者原本的日期編排體驗) */}
      {scheduleModalDest && (
        <div
          className="fixed inset-0 z-[200] bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setScheduleModalDest(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-[#DCEAE2] space-y-3.5"
          >
            <div className="flex items-center justify-between border-b border-[#EBF3EE] pb-2.5">
              <div className="min-w-0">
                <span className="text-[10.5px] font-extrabold text-[#1A5D42] uppercase">
                  安排行程日期與預算
                </span>
                <h3 className="text-base font-extrabold text-[#14241D] truncate">
                  {scheduleModalDest.customName || scheduleModalDest.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setScheduleModalDest(null)}
                className="w-8 h-8 rounded-full bg-[#F2F8F5] text-[#4F665B] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-[#4A6357] block mb-1">
                  開始時間 (Start)
                </label>
                <input
                  type="time"
                  value={scheduleForm.start}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, start: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#F4FAF6] border border-[#DCEAE2] text-sm font-bold"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#4A6357] block mb-1">
                  結束時間 (End)
                </label>
                <input
                  type="time"
                  value={scheduleForm.end}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, end: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#F4FAF6] border border-[#DCEAE2] text-sm font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-[#4A6357] block mb-1">
                  交通方式 (Transport)
                </label>
                <select
                  value={scheduleForm.transport}
                  onChange={(e) =>
                    setScheduleForm({ ...scheduleForm, transport: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[#F4FAF6] border border-[#DCEAE2] text-sm font-bold"
                >
                  <option value="地鐵">🚇 地鐵</option>
                  <option value="巴士">🚌 巴士</option>
                  <option value="計程車">🚕 計程車</option>
                  <option value="步行">🚶 步行</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#4A6357] block mb-1">
                  預估花費 (Budget)
                </label>
                <input
                  type="number"
                  value={scheduleForm.cost}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, cost: e.target.value })}
                  placeholder="例如: 1000"
                  className="w-full px-3 py-2 rounded-xl bg-[#F4FAF6] border border-[#DCEAE2] text-sm font-bold"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#4A6357] block mb-1">
                選擇排程日期 (SELECT DATE)
              </label>
              <div className="max-h-40 overflow-y-auto rounded-2xl border border-[#DCEAE2] p-2 bg-[#F4FAF6] space-y-1.5 tabi-scroll">
                {tripDays.map((day) => {
                  const isChecked = scheduleForm.date === day.iso;
                  return (
                    <label
                      key={day.iso}
                      onClick={() =>
                        setScheduleForm({
                          ...scheduleForm,
                          date: day.iso,
                          dayIndex: day.index,
                        })
                      }
                      className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition ${
                        isChecked
                          ? 'bg-[#1A5D42] text-white border-[#1A5D42]'
                          : 'bg-white text-[#14241D] border-[#E2EFE8] hover:bg-[#EAF4EF]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="scheduleDateRadio"
                          checked={isChecked}
                          onChange={() =>
                            setScheduleForm({
                              ...scheduleForm,
                              date: day.iso,
                              dayIndex: day.index,
                            })
                          }
                          className="accent-[#DF6437]"
                        />
                        <span className="text-xs font-extrabold">
                          {day.label} · {day.zhDisp}
                        </span>
                      </div>
                      <span className="text-[10.5px] opacity-80 font-mono">{day.iso}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleUnscheduleDestination}
                className="px-3 py-2 rounded-xl text-xs font-extrabold text-[#B53D1B] hover:bg-[#FBE4DF] transition"
              >
                取消排定
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setScheduleModalDest(null)}
                  className="px-4 py-2 rounded-xl bg-[#EEF5F1] text-[#496357] text-xs font-extrabold"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSaveSchedule}
                  className="px-5 py-2 rounded-xl bg-[#1A5D42] hover:bg-[#134631] text-white text-xs font-extrabold shadow-md transition"
                >
                  確認排入
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. 📄 匯入「文字.txt」或從另一個 PWA 貼上地點 JSON 視窗 */}
      {showImportJsonModal && (
        <div
          className="fixed inset-0 z-[200] bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowImportJsonModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl border border-[#DCEAE2] space-y-3.5"
          >
            <div className="flex items-center justify-between border-b border-[#EBF3EE] pb-2.5">
              <div>
                <h3 className="text-base font-extrabold text-[#14241D]">
                  📥 匯入目的地清單 (支援「文字.txt」格式)
                </h3>
                <p className="text-[11px] text-[#5B7368]">
                  可從另一個 Location PWA 貼上 JSON 陣列，或直接上傳 .txt / .json 檔案
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowImportJsonModal(false)}
                className="w-8 h-8 rounded-full bg-[#F2F8F5] text-[#4F665B] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  parseAndImportPlacesArray(SAMPLE_LOCATION_TXT_DATA);
                  setShowImportJsonModal(false);
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-[#E3F2EA] hover:bg-[#cfe8db] text-[#165C3E] text-xs font-extrabold flex items-center justify-center gap-1.5 transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>一鍵載入「文字.txt」範例 (3 筆台北美食)</span>
              </button>

              <label className="py-2 px-3 rounded-xl bg-[#FADBD0] hover:bg-[#f5c7b8] text-[#A83815] text-xs font-extrabold cursor-pointer shrink-0 transition">
                📂 選擇 .txt 檔案
                <input
                  type="file"
                  accept=".txt,.json,application/json,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      const content = String(ev.target?.result || '');
                      setImportJsonText(content);
                      try {
                        const parsed = JSON.parse(content);
                        if (Array.isArray(parsed)) {
                          parseAndImportPlacesArray(parsed);
                          setShowImportJsonModal(false);
                        }
                      } catch {
                        showToast('⚠️ 檔案內容非標準 JSON，請檢查下方文字框');
                      }
                    };
                    reader.readAsText(file);
                  }}
                />
              </label>
            </div>

            <textarea
              rows={6}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder='貼上 JSON 內容，例如：[{"id":"ChIJ...","displayName":{"text":"王師父脆皮豬｜台北大同區美食"},"formattedAddress":"..."}]'
              className="w-full p-3 rounded-2xl bg-[#F4FAF6] border border-[#CFE3D8] text-xs font-mono text-[#14241D] focus:outline-none focus:border-[#1A5D42]"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowImportJsonModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-[#EEF5F1] text-[#496357] text-xs font-extrabold"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    const parsed = JSON.parse(importJsonText);
                    if (Array.isArray(parsed)) {
                      parseAndImportPlacesArray(parsed);
                      setImportJsonText('');
                      setShowImportJsonModal(false);
                    } else {
                      showToast('⚠️ JSON 需為陣列格式 [...]');
                    }
                  } catch {
                    showToast('⚠️ JSON 解析失敗，請確認格式是否完整');
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#1A5D42] text-white text-xs font-extrabold shadow-md"
              >
                確認匯入至目的地清單
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. ✏️ 更改景點名稱彈窗 */}
      {renameModalDest && (
        <div
          className="fixed inset-0 z-[200] bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setRenameModalDest(null)}
        >
          <form
            onSubmit={handleConfirmRename}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs bg-white rounded-3xl p-5 shadow-2xl border border-[#DCEAE2] space-y-3"
          >
            <h3 className="text-base font-extrabold text-[#14241D]">✏️ 更改景點名稱</h3>
            <input
              type="text"
              autoFocus
              value={renameInputVal}
              onChange={(e) => setRenameInputVal(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4FAF6] border border-[#CFE3D8] text-sm font-bold focus:outline-none focus:border-[#1A5D42]"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRenameModalDest(null)}
                className="flex-1 py-2 rounded-xl bg-[#EEF5F1] text-[#496357] text-xs font-extrabold"
              >
                取消
              </button>
              <button
                type="submit"
                className="flex-1 py-2 rounded-xl bg-[#1A5D42] text-white text-xs font-extrabold"
              >
                儲存變更
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 5. 新增一筆支出 Modal */}
      {showAddExpenseModal && (
        <div
          className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowAddExpenseModal(false)}
        >
          <form
            onSubmit={handleAddExpenseSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-[#DCEAE2] space-y-3.5"
          >
            <div className="flex items-center justify-between border-b border-[#EBF3EE] pb-2.5">
              <h3 className="text-lg font-extrabold text-[#14241D]">＋ 新增一筆行程支出</h3>
              <button
                type="button"
                onClick={() => setShowAddExpenseModal(false)}
                className="w-8 h-8 rounded-full bg-[#F2F8F5] text-[#4F665B] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-[#4A6357] block mb-1">
                消費項目名稱 *
              </label>
              <input
                type="text"
                required
                value={newExpForm.title}
                onChange={(e) => setNewExpForm({ ...newExpForm, title: e.target.value })}
                placeholder="例如：宇治抹茶芭菲 × 2、藥妝伴手禮"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4FAF6] border border-[#DCEAE2] text-sm font-bold focus:outline-none focus:border-[#1D6B4B]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-xs font-bold text-[#4A6357] block mb-1">金額 *</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={newExpForm.amount}
                  onChange={(e) => setNewExpForm({ ...newExpForm, amount: e.target.value })}
                  placeholder="1850"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4FAF6] border border-[#DCEAE2] text-sm font-bold focus:outline-none focus:border-[#1D6B4B]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#4A6357] block mb-1">付款幣別</label>
                <select
                  value={newExpForm.currency}
                  onChange={(e) => setNewExpForm({ ...newExpForm, currency: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F4FAF6] border border-[#DCEAE2] text-sm font-bold focus:outline-none"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.code} ({c.symbol})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#4A6357] block mb-1">消費類別</label>
              <div className="grid grid-cols-2 gap-2">
                {EXPENSE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setNewExpForm({ ...newExpForm, category: cat.key })}
                    className={`py-2 px-3 rounded-xl text-xs font-extrabold border text-left transition ${
                      newExpForm.category === cat.key
                        ? 'bg-[#1A5D42] text-white border-[#1A5D42]'
                        : 'bg-[#F4FAF6] text-[#284538] border-[#DCEAE2]'
                    }`}
                  >
                    {cat.zhTitle}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#4A6357] block mb-1">
                店家或備註 (選填)
              </label>
              <input
                type="text"
                value={newExpForm.shopOrNote}
                onChange={(e) => setNewExpForm({ ...newExpForm, shopOrNote: e.target.value })}
                placeholder="例如：祇園辻利、錦市場..."
                className="w-full px-3.5 py-2 rounded-xl bg-[#F4FAF6] border border-[#DCEAE2] text-sm focus:outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddExpenseModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-[#EEF5F1] text-[#496357] font-bold text-sm"
              >
                取消
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-[#DF6437] hover:bg-[#c85328] text-white font-extrabold text-sm shadow-md"
              >
                儲存支出
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 6. 住宿編輯 Modal */}
      {showStayModal && (
        <div
          className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowStayModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-[#DCEAE2] space-y-3"
          >
            <div className="flex items-center justify-between border-b border-[#EBF3EE] pb-2">
              <h3 className="text-lg font-extrabold text-[#14241D]">🏨 編輯住宿資訊</h3>
              <button
                type="button"
                onClick={() => setShowStayModal(false)}
                className="w-8 h-8 rounded-full bg-[#F2F8F5] text-[#4F665B] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-[#4A6357] block mb-1">飯店名稱</label>
              <input
                type="text"
                value={state.stay.hotelName}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    stay: { ...prev.stay, hotelName: e.target.value },
                  }))
                }
                className="w-full px-3.5 py-2 rounded-xl bg-[#F4FAF6] border border-[#DCEAE2] text-sm font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#4A6357] block mb-1">房型與副標題</label>
              <input
                type="text"
                value={state.stay.subTitle}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    stay: { ...prev.stay, subTitle: e.target.value },
                  }))
                }
                className="w-full px-3.5 py-2 rounded-xl bg-[#F4FAF6] border border-[#DCEAE2] text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-[#4A6357] block mb-1">Check-in</label>
                <input
                  type="text"
                  value={state.stay.checkIn}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      stay: { ...prev.stay, checkIn: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[#F4FAF6] border border-[#DCEAE2] text-xs font-bold"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#4A6357] block mb-1">Check-out</label>
                <input
                  type="text"
                  value={state.stay.checkOut}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      stay: { ...prev.stay, checkOut: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[#F4FAF6] border border-[#DCEAE2] text-xs font-bold"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#4A6357] block mb-1">地址</label>
              <input
                type="text"
                value={state.stay.address}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    stay: { ...prev.stay, address: e.target.value },
                  }))
                }
                className="w-full px-3.5 py-2 rounded-xl bg-[#F4FAF6] border border-[#DCEAE2] text-xs"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowStayModal(false)}
              className="w-full py-2.5 rounded-xl bg-[#1A5D42] text-white font-extrabold text-sm mt-2"
            >
              儲存住宿設定
            </button>
          </div>
        </div>
      )}

      {/* 7. 目的地與旅行起訖日期編輯 Modal */}
      {showTripModal && (
        <div
          className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowTripModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-[#DCEAE2] space-y-3"
          >
            <div className="flex items-center justify-between border-b border-[#EBF3EE] pb-2">
              <h3 className="text-lg font-extrabold text-[#14241D]">✈️ 編輯旅程與起訖日期</h3>
              <button
                type="button"
                onClick={() => setShowTripModal(false)}
                className="w-8 h-8 rounded-full bg-[#F2F8F5] text-[#4F665B] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-[#4A6357] block mb-1">目的地城市 / 國家</label>
              <input
                type="text"
                value={state.trip.destinationTitle}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    trip: { ...prev.trip, destinationTitle: e.target.value },
                  }))
                }
                className="w-full px-3.5 py-2 rounded-xl bg-[#F4FAF6] border border-[#DCEAE2] text-sm font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-[#4A6357] block mb-1">
                  出發日期 (Start Date)
                </label>
                <input
                  type="date"
                  value={state.trip.startDate}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      trip: { ...prev.trip, startDate: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[#F4FAF6] border border-[#DCEAE2] text-xs font-bold"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#4A6357] block mb-1">
                  回程日期 (End Date)
                </label>
                <input
                  type="date"
                  value={state.trip.endDate}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      trip: { ...prev.trip, endDate: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[#F4FAF6] border border-[#DCEAE2] text-xs font-bold"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#4A6357] block mb-1">卡片日期顯示文字</label>
              <input
                type="text"
                value={state.trip.dateRangeLabel}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    trip: { ...prev.trip, dateRangeLabel: e.target.value },
                  }))
                }
                className="w-full px-3.5 py-2 rounded-xl bg-[#F4FAF6] border border-[#DCEAE2] text-sm font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#4A6357] block mb-1">旅程副標題</label>
              <input
                type="text"
                value={state.trip.subtitle}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    trip: { ...prev.trip, subtitle: e.target.value },
                  }))
                }
                className="w-full px-3.5 py-2 rounded-xl bg-[#F4FAF6] border border-[#DCEAE2] text-xs"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowTripModal(false)}
              className="w-full py-2.5 rounded-xl bg-[#1A5D42] text-white font-extrabold text-sm"
            >
              儲存變更
            </button>
          </div>
        </div>
      )}

      {/* 8. 總預算金額編輯 Modal */}
      {showBudgetEditModal && (
        <div
          className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowBudgetEditModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs bg-white rounded-3xl p-5 shadow-2xl border border-[#DCEAE2] space-y-3"
          >
            <h3 className="text-base font-extrabold text-[#14241D]">💳 設定總預算 (JPY ¥)</h3>
            <input
              type="number"
              min="1000"
              step="1000"
              value={state.totalBudgetJPY}
              onChange={(e) =>
                setState((prev) => ({
                  ...prev,
                  totalBudgetJPY: Math.max(1000, Number(e.target.value)),
                }))
              }
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4FAF6] border border-[#DCEAE2] text-lg font-black tabular-nums"
            />
            <button
              type="button"
              onClick={() => setShowBudgetEditModal(false)}
              className="w-full py-2.5 rounded-xl bg-[#1A5D42] text-white font-extrabold text-sm"
            >
              確認儲存
            </button>
          </div>
        </div>
      )}

      {/* 9. 登機證預覽 Modal */}
      {showBoardingModal && (
        <div
          className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowBoardingModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs bg-white rounded-3xl p-5 shadow-2xl border border-[#DCEAE2] text-center space-y-3"
          >
            <span className="px-3 py-1 rounded-full bg-[#D8F3E5] text-[#186043] text-xs font-extrabold">
              {state.outbound.flightNo} · TERMINAL {state.outbound.departTerminal || 'T1'}
            </span>
            <div className="text-2xl font-black text-[#14241D]">
              {state.outbound.departCode} ➔ {state.outbound.arriveCode}
            </div>
            <div className="text-xs text-[#5B7368] font-bold">
              {state.outbound.dateLabel} · SEAT 18A (Window)
            </div>
            <div className="p-4 bg-[#F4FAF6] rounded-2xl border border-dashed border-[#B7D8C6] font-mono text-xs tracking-widest text-[#1A5D42]">
              |||| |||| || ||||| ||| |||| ||||
              <div className="mt-1 text-[10px]">GO-TRAVEL-PASS-NH991</div>
            </div>
            <button
              type="button"
              onClick={() => setShowBoardingModal(false)}
              className="w-full py-2.5 rounded-xl bg-[#1A5D42] text-white font-extrabold text-sm"
            >
              關閉登機證
            </button>
          </div>
        </div>
      )}

      {/* 10. 行李額度編輯 Modal */}
      {showBaggageModal && (
        <div
          className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowBaggageModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs bg-white rounded-3xl p-5 shadow-2xl border border-[#DCEAE2] space-y-3"
          >
            <h3 className="text-base font-extrabold text-[#14241D]">🧳 行李額度設定</h3>
            <input
              type="text"
              value={state.trip.baggageLabel}
              onChange={(e) =>
                setState((prev) => ({
                  ...prev,
                  trip: { ...prev.trip, baggageLabel: e.target.value },
                }))
              }
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4FAF6] border border-[#DCEAE2] text-sm font-bold"
            />
            <p className="text-xs text-[#5B7368]">
              包含隨身行李 1 件 (7kg) + 託運行李額度，戰利品與伴手禮輕鬆裝箱！
            </p>
            <button
              type="button"
              onClick={() => setShowBaggageModal(false)}
              className="w-full py-2.5 rounded-xl bg-[#1A5D42] text-white font-extrabold text-sm"
            >
              確認
            </button>
          </div>
        </div>
      )}

      {/* 11. 匯出 / 匯入與雲端共享行程 Modal */}
      {showCloudShareModal && (
        <div
          className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowCloudShareModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-[#DCEAE2] space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#EBF3EE] pb-2">
              <h3 className="text-lg font-extrabold text-[#14241D]">📤 匯出/匯入 & 共享行程</h3>
              <button
                type="button"
                onClick={() => setShowCloudShareModal(false)}
                className="w-8 h-8 rounded-full bg-[#F2F8F5] text-[#4F665B] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#F4FAF6] border border-[#DCEAE2] space-y-2">
              <div className="text-xs font-extrabold text-[#1A5D42]">
                目前模式：{currentMode === 'private' ? '🔒 本機離線 + 私人同步' : `👥 共享房號 (${currentShareId})`}
              </div>
              <button
                type="button"
                onClick={() => {
                  const sid = Math.random().toString(36).substring(2, 8).toUpperCase();
                  setCurrentShareId(sid);
                  setCurrentMode('shared');
                  showToast(`☁️ 已建立共享房間：${sid}`);
                }}
                className="w-full py-2 rounded-xl bg-[#1A5D42] text-white text-xs font-extrabold"
              >
                建立雲端共享房間代碼
              </button>
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  id="joinShareCodeInput"
                  placeholder="輸入朋友的共享房號"
                  className="flex-1 px-3 py-1.5 rounded-xl bg-white border border-[#DCEAE2] text-xs uppercase font-bold"
                />
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('joinShareCodeInput') as HTMLInputElement;
                    if (el && el.value.trim()) {
                      setCurrentShareId(el.value.trim().toUpperCase());
                      setCurrentMode('shared');
                      showToast(`👥 已加入共享房間：${el.value.trim().toUpperCase()}`);
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-[#DF6437] text-white text-xs font-extrabold"
                >
                  加入
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={handleExportJSON}
                className="w-full py-2.5 rounded-xl bg-[#E3F1EC] hover:bg-[#d2e7df] text-[#154D36] text-xs font-extrabold"
              >
                📥 下載 / 複製完整行程 JSON 備份
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowCloudShareModal(false);
                  setShowImportJsonModal(true);
                }}
                className="w-full py-2.5 rounded-xl bg-[#FADBD0] hover:bg-[#f4c9b9] text-[#A83815] text-xs font-extrabold"
              >
                📋 匯入 Location 資料 (支援「文字.txt」格式)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 12. 專案結構與 PWA 覆蓋整合指南 Modal */}
      <IntegrationGuideModal
        open={showGuideModal}
        onClose={() => setShowGuideModal(false)}
        onResetDemo={() => {
          localStorage.removeItem(STORAGE_KEY_V2);
          setState(DEFAULT_TABI_STATE);
          showToast('✨ 已還原為「去旅行啦」預設行程與目的地清單！');
        }}
      />

      {/* 13. 🗣️ 手指日語溝通放大卡 Modal */}
      {activePhraseModal && (
        <div
          className="fixed inset-0 z-[220] bg-black/65 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setActivePhraseModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-[#DCEAE2] text-center space-y-4"
          >
            <div className="inline-block px-3 py-1 rounded-full bg-[#FCE3DA] text-[#B83E1B] text-xs font-extrabold">
              {activePhraseModal.tag} · 請出示給店員看
            </div>
            <div className="text-[26px] font-black text-[#14241D] leading-snug py-2">
              {activePhraseModal.jp}
            </div>
            <div className="text-xs font-bold text-[#1A5D42] bg-[#EAF4EF] py-2 px-3 rounded-xl">
              發音：{activePhraseModal.romaji}
            </div>
            <div className="text-sm font-bold text-[#5D4C44]">
              中文：{activePhraseModal.zh}
            </div>
            <button
              type="button"
              onClick={() => setActivePhraseModal(null)}
              className="w-full py-2.5 rounded-xl bg-[#1A5D42] text-white font-extrabold text-sm"
            >
              關閉字卡
            </button>
          </div>
        </div>
      )}

      {/* 14. 🤖 AI 行程優化分析與建議預覽 Modal */}
      {showAIOptimizeModal && (
        <div
          className="fixed inset-0 z-[225] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowAIOptimizeModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#DCEAE2] overflow-hidden flex flex-col max-h-[88vh]"
          >
            {/* 頂部標題與模式切換 */}
            <div className="px-5 pt-4 pb-3 bg-gradient-to-r from-[#164E37] to-[#1E6B4B] text-white space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-2xl bg-white/15 flex items-center justify-center">
                    <Wand2 className="w-4 h-4 text-[#FCD581]" />
                  </span>
                  <div>
                    <h3 className="text-[16px] font-black tracking-tight">
                      AI 智慧行程優化與時段配置
                    </h3>
                    <p className="text-[11px] text-white/80">
                      分析地理距離、營業時間與景點類型，建議最佳順序與時段
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAIOptimizeModal(false)}
                  className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 兩種優化模式切換 */}
              <div className="grid grid-cols-2 gap-1.5 bg-black/20 p-1 rounded-2xl">
                <button
                  type="button"
                  onClick={() => handleOpenAIOptimizer('fill_and_reorder')}
                  className={`py-1.5 px-2.5 rounded-xl text-[11px] font-extrabold transition ${
                    aiOptimizeMode === 'fill_and_reorder'
                      ? 'bg-white text-[#154A34] shadow-xs'
                      : 'text-white/85 hover:text-white'
                  }`}
                >
                  ✨ 補齊未排程 + 順路排序
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenAIOptimizer('rebalance_all')}
                  className={`py-1.5 px-2.5 rounded-xl text-[11px] font-extrabold transition ${
                    aiOptimizeMode === 'rebalance_all'
                      ? 'bg-white text-[#154A34] shadow-xs'
                      : 'text-white/85 hover:text-white'
                  }`}
                >
                  🔄 全行程依分區重新分配
                </button>
              </div>
            </div>

            {/* 內容分析區 */}
            <div className="p-4 overflow-y-auto space-y-3.5 flex-1 tabi-scroll bg-[#F6FBF8]">
              {isRunningAIOptimize || !aiOptResult ? (
                <div className="py-12 text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-[#1A5D42] animate-spin mx-auto" />
                  <div className="text-sm font-extrabold text-[#14241D]">
                    AI 正在分析目的地經緯度、營業時間與最佳時段...
                  </div>
                  <p className="text-xs text-[#5B7368]">
                    正在為未安排時間的景點計算最順路的造訪順序
                  </p>
                </div>
              ) : (
                <>
                  {/* 優化成效摘要卡 */}
                  <div className="p-3.5 rounded-2xl bg-white border border-[#CDE3D7] shadow-2xs space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-[#165C3E]">
                        {aiOptResult.summaryTitle}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#FDE4DA] text-[#A83815] text-[10.5px] font-black shrink-0">
                        預估省時 ≈ {aiOptResult.estimatedSavedMinutes} 分鐘
                      </span>
                    </div>
                    <ul className="space-y-1 text-[11.5px] text-[#3B5449] font-semibold">
                      {aiOptResult.summaryPoints.map((pt, i) => (
                        <li key={i} className="leading-snug">
                          {pt}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* 逐日最佳化順序與建議時間段清單 */}
                  <div className="space-y-3">
                    {tripDays.map((day) => {
                      const stops = aiOptResult.suggestionsByDay[day.index] || [];
                      if (stops.length === 0) return null;
                      return (
                        <div
                          key={day.iso}
                          className="rounded-2xl bg-white border border-[#DCEAE2] overflow-hidden shadow-2xs"
                        >
                          <div className="px-3.5 py-2 bg-[#E6F2EC] border-b border-[#D5E6DD] flex items-center justify-between">
                            <span className="text-xs font-black text-[#143D2B]">
                              📅 {day.label} · {day.zhDisp}
                            </span>
                            <span className="text-[11px] font-bold text-[#2E6A50]">
                              共 {stops.length} 個景點
                            </span>
                          </div>

                          <div className="divide-y divide-[#EEF5F1]">
                            {stops.map((stop, sIdx) => (
                              <div key={stop.destId} className="p-3 space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="w-5 h-5 rounded-full bg-[#1A5D42] text-white text-[10.5px] font-black flex items-center justify-center shrink-0">
                                      {sIdx + 1}
                                    </span>
                                    <span className="text-[13px] font-extrabold text-[#14241D] truncate">
                                      {stop.destName}
                                    </span>
                                    {stop.wasPreviouslyUnscheduled && (
                                      <span className="px-1.5 py-0.2 rounded-md bg-[#FADBD0] text-[#A83815] text-[9.5px] font-black shrink-0">
                                        🆕 自動配時段
                                      </span>
                                    )}
                                  </div>
                                  <span className="px-2 py-0.5 rounded-lg bg-[#EAF4EF] text-[#165C3E] text-[11px] font-black tabular-nums shrink-0">
                                    {stop.start} - {stop.end}
                                  </span>
                                </div>

                                <div className="text-[11px] text-[#536B60] pl-6.5 leading-snug">
                                  {stop.reason}
                                </div>

                                <div className="flex items-center gap-3 pl-6.5 text-[10.5px] font-bold text-[#6C8278]">
                                  <span>🚇 建議交通：{stop.transport}</span>
                                  <span>💰 預估：¥{Number(stop.cost).toLocaleString()}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* 底部確認套用按鈕列 */}
            <div className="p-4 bg-white border-t border-[#E6F0EB] flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowAIOptimizeModal(false)}
                className="px-4 py-2.5 rounded-2xl bg-[#EEF4F1] hover:bg-[#E0ECE6] text-[#355245] font-extrabold text-xs transition"
              >
                稍後再說
              </button>
              <button
                type="button"
                disabled={isRunningAIOptimize || !aiOptResult}
                onClick={handleApplyAIOptimization}
                className="flex-1 py-2.5 px-4 rounded-2xl bg-[#C24726] hover:bg-[#a6391b] disabled:opacity-50 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-1.5 transition"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>一鍵套用最佳化順序與時段</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}