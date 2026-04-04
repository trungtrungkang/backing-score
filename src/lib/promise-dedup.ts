const cache = new Map<string, Promise<any>>();

export function dedup<T>(key: string, fn: () => Promise<T>, ttlMs = 1000): Promise<T> {
  if (cache.has(key)) {
    return cache.get(key) as Promise<T>;
  }
  const p = fn().finally(() => {
    setTimeout(() => cache.delete(key), ttlMs);
  });
  cache.set(key, p);
  return p;
}

export function withDedup<T extends (...args: any[]) => Promise<any>>(keyPrefix: string, fn: T, ttlMs = 1000): T {
  return ((...args: any[]) => {
    // Cannot rely on fn.name for Server Actions because they are named ""
    const key = keyPrefix + ":" + JSON.stringify(args);
    return dedup(key, () => fn(...args), ttlMs);
  }) as unknown as T;
}
