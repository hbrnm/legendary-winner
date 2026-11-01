"use client";

import { forwardRef, useId, useRef, type InputHTMLAttributes, type KeyboardEvent, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

const FIELD =
  "w-full rounded-lg border border-line bg-surface px-3.5 text-base text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:opacity-60";

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  hintId,
  errorId,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  htmlFor?: string;
  hintId?: string;
  errorId?: string;
}) {
  const finalErrorId = errorId ?? (htmlFor ? `${htmlFor}-error` : undefined);
  const finalHintId = hintId ?? (htmlFor ? `${htmlFor}-hint` : undefined);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink-2">
        {label}
      </label>
      {children}
      {error ? (
        <p id={finalErrorId} role="alert" className="text-sm text-accent">
          {error}
        </p>
      ) : hint ? (
        <p id={finalHintId} className="text-xs text-ink-2">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className = "", ...rest }, ref) {
  return <input ref={ref} className={`${FIELD} h-11 ${className}`} {...rest} />;
});

export function TextArea({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${FIELD} min-h-24 py-2.5 ${className}`} {...rest} />;
}

export function Select({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${FIELD} h-11 appearance-none bg-[length:16px] pr-9 ${className}`} {...rest}>
      {children}
    </select>
  );
}

/** Câmp etichetat într-un singur rând de cod. */
export function LabeledInput({
  label,
  hint,
  error,
  id: explicitId,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string | null }) {
  const generatedId = useId();
  const id = explicitId ?? generatedId;
  const errorId = error ? `${id}-error` : undefined;
  const hintId = !error && hint ? `${id}-hint` : undefined;
  const describedBy = errorId ?? hintId ?? rest["aria-describedby"];

  return (
    <Field label={label} hint={hint} error={error} htmlFor={id} errorId={errorId} hintId={hintId}>
      <Input
        id={id}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
    </Field>
  );
}

export function LabeledSelect({
  label,
  hint,
  error,
  id: explicitId,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string; error?: string | null }) {
  const generatedId = useId();
  const id = explicitId ?? generatedId;
  const errorId = error ? `${id}-error` : undefined;
  const hintId = !error && hint ? `${id}-hint` : undefined;
  const describedBy = errorId ?? hintId ?? rest["aria-describedby"];

  return (
    <Field label={label} hint={hint} error={error} htmlFor={id} errorId={errorId} hintId={hintId}>
      <Select
        id={id}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        {...rest}
      >
        {children}
      </Select>
    </Field>
  );
}

/** Butoane de tip „segment” (ex. Lunar / Săptămânal) conforme WAI-ARIA radio group cu navigare tastatură (F13). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let nextIndex = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % options.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      nextIndex = (currentIndex - 1 + options.length) % options.length;
    }

    if (nextIndex >= 0) {
      const nextOption = options[nextIndex];
      onChange(nextOption.value);
      const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>('button[role="radio"]');
      buttons?.[nextIndex]?.focus();
    }
  };

  return (
    <div ref={containerRef} role="radiogroup" aria-label={label} className="flex rounded-lg bg-surface-2 p-1">
      {options.map((o, idx) => {
        const isSelected = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`h-11 min-w-0 flex-1 rounded-md px-1.5 text-sm font-medium leading-tight transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-brand ${isSelected ? "bg-surface text-ink shadow-card" : "text-ink-2 hover:text-ink"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
      <span className="flex flex-col">
        <span className="text-[15px] text-ink">{label}</span>
        {description && <span className="text-xs text-ink-2">{description}</span>}
      </span>
      <span className="relative inline-flex">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-7 w-12 rounded-full bg-line transition-colors peer-checked:bg-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40" />
        <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-surface shadow-card transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
