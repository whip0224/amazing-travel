import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

export interface GeminiRequestPayload {
  action:
    | 'status'
    | 'optimize_itinerary'
    | 'scan_receipt'
    | 'smart_phrase'
    | 'hotel_photo'
    | 'hotel_address';
  mode?: 'fill_and_reorder' | 'rebalance_all';
  days?: unknown[];
  places?: unknown[];
  imageBase64?: string;
  mimeType?: string;
  query?: string;
  destinationTitle?: string;
}

export interface GeminiHandlerResult {
  status: number;
  body: Record<string, unknown>;
}

function getServerApiKey(): string {
  return (process.env.GEMINI_API_KEY || '').trim();
}

function getServerGoogleMapsApiKey(): string {
  return (
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    ''
  ).trim();
}

function createGenAIClient(apiKey: string, vertexai = false): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    vertexai,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateContentSmart(
  apiKey: string,
  params: {
    model: string;
    contents: any;
    config?: any;
  }
) {
  const isAQ = apiKey.startsWith('AQ.');
  // 依序嘗試：
  // 1. Google AI Studio 標準端點 (generativelanguage.googleapis.com, vertexai: false)
  // 2. 若為 AQ. 開頭且標準端點失敗，自動嘗試 Vertex AI Express Mode 端點 (aiplatform.googleapis.com, vertexai: true)
  const vertexModes = isAQ ? [false, true] : [false];
  let lastError: any = null;

  for (const useVertex of vertexModes) {
    try {
      const client = createGenAIClient(apiKey, useVertex);
      return await client.models.generateContent(params);
    } catch (err: any) {
      lastError = err;
    }
  }

  throw lastError;
}

async function searchRealHotelPhotos(query: string): Promise<string[]> {
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  const photos: string[] = [];

  // 1. 若伺服器環境變數有設定 VITE_GOOGLE_MAPS_API_KEY / GOOGLE_MAPS_API_KEY，優先嘗試 Google Places Text Search 照片
  const gmapsKey = getServerGoogleMapsApiKey();
  if (gmapsKey) {
    try {
      const placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
        cleanQ
      )}&language=zh-TW&key=${encodeURIComponent(gmapsKey)}`;
      const pRes = await fetch(placesUrl);
      if (pRes.ok) {
        const pData: any = await pRes.json();
        const firstPlace = Array.isArray(pData?.results) ? pData.results[0] : null;
        if (Array.isArray(firstPlace?.photos)) {
          for (const ph of firstPlace.photos.slice(0, 4)) {
            if (ph?.photo_reference) {
              photos.push(
                `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${encodeURIComponent(
                  ph.photo_reference
                )}&key=${encodeURIComponent(gmapsKey)}`
              );
            }
          }
        }
      }
    } catch {
      // ignore and continue to Yahoo image search
    }
  }

  // 2. 補充真實飯店實景圖檢索
  try {
    const searchUrl = `https://search.yahoo.co.jp/image/search?p=${encodeURIComponent(cleanQ)}`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'ja,zh-TW;q=0.9,en;q=0.8',
      },
    });
    if (res.ok) {
      const html = await res.text();
      const matches = [
        ...html.matchAll(/https?:\/\/msp\.c\.yimg\.jp\/images\/v2\/[^\s"'<>\\]+/g),
      ].map((m) => m[0]);
      photos.push(...matches);
    }
  } catch {
    // ignore
  }

  return Array.from(new Set(photos)).slice(0, 8);
}

async function searchRealHotelAddresses(
  query: string,
  geminiApiKey: string
): Promise<
  Array<{ name: string; address: string; branchNote?: string; lat?: number; lng?: number }>
