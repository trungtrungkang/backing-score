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
      title: "Play | Backing & Score"
    };
  }
}

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
