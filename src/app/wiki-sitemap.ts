import { MetadataRoute } from "next";
import { listArtists } from "@/lib/appwrite/artists";
import { listInstruments } from "@/lib/appwrite/instruments";
import { listCompositions } from "@/lib/appwrite/compositions";
import { listGenres } from "@/lib/appwrite/genres";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://backingscore.com";
const LOCALES = ["en", "vi", "fr", "de", "es", "ja", "ko", "zh-CN", "zh-TW"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [artists, instruments, compositions, genres] = await Promise.all([
    listArtists(200),
    listInstruments(200),
    listCompositions(200),
    listGenres(200),
  ]);

  const entries: MetadataRoute.Sitemap = [];

  // Wiki hub page for each locale
  for (const locale of LOCALES) {
    entries.push({
      url: `${BASE_URL}/${locale}/wiki`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  // Artist pages
  for (const artist of artists) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${BASE_URL}/${locale}/wiki/artists/${artist.slug}`,
        lastModified: new Date(artist.$updatedAt),
        changeFrequency: "monthly",
        priority: 0.7,
      });
    }
  }

  // Instrument pages
  for (const inst of instruments) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${BASE_URL}/${locale}/wiki/instruments/${inst.slug}`,
        lastModified: new Date(inst.$updatedAt),
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  }

  // Composition pages
  for (const comp of compositions) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${BASE_URL}/${locale}/wiki/compositions/${comp.slug}`,
        lastModified: new Date(comp.$updatedAt),
        changeFrequency: "monthly",
        priority: 0.7,
      });
    }
  }

  // Genre pages
  for (const genre of genres) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${BASE_URL}/${locale}/wiki/genres/${genre.slug}`,
        lastModified: new Date(genre.$updatedAt),
        changeFrequency: "monthly",
        priority: 0.5,
      });
    }
  }

  return entries;
}
