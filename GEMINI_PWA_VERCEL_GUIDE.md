# React + Vite PWA 在 Vercel 串接 Gemini AI 成功紀錄與複製指南

這份文件整理自本專案（去旅行啦 Amazing Travel PWA）在 **Google AI Studio ＋ GitHub ＋ Vercel ＋ 手機 PWA** 環境成功打通 Gemini AI 的完整經驗，方便未來在其他 PWA 專案直接複製套用、避開相同坑點。

---

## 一、這次成功打通的 5 大關鍵原因

### 1. API 端點使用 `v1beta`（而非預設的 `v1`）
- **問題現象**：呼叫 `gemini-3.5-flash-lite` 或使用 `systemInstruction`、`responseMimeType: "application/json"`、`responseSchema` 時失敗。
- **原因**：`@google/genai` SDK 預設使用 `v1`，但新版輕量模型與結構化 JSON 輸出功能需要 **`v1beta`**。
- **解法**：直接使用官方 `v1beta` REST 端點（或在 SDK 明確指定 `apiVersion: 'v1beta'`）：
  ```
  POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
  Header: x-goog-api-key: <GEMINI_API_KEY>
  ```

### 2. Vercel `/api/*.ts` 採用「零外部依賴單檔」設計（解決 `500 FUNCTION_INVOCATION_FAILED`）
- **問題現象**：打開 `https://你的網域.vercel.app/api/gemini` 直接回傳 Vercel `500 FUNCTION_INVOCATION_FAILED`。
- **原因**：
  - 專案 `package.json` 為 `"type": "module"`，若 `/api/gemini.ts` 跨資料夾以 `.ts` 副檔名匯入 `../server/...ts`，Vercel Serverless 編譯/執行時可能找不到模組。
  - `@google/genai` v3.x 標註 `engines.node >= 22.0.0` 且相依套件較重，若 Vercel 專案跑在較舊 Node 版本或打包追蹤失敗，會在函式載入階段就當掉。
- **解法**：讓 `/api/gemini.ts` **完全自包含（零跨資料夾匯入、零外部 npm 套件依賴）**，只用 Node 18/20/22 內建的 `fetch()` 直接呼叫 Gemini `v1beta` REST API，冷啟動快且不挑 Node 版本。

### 3. Google Cloud Console 金鑰限制設定正確
- **核心原則**：`GEMINI_API_KEY` 是由 **Vercel 後端 (`/api/gemini`)** 發出請求，不是由手機瀏覽器直接送出。
- **正確設定**：
  - **應用程式限制 (Application restrictions)**：**選「無 (None)」**
    - 不可選「IP 位址」：Vercel Serverless Function 沒有固定 IP，且不能填網址。
    - 不可選「網站 (Websites / HTTP referrers)」：後端請求沒有瀏覽器 Referer，設定後會被 Google 擋掉回傳 `403`。
  - **API 限制 (API restrictions)**：選「限制金鑰」➔ 只勾選 **`Generative Language API`**。
- **例外**：只有前端瀏覽器使用的 Google Maps 金鑰（`VITE_GOOGLE_MAPS_API_KEY`）才要設「網站」限制，格式為 `https://你的網域.vercel.app/*`。

