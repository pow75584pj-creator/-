import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Bell, BellOff, BellRing, CalendarClock, Check, ChevronDown, Download, Monitor, Moon, Pencil, Plus,
  Sparkles, Star, Sun, Trash2, Upload, X,
} from 'lucide-react';
import type { AppState, Settings, SpecialLeaveType } from '@/types';
import { DatePicker } from '@/components/DatePicker';
import { useTheme } from '@/lib/theme';
import { toDateStr } from '@/lib/date';
import {
  computeAutoSettings, computeNextGrantDate, computeSpecialLeaveSummary, computeSummary,
  computeTenure, defaultFirstGrantDate, grantDaysAtDate, grantDaysForTenure, GRANT_TABLE,
} from '@/lib/calc';
import {
  clearState,
  createAutoBackup,
  defaultSettings,
  exportState,
  getAutoBackups,
  importState,
  SPECIAL_LEAVE_COLORS,
  SPECIAL_LEAVE_COLOR_KEYS,
  uid,
} from '@/lib/storage';
import {
  getPermissionState, requestPermission, runStartupNotifications, type NotificationPermissionState,
} from '@/lib/notifications';

function toStrLocal(d: Date): string {
  return toDateStr(d);
}

function formatDateJa(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const w = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日(${w})`;
}

export function SettingsScreen({
  settings,
  state,
  onSave,
  onSaveSpecialLeaveTypes,
  onImport,
  onClear,
}: {
  settings: Settings;
  state: AppState;
  onSave: (s: Settings) => void;
  onSaveSpecialLeaveTypes: (types: SpecialLeaveType[]) => void;
  onImport: (state: AppState) => void;
  onClear: () => void;
}) {
  const { mode: themeMode, changeMode } = useTheme();
  const [draft, setDraft] = useState<Settings>(settings);
  const [saved, setSaved] = useState(false);
  const [permState, setPermState] = useState<NotificationPermissionState>(() => getPermissionState());
  const [notifOpen, setNotifOpen] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [restoreFile, setRestoreFile] = useState<string | null>(null);
  const [restoreName, setRestoreName] = useState('');
  const [pendingImport, setPendingImport] = useState<AppState | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [editingSp, setEditingSp] = useState<SpecialLeaveType | null>(null);
  const [confirmSpDelete, setConfirmSpDelete] = useState<SpecialLeaveType | null>(null);
  const [grantAccordionOpen, setGrantAccordionOpen] = useState(false);
  const [spAccordionOpen, setSpAccordionOpen] = useState(false);
  const autoBackups = getAutoBackups();
  const spTypes = state.specialLeaveTypes;
  const spSummary = useMemo(() => computeSpecialLeaveSummary(state), [state]);
  const autoBackups = getAutoBackups();

  useEffect(() => { setPermState(getPermissionState()); }, []);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function updateNotif<K extends keyof Settings['notifications']>(key: K, value: Settings['notifications'][K]) {
    setDraft((d) => ({ ...d, notifications: { ...d.notifications, [key]: value } }));
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    let toSave = { ...draft };
    if (draft.settingsMode === 'auto' && draft.hireDate) {
      const auto = computeAutoSettings(draft, new Date(), state);
      toSave = { ...toSave, ...auto, grantMode: 'auto' };
    }
    onSave(toSave);
    setDraft(toSave);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  function handleExport() {
    const blob = new Blob([exportState(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yukyu-backup-${toDateStr(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handlePickRestoreFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result);
        const imported = importState(text);
        setPendingImport(imported);
        setRestoreFile(file.name);
        setRestoreName(file.name);
      } catch {
        setImportMsg('復元失敗: ファイルが不正です');
        setRestoreFile(null);
        setPendingImport(null);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function downloadPreRestoreBackup() {
  createAutoBackup(state);

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;

  const blob = new Blob([exportState(state)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `有給管理_復元前バックアップ_${ts}.json`;
  a.click();

  URL.revokeObjectURL(url);
}

  function handleConfirmRestore() {
    if (!pendingImport) { setRestoreFile(null); return; }
    try {
      downloadPreRestoreBackup();
      onImport(pendingImport);
      setImportMsg('復元しました（復元前バックアップを保存しました）');
    } catch {
      setImportMsg('復元失敗: 現在のデータは保持されています');
    }
    setRestoreFile(null);
    setRestoreName('');
    setPendingImport(null);
  }

  function handleClear() {
    clearState();
    onClear();
    setConfirmClear(false);
    setDraft({ ...defaultSettings });
  }

  async function handleEnableNotifications() {
    const result = await requestPermission();
    setPermState(result);
    if (result === 'granted') {
      const { newState } = runStartupNotifications(state);
      onSave(newState.settings);
    }
  }

  function handleAddSpType() {
    const newType: SpecialLeaveType = {
      id: uid(),
      name: '新しい休暇',
      grantedDays: 1,
      color: SPECIAL_LEAVE_COLOR_KEYS[Math.floor(Math.random() * SPECIAL_LEAVE_COLOR_KEYS.length)],
    };
    onSaveSpecialLeaveTypes([...spTypes, newType]);
    setEditingSp(newType);
  }

  function handleSaveSpType(type: SpecialLeaveType) {
    const exists = spTypes.some((t) => t.id === type.id);
    const next = exists ? spTypes.map((t) => (t.id === type.id ? type : t)) : [...spTypes, type];
    onSaveSpecialLeaveTypes(next);
    setEditingSp(null);
  }

  function handleDeleteSpType(id: string) {
    onSaveSpecialLeaveTypes(spTypes.filter((t) => t.id !== id));
    setConfirmSpDelete(null);
  }

  return (
    <div className="space-y-5 pb-6">
      <form onSubmit={handleSave} className="space-y-5">
        {/* テーマ設定 */}
        <Section title="テーマ" icon="🎨">
          <div className="grid grid-cols-3 gap-2">
            <ThemeOption icon="sun" label="ライト" active={themeMode === 'light'} onClick={() => changeMode('light')} />
            <ThemeOption icon="moon" label="ダーク" active={themeMode === 'dark'} onClick={() => changeMode('dark')} />
            <ThemeOption icon="monitor" label="システム" active={themeMode === 'system'} onClick={() => changeMode('system')} />
          </div>
          <p className="text-[13px] mt-2 px-1" style={{ color: 'var(--text-muted)' }}>
            {themeMode === 'system' ? '端末の設定に従います' : `${themeMode === 'dark' ? 'ダーク' : 'ライト'}モード固定です`}
          </p>
        </Section>

        {/* 付与日設定 */}
        <Section title="付与日設定" icon="🗓️">
          {/* 付与モード選択 */}
          <Field label="付与日数の決定方法">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => update('grantMode', 'auto')}
                className="btn-press flex items-center justify-center gap-1.5 py-3 rounded-[14px] text-[15px] font-medium transition"
                style={
                  draft.grantMode === 'auto'
                    ? { background: '#0d9488', color: '#ffffff' }
                    : { background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }
                }
              >
                <Sparkles className="w-4 h-4" />
                自動計算
              </button>
              <button
                type="button"
                onClick={() => update('grantMode', 'manual')}
                className="btn-press flex items-center justify-center gap-1.5 py-3 rounded-[14px] text-[15px] font-medium transition"
                style={
                  draft.grantMode === 'manual'
                    ? { background: '#0d9488', color: '#ffffff' }
                    : { background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }
                }
              >
                <Pencil className="w-4 h-4" />
                手動設定
              </button>
            </div>
          </Field>

          <Field label="入社日">
            <DatePicker
              value={draft.hireDate ?? ''}
              onChange={(v) => {
                const hd = v || undefined;
                let next = { ...draft, hireDate: hd };
                if (hd && !draft.firstGrantDateManual) {
                  next.firstGrantDate = defaultFirstGrantDate(hd);
                }
                if (next.settingsMode === 'auto' && hd) {
                  const auto = computeAutoSettings(next, new Date(), state);
                  next = { ...next, ...auto };
                  const ng = computeNextGrantDate(next);
                  if (ng) next.nextGrantDate = ng;
                }
                setDraft(next);
              }}
            />
            {draft.hireDate && (
              <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>
                勤続 {computeTenure(draft.hireDate).toFixed(1)} 年 ・
                現在の付与日数 {grantDaysForTenure(computeTenure(draft.hireDate))} 日
              </p>
            )}
          </Field>

          <Field label="付与基準">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  const next = { ...draft, grantMode: 'auto' as const };
                  const ng = computeNextGrantDate(next);
                  if (ng) next.nextGrantDate = ng;
                  setDraft(next);
                }}
                className="btn-press flex items-center justify-center gap-1.5 py-3 rounded-[14px] text-[15px] font-medium transition"
                style={
                  draft.grantMode === 'auto'
                    ? { background: '#0d9488', color: '#ffffff' }
                    : { background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }
                }
              >
                <Sparkles className="w-4 h-4" />
                労働基準法
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = { ...draft, grantMode: 'manual' as const };
                  const ng = computeNextGrantDate(next);
                  if (ng) next.nextGrantDate = ng;
                  setDraft(next);
                }}
                className="btn-press flex items-center justify-center gap-1.5 py-3 rounded-[14px] text-[15px] font-medium transition"
                style={
                  draft.grantMode === 'manual'
                    ? { background: '#0d9488', color: '#ffffff' }
                    : { background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }
                }
              >
                <Pencil className="w-4 h-4" />
                手動設定
              </button>
            </div>
            <p className="text-[13px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
              {draft.grantMode === 'auto'
                ? '入社日から勤続年数を自動計算し、労働基準法の基準で付与日数を決定します'
                : '付与日数を手動で自由に入力できます'}
            </p>
          </Field>

          {draft.grantMode === 'auto' ? (
            <div className="rounded-[14px] overflow-hidden" style={{ background: 'rgba(13, 148, 136, 0.06)', border: '1px solid rgba(13, 148, 136, 0.2)' }}>
              <button
                type="button"
                onClick={() => setGrantAccordionOpen((o) => !o)}
                className="w-full flex items-center gap-1.5 p-4 text-left btn-press"
              >
                <Sparkles className="w-4 h-4 shrink-0" style={{ color: '#0d9488' }} />
                <span className="text-[15px] font-medium flex-1" style={{ color: '#0d9488' }}>
                  自動付与（勤続年数に応じて計算）
                </span>
                <ChevronDown
                  className="w-4 h-4 shrink-0 transition-transform duration-300"
                  style={{ color: '#0d9488', transform: grantAccordionOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
              </button>
              {/* 折りたたみ時のサマリー */}
              <div className="px-4 pb-3 space-y-1 text-[13px]" style={{ color: '#0d9488' }}>
                {draft.hireDate ? (
                  <p>
                    現在：勤続{computeTenure(draft.hireDate).toFixed(1)}年（{grantDaysForTenure(computeTenure(draft.hireDate))}日）
                  </p>
                ) : (
                  <p>現在：入社日未設定</p>
                )}
                {draft.hireDate && draft.nextGrantDate && (
                  <p>次回付与：{formatDateJa(draft.nextGrantDate)}（{grantDaysAtDate(draft, draft.nextGrantDate)}日）</p>
                )}
              </div>
              {/* 展開時の一覧 */}
              <div
                className="grid transition-all duration-300 ease-in-out"
                style={{
                  gridTemplateRows: grantAccordionOpen ? '1fr' : '0fr',
                }}
              >
                <div className="overflow-hidden">
                  <div className="px-4 pb-4 space-y-1.5 text-[13px]">
                    {GRANT_TABLE.map((row) => {
                      const tenureLabel =
                        row.tenure === 6.5
                          ? '6年6か月以上'
                          : `${Math.floor(row.tenure)}年${row.tenure % 1 ? '6か月' : ''}`;
                      const isActive =
                        draft.hireDate && Math.abs(computeTenure(draft.hireDate) - row.tenure) < 0.25;
                      return (
                        <div
                          key={row.tenure}
                          className="flex justify-between px-2 py-1.5 rounded-[8px]"
                          style={
                            isActive
                              ? { background: 'rgba(13, 148, 136, 0.12)', color: '#0d9488', fontWeight: 500 }
                              : { color: 'var(--text-secondary)' }
                          }
                        >
                          <span>勤続 {tenureLabel}{isActive ? '（現在）' : ''}</span>
                          <span className="tabular-nums">{row.days}日</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <Field label="付与日数（手動）">
              <NumberInput
                value={draft.currentYearDays}
                onChange={(v) => update('currentYearDays', v)}
                suffix="日"
              />
              <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>付与日数を手動で設定します</p>
            </Field>
          )}

          <Field label="初回付与日">
            <DatePicker
              value={draft.firstGrantDate ?? ''}
              onChange={(v) => {
                const fg = v || undefined;
                let next = { ...draft, firstGrantDate: fg, firstGrantDateManual: true };
                if (fg) {
                  if (next.settingsMode === 'auto' && next.hireDate) {
                    const auto = computeAutoSettings(next, new Date(), state);
                    next = { ...next, ...auto };
                  }
                  const ng = computeNextGrantDate(next);
                  if (ng) next.nextGrantDate = ng;
                }
                setDraft(next);
              }}
            />
            <p className="text-[13px] mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              初期値は入社日の6か月後です。会社の制度に合わせて自由に変更できます。変更すると以降の付与日・繰越・失効も自動で再計算されます。
            </p>
          </Field>
          <Field label="次回付与日">
            <div className="flex items-center gap-2">
              <div
                className="flex-1 rounded-[14px] px-4 py-3"
                style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
              >
                {draft.nextGrantDate ?? '—'}
              </div>
              <CalendarClock className="w-5 h-5 shrink-0" style={{ color: '#0d9488' }} />
            </div>
            <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>初回付与日から1年ごとに自動更新されます</p>
          </Field>
        </Section>

        {/* 有給設定 */}
        <Section title="有給設定" icon="📅">
          {/* 自動/手動 切り替え */}
          <Field label="設定モード">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  let next = { ...draft, settingsMode: 'auto' as const };
                  if (next.hireDate) {
                    const auto = computeAutoSettings(next, new Date(), state);
                    next = { ...next, ...auto };
                    const ng = computeNextGrantDate(next);
                    if (ng) next.nextGrantDate = ng;
                  }
                  setDraft(next);
                }}
                className="btn-press flex items-center justify-center gap-1.5 py-3 rounded-[14px] text-[15px] font-medium transition"
                style={
                  draft.settingsMode === 'auto'
                    ? { background: '#0d9488', color: '#ffffff' }
                    : { background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }
                }
              >
                <Sparkles className="w-4 h-4" />
                自動設定
              </button>
              <button
                type="button"
                onClick={() => update('settingsMode', 'manual')}
                className="btn-press flex items-center justify-center gap-1.5 py-3 rounded-[14px] text-[15px] font-medium transition"
                style={
                  draft.settingsMode === 'manual'
                    ? { background: '#0d9488', color: '#ffffff' }
                    : { background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }
                }
              >
                <Pencil className="w-4 h-4" />
                手動設定
              </button>
            </div>
            <p className="text-[13px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
              {draft.settingsMode === 'auto'
                ? '入社日から勤続年数を自動計算し、労働基準法の付与日数を自動設定します'
                : '有給設定を自由に入力できます'}
            </p>
          </Field>

          {draft.settingsMode === 'auto' && !draft.hireDate && (
            <div className="rounded-[14px] p-3.5" style={{ background: 'rgba(255, 159, 28, 0.06)', border: '1px solid rgba(255, 159, 28, 0.2)' }}>
              <p className="text-[13px]" style={{ color: '#f59e0b' }}>
                <AlertTriangle className="w-4 h-4 inline mr-1 -mt-0.5" />
                自動設定には入社日が必要です。上の「付与日設定」で入社日を入力してください。
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="今年度付与日数">
              {draft.settingsMode === 'auto' ? (
                <ReadOnlyField value={`${draft.currentYearDays} 日`} hint="自動計算" />
              ) : (
                <NumberInput
                  value={draft.currentYearDays}
                  onChange={(v) => update('currentYearDays', v)}
                  suffix="日"
                />
              )}
            </Field>
            <Field label="前年度繰越日数">
              {draft.settingsMode === 'auto' ? (
                <ReadOnlyField value={`${draft.carriedOverDays} 日`} hint="自動計算" />
              ) : (
                <NumberInput
                  value={draft.carriedOverDays}
                  onChange={(v) => update('carriedOverDays', v)}
                  suffix="日"
                />
              )}
            </Field>
          </div>

          <Field label="年度開始日">
            {draft.settingsMode === 'auto' ? (
              <ReadOnlyField value={`${draft.fiscalYearStart.month}月${draft.fiscalYearStart.day}日`} hint="自動計算" />
            ) : (
              <div className="flex items-center gap-2">
                <SelectInput
                  value={draft.fiscalYearStart.month}
                  onChange={(v) => update('fiscalYearStart', { ...draft.fiscalYearStart, month: v })}
                  options={Array.from({ length: 12 }, (_, i) => i + 1).map((m) => ({ value: m, label: `${m}月` }))}
                />
                <SelectInput
                  value={draft.fiscalYearStart.day}
                  onChange={(v) => update('fiscalYearStart', { ...draft.fiscalYearStart, day: v })}
                  options={Array.from({ length: 31 }, (_, i) => i + 1).map((d) => ({ value: d, label: `${d}日` }))}
                />
              </div>
            )}
          </Field>

          <Field label="1日の勤務時間">
            <NumberInput value={draft.workingHours} onChange={(v) => update('workingHours', v)} suffix="時間" />
          </Field>
        </Section>

        {/* 消化設定 */}
        <Section title="消化設定" icon="🔄">
          <div className="space-y-2">
            <RadioCard
              checked={draft.consumeFrom === 'current'}
              onClick={() => update('consumeFrom', 'current')}
              title="今年度から消化"
              description="今年度の有給を優先して消化します"
            />
            <RadioCard
              checked={draft.consumeFrom === 'carried'}
              onClick={() => update('consumeFrom', 'carried')}
              title="繰越から消化"
              description="繰越有給を優先して消化します（期限切れ対策におすすめ）"
            />
          </div>
          <ConsumePreview settings={draft} state={state} />
        </Section>

        {/* 繰越設定 */}
        <Section title="繰越設定" icon="📦">
          <Field label="繰越上限">
            <NumberInput value={draft.carryOverLimit} onChange={(v) => update('carryOverLimit', v)} suffix="日" />
          </Field>
          <Field label="繰越有効期限">
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 1, label: '1年' },
                { value: 2, label: '2年' },
                { value: 0, label: '制限なし' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update('carryOverExpiryYears', opt.value)}
                  className={`btn-press py-3 rounded-[14px] text-[15px] font-medium transition ${
                    draft.carryOverExpiryYears === opt.value ? '' : ''
                  }`}
                  style={
                    draft.carryOverExpiryYears === opt.value
                      ? { background: '#0d9488', color: '#ffffff' }
                      : { background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[13px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
              {draft.carryOverExpiryYears === 0
                ? '期限なし（失効しません）'
                : `付与から${draft.carryOverExpiryYears}年後に失効します`}
            </p>
          </Field>
          <Field label="失効した有給を自動で残数から減算">
            <button
              type="button"
              onClick={() => update('autoDeductExpiry', !draft.autoDeductExpiry)}
              className="w-full flex items-center justify-between p-3.5 rounded-[14px] transition btn-press"
              style={{
                background: draft.autoDeductExpiry ? 'rgba(13, 148, 136, 0.06)' : 'var(--bg-card)',
                border: `1px solid ${draft.autoDeductExpiry ? '#0d9488' : 'var(--border-default)'}`,
              }}
            >
              <div className="text-left">
                <p className="text-[15px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {draft.autoDeductExpiry ? 'ON' : 'OFF'}
                </p>
                <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  失効日を過ぎた繰越日数を自動で減算し、履歴に記録します
                </p>
              </div>
              <span
                className="relative inline-flex h-6 w-11 items-center rounded-full transition"
                style={{ background: draft.autoDeductExpiry ? '#0d9488' : 'var(--text-muted)', opacity: draft.autoDeductExpiry ? 1 : 0.4 }}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${draft.autoDeductExpiry ? 'translate-x-5' : 'translate-x-0.5'}`}
                  style={{ boxShadow: '0 0.5px 1px rgba(0,0,0,0.04)' }}
                />
              </span>
            </button>
          </Field>
        </Section>

        {/* 特別休暇管理（アコーディオン） */}
        <section className="space-y-3">
          <h2 className="text-[15px] font-semibold px-1 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <span>⭐</span>
            特別休暇の管理
          </h2>
          <div className="rounded-[20px] overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: '0 0.5px 1px rgba(0,0,0,0.04)' }}>
            {/* ヘッダー（タップで開閉） */}
            <button
              type="button"
              onClick={() => setSpAccordionOpen((o) => !o)}
              className="btn-press w-full flex items-center justify-between p-4 transition"
              style={{ background: spAccordionOpen ? 'rgba(13, 148, 136, 0.04)' : 'transparent' }}
            >
              <div className="flex items-center gap-3 text-left">
                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: spTypes.length > 0 ? 'rgba(13, 148, 136, 0.12)' : 'var(--bg-subtle)' }}
                >
                  <Star className="w-4 h-4" style={{ color: spTypes.length > 0 ? '#0d9488' : 'var(--text-muted)' }} />
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                    特別休暇の管理
                  </p>
                  <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {spTypes.length === 0
                      ? '登録なし'
                      : `登録済み：${spTypes.length}種類　残り合計：${spSummary.reduce((s, x) => s + x.remaining, 0).toFixed(1)}日`}
                  </p>
                </div>
              </div>
              <ChevronDown
                className="w-5 h-5 shrink-0 transition-transform duration-300"
                style={{ transform: spAccordionOpen ? 'rotate(180deg)' : 'rotate(0deg)', color: 'var(--text-muted)' }}
              />
            </button>

            {/* 展開内容（スムーズアニメーション） */}
            <div
              className="grid transition-all duration-300 ease-in-out"
              style={{ gridTemplateRows: spAccordionOpen ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden">
                <div className="px-4 pb-4 space-y-3">
                  <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                    有給とは別に残日数を管理する休暇の種類を追加・編集・削除できます。
                  </p>
                  <div className="space-y-2">
                    {spTypes.length === 0 ? (
                      <p className="text-[15px] text-center py-4" style={{ color: 'var(--text-muted)' }}>種類がありません。追加してください。</p>
                    ) : (
                      spTypes.map((t) => {
                        const color = SPECIAL_LEAVE_COLORS[t.color] ?? SPECIAL_LEAVE_COLORS.slate;
                        const summary = spSummary.find((s) => s.type.id === t.id);
                        return (
                          <div
                            key={t.id}
                            className="flex items-center gap-3 p-3 rounded-[14px]"
                            style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}
                          >
                            <span className={`w-3 h-3 rounded-full ${color.dot} shrink-0`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[15px] font-medium" style={{ color: 'var(--text-secondary)' }}>{t.name}</p>
                              <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                                付与 {t.grantedDays}日 ・ 残り {summary?.remaining.toFixed(1) ?? t.grantedDays}日
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setEditingSp(t)}
                              className="btn-press p-2 transition"
                              style={{ color: 'var(--text-muted)' }}
                              aria-label="編集"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmSpDelete(t)}
                              className="btn-press p-2 transition"
                              style={{ color: 'var(--text-muted)' }}
                              aria-label="削除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleAddSpType}
                    className="btn-press w-full flex items-center justify-center gap-1.5 py-3 rounded-[14px] text-[15px] font-medium transition"
                    style={{ border: '1px dashed var(--border-default)', color: 'var(--text-muted)', background: 'transparent' }}
                  >
                    <Plus className="w-4 h-4" />
                    種類を追加
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 通知（設定＋履歴を1つのアコーディオンに統合） */}
        <section className="space-y-3">
          <h2 className="text-[15px] font-semibold px-1 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <span>🔔</span>
            通知
          </h2>
          <div className="rounded-[20px] overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: '0 0.5px 1px rgba(0,0,0,0.04)' }}>
            {/* ヘッダー（タップで開閉） */}
            <button
              type="button"
              onClick={() => setNotifOpen((o) => !o)}
              className="btn-press w-full flex items-center justify-between p-4 transition"
              style={{ background: notifOpen ? 'rgba(13, 148, 136, 0.04)' : 'transparent' }}
            >
              <div className="flex items-center gap-3 text-left">
                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: draft.notifications.enabled ? 'rgba(13, 148, 136, 0.12)' : 'var(--bg-subtle)' }}
                >
                  {draft.notifications.enabled
                    ? <BellRing className="w-4 h-4" style={{ color: '#0d9488' }} />
                    : <Bell className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />}
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                    通知
                  </p>
                  <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {`通知：${draft.notifications.enabled ? 'ON' : 'OFF'}　・　${state.notificationLogs.length > 0 ? `履歴${state.notificationLogs.length}件` : '履歴なし'}`}
                  </p>
                </div>
              </div>
              <ChevronDown
                className="w-5 h-5 shrink-0 transition-transform duration-300"
                style={{ transform: notifOpen ? 'rotate(180deg)' : 'rotate(0deg)', color: 'var(--text-muted)' }}
              />
            </button>

            {/* 展開内容（スムーズアニメーション） */}
            <div
              className="grid transition-all duration-300 ease-in-out"
              style={{ gridTemplateRows: notifOpen ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden">
                <div className="px-4 pb-4 space-y-3">
                  {/* ① 通知設定 */}
                  <p className="text-[13px] font-medium px-1" style={{ color: 'var(--text-muted)' }}>通知設定</p>

                  {/* 通知許可: 許可済みなら非表示、未許可なら表示 */}
                  {permState !== 'granted' && (
                    <div className="rounded-[14px] p-3.5" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                      {permState === 'unsupported' ? (
                        <div className="flex items-center gap-2 text-[15px]" style={{ color: 'var(--text-muted)' }}>
                          <BellOff className="w-4 h-4 shrink-0" />
                          <span>この端末ではブラウザ通知に対応していません。アプリ内通知のみ利用できます。</span>
                        </div>
                      ) : permState === 'denied' ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 text-[15px]" style={{ color: 'rgb(255, 59, 48)' }}>
                            <BellOff className="w-4 h-4 shrink-0" />
                            <span>通知が拒否されています</span>
                          </div>
                          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                            ブラウザの設定から通知を許可してください。iOS Safariの場合は「共有」→「ホーム画面に追加」でPWAとして追加すると通知が利用できます。
                          </p>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleEnableNotifications}
                          className="btn-press w-full flex items-center justify-center gap-2 py-2.5 rounded-[10px] text-[15px] font-medium transition"
                          style={{ background: '#0d9488', color: '#ffffff' }}
                        >
                          <Bell className="w-4 h-4" />
                          通知を許可する
                        </button>
                      )}
                    </div>
                  )}

                  {/* 通知マスタートグル */}
                  <button
                    type="button"
                    onClick={() => updateNotif('enabled', !draft.notifications.enabled)}
                    className="w-full flex items-center justify-between p-3.5 rounded-[14px] transition btn-press"
                    style={{
                      background: draft.notifications.enabled ? 'rgba(13, 148, 136, 0.06)' : 'var(--bg-card)',
                      border: `1px solid ${draft.notifications.enabled ? '#0d9488' : 'var(--border-default)'}`,
                    }}
                  >
                    <div className="text-left">
                      <p className="text-[15px] font-medium" style={{ color: 'var(--text-secondary)' }}>通知を有効にする</p>
                      <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-muted)' }}>アプリ起動時に通知を判定します</p>
                    </div>
                    <span
                      className="relative inline-flex h-6 w-11 items-center rounded-full transition"
                      style={{ background: draft.notifications.enabled ? '#0d9488' : 'var(--text-muted)', opacity: draft.notifications.enabled ? 1 : 0.4 }}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${draft.notifications.enabled ? 'translate-x-5' : 'translate-x-0.5'}`}
                        style={{ boxShadow: '0 0.5px 1px rgba(0,0,0,0.04)' }}
                      />
                    </span>
                  </button>

                  {/* 個別通知項目 */}
                  <div className={`space-y-2 transition ${draft.notifications.enabled ? '' : 'opacity-50 pointer-events-none'}`}>
                    <p className="text-[13px] font-medium px-1" style={{ color: 'var(--text-muted)' }}>通知する項目</p>
                    <NotifToggle label="次回付与日の7日前" checked={draft.notifications.grant7DaysBefore} onChange={(v) => updateNotif('grant7DaysBefore', v)} />
                    <NotifToggle label="次回付与日の前日" checked={draft.notifications.grant1DayBefore} onChange={(v) => updateNotif('grant1DayBefore', v)} />
                    <NotifToggle label="次回付与日当日" checked={draft.notifications.grantOnDay} onChange={(v) => updateNotif('grantOnDay', v)} />
                    <NotifToggle label="有給失効30日前" checked={draft.notifications.expiry30DaysBefore} onChange={(v) => updateNotif('expiry30DaysBefore', v)} />
                    <NotifToggle label="有給失効7日前" checked={draft.notifications.expiry7DaysBefore} onChange={(v) => updateNotif('expiry7DaysBefore', v)} />
                    <NotifToggle label="有給失効前日" checked={draft.notifications.expiry1DayBefore} onChange={(v) => updateNotif('expiry1DayBefore', v)} />
                    <NotifToggle label="特別休暇の期限7日前" checked={draft.notifications.specialLeave7DaysBefore} onChange={(v) => updateNotif('specialLeave7DaysBefore', v)} />
                    <NotifToggle label="毎月1日に残り有給を通知" checked={draft.notifications.monthly1st} onChange={(v) => updateNotif('monthly1st', v)} />
                  </div>

                  {/* 区切り線 */}
                  <div className="pt-2" style={{ borderTop: '1px solid var(--border-default)' }} />

                  {/* ② 通知履歴 */}
                  <p className="text-[13px] font-medium px-1" style={{ color: 'var(--text-muted)' }}>通知履歴</p>
                  {state.notificationLogs.length === 0 ? (
                    <p className="text-[15px] py-2" style={{ color: 'var(--text-muted)' }}>通知履歴はありません</p>
                  ) : (
                    <ul className="space-y-2.5 max-h-64 overflow-y-auto">
                      {state.notificationLogs.map((log) => (
                        <li key={log.id} className="flex gap-3 p-2.5 rounded-[10px]" style={{ background: 'var(--bg-subtle)' }}>
                          <Bell className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#0d9488' }} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[13px] font-medium" style={{ color: '#0d9488' }}>{log.category}</span>
                              <span className="text-[13px] shrink-0 tabular-nums" style={{ color: 'var(--text-muted)' }}>{log.date} {log.time}</span>
                            </div>
                            <p className="text-[15px] mt-0.5 leading-snug" style={{ color: 'var(--text-secondary)' }}>{log.message}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* データ管理 */}
        <Section title="データ管理" icon="💾">
          <button
            type="button"
            onClick={handleExport}
            className="btn-press w-full flex items-center gap-3 p-3.5 rounded-[14px] transition"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
          >
            <Download className="w-5 h-5 shrink-0" style={{ color: '#0d9488' }} />
            <div className="text-left">
              <p className="text-[15px] font-medium" style={{ color: 'var(--text-secondary)' }}>バックアップを作成</p>
              <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>全データをJSONファイルとして保存</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="btn-press w-full flex items-center gap-3 p-3.5 rounded-[14px] transition"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
          >
            <Upload className="w-5 h-5 shrink-0" style={{ color: '#0d9488' }} />
            <div className="text-left">
              <p className="text-[15px] font-medium" style={{ color: 'var(--text-secondary)' }}>バックアップを復元</p>
              <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>JSONファイルからデータを復元</p>
            </div>
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={handlePickRestoreFile} className="hidden" />
          {autoBackups.length > 0 && (
  <div
    className="rounded-[14px] p-3"
    style={{
      background: 'var(--bg-subtle)',
      border: '1px solid var(--border-default)',
    }}
  >
    <p
      className="text-[14px] font-medium"
      style={{ color: 'var(--text-secondary)' }}
    >
      自動バックアップ
    </p>

    <p
      className="text-[13px] mt-1"
      style={{ color: 'var(--text-muted)' }}
    >
      保存数 {autoBackups.length}/3件
    </p>

    <p
      className="text-[13px]"
      style={{ color: 'var(--text-muted)' }}
    >
      最終保存日時：
      {new Date(autoBackups[0].createdAt).toLocaleString('ja-JP')}
    </p>
  </div>
)}
          {importMsg && (
            <p className="text-[15px] text-center font-medium" style={{ color: importMsg.includes('失敗') ? 'rgb(255, 59, 48)' : '#0d9488' }}>
              {importMsg}
            </p>
          )}

          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="btn-press w-full flex items-center gap-3 p-3.5 rounded-[14px] transition"
            style={{ background: 'rgba(255, 59, 48, 0.06)', border: '1px solid rgba(255, 59, 48, 0.2)' }}
          >
            <Trash2 className="w-5 h-5 shrink-0" style={{ color: 'rgb(255, 59, 48)' }} />
            <div className="text-left">
              <p className="text-[15px] font-medium" style={{ color: 'rgb(255, 59, 48)' }}>データを初期化</p>
              <p className="text-[13px]" style={{ color: 'rgba(255, 59, 48, 0.7)' }}>すべての設定と履歴を削除</p>
            </div>
          </button>
        </Section>

        <button
          type="submit"
          className="btn-press w-full rounded-[14px] py-3.5 font-semibold transition flex items-center justify-center gap-2"
          style={{ background: '#0d9488', color: '#ffffff' }}
        >
          <Check className="w-5 h-5" />
          設定を保存
        </button>

        {saved && <p className="text-center text-[15px] font-medium" style={{ color: '#0d9488' }}>保存しました</p>}
      </form>

      {/* アプリ情報 */}
      <Section title="アプリ情報" icon="ℹ️">
        <InfoRow label="アプリ名" value="有給管理" />
        <InfoRow label="Version" value="1.0.0" />
        <InfoRow label="最終更新日" value={new Date(__BUILD_DATE__).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })} last />
      </Section>

      {/* 全データ削除確認ダイアログ */}
      {confirmClear && (
        <div className="fixed inset-0 z-30 flex items-center justify-center px-6 bg-black/40">
          <div className="rounded-[20px] p-6 max-w-sm w-full" style={{ background: 'var(--bg-card)', boxShadow: '0 0.5px 1px rgba(0,0,0,0.04)' }}>
            <div className="flex justify-center mb-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(255, 59, 48, 0.1)' }}>
                <AlertTriangle className="w-6 h-6" style={{ color: 'rgb(255, 59, 48)' }} />
              </div>
            </div>
            <h3 className="text-[17px] font-semibold text-center" style={{ color: 'var(--text-primary)' }}>データを初期化</h3>
            <p className="text-[15px] text-center mt-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              すべてのデータを削除します。<br />
              この操作は元に戻せません。
            </p>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setConfirmClear(false)}
                className="btn-press flex-1 py-3 rounded-[14px] font-medium transition flex items-center justify-center gap-1.5"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
              >
                <X className="w-4 h-4" />
                キャンセル
              </button>
              <button
                onClick={handleClear}
                className="btn-press flex-1 py-3 rounded-[14px] font-medium transition flex items-center justify-center gap-1.5"
                style={{ background: 'rgb(255, 59, 48)', color: '#ffffff' }}
              >
                <Trash2 className="w-4 h-4" />
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 復元確認ダイアログ */}
      {restoreFile && (
        <div className="fixed inset-0 z-30 flex items-center justify-center px-6 bg-black/40">
          <div className="rounded-[20px] p-6 max-w-sm w-full" style={{ background: 'var(--bg-card)', boxShadow: '0 0.5px 1px rgba(0,0,0,0.04)' }}>
            <div className="flex justify-center mb-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(13, 148, 136, 0.1)' }}>
                <Upload className="w-6 h-6" style={{ color: '#0d9488' }} />
              </div>
            </div>
            <h3 className="text-[17px] font-semibold text-center" style={{ color: 'var(--text-primary)' }}>バックアップを復元</h3>
            <p className="text-[15px] text-center mt-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              現在のデータは上書きされます。<br />
              復元前に現在のデータが自動でバックアップされます。<br />
              復元しますか？
            </p>
            {restoreName && (
              <p className="text-[13px] text-center mt-2 truncate" style={{ color: 'var(--text-muted)' }}>📁 {restoreName}</p>
            )}
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setRestoreFile(null); setRestoreName(''); setPendingImport(null); }}
                className="btn-press flex-1 py-3 rounded-[14px] font-medium transition flex items-center justify-center gap-1.5"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
              >
                <X className="w-4 h-4" />
                キャンセル
              </button>
              <button
                onClick={handleConfirmRestore}
                className="btn-press flex-1 py-3 rounded-[14px] font-medium transition flex items-center justify-center gap-1.5"
                style={{ background: '#0d9488', color: '#ffffff' }}
              >
                <Check className="w-4 h-4" />
                復元する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 特別休暇種類 編集ダイアログ */}
      {editingSp && (
        <SpecialLeaveTypeEditor
          type={editingSp}
          onSave={handleSaveSpType}
          onCancel={() => setEditingSp(null)}
        />
      )}

      {/* 特別休暇種類 削除確認ダイアログ */}
      {confirmSpDelete && (
        <div className="fixed inset-0 z-30 flex items-center justify-center px-6 bg-black/40">
          <div className="rounded-[20px] p-6 max-w-sm w-full" style={{ background: 'var(--bg-card)', boxShadow: '0 0.5px 1px rgba(0,0,0,0.04)' }}>
            <div className="flex justify-center mb-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(255, 59, 48, 0.1)' }}>
                <AlertTriangle className="w-6 h-6" style={{ color: 'rgb(255, 59, 48)' }} />
              </div>
            </div>
            <h3 className="text-[17px] font-semibold text-center" style={{ color: 'var(--text-primary)' }}>「{confirmSpDelete.name}」を削除しますか？</h3>
            <p className="text-[15px] text-center mt-2" style={{ color: 'var(--text-secondary)' }}>
              この種類の取得履歴は残りますが、一覧から種類が消えます。
            </p>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setConfirmSpDelete(null)}
                className="btn-press flex-1 py-3 rounded-[14px] font-medium transition flex items-center justify-center gap-1.5"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
              >
                <X className="w-4 h-4" />
                キャンセル
              </button>
              <button
                onClick={() => handleDeleteSpType(confirmSpDelete.id)}
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

function SpecialLeaveTypeEditor({
  type,
  onSave,
  onCancel,
}: {
  type: SpecialLeaveType;
  onSave: (type: SpecialLeaveType) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(type.name);
  const [grantedDays, setGrantedDays] = useState(type.grantedDays);
  const [color, setColor] = useState(type.color);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center px-6 bg-black/40">
      <div className="rounded-[20px] p-6 max-w-sm w-full" style={{ background: 'var(--bg-card)', boxShadow: '0 0.5px 1px rgba(0,0,0,0.04)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[17px] font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Star className="w-5 h-5" style={{ color: '#0d9488' }} />
            特別休暇の編集
          </h3>
          <button onClick={onCancel} className="btn-press p-1.5" style={{ color: 'var(--text-muted)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[15px] block mb-1.5" style={{ color: 'var(--text-secondary)' }}>名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 夏季休暇"
              className="w-full rounded-[14px] px-4 py-3 focus:outline-none"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
            />
          </div>

          <div>
            <label className="text-[15px] block mb-1.5" style={{ color: 'var(--text-secondary)' }}>付与日数</label>
            <div className="relative">
              <input
                type="number"
                min={0}
                step={0.5}
                value={grantedDays}
                onChange={(e) => setGrantedDays(Number(e.target.value) || 0)}
                className="w-full rounded-[14px] px-4 py-3 focus:outline-none pr-12"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[15px]" style={{ color: 'var(--text-muted)' }}>日</span>
            </div>
          </div>

          <div>
            <label className="text-[15px] block mb-1.5" style={{ color: 'var(--text-secondary)' }}>カラー</label>
            <div className="grid grid-cols-6 gap-2">
              {SPECIAL_LEAVE_COLOR_KEYS.map((key) => {
                const c = SPECIAL_LEAVE_COLORS[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setColor(key)}
                    className="btn-press aspect-square rounded-[14px] flex items-center justify-center transition"
                    style={
                      color === key
                        ? { border: '2px solid #0d9488', background: 'rgba(13, 148, 136, 0.06)' }
                        : { border: '1px solid var(--border-default)' }
                    }
                  >
                    <span className={`w-6 h-6 rounded-full ${c.dot}`} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="btn-press flex-1 py-3 rounded-[14px] font-medium transition"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
          >
            キャンセル
          </button>
          <button
            onClick={() => onSave({ ...type, name: name.trim() || '名称未設定', grantedDays, color })}
            className="btn-press flex-1 py-3 rounded-[14px] font-medium transition flex items-center justify-center gap-1.5"
            style={{ background: '#0d9488', color: '#ffffff' }}
          >
            <Check className="w-4 h-4" />
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[15px] font-semibold px-1 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
        <span>{icon}</span>
        {title}
      </h2>
      <div className="rounded-[20px] p-4 space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: '0 0.5px 1px rgba(0,0,0,0.04)' }}>{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="w-full max-w-full min-w-0">
      <label className="text-[15px] block mb-1.5" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      {children}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        min={0}
        step={0.5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full rounded-[14px] px-4 py-3 focus:outline-none pr-12"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
      />
      {suffix && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[15px]" style={{ color: 'var(--text-muted)' }}>{suffix}</span>}
    </div>
  );
}

function SelectInput({
  value,
  onChange,
  options,
}: {
  value: number;
  onChange: (v: number) => void;
  options: { value: number; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="flex-1 rounded-[14px] px-4 py-3 focus:outline-none"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function RadioCard({
  checked,
  onClick,
  title,
  description,
}: {
  checked: boolean;
  onClick: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn-press w-full text-left p-3.5 rounded-[14px] transition"
      style={
        checked
          ? { border: '1px solid #0d9488', background: 'rgba(13, 148, 136, 0.06)' }
          : { border: '1px solid var(--border-default)', background: 'var(--bg-card)' }
      }
    >
      <div className="flex items-center gap-2.5">
        <span
          className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
          style={{ borderColor: checked ? '#0d9488' : 'var(--text-muted)' }}
        >
          {checked && <span className="w-2 h-2 rounded-full" style={{ background: '#0d9488' }} />}
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-medium" style={{ color: checked ? '#0d9488' : 'var(--text-secondary)' }}>{title}</p>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</p>
        </div>
      </div>
    </button>
  );
}

function ConsumePreview({ settings, state }: { settings: Settings; state: AppState }) {
  const current = computeSummary({ ...state, settings });
  const isCarried = settings.consumeFrom === 'carried';
  return (
    <div className="rounded-[14px] p-3.5" style={{ background: 'var(--bg-subtle)' }}>
      <p className="text-[13px] mb-2.5 font-medium" style={{ color: 'var(--text-muted)' }}>設定変更後の残日数（プレビュー）</p>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-[10px] p-2.5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>今年度の残り</p>
          <p className="text-base font-bold tabular-nums" style={{ color: isCarried ? 'var(--text-muted)' : '#0d9488' }}>
            {current.remainingCurrent.toFixed(1)} <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>日</span>
          </p>
        </div>
        <div className="rounded-[10px] p-2.5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>繰越の残り</p>
          <p className="text-base font-bold tabular-nums" style={{ color: isCarried ? '#0d9488' : 'var(--text-muted)' }}>
            {current.remainingCarried.toFixed(1)} <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>日</span>
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-2.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#0d9488' }} />
        {isCarried ? '繰越日数を優先消化中' : '今年度日数を優先消化中'}
      </div>
    </div>
  );
}

function NotifToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="btn-press w-full flex items-center justify-between p-3 rounded-[14px] transition"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
    >
      <span className="text-[15px] text-left" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span
        className="relative inline-flex h-5 w-9 items-center rounded-full transition shrink-0"
        style={{ background: checked ? '#0d9488' : 'var(--text-muted)', opacity: checked ? 1 : 0.4 }}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${checked ? 'translate-x-4' : 'translate-x-0.5'}`}
          style={{ boxShadow: '0 0.5px 1px rgba(0,0,0,0.04)' }}
        />
      </span>
    </button>
  );
}

