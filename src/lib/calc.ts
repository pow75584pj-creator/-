import type { AppState, ExpiryRecord, GrantRecord, LeaveRecord, Settings, SpecialLeaveType, SpecialLeaveRecord } from '@/types';
import { leaveWeight, uid } from './storage';

// 年度開始日を基準に今年度の範囲を返す
export function fiscalYearRange(settings: Settings, ref = new Date()): { start: string; end: string } {
  const year = ref.getFullYear();
  const start = new Date(year, settings.fiscalYearStart.month - 1, settings.fiscalYearStart.day);
  if (ref < start) {
    start.setFullYear(year - 1);
  }
  const end = new Date(start);
  end.setFullYear(start.getFullYear() + 1);
  end.setDate(end.getDate() - 1);
  return { start: toStr(start), end: toStr(end) };
}

function toStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function inRange(dateStr: string, start: string, end: string): boolean {
  return dateStr >= start && dateStr <= end;
}

// ---- 付与日基準の年度（共通ロジック）----
// 初回付与日から毎年同月同日を年度開始日とし、年度開始日以上・次年度開始日前日までを同じ年度とする

// 指定日が属する付与年度の範囲を返す
export function grantYearRangeForDate(settings: Settings, date: string): { start: string; end: string; year: number } {
  if (!settings.firstGrantDate) {
    const r = fiscalYearRange(settings, new Date(date + 'T00:00:00'));
    return { start: r.start, end: r.end, year: new Date(r.start + 'T00:00:00').getFullYear() };
  }
  const base = new Date(settings.firstGrantDate + 'T00:00:00');
  const target = new Date(date + 'T00:00:00');
  let start = new Date(base);
  if (target < start) {
    // 初回付与日より前の日付は初回年度に含める
    const end = new Date(start);
    end.setFullYear(end.getFullYear() + 1);
    end.setDate(end.getDate() - 1);
    return { start: toStr(start), end: toStr(end), year: start.getFullYear() };
  }
  while (start <= target) {
    start.setFullYear(start.getFullYear() + 1);
  }
  start.setFullYear(start.getFullYear() - 1);
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 1);
  end.setDate(end.getDate() - 1);
  return { start: toStr(start), end: toStr(end), year: start.getFullYear() };
}

// 現在の付与年度の範囲を返す
export function grantYearRange(settings: Settings, ref = new Date()): { start: string; end: string; year: number } {
  return grantYearRangeForDate(settings, toStr(ref));
}

// すべての付与年度のリストを新しい順で返す（初回付与日〜現在まで）
export function grantYearRanges(settings: Settings, ref = new Date()): { start: string; end: string; year: number }[] {
  if (!settings.firstGrantDate) {
    const r = fiscalYearRange(settings, ref);
    return [{ start: r.start, end: r.end, year: new Date(r.start + 'T00:00:00').getFullYear() }];
  }
  const base = new Date(settings.firstGrantDate + 'T00:00:00');
  const today = new Date(toStr(ref) + 'T00:00:00');
  const ranges: { start: string; end: string; year: number }[] = [];
  let d = new Date(base);
  while (d <= today) {
    const start = toStr(d);
    const end = new Date(d);
    end.setFullYear(end.getFullYear() + 1);
    end.setDate(end.getDate() - 1);
    ranges.push({ start, end: toStr(end), year: d.getFullYear() });
    d.setFullYear(d.getFullYear() + 1);
  }
  return ranges.reverse();
}

// ---- 付与バケットモデル ----
// 各付与分を独立して管理し、付与日・日数・有効期限・消化量を追跡する

export interface GrantBucket {
  grantDate: string;
  days: number;
  expiryDate: string | undefined; // 付与から carryOverExpiryYears 年後（undefined = 期限なし）
  consumed: number;
  remaining: number;
  consumedWhileCurrent: number; // 次の付与日までの間（当年度）に消化した日数
  consumedWhileCarried: number; // 次の付与日以降（繰越期間）に消化した日数
  isCurrent: boolean; // 今年度の付与分か
  isExpired: boolean; // 有効期限切れか
}

// 初回付与日から基準日までのすべての付与日を生成（毎年同月同日）
function computeGrantDates(settings: Settings, ref = new Date()): string[] {
  if (!settings.firstGrantDate) return [];
  const dates: string[] = [];
  const today = new Date(toStr(ref) + 'T00:00:00');
  let d = new Date(settings.firstGrantDate + 'T00:00:00');
  while (d <= today) {
    dates.push(toStr(d));
    d.setFullYear(d.getFullYear() + 1);
  }
  return dates;
}

