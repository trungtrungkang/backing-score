import { Metadata } from 'next';
import { getProject, getFileViewUrl } from '@/lib/appwrite';

type Props = {
  params: Promise<{ projectId: string }>
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await Promise.resolve(params);
  const projectId = resolvedParams.projectId;
  
  if (!projectId) {
    return { title: "Play | Backing & Score" };
  }

  try {
    const project = await getProject(projectId);
    const ogImage = project.coverUrl || 'https://backingscore.com/apple-icon.png';
    const description = `Play along with "${project.name}" — interactive sheet music with real-time score following.`;
    return {
      title: `${project.name}`,
      description,
      openGraph: {
        title: `${project.name} | Backing & Score`,
        description,
        type: "website",
        images: [
          {
            url: ogImage,
            width: 1200,
            height: 630,
            alt: project.name,
          }
        ]
      },
      twitter: {
        card: "summary_large_image",
        title: `${project.name} | Backing & Score`,
        description,
        images: [ogImage]
      },
      other: {
        "script:ld+json": JSON.stringify({
          "@context": "https://schema.org",
          "@type": "MusicComposition",
          name: project.name,
          ...(project.description && { description: project.description }),
          ...(project.publishedAt && { datePublished: project.publishedAt }),
          url: `https://backingscore.com/en/play/${projectId}`,
        }),
      },
    };
  } catch (e) {

    return {
      title: "Play | Backing & Score"
    };
  }
}

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
