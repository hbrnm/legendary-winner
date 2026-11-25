"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Plus } from "@/components/ui/icons";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outlined" | "tonal";
type Size = "md" | "sm" | "lg" | "auto";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-brand-strong active:bg-brand-strong",
  secondary: "bg-secondary-container text-on-secondary-container hover:brightness-95",
  tonal: "bg-secondary-container text-on-secondary-container hover:brightness-95",
  outlined: "border border-outline text-brand hover:bg-brand-soft",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger: "bg-error-container text-on-error-container hover:brightness-95",
};

const SIZES: Record<Size, string> = {
  sm: "h-12 px-4 text-sm gap-1.5",
  md: "h-12 px-6 text-[15px] gap-2",
  lg: "h-14 px-8 text-base gap-2",
  auto: "min-h-11 px-4 py-2 text-sm gap-1.5",
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
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-medium transition duration-150 ease-out active:scale-[0.99] disabled:pointer-events-none disabled:bg-surface-container disabled:text-on-surface-variant focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${VARIANTS[variant]} ${SIZES[size]} ${block ? "w-full" : ""} ${className}`}
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
      className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-ink-2 transition duration-150 ease-out hover:bg-surface-2 hover:text-ink active:scale-[0.97] active:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-40 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export const AddButton = forwardRef<HTMLButtonElement, Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">>(function AddButton(
  { className = "", type = "button", ...props }, ref,
) {
  return (
    <button ref={ref} type={type} className={`add-affordance add-button ${className}`} {...props}>
      <Plus size={22} />
    </button>
  );
});

export function AddMark({ size = 16 }: { size?: number }) {
  return (
    <span className="add-affordance p-1" aria-hidden>
      <Plus size={size} />
    </span>
  );
}
