"use client";

import { forwardRef, useId, useRef, type InputHTMLAttributes, type KeyboardEvent, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

const FIELD =
  "w-full min-w-0 rounded-2xl border-0 bg-surface-container-high px-4 text-base text-on-surface placeholder:text-on-surface-variant shadow-card transition-colors duration-150 ease-out focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand aria-invalid:ring-2 aria-invalid:ring-error disabled:opacity-60";

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
  return <input ref={ref} data-autofocus={rest.autoFocus || undefined} className={`${FIELD} h-14 ${className}`} {...rest} />;
});

export function TextArea({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${FIELD} growing-textarea min-h-24 py-2.5 ${className}`} {...rest} />;
}

export function Select({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative w-full">
      <select
        className={`${FIELD} h-auto min-h-14 appearance-none py-4 pr-10 leading-normal ${className}`}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        size={18}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
        aria-hidden
      />
    </div>
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
    <div ref={containerRef} role="radiogroup" aria-label={label} className={`${options.length === 4 ? "grid grid-cols-2 min-[480px]:flex" : "flex"} gap-1 rounded-[28px] bg-surface-2 p-1`}>
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
            className={`min-h-12 min-w-0 flex-1 break-words rounded-3xl py-2 font-medium leading-tight transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-brand focus-visible:-outline-offset-2 ${options.length > 4 ? "px-1 text-xs" : "px-1.5 text-sm"} ${isSelected ? "bg-pill-active text-pill-active-ink shadow-card" : "text-ink-2 hover:text-ink"}`}
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
    <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4">
      <span className="flex flex-col">
        <span className="text-[15px] text-ink">{label}</span>
        {description && <span className="text-xs text-ink-2">{description}</span>}
      </span>
      <span className="relative inline-flex">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-8 w-14 rounded-full border-2 border-outline bg-surface-container-high transition-colors peer-checked:bg-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40" />
        <span className="absolute left-1.5 top-1.5 h-5 w-5 rounded-full bg-surface shadow-card transition-transform peer-checked:translate-x-6" />
      </span>
    </label>
  );
}
