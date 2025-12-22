/**
 * Shop-related TypeScript interfaces
 */

export interface ShopItem {
  id: number;
  shop_id: number;
  item_id: number; // References items table (now required)
  price: number;
  stock: number; // -1 for unlimited
  stock_replenish?: number; // Hours until stock resets (NULL = no replenish)
  required_level?: number;
  required_street_cred?: number;
  // Joined from items table:
  name?: string;
  description?: string;
  item_type?: string;
  image_url?: string;
}

export interface Shop {
  id: number;
  zone_id?: number; // Physical shop in a zone
  subnet_id?: number; // Virtual shop in cyberspace
  name: string;
  shop_type: 'physical' | 'virtual' | 'protocol';
  poi_type: string; // 'shop' in points_of_interest
  description: string;
  image_url?: string;
  unlocked_at?: string;
  unlock_method?: string;
}

export interface ShopTransaction {
  id: number;
  user_id: number;
  shop_id: number;
  item_id: number;
  item_name: string;
  price: number;
  currency: 'credits' | 'street_cred';
  timestamp: string;
}
