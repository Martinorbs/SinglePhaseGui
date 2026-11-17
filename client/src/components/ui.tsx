import { useEffect, useState } from 'react';
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode
} from 'react';
import { parseDecimalInput } from '../../../shared/calculations';

export function cx(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(' ');
}

const fieldClass =
  'rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15';

export const inputClass = `w-full ${fieldClass}`;

export function Card({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        'rounded-2xl border border-stone-200/80 bg-white shadow-[0_1px_2px_rgba(28,42,46,0.04)]',
        className
      )}
    >
      {children}
    </section>
  );
}

export function SectionHeading({
  title,
  subtitle,
  right
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold tracking-wide text-stone-800">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-stone-500">{subtitle}</p>
        ) : null}
      </div>
      {right}
    </div>
  );
}

type Tone = 'neutral' | 'teal' | 'amber' | 'red' | 'blue';

const badgeTones: Record<Tone, string> = {
  neutral: 'bg-stone-100 text-stone-600 ring-stone-200',
  teal: 'bg-teal-50 text-teal-800 ring-teal-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  blue: 'bg-cyan-50 text-cyan-800 ring-cyan-200'
};

export function Badge({
  tone = 'neutral',
  children,
  className
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        badgeTones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-11 w-14 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-teal-600/30 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span
        className={cx(
          'relative flex h-8 w-14 items-center rounded-full p-1 transition-colors',
          checked ? 'bg-teal-700' : 'bg-stone-300'
        )}
      >
        <span
          aria-hidden
          className={cx(
            'inline-block h-6 w-6 rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-6' : 'translate-x-0'
          )}
        />
      </span>
    </button>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-teal-700 text-white hover:bg-teal-800',
  secondary:
    'border border-stone-300 bg-white text-stone-700 hover:bg-stone-50',
  ghost: 'text-stone-600 hover:bg-stone-100',
  danger: 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
};

export function Button({
  variant = 'secondary',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
}) {
  return (
    <button
      className={cx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        buttonVariants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
  className
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx('block space-y-1', className)}>
      <span className="block text-xs font-medium text-stone-600">{label}</span>
      {children}
      {hint ? <span className="block text-[11px] text-stone-400">{hint}</span> : null}
    </label>
  );
}

type NumberInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange'
> & {
  value: number;
  onChange: (value: number) => void;
  fallback?: number;
};

function formatDecimalInput(value: number): string {
  return Number.isFinite(value) ? String(value).replace('.', ',') : '0';
}

export function NumberInput({
  value,
  onChange,
  fallback = 0,
  className,
  onFocus,
  onBlur,
  ...props
}: NumberInputProps) {
  const [text, setText] = useState(() => formatDecimalInput(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setText(formatDecimalInput(value));
  }, [value, editing]);

  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      className={cx(fieldClass, 'tnum', className ?? 'w-full')}
      value={text}
      onFocus={(event) => {
        setEditing(true);
        onFocus?.(event);
      }}
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        onChange(parseDecimalInput(next, fallback));
      }}
      onBlur={(event) => {
        const parsed = parseDecimalInput(text, fallback);
        setEditing(false);
        setText(formatDecimalInput(parsed));
        onChange(parsed);
        onBlur?.(event);
      }}
    />
  );
}

export function Progress({
  percent,
  tone = 'teal',
  className
}: {
  percent: number;
  tone?: 'teal' | 'amber' | 'red' | 'blue' | 'stone';
  className?: string;
}) {
  const tones: Record<string, string> = {
    teal: 'bg-teal-600',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    blue: 'bg-cyan-600',
    stone: 'bg-stone-400'
  };
  return (
    <div className={cx('h-1.5 w-full overflow-hidden rounded-full bg-stone-100', className)}>
      <div
        className={cx('h-full rounded-full transition-[width]', tones[tone])}
        style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
      />
    </div>
  );
}
