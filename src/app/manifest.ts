import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cămara — cumpărături, rețete și buget",
    short_name: "Cămara",
    description: "Liste de cumpărături comune, rețete, planul meselor, cămara și bugetul gospodăriei.",
    lang: "ro",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f4ee",
    theme_color: "#1e3f2b",
    categories: ["food", "lifestyle", "shopping", "finance"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Pe Android, Cămara apare la „Partajează”: linkul sau textul unei rețete deschide importul (.tasks/009, etapa 4).
    share_target: { action: "/retete/import/", method: "GET", params: { title: "title", text: "text", url: "url" } },
    shortcuts: [
      { name: "Lista de cumpărături", url: "/cumparaturi/", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Planul meselor", url: "/plan/", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
