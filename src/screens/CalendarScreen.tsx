import { useMemo, useState } from 'react';
import type { AppState, LeaveRecord, LeaveType, SpecialLeaveRecord } from '@/types';
import { computeSummaryAtDate, computeSpecialLeaveSummary } from '@/lib/calc';
import { toDateStr } from '@/lib/date';
import { ChevronLeft, ChevronRight, CalendarDays, X, CircleDot } from 'lucide-react';

interface Props {
  state: AppState;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

type DayKind = 'full' | 'half' | 'quarter' | 'special';

interface DayCell {
  date: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  weekday: number;
  kind?: DayKind;
  records: { leave?: LeaveRecord; special?: SpecialLeaveRecord; typeName?: string }[];
}

const KIND_STYLE: Record<DayKind, { bg: string; dot: string; label: string }> = {
  full: { bg: '#0d9488', dot: '#0d9488', label: '全休' },
  half: { bg: 'rgba(255, 149, 0, 0.75)', dot: 'rgba(255, 149, 0, 0.75)', label: '半休' },
  quarter: { bg: 'rgba(255, 149, 0, 0.45)', dot: 'rgba(255, 149, 0, 0.45)', label: '1/4休' },
  special: { bg: 'rgba(0, 199, 190, 0.75)', dot: 'rgba(0, 199, 190, 0.75)', label: '特別休暇' },
};

function leaveKind(rec: LeaveRecord): DayKind {
  if (rec.type === 'full') return 'full';
  if (rec.type === 'half' || rec.type === 'morning' || rec.type === 'afternoon') return 'half';
  if (rec.type === 'quarter') return 'quarter';
  // hourly → treat as quarter for color
  return 'quarter';
}

export function CalendarScreen({ state }: Props) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-based
  const [selected, setSelected] = useState<string | null>(null);

  const todayStr = toDateStr(today);

  // Build map: dateStr -> DayCell data
  const cellMap = useMemo(() => {
    const map = new Map<string, DayCell>();
    for (const rec of state.records) {
      let cell = map.get(rec.date);
      if (!cell) {
        const d = new Date(rec.date + 'T00:00:00');
        cell = { date: rec.date, day: d.getDate(), inMonth: true, isToday: rec.date === todayStr, weekday: d.getDay(), records: [] };
        map.set(rec.date, cell);
      }
      cell.records.push({ leave: rec });
      // priority: full > half > quarter
      const k = leaveKind(rec);
      if (!cell.kind || k === 'full') cell.kind = k;
      else if (k === 'half' && cell.kind === 'quarter') cell.kind = k;
    }
    for (const rec of state.specialLeaveRecords) {
      let cell = map.get(rec.date);
      if (!cell) {
        const d = new Date(rec.date + 'T00:00:00');
        cell = { date: rec.date, day: d.getDate(), inMonth: true, isToday: rec.date === todayStr, weekday: d.getDay(), records: [] };
        map.set(rec.date, cell);
      }
      const typeName = state.specialLeaveTypes.find((t) => t.id === rec.typeId)?.name;
      cell.records.push({ special: rec, typeName });
      if (!cell.kind) cell.kind = 'special';
    }
    return map;
  }, [state.records, state.specialLeaveRecords, state.specialLeaveTypes, todayStr]);

