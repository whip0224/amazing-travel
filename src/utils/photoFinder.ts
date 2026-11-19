// src/utils/photoFinder.ts
// 智慧景點與美食圖片搜尋/生成器：
// 1. 優先嘗試 Google Maps Places Photos (若環境中有載入 Google Maps Places SDK)
// 2. 透過 Wikipedia / Wikimedia Commons 免金鑰公開 API (支援 CORS origin=*) 根據目的地或美食關鍵字自動抓取真實圖片
// 3. 若處於完全離線模式，自動生成高質感專屬旅遊明信片 SVG Data URL

const KEYWORD_FALLBACK_QUERIES: { pattern: RegExp; wikiQuery: string; badge: string }[] = [
  { pattern: /脆皮豬|燒肉|烤肉|叉燒|燒臘/i, wikiQuery: 'Crispy pork belly', badge: '人氣燒肉 🥩' },
  { pattern: /豬腳|滷肉|控肉|魯肉/i, wikiQuery: 'Pork knuckle rice Taiwan', badge: '在地名店 🍖' },
  { pattern: /豬排|KATSU|かつ|吉列/i, wikiQuery: 'Tonkatsu', badge: '熟成豬排 🍱' },
  { pattern: /拉麵|麵|烏龍|蕎麥|ramen/i, wikiQuery: 'Ramen', badge: '必吃麵食 🍜' },
  { pattern: /抹茶|茶寮|辻利|芭菲|甜點|冰|matcha/i, wikiQuery: 'Matcha parfait', badge: '人氣甜點 🍵' },
  { pattern: /市場|夜市|錦市場|商店街|market/i, wikiQuery: 'Nishiki Market', badge: '美食市集 🏮' },
  { pattern: /清水寺|寺|神社|稻荷|金閣|銀閣|temple|shrine/i, wikiQuery: 'Kiyomizu-dera', badge: '古都名勝 ⛩️' },
  { pattern: /祇園|花見小路|先斗町|老街|gion/i, wikiQuery: 'Gion Kyoto', badge: '散策風情 ✨' },
  { pattern: /嵐山|竹林|公園|庭園|bamboo/i, wikiQuery: 'Arashiyama', badge: '自然美景 🌿' },
  { pattern: /咖啡|cafe|coffee|喫茶/i, wikiQuery: 'Japanese kissaten coffee', badge: '質感咖啡 ☕' },
  { pattern: /火鍋|壽喜燒|涮涮鍋|和牛/i, wikiQuery: 'Sukiyaki Wagyu', badge: '頂級鍋物 🍲' },
  { pattern: /壽司|生魚片|海鮮|丼|sushi/i, wikiQuery: 'Sushi platter', badge: '鮮美海味 🍣' },
  { pattern: /台北|臺北|大同區|中山|大稻埕|迪化街/i, wikiQuery: 'Dadaocheng Taipei', badge: '台北探索 📍' },
];

