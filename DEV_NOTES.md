# DEV_NOTES — 去旅行啦 (Amazing Travel PWA) 技術架構與防踩坑筆記

> 寫給幾個月後的自己：高密度架構備忘，避免重踩 Vercel、Gemini API、PWA 快取與 `StPageFlip` 的坑。

---

## 1. 核心架構與資料流（Mental Model）

```text
[User / Mobile PWA]
   │
   ├─ UI State & 3D 翻頁 ──▶ src/App.tsx (StPageFlip 4頁容器: discover | trips | plan | tools)
   │                             ├─ Local 持久化: localStorage ('tabi_pwa_state_v2' + legacy bridge)
   │                             └─ Cloud 同步 (選配): Firebase Auth + Firestore onSnapshot/setDoc
   │
   ├─ AI 功能請求 ──────────▶ src/utils/geminiClient.ts (壓縮圖片 ≤1200px + 前端重試)
   │                             └─ POST /api/gemini
   │                                  ├─ 本機 / Express: server.ts ─▶ server/geminiHandler.ts
   │                                  └─ Vercel Prod:   api/gemini.ts (零依賴單檔 ─▶ Gemini v1beta REST)
   │
   └─ 免金鑰外部 API ───────▶ src/utils/weatherService.ts (Open-Meteo Geocoding + Forecast/Archive)
```

### 最關鍵的 3 個核心檔案
1. **`src/App.tsx` + `src/types/tabi.ts`**：整個 App 的 Single Source of Truth（`TabiAppState`）、`StPageFlip` 3D 翻頁引擎初始化與 patch、Firebase 雙向同步、以及 `localStorage` 持久化。
2. **`api/gemini.ts`（Vercel）& `server/geminiHandler.ts`（Express）**：所有 AI 代理端點（`status` / `test_connection` / `optimize_itinerary` / `scan_receipt` / `smart_phrase` / `hotel_photo` / `hotel_address`），統一處理模型切換、429/503 重試與錯誤碼轉換。
3. **`src/utils/aiItineraryOptimizer.ts` & `src/utils/weatherService.ts`**：行程優化採「AI 優先、離線地理時段演算法保底」；天氣整合依日期距今自動分流 Open-Meteo `forecast`（16 天內）與 `archive`（>16 天取往年同期）。

---

## 2. 關鍵技術決策（Why we did this）

* **前後端分離代理 `/api/gemini`**：絕不把 `GEMINI_API_KEY` 暴露於前端 `VITE_*`；手機拍攝的收據在 `geminiClient.ts` 先用 Canvas 縮至長邊 `1200px` / JPEG `0.8`（~200KB），避開 Vercel Serverless 4.5MB Payload 上限。
* **`api/gemini.ts` 放棄 `@google/genai` SDK，改用零依賴原生 `fetch`**：
  * `@google/genai` v3.1.0 標註 `engines.node >= 22.0.0` 且依賴較重；加上跨資料夾 `.ts` 匯入在 Vercel ESM Lambda 容易於啟動階段直接炸 `500 FUNCTION_INVOCATION_FAILED`。
  * `api/gemini.ts` 維持 **單檔零外部依賴**，只靠 Node 18/20/22 內建 `fetch` 直連 `generativelanguage.googleapis.com/v1beta`。
* **雙模型策略與保底**：預設 `gemini-3.5-flash-lite`（低延遲、較少 503），複雜多日排程才切 `gemini-3.8-flash`，遇持續 429/503 自動降級回 `3.5-flash-lite`；若 Gemini 不可用，行程排程與飯店檢索自動退回離線／網頁規則引擎。
* **天氣選 Open-Meteo 而非 Google Weather**：零 API Key、支援 CORS、無帳單額度風險；搭配 `localStorage` TTL 快取（預報 2 小時 / 歷史 7 天）。
* **頁面順序固定 `['discover', 'trips', 'plan', 'tools']`**：確保預設進入 Index 1 (`trips`)，左右翻頁或底部 Tab 切換 `discover <-> trips` 時不會閃過 `plan`。

---

## 3. 防踩坑與隱性限制（Gotchas & Edge Cases）

* **🚨 千萬別在 `api/gemini.ts` 匯入 `../server/*.ts` 或 `@google/genai`**：Vercel `"type": "module"` 下會導致 `ERR_MODULE_NOT_FOUND` / `500 FUNCTION_INVOCATION_FAILED`。改邏輯時請同步更新 `api/gemini.ts` 與 `server/geminiHandler.ts`。
* **🚨 Gemini API 必須走 `v1beta` 且 `-lite` 不可帶 `thinkingConfig`**：
  * `@google/genai` v3.1.0 預設打 `v1`，不支援 `gemini-3.5-flash-lite`、`systemInstruction` 與 `responseSchema`（`server/geminiHandler.ts` 已強制設 `apiVersion: 'v1beta'`）。
  * `gemini-3.5-flash-lite` 帶 `thinkingConfig` / `thinkingLevel` 會回 `400`，兩端都有防呆移除邏輯勿刪。