> {
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  const results: Array<{
    name: string;
    address: string;
    branchNote?: string;
    lat?: number;
    lng?: number;
  }> = [];
  const seenAddresses = new Set<string>();

  // 1. 若伺服器有 VITE_GOOGLE_MAPS_API_KEY / GOOGLE_MAPS_API_KEY，直接查詢 Google Maps Places 官方 API
  const gmapsKey = getServerGoogleMapsApiKey();
  if (gmapsKey) {
    try {
      const placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
        cleanQ
      )}&language=zh-TW&key=${encodeURIComponent(gmapsKey)}`;
      const pRes = await fetch(placesUrl);
      if (pRes.ok) {
        const pData: any = await pRes.json();
        if (Array.isArray(pData?.results) && pData.results.length > 0) {
          for (const item of pData.results.slice(0, 4)) {
            const addr = (item?.formatted_address || '').trim();
            if (addr && !seenAddresses.has(addr)) {
              seenAddresses.add(addr);
              results.push({
                name: item.name || cleanQ,
                address: addr,
                branchNote: item.rating
                  ? `Google Maps ⭐ ${item.rating}`
                  : 'Google Maps 官方地址',
                lat: item.geometry?.location?.lat,
                lng: item.geometry?.location?.lng,
              });
            }
          }
          if (results.length > 0) {
            return results;
          }
        }
      }
    } catch {
      // ignore and fall through
    }
  }

  // 2. 抓取即時網路搜尋摘要，提供給 Gemini AI 或正規表達式提取真實地址
  let webSnippet = '';
  const regexAddresses: string[] = [];
  try {
    const searchUrl = `https://search.yahoo.co.jp/search?p=${encodeURIComponent(
      `${cleanQ} hotel address ホテル 住所`
    )}`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'ja,zh-TW;q=0.9,en;q=0.8',
      },
    });
    if (res.ok) {
      const html = await res.text();
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ');

      webSnippet = text.slice(0, 3500);

      const addrRegex =
        /(?:〒\s*\d{3}-\d{4}\s*)?(?:大阪府|京都府|東京都|北海道|(?:[一-龥]{2,3}県))(?:[一-龥ぁ-んァ-ヶー\d\-－丁目番地号]{4,38}?\d+[一-龥\d\-－丁目番地号]*)/g;
      const rawMatches = [...text.matchAll(addrRegex)].map((m) =>
        m[0].replace(/\s+/g, ' ').trim()
      );

      for (const addr of rawMatches) {
        const normalized = addr.replace(/^〒\s*\d{3}-\d{4}\s*/, '');
        if (
          normalized.length >= 8 &&
          !regexAddresses.some(
            (existing) =>
              existing.includes(normalized) ||
              normalized.includes(existing.replace(/^〒\s*\d{3}-\d{4}\s*/, ''))
          )
        ) {
          regexAddresses.push(addr);
        }
        if (regexAddresses.length >= 4) break;
      }
    }
  } catch {
    // ignore web fetch error
  }

  // 3. 若已設定 GEMINI_API_KEY，交由 Gemini AI 結合即時網頁摘要精準解析全球任何飯店的 Google Maps 格式地址（永久免手動內建）
  if (geminiApiKey) {
    try {
      const response = await generateContentSmart(geminiApiKey, {
        model: 'gemini-4-hydrogen',
        contents: `請查詢並確認飯店「${cleanQ}」的正確地址（優先提供 Google Maps 標準地址格式，若為日本飯店可同時附上英文/Chome地址與日文郵遞區號地址，例如 "2 Chome-2-18 Dotonbori, Chuo Ward, Osaka, 542-0071日本 (〒542-0071 大阪府大阪市中央区道頓堀2-2-18)"）。
