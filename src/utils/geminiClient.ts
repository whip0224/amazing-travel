import type { ExpenseCategoryKey } from '../types/tabi';
import type { OptimizeMode } from './aiItineraryOptimizer';

export interface GeminiStatusResponse {
  configured: boolean;
  model?: string;
}

export interface ScannedReceiptItem {
  title: string;
  amount: number;
  quantity: number;
  category: ExpenseCategoryKey;
}

export interface ScannedReceiptResult {
  shopName: string;
  currency: string;
  summaryNote: string;
  items: ScannedReceiptItem[];
}

export interface SmartPhraseResult {
  emoji: string;
  zh: string;
  jp: string;
  romaji: string;
  en: string;
}

export interface GeminiClientResponse<T> {
  ok: boolean;
  missingApiKey?: boolean;
  errorMessage?: string;
  data?: T;
}

// 自動在瀏覽器端將收據/菜單照片縮小至長邊最大 1200px、JPEG 品質 0.8（約 150KB~300KB）
export async function compressImageToBase64(
  file: File,
  maxDimension = 1200,
  quality = 0.8
): Promise<{ base64: string; mimeType: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('無法讀取圖片檔案'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('圖片格式無法解析'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('瀏覽器不支援 Canvas 圖片壓縮'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
        resolve({
          base64,
          mimeType: 'image/jpeg',
          dataUrl,
        });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export async function checkGeminiStatus(): Promise<GeminiStatusResponse> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { configured: false };
  }
  try {
    const res = await fetch('/api/gemini', { method: 'GET' });
    if (!res.ok) return { configured: false };
    const data = await res.json();
    return {
      configured: Boolean(data?.configured),
      model: data?.model,
    };
  } catch {
    return { configured: false };
  }
}

export async function callGeminiEndpoint<T>(
  payload: Record<string, unknown>
): Promise<GeminiClientResponse<T>> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      ok: false,
      errorMessage:
        '目前處於離線狀態，無法連線至 Gemini AI 服務（現有離線功能仍可正常使用）。',
    };
  }

  try {
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok || json?.error) {
      const isMissingKey =
        res.status === 503 ||
        json?.errorCode === 'MISSING_API_KEY' ||
        json?.errorCode === 'INVALID_API_KEY';
      return {
        ok: false,
        missingApiKey: isMissingKey,
        errorMessage:
          json?.message ||
          (isMissingKey
            ? '尚未設定 Gemini API Key，無法使用 AI 功能。請在 Settings > Secrets 或環境變數設定 GEMINI_API_KEY。'
            : '呼叫 Gemini AI 服務失敗，請稍後再試。'),
      };
    }

    return {
      ok: true,
      data: json.data as T,
    };
  } catch {
    return {
      ok: false,
      errorMessage: '無法連線至 AI 伺服器路由 (/api/gemini)，請確認網路連線。',
    };
  }
}

export async function scanReceiptWithGemini(
  file: File
): Promise<GeminiClientResponse<ScannedReceiptResult> & { previewDataUrl?: string }> {
  try {
    const compressed = await compressImageToBase64(file, 1200, 0.8);
    const result = await callGeminiEndpoint<ScannedReceiptResult>({
      action: 'scan_receipt',
      imageBase64: compressed.base64,
      mimeType: compressed.mimeType,
    });
    return {
      ...result,
      previewDataUrl: compressed.dataUrl,
    };
  } catch (err: any) {
    return {
      ok: false,
      errorMessage: err?.message || '處理收據照片失敗',
    };
  }
}

export async function generateSmartPhraseWithGemini(
  query: string
): Promise<GeminiClientResponse<SmartPhraseResult>> {
  return callGeminiEndpoint<SmartPhraseResult>({
    action: 'smart_phrase',
    query,
  });
}

export async function optimizeItineraryViaServer(
  places: unknown[],
  days: unknown[],
  mode: OptimizeMode
): Promise<
  GeminiClientResponse<{
    summaryPoints: string[];
    estimatedSavedMinutes: number;
    stops: {
      destId: string;
      dayIndex: number;
      start: string;
      end: string;
      transport: string;
      cost: string;
      reason: string;
    }[];
  }>
> {
  return callGeminiEndpoint({
    action: 'optimize_itinerary',
    places,
    days,
    mode,
  });
}
