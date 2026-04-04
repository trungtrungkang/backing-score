import * as D1 from "@/app/actions/v5/favorites";
import type { FavoriteDocument } from "./types";

export async function toggleFavorite(targetType: FavoriteDocument["targetType"], targetId: string): Promise<boolean> {
  return D1.toggleFavoriteV5(targetType, targetId, undefined);
}

export async function checkIsFavorited(targetType: FavoriteDocument["targetType"], targetId: string): Promise<boolean> {
  return D1.checkIsFavoritedV5(targetType, targetId, undefined);
}

export async function listMyFavorites(targetType?: FavoriteDocument["targetType"]): Promise<FavoriteDocument[]> {
  return D1.listMyFavoritesV5(targetType, undefined);
}

export async function removeAllFavoritesByTarget(targetType: FavoriteDocument["targetType"], targetId: string): Promise<void> {
  return D1.removeAllFavoritesByTargetV5(targetType, targetId, undefined);
}