// すべての付与バケットを構築し、消化を割り当てる
export function buildGrantBuckets(state: AppState, ref = new Date()): GrantBucket[] {
  const settings = state.settings;
  const today = toStr(ref);
  const grantDates = computeGrantDates(settings, ref);

  const buckets: GrantBucket[] = grantDates.map((date) => {
    const record = (state.grantRecords ?? []).find((g) => g.date === date);
    const days = record ? record.days : grantDaysAtDate(settings, date);

    let expiryDate: string | undefined;
    if (settings.carryOverExpiryYears > 0) {
      const exp = new Date(date + 'T00:00:00');
      exp.setFullYear(exp.getFullYear() + settings.carryOverExpiryYears);
      expiryDate = toStr(exp);
    }

    const isExpired = expiryDate ? today >= expiryDate : false;
    return {
      grantDate: date,
      days,
      expiryDate,
      consumed: 0,
      remaining: days,
      consumedWhileCurrent: 0,
      consumedWhileCarried: 0,
      isCurrent: false,
      isExpired,
    };
  });

  // 各バケットの「当年度期間」の終わり（＝次の付与日）を事前計算
  const currentPeriodEnd = new Map<string, string>();
  for (let i = 0; i < buckets.length; i++) {
    if (i + 1 < buckets.length) {
      currentPeriodEnd.set(buckets[i].grantDate, buckets[i + 1].grantDate);
    }
  }

  // 最新の有効バケットを「今年度」に設定
  const nonExpired = buckets.filter((b) => !b.isExpired);
  if (nonExpired.length > 0) {
    nonExpired[nonExpired.length - 1].isCurrent = true;
  }

  // 消化を時系列で割り当て
  const sortedRecords = [...state.records].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt,
  );

  for (const record of sortedRecords) {
    const weight = leaveWeight(record.type, record.hours, settings.workingHours);
    if (weight <= 0) continue;

    // 取得日時点で有効なバケット
    const validBuckets = buckets.filter(
      (b) => b.grantDate <= record.date && !(b.expiryDate && record.date >= b.expiryDate),
    );

    // consumeFrom 設定に応じてソート
    if (settings.consumeFrom === 'current') {
      validBuckets.sort((a, b) => (a.grantDate < b.grantDate ? 1 : -1));
    } else {
      validBuckets.sort((a, b) => (a.grantDate > b.grantDate ? 1 : -1));
    }

    let rest = weight;
    for (const bucket of validBuckets) {
      const available = bucket.days - bucket.consumed;
      if (available <= 0) continue;
      const take = Math.min(rest, available);
      bucket.consumed += take;
      bucket.remaining = bucket.days - bucket.consumed;
      // 当年度中の消化か繰越期間中の消化かを判定
      const periodEnd = currentPeriodEnd.get(bucket.grantDate);
      if (periodEnd && record.date >= periodEnd) {
        bucket.consumedWhileCarried += take;
      } else {
        bucket.consumedWhileCurrent += take;
      }
      rest -= take;
      if (rest <= 0) break;
    }
  }

  return buckets;
}

// 繰越有給日数 = 有効期限内の「今年度以外」の付与バケット残日数の合計
export function computeCarriedOverDays(state: AppState, ref = new Date()): number {
  const buckets = buildGrantBuckets(state, ref);
  const carried = buckets
    .filter((b) => !b.isExpired && !b.isCurrent)
    .reduce((sum, b) => sum + b.remaining, 0);
  const limit = state.settings.carryOverLimit;
  return limit > 0 ? Math.min(carried, limit) : carried;
}

// 現在の繰越有給日数を取得（自動設定は動的計算、手動は設定値）
export function effectiveCarriedOver(state: AppState, ref = new Date()): number {
  if (state.settings.settingsMode === 'auto') {
    return computeCarriedOverDays(state, ref);
  }
  return state.settings.carriedOverDays;
}

// 今年度の消化日数（今年度分・繰越分それぞれ）
export function consumedByBucket(state: AppState): { current: number; carried: number } {
  const buckets = buildGrantBuckets(state);
  const current = buckets
    .filter((b) => !b.isExpired && b.isCurrent)
    .reduce((s, b) => s + b.consumedWhileCurrent, 0);
  const carried = buckets
    .filter((b) => !b.isExpired && !b.isCurrent)
    .reduce((s, b) => s + b.consumedWhileCarried, 0);
  return { current, carried };
}

export interface Summary {
  currentTotal: number; // 今年度付与日数
  carriedTotal: number; // 繰越付与日数
  consumedCurrent: number; // 今年度消化
  consumedCarried: number; // 繰越消化
  remainingCurrent: number; // 今年度残数
  remainingCarried: number; // 繰越残数
  totalRemaining: number; // 残有給
  totalDays: number; // 付与合計（今年度＋繰越）
  expiredTotal: number; // 失効日数
}

export function computeSummary(state: AppState): Summary {
  return computeSummaryAtDate(state, new Date());
}

