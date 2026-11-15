import localFont from "next/font/local";

// DM Sans din fișiere locale (licență OFL, src/app/fonts/LICENSE-dm-sans.txt),
// ca aplicația să nu depindă de rețea la build și să meargă offline. Fiecare font
// are două fișiere: latin și latin-ext (ă, ș, ț). În globals.css stau unul după
// altul în aceeași listă de fonturi, deci browserul ia din al doilea doar literele
// care lipsesc din primul. Fără font de rezervă ajustat: l-ar prinde înaintea
// fișierului latin-ext.
// (Opțiunile se scriu de fiecare dată: next/font le cere literale.)
const dmSans = localFont({ src: "./fonts/dm-sans-latin-wght-normal.woff2", variable: "--font-dm-sans", weight: "100 900", display: "swap", adjustFontFallback: false, preload: true });
const dmSansExt = localFont({ src: "./fonts/dm-sans-latin-ext-wght-normal.woff2", variable: "--font-dm-sans-ext", weight: "100 900", display: "swap", adjustFontFallback: false, preload: false });

/** Clasele care definesc variabilele fonturilor; se pun pe <html>. */
export const fontVariables = [dmSans, dmSansExt].map((f) => f.variable).join(" ");
