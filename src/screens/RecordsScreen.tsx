import { useEffect, useState } from 'react';
import type { AppState, LeaveRecord, SpecialLeaveRecord, SpecialLeaveType, ExpiryRecord, GrantRecord } from '@/types';
import { RegisterScreen } from '@/screens/RegisterScreen';
import { CalendarScreen } from '@/screens/CalendarScreen';
import { HistoryScreen } from '@/screens/HistoryScreen';
import { CalendarPlus, CalendarDays, History } from 'lucide-react';

interface Props {
  state: AppState;
  editing: LeaveRecord | null;
  editingSpecial: SpecialLeaveRecord | null;
  onAdd: (record: Omit<LeaveRecord, 'id' | 'createdAt'>) => void;
  onUpdate: (id: string, record: Omit<LeaveRecord, 'id' | 'createdAt'>) => void;
  onCancelEdit: () => void;
  onAddSpecial: (record: Omit<SpecialLeaveRecord, 'id' | 'createdAt'>) => void;
  onUpdateSpecial: (id: string, record: Omit<SpecialLeaveRecord, 'id' | 'createdAt'>) => void;
  onCancelEditSpecial: () => void;
  onEdit: (record: LeaveRecord) => void;
  onDelete: (id: string) => void;
  onEditSpecial: (record: SpecialLeaveRecord) => void;
  onDeleteSpecial: (id: string) => void;
  onDeleteExpiry: (id: string) => void;
  onDeleteGrant: (id: string) => void;
}

type Segment = 'register' | 'calendar' | 'history';

export function RecordsScreen(props: Props) {
  const { state, editing, editingSpecial } = props;
  const [segment, setSegment] = useState<Segment>(editing || editingSpecial ? 'register' : 'history');

  useEffect(() => {
    if (editing || editingSpecial) setSegment('register');
  }, [editing, editingSpecial]);

  const segments: { id: Segment; label: string; icon: typeof CalendarPlus }[] = [
    { id: 'register', label: '新規登録', icon: CalendarPlus },
    { id: 'calendar', label: 'カレンダー', icon: CalendarDays },
    { id: 'history', label: '履歴', icon: History },
  ];

  return (
    <div className="px-4 min-w-0 screen-enter">
      {/* iOS-style segmented control */}
      <div
        className="grid grid-cols-3 gap-1 p-1 rounded-[14px] mb-5"
        style={{ background: 'var(--bg-subtle)' }}
      >
        {segments.map(({ id, label, icon: Icon }) => {
          const isActive = segment === id;
          return (
            <button
              key={id}
              onClick={() => setSegment(id)}
              className="btn-press flex items-center justify-center gap-1.5 py-2 rounded-[10px] text-[13px] font-medium transition-all duration-200"
              style={
                isActive
                  ? { background: 'var(--bg-card)', color: '#0d9488', boxShadow: '0 0.5px 1px rgba(0,0,0,0.04)' }
                  : { color: 'var(--text-muted)' }
              }
            >
              <Icon className="w-[15px] h-[15px]" />
              {label}
            </button>
          );
        })}
      </div>

      {segment === 'register' && (
        <RegisterScreen
          workingHours={state.settings.workingHours}
          editing={editing}
          editingSpecial={editingSpecial}
          specialLeaveTypes={state.specialLeaveTypes}
          existingRecords={state.records}
          existingSpecialRecords={state.specialLeaveRecords}
          onAdd={props.onAdd}
          onUpdate={props.onUpdate}
          onCancelEdit={props.onCancelEdit}
          onAddSpecial={props.onAddSpecial}
          onUpdateSpecial={props.onUpdateSpecial}
          onCancelEditSpecial={props.onCancelEditSpecial}
        />
      )}
      {segment === 'calendar' && <CalendarScreen state={state} />}
      {segment === 'history' && (
        <HistoryScreen
          records={state.records}
          expiryRecords={state.expiryRecords}
          grantRecords={state.grantRecords}
          specialLeaveRecords={state.specialLeaveRecords}
          specialLeaveTypes={state.specialLeaveTypes}
          workingHours={state.settings.workingHours}
          settings={state.settings}
          onEdit={props.onEdit}
          onDelete={props.onDelete}
          onEditSpecial={props.onEditSpecial}
          onDeleteSpecial={props.onDeleteSpecial}
          onDeleteExpiry={props.onDeleteExpiry}
          onDeleteGrant={props.onDeleteGrant}
        />
      )}
    </div>
  );
}
