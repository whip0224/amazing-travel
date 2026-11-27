import type { StayInfo, TabiState } from '../types/tabi';

export function formatShortMd(dateIso?: string): string {
  if (!dateIso || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return '';
  const [, m, d] = dateIso.split('-');
  return `${m}/${d}`;
}

export function parseTimeFromCheckLabel(
  label?: string,
  fallbackTime = '15:00'
): string {
  if (!label) return fallbackTime;
  const ampm = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(label);
  if (ampm) {
    let hour = parseInt(ampm[1], 10);
    const min = ampm[2];
    const period = ampm[3].toUpperCase();
    if (period === 'PM' && hour < 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${min}`;
  }
  const hm = /(\d{1,2}):(\d{2})/.exec(label);
  if (hm) {
    return `${hm[1].padStart(2, '0')}:${hm[2]}`;
  }
  return fallbackTime;
}

export function formatStayCheckLabel(
  dateIso?: string,
  timeStr?: string,
  fallback = ''
): string {
  const md = formatShortMd(dateIso);
  const t = (timeStr || '').trim();
  if (md && t) return `${md} · ${t}`;
  if (md) return md;
  return fallback || t || '';
}

export function addDaysIso(dateIso: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return dateIso;
  const d = new Date(`${dateIso}T00:00:00`);
  if (isNaN(d.getTime())) return dateIso;
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getStayNights(
  stay?: Partial<Pick<StayInfo, 'checkInDate' | 'checkOutDate'>>
): number {
  const ci = stay?.checkInDate;
  const co = stay?.checkOutDate;
  if (!ci || !co || !/^\d{4}-\d{2}-\d{2}$/.test(ci) || !/^\d{4}-\d{2}-\d{2}$/.test(co)) {
    return 0;
  }
  const s = new Date(`${ci}T00:00:00`);
  const e = new Date(`${co}T00:00:00`);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
  const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

export function normalizeStayItem(
  raw: Partial<StayInfo> | undefined,
  index: number,
  tripStart?: string,
  tripEnd?: string
): StayInfo {
  const checkInDate =
    raw?.checkInDate && /^\d{4}-\d{2}-\d{2}$/.test(raw.checkInDate)
      ? raw.checkInDate
      : index === 0 && tripStart
      ? tripStart
      : '';
  const checkOutDate =
    raw?.checkOutDate && /^\d{4}-\d{2}-\d{2}$/.test(raw.checkOutDate)
      ? raw.checkOutDate
      : index === 0 && tripEnd
      ? tripEnd
      : checkInDate
      ? addDaysIso(checkInDate, 1)
      : '';

  const checkInTime = raw?.checkInTime || parseTimeFromCheckLabel(raw?.checkIn, '15:00');
  const checkOutTime = raw?.checkOutTime || parseTimeFromCheckLabel(raw?.checkOut, '11:00');

  const checkIn =
    checkInDate
      ? formatStayCheckLabel(checkInDate, checkInTime, raw?.checkIn)
      : raw?.checkIn || '15:00';
  const checkOut =
    checkOutDate
      ? formatStayCheckLabel(checkOutDate, checkOutTime, raw?.checkOut)
      : raw?.checkOut || '11:00';

  return {
    id: raw?.id || `stay-${index + 1}`,
    stars: typeof raw?.stars === 'number' ? raw.stars : 4,
    category: raw?.category || 'Hotel',
    hotelName: raw?.hotelName ?? '',
    subTitle: raw?.subTitle ?? '',
    tag1: raw?.tag1 ?? '',
    tag2: raw?.tag2 ?? '',
    checkIn,
    checkOut,
    checkInDate,
    checkOutDate,
    checkInTime,
    checkOutTime,
    address: raw?.address ?? '',
    insiderScoop: raw?.insiderScoop ?? '',
    paidStatus: raw?.paidStatus || 'Paid & Booked',
    photoUrl: raw?.photoUrl || '/assets/tabi/hotel_kyoto.png',
  };
}

export function normalizeStaysList(
  state: Pick<TabiState, 'stay' | 'stays' | 'trip'>
): StayInfo[] {
  const tripStart = state.trip?.startDate;
  const tripEnd = state.trip?.endDate;
  if (Array.isArray(state.stays) && state.stays.length > 0) {
    return state.stays.map((item, idx) =>
      normalizeStayItem(item, idx, idx === 0 ? tripStart : undefined, idx === 0 ? tripEnd : undefined)
    );
  }
  return [normalizeStayItem(state.stay, 0, tripStart, tripEnd)];
}

export function sortStaysByDate(stays: StayInfo[]): StayInfo[] {
  return stays
    .slice()
    .sort((a, b) => (a.checkInDate || '9999-99-99').localeCompare(b.checkInDate || '9999-99-99'));
}

export interface StayMatchResult {
  stay: StayInfo;
  index: number;
  status: 'staying' | 'checkout' | 'unassigned';
}

export function findStayForDate(stays: StayInfo[], dateIso?: string): StayMatchResult {
  if (!stays.length) {
    return {
      stay: normalizeStayItem(undefined, 0),
      index: 0,
      status: 'unassigned',
    };
  }
  if (!dateIso || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    return { stay: stays[0], index: 0, status: 'staying' };
  }

  // 1. 優先比對入住當晚：checkInDate <= dateIso < checkOutDate
  let stayingIdx = -1;
  stays.forEach((s, idx) => {
    const ci = s.checkInDate;
    const co = s.checkOutDate;
    if (!ci) return;
    if (co && ci <= dateIso && dateIso < co) {
      stayingIdx = idx;
    } else if (!co && ci === dateIso) {
      stayingIdx = idx;
    }
  });
  if (stayingIdx !== -1) {
    return { stay: stays[stayingIdx], index: stayingIdx, status: 'staying' };
  }

  // 2. 次優先比對退房日：dateIso === checkOutDate（例如旅程最後一天）
  const checkoutIdx = stays.findIndex((s) => s.checkOutDate === dateIso);
  if (checkoutIdx !== -1) {
    return { stay: stays[checkoutIdx], index: checkoutIdx, status: 'checkout' };
  }

  // 3. 若單間住宿尚未設定起訖日期，預設視為全行程住宿
  if (stays.length === 1 && !stays[0].checkInDate && !stays[0].checkOutDate) {
    return { stay: stays[0], index: 0, status: 'staying' };
  }

  // 4. 找不到精準日期時回退至最接近的住宿（提示尚未指派該晚）
  let fallbackIdx = 0;
  for (let i = 0; i < stays.length; i++) {
    if (stays[i].checkInDate && stays[i].checkInDate! <= dateIso) {
      fallbackIdx = i;
    }
  }
  return { stay: stays[fallbackIdx], index: fallbackIdx, status: 'unassigned' };
}
