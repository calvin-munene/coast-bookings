import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Coast Bookings",
    short_name: "Coast Bookings",
    description: "Verified Kenyan coastal stays and managed group accommodation.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f9fb",
    theme_color: "#08233e",
    categories: ["travel", "business"],
    icons: [
      { src: "/coastbookings-app-icon.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any" },
      { src: "/coastbookings-app-icon.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
