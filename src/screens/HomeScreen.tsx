import { useMemo } from 'react';
import type { AppState } from '@/types';
import {
  computeSummary,
  fiscalYearRange,
  daysUntilGrant,
  daysUntilExpiry,
  computeCarryOverExpiryDate,
  effectiveCarriedOver,
} from '@/lib/calc';
import { formatDateJa } from '@/lib/date';
import { CalendarClock, AlertTriangle, ChevronRight, Calendar } from 'lucide-react';

interface Props {
  state: AppState;
  ready: boolean;
}

export function HomeScreen({ state, ready }: Props) {
  const today = new Date();
  const fy = useMemo(() => fiscalYearRange(state.settings), [state.settings]);
  // 初回レンダリングでは集計をスキップし、データ読込完了後に計算
  const summary = useMemo(() => (ready ? computeSummary(state) : {
    currentTotal: state.settings.currentYearDays,
    carriedTotal: effectiveCarriedOver(state),
    consumedCurrent: 0,
    consumedCarried: 0,
    remainingCurrent: state.settings.currentYearDays,
    remainingCarried: effectiveCarriedOver(state),
    totalRemaining: state.settings.currentYearDays + effectiveCarriedOver(state),
    totalDays: state.settings.currentYearDays,
    expiredTotal: 0,
  }), [state, ready]);
  const daysToGrant = useMemo(() => (ready ? daysUntilGrant(state.settings, today) : undefined), [state.settings, ready]);
  const daysToExpiry = useMemo(() => (ready ? daysUntilExpiry(state.settings, today, state) : undefined), [state, ready]);
  const expiryDate = useMemo(() => (ready ? computeCarryOverExpiryDate(state.settings, state) : undefined), [state, ready]);
  const totalPct =
    summary.totalDays > 0
      ? ((summary.totalDays - summary.totalRemaining) / summary.totalDays) * 100
      : 0;
  const consumed = summary.totalDays - summary.totalRemaining;
  const currentPct =
    summary.currentTotal > 0
      ? (summary.consumedCurrent / summary.currentTotal) * 100
      : 0;
  const carriedPct =
    summary.carriedTotal > 0
      ? (summary.consumedCarried / summary.carriedTotal) * 100
      : 0;

  const expiryWarningColor =
    daysToExpiry !== undefined
      ? daysToExpiry <= 30
        ? '#ff3b30'
        : daysToExpiry <= 90
        ? '#ff9500'
        : 'var(--text-primary)'
      : 'var(--text-primary)';

  return (
    <div className="px-4 min-w-0 screen-enter" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* 年度表示 */}
      <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
        {formatDateJa(fy.start)} 〜 {formatDateJa(fy.end)}
      </p>

      {/* 残り有給日数 — 主役カード */}
      <section
        className="rounded-[20px] overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
          padding: '12px 20px 12px',
        }}
      >
        {/* ラベル — 左上 */}
        <p
          className="text-[12px] font-medium"
          style={{ color: 'rgba(255,255,255,0.75)' }}
        >
          残り有給日数
        </p>

        {/* 数字 — 左寄せ */}
        <div className="flex items-baseline gap-1.5" style={{ marginTop: '2px' }}>
          <span
            className="font-bold tabular-nums leading-none tracking-tight"
            style={{ color: '#ffffff', fontSize: '60px', lineHeight: 1 }}
          >
            {summary.totalRemaining.toFixed(1)}
          </span>
          <span
            className="font-semibold"
            style={{ color: 'rgba(255,255,255,0.85)', fontSize: '20px' }}
          >
            日
          </span>
        </div>

        {/* プログレスバー — 数字のすぐ下 */}
        <div
          className="rounded-full overflow-hidden"
          style={{ height: '3px', background: 'rgba(255,255,255,0.22)', marginTop: '8px' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${totalPct}%`, background: 'rgba(255,255,255,0.9)' }}
          />
        </div>

        {/* 消化率 — バー下 左寄せ */}
        <p
          className="text-[11px]"
          style={{ color: 'rgba(255,255,255,0.65)', marginTop: '5px' }}
        >
          消化率 {totalPct.toFixed(0)}%
        </p>

        {/* 区切り線 */}
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.15)', margin: '8px 0 6px' }} />

        {/* 付与 | 消化 | 消化率 */}
        <div className="flex items-center" style={{ justifyContent: 'space-around' }}>
          <StatItem label="付与" value={`${summary.currentTotal.toFixed(1)}日`} />
          <div style={{ width: '1px', height: '22px', background: 'rgba(255,255,255,0.2)' }} />
          <StatItem label="消化" value={`${consumed.toFixed(1)}日`} />
          <div style={{ width: '1px', height: '22px', background: 'rgba(255,255,255,0.2)' }} />
          <StatItem label="消化率" value={`${totalPct.toFixed(0)}%`} />
        </div>
      </section>

      {/* 今年度有給 / 繰越有給 */}
      <section className="grid grid-cols-2" style={{ gap: '14px' }}>
        <SubCard
          label="今年度有給"
          value={summary.remainingCurrent}
          total={summary.currentTotal}
          pct={currentPct}
          accent="#0d9488"
        />
        <SubCard
          label="繰越有給"
          value={summary.remainingCarried}
          total={summary.carriedTotal}
          pct={carriedPct}
          accent="var(--text-secondary)"
        />
      </section>

      {/* 次回付与 / 次に失効 */}
      {(state.settings.nextGrantDate || expiryDate) && (
        <section className="grid grid-cols-2" style={{ gap: '14px' }}>
          {state.settings.nextGrantDate && daysToGrant !== undefined && (
            <InfoCard>
              <div className="flex items-center gap-1.5 mb-1.5">
                <CalendarClock className="w-[14px] h-[14px] shrink-0" style={{ color: '#0d9488' }} />
                <span className="text-[11px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
                  次回付与日まで
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>あと</span>
                <span
                  className="font-bold tabular-nums leading-none"
                  style={{ color: '#0d9488', fontSize: '26px' }}
                >
                  {daysToGrant}
                </span>
                <span className="text-[13px] font-medium" style={{ color: 'var(--text-secondary)' }}>日</span>
              </div>
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                {formatDateJa(state.settings.nextGrantDate)}
              </p>
            </InfoCard>
          )}
          {expiryDate && daysToExpiry !== undefined && (
            <InfoCard>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-[14px] h-[14px] shrink-0" style={{ color: expiryWarningColor }} />
                  <span className="text-[11px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
                    次に失効する有給
                  </span>
                </div>
                <ChevronRight className="w-[12px] h-[12px] shrink-0" style={{ color: 'var(--text-muted)' }} />
              </div>
              <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                繰越{' '}
                <span className="font-semibold" style={{ color: expiryWarningColor }}>
                  {effectiveCarriedOver(state).toFixed(1)}日
                </span>
              </p>
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                {formatDateJa(expiryDate)}
              </p>
              {daysToExpiry <= 90 && (
                <p className="text-[10px] mt-0.5" style={{ color: expiryWarningColor }}>
                  あと{daysToExpiry}日で失効
                </p>
              )}
            </InfoCard>
          )}
        </section>
      )}

      {/* 今年度の消化状況 — リスト形式 */}
      <section
        className="rounded-[18px]"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          boxShadow: '0 0.5px 2px rgba(0,0,0,0.04)',
          overflow: 'hidden',
        }}
      >
        <div className="flex items-center gap-2 px-5 pt-3 pb-2">
          <Calendar className="w-[15px] h-[15px]" style={{ color: 'var(--text-secondary)' }} />
          <h2 className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            今年度の消化状況
          </h2>
        </div>

        <ConsumptionRow
          label="今年度から消化"
          value={summary.consumedCurrent}
          color="#0d9488"
          showDivider
        />
        <ConsumptionRow
          label="繰越から消化"
          value={summary.consumedCarried}
          color="#ff9500"
          showDivider
        />

        {/* 区切り線 */}
        <div style={{ height: '1px', background: 'var(--border-default)', margin: '0 20px' }} />

        <ConsumptionRow
          label="合計消化"
          value={summary.consumedCurrent + summary.consumedCarried}
          color="var(--text-primary)"
          bold
        />
      </section>
    </div>
  );
}

/* ---- 内部コンポーネント ---- */

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.6)' }}>{label}</span>
      <span className="text-[13px] font-semibold" style={{ color: 'rgba(255,255,255,0.95)' }}>{value}</span>
    </div>
  );
}

function SubCard({
  label,
  value,
  total,
  pct,
  accent,
}: {
  label: string;
  value: number;
  total: number;
  pct: number;
  accent: string;
}) {
  return (
    <div
      className="rounded-[18px]"
      style={{
        background: '#242B36',
        border: '1px solid var(--border-default)',
        padding: '12px 14px 12px',
      }}
    >
      <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <div className="flex items-baseline gap-1 mt-1">
        <span
          className="font-bold tabular-nums leading-none"
          style={{ color: accent, fontSize: '32px' }}
        >
          {value.toFixed(1)}
        </span>
        <span className="text-[14px] font-medium" style={{ color: 'var(--text-muted)' }}>日</span>
      </div>
      <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
        / {total.toFixed(1)}日
      </p>
      <div
        className="rounded-full overflow-hidden mt-2"
        style={{ height: '3px', background: 'rgba(255,255,255,0.08)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%`, background: accent }}
        />
      </div>
    </div>
  );
}

function InfoCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-[18px]"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        boxShadow: '0 0.5px 2px rgba(0,0,0,0.04)',
        padding: '12px 14px 12px',
      }}
    >
      {children}
    </div>
  );
}

function ConsumptionRow({
  label,
  value,
  color,
  bold,
  showDivider,
}: {
  label: string;
  value: number;
  color: string;
  bold?: boolean;
  showDivider?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between"
      style={{ padding: '11px 20px' }}
    >
      <span
        className={`text-[14px]${bold ? ' font-semibold' : ''}`}
        style={{ color: bold ? 'var(--text-primary)' : 'var(--text-secondary)' }}
      >
        {label}
      </span>
      <div className="flex items-center gap-2">
        <span
          className={`tabular-nums text-[15px]${bold ? ' font-bold' : ' font-semibold'}`}
          style={{ color }}
        >
          {value.toFixed(1)}日
        </span>
        <ChevronRight className="w-[14px] h-[14px]" style={{ color: 'var(--text-muted)' }} />
      </div>
    </div>
  );
}
