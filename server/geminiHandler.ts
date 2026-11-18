import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

export interface GeminiRequestPayload {
  action: 'status' | 'optimize_itinerary' | 'scan_receipt' | 'smart_phrase';
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

function createGenAIClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
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
        model: 'gemini-4-hydrogen',
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

  const ai = createGenAIClient(apiKey);

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

      const response = await ai.models.generateContent({
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

      const response = await ai.models.generateContent({
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

      const response = await ai.models.generateContent({
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

    if (
      status === 403 ||
      status === 400 ||
      rawMsg.includes('API_KEY_INVALID') ||
      rawMsg.includes('PERMISSION_DENIED') ||
      rawMsg.includes('API key not valid')
    ) {
      return {
        status: 403,
        body: {
          error: true,
          errorCode: 'INVALID_API_KEY',
          message:
            'Gemini API Key 無效或權限不足。請在 Settings > Secrets 面板檢查您的 GEMINI_API_KEY 設定。',
        },
      };
    }

    if (status === 429 || rawMsg.includes('RESOURCE_EXHAUSTED')) {
      return {
        status: 429,
        body: {
          error: true,
          errorCode: 'QUOTA_EXCEEDED',
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
        message: `AI 服務暫時無法連線：${rawMsg}`,
      },
    };
  }
}