* **🚨 `GEMINI_API_KEY` 在 Google Cloud Console 的「應用程式限制」必須為「無」**：
  * 不可設 IP 限制（Vercel IP 浮動），也**不可設網站 HTTP Referrers 限制**（後端 `fetch` 無瀏覽器 Referer，設了必回 `403`）；僅在 API 限制勾選 `Generative Language API`。
* **🚨 不要刪除 `src/App.tsx` 的 `StPageFlip` runtime monkey-patch**：
  * 原生 `page-flip` 在 `usePortrait: true` 下往左翻（`direction === 1`）座標反轉且跨頁會閃中間頁；`convertToGlobal`、`convertToPage`、`drawBottomPage`、`getFlippingPage` 已被覆寫修復。
  * 所有互動按鈕／可捲動容器外層必須保留 `data-no-flip="true"` 與 `onTouchStart/Move stopPropagation`，否則滑動行程卡會誤觸翻頁。
* **🚨 `vite.config.ts` 的 PWA Service Worker 規則不可拿掉**：
  * 必須保留 `skipWaiting: true`、`clientsClaim: true`、`navigateFallbackDenylist: [/^\/api\//]` 及 `/api/.*` `NetworkOnly`；否則手機安裝 PWA 後會永遠卡在舊版或把 `/api/gemini` 導向 `index.html`。
* **Open-Meteo 日期邊界**：Forecast API 超過今天 `+15 天` 會直接回 `400`，`weatherService.ts` 會自動把遠期日期映射到最近一次過去同月同日打 Archive API。
* **TypeScript 編譯模式 (`tsconfig.node.json`)**：開啟了 `verbatimModuleSyntax`、`erasableSyntaxOnly`、`allowImportingTsExtensions`，後端檔案勿使用 TS `parameter properties` 或非標準語法。

---

## 4. 環境與啟動關鍵（Quick Restart）

### 環境變數（`.env` / Vercel Environment Variables）
| Key | 用途 | 備註 |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | 後端 `/api/gemini` 呼叫 Gemini | 僅存伺服器；Vercel 需同時勾選 `Production` + `Preview`，修改後**必按 `Redeploy`** |
| `VITE_GOOGLE_MAPS_API_KEY` | 前端 Places 飯店搜尋（選配） | 暴露於 `index.html`，Cloud Console 需設「網站」限制 (`https://*.vercel.app/*`)；未設仍可正常運作 |
| `VITE_FIREBASE_API_KEY` | Firebase Firestore 雲端同步（選配） | 未設自動降級為純 `localStorage` 離線模式 |

### 常用指令與驗收
```bash
npm install
npm run dev       # tsx server.ts (Port 3000，含 Vite middleware 與 /api/gemini)
npm run lint      # tsc -b --noEmit (含 client 與 server/api 雙 tsconfig)
npm run build     # vite build -> dist/ (同時產生 Workbox sw.js)
```
* **Vercel 專案設定**：Framework Preset = `Vite`、Root Directory = **留空**、Output Directory = `dist`、Node.js = `20.x` 或 `22.x`。
* **上線秒測**：先開 `https://<domain>/api/gemini` 確認回傳 `{"configured":true,"runtime":"vercel-rest-v1beta",...}`，再於 App 內按「一鍵測試 AI 連線」。

---

## 5. 未來擴充切入點（Next Steps）

1. **新增 AI 能力（如語音翻譯、景點預算估算）**：
   * 同步在 `api/gemini.ts`（`processRequest`）與 `server/geminiHandler.ts` 新增 `action`，並在 `src/utils/geminiClient.ts` 封裝呼叫函式，沿用既有的 `generateContentSmart` 重試與 JSON schema 機制。
2. **拆分過大的 `src/App.tsx`（目前 >7000 行）**：
   * 最安全拆法：先依 StPageFlip 4 個分頁拆出純 UI 子元件（`DiscoverPage.tsx` / `TripsPage.tsx` / `PlanPage.tsx` / `ToolsPage.tsx`）與 Modal 群組，**`pageFlipRef` 初始化與 `TabiAppState` 持久化暫留於 `App.tsx` 頂層**，避免破壞翻頁 DOM 生命週期。
3. **擴充外部資料來源（匯率、交通時刻表）**：
   * 參照 `src/utils/weatherService.ts` 模式，建立獨立 `src/utils/*Service.ts`，搭配 `AbortController` + `localStorage` TTL 快取，確保離線或山區弱網仍可閱讀上次結果。
