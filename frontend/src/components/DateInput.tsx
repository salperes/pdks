import { useRef } from 'react';

interface DateInputProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  className?: string;
}

export default function DateInput({ value, onChange, className = '' }: DateInputProps) {
  const pickerRef = useRef<HTMLInputElement>(null);

  const formatted = value
    ? value.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3/$2/$1')
    : '';

  const openPicker = () => {
    const el = pickerRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      el.showPicker();
    } else {
      el.focus();
      el.click();
    }
  };

  return (
    <div className="relative inline-flex w-full">
      <input
        type="text"
        readOnly
        value={formatted}
        placeholder="GG/AA/YYYY"
        onClick={openPicker}
        className={`cursor-pointer ${className}`}
      />
      <input
        ref={pickerRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 pointer-events-none"
        tabIndex={-1}
      />
    </div>
  );
}
