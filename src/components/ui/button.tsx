"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "sm" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-brand-ink hover:bg-brand-strong active:bg-brand-strong",
  secondary: "bg-surface-2 text-ink border border-line hover:border-ink-3",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger: "bg-accent-soft text-accent hover:brightness-95",
};

const SIZES: Record<Size, string> = {
  sm: "h-11 px-3 text-sm gap-1.5",
  md: "h-11 px-4 text-[15px] gap-2",
  lg: "h-13 px-5 text-base gap-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", icon, block, className = "", children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition duration-150 ease-out active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${VARIANTS[variant]} ${SIZES[size]} ${block ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});

export function IconButton({ label, className = "", children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-2 transition duration-150 ease-out hover:bg-surface-2 hover:text-ink active:scale-[0.97] active:bg-surface-2 focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-40 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
