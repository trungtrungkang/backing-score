import type { MetadataRoute } from "next";
import { locales } from "@/i18n/routing";

const BASE_URL = "https://backingscore.com";

/**
 * Static routes that should appear in the sitemap.
 * Dynamic project/wiki pages require a server-side Appwrite API key
 * and can be added later for full coverage.
 */
const staticRoutes = [
  "/",
  "/discover",
  "/pricing",
  "/user-guide",
  "/wiki/artists",
  "/wiki/compositions",
  "/wiki/instruments",
  "/wiki/genres",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const route of staticRoutes) {
    // Build alternates for every supported locale
    const languages: Record<string, string> = {};
    for (const locale of locales) {
      languages[locale] = `${BASE_URL}/${locale}${route === "/" ? "" : route}`;
    }
    // x-default points to the default locale
    languages["x-default"] = `${BASE_URL}/en${route === "/" ? "" : route}`;

    entries.push({
      url: `${BASE_URL}/en${route === "/" ? "" : route}`,
      lastModified: new Date(),
      changeFrequency: route === "/" ? "weekly" : "monthly",
      priority: route === "/" ? 1.0 : route === "/discover" ? 0.9 : 0.7,
      alternates: { languages },
    });
  }

  return entries;
}
