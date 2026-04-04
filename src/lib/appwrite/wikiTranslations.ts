export async function getTranslationsForEntity(
  entityId: string,
  locale: string
): Promise<Record<string, string>> {
  return {};
}

export async function listTranslationsForEntity(
  entityId: string
): Promise<any[]> {
  return [];
}

export function applyTranslations<T extends Record<string, any>>(
  entity: T,
  translations: Record<string, string>
): T {
  if (Object.keys(translations).length === 0) return entity;
  const result = { ...entity };
  for (const [field, value] of Object.entries(translations)) {
    if (field in result) {
      (result as any)[field] = value;
    }
  }
  return result;
}