### 4. 模型選擇、參數相容與 `429` / `503` 自動重試
- **預設模型**：預設使用 `gemini-3.5-flash-lite`（回應快、較不易遇到 `503` 過載）。
- **複雜推理切換**：需要多日行程或複雜推理時才切換 `gemini-3.8-flash`，且若持續遇 `429`/`503` 會自動降級回 `gemini-3.5-flash-lite`。
- **參數相容性**：`-lite` 模型不要強塞 `thinkingConfig` / `thinkingLevel`，並保留「若收到 `400 thinking/budget` 錯誤就移除該欄位立刻重試」的保護。
- **重試策略**：對 `429`（頻率上限）、`503`（伺服器忙碌）、`502`、`504` 進行最多 3 次指數退避＋隨機抖動重試（約 `800ms` ➔ `1800ms`），前端再保留網路抖動重試。
- **JSON 安全解析**：AI 回傳文字先清除 ````json` / ```` 包裹再 `JSON.parse()`。

### 5. PWA Service Worker 不攔截 `/api/*` 並即時更新
- **問題現象**：已部署新版程式，手機開 PWA 卻一直停在舊版或打 `/api/gemini` 失敗。
- **解法**：在 `vite.config.ts` 的 `VitePWA` `workbox` 設定加上：
  ```ts
  workbox: {
    skipWaiting: true,
    clientsClaim: true,
    cleanupOutdatedCaches: true,
    navigateFallbackDenylist: [/^\/api\//],
    runtimeCaching: [
      {
        urlPattern: /^\/api\/.*/i,
        handler: 'NetworkOnly',
      },
    ],
  }
  ```

---

## 二、在其他 PWA 加入 AI 功能時的注意事項清單

### A. 安全性與架構
1. **絕對不要把 `GEMINI_API_KEY` 放在 `VITE_*` 或前端程式中**（會被打包進 JS 公開外洩），一律只放伺服器端環境變數 `GEMINI_API_KEY`，透過 `/api/gemini` 轉發。
2. **不要在手機畫面做「輸入 API Key」的欄位**，改成顯示目前連線狀態與「一鍵測試 AI 連線」按鈕即可。
3. **手機上傳照片（例如收據辨識）先做前端壓縮**：利用 Canvas 將長邊縮至 `1200px`、JPEG 品質 `0.8`（壓成約 `150KB–300KB`），避免超過 Vercel Serverless 4.5MB Request Body 上限，也加快手機行動網路上傳速度。

### B. Vercel Dashboard 設定容易踩的坑
1. **Secret 類型無法回看明文是正常的**：點 Edit 時看到範例灰字（例如 `AIzaSyB-aBcD...`）只是佔位符，不代表原本內容。要確認沒貼錯（無前後空格／引號／換行），最保險是刪除後重新新增。
2. **Environments 同時勾選 `Production` 和 `Preview`**：只勾 `Production` 的話，打開 Git 分支預覽網址會讀不到金鑰。
3. **修改環境變數後一定要 `Redeploy`**：只按 Save 不會更新已部署版本；需到 **Deployments ➔ `...` ➔ Redeploy**（取消勾選 Use existing Build Cache）。
4. **Build Settings 檢查**：
   - Framework Preset：`Vite`
   - Root Directory：**留空**（否則根目錄 `/api/*.ts` 不會被部署）
   - Output Directory：`dist`
   - Node.js Version：`20.x` 或 `22.x`

### C. 上線後標準驗收順序（30 秒排查法）
1. 先用瀏覽器直接開 `https://你的網域.vercel.app/api/gemini`：
   - 應看到 JSON：`{"configured":true,"model":"gemini-3.5-flash-lite",...}`。
   - 若看到 `configured: false` ➔ 檢查 Vercel 環境變數與是否 Redeploy。
   - 若看到 `404` 或網頁 HTML ➔ 檢查 `api/gemini.ts` 是否已 Push 到 GitHub、Root Directory 是否留空、`navigateFallbackDenylist` 是否有排除 `/api/`。
   - 若看到 `500` ➔ 檢查 `/api/gemini.ts` 是否有跨資料夾匯入或重套件依賴。
2. 用 `fetch` 在 Console 測或直接在 App 內點 **「一鍵測試 AI 連線」**：
   - 成功回覆即代表從「手機 PWA ➔ Vercel `/api/gemini` ➔ Google Gemini `v1beta`」整條鏈路 100% 打通。
3. **AI Studio 預覽視窗 vs 正式環境**：
   - 在開發工具預覽視窗內若 Secrets 尚未重新注入執行容器，以 **已推上 GitHub 並完成 Redeploy 的 Vercel 網址** 測試結果為準。

---

## 三、可直接複製給新 PWA 使用的最小 `/api/gemini.ts` 範本

```ts
type GeminiModelId = 'gemini-3.5-flash-lite' | 'gemini-3.8-flash';
const DEFAULT_MODEL: GeminiModelId = 'gemini-3.5-flash-lite';
const COMPLEX_MODEL: GeminiModelId = 'gemini-3.8-flash';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function callGeminiRest(
  apiKey: string,
  model: GeminiModelId,
  contents: unknown,
  generationConfig?: Record<string, unknown>,
  systemInstruction?: string
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent`;

  const body: Record<string, unknown> = {
    contents: typeof contents === 'string'
      ? [{ role: 'user', parts: [{ text: contents }] }]
      : contents,
  };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }
  if (generationConfig && Object.keys(generationConfig).length > 0) {
    body.generationConfig = generationConfig;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(JSON.stringify(data));
    err.status = res.status;
    throw err;
  }

  const parts = Array.isArray(data?.candidates?.[0]?.content?.parts)
    ? data.candidates[0].content.parts
    : [];
  return (
    parts
      .filter((p: any) => !p?.thought && typeof p?.text === 'string')
      .map((p: any) => p.text)
      .join('') || ''
  );
}

export default async function handler(req: any, res: any) {
  try {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (req.method === 'GET') {
      return res.status(200).json({
        configured: Boolean(apiKey),
        model: DEFAULT_MODEL,
        supportedModels: [DEFAULT_MODEL, COMPLEX_MODEL],
      });
    }
    if (req.method !== 'POST') {
      return res.status(405).json({ error: true, message: 'Method Not Allowed' });
    }
    if (!apiKey) {
      return res.status(503).json({
        error: true,
        errorCode: 'MISSING_API_KEY',
        message: '尚未設定 GEMINI_API_KEY 環境變數',
      });
    }

    const payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const requested: GeminiModelId =
      payload.preferredModel === COMPLEX_MODEL ? COMPLEX_MODEL : DEFAULT_MODEL;
    const chain: GeminiModelId[] =
      requested === COMPLEX_MODEL ? [COMPLEX_MODEL, DEFAULT_MODEL] : [DEFAULT_MODEL];

    let lastErr: any = null;
    for (const model of chain) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const text = await callGeminiRest(
            apiKey,
            model,
            payload.prompt || '請回覆：連線成功',
            payload.generationConfig,
            payload.systemInstruction
          );
          return res.status(200).json({ ok: true, modelUsed: model, text });
        } catch (err: any) {
          lastErr = err;
          const st = Number(err?.status) || 0;
          if ((st === 429 || st === 503 || st === 502 || st === 504) && attempt < 3) {
            await sleep((attempt === 1 ? 800 : 1800) + Math.floor(Math.random() * 250));
            continue;
          }
          break;
        }
      }
    }

    return res.status(Number(lastErr?.status) || 500).json({
      error: true,
      message: String(lastErr?.message || lastErr || 'AI 請求失敗'),
    });
  } catch (err: any) {
    return res.status(500).json({
      error: true,
      message: String(err?.message || err || 'Server Error'),
    });
  }
}
```
