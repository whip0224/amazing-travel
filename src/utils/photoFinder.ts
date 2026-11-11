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

async function fetchWikiImage(searchQuery: string, lang: 'zh' | 'en' | 'ja' = 'zh'): Promise<string | null> {
  if (!searchQuery.trim()) return null;
  try {
    const endpoint = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages&piprop=thumbnail&pithumbsize=800&generator=search&gsrsearch=${encodeURIComponent(
      searchQuery
    )}&gsrlimit=5`;
    const res = await fetch(endpoint);
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return null;
    for (const key of Object.keys(pages)) {
      const src = pages[key]?.thumbnail?.source;
      if (src && typeof src === 'string' && !src.endsWith('.svg')) {
        return src;
      }
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

async function fetchGooglePlacesPhoto(query: string): Promise<string | null> {
  try {
    const g = (window as any).google;
    if (!g?.maps?.places?.PlacesService) return null;
    const dummy = document.createElement('div');
    const service = new g.maps.places.PlacesService(dummy);
    return await new Promise<string | null>((resolve) => {
      const timeout = setTimeout(() => resolve(null), 2200);
      service.textSearch({ query }, (results: any, status: any) => {
        clearTimeout(timeout);
        if (
          status === g.maps.places.PlacesServiceStatus.OK &&
          Array.isArray(results) &&
          results[0]?.photos?.[0]?.getUrl
        ) {
          resolve(results[0].photos[0].getUrl({ maxWidth: 800 }));
        } else {
          resolve(null);
        }
      });
    });
  } catch {
    return null;
  }
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
  const zhDirect = await fetchWikiImage(cleanTitle, 'zh');
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
