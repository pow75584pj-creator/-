import type { AppState, GrantRecord, LeaveRecord, NotificationLog, NotificationSettings, Settings, SpecialLeaveType } from '@/types';

const STORAGE_KEY = 'yukyu-app-state-v1';

// In-memory cache for faster subsequent loads (e.g. hot reload, re-mount)
let memoryCache: AppState | null = null;

export const defaultNotificationSettings: NotificationSettings = {
  enabled: false,
  grant7DaysBefore: false,
  grant1DayBefore: false,
  grantOnDay: false,
  expiry30DaysBefore: false,
  expiry7DaysBefore: false,
  expiry1DayBefore: false,
  specialLeave7DaysBefore: false,
  monthly1st: false,
};

export const defaultSettings: Settings = {
  settingsMode: 'manual',
  currentYearDays: 20,
  carriedOverDays: 0,
  fiscalYearStart: { month: 4, day: 1 },
  workingHours: 8,
  weeklyWorkDays: 5,
  consumeFrom: 'current',
  carryOverLimit: 20,
  carryOverExpiryYears: 2,
  autoDeductExpiry: true,
  carryOverGrantedDate: undefined,
  lastExpiryApplied: undefined,
  grantMode: 'manual',
  grantBasis: 'hireDate',
  hireDate: undefined,
  firstGrantDate: undefined,
  firstGrantDateManual: false,
  nextGrantDate: undefined,
  lastGrantApplied: undefined,
  userName: '',
  notifications: defaultNotificationSettings,
  lastNotifiedDate: undefined,
};

export const DEFAULT_SPECIAL_LEAVE_TYPES: SpecialLeaveType[] = [
  { id: 'summer', name: '夏季休暇', grantedDays: 5, color: 'sky' },
  { id: 'condolence', name: '慶弔休暇', grantedDays: 5, color: 'rose' },
  { id: 'birthday', name: '誕生日休暇', grantedDays: 1, color: 'amber' },
  { id: 'comp', name: '代休', grantedDays: 1, color: 'violet' },
  { id: 'other', name: 'その他', grantedDays: 0, color: 'slate' },
];

export const SPECIAL_LEAVE_COLORS: Record<string, { bg: string; text: string; badge: string; dot: string }> = {
  sky: { bg: 'bg-sky-50', text: 'text-sky-700', badge: 'bg-sky-50 text-sky-700', dot: 'bg-sky-500' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-700', badge: 'bg-rose-50 text-rose-700', dot: 'bg-rose-500' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', badge: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-700', badge: 'bg-violet-50 text-violet-700', dot: 'bg-violet-500' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  slate: { bg: 'bg-slate-50', text: 'text-slate-700', badge: 'bg-slate-100 text-slate-700', dot: 'bg-slate-500' },
};

export const SPECIAL_LEAVE_COLOR_KEYS = Object.keys(SPECIAL_LEAVE_COLORS);

export const defaultState: AppState = {
  settings: defaultSettings,
  records: [],
  expiryRecords: [],
  grantRecords: [],
  specialLeaveTypes: DEFAULT_SPECIAL_LEAVE_TYPES,
  specialLeaveRecords: [],
  notificationLogs: [],
};

export function loadState(): AppState {
  if (memoryCache) return memoryCache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { memoryCache = defaultState; return memoryCache; }
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const loadedSettings: Partial<Settings> = parsed.settings ?? {};
    const state: AppState = {
      settings: {
        ...defaultSettings,
        ...loadedSettings,
        notifications: { ...defaultNotificationSettings, ...(loadedSettings.notifications ?? {}) },
      },
      records: parsed.records ?? [],
      expiryRecords: parsed.expiryRecords ?? [],
      grantRecords: parsed.grantRecords ?? [],
      specialLeaveTypes: parsed.specialLeaveTypes ?? DEFAULT_SPECIAL_LEAVE_TYPES,
      specialLeaveRecords: parsed.specialLeaveRecords ?? [],
      notificationLogs: Array.isArray(parsed.notificationLogs) ? parsed.notificationLogs : [],
    };
    memoryCache = state;
    return state;
  } catch {
    memoryCache = defaultState;
    return memoryCache;
  }
}

export function saveState(state: AppState): void {
  memoryCache = state;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const TYPE_WEIGHT: Record<LeaveRecord['type'], number> = {
  full: 1,
  morning: 0.5,
  afternoon: 0.5,
  half: 0.5,
  quarter: 0.25,
  hourly: 0, // 時間休は日数換算で計算
};

export function leaveWeight(type: LeaveRecord['type'], hours?: number, workingHours = 8): number {
  if (type === 'hourly') return (hours ?? 0) / workingHours;
  return TYPE_WEIGHT[type];
}

export function leaveLabel(type: LeaveRecord['type']): string {
  switch (type) {
    case 'full':
      return '全休';
    case 'morning':
      return '午前休';
    case 'afternoon':
      return '午後休';
    case 'half':
      return '半休';
    case 'quarter':
      return '1/4休';
    case 'hourly':
      return '時間休';
  }
}

export const BACKUP_VERSION = 2;

export function exportState(state: AppState): string {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString(), version: BACKUP_VERSION }, null, 2);
}

export function importState(json: string): AppState {
  const parsed = JSON.parse(json) as Partial<AppState>;
  if (typeof parsed !== 'object' || parsed === null) throw new Error('Invalid file');
  const importedSettings: Partial<Settings> = parsed.settings ?? {};
  return {
    settings: {
      ...defaultSettings,
      ...importedSettings,
      notifications: { ...defaultNotificationSettings, ...(importedSettings.notifications ?? {}) },
    },
    records: Array.isArray(parsed.records) ? parsed.records : [],
    expiryRecords: Array.isArray(parsed.expiryRecords) ? parsed.expiryRecords : [],
    grantRecords: Array.isArray(parsed.grantRecords) ? parsed.grantRecords : [],
    specialLeaveTypes: parsed.specialLeaveTypes ?? DEFAULT_SPECIAL_LEAVE_TYPES,
    specialLeaveRecords: Array.isArray(parsed.specialLeaveRecords) ? parsed.specialLeaveRecords : [],
    notificationLogs: Array.isArray(parsed.notificationLogs) ? parsed.notificationLogs : [],
  };
}

export function clearState(): void {
  memoryCache = null;
  localStorage.removeItem(STORAGE_KEY);
}
