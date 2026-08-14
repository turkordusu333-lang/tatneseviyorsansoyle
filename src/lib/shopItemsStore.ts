import { StoreItem } from '../types';
import { API_BASE_URL } from './apiConfig';

let shopItemsCache: StoreItem[] = [];
let isFetching = false;
const listeners = new Set<(items: StoreItem[]) => void>();

export function getShopItemsCache(): StoreItem[] {
  return shopItemsCache;
}

export function findShopItem(id?: string): StoreItem | undefined {
  if (!id) return undefined;
  return shopItemsCache.find((item) => item.id === id);
}

export function setShopItemsCache(items: StoreItem[]): void {
  shopItemsCache = items;
  listeners.forEach((fn) => fn(shopItemsCache));
}

export async function loadShopItems(): Promise<StoreItem[]> {
  if (isFetching) return shopItemsCache;
  isFetching = true;
  try {
    const res = await fetch(`${API_BASE_URL}/api/shop/items`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        shopItemsCache = data;
        listeners.forEach((fn) => fn(shopItemsCache));
      }
    }
  } catch (e) {
    console.error('[ShopStore] Failed to fetch shop items:', e);
  } finally {
    isFetching = false;
  }
  return shopItemsCache;
}

export function subscribeShopItems(listener: (items: StoreItem[]) => void): () => void {
  listeners.add(listener);
  if (shopItemsCache.length > 0) {
    listener(shopItemsCache);
  } else {
    loadShopItems();
  }
  return () => {
    listeners.delete(listener);
  };
}
