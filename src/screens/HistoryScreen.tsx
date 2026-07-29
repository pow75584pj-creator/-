import { useMemo, useState } from 'react';
import type { LeaveRecord, SpecialLeaveRecord, SpecialLeaveType, ExpiryRecord, GrantRecord, Settings } from '@/types';
import { leaveLabel, leaveWeight, SPECIAL_LEAVE_COLORS } from '@/lib/storage';
import { formatDateJa } from '@/lib/date';
import { sortRecords, sortSpecialLeaveRecords, grantYearRanges, grantYearRangeForDate } from '@/lib/calc';
import { Pencil, Trash2, CalendarDays, Clock, Star, AlertTriangle, Gift, X, ChevronDown } from 'lucide-react';

interface Props {
  records: LeaveRecord[];
  expiryRecords: ExpiryRecord[];
  grantRecords: GrantRecord[];
  specialLeaveRecords: SpecialLeaveRecord[];
  specialLeaveTypes: SpecialLeaveType[];
  workingHours: number;
  settings: Settings;
  onEdit: (record: LeaveRecord) => void;
  onDelete: (id: string) => void;
  onEditSpecial: (record: SpecialLeaveRecord) => void;
  onDeleteSpecial: (id: string) => void;
  onDeleteExpiry: (id: string) => void;
  onDeleteGrant: (id: string) => void;
}

type UnifiedRecord =
  | { kind: 'paid'; rec: LeaveRecord }
  | { kind: 'grant'; rec: GrantRecord }
  | { kind: 'expiry'; rec: ExpiryRecord }
  | { kind: 'special'; rec: SpecialLeaveRecord; typeName: string; typeColor: string };

