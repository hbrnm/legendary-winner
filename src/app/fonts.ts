import localFont from "next/font/local";

// Fonturile Cămarei, din fișiere locale (licență OFL, src/app/fonts/LICENSE-*),
// ca aplicația să nu depindă de rețea la build și să meargă offline. Fiecare font
// are două fișiere: latin și latin-ext (ă, ș, ț). În globals.css stau unul după
// altul în aceeași listă de fonturi, deci browserul ia din al doilea doar literele
// care lipsesc din primul. Fără font de rezervă ajustat: l-ar prinde înaintea
// fișierului latin-ext.
// (Opțiunile se scriu de fiecare dată: next/font le cere literale.)
const fraunces = localFont({ src: "./fonts/fraunces-latin-wght-normal.woff2", variable: "--font-fraunces", weight: "100 900", display: "swap", adjustFontFallback: false, preload: true });
const frauncesExt = localFont({ src: "./fonts/fraunces-latin-ext-wght-normal.woff2", variable: "--font-fraunces-ext", weight: "100 900", display: "swap", adjustFontFallback: false, preload: false });
const dmSans = localFont({ src: "./fonts/dm-sans-latin-wght-normal.woff2", variable: "--font-dm-sans", weight: "100 900", display: "swap", adjustFontFallback: false, preload: true });
const dmSansExt = localFont({ src: "./fonts/dm-sans-latin-ext-wght-normal.woff2", variable: "--font-dm-sans-ext", weight: "100 900", display: "swap", adjustFontFallback: false, preload: false });

/** Clasele care definesc variabilele fonturilor; se pun pe <html>. */
export const fontVariables = [fraunces, frauncesExt, dmSans, dmSansExt].map((f) => f.variable).join(" ");