// 指定日時点のサマリーを計算（カレンダー画面の月表示用）
export function computeSummaryAtDate(state: AppState, ref: Date): Summary {
  const buckets = buildGrantBuckets(state, ref);
  const currentBuckets = buckets.filter((b) => !b.isExpired && b.isCurrent);
  const carriedBuckets = buckets.filter((b) => !b.isExpired && !b.isCurrent);
  const expiredBuckets = buckets.filter((b) => b.isExpired);

  const currentTotal = currentBuckets.reduce((s, b) => s + b.days, 0);
  const carriedTotal = carriedBuckets.reduce((s, b) => s + (b.days - b.consumedWhileCurrent), 0);
  const consumedCurrent = currentBuckets.reduce((s, b) => s + b.consumedWhileCurrent, 0);
  const consumedCarried = carriedBuckets.reduce((s, b) => s + b.consumedWhileCarried, 0);
  const remainingCurrent = currentBuckets.reduce((s, b) => s + b.remaining, 0);
  const remainingCarried = carriedBuckets.reduce((s, b) => s + b.remaining, 0);
  const expiredTotal = expiredBuckets.reduce((s, b) => s + Math.max(0, b.days - b.consumed), 0);

  return {
    currentTotal,
    carriedTotal,
    consumedCurrent,
    consumedCarried,
    remainingCurrent,
    remainingCarried,
    totalRemaining: remainingCurrent + remainingCarried,
    totalDays: currentTotal + carriedTotal,
    expiredTotal,
  };
}

export function sortRecords(records: LeaveRecord[]): LeaveRecord[] {
  return [...records].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
}

// 日本の有給付与例（勤続年数に応じた付与日数）
export const GRANT_TABLE: { tenure: number; days: number }[] = [
  { tenure: 0.5, days: 10 },
  { tenure: 1.5, days: 11 },
  { tenure: 2.5, days: 12 },
  { tenure: 3.5, days: 14 },
  { tenure: 4.5, days: 16 },
  { tenure: 5.5, days: 18 },
  { tenure: 6.5, days: 20 },
];

export function grantDaysForTenure(tenureYears: number): number {
  let result = 0;
  for (const entry of GRANT_TABLE) {
    if (tenureYears >= entry.tenure - 0.01) result = entry.days;
  }
  return result;
}

export function computeTenure(hireDate: string, ref = new Date()): number {
  const start = new Date(hireDate + 'T00:00:00');
  if (Number.isNaN(start.getTime())) return 0;
  const now = new Date(toStr(ref) + 'T00:00:00');
  const diffMs = now.getTime() - start.getTime();
  return diffMs / (365.25 * 24 * 60 * 60 * 1000);
}

