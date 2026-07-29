import { useMemo } from 'react';
import type { AppState } from '@/types';
import { leaveWeight, SPECIAL_LEAVE_COLORS } from '@/lib/storage';
import { grantYearRange, computeSummary, computeSpecialLeaveSummary } from '@/lib/calc';
import { BarChart3, TrendingUp, CalendarDays, Award, Clock, Sparkles, StickyNote } from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  LabelList,
  CartesianGrid,
} from 'recharts';

interface Props {
  state: AppState;
  ready: boolean;
}

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

const EMPTY_STATS: Stats = {
  yearTaken: 0,
  monthTaken: 0,
  usageRate: 0,
  remaining: 0,
  yearGranted: 0,
  yearExpired: 0,
  specialTaken: [],
  monthly: new Array(12).fill(0),
  monthLabels: [],
  topMonth: null,
  topWeekday: null,
  monthlyAvg: 0,
  memoStats: { entries: [], topReason: null, reasonCount: 0, memoRate: 0 },
};

export function StatsScreen({ state, ready }: Props) {
  const stats = useMemo(() => (ready ? computeStats(state) : EMPTY_STATS), [state, ready]);
  const chartData = useMemo(
    () => stats.monthly.map((v, i) => ({ label: stats.monthLabels[i] ?? '', value: v })),
    [stats],
  );

  return (
    <div className="px-4 space-y-5 min-w-0 screen-enter">

      {/* サマリーカード群 */}
      <section className="grid grid-cols-2 gap-3">
        <StatCard icon={<CalendarDays className="w-4 h-4" />} label="今年取得" value={`${stats.yearTaken}日`} accent="teal" />
        <StatCard icon={<Clock className="w-4 h-4" />} label="今月取得" value={`${stats.monthTaken}日`} accent="teal" />
        <StatCard icon={<TrendingUp className="w-4 h-4" />} label="取得率" value={`${stats.usageRate}%`} accent="neutral" />
        <StatCard icon={<Award className="w-4 h-4" />} label="残り有給" value={`${stats.remaining}日`} accent="teal" />
        <StatCard icon={<Sparkles className="w-4 h-4" />} label="今年付与" value={`${stats.yearGranted}日`} accent="teal" />
        <StatCard icon={<Clock className="w-4 h-4" />} label="今年失効" value={`${stats.yearExpired}日`} accent="neutral" />
      </section>

      {/* 特別休暇取得 */}
      <section
        className="rounded-[20px] p-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: '0 0.5px 1px rgba(0,0,0,0.04)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Award className="w-4 h-4" style={{ color: '#0d9488' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>特別休暇取得</h2>
        </div>
        {stats.specialTaken.length === 0 ? (
          <p className="text-sm py-2" style={{ color: 'var(--text-muted)' }}>取得履歴がありません</p>
        ) : (
          <ul className="space-y-2">
            {stats.specialTaken.map((s) => {
              const colors = SPECIAL_LEAVE_COLORS[s.color] ?? SPECIAL_LEAVE_COLORS.slate;
              return (
                <li key={s.typeId} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                    {s.name}
                  </span>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>{s.days}日</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 月別取得日数グラフ */}
      <section
        className="rounded-[20px] p-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: '0 0.5px 1px rgba(0,0,0,0.04)' }}
      >
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4" style={{ color: '#0d9488' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>月別取得日数</h2>
        </div>
        <div style={{ width: '100%', height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 18, right: 8, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-default)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--border-default)' }}
                interval={0}
              />
              <YAxis
                allowDecimals
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                tickLine={false}
                axisLine={false}
                width={32}
              />
              <Tooltip
                cursor={{ fill: 'rgba(13, 148, 136, 0.06)' }}
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-card)',
                  fontSize: 13,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
                labelStyle={{ color: 'var(--text-secondary)', fontWeight: 600 }}
                formatter={(v: number) => [`${v}日`, '取得日数']}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={36}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.value > 0 ? '#0d9488' : 'var(--bg-subtle)'} />
                ))}
                <LabelList
                  dataKey="value"
                  position="top"
                  formatter={(v: number) => (v > 0 ? v : '')}
                  style={{ fontSize: 10, fill: 'var(--text-secondary)', fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 分析 */}
      <section
        className="rounded-[20px] p-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: '0 0.5px 1px rgba(0,0,0,0.04)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4" style={{ color: '#0d9488' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>分析</h2>
        </div>
        <ul className="space-y-3">
          <AnalysisRow label="一番休んだ月" value={stats.topMonth ?? '—'} />
          <AnalysisRow label="一番休んだ曜日" value={stats.topWeekday ?? '—'} />
          <AnalysisRow label="月平均取得日数" value={`${stats.monthlyAvg}日`} />
        </ul>
      </section>

      {/* メモ分析 */}
      <section
        className="rounded-[20px] p-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: '0 0.5px 1px rgba(0,0,0,0.04)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <StickyNote className="w-4 h-4" style={{ color: '#0d9488' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>メモ分析</h2>
        </div>
        {stats.memoStats.entries.length === 0 ? (
          <p className="text-sm py-2" style={{ color: 'var(--text-muted)' }}>メモの記録がありません</p>
        ) : (
          <>
            <ul className="space-y-2 mb-3">
              {stats.memoStats.entries.map((e, i) => (
                <li key={e.reason} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[15px]" style={{ color: 'var(--text-secondary)' }}>
                    {i === 0 ? (
                      <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(13, 148, 136, 0.12)', color: '#0d9488' }}>1位</span>
                    ) : i === 1 ? (
                      <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>2位</span>
                    ) : i === 2 ? (
                      <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>3位</span>
                    ) : (
                      <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>—</span>
                    )}
                    {e.reason}
                  </span>
                  <span className="text-[15px] font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>{e.count}回</span>
                </li>
              ))}
            </ul>
            <div className="pt-3 space-y-2.5" style={{ borderTop: '1px solid var(--border-default)' }}>
              <AnalysisRow label="一番多い休暇理由" value={stats.memoStats.topReason ?? '—'} />
              <AnalysisRow label="登録された理由数" value={`${stats.memoStats.reasonCount}種類`} />
              <AnalysisRow label="メモ入力率" value={`${stats.memoStats.memoRate}%`} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: 'teal' | 'neutral';
}) {
  const accentColor = accent === 'teal' ? '#0d9488' : 'var(--text-secondary)';
  return (
    <div
      className="rounded-[20px] p-3.5"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: '0 0.5px 1px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-center gap-1.5 mb-1.5" style={{ color: accentColor }}>
        {icon}
        <span className="text-[13px] font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      </div>
      <p className="text-[24px] font-bold tabular-nums" style={{ color: accentColor }}>{value}</p>
    </div>
  );
}

function AnalysisRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-[15px]" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</span>
    </li>
  );
}

interface Stats {
  yearTaken: number;
  monthTaken: number;
  usageRate: number;
  remaining: number;
  yearGranted: number;
  yearExpired: number;
  specialTaken: { typeId: string; name: string; color: string; days: number }[];
  monthly: number[]; // 年度開始月起点の12ヶ月
  monthLabels: string[]; // 年度開始月起点の月ラベル
  topMonth: string | null;
  topWeekday: string | null;
  monthlyAvg: number;
  memoStats: {
    entries: { reason: string; count: number }[];
    topReason: string | null;
    reasonCount: number;
    memoRate: number;
  };
}

function computeStats(state: AppState): Stats {
  // ホーム・履歴と共通の付与日基準年度を使用
  const { start, end } = grantYearRange(state.settings);
  const wh = state.settings.workingHours;
  const now = new Date();

  // ホーム画面と共通の有給計算サービスを使用
  const summary = computeSummary(state);

  // 今年取得 = 今年度消化 + 繰越消化（共通ロジックの値をそのまま使用）
  const yearTaken = summary.consumedCurrent + summary.consumedCarried;

  // 今月取得（月別集計は履歴から計算）
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const monthRecords = state.records.filter((r) => {
    const d = new Date(r.date + 'T00:00:00');
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });
  const monthTaken = monthRecords.reduce((sum, r) => sum + leaveWeight(r.type, r.hours, wh), 0);

  // 共通サマリーから取得
  const remaining = summary.totalRemaining;
  const totalGranted = summary.totalDays;
  const usageRate = totalGranted > 0 ? Math.round((summary.consumedCurrent + summary.consumedCarried) / totalGranted * 100) : 0;
  const yearGranted = summary.currentTotal;
  const yearExpired = summary.expiredTotal;

  const specialTaken = computeSpecialLeaveSummary(state)
    .filter((s) => s.consumed > 0)
    .map((s) => ({ typeId: s.type.id, name: s.type.name, color: s.type.color, days: s.consumed }));

  // 月別取得日数（年度開始月〜翌年同月前）— グラフ用の補助集計
  const fyRecords = state.records.filter((r) => r.date >= start && r.date <= end);
  const yearStartMonth = new Date(start + 'T00:00:00').getMonth();
  const monthLabels: string[] = [];
  for (let i = 0; i < 12; i++) {
    monthLabels.push(`${((yearStartMonth + i) % 12) + 1}月`);
  }
  const monthly: number[] = new Array(12).fill(0);
  for (const r of fyRecords) {
    const d = new Date(r.date + 'T00:00:00');
    let m = d.getMonth() - yearStartMonth;
    if (m < 0) m += 12;
    monthly[m] += leaveWeight(r.type, r.hours, wh);
  }
  const monthlyRounded = monthly.map((v) => Math.round(v * 10) / 10);

  // 一番休んだ月
  let topMonthIdx = -1;
  let topMonthVal = 0;
  monthly.forEach((v, i) => {
    if (v > topMonthVal) {
      topMonthVal = v;
      topMonthIdx = i;
    }
  });
  const topMonth = topMonthIdx >= 0 ? monthLabels[topMonthIdx] : null;

  // 一番休んだ曜日
  const weekdayCounts = new Array(7).fill(0);
  for (const r of fyRecords) {
    const d = new Date(r.date + 'T00:00:00');
    weekdayCounts[d.getDay()] += leaveWeight(r.type, r.hours, wh);
  }
  let topWeekdayIdx = -1;
  let topWeekdayVal = 0;
  weekdayCounts.forEach((v, i) => {
    if (v > topWeekdayVal) {
      topWeekdayVal = v;
      topWeekdayIdx = i;
    }
  });
  const topWeekday = topWeekdayIdx >= 0 ? `${WEEKDAY_LABELS[topWeekdayIdx]}曜日` : null;

  // 月平均取得日数
  const activeMonths = monthly.filter((v) => v > 0).length;
  const monthlyAvg = activeMonths > 0
    ? Math.round((monthly.reduce((a, b) => a + b, 0) / activeMonths) * 10) / 10
    : 0;

  // メモ分析（空欄は集計対象外、クイックボタンも通常メモも同一扱い）
  const memoCounts = new Map<string, number>();
  let memoFilled = 0;
  const allRecords = state.records;
  for (const r of allRecords) {
    const note = (r.note ?? '').trim();
    if (note) {
      memoFilled += 1;
      memoCounts.set(note, (memoCounts.get(note) ?? 0) + 1);
    }
  }
  const memoEntries = Array.from(memoCounts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason, 'ja'));
  const reasonCount = memoEntries.length;
  const topReasonEntry = memoEntries[0];
  const topReason = topReasonEntry ? `${topReasonEntry.reason}（${Math.round(topReasonEntry.count / memoFilled * 100)}%）` : null;
  const memoRate = allRecords.length > 0 ? Math.round((memoFilled / allRecords.length) * 100) : 0;

  return {
    yearTaken: Math.round(yearTaken * 10) / 10,
    monthTaken: Math.round(monthTaken * 10) / 10,
    usageRate,
    remaining: Math.round(remaining * 10) / 10,
    yearGranted,
    yearExpired,
    specialTaken,
    monthly: monthlyRounded,
    monthLabels,
    topMonth,
    topWeekday,
    monthlyAvg,
    memoStats: { entries: memoEntries, topReason, reasonCount, memoRate },
  };
}
