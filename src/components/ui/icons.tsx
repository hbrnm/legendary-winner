import type { ReactNode } from "react";

// Iconițele Cămarei, desenate pentru aplicație (.tasks/017, etapa 3): linie
// rotunjită, ușor neregulată, ca trasă de mână. Același API ca lucide-react
// (size, strokeWidth, className), ca să se poată pune în locul lor.

export interface IconProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

function Icon({ size = 24, strokeWidth = 1.75, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** Acasă: căsuța cu horn. */
export function HouseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.6 11.2 12.1 3.8l8.3 7.3" />
      <path d="M5.4 9.9v9.4c0 .5.3.8.8.8h11.7c.5 0 .8-.3.8-.8V9.8" />
      <path d="M10 20.1v-5.3c0-.6.4-1 1-1h2.1c.6 0 1 .4 1 1v5.3" />
      <path d="M16.3 6.6V4.4h2v3.9" />
    </Icon>
  );
}

/** Cumpărături: coșul împletit. */
export function BasketIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7.2 10.4c.4-3.7 2.3-6 4.9-6s4.4 2.3 4.7 6" />
      <path d="M3.3 10.5h17.4" />
      <path d="M4.4 10.6l1.6 8.1c.1.7.7 1.2 1.4 1.2h9.2c.7 0 1.3-.5 1.4-1.2l1.6-8.1" />
      <path d="M9.2 13.4l.4 3.8M12.1 13.3v3.9M14.9 13.4l-.4 3.8" />
    </Icon>
  );
}

/** Rețete: caietul deschis, cu semn de carte. */
export function RecipeBookIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 6.3c-1.9-1.4-4.7-1.9-8.4-1.6v13.1c3.6-.3 6.4.2 8.4 1.7 2-1.5 4.8-2 8.4-1.7V4.7c-3.7-.3-6.5.2-8.4 1.6z" />
      <path d="M12 6.4v13" />
      <path d="M15.6 5.4v5l1.3-1 1.3 1V5.2" />
    </Icon>
  );
}

/** Buget: portofelul cu încuietoare. */
export function PurseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.2 9.6c0-1 .8-1.8 1.8-1.8h12.2c1 0 1.8.8 1.8 1.8v8.6c0 1-.8 1.8-1.8 1.8H6c-1 0-1.8-.8-1.8-1.8z" />
      <path d="M8.3 7.8c0-2.2 1.7-3.6 3.8-3.6s3.7 1.4 3.7 3.6" />
      <path d="M15.4 13.9h1.8" />
    </Icon>
  );
}

/** Cămară: borcanul cu capac și etichetă. */
export function JarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7.6 3.9h8.8c.4 0 .7.3.7.7v1.6c0 .4-.3.7-.7.7H7.6c-.4 0-.7-.3-.7-.7V4.6c0-.4.3-.7.7-.7z" />
      <path d="M7.8 7c-1.5.9-2.4 2.3-2.4 4.1v7.2c0 1 .8 1.8 1.8 1.8h9.6c1 0 1.8-.8 1.8-1.8v-7.2c0-1.8-.9-3.2-2.4-4.1" />
      <path d="M8.2 12.3h7.6v4.1H8.2z" />
    </Icon>
  );
}

/** Bonul fiscal, cu marginea ruptă. */
export function ReceiptIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6.2 3.6h11.6v16.9l-1.9-1.3-1.9 1.4-2-1.4-1.9 1.4-2-1.4-1.9 1.3z" />
      <path d="M9.1 8h5.8M9.1 11.2h5.8M9.1 14.4h3.4" />
    </Icon>
  );
}

/** Istoricul: carnețelul cu spirală. */
export function NotebookIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6.8 3.8h10.6c.7 0 1.2.5 1.2 1.2v14.1c0 .7-.5 1.2-1.2 1.2H6.8z" />
      <path d="M4.6 7.2h3.6M4.6 12h3.6M4.6 16.8h3.6" />
      <path d="M10.8 8.2h5M10.8 11.5h5M10.8 14.8h3.2" />
    </Icon>
  );
}

/** „Se reia”: săgeata în cerc. */
export function AgainIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M19.2 12.6a7.2 7.2 0 1 1-2.3-5.6" />
      <path d="M17.6 3.9l-.6 3.3-3.3-.4" />
    </Icon>
  );
}
