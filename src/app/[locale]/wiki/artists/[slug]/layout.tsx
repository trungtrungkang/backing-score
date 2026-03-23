import { Metadata } from "next";
import { getArtistBySlug } from "@/lib/appwrite/artists";

type Props = {
  params: Promise<{ slug: string; locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const artist = await getArtistBySlug(slug);

  if (!artist) {
    return { title: "Artist | Backing & Score" };
  }

  const description = artist.bio
    ? artist.bio.substring(0, 160)
    : `${artist.name} — ${artist.roles?.join(", ") || "Musician"}`;

  return {
    title: `${artist.name} | Music Encyclopedia — Backing & Score`,
    description,
    openGraph: {
      title: `${artist.name} | Music Encyclopedia`,
      description,
      type: "profile",
      images: artist.imageUrl ? [{ url: artist.imageUrl, width: 400, height: 400, alt: artist.name }] : [],
    },
    twitter: {
      card: "summary",
      title: `${artist.name} | Music Encyclopedia`,
      description,
      images: artist.imageUrl ? [artist.imageUrl] : [],
    },
    other: {
      "script:ld+json": JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Person",
        name: artist.name,
        ...(artist.birthDate && { birthDate: artist.birthDate }),
        ...(artist.deathDate && { deathDate: artist.deathDate }),
        ...(artist.nationality && { nationality: artist.nationality }),
        ...(artist.bio && { description: artist.bio.substring(0, 500) }),
        ...(artist.imageUrl && { image: artist.imageUrl }),
      }),
    },
  };
}

export default function ArtistLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
