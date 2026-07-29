import type { AppState, NotificationLog } from '@/types';
import { computeSummary, daysUntilGrant, daysUntilExpiry, computeCarryOverExpiryDate, effectiveCarriedOver } from './calc';
import { toDateStr, formatDateJa } from './date';
import { uid } from './storage';

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export function getPermissionState(): NotificationPermissionState {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission as NotificationPermissionState;
}

export async function requestPermission(): Promise<NotificationPermissionState> {
  if (typeof Notification === 'undefined') return 'unsupported';
  try {
    const result = await Notification.requestPermission();
    return result as NotificationPermissionState;
  } catch {
    return 'denied';
  }
}

function todayStr(): string {
  return toDateStr(new Date());
}

function diffDays(target: string): number {
  const t = new Date(target + 'T00:00:00').getTime();
  const now = new Date(todayStr() + 'T00:00:00').getTime();
  return Math.round((t - now) / (1000 * 60 * 60 * 24));
}

export interface PendingNotification {
  category: string;
  message: string;
}

// その日に通知すべきものを判定（重複防止は呼び出し元で処理）
export function checkDueNotifications(state: AppState): PendingNotification[] {
  const n = state.settings.notifications;
  if (!n.enabled) return [];

  const pending: PendingNotification[] = [];
  const today = todayStr();

  // 付与日関連
  const nextGrant = state.settings.nextGrantDate;
  if (nextGrant) {
    const d = diffDays(nextGrant);
    if (d === 7 && n.grant7DaysBefore) {
      pending.push({ category: '付与7日前', message: `あと7日で有給が付与されます。（${formatDateJa(nextGrant)}）` });
    }
    if (d === 1 && n.grant1DayBefore) {
      pending.push({ category: '付与前日', message: `明日、有給が付与されます。（${formatDateJa(nextGrant)}）` });
    }
    if (d === 0 && n.grantOnDay) {
      pending.push({ category: '付与当日', message: '本日、有給が付与されました。' });
    }
  }

  // 失効関連
  const expiryDate = computeCarryOverExpiryDate(state.settings, state);
  if (expiryDate) {
    const d = diffDays(expiryDate);
    const expiredDays = effectiveCarriedOver(state);
    if (d === 30 && n.expiry30DaysBefore) {
      pending.push({ category: '失効30日前', message: `あと30日で${expiredDays}日分の有給が失効します。（${formatDateJa(expiryDate)}）` });
    }
    if (d === 7 && n.expiry7DaysBefore) {
      pending.push({ category: '失効7日前', message: `失効まであと7日です。（${formatDateJa(expiryDate)}）` });
    }
    if (d === 1 && n.expiry1DayBefore) {
      pending.push({ category: '失効前日', message: `明日${expiredDays}日分の有給が失効します。` });
    }
  }

  // 特別休暇期限7日前
  if (n.specialLeave7DaysBefore && state.specialLeaveTypes.length > 0) {
    // 特別休暇には明示的な期限がないため、年度末を期限とみなす
    // ここでは簡易的に何もしない（特別休暇の期限フィールドがないため）
    // 将来的に特別休暇に期限を追加した場合はここで判定
  }

  // 毎月1日
  if (n.monthly1st && new Date().getDate() === 1) {
    const summary = computeSummary(state);
    pending.push({ category: '月次残数', message: `現在の残り有給は${summary.totalRemaining.toFixed(1)}日です。` });
  }

  return pending;
}

// ブラウザ通知を表示（可能な場合）
function showBrowserNotification(title: string, body: string) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body });
  } catch {
    // noop
  }
}

// アプリ起動時に呼ぶ: 当日分の通知を判定し、未通知なら記録して通知
export function runStartupNotifications(state: AppState): { newState: AppState; shown: PendingNotification[] } {
  const today = todayStr();
  const lastNotified = state.settings.lastNotifiedDate;

  // 同日内の重複実行防止
  if (lastNotified === today) {
    return { newState: state, shown: [] };
  }

  const pending = checkDueNotifications(state);
  if (pending.length === 0) {
    // 通知がなくても当日チェック済みとして記録
    return {
      newState: { ...state, settings: { ...state.settings, lastNotifiedDate: today } },
      shown: [],
    };
  }

  // 通知ログを追加
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const newLogs: NotificationLog[] = pending.map((p) => ({
    id: uid(),
    date: today,
    time,
    category: p.category,
    message: p.message,
    createdAt: Date.now(),
  }));

  // ブラウザ通知を表示
  for (const p of pending) {
    showBrowserNotification(p.category, p.message);
  }

  return {
    newState: {
      ...state,
      settings: { ...state.settings, lastNotifiedDate: today },
      notificationLogs: [...newLogs, ...state.notificationLogs].slice(0, 200),
    },
    shown: pending,
  };
}
