/**
 * Shop-related TypeScript interfaces
 */

export interface ShopItem {
  id: number;
  shop_id: number;
  name: string;
  description: string;
  item_type: 'hardware' | 'slimsoft' | 'consumable' | 'gear';
  item_id?: number; // References the actual item in hardware/slimsoft tables
  price: number;
  currency: 'credits' | 'street_cred';
  stock: number; // -1 for unlimited
  required_level?: number;
  required_street_cred?: number;
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