請注意：只回傳真正符合「${cleanQ}」該分館的正確地址，絕對不要回傳其他城市或無關的分館。
即時網路檢索參考資訊：
${webSnippet || '無額外網頁摘要，請根據你的知識庫提供該飯店精確地址。'}`,
        config: {
          systemInstruction:
            '你是全球飯店與 Google Maps 地理資訊專家。請精準回傳使用者指定飯店分館的真實地址與概略經緯度座標。',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              candidates: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    branchNote: { type: Type.STRING },
                    address: { type: Type.STRING },
                    lat: { type: Type.NUMBER },
                    lng: { type: Type.NUMBER },
                  },
                  required: ['name', 'branchNote', 'address'],
                },
              },
            },
            required: ['candidates'],
          },
        },
      });

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText);
      if (Array.isArray(parsed?.candidates)) {
        for (const c of parsed.candidates) {
          const addr = (c?.address || '').trim();
          if (addr && !seenAddresses.has(addr)) {
            seenAddresses.add(addr);
            results.push({
              name: c.name || cleanQ,
              address: addr,
              branchNote: c.branchNote || 'Gemini AI 智慧查證地址',
              lat: typeof c.lat === 'number' ? c.lat : undefined,
              lng: typeof c.lng === 'number' ? c.lng : undefined,
            });
          }
        }
      }
      if (results.length > 0) {
        return results;
      }
    } catch {
      // 若 Gemini 呼叫失敗，自動退回步驟 4 的網頁正規表達式結果
    }
  }

  // 4. 免金鑰保底：回傳即時網路檢索提取出的飯店地址
  return regexAddresses.map((address) => ({
    name: cleanQ,
    address,
    branchNote: '官方/網路登錄地址',
  }));
}

export async function handleGeminiRequest(
  payload: GeminiRequestPayload
): Promise<GeminiHandlerResult> {
  const apiKey = getServerApiKey();

  if (payload.action === 'status') {
    return {
      status: 200,
      body: {
        configured: Boolean(apiKey),
        keyType: apiKey
          ? apiKey.startsWith('AQ.')
            ? 'vertex_express'
            : 'ai_studio'
          : 'none',
        googleMapsConfigured: Boolean(getServerGoogleMapsApiKey()),
        model: 'gemini-4-hydrogen',
      },
    };
  }

  // 伺服器端真實飯店圖片檢索（結合 Google Maps Places Photo + Yahoo 實景圖，解決維基百科誤抓偶像團體照片的問題）
  if (payload.action === 'hotel_photo') {
    const q = (payload.query || '').trim();
    const photos = await searchRealHotelPhotos(q);
    return {
      status: 200,
      body: {
        ok: true,
        photos,
      },
    };
  }

  // 伺服器端真實飯店地址檢索（結合 Google Maps Places API + Gemini AI + 即時網頁檢索，永久解決新飯店地址搜尋問題）
  if (payload.action === 'hotel_address') {
    const q = (payload.query || '').trim();
    const candidates = await searchRealHotelAddresses(q, apiKey);
    return {
      status: 200,
      body: {
        ok: true,
        candidates,
      },
    };
  }

  if (!apiKey) {
    return {
      status: 503,
      body: {
        error: true,
        errorCode: 'MISSING_API_KEY',
        message:
          '尚未設定 Gemini API Key，無法使用 AI 智慧功能。請在 Settings > Secrets 面板或環境變數中設定 GEMINI_API_KEY（所有現有離線功能仍可正常使用）。',
      },
    };
  }

  try {
    if (payload.action === 'optimize_itinerary') {
      const mode = payload.mode || 'fill_and_reorder';
      const days = Array.isArray(payload.days) ? payload.days : [];
      const places = Array.isArray(payload.places) ? payload.places : [];

      const prompt = `你是一位專業的日本與亞洲旅遊動線規劃師。請分析以下「目的地清單」與「可用旅行日期」，為使用者規劃最順路（減少折返交通）、避開店家公休日、且符合景點性質（上午神社寺院、中午市場/正餐美食、下午甜點散策、傍晚夜景老街）的最佳訪問順序與建議時間段。
模式：${
        mode === 'fill_and_reorder'
          ? '保留已指定日期的景點在原日期，並為未排程景點分配最佳日期與時間，同時優化每日訪問順序與時間段'
          : '全行程重新最佳化分配至各天'
      }。
請確保每個輸入的景點 id 都有被安排，且同一天的時間段不重疊（格式 HH:MM，24小時制）。