function ReadOnlyField({ value, hint }: { value: string; hint?: string }) {
  return (
    <div
      className="w-full rounded-[14px] px-4 py-3 flex items-center justify-between"
      style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}
    >
      <span className="text-[15px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>{value}</span>
      {hint && (
        <span className="text-[11px] flex items-center gap-1" style={{ color: '#0d9488' }}>
          <Sparkles className="w-3 h-3" />
          {hint}
        </span>
      )}
    </div>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      className="flex items-center justify-between"
      style={{ paddingBottom: last ? 0 : 12, marginBottom: last ? 0 : 12, borderBottom: last ? 'none' : '1px solid var(--border-default)' }}
    >
      <span className="text-[15px]" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="text-[15px] font-medium" style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

function ThemeOption({ icon, label, active, onClick }: { icon: 'sun' | 'moon' | 'monitor'; label: string; active: boolean; onClick: () => void }) {
  const Icon = icon === 'sun' ? Sun : icon === 'moon' ? Moon : Monitor;
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn-press flex flex-col items-center gap-1.5 py-3.5 rounded-[14px] transition active:scale-95"
      style={
        active
          ? { border: '2px solid #0d9488', background: 'rgba(13, 148, 136, 0.06)' }
          : { border: '1px solid var(--border-default)', background: 'var(--bg-card)' }
      }
    >
      <Icon className="w-5 h-5" style={{ color: active ? '#0d9488' : 'var(--text-muted)' }} />
      <span className="text-[13px]" style={{ color: active ? '#0d9488' : 'var(--text-muted)', fontWeight: active ? 500 : 400 }}>{label}</span>
    </button>
  );
}
