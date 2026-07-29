import { lazy, Suspense, useEffect, useState } from 'react';
import type { AppState, LeaveRecord, Settings, SpecialLeaveType, SpecialLeaveRecord } from '@/types';
import { clearState, defaultState, loadState, saveState, uid } from '@/lib/storage';
import { applyAnnualRollover } from '@/lib/calc';
import { runStartupNotifications } from '@/lib/notifications';
import { useTheme } from '@/lib/theme';
import { HomeScreen } from '@/screens/HomeScreen';
import { BottomNav, type Tab } from '@/components/BottomNav';
import { NavBar } from '@/components/NavBar';

const TAB_TITLES: Record<Tab, string> = {
  home: '有給管理',
  records: '記録',
  stats: '統計',
  settings: '設定',
};

const RecordsScreen = lazy(() =>
  import('@/screens/RecordsScreen').then((m) => ({ default: m.RecordsScreen })),
);
const StatsScreen = lazy(() =>
  import('@/screens/StatsScreen').then((m) => ({ default: m.StatsScreen })),
);
const SettingsScreen = lazy(() =>
  import('@/screens/SettingsScreen').then((m) => ({ default: m.SettingsScreen })),
);

export default function App() {
  useTheme();
  const [state, setState] = useState<AppState>(() => loadState());
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState(false);
  const [tab, setTab] = useState<Tab>('home');
  const [editing, setEditing] = useState<LeaveRecord | null>(null);
  const [editingSpecial, setEditingSpecial] = useState<SpecialLeaveRecord | null>(null);

  // 初期化処理：年度切替・通知を実行し、完了したらスプラッシュを非表示にしてアプリを表示
  useEffect(() => {
    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      try {
        const rolled = applyAnnualRollover(state);
        const { newState, shown } = runStartupNotifications(rolled);
        const finalState = shown.length > 0 ? newState : rolled;
        if (finalState !== state) setState(finalState);
        setReady(true);
        setInitError(false);
        (window as unknown as { __splashControl?: { ready: () => void } }).__splashControl?.ready();
      } catch {
        setInitError(true);
        (window as unknown as { __splashControl?: { error: () => void } }).__splashControl?.error();
      }
    };

    // requestIdleCallback を使わず、次のフレームで即座に実行（起動時間を短縮）
    const id = window.setTimeout(run, 0);
    return () => { cancelled = true; window.clearTimeout(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initError]);

  // スプラッシュの「再試行」ボタンからのイベントを受信
  useEffect(() => {
    const onRetry = () => {
      setInitError(false);
      setReady(false);
    };
    window.addEventListener('bolt-app-retry', onRetry);
    return () => window.removeEventListener('bolt-app-retry', onRetry);
  }, []);

  // データ読込完了後のみ保存（初期空状態の上書きを防ぐ）
  useEffect(() => {
    if (ready) saveState(state);
  }, [state, ready]);

  function addRecord(rec: Omit<LeaveRecord, 'id' | 'createdAt'>) {
    const record: LeaveRecord = { ...rec, id: uid(), createdAt: Date.now() };
    setState((s) => ({ ...s, records: [...s.records, record] }));
    setTab('records');
  }

  function addSpecialLeaveRecord(rec: Omit<SpecialLeaveRecord, 'id' | 'createdAt'>) {
    const record: SpecialLeaveRecord = { ...rec, id: uid(), createdAt: Date.now() };
    setState((s) => ({ ...s, specialLeaveRecords: [...s.specialLeaveRecords, record] }));
    setTab('records');
  }

  function updateSpecialLeaveRecord(id: string, rec: Omit<SpecialLeaveRecord, 'id' | 'createdAt'>) {
    setState((s) => ({
      ...s,
      specialLeaveRecords: s.specialLeaveRecords.map((r) => (r.id === id ? { ...r, ...rec } : r)),
    }));
    setEditingSpecial(null);
    setTab('records');
  }

  function deleteSpecialLeaveRecord(id: string) {
    setState((s) => ({ ...s, specialLeaveRecords: s.specialLeaveRecords.filter((r) => r.id !== id) }));
  }

  function startEditSpecial(record: SpecialLeaveRecord) {
    setEditingSpecial(record);
    setTab('records');
  }

  function cancelEditSpecial() {
    setEditingSpecial(null);
    setTab('records');
  }

  function updateRecord(id: string, rec: Omit<LeaveRecord, 'id' | 'createdAt'>) {
    setState((s) => ({
      ...s,
      records: s.records.map((r) => (r.id === id ? { ...r, ...rec } : r)),
    }));
    setEditing(null);
    setTab('records');
  }

  function deleteRecord(id: string) {
    setState((s) => ({ ...s, records: s.records.filter((r) => r.id !== id) }));
  }

  function deleteExpiryRecord(id: string) {
    setState((s) => ({ ...s, expiryRecords: s.expiryRecords.filter((r) => r.id !== id) }));
  }

  function deleteGrantRecord(id: string) {
    setState((s) => ({ ...s, grantRecords: s.grantRecords.filter((r) => r.id !== id) }));
  }

  function saveSpecialLeaveTypes(types: SpecialLeaveType[]) {
    setState((s) => ({ ...s, specialLeaveTypes: types }));
  }

  function startEdit(record: LeaveRecord) {
    setEditing(record);
    setTab('records');
  }

  function cancelEdit() {
    setEditing(null);
    setTab('records');
  }

  function saveSettings(settings: Settings) {
    setState((s) => ({ ...s, settings }));
  }

  function importData(imported: AppState) {
    setState(imported);
    setTab('home');
  }

  function clearAll() {
    clearState();
    setState(loadState());
    setTab('settings');
  }

  if (!ready) {
    // 初期化が完了するまでホーム画面を描画しない（スプラッシュが表示中）
    return null;
  }

  return (
    <div className="min-h-screen text-slate-800 dark:text-slate-100 max-w-md mx-auto overflow-x-hidden transition-colors duration-300" style={{ background: 'var(--bg-app)' }}>
      <NavBar title={TAB_TITLES[tab]} />
      <main
        className="min-w-0"
        style={{
          paddingTop: 'calc(56px + env(safe-area-inset-top))',
          paddingBottom: 'calc(200px + env(safe-area-inset-bottom))',
          minHeight: '100vh',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div key={tab} className="screen-enter min-w-0">
          {tab === 'home' && <HomeScreen state={state} ready={ready} />}
          {tab === 'records' && (
            <Suspense fallback={null}>
              <RecordsScreen
                state={state}
                editing={editing}
                editingSpecial={editingSpecial}
                onAdd={addRecord}
                onUpdate={updateRecord}
                onCancelEdit={cancelEdit}
                onAddSpecial={addSpecialLeaveRecord}
                onUpdateSpecial={updateSpecialLeaveRecord}
                onCancelEditSpecial={cancelEditSpecial}
                onEdit={startEdit}
                onDelete={deleteRecord}
                onEditSpecial={startEditSpecial}
                onDeleteSpecial={deleteSpecialLeaveRecord}
                onDeleteExpiry={deleteExpiryRecord}
                onDeleteGrant={deleteGrantRecord}
              />
            </Suspense>
          )}
          {tab === 'stats' && (
            <Suspense fallback={null}>
              <StatsScreen state={state} ready={ready} />
            </Suspense>
          )}
          {tab === 'settings' && (
            <Suspense fallback={null}>
              <SettingsScreen
                settings={state.settings}
                state={state}
                onSave={saveSettings}
                onSaveSpecialLeaveTypes={saveSpecialLeaveTypes}
                onImport={importData}
                onClear={clearAll}
              />
            </Suspense>
          )}
        </div>
      </main>
      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}
