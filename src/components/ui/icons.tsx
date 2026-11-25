import {
  AlertTriangle as LucideAlertTriangle,
  Archive as LucideArchive,
  ArrowLeft as LucideArrowLeft,
  ArrowRight as LucideArrowRight,
  Bell as LucideBell,
  CalendarPlus as LucideCalendarPlus,
  Camera as LucideCamera,
  Check as LucideCheck,
  ChefHat as LucideChefHat,
  ChevronDown as LucideChevronDown,
  ChevronLeft as LucideChevronLeft,
  ChevronRight as LucideChevronRight,
  Clock as LucideClock,
  Cloud as LucideCloud,
  CloudOff as LucideCloudOff,
  Copy as LucideCopy,
  Crown as LucideCrown,
  Download as LucideDownload,
  FileText as LucideFileText,
  Heart as LucideHeart,
  ImageIcon as LucideImageIcon,
  ListFilter as LucideListFilter,
  Loader2 as LucideLoader2,
  LogOut as LucideLogOut,
  MapPin as LucideMapPin,
  Mic as LucideMic,
  Minus as LucideMinus,
  MoreHorizontal as LucideMoreHorizontal,
  Pencil as LucidePencil,
  Plus as LucidePlus,
  RefreshCw as LucideRefreshCw,
  Scale as LucideScale,
  Search as LucideSearch,
  Settings as LucideSettings,
  Shapes as LucideShapes,
  Share2 as LucideShare2,
  Shield as LucideShield,
  ShieldCheck as LucideShieldCheck,
  SlidersHorizontal as LucideSlidersHorizontal,
  Store as LucideStore,
  Tags as LucideTags,
  Trash2 as LucideTrash2,
  Upload as LucideUpload,
  UserMinus as LucideUserMinus,
  Users as LucideUsers,
  WifiOff as LucideWifiOff,
  X as LucideX,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import type { ReactNode } from "react";

const ICON_STROKE = 1.75;

export interface IconProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

function Icon({ size = 24, strokeWidth = ICON_STROKE, className, children }: IconProps & { children: ReactNode }) {
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

/** Mic dejun: ceașcă caldă. */
export function MealMorningIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 10h11v4.5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V10z" />
      <path d="M16 11h1.8a2.2 2.2 0 0 1 0 4.4H16" />
      <path d="M8.5 5.2c0 1.1.8 1.5.8 2.5M12 4.5c0 1.1.8 1.5.8 2.5" />
    </Icon>
  );
}

/** Prânz: tacâmuri. */
export function MealNoonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 4v7.5a2.5 2.5 0 0 0 5 0V4" />
      <path d="M9.5 4v16" />
      <path d="M16.5 4v16" />
      <path d="M16.5 4c2.2 1.2 2.5 4.8 2.5 7.5h-2.5" />
    </Icon>
  );
}

/** Cină: semilună calmă. */
export function MealEveningIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M19.2 14.3A7.5 7.5 0 0 1 9.7 4.8a7.5 7.5 0 1 0 9.5 9.5z" />
      <path d="M16.5 5.5v2.2M15.4 6.6h2.2" />
    </Icon>
  );
}

/** Gustări: măr. */
export function MealSnackIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 7.5c-2.5-1.4-5.8.2-5.8 4.2 0 4.1 2.5 8 4.8 8 .8 0 1-.4 1-.4s.2.4 1 .4c2.3 0 4.8-3.9 4.8-8 0-4-3.3-5.6-5.8-4.2z" />
      <path d="M12 7.5c.2-1.8 1.2-3 2.8-3.3" />
    </Icon>
  );
}

/** Bol cald cu abur (medalion decorativ pentru „Azi la masă” fără fotografie). */
export function WarmBowlIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 12h15a7.5 7.5 0 0 1-15 0z" />
      <path d="M8.5 19.2h7" />
      <path d="M9 5.5c-.7.9.7 1.8 0 2.8M12 4.8c-.7.9.7 1.8 0 2.8M15 5.5c-.7.9.7 1.8 0 2.8" />
    </Icon>
  );
}

// Utility glyphs use the same rounded outline and default weight as the navigation.
function utilityIcon(Glyph: LucideIcon) {
  return function UtilityIcon({ strokeWidth = ICON_STROKE, ...props }: LucideProps) {
    return <Glyph strokeWidth={strokeWidth} {...props} />;
  };
}

export const AlertTriangle = utilityIcon(LucideAlertTriangle);
export const Archive = utilityIcon(LucideArchive);
export const ArrowLeft = utilityIcon(LucideArrowLeft);
export const ArrowRight = utilityIcon(LucideArrowRight);
export const Bell = utilityIcon(LucideBell);
export const CalendarPlus = utilityIcon(LucideCalendarPlus);
export const Camera = utilityIcon(LucideCamera);
export const Check = utilityIcon(LucideCheck);
export const ChefHat = utilityIcon(LucideChefHat);
export const ChevronDown = utilityIcon(LucideChevronDown);
export const ChevronLeft = utilityIcon(LucideChevronLeft);
export const ChevronRight = utilityIcon(LucideChevronRight);
export const Clock = utilityIcon(LucideClock);
export const Cloud = utilityIcon(LucideCloud);
export const CloudOff = utilityIcon(LucideCloudOff);
export const Copy = utilityIcon(LucideCopy);
export const Crown = utilityIcon(LucideCrown);
export const Download = utilityIcon(LucideDownload);
export const FileText = utilityIcon(LucideFileText);
export const Heart = utilityIcon(LucideHeart);
export const ImageIcon = utilityIcon(LucideImageIcon);
export const ListFilter = utilityIcon(LucideListFilter);
export const Loader2 = utilityIcon(LucideLoader2);
export const LogOut = utilityIcon(LucideLogOut);
export const MapPin = utilityIcon(LucideMapPin);
export const Mic = utilityIcon(LucideMic);
export const Minus = utilityIcon(LucideMinus);
export const MoreHorizontal = utilityIcon(LucideMoreHorizontal);
export const Pencil = utilityIcon(LucidePencil);
export const Plus = utilityIcon(LucidePlus);
export const RefreshCw = utilityIcon(LucideRefreshCw);
export const Scale = utilityIcon(LucideScale);
export const Search = utilityIcon(LucideSearch);
export const Settings = utilityIcon(LucideSettings);
export const Shapes = utilityIcon(LucideShapes);
export const Share2 = utilityIcon(LucideShare2);
export const Shield = utilityIcon(LucideShield);
export const ShieldCheck = utilityIcon(LucideShieldCheck);
export const SlidersHorizontal = utilityIcon(LucideSlidersHorizontal);
export const Store = utilityIcon(LucideStore);
export const Tags = utilityIcon(LucideTags);
export const Trash2 = utilityIcon(LucideTrash2);
export const Upload = utilityIcon(LucideUpload);
export const UserMinus = utilityIcon(LucideUserMinus);
export const Users = utilityIcon(LucideUsers);
export const WifiOff = utilityIcon(LucideWifiOff);
export const X = utilityIcon(LucideX);
