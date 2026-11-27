import React, { useState, useMemo } from 'react';
import {
  Search,
  X,
  PlaneTakeoff,
  PlaneLanding,
  Building2,
  Check,
  Sparkles,
  Loader2,
  MapPin,
} from 'lucide-react';
import { AIRPORTS_BY_COUNTRY, type AirportItem } from '../airports.js';
import type { FlightLeg, TransportMode } from '../types/tabi';
import {
  lookupFlightByNumber,
  calculateFlightDuration,
  formatFlightDateLabel,
} from '../utils/flightLookup';
import {
  LAND_HUBS_BY_REGION,
  QUICK_LAND_ROUTES,
  TRANSPORT_MODE_META,
  calculateLandTravelDuration,
  getLegTransportMode,
  type LandHubItem,
  type QuickLandRoutePreset,
} from '../utils/landTransportPresets';

export interface AirportTargetSlot {
  leg: 'outbound' | 'inbound';
  direction: 'depart' | 'arrive';
}

interface AirportSearchModalProps {
  open: boolean;
  initialSlot: AirportTargetSlot;
  outbound: FlightLeg;
  inbound: FlightLeg;
  startDate?: string;
  endDate?: string;
  airlineLabel: string;
  onSelectAirport: (
    leg: 'outbound' | 'inbound',
    direction: 'depart' | 'arrive',
    airport: AirportItem,
    country: string,
    selectedTerminal: string
  ) => void;
  onUpdateFlightMeta: (
    leg: 'outbound' | 'inbound',
    updates: Partial<FlightLeg>
  ) => void;
  onUpdateAirlineLabel: (label: string) => void;
  onChangeTransportMode?: (mode: TransportMode) => void;
  onApplyLandPreset?: (preset: QuickLandRoutePreset) => void;
  onClose: () => void;
}

const TERMINAL_OPTIONS = ['T1', 'T2', 'T3', "Int'l", 'Main'];
const ALL_MODES: TransportMode[] = ['flight', 'hsr', 'bus', 'car', 'ferry'];