export function grantDaysAtDate(settings: Settings, grantDate: string): number {
  if (!settings.hireDate) return settings.currentYearDays;
  const grant = new Date(grantDate + 'T00:00:00');
  const hire = new Date(settings.hireDate + 'T00:00:00');
  if (Number.isNaN(grant.getTime()) || Number.isNaN(hire.getTime())) return settings.currentYearDays;
  const tenure = (grant.getTime() - hire.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return grantDaysForTenure(tenure);
}

// 入社日の6か月後を初回付与日として計算する（自動設定用）
export function defaultFirstGrantDate(hireDate: string): string {
  const d = new Date(hireDate + 'T00:00:00');
  d.setMonth(d.getMonth() + 6);
  return toStr(d);
}

export function computeNextGrantDate(settings: Settings, ref = new Date()): string | undefined {
  if (settings.grantBasis === 'fiscalYear') {
    const { start } = fiscalYearRange(settings, ref);
    const fyStart = new Date(start + 'T00:00:00');
    if (fyStart <= ref) {
      const next = new Date(fyStart);
      next.setFullYear(next.getFullYear() + 1);
      return toStr(next);
    }
    return start;
  }
  if (!settings.firstGrantDate) return undefined;
  const base = new Date(settings.firstGrantDate);
  if (Number.isNaN(base.getTime())) return undefined;
  let next = new Date(base);
  while (next <= ref) {
    next.setFullYear(next.getFullYear() + 1);
  }
  return toStr(next);
}

export function daysUntilGrant(settings: Settings, ref = new Date()): number | undefined {
  const next = settings.nextGrantDate ?? computeNextGrantDate(settings, ref);
  if (!next) return undefined;
  const target = new Date(next + 'T00:00:00');
  const today = new Date(toStr(ref) + 'T00:00:00');
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// 次に失効する有給の失効日を返す（最も近い失効日）
export function computeCarryOverExpiryDate(settings: Settings, state?: AppState, ref = new Date()): string | undefined {
  if (settings.carryOverExpiryYears === 0) return undefined;
  if (!state) return undefined;
  const buckets = buildGrantBuckets(state, ref);
  const today = toStr(ref);
  const upcoming = buckets
    .filter((b) => b.expiryDate && b.expiryDate > today && b.remaining > 0.001)
    .map((b) => b.expiryDate!)
    .sort();
  return upcoming[0];
}

export function daysUntilExpiry(settings: Settings, ref = new Date(), state?: AppState): number | undefined {
  const expiry = computeCarryOverExpiryDate(settings, state, ref);
  if (!expiry) return undefined;
  const target = new Date(expiry + 'T00:00:00');
  const today = new Date(toStr(ref) + 'T00:00:00');
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// 年度切替・付与日の自動更新
export function applyAnnualRollover(state: AppState, ref = new Date()): AppState {
  let settings = { ...state.settings };
  const today = toStr(ref);
  let grantRecords = state.grantRecords ?? [];
  let expiryRecords = state.expiryRecords ?? [];

  // 1. 失効チェック: 期限切れのバケットを検出して失効記録を追加
  const buckets = buildGrantBuckets({ ...state, settings, grantRecords }, ref);
  for (const bucket of buckets) {
    if (!bucket.isExpired || !bucket.expiryDate) continue;
    // 既に同じ失効日の記録がある場合はスキップ
    const alreadyRecorded = expiryRecords.some((e) => e.date === bucket.expiryDate);
    if (alreadyRecorded) continue;
    const expiredDays = Math.max(0, bucket.days - bucket.consumed);
    if (settings.autoDeductExpiry && expiredDays > 0) {
      expiryRecords = [
        ...expiryRecords,
        { id: uid(), date: bucket.expiryDate!, days: expiredDays, createdAt: Date.now() },
      ];
    }
  }

  // 2. 付与日処理: 新しい付与日が来たら付与記録を追加
  const nextGrant = settings.nextGrantDate ?? computeNextGrantDate(settings, ref);
  if (nextGrant && today >= nextGrant && settings.lastGrantApplied !== nextGrant) {
    if (settings.grantMode === 'auto' && settings.hireDate) {
      settings.currentYearDays = grantDaysAtDate(settings, nextGrant);
    }
    settings.lastGrantApplied = nextGrant;
    // 重複付与防止
    const alreadyGranted = grantRecords.some((g) => g.date === nextGrant);
    if (!alreadyGranted) {
      grantRecords = [
        ...grantRecords,
        { id: uid(), date: nextGrant, days: settings.currentYearDays, createdAt: Date.now() },
      ];
    }
    settings.nextGrantDate = computeNextGrantDate(
      settings,
      new Date(new Date(nextGrant + 'T00:00:00').getTime() + 24 * 60 * 60 * 1000),
    );
  }

  return { ...state, settings, grantRecords, expiryRecords };
}

// 自動設定モード: 入社日から現在の有給設定を自動計算
export function computeAutoSettings(settings: Settings, ref = new Date(), state?: AppState): Partial<Settings> {
  if (!settings.hireDate) return {};
  const tenure = computeTenure(settings.hireDate, ref);
  const currentYearDays = grantDaysForTenure(tenure);
  let firstGrant = settings.firstGrantDate;
  if (!firstGrant) {
    const d = new Date(settings.hireDate + 'T00:00:00');
    d.setMonth(d.getMonth() + 6);
    firstGrant = toStr(d);
  }
  const fg = new Date(firstGrant + 'T00:00:00');
  const fiscalYearStart = { month: fg.getMonth() + 1, day: fg.getDate() };

  // 付与バケットから繰越日数を計算
  let carriedOverDays = 0;
  if (state) {
    const tempSettings = { ...settings, currentYearDays, fiscalYearStart, firstGrantDate: firstGrant };
    const tempState = { ...state, settings: tempSettings };
    carriedOverDays = computeCarriedOverDays(tempState, ref);
  }

  return {
    currentYearDays,
    carriedOverDays,
    fiscalYearStart,
    firstGrantDate: firstGrant,
  };
}

// 特別休暇の集計
export interface SpecialLeaveSummary {
  type: SpecialLeaveType;
  consumed: number;
  remaining: number;
}

export function computeSpecialLeaveSummary(state: AppState): SpecialLeaveSummary[] {
  return state.specialLeaveTypes.map((type) => {
    const consumed = state.specialLeaveRecords
      .filter((r) => r.typeId === type.id)
      .reduce((sum, r) => sum + r.days, 0);
    return {
      type,
      consumed,
      remaining: Math.max(0, type.grantedDays - consumed),
    };
  });
}

export function sortSpecialLeaveRecords(records: SpecialLeaveRecord[]): SpecialLeaveRecord[] {
  return [...records].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
}
