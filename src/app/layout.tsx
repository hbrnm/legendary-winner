import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { fontVariables } from "./fonts";
import { ActiveShoppingListProvider } from "@/components/shopping/active-list-provider";
import { AppProvider } from "@/components/app/app-provider";
import { ToastProvider } from "@/components/ui/toast";
import { InstallAppProvider } from "@/components/app/install-app";
import { ServiceWorker } from "@/components/app/service-worker";
import { THEME_BOOTSTRAP, THEME_COLORS } from "@/lib/theme";

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
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.luminos },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.intunecat },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ro" className={fontVariables} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="antialiased">
        <ToastProvider>
          <InstallAppProvider>
            <AppProvider><ActiveShoppingListProvider>{children}</ActiveShoppingListProvider></AppProvider>
          </InstallAppProvider>
        </ToastProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
