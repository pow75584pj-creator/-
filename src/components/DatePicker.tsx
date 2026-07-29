import { useId } from 'react';

type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  accent?: 'teal' | 'amber';
  id?: string;
};

export function DatePicker({ value, onChange, label, required, accent = 'teal', id }: DatePickerProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  void accent;

  return (
    <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-[15px] block mb-1.5"
          style={{ color: 'var(--text-secondary)' }}
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        type="date"
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          display: 'block',
          appearance: 'none',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          color: 'var(--text-primary)',
        }}
        className="rounded-[14px] px-4 py-3 focus:outline-none focus:border-teal-500"
      />
    </div>
  );
}
