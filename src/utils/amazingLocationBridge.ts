import type { SavedDestination } from '../types/tabi';

// 內建常見日/台/韓城市與行政區英中對照表（對應 Amazing Location 的翻譯邏輯，確保離線匯入時也能自動顯示中文城市與區域）
const BUILTIN_CITY_AREA_TRANSLATIONS: Record<string, string> = {
  tokyo: '東京',
  'tokyo prefecture': '東京都',
  osaka: '大阪',
  'osaka prefecture': '大阪府',
  kyoto: '京都',
  'kyoto prefecture': '京都府',
  hokkaido: '北海道',
  sapporo: '札幌市',
  fukuoka: '福岡',
  okinawa: '沖繩',
  naha: '那霸市',
  nagoya: '名古屋',
  yokohama: '橫濱',
  kobe: '神戶',
  nara: '奈良',
  taipei: '台北市',
  'taipei city': '台北市',
  'new taipei': '新北市',
  'new taipei city': '新北市',
  taichung: '台中市',
  tainan: '台南市',
  kaohsiung: '高雄市',
  seoul: '首爾',
  busan: '釜山',
  shinjuku: '新宿區',
  'shinjuku city': '新宿區',
  shibuya: '澀谷區',
  'shibuya city': '澀谷區',
  chuo: '中央區',
  'chuo ward': '中央區',
  'chuo city': '中央區',
  taito: '台東區',
  'taito city': '台東區',
  minato: '港區',
  'minato city': '港區',
  chiyoda: '千代田區',
  toshima: '豐島區',
  sumida: '墨田區',
  koto: '江東區',
  nakagyo: '中京區',
  'nakagyo ward': '中京區',
  shimogyo: '下京區',
  'shimogyo ward': '下京區',
  higashiyama: '東山區',
  'higashiyama ward': '東山區',
  sakyo: '左京區',
  'sakyo ward': '左京區',
  ukyo: '右京區',
  'ukyo ward': '右京區',
  fushimi: '伏見區',
  'fushimi ward': '伏見區',
  kamigyo: '上京區',
  'kamigyo ward': '上京區',
  kita: '北區',
  'kita ward': '北區',
  naniwa: '浪速區',
  'naniwa ward': '浪速區',
  tennoji: '天王寺區',
  umeda: '梅田',
  namba: '難波',
  shinsaibashi: '心齋橋',
  dotonbori: '道頓堀',
  gion: '祇園',
  arashiyama: '嵐山',
  asakusa: '淺草',
  ginza: '銀座',
  akihabara: '秋葉原',
  ikebukuro: '池袋',
  ximending: '西門町',
  datong: '大同區',
  'datong district': '大同區',
  wanhua: '萬華區',
  'wanhua district': '萬華區',
  zhongshan: '中山區',
  'zhongshan district': '中山區',
  daan: '大安區',
  'da’an district': '大安區',
  xinyi: '信義區',
  'xinyi district': '信義區',
};

function translateTermToZh(raw: string): string {
  if (!raw) return '';
  let text = raw.trim();
  const lower = text.toLowerCase();
  if (BUILTIN_CITY_AREA_TRANSLATIONS[lower]) {
    return BUILTIN_CITY_AREA_TRANSLATIONS[lower];
  }
  Object.entries(BUILTIN_CITY_AREA_TRANSLATIONS).forEach(([enKey, zhVal]) => {
    if (text.toLowerCase() === enKey) {
      text = zhVal;
    }
  });
  return text;
}

/**
 * 1:1 對應 Amazing Location PWA 的 getCountryCityArea 分類演算法
 */
export function extractCountryCityArea(
  components: { longText: string; types?: string[] }[] = [],
  formattedAddress = ''
): { country: string; city: string; area: string } {
  const safeComponents = Array.isArray(components) ? components : [];

  const rawCountry =
    safeComponents.find((c) => c.types?.includes('country'))?.longText || '';

  let rawCity =
    safeComponents.find(
      (c) =>
        c.types?.includes('administrative_area_level_1') ||
        c.types?.includes('locality')
    )?.longText || '';

  // 嚴格對應 Amazing Location 的區域優先層級：sublocality_level_1 -> sublocality_level_2 -> neighborhood -> administrative_area_level_2 -> administrative_area_level_3
  let rawArea =
    safeComponents.find((c) => c.types?.includes('sublocality_level_1'))?.longText ||
    safeComponents.find((c) => c.types?.includes('sublocality_level_2'))?.longText ||
    safeComponents.find((c) => c.types?.includes('neighborhood'))?.longText ||
    safeComponents.find((c) => c.types?.includes('administrative_area_level_2'))?.longText ||
    safeComponents.find((c) => c.types?.includes('administrative_area_level_3'))?.longText ||
    '';

  // 若沒有 addressComponents，嘗試從 formattedAddress 擷取
  if (!rawCity && formattedAddress) {
    if (formattedAddress.includes('京都') || /kyoto/i.test(formattedAddress)) rawCity = '京都市';
    else if (formattedAddress.includes('大阪') || /osaka/i.test(formattedAddress)) rawCity = '大阪市';
    else if (formattedAddress.includes('東京') || /tokyo/i.test(formattedAddress)) rawCity = '東京都';
    else if (formattedAddress.includes('台北') || /taipei/i.test(formattedAddress)) rawCity = '台北市';
  }

  const normalizedCountry =
    rawCountry.includes('台灣') || rawCountry === 'Taiwan' || formattedAddress.includes('台灣')
      ? '🇹🇼 台灣'
      : rawCountry.includes('日本') || rawCountry === 'Japan' || formattedAddress.includes('日本')
      ? '🇯🇵 日本'
      : rawCountry.includes('韓國') || rawCountry === 'South Korea' || formattedAddress.includes('韓國')
      ? '🇰🇷 韓國'
      : rawCountry || '';

  const city = translateTermToZh(rawCity);
  const area = translateTermToZh(rawArea);

  return {
    country: normalizedCountry,
    city,
    area,
  };
}

