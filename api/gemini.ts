type GeminiModelId = 'gemini-3.5-flash-lite' | 'gemini-3.8-flash';

const DEFAULT_FAST_MODEL: GeminiModelId = 'gemini-3.5-flash-lite';
const COMPLEX_REASONING_MODEL: GeminiModelId = 'gemini-3.8-flash';

interface GeminiRequestPayload {
  action?:
    | 'status'
    | 'test_connection'
    | 'optimize_itinerary'
    | 'scan_receipt'
    | 'smart_phrase'
    | 'summarize_journal'
    | 'hotel_photo'
    | 'hotel_address';
  mode?: 'fill_and_reorder' | 'rebalance_all';
  preferredModel?: GeminiModelId;
  days?: unknown[];
  places?: unknown[];
  activities?: unknown[];
  stickers?: unknown[];
  tripMeta?: Record<string, unknown>;
  imageBase64?: string;
  mimeType?: string;
  query?: string;
  destinationTitle?: string;
}

interface HandlerResult {
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

function resolveRequestedModel(
  preferredModel?: unknown,
  fallback: GeminiModelId = DEFAULT_FAST_MODEL
): GeminiModelId {
  if (preferredModel === 'gemini-3.8-flash' || preferredModel === 'gemini-3.5-flash-lite') {
    return preferredModel;
  }
  return fallback;
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseGeminiJson(rawText: string): any {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(cleaned || '{}');
}

function normalizeContentsForRest(contents: any): any[] {
  if (typeof contents === 'string') {
    return [{ role: 'user', parts: [{ text: contents }] }];
  }
  if (Array.isArray(contents)) {
    return contents;
  }
  if (contents && Array.isArray(contents.parts)) {
    return [{ role: 'user', parts: contents.parts }];
  }
  return [{ role: 'user', parts: [{ text: String(contents || '') }] }];
}

function isRetryableStatusError(err: any): boolean {
  const status = Number(err?.status) || 0;
  const msg = String(err?.message || err || '');
  return (
    status === 429 ||
    status === 503 ||
    status === 502 ||
    status === 504 ||
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('UNAVAILABLE') ||
    msg.toLowerCase().includes('overloaded') ||
    msg.toLowerCase().includes('rate limit')
  );
}

function isThinkingConfigUnsupportedError(err: any): boolean {
  const status = Number(err?.status) || 0;
  const msg = String(err?.message || err || '').toLowerCase();
  return status === 400 && (msg.includes('thinking') || msg.includes('budget'));
}

async function callGeminiV1BetaRest(
  apiKey: string,
  model: GeminiModelId,
  contents: any,
  config?: {
    systemInstruction?: string;
    responseMimeType?: string;
    responseSchema?: Record<string, unknown>;
    thinkingLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  }
): Promise<{ text: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent`;

  const bodyPayload: Record<string, any> = {
    contents: normalizeContentsForRest(contents),
  };

  if (config?.systemInstruction) {
    bodyPayload.systemInstruction = {
      parts: [{ text: String(config.systemInstruction) }],
    };
  }

  const genConfig: Record<string, unknown> = {};
  if (config?.responseMimeType) {
    genConfig.responseMimeType = config.responseMimeType;
  }
  if (config?.responseSchema) {
    genConfig.responseSchema = config.responseSchema;
  }
  if (config?.thinkingLevel) {
    genConfig.thinkingConfig = { thinkingLevel: config.thinkingLevel };
  }
  if (Object.keys(genConfig).length > 0) {
    bodyPayload.generationConfig = genConfig;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(bodyPayload),
  });

  const rawText = await res.text().catch(() => '');
  let data: any = {};
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { rawText };
    }
  }

  if (!res.ok) {
    const err: any = new Error(JSON.stringify(data));
    err.status = res.status;
    throw err;
  }

  const parts = Array.isArray(data?.candidates?.[0]?.content?.parts)
    ? data.candidates[0].content.parts
    : [];
  const nonThoughtText = parts
    .filter((p: any) => !p?.thought && typeof p?.text === 'string')
    .map((p: any) => p.text)
    .join('');
  const text = nonThoughtText || parts.find((p: any) => typeof p?.text === 'string')?.text || '';
  return { text };
}

async function generateContentSmart(
  apiKey: string,
  params: {
    model: GeminiModelId;
    contents: any;
    config?: {
      systemInstruction?: string;
      responseMimeType?: string;
      responseSchema?: Record<string, unknown>;
      thinkingLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
    };
  }
): Promise<{ response: { text: string }; modelUsed: string; retriedCount: number }> {
  const modelChain: GeminiModelId[] =
    params.model === COMPLEX_REASONING_MODEL
      ? [COMPLEX_REASONING_MODEL, DEFAULT_FAST_MODEL]
      : [DEFAULT_FAST_MODEL];

  const maxAttemptsPerModel = 3;
  let lastError: any = null;
  let retriedCount = 0;

  for (const targetModel of modelChain) {
    let baseConfig = params.config ? { ...params.config } : undefined;
    if (baseConfig && targetModel === DEFAULT_FAST_MODEL && 'thinkingLevel' in baseConfig) {
      delete baseConfig.thinkingLevel;
    }

    for (let attempt = 1; attempt <= maxAttemptsPerModel; attempt++) {
      try {
        const response = await callGeminiV1BetaRest(
          apiKey,
          targetModel,
          params.contents,
          baseConfig
        );
        return { response, modelUsed: targetModel, retriedCount };
      } catch (err: any) {
        lastError = err;

        if (baseConfig && 'thinkingLevel' in baseConfig && isThinkingConfigUnsupportedError(err)) {
          const { thinkingLevel: _removed, ...restConfig } = baseConfig;
          baseConfig = restConfig;
          retriedCount += 1;
          continue;
        }

        if (isRetryableStatusError(err) && attempt < maxAttemptsPerModel) {
          retriedCount += 1;
          const jitter = Math.floor(Math.random() * 250);
          const backoffMs = attempt === 1 ? 800 + jitter : 1800 + jitter;
          await sleepMs(backoffMs);
          continue;
        }

        break;
      }
    }
  }

  throw lastError;
}

async function searchRealHotelPhotos(query: string): Promise<string[]> {
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  const photos: string[] = [];
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
      // ignore
    }
  }

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
      // ignore
    }
  }

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
    // ignore
  }

  if (geminiApiKey) {
    try {
      const { response } = await generateContentSmart(geminiApiKey, {
        model: DEFAULT_FAST_MODEL,
        contents: `請查詢並確認飯店「${cleanQ}」的正確地址（優先提供 Google Maps 標準地址格式，若為日本飯店可同時附上英文/Chome地址與日文郵遞區號地址，例如 "2 Chome-2-18 Dotonbori, Chuo Ward, Osaka, 542-0071日本 (〒542-0071 大阪府大阪市中央区道頓堀2-2-18)"）。
請注意：只回傳真正符合「${cleanQ}」該分館的正確地址，絕對不要回傳其他城市或無關的分館。
即時網路檢索參考資訊：
${webSnippet || '無額外網頁摘要，請根據你的知識庫提供該飯店精確地址。'}`,
        config: {
          systemInstruction:
            '你是全球飯店與 Google Maps 地理資訊專家。請精準回傳使用者指定飯店分館的真實地址與概略經緯度座標。',
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              candidates: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    name: { type: 'STRING' },
                    branchNote: { type: 'STRING' },
                    address: { type: 'STRING' },
                    lat: { type: 'NUMBER' },
                    lng: { type: 'NUMBER' },
                  },
                  required: ['name', 'branchNote', 'address'],
                },
              },
            },
            required: ['candidates'],
          },
        },
      });

      const parsed = parseGeminiJson(response.text || '{}');
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
      // fallback to regex results
    }
  }

  return regexAddresses.map((address) => ({
    name: cleanQ,
    address,
    branchNote: '官方/網路登錄地址',
  }));
}

async function processRequest(payload: GeminiRequestPayload): Promise<HandlerResult> {
  const apiKey = getServerApiKey();
  const action = payload.action || 'status';

  if (action === 'status') {
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
        model: DEFAULT_FAST_MODEL,
        supportedModels: [DEFAULT_FAST_MODEL, COMPLEX_REASONING_MODEL],
        runtime: 'vercel-rest-v1beta',
      },
    };
  }

  if (action === 'hotel_photo') {
    const q = (payload.query || '').trim();
    const photos = await searchRealHotelPhotos(q);
    return {
      status: 200,
      body: { ok: true, photos },
    };
  }

  if (action === 'hotel_address') {
    const q = (payload.query || '').trim();
    const candidates = await searchRealHotelAddresses(q, apiKey);
    return {
      status: 200,
      body: { ok: true, candidates },
    };
  }

  if (!apiKey) {
    return {
      status: 503,
      body: {
        error: true,
        errorCode: 'MISSING_API_KEY',
        message:
          '尚未設定 Gemini API Key，無法使用 AI 智慧功能。請在 Vercel Settings > Environment Variables 設定 GEMINI_API_KEY 並 Redeploy（離線功能仍可正常使用）。',
      },
    };
  }

  const targetModel = resolveRequestedModel(payload.preferredModel, DEFAULT_FAST_MODEL);

  try {
    if (action === 'test_connection') {
      const { response, modelUsed, retriedCount } = await generateContentSmart(apiKey, {
        model: targetModel,
        contents: '請回覆：連線成功',
      });
      return {
        status: 200,
        body: {
          ok: true,
          modelUsed,
          retriedCount,
          data: {
            reply: (response.text || '').trim() || '連線成功',
            modelUsed,
            retriedCount,
          },
        },
      };
    }

    if (action === 'optimize_itinerary') {
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

      const { response, modelUsed, retriedCount } = await generateContentSmart(apiKey, {
        model: targetModel,
        contents: prompt,
        config: {
          systemInstruction:
            '你是一位專精日本、台灣、韓國與東南亞自由行的旅遊動線規劃師。請以繁體中文回答並輸出符合 Schema 的 JSON。',
          thinkingLevel: 'LOW',
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              summaryPoints: {
                type: 'ARRAY',
                items: { type: 'STRING' },
              },
              estimatedSavedMinutes: { type: 'INTEGER' },
              stops: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    destId: { type: 'STRING' },
                    dayIndex: { type: 'INTEGER' },
                    start: { type: 'STRING' },
                    end: { type: 'STRING' },
                    transport: { type: 'STRING' },
                    cost: { type: 'STRING' },
                    reason: { type: 'STRING' },
                  },
                  required: ['destId', 'dayIndex', 'start', 'end', 'transport', 'cost', 'reason'],
                },
              },
            },
            required: ['summaryPoints', 'estimatedSavedMinutes', 'stops'],
          },
        },
      });

      const parsed = parseGeminiJson(response.text || '{}');
      return {
        status: 200,
        body: { ok: true, modelUsed, retriedCount, data: parsed },
      };
    }

    if (action === 'scan_receipt') {
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

      const { response, modelUsed, retriedCount } = await generateContentSmart(apiKey, {
        model: targetModel,
        contents: {
          parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            {
              text: '請辨識這張旅遊收據、發票或菜單照片，提取店家名稱與所有消費品項（將品項名稱翻譯成清楚的繁體中文，附上單價或小計金額、數量，並將每個品項歸類為 shopping、dining、transport 或 gifts 四類之一）。若照片為中國大陸/珠海消費或人民幣收據，請將幣別填為 CNY；其他外幣請照實填寫幣別代碼（如 HKD、TWD、JPY、KRW、THB、USD）。',
            },
          ],
        },
        config: {
          systemInstruction:
            '你是專精日本、中國大陸及亞洲旅遊收據、菜單辨識的 AI 記帳助手。請將品項翻譯或整理為繁體中文，並輸出符合 Schema 的 JSON。',
          thinkingLevel: 'LOW',
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              shopName: { type: 'STRING' },
              currency: {
                type: 'STRING',
                description: '幣別代碼，預設 JPY（或 CNY, HKD, TWD, KRW, THB, USD；中國大陸/人民幣收據請回傳 CNY）',
              },
              summaryNote: { type: 'STRING' },
              items: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    title: { type: 'STRING' },
                    amount: { type: 'NUMBER' },
                    quantity: { type: 'INTEGER' },
                    category: { type: 'STRING' },
                  },
                  required: ['title', 'amount', 'quantity', 'category'],
                },
              },
            },
            required: ['shopName', 'currency', 'summaryNote', 'items'],
          },
        },
      });

      const parsed = parseGeminiJson(response.text || '{}');
      return {
        status: 200,
        body: { ok: true, modelUsed, retriedCount, data: parsed },
      };
    }

    if (action === 'smart_phrase') {
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

      const { response, modelUsed, retriedCount } = await generateContentSmart(apiKey, {
        model: targetModel,
        contents: `使用者在旅遊時想對店員或當地人表達以下意思：「${query}」。請生成最自然有禮貌的日文句子、羅馬拼音、英文句子、繁體中文標題與一個代表 Emoji。`,
        config: {
          systemInstruction:
            '你是旅遊手指溝通卡專家，專門為自由行旅客生成大字清晰、有禮貌且道地的日語與英語溝通字卡。',
          thinkingLevel: 'LOW',
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              emoji: { type: 'STRING' },
              zh: { type: 'STRING' },
              jp: { type: 'STRING' },
              romaji: { type: 'STRING' },
              en: { type: 'STRING' },
            },
            required: ['emoji', 'zh', 'jp', 'romaji', 'en'],
          },
        },
      });

      const parsed = parseGeminiJson(response.text || '{}');
      return {
        status: 200,
        body: { ok: true, modelUsed, retriedCount, data: parsed },
      };
    }

    if (action === 'summarize_journal') {
      const tripMeta = payload.tripMeta || {};
      const days = Array.isArray(payload.days) ? payload.days : [];
      const activities = Array.isArray(payload.activities) ? payload.activities : [];
      const stickers = Array.isArray(payload.stickers) ? payload.stickers : [];

      const prompt = `你是一位擅長撰寫日系旅遊手札與剪貼簿總結的編輯。請根據以下旅程資訊、每日行程與「使用者自備的貼紙插畫庫」，完成兩件事：
1. 生成手札標題 (journalTitle)、60~100 字旅途亮點引言 (introQuote)、一句經費與消費亮點評語 (budgetHighlight)，並挑選一個最能代表整趟旅程的主貼紙 ID (heroStickerId)。
2. 針對每一天生成簡短副標 (dayHeadline) 與建議貼紙 (dayStickerId)；針對每一個行程景點 (activityId) 濃縮成 10~24 字的手札短句 (conciseLine，例如「午茶：祇園抹茶聖代・必拍」)，並嚴格從下方貼紙清單中挑選最適合該景點的 stickerId 與 stickerName。

⚠️ 重要：所有回傳的 heroStickerId、dayStickerId、stickerId 與 stickerName 必須嚴格出自下方「可用貼紙清單」，不可自行編造不存在的貼紙 ID。

旅程概要：${JSON.stringify(tripMeta)}
天數列表：${JSON.stringify(days)}
行程景點列表：${JSON.stringify(activities)}
可用貼紙清單：${JSON.stringify(stickers)}`;

      const { response, modelUsed, retriedCount } = await generateContentSmart(apiKey, {
        model: targetModel,
        contents: prompt,
        config: {
          systemInstruction:
            '你是繁體中文旅遊手札總結編輯。請用溫暖精煉的手帳口吻撰寫，並將所有輸出嚴格符合 JSON Schema。',
          thinkingLevel: 'LOW',
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              journalTitle: { type: 'STRING' },
              introQuote: { type: 'STRING' },
              budgetHighlight: { type: 'STRING' },
              heroStickerId: { type: 'STRING' },
              daySummaries: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    dayIndex: { type: 'INTEGER' },
                    dayHeadline: { type: 'STRING' },
                    dayStickerId: { type: 'STRING' },
                  },
                  required: ['dayIndex', 'dayHeadline', 'dayStickerId'],
                },
              },
              activitySuggestions: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    activityId: { type: 'STRING' },
                    conciseLine: { type: 'STRING' },
                    stickerId: { type: 'STRING' },
                    stickerName: { type: 'STRING' },
                  },
                  required: ['activityId', 'conciseLine', 'stickerId', 'stickerName'],
                },
              },
            },
            required: [
              'journalTitle',
              'introQuote',
              'budgetHighlight',
              'heroStickerId',
              'daySummaries',
              'activitySuggestions',
            ],
          },
        },
      });

      const parsed = parseGeminiJson(response.text || '{}');
      return {
        status: 200,
        body: { ok: true, modelUsed, retriedCount, data: parsed },
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
            'API Key 被 Google 拒絕 (ACCESS_TOKEN_TYPE_UNSUPPORTED)。請確認使用 Google AI Studio 的 AIza 開頭金鑰，且在 Google Cloud Console 將應用程式限制設為「無」、API 限制僅勾選「Generative Language API」。',
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
            'Gemini API Key 無效或權限不足。請確認 Vercel Environment Variables 中的 GEMINI_API_KEY 為最新的 AIza 開頭金鑰，且無設定 HTTP referrers 網站限制。',
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
            'Gemini API 呼叫次數暫時達限額 (429)，已自動重試 3 次仍達上限。請稍候 1 分鐘再試。',
        },
      };
    }

    if (status === 503 || rawMsg.includes('UNAVAILABLE') || rawMsg.toLowerCase().includes('overloaded')) {
      return {
        status: 503,
        body: {
          error: true,
          errorCode: 'MODEL_OVERLOADED',
          rawError: rawMsg,
          message:
            'Gemini AI 伺服器目前高負載 (503)，系統已自動重試並嘗試切換模型仍暫時無法連線，請稍後再試。',
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

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'GET') {
      const result = await processRequest({ action: 'status' });
      return res.status(result.status).json(result.body);
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: true, message: 'Method Not Allowed' });
    }

    let payload: GeminiRequestPayload = { action: 'status' };
    if (typeof req.body === 'string') {
      try {
        payload = JSON.parse(req.body || '{}');
      } catch {
        payload = { action: 'status' };
      }
    } else if (req.body && typeof req.body === 'object') {
      payload = req.body;
    }

    const result = await processRequest(payload);
    return res.status(result.status).json(result.body);
  } catch (err: any) {
    const msg = String(err?.message || err || '伺服器執行錯誤');
    return res.status(500).json({
      error: true,
      errorCode: 'SERVER_ERROR',
      message: `伺服器執行 AI 請求時發生錯誤：${msg}`,
    });
  }
}