export function HistoryScreen({
  records,
  expiryRecords,
  grantRecords,
  specialLeaveRecords,
  specialLeaveTypes,
  workingHours,
  onEdit,
  onDelete,
  onEditSpecial,
  onDeleteSpecial,
  onDeleteExpiry,
  onDeleteGrant,
}: Props) {
  const [pendingDelete, setPendingDelete] = useState<{
    kind: 'paid' | 'grant' | 'expiry' | 'special';
    id: string;
  } | null>(null);

  function requestDelete(kind: 'paid' | 'grant' | 'expiry' | 'special', id: string) {
    setPendingDelete({ kind, id });
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    if (pendingDelete.kind === 'paid') onDelete(pendingDelete.id);
    else if (pendingDelete.kind === 'special') onDeleteSpecial(pendingDelete.id);
    else if (pendingDelete.kind === 'expiry') onDeleteExpiry(pendingDelete.id);
    else if (pendingDelete.kind === 'grant') onDeleteGrant(pendingDelete.id);
    setPendingDelete(null);
  }

  const sortedPaid = useMemo(() => sortRecords(records), [records]);
  const sortedSpecial = useMemo(() => sortSpecialLeaveRecords(specialLeaveRecords), [specialLeaveRecords]);

  const unified: UnifiedRecord[] = useMemo(() => {
    const paid: UnifiedRecord[] = sortedPaid.map((r) => ({ kind: 'paid' as const, rec: r }));
    const grant: UnifiedRecord[] = grantRecords.map((r) => ({ kind: 'grant' as const, rec: r }));
    const expiry: UnifiedRecord[] = expiryRecords.map((r) => ({ kind: 'expiry' as const, rec: r }));
    const special: UnifiedRecord[] = sortedSpecial.map((r) => {
      const t = specialLeaveTypes.find((tt) => tt.id === r.typeId);
      return {
        kind: 'special' as const,
        rec: r,
        typeName: t?.name ?? '不明',
        typeColor: t?.color ?? 'slate',
      };
    });
    return [...paid, ...grant, ...expiry, ...special].sort((a, b) => {
      const da = a.rec.date;
      const db = b.rec.date;
      if (da !== db) return da < db ? 1 : -1;
      return b.rec.createdAt - a.rec.createdAt;
    });
  }, [sortedPaid, grantRecords, expiryRecords, sortedSpecial, specialLeaveTypes]);

  // 付与日基準の年度でグルーピング（ホーム・統計と共通の年度判定ロジック）
  const yearGroups = useMemo(() => {
    const ranges = grantYearRanges(settings);
    const groups = ranges.map((r) => ({
      year: r.year,
      start: r.start,
      end: r.end,
      items: [] as UnifiedRecord[],
      subtotal: 0,
    }));
    const byYear = new Map(groups.map((g) => [g.year, g]));
    for (const item of unified) {
      const r = grantYearRangeForDate(settings, item.rec.date);
      let g = byYear.get(r.year);
      if (!g) {
        g = { year: r.year, start: r.start, end: r.end, items: [], subtotal: 0 };
        byYear.set(r.year, g);
        groups.push(g);
      }
      g.items.push(item);
      if (item.kind === 'paid') {
        g.subtotal += leaveWeight(item.rec.type, item.rec.hours, workingHours);
      } else if (item.kind === 'special') {
        g.subtotal += item.rec.days;
      }
    }
    return groups.sort((a, b) => b.year - a.year);
  }, [unified, settings, workingHours]);

  // 初期状態は最新年度のみ展開
  const [openYears, setOpenYears] = useState<Set<number>>(() => {
    if (yearGroups.length === 0) return new Set();
    return new Set([yearGroups[0].year]);
  });

  function toggleYear(year: number) {
    setOpenYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  }

  const totalPaid = useMemo(
    () => records.reduce((s, r) => s + leaveWeight(r.type, r.hours, workingHours), 0),
    [records, workingHours],
  );
  const totalSpecial = useMemo(
    () => specialLeaveRecords.reduce((s, r) => s + r.days, 0),
    [specialLeaveRecords],
  );

  function formatPeriod(start: string, end: string): string {
    const s = new Date(start + 'T00:00:00');
    const e = new Date(end + 'T00:00:00');
    return `${s.getFullYear()}/${s.getMonth() + 1}/${s.getDate()}〜${e.getFullYear()}/${e.getMonth() + 1}/${e.getDate()}`;
  }

  function renderRecord(item: UnifiedRecord) {
    if (item.kind === 'paid') {
      const r = item.rec;
      const days = leaveWeight(r.type, r.hours, workingHours);
      return (
        <li
          key={r.id}
          className="rounded-[20px] p-4"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: '0 0.5px 1px rgba(0,0,0,0.04)' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>{formatDateJa(r.date)}</span>
                <span
                  className="rounded-full px-2 py-0.5 text-[12px] font-medium"
                  style={{ background: 'rgba(13, 148, 136, 0.08)', color: '#0d9488' }}
                >
                  有給・{leaveLabel(r.type)}
                </span>
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <div className="rounded-[12px] px-3 py-2" style={{ background: 'var(--bg-subtle)' }}>
                  <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>取得区分</p>
                  <p className="text-[15px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {leaveLabel(r.type)}
                    {r.type === 'hourly' && (
                      <span className="ml-1 flex items-center gap-0.5" style={{ color: 'var(--text-muted)' }}>
                        <Clock className="w-3 h-3" />
                        {r.hours}h
                      </span>
                    )}
                  </p>
                </div>
                <div className="rounded-[12px] px-3 py-2" style={{ background: 'var(--bg-subtle)' }}>
                  <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>取得日数</p>
                  <p className="text-[15px] font-bold tabular-nums" style={{ color: '#0d9488' }}>{days.toFixed(3)} 日</p>
                </div>
              </div>
              {r.note && (
                <p
                  className="text-[13px] mt-2.5 rounded-[12px] px-3 py-2"
                  style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}
                >
                  {r.note}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <button
                onClick={() => onEdit(r)}
                className="p-2 active:scale-90 transition"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#0d9488')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                aria-label="編集"
              >
                <Pencil className="w-4.5 h-4.5" />
              </button>
              <button
                onClick={() => requestDelete('paid', r.id)}
                className="p-2 active:scale-90 transition"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#ff3b30')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                aria-label="削除"
              >
                <Trash2 className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        </li>
      );
    }

    if (item.kind === 'grant') {
      const r = item.rec;
      return (
        <li
          key={r.id}
          className="rounded-[20px] p-4"
          style={{ background: 'rgba(13, 148, 136, 0.06)', border: '1px solid rgba(13, 148, 136, 0.15)', boxShadow: '0 0.5px 1px rgba(0,0,0,0.04)' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>{formatDateJa(r.date)}</span>
                <span
                  className="rounded-full px-2 py-0.5 text-[12px] font-medium inline-flex items-center gap-1"
                  style={{ background: 'rgba(13, 148, 136, 0.1)', color: '#0d9488' }}
                >
                  <Gift className="w-3 h-3" />
                  有給付与
                </span>
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <div className="rounded-[12px] px-3 py-2" style={{ background: 'var(--bg-subtle)' }}>
                  <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>区分</p>
                  <p className="text-[15px] font-medium" style={{ color: 'var(--text-secondary)' }}>付与（自動反映）</p>
                </div>
                <div className="rounded-[12px] px-3 py-2" style={{ background: 'var(--bg-subtle)' }}>
                  <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>付与日数</p>
                  <p className="text-[15px] font-bold tabular-nums" style={{ color: '#0d9488' }}>+{r.days} 日</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <button
                onClick={() => requestDelete('grant', r.id)}
                className="p-2 active:scale-90 transition"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#ff3b30')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                aria-label="削除"
              >
                <Trash2 className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        </li>
      );
    }

    if (item.kind === 'expiry') {
      const r = item.rec;
      return (
        <li
          key={r.id}
          className="rounded-[20px] p-4"
          style={{ background: 'rgba(255, 59, 48, 0.06)', border: '1px solid rgba(255, 59, 48, 0.15)', boxShadow: '0 0.5px 1px rgba(0,0,0,0.04)' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>{formatDateJa(r.date)}</span>
                <span
                  className="rounded-full px-2 py-0.5 text-[12px] font-medium inline-flex items-center gap-1"
                  style={{ background: 'rgba(255, 59, 48, 0.1)', color: '#ff3b30' }}
                >
                  <AlertTriangle className="w-3 h-3" />
                  失効
                </span>
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <div className="rounded-[12px] px-3 py-2" style={{ background: 'var(--bg-subtle)' }}>
                  <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>区分</p>
                  <p className="text-[15px] font-medium" style={{ color: 'var(--text-secondary)' }}>失効（自動減算）</p>
                </div>
                <div className="rounded-[12px] px-3 py-2" style={{ background: 'var(--bg-subtle)' }}>
                  <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>失効日数</p>
                  <p className="text-[15px] font-bold tabular-nums" style={{ color: '#ff3b30' }}>{r.days} 日</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <button
                onClick={() => requestDelete('expiry', r.id)}
                className="p-2 active:scale-90 transition"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#ff3b30')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                aria-label="削除"
              >
                <Trash2 className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        </li>
      );
    }

    const r = item.rec;
    const color = SPECIAL_LEAVE_COLORS[item.typeColor] ?? SPECIAL_LEAVE_COLORS.slate;
    return (
      <li
        key={r.id}
        className="rounded-[20px] p-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: '0 0.5px 1px rgba(0,0,0,0.04)' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>{formatDateJa(r.date)}</span>
              <span
                className="rounded-full px-2 py-0.5 text-[12px] font-medium"
                style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}
              >
                <Star className="w-3 h-3 inline mr-0.5" style={{ color: color.dot }} />
                {item.typeName}
              </span>
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <div className="rounded-[12px] px-3 py-2" style={{ background: 'var(--bg-subtle)' }}>
                <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>取得区分</p>
                <p className="text-[15px] font-medium" style={{ color: 'var(--text-secondary)' }}>{item.typeName}</p>
              </div>
              <div className="rounded-[12px] px-3 py-2" style={{ background: 'var(--bg-subtle)' }}>
                <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>取得日数</p>
                <p className="text-[15px] font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{r.days.toFixed(1)} 日</p>
              </div>
            </div>
            {r.note && (
              <p
                className="text-[13px] mt-2.5 rounded-[12px] px-3 py-2"
                style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}
              >
                {r.note}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <button
              onClick={() => onEditSpecial(r)}
              className="p-2 active:scale-90 transition"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#0d9488')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              aria-label="編集"
            >
              <Pencil className="w-4.5 h-4.5" />
            </button>
            <button
              onClick={() => requestDelete('special', r.id)}
              className="p-2 active:scale-90 transition"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ff3b30')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              aria-label="削除"
            >
              <Trash2 className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <div className="pb-4 min-w-0">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[17px] font-semibold" style={{ color: 'var(--text-primary)' }}>履歴</h2>
        <div className="flex gap-3 text-[13px]">
          <span style={{ color: 'var(--text-muted)' }}>有給 {totalPaid.toFixed(3)}日</span>
          <span style={{ color: 'var(--text-muted)' }}>|</span>
          <span style={{ color: 'var(--text-muted)' }}>特別 {totalSpecial.toFixed(1)}日</span>
        </div>
      </div>

      {unified.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20" style={{ color: 'var(--text-muted)' }}>
          <CalendarDays className="w-12 h-12 mb-3" />
          <p className="text-[13px]">まだ登録がありません</p>
        </div>
      ) : (
        <div className="space-y-4">
          {yearGroups.map((g) => {
            const isOpen = openYears.has(g.year);
            return (
              <section
                key={g.year}
                className="rounded-[20px] overflow-hidden"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: '0 0.5px 1px rgba(0,0,0,0.04)' }}
              >
                <button
                  onClick={() => toggleYear(g.year)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left active:scale-[0.99] transition"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[16px] font-semibold" style={{ color: 'var(--text-primary)' }}>{g.year}年度</span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[12px] font-medium tabular-nums"
                        style={{ background: 'rgba(13, 148, 136, 0.08)', color: '#0d9488' }}
                      >
                        小計 {Math.round(g.subtotal * 10) / 10}日
                      </span>
                    </div>
                    <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {formatPeriod(g.start, g.end)}
                    </p>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                    style={{ color: 'var(--text-muted)' }}
                  />
                </button>
                {isOpen && (
                  <ul className="px-3 pb-3 space-y-3">
                    {g.items.map(renderRecord)}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* 削除確認ダイアログ */}
      {pendingDelete && (
        <div className="fixed inset-0 z-30 flex items-center justify-center px-6 bg-black/40">
          <div className="rounded-[20px] p-6 max-w-sm w-full" style={{ background: 'var(--bg-card)', boxShadow: '0 0.5px 1px rgba(0,0,0,0.04)' }}>
            <div className="flex justify-center mb-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(255, 59, 48, 0.1)' }}>
                <AlertTriangle className="w-6 h-6" style={{ color: 'rgb(255, 59, 48)' }} />
              </div>
            </div>
            <h3 className="text-[17px] font-semibold text-center" style={{ color: 'var(--text-primary)' }}>記録を削除しますか？</h3>
            <p className="text-[15px] text-center mt-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              この操作は取り消せません。
            </p>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setPendingDelete(null)}
                className="btn-press flex-1 py-3 rounded-[14px] font-medium transition flex items-center justify-center gap-1.5"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
              >
                <X className="w-4 h-4" />
                キャンセル
              </button>
              <button
                onClick={confirmDelete}
                className="btn-press flex-1 py-3 rounded-[14px] font-medium transition flex items-center justify-center gap-1.5"
                style={{ background: 'rgb(255, 59, 48)', color: '#ffffff' }}
              >
                <Trash2 className="w-4 h-4" />
                削除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
