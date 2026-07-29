export type LeaveType = 'full' | 'morning' | 'afternoon' | 'half' | 'quarter' | 'hourly';

export interface LeaveRecord {
  id: string;
  date: string; // YYYY-MM-DD
  type: LeaveType; // full=全休, half=半休, quarter=1/4休, hourly=時間休
  hours?: number; // 時間休の場合の取得時間
  note?: string;
  createdAt: number;
}

export interface ExpiryRecord {
  id: string;
  date: string; // YYYY-MM-DD（失効日）
  days: number; // 失効した日数
  createdAt: number;
}

export interface GrantRecord {
  id: string;
  date: string; // YYYY-MM-DD（付与日）
  days: number; // 付与された日数
  createdAt: number;
}

export interface SpecialLeaveType {
  id: string;
  name: string;
  grantedDays: number; // 付与日数
  color: string; // カラーキー
}

export interface SpecialLeaveRecord {
  id: string;
  date: string; // YYYY-MM-DD
  typeId: string; // SpecialLeaveType.id
  days: number; // 取得日数
  note?: string;
  createdAt: number;
}

export interface NotificationSettings {
  enabled: boolean;
  grant7DaysBefore: boolean;
  grant1DayBefore: boolean;
  grantOnDay: boolean;
  expiry30DaysBefore: boolean;
  expiry7DaysBefore: boolean;
  expiry1DayBefore: boolean;
  specialLeave7DaysBefore: boolean;
  monthly1st: boolean;
}

export interface NotificationLog {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  category: string; // 通知カテゴリ
  message: string;
  createdAt: number;
}

export interface Settings {
  // 有給設定
  settingsMode: 'auto' | 'manual'; // 有給設定の自動/手動
  currentYearDays: number; // 今年度付与日数（＝年間付与日数）
  carriedOverDays: number; // 前年度繰越日数
  fiscalYearStart: { month: number; day: number }; // 年度開始日
  workingHours: number; // 1日の勤務時間（時間）
  weeklyWorkDays: number; // 週の勤務日数
  // 消化設定
  consumeFrom: 'current' | 'carried'; // 消化順
  // 繰越設定
  carryOverLimit: number; // 繰越上限（日数）
  carryOverExpiryYears: number; // 繰越有効期限（年）— 0 = 設定なし
  autoDeductExpiry: boolean; // 失効した有給を自動で残数から減算
  carryOverGrantedDate?: string; // 現在の繰越日数が付与された日
  lastExpiryApplied?: string; // 最後に処理した失効日（重複防止）
  // 付与日設定
  grantMode: 'auto' | 'manual'; // 付与日数の決定方法
  grantBasis: 'hireDate' | 'fiscalYear'; // 付与基準: 入社日基準 or 年度開始日基準
  hireDate?: string; // 入社日
  firstGrantDate?: string; // 初回付与日
  firstGrantDateManual?: boolean; // 初回付与日をユーザーが手動編集したか
  nextGrantDate?: string; // 次回付与日
  lastGrantApplied?: string; // 最後に適用した付与日（重複付与防止）
  // 表示
  userName: string;
  // 通知設定
  notifications: NotificationSettings;
  lastNotifiedDate?: string; // 最後に通知をチェックした日（重複防止）
}

export interface AppState {
  settings: Settings;
  records: LeaveRecord[];
  expiryRecords: ExpiryRecord[];
  grantRecords: GrantRecord[];
  specialLeaveTypes: SpecialLeaveType[];
  specialLeaveRecords: SpecialLeaveRecord[];
  notificationLogs: NotificationLog[];
}
