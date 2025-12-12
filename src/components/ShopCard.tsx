"use client";
import React, { useState } from 'react';
import { CxCard } from './CxShared';
import type { Shop, ShopItem } from '../types/shop';

interface ShopCardProps {
  shop: Shop;
  userCredits: number;
  userStreetCred: number;
  userLevel: number;
  userFid: number;
  onPurchaseComplete?: () => void;
}

export default function ShopCard({ 
  shop, 
  userCredits, 
  userStreetCred, 
  userLevel,
  userFid,
  onPurchaseComplete
}: ShopCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [inventory, setInventory] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleExpand = async () => {
    if (!isExpanded && inventory.length === 0) {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/shops/${shop.id}/inventory`);
        if (!res.ok) throw new Error('Failed to load inventory');
        const data = await res.json();
        setInventory(data.items || []);
      } catch (err: any) {
        console.error('Failed to load shop inventory:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    setIsExpanded(!isExpanded);
  };

  const handlePurchase = async (itemId: number) => {
    setPurchasing(itemId);
    setError(null);
    setSuccess(null);
    
    try {
      const res = await fetch(`/api/shops/purchase?fid=${userFid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId: shop.id, itemId })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Purchase failed');
      }

      setSuccess(`Purchased ${data.item.name}!`);
      
      // Refresh inventory
      const invRes = await fetch(`/api/shops/${shop.id}/inventory`);
      const invData = await invRes.json();
      setInventory(invData.items || []);
      
      // Notify parent to refresh user data
      if (onPurchaseComplete) {
        onPurchaseComplete();
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Purchase error:', err);
      setError(err.message);
    } finally {
      setPurchasing(null);
    }
  };

  const canPurchase = (item: ShopItem): boolean => {
    if (item.required_level && userLevel < item.required_level) return false;
    if (item.required_street_cred && userStreetCred < item.required_street_cred) return false;
    if (item.currency === 'credits' && userCredits < item.price) return false;
    if (item.currency === 'street_cred' && userStreetCred < item.price) return false;
    if (item.stock === 0) return false;
    return true;
  };

        {/* Expanded Inventory */}
        {isExpanded && (
          <div className="border-t border-gray-700 pt-3">
            {error && (
              <div className="mb-3 p-2 bg-red-900/30 border border-red-500 rounded text-red-400 text-xs">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-3 p-2 bg-green-900/30 border border-green-500 rounded text-green-400 text-xs">
                {success}
              </div>
            )}
            {loading ? (turn '💾';
      case 'protocol': return '🔗';
      default: return '🛒';
    }
  };

  return (
    <CxCard>
      <div className="space-y-3">
        {/* Shop Header */}
        <div className="flex gap-4 items-start">
          {shop.image_url && (
            <div className="w-[75px] h-[75px] flex-shrink-0">
              <img 
                src={shop.image_url} 
                alt={shop.name} 
                className="w-full h-full object-contain" 
              />
            </div>
          )}
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{getShopTypeIcon()}</span>
              <h3 className="text-white font-bold uppercase text-sm">{shop.name}</h3>
            </div>
            <p className="text-gray-400 text-xs mb-2">{shop.description}</p>
            <span className="pill-cloud-gray uppercase text-xs">
              {shop.shop_type} shop
            </span>
          </div>

          <button
            onClick={handleExpand}
            className="cx-btn-primary px-4 py-2 text-xs"
          >
            {isExpanded ? 'CLOSE' : 'BROWSE'}
          </button>
        </div>

        {/* Expanded Inventory */}
        {isExpanded && (
          <div className="border-t border-gray-700 pt-3">
            {loading ? (
              <div className="text-center py-4">
                <div className="animate-spin w-8 h-8 border-4 border-gray-600 border-t-fuschia rounded-full mx-auto"></div>
              </div>
            ) : inventory.length === 0 ? (
              <div className="text-center text-gray-400 py-4">No items available</div>
            ) : (
              <div className="space-y-2">
                <div className="text-fuschia font-bold uppercase text-xs mb-2">Available Items</div>
                {inventory.map((item) => (
                  <div 
                    key={item.id} 
                    className="flex items-center justify-between p-2 bg-gray-900/50 rounded border border-gray-700"
                  >
                    <div className="flex-1">
                      <div className="text-white font-bold text-xs mb-1">{item.name}</div>
                      <div className="text-gray-400 text-xs mb-1">{item.description}</div>
                      <div className="flex items-center gap-2">
                        <span className="pill-cloud-gray text-xs">{item.item_type}</span>
                        {item.stock >= 0 && (
                          <span className="text-gray-500 text-xs">Stock: {item.stock}</span>
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-white font-bold text-sm">
                        {item.price} {item.currency === 'credits' ? '¢' : 'SC'}
                      </div>
                      <button
                        onClick={() => handlePurchase(item.id)}
                        disabled={!canPurchase(item) || purchasing === item.id}
                        className={`cx-btn-primary px-3 py-1 text-xs ${
                          !canPurchase(item) || purchasing === item.id ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        {purchasing === item.id ? 'BUYING...' : 'BUY'}
                      </button>
                    </div>v>
                      <button
                        onClick={() => onPurchase(shop.id, item.id)}
                        disabled={!canPurchase(item)}
                        className={`cx-btn-primary px-3 py-1 text-xs ${
                          !canPurchase(item) ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        BUY
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </CxCard>
  );
}
