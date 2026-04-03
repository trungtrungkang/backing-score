import { account } from "./client";
import { isAppwriteConfigured } from "./constants";
import * as D1 from "@/app/actions/v5/favorites";
import type { FavoriteDocument } from "./types";

async function getUserIdFallback() {
  if (!isAppwriteConfigured()) return undefined;
  try {
    const user = await account.get();
    return user.$id;
  } catch {
    return undefined;
  }
}

export async function toggleFavorite(targetType: FavoriteDocument["targetType"], targetId: string): Promise<boolean> {
  return D1.toggleFavoriteV5(targetType, targetId, await getUserIdFallback());
}

export async function checkIsFavorited(targetType: FavoriteDocument["targetType"], targetId: string): Promise<boolean> {
  return D1.checkIsFavoritedV5(targetType, targetId, await getUserIdFallback());
}

export async function listMyFavorites(targetType?: FavoriteDocument["targetType"]): Promise<FavoriteDocument[]> {
  return D1.listMyFavoritesV5(targetType, await getUserIdFallback());
}

export async function removeAllFavoritesByTarget(targetType: FavoriteDocument["targetType"], targetId: string): Promise<void> {
  return D1.removeAllFavoritesByTargetV5(targetType, targetId, await getUserIdFallback());
}