可用日期：${JSON.stringify(days)}
目的地清單：${JSON.stringify(places)}`;

      const response = await generateContentSmart(apiKey, {
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            '你是一位專精日本、台灣、韓國與東南亞自由行的旅遊動線規劃師。請以繁體中文回答並輸出符合 Schema 的 JSON。',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
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

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText);
      return {
        status: 200,
        body: {
          ok: true,
          data: parsed,
        },
      };
    }

    if (payload.action === 'scan_receipt') {
      const imageBase64 = (payload.imageBase64 || '').replace(/^data:[^;]+;base64,/, '').trim();
      const mimeType = payload.mimeType || 'image/jpeg';

      if (!imageBase64) {
        return {
          status: 400,
          body: {
            error: true,
            errorCode: 'INVALID_IMAGE',
            message: '請提供收據或菜單照片。',
          },
        };
      }

      const imagePart = {
        inlineData: {
          mimeType,
          data: imageBase64,
        },
      };
      const textPart = {
        text: '請辨識這張旅遊收據、發票或菜單照片，提取店家名稱與所有消費品項（將品項名稱翻譯成清楚的繁體中文，附上單價或小計金額、數量，並將每個品項歸類為 shopping、dining、transport 或 gifts 四類之一）。若照片金額為外幣但非日圓，請照實填寫數字與幣別。',
      };

      const response = await generateContentSmart(apiKey, {
        model: 'gemini-4-hydrogen',
        contents: { parts: [imagePart, textPart] },
        config: {
          systemInstruction:
            '你是專精日本與亞洲旅遊收據、菜單辨識的 AI 記帳助手。請將日文/英文品項翻譯為繁體中文，並輸出符合 Schema 的 JSON。',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              shopName: {
                type: Type.STRING,
                description: '店家或景點名稱（例如：唐吉訶德 京都Avanti店、一蘭拉麵 河原町店）',
              },
              currency: {
                type: Type.STRING,
                description: '幣別代碼，預設 JPY（或 TWD, HKD, KRW, THB, USD）',
              },
              summaryNote: {
                type: Type.STRING,
                description: '簡短繁體中文摘要或退稅提示',
              },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: {
                      type: Type.STRING,
                      description: '繁體中文品項名稱（可附帶簡短日文原名）',
                    },
                    amount: {
                      type: Type.NUMBER,
                      description: '該品項的總金額（已乘以數量的小計）',
                    },
                    quantity: {
                      type: Type.INTEGER,
                      description: '購買數量，預設 1',
                    },
                    category: {
                      type: Type.STRING,
                      description: '必須為 shopping, dining, transport, 或 gifts 其中之一',
                    },
                  },
                  required: ['title', 'amount', 'quantity', 'category'],
                },
              },
            },
            required: ['shopName', 'currency', 'summaryNote', 'items'],
          },
        },
      });

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText);
      return {
        status: 200,
        body: {
          ok: true,
          data: parsed,
        },
      };
    }

    if (payload.action === 'smart_phrase') {
      const query = (payload.query || '').trim();
      if (!query) {
        return {
          status: 400,
          body: {
            error: true,
            errorCode: 'EMPTY_QUERY',
            message: '請輸入想要翻譯或生成的溝通情境。',
          },
        };
      }

      const response = await generateContentSmart(apiKey, {
        model: 'gemini-4-hydrogen',
        contents: `使用者在旅遊時想對店員或當地人表達以下意思：「${query}」。請生成最自然有禮貌的日文句子、羅馬拼音、英文句子、繁體中文標題與一個代表 Emoji。`,
        config: {
          systemInstruction:
            '你是旅遊手指溝通卡專家，專門為自由行旅客生成大字清晰、有禮貌且道地的日語與英語溝通字卡。',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              emoji: { type: Type.STRING },
              zh: { type: Type.STRING },
              jp: { type: Type.STRING },
              romaji: { type: Type.STRING },
              en: { type: Type.STRING },
            },
            required: ['emoji', 'zh', 'jp', 'romaji', 'en'],
          },
        },
      });

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText);
      return {
        status: 200,
        body: {
          ok: true,
          data: parsed,
        },
      };
    }

    return {
      status: 400,
      body: {
        error: true,
        errorCode: 'UNKNOWN_ACTION',
        message: '不支援的 AI 操作類型。',
      },
    };
  } catch (err: any) {
    const rawMsg = String(err?.message || err || '未知錯誤');
    const status = Number(err?.status) || 500;

    if (rawMsg.includes('ACCESS_TOKEN_TYPE_UNSUPPORTED')) {
      return {
        status: 403,
        body: {
          error: true,
          errorCode: 'INVALID_API_KEY',
          rawError: rawMsg,
          message:
            '您的 AQ. 開頭 Google AI Studio 金鑰被 Google 拒絕 (ACCESS_TOKEN_TYPE_UNSUPPORTED)。請前往 Google Cloud Console ➔「API 與服務」➔「憑證」點擊該金鑰：① 將「應用程式限制」設為「無」（不要設網站限制）；② 將「API 限制」改為僅勾選「Generative Language API」（切勿勾選「Gemini API / Cloud AI Companion」）。',
        },
      };
    }

    if (
      status === 401 ||
      status === 403 ||
      rawMsg.includes('API_KEY_INVALID') ||
      rawMsg.includes('PERMISSION_DENIED') ||
      rawMsg.includes('API key not valid') ||
      rawMsg.includes('UNAUTHENTICATED')
    ) {
      return {
        status: 403,
        body: {
          error: true,
          errorCode: 'INVALID_API_KEY',
          rawError: rawMsg,
          message:
            'Gemini API Key 無效或權限不足。若您有在 Google Cloud Console 設定「網站限制 (HTTP referrers)」，請注意：網站限制僅適用於前端的 VITE_GOOGLE_MAPS_API_KEY；後端使用的 GEMINI_API_KEY 請將應用程式限制設為「無」，並在 API 限制勾選「Generative Language API」。',
        },
      };
    }

    if (status === 429 || rawMsg.includes('RESOURCE_EXHAUSTED')) {
      return {
        status: 429,
        body: {
          error: true,
          errorCode: 'QUOTA_EXCEEDED',
          rawError: rawMsg,
          message:
            '今日免費 Gemini API 呼叫次數已達上限 (429)。離線功能仍可正常使用，或可於 Settings > Secrets 升級為付費 API Key 以提高限額。',
        },
      };
    }

    return {
      status: 500,
      body: {
        error: true,
        errorCode: 'UPSTREAM_ERROR',
        rawError: rawMsg,
        message: `AI 服務暫時無法連線：${rawMsg}`,
      },
    };
  }
}
