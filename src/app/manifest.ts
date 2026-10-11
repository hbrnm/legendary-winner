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
    background_color: "#f7f5ef",
    theme_color: "#2f6b47",
    categories: ["food", "lifestyle", "shopping", "finance"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Lista de cumpărături", url: "/cumparaturi/", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Planul meselor", url: "/plan/", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
