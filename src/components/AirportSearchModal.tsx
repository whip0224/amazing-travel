import React, { useState, useMemo } from 'react';
import {
  Search,
  X,
  PlaneTakeoff,
  PlaneLanding,
  Building2,
  Check,
  Sparkles,
} from 'lucide-react';
import { AIRPORTS_BY_COUNTRY, type AirportItem } from '../airports.js';
import type { FlightLeg } from '../types/tabi';

export interface AirportTargetSlot {
  leg: 'outbound' | 'inbound';
  direction: 'depart' | 'arrive';
}

interface AirportSearchModalProps {
  open: boolean;
  initialSlot: AirportTargetSlot;
  outbound: FlightLeg;
  inbound: FlightLeg;
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
  onClose: () => void;
}

const TERMINAL_OPTIONS = ['T1', 'T2', 'T3', "Int'l", 'Main'];

export const AirportSearchModal: React.FC<AirportSearchModalProps> = ({
  open,
  initialSlot,
  outbound,
  inbound,
  airlineLabel,
  onSelectAirport,
  onUpdateFlightMeta,
  onUpdateAirlineLabel,
  onClose,
}) => {
  const [activeSlot, setActiveSlot] = useState<AirportTargetSlot>(initialSlot);
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState<string>('ALL');
  const [customTerminalMap, setCustomTerminalMap] = useState<Record<string, string>>({});

  // Sync activeSlot when modal reopens with a specific slot
  React.useEffect(() => {
    if (open) {
      setActiveSlot(initialSlot);
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

  if (!open) return null;

  const currentLegObj = activeSlot.leg === 'outbound' ? outbound : inbound;
  const currentSelectedCode =
    activeSlot.direction === 'depart'
      ? currentLegObj.departCode
      : currentLegObj.arriveCode;
  const currentSelectedTerminal =
    activeSlot.direction === 'depart'
      ? currentLegObj.departTerminal || 'T1'
      : currentLegObj.arriveTerminal || 'T1';

  return (
    <div
      className="fixed inset-0 z-[210] bg-black/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[90vh] bg-[#F4FAF6] rounded-3xl shadow-2xl border border-[#CBE2D6] flex flex-col overflow-hidden text-[#162A22]"
      >
        {/* 頂部標題列 */}
        <div className="px-5 pt-4 pb-3 bg-white border-b border-[#DCEAE2] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-2xl bg-[#FCE1D6] text-[#C24726] flex items-center justify-center">
              <PlaneTakeoff className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-[#14241D]">
                國際機場與航廈搜尋選擇器
              </h3>
              <p className="text-[11px] text-[#5B7368]">
                即時搜尋機場名稱、IATA 代碼或航廈資訊並一鍵套用
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#EEF6F2] hover:bg-[#dcebe3] text-[#496357] flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 選擇要設定的航段位置 (去程出發 / 去程抵達 / 回程出發 / 回程抵達) */}
        <div className="px-4 py-2.5 bg-[#EAF4EF] border-b border-[#D6E8DF] grid grid-cols-4 gap-1.5">
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
                  {slot.direction === 'depart' ? (
                    <PlaneTakeoff className="w-3 h-3 shrink-0" />
                  ) : (
                    <PlaneLanding className="w-3 h-3 shrink-0" />
                  )}
                  <span className="truncate">{slot.label}</span>
                </div>
                <div className="text-xs font-black mt-0.5 flex items-center justify-between">
                  <span>{slot.code}</span>
                  {slot.term && (
                    <span
                      className={`text-[9.5px] px-1.5 py-0.2 rounded-md font-bold ${
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

        {/* 即時搜尋過濾輸入框 + 國家快速篩選 */}
        <div className="p-4 pb-2.5 bg-white border-b border-[#E2EFE8] space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-[#5B7368] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="輸入機場名稱、城市、代碼 (如：桃園、TPE、羽田、KIX、T2)..."
              className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-[#EEF6F2] border border-[#CFE3D8] text-sm font-bold text-[#14241D] placeholder:text-[#758C81] focus:outline-none focus:border-[#1A5D42] focus:bg-white transition"
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

          {/* 國家篩選膠囊 */}
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
              🌍 全部 ({flattenedAirports.length})
            </button>
            {AIRPORTS_BY_COUNTRY.map((grp) => (
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
            ))}
          </div>
        </div>

        {/* 即時過濾的國際機場與航廈清單 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 tabi-scroll">
          {filteredAirports.length === 0 ? (
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

        {/* 底部當前航段時間與航班號微調列 */}
        <div className="p-4 bg-white border-t border-[#DCEAE2] space-y-2.5">
          <div className="flex items-center justify-between text-xs font-extrabold text-[#1A5D42]">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              {activeSlot.leg === 'outbound' ? '去程 (Outbound)' : '回程 (Return)'} 時間與航班號設定
            </span>
            <input
              type="text"
              value={airlineLabel}
              onChange={(e) => onUpdateAirlineLabel(e.target.value)}
              placeholder="航空公司 (如 ANA · Economy)"
              className="px-2.5 py-1 rounded-lg bg-[#F4FAF6] border border-[#DCEAE2] text-[11px] font-bold text-right w-40"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10.5px] font-bold text-[#5A7066]">起飛時間</label>
              <input
                type="time"
                value={currentLegObj.departTime}
                onChange={(e) =>
                  onUpdateFlightMeta(activeSlot.leg, { departTime: e.target.value })
                }
                className="w-full px-2.5 py-1.5 rounded-xl bg-[#F4FAF6] border border-[#DCEAE2] text-xs font-bold mt-0.5"
              />
            </div>
            <div>
              <label className="text-[10.5px] font-bold text-[#5A7066]">抵達時間</label>
              <input
                type="time"
                value={currentLegObj.arriveTime}
                onChange={(e) =>
                  onUpdateFlightMeta(activeSlot.leg, { arriveTime: e.target.value })
                }
                className="w-full px-2.5 py-1.5 rounded-xl bg-[#F4FAF6] border border-[#DCEAE2] text-xs font-bold mt-0.5"
              />
            </div>
            <div>
              <label className="text-[10.5px] font-bold text-[#5A7066]">航班編號</label>
              <input
                type="text"
                value={currentLegObj.flightNo}
                onChange={(e) =>
                  onUpdateFlightMeta(activeSlot.leg, { flightNo: e.target.value })
                }
                className="w-full px-2.5 py-1.5 rounded-xl bg-[#F4FAF6] border border-[#DCEAE2] text-xs font-bold mt-0.5"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-2xl bg-[#1A5D42] hover:bg-[#134631] text-white font-extrabold text-sm transition"
          >
            完成機場與航班設定
          </button>
        </div>
      </div>
    </div>
  );
};
