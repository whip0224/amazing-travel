import type { PlanActivity, StickerCategory, StickerItem } from '../types/tabi';

function makeSvgStickerDataUrl(svgInner: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
    <defs>
      <filter id="s" x="-15%" y="-15%" width="130%" height="130%">
        <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#3E2A20" flood-opacity="0.22"/>
      </filter>
    </defs>
    <g filter="url(#s)">
      <circle cx="64" cy="64" r="54" fill="#FFFFFF" />
      ${svgInner}
    </g>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const DEFAULT_STICKERS: StickerItem[] = [
  {
    id: 'stk-ramen',
    name: '職人拉麵丼飯',
    category: 'food',
    keywords: ['拉麵', '午餐', '晚餐', '丼飯', '豬排', '鰻魚', '美食', '餐廳', '市場', '早餐'],
    imageUrl: makeSvgStickerDataUrl(`
      <circle cx="64" cy="64" r="46" fill="#FBF2DF"/>
      <path d="M28 66 C28 89 44 102 64 102 C84 102 100 89 100 66 Z" fill="#C95A49" stroke="#3E2A20" stroke-width="3"/>
      <ellipse cx="64" cy="66" rx="36" ry="10" fill="#E8B968" stroke="#3E2A20" stroke-width="2.5"/>
      <path d="M44 63 Q54 55 64 63 Q74 70 84 62" fill="none" stroke="#FFF4D2" stroke-width="4" stroke-linecap="round"/>
      <circle cx="52" cy="59" r="7" fill="#FFFDF7" stroke="#3E2A20" stroke-width="2"/>
      <circle cx="52" cy="59" r="3" fill="#F29F3D"/>
      <line x1="74" y1="36" x2="96" y2="54" stroke="#5A3D2E" stroke-width="3.5" stroke-linecap="round"/>
      <line x1="82" y1="32" x2="100" y2="50" stroke="#5A3D2E" stroke-width="3.5" stroke-linecap="round"/>
    `),
  },
  {
    id: 'stk-matcha',
    name: '抹茶甜點午茶',
    category: 'cafe',
    keywords: ['抹茶', '咖啡', '甜點', '下午茶', '蛋糕', '聖代', 'Cafe', '泡芙', '冰'],
    imageUrl: makeSvgStickerDataUrl(`
      <circle cx="64" cy="64" r="46" fill="#E7F4EC"/>
      <path d="M42 74 L86 74 L76 100 L52 100 Z" fill="#FFFFFF" stroke="#3E2A20" stroke-width="3" stroke-linejoin="round"/>
      <ellipse cx="64" cy="68" rx="22" ry="11" fill="#4F9B76" stroke="#3E2A20" stroke-width="2.5"/>
      <circle cx="64" cy="54" r="14" fill="#6BB88E" stroke="#3E2A20" stroke-width="2.5"/>
      <circle cx="68" cy="41" r="6" fill="#D9534F" stroke="#3E2A20" stroke-width="2"/>
      <rect x="73" y="42" width="7" height="22" rx="2" transform="rotate(18 73 42)" fill="#D99B38" stroke="#3E2A20" stroke-width="2"/>
    `),
  },
  {
    id: 'stk-shrine',
    name: '神社古寺鳥居',
    category: 'shrine',
    keywords: ['神社', '寺', '清水寺', '神宮', '鳥居', '古街', '參拜', '祈福'],
    imageUrl: makeSvgStickerDataUrl(`
      <circle cx="64" cy="64" r="46" fill="#FCECE7"/>
      <path d="M26 42 Q64 49 102 42 L99 35 Q64 41 29 35 Z" fill="#C94A38" stroke="#3E2A20" stroke-width="2.5"/>
      <rect x="33" y="51" width="62" height="7" rx="2" fill="#D95E48" stroke="#3E2A20" stroke-width="2.5"/>
      <rect x="41" y="45" width="9" height="53" rx="2" fill="#D95E48" stroke="#3E2A20" stroke-width="2.5"/>
      <rect x="78" y="45" width="9" height="53" rx="2" fill="#D95E48" stroke="#3E2A20" stroke-width="2.5"/>
      <rect x="60" y="44" width="8" height="11" fill="#3E2A20"/>
    `),
  },
  {
    id: 'stk-shopping',
    name: '百貨逛街戰利品',
    category: 'shopping',
    keywords: ['逛街', '購物', '百貨', '藥妝', 'MALL', 'PARCO', '高島屋', '商店街', '伴手禮'],
    imageUrl: makeSvgStickerDataUrl(`
      <circle cx="64" cy="64" r="46" fill="#FDF2DC"/>
      <path d="M40 50 L88 50 L93 98 L35 98 Z" fill="#E37868" stroke="#3E2A20" stroke-width="3" stroke-linejoin="round"/>
      <path d="M51 50 C51 35 77 35 77 50" fill="none" stroke="#3E2A20" stroke-width="3.5" stroke-linecap="round"/>
      <rect x="49" y="64" width="30" height="20" rx="4" fill="#FFF7E8" stroke="#3E2A20" stroke-width="2"/>
      <path d="M56 74 L62 80 L73 69" fill="none" stroke="#4F9B96" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    `),
  },
  {
    id: 'stk-train',
    name: '鐵道特急電車',
    category: 'transport',
    keywords: ['地鐵', '電車', '特急', '新幹線', '巴士', 'JR', '交通', '車站'],
    imageUrl: makeSvgStickerDataUrl(`
      <circle cx="64" cy="64" r="46" fill="#E5EFF8"/>
      <rect x="38" y="34" width="52" height="58" rx="14" fill="#4F9B96" stroke="#3E2A20" stroke-width="3"/>
      <rect x="45" y="43" width="38" height="20" rx="5" fill="#EAF6FC" stroke="#3E2A20" stroke-width="2.2"/>
      <circle cx="49" cy="77" r="4.5" fill="#FDE68A" stroke="#3E2A20" stroke-width="2"/>
      <circle cx="79" cy="77" r="4.5" fill="#FDE68A" stroke="#3E2A20" stroke-width="2"/>
      <line x1="42" y1="98" x2="86" y2="98" stroke="#3E2A20" stroke-width="3" stroke-linecap="round"/>
    `),
  },
  {
    id: 'stk-camera',
    name: '風景打卡拍照',
    category: 'landmark',
    keywords: ['拍照', '夜景', '展望台', '城堡', '塔', '庭園', '公園', '老街', '打卡'],
    imageUrl: makeSvgStickerDataUrl(`
      <circle cx="64" cy="64" r="46" fill="#EFE8F4"/>
      <rect x="30" y="46" width="68" height="46" rx="10" fill="#5B7C99" stroke="#3E2A20" stroke-width="3"/>
      <path d="M48 46 L53 36 L75 36 L80 46 Z" fill="#D9C7AC" stroke="#3E2A20" stroke-width="2.5"/>
      <circle cx="64" cy="69" r="15" fill="#FFFDF8" stroke="#3E2A20" stroke-width="3"/>
      <circle cx="64" cy="69" r="8" fill="#2A3F54"/>
      <circle cx="85" cy="56" r="3.5" fill="#F7C948"/>
    `),
  },
  {
    id: 'stk-neko',
    name: '開運招財貓',
    category: 'decor',
    keywords: ['飯店', 'check in', '開運', '紀念', '自由', '日本', '必去'],
    imageUrl: makeSvgStickerDataUrl(`
      <circle cx="64" cy="64" r="46" fill="#FBF2DF"/>
      <path d="M40 50 L44 33 L56 44 L72 44 L84 33 L88 50 C92 64 90 96 64 96 C38 96 36 64 40 50 Z" fill="#FFFDF9" stroke="#3E2A20" stroke-width="3" stroke-linejoin="round"/>
      <path d="M47 64 Q52 60 56 64" fill="none" stroke="#3E2A20" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M72 64 Q76 60 81 64" fill="none" stroke="#3E2A20" stroke-width="2.5" stroke-linecap="round"/>
      <ellipse cx="64" cy="70" rx="3.5" ry="2.5" fill="#E37868"/>
      <rect x="46" y="77" width="36" height="7" rx="3" fill="#C95A49" stroke="#3E2A20" stroke-width="2"/>
      <circle cx="64" cy="84" r="6" fill="#F4C144" stroke="#3E2A20" stroke-width="2"/>
    `),
  },
  {
    id: 'stk-flight',
    name: '航空郵戳機票',
    category: 'decor',
    keywords: ['機場', '航班', '飛機', '登機', '出發', '回程', '桃園', '關西'],
    imageUrl: makeSvgStickerDataUrl(`
      <circle cx="64" cy="64" r="46" fill="#EAF4EF"/>
      <circle cx="64" cy="64" r="37" fill="none" stroke="#C95A49" stroke-width="2.5" stroke-dasharray="5 3"/>
      <path d="M38 66 L58 60 L66 40 L72 40 L69 60 L88 57 L92 52 L96 52 L93 61 L96 70 L92 70 L88 65 L69 67 L72 86 L66 86 L58 69 L38 71 Z" fill="#1A5D42"/>
    `),
  },
];

// 上傳自訂貼紙時保留 PNG 透明背景（自動縮放至最長邊 360px）
export async function compressStickerUpload(file: File, maxDim = 360): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('無法讀取貼紙圖片'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('貼紙圖片格式不支援'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('無法建立畫布處理貼紙'));
          return;
        }
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

// 離線或 AI 未指定時的智慧關鍵字貼紙保底匹配
export function pickFallbackStickerForActivity(
  act: PlanActivity,
  availableStickers: StickerItem[]
): StickerItem | null {
  if (availableStickers.length === 0) return null;
  const hay = `${act.title} ${act.kicker} ${act.location} ${act.note} ${act.transport || ''}`.toLowerCase();

  for (const stk of availableStickers) {
    if (stk.keywords?.some((kw) => hay.includes(kw.toLowerCase()))) {
      return stk;
    }
  }

  const guessCategory = (): StickerCategory => {
    if (/抹茶|咖啡|甜|茶|蛋糕|cafe|parfait/.test(hay)) return 'cafe';
    if (/麵|飯|食|餐|市場|燒|壽司|市場|breakfast|lunch|dinner/.test(hay)) return 'food';
    if (/寺|社|神宮|鳥居|祈/.test(hay)) return 'shrine';
    if (/買|逛|百貨|商場|藥妝|shop|mall/.test(hay)) return 'shopping';
    if (/鐵|車|機場|bus|train|subway/.test(hay)) return 'transport';
    return 'landmark';
  };

  const cat = guessCategory();
  return (
    availableStickers.find((s) => s.category === cat) ||
    availableStickers[0]
  );
}
