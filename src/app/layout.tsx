import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppProvider } from "@/components/app/app-provider";
import { ToastProvider } from "@/components/ui/toast";
import { ServiceWorker } from "@/components/app/service-worker";

export const metadata: Metadata = {
  title: { default: "Cămara", template: "%s · Cămara" },
  description: "Cumpărături, rețete, planul meselor și bugetul gospodăriei, într-un singur loc.",
  applicationName: "Cămara",
  appleWebApp: { capable: true, title: "Cămara", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5ef" },
    { media: "(prefers-color-scheme: dark)", color: "#121513" },
  ],
};

// Aplică tema aleasă înainte de afișare, ca să nu clipească ecranul.
const THEME_SCRIPT = `try{var t=localStorage.getItem("camara-tema");if(t==="luminos"||t==="intunecat")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ro" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="antialiased">
        <ToastProvider>
          <AppProvider>{children}</AppProvider>
        </ToastProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