async function fetchWikiImage(
  searchQuery: string,
  lang: 'zh' | 'en' | 'ja' = 'zh',
  requireTitleMatch = false
): Promise<string | null> {
  const cleanQ = searchQuery.trim();
  if (!cleanQ) return null;
  try {
    const endpoint = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages&piprop=thumbnail&pithumbsize=800&generator=search&gsrsearch=${encodeURIComponent(
      cleanQ
    )}&gsrlimit=5`;
    const res = await fetch(endpoint);
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return null;

    const qTokens = cleanQ
      .toLowerCase()
      .split(/[\s,.\-()（）/]+/)
      .filter((t) => t.length >= 2 && !['in', 'inn', 'the', 'of', 'at', 'by', 'hotel'].includes(t));

    for (const key of Object.keys(pages)) {
      const page = pages[key];
      const title = String(page?.title || '').toLowerCase();
      const src = page?.thumbnail?.source;
      if (!src || typeof src !== 'string' || src.endsWith('.svg')) continue;

      // 防止維基百科全文檢索把無關的韓團/歌手/藝人條目 (例如 ONF, 錦戶亮, RAISE A SUILEN) 當成飯店或景點圖片
      if (
        requireTitleMatch &&
        qTokens.length > 0 &&
        !qTokens.some((tok) => title.includes(tok))
      ) {
        continue;
      }

      return src;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchCommonsImage(searchQuery: string): Promise<string | null> {
  if (!searchQuery.trim()) return null;
  try {
    const endpoint = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${encodeURIComponent(
      `filetype:bitmap ${searchQuery}`
    )}&gsrlimit=5&prop=imageinfo&iiprop=url&iiurlwidth=800`;
    const res = await fetch(endpoint);
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return null;
    for (const key of Object.keys(pages)) {
      const thumbUrl = pages[key]?.imageinfo?.[0]?.thumburl || pages[key]?.imageinfo?.[0]?.url;
      if (thumbUrl && typeof thumbUrl === 'string' && !thumbUrl.endsWith('.svg')) {
        return thumbUrl;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchGooglePlacesPhotos(query: string): Promise<string[]> {
  try {
    const g = (window as any).google;
    if (!g?.maps?.places?.PlacesService) return [];
    const dummy = document.createElement('div');
    const service = new g.maps.places.PlacesService(dummy);
    return await new Promise<string[]>((resolve) => {
      const timeout = setTimeout(() => resolve([]), 2200);
      service.textSearch({ query }, (results: any, status: any) => {
        clearTimeout(timeout);
        if (
          status === g.maps.places.PlacesServiceStatus.OK &&
          Array.isArray(results) &&
          Array.isArray(results[0]?.photos)
        ) {
          const urls = results[0].photos
            .slice(0, 5)
            .map((ph: any) => (typeof ph?.getUrl === 'function' ? ph.getUrl({ maxWidth: 800 }) : ''))
            .filter(Boolean);
          resolve(urls);
        } else {
          resolve([]);
        }
      });
    });
  } catch {
    return [];
  }
}

async function fetchGooglePlacesPhoto(query: string): Promise<string | null> {
  const photos = await fetchGooglePlacesPhotos(query);
  return photos[0] || null;
}

function createDestinationPostcardDataUrl(title: string, subtitle: string, badge: string): string {
  const safeTitle = title.replace(/[<>&"']/g, '').slice(0, 18);
  const safeSub = (subtitle || '精選旅遊目的地').replace(/[<>&"']/g, '').slice(0, 28);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="360" viewBox="0 0 800 360">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1A5D42"/>
        <stop offset="55%" stop-color="#2B7A5A"/>
        <stop offset="100%" stop-color="#C85A32"/>
      </linearGradient>
    </defs>
    <rect width="800" height="360" rx="28" fill="url(#bg)"/>
    <circle cx="680" cy="80" r="110" fill="#FCE1D6" fill-opacity="0.16"/>
    <circle cx="120" cy="300" r="140" fill="#AEE5CE" fill-opacity="0.14"/>
    <text x="48" y="95" fill="#AEE5CE" font-family="sans-serif" font-size="22" font-weight="bold">${badge}</text>
    <text x="48" y="185" fill="#FFFFFF" font-family="sans-serif" font-size="46" font-weight="900">${safeTitle}</text>
    <text x="48" y="245" fill="#E4F2EB" font-family="sans-serif" font-size="24" font-weight="500">📍 ${safeSub}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export async function findDestinationPhoto(
  name: string,
  address?: string
): Promise<{ photoUrl: string; photoBadge: string }> {
  const rawName = (name || '').trim();
  const cleanTitle = rawName.split(/[｜|・\-]/)[0].trim() || rawName;

  // 判斷對應的主題標籤與關鍵字
  let matchedBadge = '精選景點 ✨';
  let fallbackSearchTerm = cleanTitle;

  for (const rule of KEYWORD_FALLBACK_QUERIES) {
    if (rule.pattern.test(rawName) || (address && rule.pattern.test(address))) {
      matchedBadge = rule.badge;
      fallbackSearchTerm = rule.wikiQuery;
      break;
    }
  }

  // 1. 先嘗試 Google Places Photo (若有載入 API Key)
  const googlePhoto = await fetchGooglePlacesPhoto(`${cleanTitle} ${address || ''}`.trim());
  if (googlePhoto) {
    return { photoUrl: googlePhoto, photoBadge: matchedBadge };
  }

  // 2. 嘗試用景點乾淨名稱查詢中文維基百科與 Wikimedia Commons
  const zhDirect = await fetchWikiImage(cleanTitle, 'zh', true);
  if (zhDirect) {
    return { photoUrl: zhDirect, photoBadge: matchedBadge };
  }

  const commonsDirect = await fetchCommonsImage(cleanTitle);
  if (commonsDirect) {
    return { photoUrl: commonsDirect, photoBadge: matchedBadge };
  }

  // 3. 若店名太過在地（例如「王師父脆皮豬」），改用智慧美食/景點分類關鍵字搜尋真實照片
  const enFallback = await fetchCommonsImage(fallbackSearchTerm);
  if (enFallback) {
    return { photoUrl: enFallback, photoBadge: matchedBadge };
  }

  const wikiEnFallback = await fetchWikiImage(fallbackSearchTerm, 'en');
  if (wikiEnFallback) {
    return { photoUrl: wikiEnFallback, photoBadge: matchedBadge };
  }

  // 4. 離線環境保底：動態生成目的地專屬插畫明信片
  return {
    photoUrl: createDestinationPostcardDataUrl(cleanTitle, address || '', matchedBadge),
    photoBadge: matchedBadge,
  };
}

// 飯店／住宿專屬真實照片庫與智慧換圖搜尋器：
// 1. 內建特定熱門飯店（如 Weekly Green In Namba ウィークリーグリーン in なんば）的真實大門外觀與客房照片
// 2. 透過後端 /api/gemini (action: 'hotel_photo') 檢索真實飯店外觀與客房實景照
// 3. 嚴格過濾維基百科條目標題，絕不誤抓偶像團體或無關人物照片
const KNOWN_HOTEL_REAL_PHOTOS: { pattern: RegExp; photos: string[] }[] = [
  {
    pattern: /weekly\s*green|ウィークリーグリーン/i,
    photos: [
      // 1. Weekly Green In Namba 真實大門入口（綠色地毯 + Weekly Green in Namba 招牌，對應 Google 首圖）
      'https://msp.c.yimg.jp/images/v2/tpvPBYOX1wpNVI1UoNSgEqBQLTl2MNKwRJcwJiWcvl3FhdZi9qjNg9R3PRDH01dXw7OyMH-MFzF06Db4HAdTLpus43yUk384p0ZspYw_U414mB9MmfoBhc60JHBGZeX7-VlKlAAafPFrAbKazSrbR6Hll4SCJcE7Y1UdF1ESWhIR-wafp0QWHr8skVMsfZv5JUPtYufeDrSeI8TBUOphIesSKZP5F0lCKdKut9fHwKCtoKFpLw8eH1Fi4EDPpqko/gaikan.jpg',
      // 2. Weekly Green In Namba 真實多床客房實景（對應 Google 客房圖）
      'https://msp.c.yimg.jp/images/v2/FUTi93tXq405grZVGgDqGyYEOHgJC6AWxyaQJZ7SayyZ0UktKcluw0rjALeO6k0lqYBkqSXUylMRQGa-aeeJe8XHwV_U_buXsBxpyY25Z2OHXT5WL8_mOq1CKR2lJjWAwxuULIirPz6mc7Yy1Oj8WOolYPLvscXESR_TNNbPXvOKGwWbPRimBkQkXmRxFY8Vl-4g8zG-4GDEr21S6I24Vgxskl83ELqhTI77rYHNc8vBMoPYG-HUNRZF1x8CDzGsy-Ij8CrYkQpp5pB2_lheaIH_QYZecdTV2ByUR4HWSc58sZv5YCy3kfPXOGaVQYTdwqndrePj6fg2UUTmEjxXE85B_-UhRl4xRZ76IES759TPJxQZ9bwdfkETLulODGhN419-V8ofTs_fCbGufhLIYg==/osaka-weekly-green-in-namba-photo-61.JPEG',
      // 3. Weekly Green In Namba 建築外觀與招牌
      'https://msp.c.yimg.jp/images/v2/tpvPBYOX1wpNVI1UoNSgEqBQLTl2MNKwRJcwJiWcvl1j6ZREIDMH7jI5Q3-IE496fAolHxysp1WcjmkKjfUEuqcZOk3bg_pji5PjErLFEWa5lp4ZGKBw0V9Sep_-6o3tcl7O45TeZag4wH7o-xonh9kVfsUegLSKbRvIxE9LgrdYVNDAgKYhD-pK-_syPbbNA3rd6yuW-rkov0swAlvtcehUZ3pCBEPHTDJecU2vWbkGXrhSoEYx4fu9NIIFywiC/top_img.jpg',
      // 4. Weekly Green In Namba 雙人客房實景
      'https://msp.c.yimg.jp/images/v2/FUTi93tXq405grZVGgDqG3ZNv5TdA1IXOLFGtmir9l5f_HV9YIbtRPNRZxc5dt-juC_4YFR8vxWqU1hu5KRpn_LmZg-ecolhzj1JaQg9B3lW-GU13a1QUfrJZTRQ-afu6LiwsTg-P9PggVHx_wrTivpYzOQuL1wCWlCHLWmLccQooMhz8zJorGooOqdTxFZTLsNq-S-Z_GHd3GrsrhWRCNr0LHSOpIUpqMqJdD7MrQKMEFK9rj0Y7LLyCqdJczYeXGj0Z3M2WZIW-mJveG3_f1YGFhH6RqTC_q1eFRk5JI0vr_6r-P8iXrCWNWBivuitu4DHLKlnH7efEiALQZqRjnIu92yM5DCyP8FgSLBqVmZAQ0t6ikOHsyQ_9DL7JgRHjcUjjXAPI1kh1TfaBbSDbg==/13660091.jpg',
    ],
  },
];

const CURATED_HOTEL_PHOTOS: string[] = [
  '/assets/tabi/hotel_room.png',
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=800&q=80',
];

// 檢查舊快取中的飯店圖片是否為之前維基百科全文搜尋誤抓的韓團/樂團圖片
export function isInvalidCachedHotelPhoto(photoUrl?: string): boolean {
  if (!photoUrl) return false;
  return (
    photoUrl.includes('%ED%99%88%ED%8E%98%EC%9D%B4%EC%A7%80') ||
    photoUrl.includes('Raise_A_Suilen') ||
    photoUrl.includes('.svg')
  );
}

async function fetchServerRealHotelPhotos(query: string): Promise<string[]> {
  if (!query.trim()) return [];
  try {
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'hotel_photo',
        query,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data?.photos)) {
      return data.photos.filter((u: unknown): u is string => typeof u === 'string' && u.length > 0);
    }
    return [];
  } catch {
    return [];
  }
}

export async function findHotelPhoto(
  hotelName: string,
  address?: string,
  destinationTitle?: string,
  currentPhotoUrl?: string
): Promise<string> {
  const rawHotel = (hotelName || '').trim() || 'Boutique Hotel';
  const cleanHotel = rawHotel.split(/[｜|・(（]/)[0].trim() || rawHotel;
  const cityPart = (destinationTitle || '').split(',')[0].trim();

  const candidates: string[] = [];

  // 1. 先檢查是否匹配已知飯店（如 Weekly Green In Namba）的官方大門與客房實景圖
  for (const known of KNOWN_HOTEL_REAL_PHOTOS) {
    if (known.pattern.test(rawHotel)) {
      candidates.push(...known.photos);
    }
  }

  // 2. 先嘗試 Google Places Photos (若環境中有載入 Google Maps Places SDK / VITE_GOOGLE_MAPS_API_KEY)
  const googlePhotos = await fetchGooglePlacesPhotos(
    `${cleanHotel} ${address || cityPart || ''} hotel`.trim()
  );
  if (googlePhotos.length > 0) {
    candidates.push(...googlePhotos);
  }

  // 3. 呼叫伺服器端真實飯店圖片檢索（直接抓取該飯店的外觀與房間實景照）
  const serverPhotos = await fetchServerRealHotelPhotos(rawHotel);
  candidates.push(...serverPhotos);

  // 4. 若仍需要更多候選圖，嘗試嚴格標題匹配的 Wikipedia (必須標題真正包含飯店名稱，絕不誤抓無關人物/韓團)
  if (candidates.length === 0) {
    const wikiJa = await fetchWikiImage(cleanHotel, 'ja', true);
    if (wikiJa) candidates.push(wikiJa);

    const wikiEn = await fetchWikiImage(cleanHotel, 'en', true);
    if (wikiEn) candidates.push(wikiEn);
  }

  // 5. 加入精選高質感飯店客房照片池作為保底
  candidates.push(...CURATED_HOTEL_PHOTOS);

  const uniqueCandidates = Array.from(
    new Set(candidates.filter((u) => Boolean(u) && !isInvalidCachedHotelPhoto(u)))
  );

  if (uniqueCandidates.length > 0) {
    if (currentPhotoUrl && !isInvalidCachedHotelPhoto(currentPhotoUrl)) {
      const currIdx = uniqueCandidates.indexOf(currentPhotoUrl);
      if (currIdx !== -1 && uniqueCandidates.length > 1) {
        return uniqueCandidates[(currIdx + 1) % uniqueCandidates.length];
      }
      const diffCandidates = uniqueCandidates.filter((u) => u !== currentPhotoUrl);
      if (diffCandidates.length > 0) {
        return diffCandidates[0];
      }
    }
    return uniqueCandidates[0];
  }

  return createDestinationPostcardDataUrl(cleanHotel, address || cityPart || '精選住宿', '質感飯店 🏨');
}


