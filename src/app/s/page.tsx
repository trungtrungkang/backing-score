import { Metadata } from 'next';
import { getProject, getFileViewUrl } from '@/lib/appwrite';
import ShareClientPage from './share-client';

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const resolvedParams = await Promise.resolve(searchParams);
  const projectId = typeof resolvedParams.p === 'string' ? resolvedParams.p : undefined;
  
  if (!projectId) {
    return { title: "Shared Project | Backing & Score" };
  }

  try {
    const project = await getProject(projectId);
    const ogImage = project.coverUrl || 'https://backingscore.com/apple-icon.png';
    return {
      title: `${project.name} | Backing & Score`,
      description: `Bản nhạc: ${project.name} (${project.difficulty || 'Normal'}) - Backing & Score`,
      openGraph: {
        title: `${project.name} | Backing & Score`,
        description: `Bản nhạc: ${project.name} (${project.difficulty || 'Normal'})`,
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
        description: `Bản nhạc: ${project.name} (${project.difficulty || 'Normal'})`,
        images: [ogImage]
      }
    };
  } catch (e) {
    return {
      title: "Shared Project | Backing & Score"
    };
  }
}

export default function SharePageWrapper() {
  return <ShareClientPage />;
}
