interface Props {
  title: string;
}

export function NavBar({ title }: Props) {
  return (
    <header
      className="fixed left-0 right-0 z-20 max-w-md mx-auto"
      style={{
        top: 0,
        width: '100%',
        height: 'calc(56px + env(safe-area-inset-top))',
        paddingTop: 'calc(env(safe-area-inset-top) + 8px)',
        background: 'color-mix(in srgb, var(--bg-card) 80%, transparent)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-default)',
      }}
    >
      <div className="h-full flex items-center justify-center px-4">
        <h1 className="text-[17px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h1>
      </div>
    </header>
  );
}