export const AirportSearchModal: React.FC<AirportSearchModalProps> = ({
  open,
  initialSlot,
  outbound,
  inbound,
  startDate,
  endDate,
  airlineLabel,
  onSelectAirport,
  onUpdateFlightMeta,
  onUpdateAirlineLabel,
  onChangeTransportMode,
  onApplyLandPreset,
  onClose,
}) => {
  const [activeSlot, setActiveSlot] = useState<AirportTargetSlot>(initialSlot);
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState<string>('ALL');
  const [customTerminalMap, setCustomTerminalMap] = useState<Record<string, string>>({});
  const [isLookingUpFlight, setIsLookingUpFlight] = useState(false);
  const [lookupFeedback, setLookupFeedback] = useState<string | null>(null);
  const [pairedReturnOffer, setPairedReturnOffer] = useState<{
    flightNo: string;
    updates: Partial<FlightLeg>;
  } | null>(null);

  // 自訂車站 / 口岸 / 上車點表單
  const [customHubCode, setCustomHubCode] = useState('');
  const [customHubCity, setCustomHubCity] = useState('');
  const [customHubTerminal, setCustomHubTerminal] = useState('');

  React.useEffect(() => {
    if (open) {
      setActiveSlot(initialSlot);
      setLookupFeedback(null);
      setPairedReturnOffer(null);
      setCountryFilter('ALL');
      setSearchQuery('');
    }
  }, [open, initialSlot]);

  const flattenedAirports = useMemo(() => {
    const list: {
      country: string;
      flag: string;
      airport: AirportItem;
      displayCode: string;
    }[] = [];
    AIRPORTS_BY_COUNTRY.forEach((group) => {
      group.airports.forEach((ap) => {
        list.push({
          country: group.country,
          flag: group.flag,
          airport: ap,
          displayCode: ap.displayCode || ap.code,
        });
      });
    });
    return list;
  }, []);

  const filteredAirports = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return flattenedAirports.filter((item) => {
      if (countryFilter !== 'ALL' && item.country !== countryFilter) {
        return false;
      }
      if (!q) return true;
      const haystack = `${item.country} ${item.displayCode} ${item.airport.code} ${item.airport.name} ${item.airport.enName} ${item.airport.terminal}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [flattenedAirports, searchQuery, countryFilter]);

  const flattenedLandHubs = useMemo(() => {
    const list: { region: string; flag: string; hub: LandHubItem }[] = [];
    LAND_HUBS_BY_REGION.forEach((grp) => {
      grp.hubs.forEach((hub) => {
        list.push({ region: grp.region, flag: grp.flag, hub });
      });
    });
    return list;
  }, []);

  const currentLegObj = activeSlot.leg === 'outbound' ? outbound : inbound;
  const activeMode = getLegTransportMode(currentLegObj);
  const modeMeta = TRANSPORT_MODE_META[activeMode];
  const isFlightMode = activeMode === 'flight';

  const filteredLandHubs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return flattenedLandHubs.filter((item) => {
      if (countryFilter !== 'ALL' && item.region !== countryFilter) {
        return false;
      }
      if (!q) return true;
      const hay = `${item.region} ${item.hub.code} ${item.hub.name} ${item.hub.cityLabel} ${item.hub.terminal} ${item.hub.country}`.toLowerCase();
      return hay.includes(q);
    });
  }, [flattenedLandHubs, searchQuery, countryFilter]);

  if (!open) return null;

  const currentSelectedCode =
    activeSlot.direction === 'depart'
      ? currentLegObj.departCode
      : currentLegObj.arriveCode;
  const currentSelectedTerminal =
    activeSlot.direction === 'depart'
      ? currentLegObj.departTerminal || 'T1'
      : currentLegObj.arriveTerminal || 'T1';

  const handleSelectLandHub = (hub: LandHubItem) => {
    if (activeSlot.direction === 'depart') {
      onUpdateFlightMeta(activeSlot.leg, {
        departCountry: hub.country,
        departCode: hub.code,
        departCity: hub.cityLabel,
        departTerminal: hub.terminal,
      });
    } else {
      onUpdateFlightMeta(activeSlot.leg, {
        arriveCountry: hub.country,
        arriveCode: hub.code,
        arriveCity: hub.cityLabel,
        arriveTerminal: hub.terminal,
      });
    }
    setLookupFeedback(
      `${modeMeta.icon} 已設定${activeSlot.leg === 'outbound' ? '去程' : '回程'}${
        activeSlot.direction === 'depart' ? '出發' : '抵達'
      }為「${hub.name}」`
    );
  };

  const handleApplyCustomHub = (e: React.FormEvent) => {
    e.preventDefault();
    const code = customHubCode.trim();
    const city = customHubCity.trim() || code;
    if (!code) return;

    const term = customHubTerminal.trim();
    if (activeSlot.direction === 'depart') {
      onUpdateFlightMeta(activeSlot.leg, {
        departCode: code,
        departCity: city,
        departTerminal: term,
      });
    } else {
      onUpdateFlightMeta(activeSlot.leg, {
        arriveCode: code,
        arriveCity: city,
        arriveTerminal: term,
      });
    }
    setLookupFeedback(
      `${modeMeta.icon} 已自訂${activeSlot.leg === 'outbound' ? '去程' : '回程'}${
        activeSlot.direction === 'depart' ? '出發' : '抵達'
      }站點：${code}`
    );
    setCustomHubCode('');
    setCustomHubCity('');
    setCustomHubTerminal('');
  };

  return (
    <div
      className="fixed inset-0 z-[210] bg-black/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[92vh] bg-[#F4FAF6] rounded-3xl shadow-2xl border border-[#CBE2D6] flex flex-col overflow-hidden text-[#162A22]"
      >
        {/* 頂部標題列 */}
        <div className="px-5 pt-4 pb-3 bg-white border-b border-[#DCEAE2] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-2xl bg-[#FCE1D6] text-[#C24726] flex items-center justify-center shrink-0 text-lg">
              {isFlightMode ? <PlaneTakeoff className="w-5 h-5" /> : <span>{modeMeta.icon}</span>}
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-extrabold text-[#14241D] truncate">
                {isFlightMode ? '國際機場與航廈設定器' : `陸路 / 海陸交通站點設定（${modeMeta.label}）`}
              </h3>
              <p className="text-[11px] text-[#5B7368] truncate">
                {isFlightMode
                  ? '搜尋機場代碼、切換航廈或輸入航班號自動帶入'
                  : '支援高鐵城軌、港珠澳金巴、跨境直通巴、自駕與客輪，亦可自訂口岸站名'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉視窗"
            className="w-9 h-9 rounded-full bg-[#EEF6F2] hover:bg-[#dcebe3] text-[#496357] flex items-center justify-center transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 交通工具模式切換列 (飛機 / 高鐵 / 巴士 / 自駕 / 船班) */}
        <div className="px-4 py-2 bg-[#F8FBF9] border-b border-[#DCEAE2] grid grid-cols-5 gap-1">
          {ALL_MODES.map((m) => {
            const meta = TRANSPORT_MODE_META[m];
            const active = activeMode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setCountryFilter('ALL');
                  setSearchQuery('');
                  setLookupFeedback(null);
                  if (onChangeTransportMode) {
                    onChangeTransportMode(m);
                  } else {
                    onUpdateFlightMeta(activeSlot.leg, { transportMode: m });
                  }
                }}
                className={`py-1.5 px-1 rounded-xl text-[11px] font-extrabold flex items-center justify-center gap-1 transition whitespace-nowrap ${
                  active
                    ? 'bg-[#1A5D42] text-white shadow-xs'
                    : 'bg-white text-[#3B594B] border border-[#DCEAE2] hover:bg-[#EAF4EF]'
                }`}
              >
                <span>{meta.icon}</span>
                <span>{meta.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* 選擇要設定的去程 / 回程站點槽位 */}
        <div className="px-4 py-2 bg-[#EAF4EF] border-b border-[#D6E8DF] grid grid-cols-4 gap-1.5">
          {[
            {
              leg: 'outbound' as const,
              direction: 'depart' as const,
              label: '去程出發',
              code: outbound.departCode,
              term: outbound.departTerminal,
            },
            {
              leg: 'outbound' as const,
              direction: 'arrive' as const,
              label: '去程抵達',
              code: outbound.arriveCode,
              term: outbound.arriveTerminal,
            },
            {
              leg: 'inbound' as const,
              direction: 'depart' as const,
              label: '回程出發',
              code: inbound.departCode,
              term: inbound.departTerminal,
            },
            {
              leg: 'inbound' as const,
              direction: 'arrive' as const,
              label: '回程抵達',
              code: inbound.arriveCode,
              term: inbound.arriveTerminal,
            },
          ].map((slot) => {
            const isActive =
              activeSlot.leg === slot.leg && activeSlot.direction === slot.direction;
            return (
              <button
                key={`${slot.leg}-${slot.direction}`}
                type="button"
                onClick={() => setActiveSlot({ leg: slot.leg, direction: slot.direction })}
                className={`p-2 rounded-2xl text-left transition border ${
                  isActive
                    ? 'bg-[#1A5D42] text-white border-[#1A5D42] shadow-xs'
                    : 'bg-white text-[#243E32] border-[#D8E8DF] hover:bg-[#F8FCFA]'
                }`}
              >
                <div className="text-[10px] font-bold opacity-85 flex items-center gap-1">
                  {isFlightMode ? (
                    slot.direction === 'depart' ? (
                      <PlaneTakeoff className="w-3 h-3 shrink-0" />
                    ) : (
                      <PlaneLanding className="w-3 h-3 shrink-0" />
                    )
                  ) : (
                    <MapPin className="w-3 h-3 shrink-0" />
                  )}
                  <span className="truncate">{slot.label}</span>
                </div>
                <div className="text-xs font-black mt-0.5 flex items-center justify-between gap-1">
                  <span className="truncate">{slot.code}</span>
                  {slot.term && (
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded-md font-bold shrink-0 max-w-[46px] truncate ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-[#E5F1EC] text-[#1A5D42]'
                      }`}
                    >
                      {slot.term}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* 搜尋輸入框 + 分類篩選 */}
        <div className="p-3.5 pb-2.5 bg-white border-b border-[#E2EFE8] space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 text-[#5B7368] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isFlightMode
                  ? '輸入機場名稱、城市、代碼 (如：桃園、TPE、羽田、KIX)...'
                  : '搜尋車站、口岸或碼頭 (如：珠海、拱北、金巴、西九龍、九洲港)...'
              }
              className="w-full pl-10 pr-9 py-2 rounded-2xl bg-[#EEF6F2] border border-[#CFE3D8] text-xs sm:text-sm font-bold text-[#14241D] placeholder:text-[#758C81] focus:outline-none focus:border-[#1A5D42] focus:bg-white transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#D5E6DD] text-[#2F4D3F] flex items-center justify-center text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            <button
              type="button"
              onClick={() => setCountryFilter('ALL')}
              className={`px-3 py-1 rounded-full text-xs font-extrabold shrink-0 transition ${
                countryFilter === 'ALL'
                  ? 'bg-[#C24726] text-white'
                  : 'bg-[#EEF6F2] text-[#355245] hover:bg-[#e0ede6]'
              }`}
            >
              🌍 全部 ({isFlightMode ? flattenedAirports.length : flattenedLandHubs.length})
            </button>
            {isFlightMode
              ? AIRPORTS_BY_COUNTRY.map((grp) => (
                  <button
                    key={grp.country}
                    type="button"
                    onClick={() => setCountryFilter(grp.country)}
                    className={`px-3 py-1 rounded-full text-xs font-extrabold shrink-0 transition ${
                      countryFilter === grp.country
                        ? 'bg-[#C24726] text-white'
                        : 'bg-[#EEF6F2] text-[#355245] hover:bg-[#e0ede6]'
                    }`}
                  >
                    {grp.flag} {grp.country.split(' ')[0]}
                  </button>
                ))
              : LAND_HUBS_BY_REGION.map((grp) => (
                  <button
                    key={grp.region}
                    type="button"
                    onClick={() => setCountryFilter(grp.region)}
                    className={`px-3 py-1 rounded-full text-xs font-extrabold shrink-0 transition ${
                      countryFilter === grp.region
                        ? 'bg-[#C24726] text-white'
                        : 'bg-[#EEF6F2] text-[#355245] hover:bg-[#e0ede6]'
                    }`}
                  >
                    {grp.flag} {grp.region.split(' ')[0]}
                  </button>
                ))}
          </div>
        </div>

        {/* 主列表區：飛機模式顯示機場清單；陸路/海陸模式顯示一鍵路線 + 車站口岸 + 自訂站名 */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 tabi-scroll">
          {!isFlightMode ? (
            <>
              {/* 一鍵套用熱門珠海 / 港珠澳 / 高鐵來回路線 */}
              {onApplyLandPreset && (
                <div className="bg-white rounded-2xl p-3 border border-[#DCEAE2] space-y-2">
                  <div className="text-[11.5px] font-extrabold text-[#1A5D42] flex items-center justify-between">
                    <span>⚡ 一鍵套用熱門來回路線（去程＋回程同步更新）</span>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {QUICK_LAND_ROUTES.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          onApplyLandPreset(preset);
                          setLookupFeedback(`✅ 已套用「${preset.title}」來回交通資訊！`);
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl bg-[#F4FAF6] hover:bg-[#E2F3EA] border border-[#D4E8DD] transition flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold text-[#14241D] truncate">
                            {preset.title}
                          </div>
                          <div className="text-[10.5px] text-[#547063] truncate">
                            {preset.subtitle}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-lg bg-[#1A5D42] text-white text-[10.5px] font-extrabold shrink-0">
                          套用
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 自訂車站 / 口岸 / 上車點 */}
              <form
                onSubmit={handleApplyCustomHub}
                className="bg-white rounded-2xl p-3 border border-[#DCEAE2] space-y-2"
              >
                <div className="text-[11.5px] font-extrabold text-[#14241D]">
                  ✏️ 手動輸入{activeSlot.leg === 'outbound' ? '去程' : '回程'}
                  {activeSlot.direction === 'depart' ? '出發站 / 上車點' : '抵達站 / 口岸'}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <input
                    type="text"
                    value={customHubCode}
                    onChange={(e) => setCustomHubCode(e.target.value)}
                    placeholder="簡稱 (如 珠海站)"
                    className="px-2.5 py-1.5 rounded-xl bg-[#F4FAF6] border border-[#CFE3D8] text-xs font-bold text-[#14241D]"
                  />
                  <input
                    type="text"
                    value={customHubCity}
                    onChange={(e) => setCustomHubCity(e.target.value)}
                    placeholder="全名/地點 (如 拱北)"
                    className="px-2.5 py-1.5 rounded-xl bg-[#F4FAF6] border border-[#CFE3D8] text-xs font-bold text-[#14241D]"
                  />
                  <input
                    type="text"
                    value={customHubTerminal}
                    onChange={(e) => setCustomHubTerminal(e.target.value)}
                    placeholder="口岸/月台 (選填)"
                    className="px-2.5 py-1.5 rounded-xl bg-[#F4FAF6] border border-[#CFE3D8] text-xs font-bold text-[#14241D]"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-1.5 rounded-xl bg-[#E3F1EC] hover:bg-[#1A5D42] hover:text-white text-[#144B34] text-xs font-extrabold transition"
                >
                  套用到「{activeSlot.leg === 'outbound' ? '去程' : '回程'}
                  {activeSlot.direction === 'depart' ? '出發' : '抵達'}」
                </button>
              </form>

              {/* 常用車站 / 口岸 / 碼頭列表 */}
              {filteredLandHubs.length === 0 ? (
                <div className="text-center py-6 bg-white rounded-2xl border border-dashed border-[#CBE2D6] text-xs text-[#647A70] font-bold">
                  找不到符合「{searchQuery}」的車站或口岸，可直接使用上方手動輸入自訂名稱。
                </div>
              ) : (
                filteredLandHubs.map(({ region, flag, hub }) => {
                  const isCurrentlySelected = currentSelectedCode === hub.code;
                  return (
                    <div
                      key={`${region}-${hub.code}`}
                      onClick={() => handleSelectLandHub(hub)}
                      className={`p-3 rounded-2xl bg-white border transition cursor-pointer flex items-center justify-between gap-3 ${
                        isCurrentlySelected
                          ? 'border-[#1A5D42] ring-2 ring-[#BCEAD5]'
                          : 'border-[#DCEAE2] hover:border-[#9CCAB3]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-lg bg-[#FCE1D6] text-[#B8431F] text-xs font-black">
                            {hub.code}
                          </span>
                          <span className="text-xs sm:text-sm font-extrabold text-[#14241D]">
                            {hub.name}
                          </span>
                          {hub.terminal && (
                            <span className="px-2 py-0.5 rounded-md bg-[#E5F2EC] text-[#186043] text-[10px] font-extrabold">
                              {hub.terminal}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#5A7066] mt-0.5">
                          {flag} {hub.country} · {hub.cityLabel}
                        </div>
                      </div>
                      <span
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold shrink-0 ${
                          isCurrentlySelected
                            ? 'bg-[#1A5D42] text-white'
                            : 'bg-[#E3F1EC] text-[#16533A]'
                        }`}
                      >
                        {isCurrentlySelected ? '已套用' : '選擇'}
                      </span>
                    </div>
                  );
                })
              )}
            </>
          ) : filteredAirports.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-[#CBE2D6] p-6">
              <div className="text-sm font-extrabold text-[#2D4A3E]">
                找不到符合「{searchQuery}」的機場
              </div>
              <p className="text-xs text-[#647A70] mt-1">
                請嘗試搜尋城市名稱（如：東京、台北、大阪、首爾）或三字代碼（HND、TPE、KIX）
              </p>
            </div>
          ) : (
            filteredAirports.map((item) => {
              const apKey = item.airport.code;
              const chosenTerm =
                customTerminalMap[apKey] || item.airport.terminal || 'T1';
              const isCurrentlySelected =
                currentSelectedCode === item.displayCode &&
                currentSelectedTerminal === chosenTerm;

              return (
                <div
                  key={apKey}
                  className={`p-3.5 rounded-2xl bg-white border transition shadow-2xs ${
                    isCurrentlySelected
                      ? 'border-[#1A5D42] ring-2 ring-[#BCEAD5]'
                      : 'border-[#DCEAE2] hover:border-[#9CCAB3]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className="min-w-0 flex-1 cursor-pointer"
                      onClick={() =>
                        onSelectAirport(
                          activeSlot.leg,
                          activeSlot.direction,
                          item.airport,
                          item.country,
                          chosenTerm
                        )
                      }
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-lg bg-[#FCE1D6] text-[#B8431F] text-xs font-black tracking-wide">
                          {item.displayCode}
                        </span>
                        <span className="text-sm font-extrabold text-[#14241D]">
                          {item.airport.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-[#E5F2EC] text-[#186043] text-[10.5px] font-extrabold flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          航廈: {chosenTerm}
                        </span>
                      </div>

                      <div className="text-xs text-[#5A7066] font-medium mt-1 flex items-center gap-2">
                        <span>
                          {item.flag} {item.country}
                        </span>
                        <span>·</span>
                        <span>{item.airport.enName}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onSelectAirport(
                          activeSlot.leg,
                          activeSlot.direction,
                          item.airport,
                          item.country,
                          chosenTerm
                        )
                      }
                      className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1 shrink-0 transition ${
                        isCurrentlySelected
                          ? 'bg-[#1A5D42] text-white'
                          : 'bg-[#E3F1EC] hover:bg-[#1A5D42] hover:text-white text-[#16533A]'
                      }`}
                    >
                      {isCurrentlySelected ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> 已套用
                        </>
                      ) : (
                        <>選擇此機場</>
                      )}
                    </button>
                  </div>

                  {/* 航廈快速切換列 (T1 / T2 / T3 / Int'l) */}
                  <div className="mt-2.5 pt-2 border-t border-[#EFF6F2] flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-[#5A7066]">
                      指定航廈 (Terminal)：
                    </span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {TERMINAL_OPTIONS.map((tOpt) => (
                        <button
                          key={tOpt}
                          type="button"
                          onClick={() => {
                            setCustomTerminalMap((prev) => ({
                              ...prev,
                              [apKey]: tOpt,
                            }));
                            onSelectAirport(
                              activeSlot.leg,
                              activeSlot.direction,
                              item.airport,
                              item.country,
                              tOpt
                            );
                          }}
                          className={`px-2 py-0.5 rounded-lg text-[10.5px] font-extrabold transition ${
                            chosenTerm === tOpt
                              ? 'bg-[#1A5D42] text-white'
                              : 'bg-[#EEF6F2] text-[#3B594B] hover:bg-[#dceddf]'
                          }`}
                        >
                          {tOpt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 底部當前去程/回程時間、班次號與營運商設定 */}
        <div className="p-4 bg-white border-t border-[#DCEAE2] space-y-2.5 overflow-hidden">
          <div className="flex items-center justify-between gap-2 text-xs font-extrabold text-[#1A5D42]">
            <span className="flex items-center gap-1 min-w-0 truncate">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {activeSlot.leg === 'outbound' ? '去程 (Outbound)' : '回程 (Return)'}{' '}
                {isFlightMode ? '時間與航班號設定' : `時間與${modeMeta.shortLabel}班次`}
              </span>
            </span>
            <input
              type="text"
              value={airlineLabel}
              onChange={(e) => onUpdateAirlineLabel(e.target.value)}
              placeholder={modeMeta.operatorPlaceholder}
              className="px-2.5 py-1 rounded-lg bg-[#F4FAF6] border border-[#DCEAE2] text-[11px] font-bold text-right w-40 sm:w-48 shrink-0"
            />
          </div>

          {/* 班次 / 航班號 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10.5px] font-bold text-[#5A7066]">
                {isFlightMode
                  ? '航班編號（輸入後點「自動帶入」可自動填寫起降機場與時間）'
                  : '車次 / 班次名稱 / 車牌備註'}
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={currentLegObj.flightNo}
                onChange={(e) => {
                  onUpdateFlightMeta(activeSlot.leg, { flightNo: e.target.value });
                  setLookupFeedback(null);
                }}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && isFlightMode) {
                    e.preventDefault();
                    setIsLookingUpFlight(true);
                    setPairedReturnOffer(null);
                    try {
                      const res = await lookupFlightByNumber(
                        currentLegObj.flightNo,
                        activeSlot.leg,
                        currentLegObj,
                        startDate,
                        endDate
                      );
                      onUpdateFlightMeta(activeSlot.leg, res.updates);
                      if (res.airlineLabel) {
                        onUpdateAirlineLabel(res.airlineLabel);
                      }
                      setLookupFeedback(res.message);
                      if (res.pairedReturnFlightNo && res.pairedReturnUpdates) {
                        setPairedReturnOffer({
                          flightNo: res.pairedReturnFlightNo,
                          updates: res.pairedReturnUpdates,
                        });
                      }
                    } finally {
                      setIsLookingUpFlight(false);
                    }
                  }
                }}
                placeholder={modeMeta.numberPlaceholder}
                className="flex-1 min-w-0 px-3 py-1.5 rounded-xl bg-[#F4FAF6] border border-[#DCEAE2] text-xs font-extrabold text-[#14241D]"
              />
              {isFlightMode && (
                <button
                  type="button"
                  disabled={isLookingUpFlight}
                  onClick={async () => {
                    setIsLookingUpFlight(true);
                    setPairedReturnOffer(null);
                    try {
                      const res = await lookupFlightByNumber(
                        currentLegObj.flightNo,
                        activeSlot.leg,
                        currentLegObj,
                        startDate,
                        endDate
                      );
                      onUpdateFlightMeta(activeSlot.leg, res.updates);
                      if (res.airlineLabel) {
                        onUpdateAirlineLabel(res.airlineLabel);
                      }
                      setLookupFeedback(res.message);
                      if (res.pairedReturnFlightNo && res.pairedReturnUpdates) {
                        setPairedReturnOffer({
                          flightNo: res.pairedReturnFlightNo,
                          updates: res.pairedReturnUpdates,
                        });
                      }
                    } finally {
                      setIsLookingUpFlight(false);
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#E3F2EA] hover:bg-[#CFE8DB] text-[#165C3E] text-xs font-extrabold flex items-center gap-1.5 shrink-0 transition disabled:opacity-50"
                >
                  {isLookingUpFlight ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>🔍</span>
                  )}
                  <span>{isLookingUpFlight ? '查詢中...' : '自動帶入'}</span>
                </button>
              )}
            </div>

            {lookupFeedback && (
              <div className="mt-1.5 px-2.5 py-1.5 rounded-xl bg-[#EAF4EF] border border-[#CFE3D8] text-[11px] font-bold text-[#1A5D42] flex items-center justify-between gap-2 flex-wrap">
                <span>{lookupFeedback}</span>
                {pairedReturnOffer && (
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateFlightMeta('inbound', pairedReturnOffer.updates);
                      setLookupFeedback(
                        `✅ 已同步帶入回程航班 ${pairedReturnOffer.flightNo} 與回程日期！`
                      );
                      setPairedReturnOffer(null);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-[#1A5D42] text-white text-[10.5px] font-extrabold hover:bg-[#134631] transition shrink-0"
                  >
                    ✨ 同步帶入回程 ({pairedReturnOffer.flightNo})
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 出發與抵達時間（依模式自動計算真實車程／航程） */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="min-w-0">
              <label className="text-[10.5px] font-bold text-[#5A7066] block mb-0.5">
                {modeMeta.departTimeLabel} ({currentLegObj.departCode})
              </label>
              <input
                type="time"
                value={currentLegObj.departTime}
                onChange={(e) => {
                  const nextDepart = e.target.value;
                  const nextDuration = isFlightMode
                    ? calculateFlightDuration(
                        nextDepart,
                        currentLegObj.arriveTime,
                        currentLegObj.departCode,
                        currentLegObj.arriveCode
                      )
                    : calculateLandTravelDuration(
                        nextDepart,
                        currentLegObj.arriveTime,
                        activeMode
                      );
                  const dateLabel = formatFlightDateLabel(
                    activeSlot.leg === 'outbound' ? startDate : endDate,
                    activeSlot.leg
                  );
                  onUpdateFlightMeta(activeSlot.leg, {
                    departTime: nextDepart,
                    duration: nextDuration,
                    ...(dateLabel ? { dateLabel } : {}),
                  });
                }}
                className="w-full max-w-full min-w-0 block px-2.5 py-1.5 rounded-xl bg-[#F4FAF6] border border-[#DCEAE2] text-xs font-bold"
              />
            </div>
            <div className="min-w-0">
              <label className="text-[10.5px] font-bold text-[#5A7066] block mb-0.5">
                {modeMeta.arriveTimeLabel} ({currentLegObj.arriveCode})
              </label>
              <input
                type="time"
                value={currentLegObj.arriveTime}
                onChange={(e) => {
                  const nextArrive = e.target.value;
                  const nextDuration = isFlightMode
                    ? calculateFlightDuration(
                        currentLegObj.departTime,
                        nextArrive,
                        currentLegObj.departCode,
                        currentLegObj.arriveCode
                      )
                    : calculateLandTravelDuration(
                        currentLegObj.departTime,
                        nextArrive,
                        activeMode
                      );
                  const dateLabel = formatFlightDateLabel(
                    activeSlot.leg === 'outbound' ? startDate : endDate,
                    activeSlot.leg
                  );
                  onUpdateFlightMeta(activeSlot.leg, {
                    arriveTime: nextArrive,
                    duration: nextDuration,
                    ...(dateLabel ? { dateLabel } : {}),
                  });
                }}
                className="w-full max-w-full min-w-0 block px-2.5 py-1.5 rounded-xl bg-[#F4FAF6] border border-[#DCEAE2] text-xs font-bold"
              />
            </div>
          </div>

          {!isFlightMode && (
            <div>
              <label className="text-[10.5px] font-bold text-[#5A7066] block mb-0.5">
                備註 / 通關與座位提示
              </label>
              <input
                type="text"
                value={currentLegObj.perkLabel}
                onChange={(e) =>
                  onUpdateFlightMeta(activeSlot.leg, { perkLabel: e.target.value })
                }
                placeholder="例如：HK$65 · 過關後搭專車進珠海市區"
                className="w-full px-3 py-1.5 rounded-xl bg-[#F4FAF6] border border-[#DCEAE2] text-xs font-bold text-[#14241D]"
              />
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-2xl bg-[#1A5D42] hover:bg-[#134631] text-white font-extrabold text-sm transition"
          >
            {isFlightMode ? '完成機場與航班設定' : `完成${modeMeta.label}設定`}
          </button>
        </div>
      </div>
    </div>
  );
};
