export {
    listPublishedV5 as listPublished,
    listTrendingV5 as listTrending,
    listFeaturedV5 as listFeatured,
    listMostFavoritedV5 as listMostFavorited,
    listRecentlyPublishedV5 as listRecentlyPublished,
    listMyProjectsV5 as listMyProjects,
    getProjectV5 as getProject,
    createProjectV5 as createProject,
    updateProjectV5 as updateProject,
    deleteProjectV5 as deleteProject
} from "@/app/actions/v5/projects";

export async function incrementPlayCount(id: string) { return null; }
export async function listProjects(queries?: any[]) { return { documents: [], total: 0 }; }
export async function publishMyProject(id: string, published: boolean) { return null; }
export async function setFeatured(id: string, featured: boolean) { return null; }
export async function copyProjectToMine(projectId: string) { return null; }
export async function listProjectsByArtist() { return []; }
export async function listProjectsByComposition() { return []; }
