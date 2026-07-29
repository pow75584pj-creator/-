import { useState } from 'react';
import type { LeaveRecord, LeaveType, SpecialLeaveRecord, SpecialLeaveType } from '@/types';
import { todayStr, formatDateJa } from '@/lib/date';
import { leaveLabel, leaveWeight, SPECIAL_LEAVE_COLORS } from '@/lib/storage';
import { Check, Clock, Star, AlertCircle } from 'lucide-react';
import { DatePicker } from '@/components/DatePicker';

interface Props {
  workingHours: number;
  editing?: LeaveRecord | null;
  editingSpecial?: SpecialLeaveRecord | null;
  specialLeaveTypes: SpecialLeaveType[];
  existingRecords: LeaveRecord[];
  existingSpecialRecords: SpecialLeaveRecord[];
  onAdd: (record: Omit<LeaveRecord, 'id' | 'createdAt'>) => void;
  onUpdate: (id: string, record: Omit<LeaveRecord, 'id' | 'createdAt'>) => void;
  onCancelEdit?: () => void;
  onAddSpecial: (record: Omit<SpecialLeaveRecord, 'id' | 'createdAt'>) => void;
  onUpdateSpecial: (id: string, record: Omit<SpecialLeaveRecord, 'id' | 'createdAt'>) => void;
  onCancelEditSpecial?: () => void;
}

const TYPES: LeaveType[] = ['full', 'morning', 'afternoon', 'hourly'];

// よく使う理由のプリセット — 配列で管理し、追加・削除が容易
const memoTemplates = [
  '私用',
  '病欠',
  '忌引',
];

function MemoField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  function appendPreset(text: string) {
    onChange(value ? `${value}\n${text}` : text);
  }
  return (
    <div>
      <label className="text-[15px] block mb-1.5" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {memoTemplates.map((t) => {
          const active = value.includes(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => appendPreset(t)}
              className="btn-press rounded-full px-3 py-1.5 text-[13px] font-medium transition"
              style={
                active
                  ? { background: 'rgba(13, 148, 136, 0.12)', color: '#0d9488', border: '1px solid rgba(13, 148, 136, 0.4)' }
                  : { background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }
              }
            >
              {t}
            </button>
          );
        })}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder="理由や備考を入力"
        className="w-full max-w-full min-w-0 box-border rounded-[14px] px-4 py-2.5 text-[15px] leading-relaxed focus:outline-none focus:border-teal-500 resize-none overflow-y-auto"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
      />
    </div>
  );
}

