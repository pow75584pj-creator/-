import { Home, NotebookPen, BarChart3, Settings as SettingsIcon } from 'lucide-react';

export type Tab = 'home' | 'records' | 'stats' | 'settings';

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
}

const TABS: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'ホーム', icon: Home },
  { id: 'records', label: '記録', icon: NotebookPen },
  { id: 'stats', label: '分析', icon: BarChart3 },
  { id: 'settings', label: '設定', icon: SettingsIcon },
];

export function BottomNav({ active, onChange }: Props) {
  return (
    <nav
      className="fixed left-0 right-0 z-20"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom) + 32px)',
        width: '100%',
        height: '64px',
        paddingTop: '6px',
        paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
        background: 'color-mix(in srgb, var(--bg-card) 80%, transparent)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--border-default)',
      }}
    >
      <div className="grid grid-cols-4 h-full">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className="flex flex-col items-center justify-center gap-1 btn-press"
            >
              <Icon
                className="w-6 h-6 transition-colors duration-200"
                style={{ color: isActive ? '#0d9488' : 'var(--text-muted)' }}
                strokeWidth={isActive ? 2.2 : 1.8}
              />
              <span
                className="text-[10px] transition-colors duration-200"
                style={{
                  color: isActive ? '#0d9488' : 'var(--text-muted)',
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