/**
 * 將 Amazing Location 匯出的單筆 GooglePlace 物件無損轉換為 SavedDestination
 */
export function convertAmazingLocationItem(rawItem: any, idx: number): SavedDestination | null {
  if (!rawItem) return null;

  if (typeof rawItem === 'string') {
    const cleanName = rawItem.trim();
    if (!cleanName) return null;
    return {
      id: `import-str-${Date.now()}-${idx}`,
      name: cleanName,
      scheduled: null,
    };
  }

  const p =
    rawItem.meta && typeof rawItem.meta === 'object'
      ? { ...rawItem.meta, ...rawItem }
      : rawItem;

  const originalGoogleName = (
    p.displayName?.text ||
    (typeof p.displayName === 'string' ? p.displayName : '') ||
    p.name ||
    p.title ||
    p.placeName ||
    p.label ||
    ''
  ).trim();

  const customEditedName = typeof p.customName === 'string' ? p.customName.trim() : '';
  const primaryName = customEditedName || originalGoogleName || `匯入地點 #${idx + 1}`;

  const formattedAddress =
    p.formattedAddress ||
    p.formatted_address ||
    p.address ||
    p.vicinity ||
    p.shortFormattedAddress ||
    '';

  const addressComponents = Array.isArray(p.addressComponents)
    ? p.addressComponents
    : undefined;

  const autoHierarchy = extractCountryCityArea(addressComponents, formattedAddress);

  const finalCity =
    (typeof p.customCity === 'string' && p.customCity.trim()) ||
    autoHierarchy.city ||
    undefined;

  const finalArea =
    (typeof p.customArea === 'string' && p.customArea.trim()) ||
    autoHierarchy.area ||
    undefined;

  const finalTags = Array.isArray(p.customTags)
    ? p.customTags.map((t: any) => String(t).trim()).filter(Boolean)
    : typeof p.customTags === 'string' && p.customTags.trim()
    ? p.customTags
        .split(/[,，]/)
        .map((t: string) => t.trim())
        .filter(Boolean)
    : undefined;

  const lat =
    p.location?.latitude ??
    p.location?.lat ??
    p.geometry?.location?.lat ??
    p.lat ??
    p.latitude ??
    p.coords?.lat;
  const lng =
    p.location?.longitude ??
    p.location?.lng ??
    p.geometry?.location?.lng ??
    p.lng ??
    p.longitude ??
    p.coords?.lng;

  return {
    id: p.id || p.place_id || p.placeId || `import-${Date.now()}-${idx}`,
    name: originalGoogleName || primaryName,
    customName: customEditedName || undefined,
    customCity: finalCity,
    customArea: finalArea,
    customTags: finalTags && finalTags.length > 0 ? finalTags : undefined,
    country: autoHierarchy.country || undefined,
    addressComponents,
    formattedAddress,
    nationalPhoneNumber:
      p.nationalPhoneNumber ||
      p.internationalPhoneNumber ||
      p.formatted_phone_number ||
      p.phone ||
      p.tel ||
      '',
    rating: typeof p.rating === 'number' ? p.rating : Number(p.rating) || undefined,
    userRatingCount:
      typeof p.userRatingCount === 'number'
        ? p.userRatingCount
        : typeof p.user_ratings_total === 'number'
        ? p.user_ratings_total
        : undefined,
    location:
      typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)
        ? { lat, lng }
        : undefined,
    openNow:
      p.regularOpeningHours?.openNow ??
      p.currentOpeningHours?.openNow ??
      p.openNow,
    weekdayDescriptions: Array.isArray(p.regularOpeningHours?.weekdayDescriptions)
      ? p.regularOpeningHours.weekdayDescriptions
      : Array.isArray(p.currentOpeningHours?.weekdayDescriptions)
      ? p.currentOpeningHours.weekdayDescriptions
      : Array.isArray(p.weekdayDescriptions)
      ? p.weekdayDescriptions
      : Array.isArray(p.opening_hours?.weekday_text)
      ? p.opening_hours.weekday_text
      : undefined,
    scheduled: p.scheduled && typeof p.scheduled === 'object' ? p.scheduled : null,
    photoUrl: p.photoUrl || undefined,
    photoBadge: p.photoBadge || undefined,
  };
}

/**
 * 檢查同網域 LocalStorage 是否有 Amazing Location 儲存的 `amazing_locations`
 */
export function readSameOriginAmazingLocations(): any[] {
  try {
    const raw = localStorage.getItem('amazing_locations');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