export function RegisterScreen({
  workingHours,
  editing,
  editingSpecial,
  specialLeaveTypes,
  existingRecords,
  existingSpecialRecords,
  onAdd,
  onUpdate,
  onCancelEdit,
  onAddSpecial,
  onUpdateSpecial,
  onCancelEditSpecial,
}: Props) {
  const [mode, setMode] = useState<'paid' | 'special'>(editingSpecial ? 'special' : 'paid');

  // 有給登録の状態
  const [date, setDate] = useState(editing?.date ?? todayStr());
  const [type, setType] = useState<LeaveType>(editing?.type ?? 'full');
  const [hours, setHours] = useState<number>(editing?.hours ?? 1);
  const [note, setNote] = useState(editing?.note ?? '');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // 特別休暇登録の状態
  const [spDate, setSpDate] = useState(editingSpecial?.date ?? todayStr());
  const [spTypeId, setSpTypeId] = useState<string>(editingSpecial?.typeId ?? specialLeaveTypes[0]?.id ?? '');
  const [spDays, setSpDays] = useState<number>(editingSpecial?.days ?? 1);
  const [spNote, setSpNote] = useState(editingSpecial?.note ?? '');
  const [spSaved, setSpSaved] = useState(false);
  const [spError, setSpError] = useState('');

  const days = leaveWeight(type, hours, workingHours);
  const selectedSpType = specialLeaveTypes.find((t) => t.id === spTypeId);

  function validatePaid(date: string, type: LeaveType, editingId?: string): string {
    const sameDay = existingRecords.filter((r) => r.date === date && r.id !== editingId);
    const sameType = sameDay.find((r) => r.type === type);
    if (sameType) {
      return 'この日は既に登録されています。編集する場合は履歴から編集してください。';
    }
    if (type === 'full') {
      const hasFull = sameDay.some((r) => r.type === 'full');
      if (hasFull) return 'この日は既に全休が登録されています。';
      const hasHalf = sameDay.some((r) => r.type === 'morning' || r.type === 'afternoon');
      if (hasHalf) return 'この日は午前休または午後休が登録されているため、全休は登録できません。';
    } else if (type === 'morning' || type === 'afternoon') {
      const hasFull = sameDay.some((r) => r.type === 'full');
      if (hasFull) return 'この日は既に全休が登録されています。';
    }
    return '';
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validatePaid(date, type, editing?.id);
    if (err) {
      setError(err);
      return;
    }
    setError('');
    const payload = { date, type, hours: type === 'hourly' ? hours : undefined, note: note.trim() || undefined };
    if (editing) {
      onUpdate(editing.id, payload);
    } else {
      onAdd(payload);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    if (!editing) {
      setNote('');
    }
  }

  function handleSpecialSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!spTypeId) return;
    const dup = existingSpecialRecords.find(
      (r) => r.date === spDate && r.typeId === spTypeId && r.id !== editingSpecial?.id,
    );
    if (dup) {
      setSpError('この日は既に登録されています。編集する場合は履歴から編集してください。');
      return;
    }
    setSpError('');
    const payload = {
      date: spDate,
      typeId: spTypeId,
      days: spDays,
      note: spNote.trim() || undefined,
    };
    if (editingSpecial) {
      onUpdateSpecial(editingSpecial.id, payload);
    } else {
      onAddSpecial(payload);
    }
  }

  return (
    <div className="overflow-x-hidden min-w-0">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[17px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          {editing ? '記録を編集' : editingSpecial ? '記録を編集' : '新規登録'}
        </h2>
        {(editing || editingSpecial) && (
          <button
            onClick={() => (editing ? onCancelEdit?.() : onCancelEditSpecial?.())}
            className="text-sm btn-press"
            style={{ color: 'var(--text-secondary)' }}
          >
            キャンセル
          </button>
        )}
      </div>

      {/* モード切替（編集中でない場合のみ） */}
      {!editing && !editingSpecial && (
        <div className="grid grid-cols-2 gap-2 mb-5">
          <button
            type="button"
            onClick={() => setMode('paid')}
            className={`btn-press py-2.5 rounded-[14px] text-[15px] font-medium transition ${
              mode === 'paid' ? 'text-white' : ''
            }`}
            style={
              mode === 'paid'
                ? { background: '#0d9488', color: '#ffffff' }
                : { background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }
            }
          >
            有給休暇
          </button>
          <button
            type="button"
            onClick={() => setMode('special')}
            className={`btn-press py-2.5 rounded-[14px] text-[15px] font-medium transition flex items-center justify-center gap-1.5 ${
              mode === 'special' ? 'text-white' : ''
            }`}
            style={
              mode === 'special'
                ? { background: '#0d9488', color: '#ffffff' }
                : { background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }
            }
          >
            <Star className="w-3.5 h-3.5" />
            特別休暇
          </button>
        </div>
      )}

      {mode === 'paid' && !editingSpecial ? (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="w-full max-w-full min-w-0">
            <DatePicker
              value={date}
              onChange={setDate}
              required
            />
            <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>{formatDateJa(date)}</p>
          </div>

          <div>
            <label className="text-[15px] block mb-1.5" style={{ color: 'var(--text-secondary)' }}>休暇種別</label>
            <div className="grid grid-cols-4 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`btn-press py-3 rounded-[14px] text-[15px] font-medium transition ${
                    type === t ? 'text-white' : ''
                  }`}
                  style={
                    type === t
                      ? { background: '#0d9488', color: '#ffffff' }
                      : { background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }
                  }
                >
                  {leaveLabel(t)}
                </button>
              ))}
            </div>
          </div>

          {type === 'hourly' && (
            <div className="rounded-[14px] p-4" style={{ background: 'var(--bg-subtle)' }}>
              <label className="text-[15px] block mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                <Clock className="w-4 h-4" style={{ color: '#0d9488' }} />
                取得時間
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={hours}
                  onChange={(e) => setHours(Number(e.target.value) || 0)}
                  className="w-full max-w-full min-w-0 box-border rounded-[14px] px-4 py-3 pr-12 focus:outline-none focus:border-teal-500"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[13px]" style={{ color: 'var(--text-muted)' }}>時間</span>
              </div>
              <p className="text-[13px] mt-2" style={{ color: '#0d9488' }}>
                勤務時間 {workingHours}時間 → {days.toFixed(3)}日 換算
              </p>
            </div>
          )}

          <MemoField label="メモ（任意）" value={note} onChange={setNote} />

          <div className="rounded-[14px] px-4 py-3 flex justify-between items-center" style={{ background: 'var(--bg-subtle)' }}>
            <span className="text-[15px]" style={{ color: 'var(--text-secondary)' }}>取得日数</span>
            <span className="text-[28px] font-bold tabular-nums" style={{ color: '#0d9488' }}>{days.toFixed(3)} 日</span>
          </div>

          <button
            type="submit"
            className="btn-press w-full text-white rounded-[14px] py-3.5 font-semibold transition flex items-center justify-center gap-2"
            style={{ background: '#0d9488', color: '#ffffff' }}
          >
            <Check className="w-5 h-5" />
            {editing ? '更新する' : '登録する'}
          </button>

          {saved && <p className="text-center text-[15px] font-medium" style={{ color: '#0d9488' }}>{editing ? '更新しました' : '登録しました'}</p>}
          {error && (
            <div className="flex items-start gap-2 rounded-[14px] p-3.5" style={{ background: 'rgba(255, 59, 48, 0.08)' }}>
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'rgb(255, 59, 48)' }} />
              <p className="text-[14px] leading-relaxed" style={{ color: 'rgb(255, 59, 48)' }}>{error}</p>
            </div>
          )}
        </form>
      ) : (
        <form onSubmit={handleSpecialSubmit} className="space-y-5">
          <div className="w-full max-w-full min-w-0">
            <DatePicker
              value={spDate}
              onChange={setSpDate}
              required
              accent="amber"
            />
            <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>{formatDateJa(spDate)}</p>
          </div>

          <div>
            <label className="text-[15px] block mb-1.5" style={{ color: 'var(--text-secondary)' }}>特別休暇の種類</label>
            <div className="space-y-2">
              {specialLeaveTypes.length === 0 ? (
                <p className="text-[15px] text-center py-4" style={{ color: 'var(--text-muted)' }}>
                  特別休暇の種類がありません。設定画面から追加してください。
                </p>
              ) : (
                specialLeaveTypes.map((t) => {
                  const color = SPECIAL_LEAVE_COLORS[t.color] ?? SPECIAL_LEAVE_COLORS.slate;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSpTypeId(t.id)}
                      className={`btn-press w-full flex items-center justify-between p-3 rounded-[14px] transition ${
                        spTypeId === t.id ? '' : ''
                      }`}
                      style={
                        spTypeId === t.id
                          ? { background: 'var(--bg-card)', border: '1px solid #0d9488', boxShadow: '0 0.5px 1px rgba(0,0,0,0.04)' }
                          : { background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: '0 0.5px 1px rgba(0,0,0,0.04)' }
                      }
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${color.dot}`} />
                        <span className="text-[15px] font-medium" style={{ color: 'var(--text-primary)' }}>
                          {t.name}
                        </span>
                      </div>
                      <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>付与: {t.grantedDays}日</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <label className="text-[15px] block mb-1.5" style={{ color: 'var(--text-secondary)' }}>取得日数</label>
            <div className="relative">
              <input
                type="number"
                min={0}
                step={0.5}
                value={spDays}
                onChange={(e) => setSpDays(Number(e.target.value) || 0)}
                required
                className="w-full max-w-full min-w-0 box-border rounded-[14px] px-4 py-3 pr-12 focus:outline-none focus:border-teal-500"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[13px]" style={{ color: 'var(--text-muted)' }}>日</span>
            </div>
            {selectedSpType && (
              <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>
                残り {Math.max(0, selectedSpType.grantedDays - spDays).toFixed(1)} 日 / {selectedSpType.grantedDays} 日
              </p>
            )}
          </div>

          <MemoField label="メモ（任意）" value={spNote} onChange={setSpNote} />

          <button
            type="submit"
            disabled={!spTypeId}
            className="btn-press w-full text-white rounded-[14px] py-3.5 font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: '#0d9488', color: '#ffffff' }}
          >
            <Check className="w-5 h-5" />
            {editingSpecial ? '更新する' : '登録する'}
          </button>

          {spSaved && <p className="text-center text-[15px] font-medium" style={{ color: '#0d9488' }}>{editingSpecial ? '更新しました' : '登録しました'}</p>}
          {spError && (
            <div className="flex items-start gap-2 rounded-[14px] p-3.5" style={{ background: 'rgba(255, 59, 48, 0.08)' }}>
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'rgb(255, 59, 48)' }} />
              <p className="text-[14px] leading-relaxed" style={{ color: 'rgb(255, 59, 48)' }}>{spError}</p>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
