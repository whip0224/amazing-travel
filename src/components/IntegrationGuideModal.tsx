import React from 'react';
import { X, FolderTree, Terminal, Sparkles, CheckCircle2, BookOpen, ShieldCheck } from 'lucide-react';

interface IntegrationGuideModalProps {
  open: boolean;
  onClose: () => void;
  onResetDemo: () => void;
}

export const IntegrationGuideModal: React.FC<IntegrationGuideModalProps> = ({
  open,
  onClose,
  onResetDemo,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-3xl bg-[#F4FAF6] border border-[#CFE3D8] shadow-2xl p-5 md:p-6 text-[#183028] tabi-scroll"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#D8E9DF] pb-3.5 mb-4">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-2xl bg-[#BCEAD5] text-[#1A5D42] flex items-center justify-center font-bold">
              <BookOpen className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-[#162A22]">
                「去旅行啦」PWA 完整檔案結構 & 覆蓋整合指南
              </h2>
              <p className="text-xs text-[#4F6F61]">
                1:1 Figma 介面還原 · StPageFlip 3D 翻頁 · 離線 LocalStorage + Service Worker
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white text-[#4F6F61] hover:bg-[#E4F0EA] flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-sm">
          {/* 1. File Tree */}
          <div className="bg-white rounded-2xl p-4 border border-[#E0EDE6]">
            <h3 className="font-bold text-[#1A5D42] flex items-center gap-1.5 mb-2">
              <FolderTree className="w-4 h-4" /> 1. 更新後的完整專案檔案結構
            </h3>
            <pre className="text-xs bg-[#162A22] text-[#D7F3E5] p-3.5 rounded-xl overflow-x-auto leading-relaxed font-mono">
{`amazing-travel/
├── index.html                        # PWA Meta、Manifest 掛載、Google Fonts 與 Maps API
├── vite.config.ts                    # VitePWA 離線快取與自動更新 Service Worker 設定
├── package.json                      # 新增 page-flip (StPageFlip)、lucide-react、vite-plugin-pwa
├── public/
│   ├── manifest.json                 # PWA 安裝設定檔 (standalone 模式、192/512 圖示)
│   ├── sw.js                         # 離線快取 Service Worker 腳本
│   ├── apple-touch-icon.png          # iOS 主畫面安裝圖示
│   ├── icon-192.png / icon-512.png   # Android / 桌面安裝圖示
│   └── assets/tabi/                  # 從 Figma 擷取的高解析旅途照片與素材
└── src/
    ├── main.tsx                      # React 掛載入口
    ├── index.css                     # Tailwind v4 與 StPageFlip 書本陰影樣式
    ├── airports.js                   # 擴充多國機場 (含 IATA 代碼 HND/KIX/TPE/HKG 等) 與世界貨幣清單
    ├── types/tabi.ts                 # 航班、住宿、行程、消費記帳完整型別與預設京都資料
    ├── hooks/usePWAInstall.ts        # PWA 安裝提示與離線狀態偵測 Hook
    ├── components/
    │   └── IntegrationGuideModal.tsx # 本整合說明與資料重置面板
    └── App.tsx                       # 核心主程式：StPageFlip 3D 翻頁 + 4 大 Figma 介面 + Firebase 同步`}
            </pre>
          </div>

          {/* 2. Step by step instructions */}
          <div className="bg-white rounded-2xl p-4 border border-[#E0EDE6] space-y-3">
            <h3 className="font-bold text-[#1A5D42] flex items-center gap-1.5">
              <Terminal className="w-4 h-4" /> 2. 逐步覆蓋與修改現有 PWA 專案指引
            </h3>
            <div className="space-y-2 text-xs text-[#2D4A3E] leading-relaxed">
              <div className="p-2.5 rounded-xl bg-[#F2F8F5]">
                <strong className="text-[#162A22]">步驟 A：安裝 StPageFlip 與 PWA 套件</strong>
                <code className="block mt-1 bg-[#162A22] text-[#A8E6CF] px-2.5 py-1.5 rounded-lg font-mono">
                  npm install page-flip lucide-react vite-plugin-pwa
                </code>
              </div>
              <div className="p-2.5 rounded-xl bg-[#F2F8F5]">
                <strong className="text-[#162A22]">步驟 B：更新機場與貨幣資料庫 (`src/airports.js`)</strong>
                <p className="mt-0.5">
                  直接覆蓋 `src/airports.js`，內含日本 (HND/NRT/KIX/FUK/CTS/OKA)、台灣 (TPE/TSA/KHH)、港澳 (HKG/MFM)、韓國 (ICN/GMP/PUS)、東南亞 (BKK/SIN) 及歐美機場的 IATA 三字代碼，以及 11 種常用旅遊貨幣 (`JPY`, `TWD`, `HKD`, `USD`, `KRW`, `THB`, `SGD`, `EUR`, `GBP`, `AUD`, `CNY`)。
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-[#F2F8F5]">
                <strong className="text-[#162A22]">步驟 C：覆蓋主畫面 (`src/App.tsx` 與 `src/types/tabi.ts`)</strong>
                <p className="mt-0.5">
                  透過 `PageFlip` 實例綁定書本容器，在手機寬度下支援左右滑動/拖曳 3D 翻頁，並將表單與按鈕加入 `stopPropagation` 防止點擊輸入框時誤觸翻頁。所有修改（航班機場、住宿、行程、消費記帳）皆自動雙向寫入 `localStorage` (`tabi_pwa_state_v2` & `at_local_data_final_v1`) 與 Firebase。
                </p>
              </div>
            </div>
          </div>

          {/* 3. Key Features Verification */}
          <div className="bg-[#EAF4EF] rounded-2xl p-4 border border-[#CBE4D7] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-1 text-xs text-[#1A5D42]">
              <div className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> 離線儲存與預設資料管理
              </div>
              <p className="text-[#456B5B]">
                目前所有新增的消費與機場變更皆已即時儲存在瀏覽器 LocalStorage。若想回到 Figma 截圖初始狀態，可點擊右側按鈕重置。
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  onResetDemo();
                  onClose();
                }}
                className="px-3.5 py-2 rounded-xl bg-[#FBE4DF] text-[#B53D1B] font-bold text-xs hover:bg-[#f7d3cb] transition flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" /> 還原 Figma 預設資料
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-[#1A5D42] text-white font-bold text-xs hover:bg-[#134631] transition flex items-center gap-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> 開始體驗
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