  // Build calendar grid (6 weeks)
  const grid = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const startOffset = first.getDay();
    const start = new Date(viewYear, viewMonth, 1 - startOffset);
    const cells: DayCell[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const ds = toDateStr(d);
      const inMonth = d.getMonth() === viewMonth;
      const existing = cellMap.get(ds);
      cells.push(
        existing
          ? { ...existing, inMonth, isToday: ds === todayStr, day: d.getDate(), weekday: d.getDay() }
          : { date: ds, day: d.getDate(), inMonth, isToday: ds === todayStr, weekday: d.getDay(), records: [] },
      );
    }
    return cells;
  }, [viewYear, viewMonth, cellMap, todayStr]);

  // Monthly summary — 残有給は表示中の月末時点で計算
  const monthSummary = useMemo(() => {
    const ym = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
    const monthLeaves = state.records.filter((r) => r.date.startsWith(ym));
    const monthSpecials = state.specialLeaveRecords.filter((r) => r.date.startsWith(ym));

    let consumedDays = 0;
    for (const r of monthLeaves) {
      if (r.type === 'full') consumedDays += 1;
      else if (r.type === 'half' || r.type === 'morning' || r.type === 'afternoon') consumedDays += 0.5;
      else if (r.type === 'quarter') consumedDays += 0.25;
      else if (r.type === 'hourly' && r.hours) consumedDays += r.hours / state.settings.workingHours;
    }
    const specialDays = monthSpecials.reduce((s, r) => s + r.days, 0);

    // 表示中の月末時点（または今日、今日の方が早ければ今日）を基準に残有給を計算
    const monthEnd = new Date(viewYear, viewMonth + 1, 0); // 0日 = 前月末 = 当月末
    const today = new Date();
    const ref = monthEnd < today ? monthEnd : today;
    const summary = computeSummaryAtDate(state, ref);
    const specialSummaries = computeSpecialLeaveSummary(state);
    const specialConsumedTotal = specialSummaries.reduce((s, x) => s + x.consumed, 0);

    return { consumedDays, specialDays, remaining: summary.totalRemaining, specialConsumedTotal };
  }, [state, viewYear, viewMonth]);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }
  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }
  function goToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  }

  const selectedCell = selected ? cellMap.get(selected) : undefined;

  return (
    <div className="pb-4 min-w-0" style={{ background: 'var(--bg-app)' }}>
      <h2
        className="text-[17px] font-semibold mb-4 flex items-center gap-2"
        style={{ color: 'var(--text-primary)' }}
      >
        <CalendarDays className="w-5 h-5" style={{ color: '#0d9488' }} />
        カレンダー
      </h2>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="btn-press flex items-center gap-0.5 px-3 py-2 rounded-[12px] text-[13px] transition"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
        >
          <ChevronLeft className="w-4 h-4" />
          前月
        </button>
        <div className="text-center">
          <p className="text-[15px] font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
            {viewYear}年 {viewMonth + 1}月
          </p>
        </div>
        <button
          onClick={nextMonth}
          className="btn-press flex items-center gap-0.5 px-3 py-2 rounded-[12px] text-[13px] transition"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
        >
          翌月
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <button
        onClick={goToday}
        className="btn-press w-full mb-4 py-2 rounded-[12px] text-[13px] font-medium transition"
        style={{ background: 'rgba(13, 148, 136, 0.08)', border: '1px solid rgba(13, 148, 136, 0.15)', color: '#0d9488' }}
      >
        今日へ戻る
      </button>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 mb-3 px-1">
        <LegendDot color="#0d9488" label="全休" />
        <LegendDot color="rgba(255, 149, 0, 0.75)" label="半休" />
        <LegendDot color="rgba(255, 149, 0, 0.45)" label="1/4休" />
        <LegendDot color="rgba(0, 199, 190, 0.75)" label="特別休暇" />
      </div>

      {/* Calendar grid */}
      <div className="rounded-[20px] p-2.5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: '0 0.5px 1px rgba(0,0,0,0.04)' }}>
        <div className="grid grid-cols-7 mb-1.5">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className="text-center text-[12px] font-medium py-1"
              style={{ color: i === 0 ? '#ff3b30' : i === 6 ? '#0a84ff' : 'var(--text-muted)' }}
            >
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px">
          {grid.map((cell, idx) => {
            const isSunday = cell.weekday === 0;
            const isSaturday = cell.weekday === 6;
            const kindStyle = cell.kind ? KIND_STYLE[cell.kind] : null;
            return (
              <button
                key={idx}
                onClick={() => cell.records.length > 0 && setSelected(cell.date)}
                className={`relative aspect-square flex flex-col items-center justify-center rounded-[12px] transition ${
                  !cell.inMonth ? 'opacity-30' : ''
                } ${cell.isToday ? 'ring-2' : ''} ${
                  cell.records.length > 0 ? 'active:scale-90' : ''
                }`}
                style={{
                  background: kindStyle ? kindStyle.bg : undefined,
                  color: kindStyle ? '#ffffff' : isSunday ? '#ff3b30' : isSaturday ? '#0a84ff' : 'var(--text-secondary)',
                  ...(cell.isToday ? { boxShadow: '0 0 0 2px #0d9488' } : {}),
                }}
              >
                <span className={`text-[13px] leading-none ${kindStyle ? 'font-bold' : ''}`}>{cell.day}</span>
                {cell.records.length > 1 && kindStyle && (
                  <span className="absolute top-0.5 right-1 w-1.5 h-1.5 rounded-full bg-white/80" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Monthly summary */}
      <div
        className="mt-5 rounded-[20px] p-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: '0 0.5px 1px rgba(0,0,0,0.04)' }}
      >
        <h2 className="text-[15px] font-semibold mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
          <CircleDot className="w-4 h-4" style={{ color: '#0d9488' }} />
          {viewMonth + 1}月の集計
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <SummaryCard label="取得日数" value={monthSummary.consumedDays.toFixed(1)} unit="日" accent="teal" />
          <SummaryCard label="残り有給" value={monthSummary.remaining.toFixed(1)} unit="日" accent="grey" />
          <SummaryCard
            label="特別休暇取得数"
            value={monthSummary.specialDays.toFixed(1)}
            unit="日"
            accent="grey"
            sub={`累計 ${monthSummary.specialConsumedTotal.toFixed(1)}日`}
          />
          <SummaryCard label="取得件数" value={String(grid.filter((c) => c.records.length > 0 && c.inMonth).length)} unit="件" accent="grey" />
        </div>
      </div>

      {/* Detail modal */}
      {selectedCell && selected && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-md rounded-t-[20px] sm:rounded-[20px] p-5 pb-8 animate-slide-up"
            style={{ background: 'var(--bg-card)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>{formatDateJa(selected)}</h3>
              <button onClick={() => setSelected(null)} className="p-1 -mr-1 active:scale-90 transition" style={{ color: 'var(--text-muted)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2.5">
              {selectedCell.records.map((r, i) => {
                const kind = r.leave ? leaveKind(r.leave) : 'special';
                const style = KIND_STYLE[kind];
                const days = r.leave
                  ? r.leave.type === 'full'
                    ? '1日'
                    : r.leave.type === 'half' || r.leave.type === 'morning' || r.leave.type === 'afternoon'
                      ? '0.5日'
                      : r.leave.type === 'quarter'
                        ? '0.25日'
                        : `${r.leave.hours ?? 0}時間`
                  : `${r.special!.days}日`;
                return (
                  <div
                    key={i}
                    className="flex gap-3 p-3 rounded-[14px]"
                    style={{ background: 'var(--bg-subtle)' }}
                  >
                    <span className="w-3 h-3 rounded-full shrink-0 mt-1" style={{ background: style.dot }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-medium" style={{ color: 'var(--text-primary)' }}>{r.typeName ?? style.label}</span>
                        <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>·</span>
                        <span className="text-[15px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>{days}</span>
                      </div>
                      {r.leave?.note && <p className="text-[13px] mt-1 leading-relaxed break-words" style={{ color: 'var(--text-muted)' }}>{r.leave.note}</p>}
                      {r.special?.note && <p className="text-[13px] mt-1 leading-relaxed break-words" style={{ color: 'var(--text-muted)' }}>{r.special.note}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </div>
  );
}

function SummaryCard({ label, value, unit, accent, sub }: { label: string; value: string; unit: string; accent: string; sub?: string }) {
  const isTeal = accent === 'teal';
  return (
    <div className="rounded-[14px] p-3" style={{ background: 'var(--bg-subtle)' }}>
      <p className="text-[12px] mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-[20px] font-bold tabular-nums" style={{ color: isTeal ? '#0d9488' : 'var(--text-primary)' }}>
        {value}
        <span className="text-[12px] font-normal ml-0.5" style={{ color: 'var(--text-muted)' }}>{unit}</span>
      </p>
      {sub && <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  );
}

function formatDateJa(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const w = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日(${w})`;
}
