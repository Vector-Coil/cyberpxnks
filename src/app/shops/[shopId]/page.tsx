"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { NavStrip, CxCard } from '../../../components/CxShared';
import NavDrawer from '../../../components/NavDrawer';
import { useNavData } from '../../../hooks/useNavData';
import { useAuthenticatedUser } from '../../../hooks/useAuthenticatedUser';

interface ShopDetails {
  id: number;
  name: string;
  shop_type: 'physical' | 'virtual' | 'protocol';
  description: string;
  shopkeeper_name?: string;
  shopkeeper_quote?: string;
  image_url?: string;
  zone_id?: number;
  zone_name?: string;
  subnet_id?: number;
}

interface ShopItem {
  id: number;
  shop_id: number;
  name: string;
  description: string;
  item_type: 'hardware' | 'slimsoft' | 'consumable' | 'gear';
  item_id?: number;
  price: number;
  currency: 'credits' | 'street_cred';
  stock: number;
  required_level?: number;
  required_street_cred?: number;
  image_url?: string;
}

export default function ShopPage({ params }: { params: Promise<{ shopId: string }> }) {
  const router = useRouter();
  const [shopId, setShopId] = useState<number | null>(null);
  const { userFid, isLoading: isAuthLoading } = useAuthenticatedUser();
  const navData = useNavData(userFid || 0);

  // Resolve params
  useEffect(() => {
    params.then(({ shopId: id }) => {
      setShopId(parseInt(id, 10));
    });
  }, [params]);

  const [shop, setShop] = useState<ShopDetails | null>(null);
  const [inventory, setInventory] = useState<ShopItem[]>([]);
  const [userLevel, setUserLevel] = useState<number>(1);
  const [userStreetCred, setUserStreetCred] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    if (!shopId || Number.isNaN(shopId) || !userFid || isAuthLoading) return;

    async function loadShopData() {
      try {
        setLoading(true);
        const [shopRes, inventoryRes, statsRes] = await Promise.all([
          fetch(`/api/shops/${shopId}/details?fid=${userFid}`),
          fetch(`/api/shops/${shopId}/inventory`),
          fetch(`/api/stats?fid=${userFid}`)
        ]);

        if (shopRes.ok) {
          const shopData = await shopRes.json();
          setShop(shopData);
        }

        if (inventoryRes.ok) {
          const invData = await inventoryRes.json();
          setInventory(invData.items || []);
        }

        if (statsRes.ok) {
          const stats = await statsRes.json();
          if (stats.level) setUserLevel(stats.level);
          if (stats.street_cred) setUserStreetCred(stats.street_cred);
        }
      } catch (err) {
        console.error('Failed to load shop:', err);
        setError('Failed to load shop data');
      } finally {
        setLoading(false);
      }
    }

    loadShopData();
  }, [shopId, userFid, isAuthLoading]);

  const handlePurchase = async (itemId: number) => {
    setPurchasing(itemId);
    setError(null);
    setSuccess(null);
    
    try {
      const res = await fetch(`/api/shops/purchase?fid=${userFid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId, itemId })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Purchase failed');
      }

      setSuccess(`Purchased ${data.item.name}!`);
      
      // Refresh inventory
      const invRes = await fetch(`/api/shops/${shopId}/inventory`);
      const invData = await invRes.json();
      setInventory(invData.items || []);

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
    if (item.currency === 'credits' && (navData?.cxBalance || 0) < item.price) return false;
    if (item.currency === 'street_cred' && userStreetCred < item.price) return false;
    if (item.stock === 0) return false;
    return true;
  };

  const getShopTypeIcon = () => {
    if (!shop) return '🛒';
    switch (shop.shop_type) {
      case 'physical': return '🏪';
      case 'virtual': return '💾';
      case 'protocol': return '🔗';
      default: return '🛒';
    }
  };

  if (loading || navData.loading || !shop) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin w-12 h-12 border-4 border-gray-600 border-t-fuschia rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <NavStrip 
        username={navData.username} 
        profileImage={navData.profileImage} 
        cxBalance={navData.cxBalance}
        onMenuClick={() => setIsDrawerOpen(true)}
      />
      <NavDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="mb-4 text-gray-400 hover:text-white transition-colors flex items-center gap-2"
        >
          <span>←</span> Back
        </button>

        {/* Shop Header */}
        <CxCard>
          <div className="flex gap-6 items-start mb-4">
            {shop.image_url && (
              <div className="w-32 h-32 flex-shrink-0">
                <img 
                  src={shop.image_url} 
                  alt={shop.shopkeeper_name || shop.name} 
                  className="w-full h-full object-cover rounded" 
                />
              </div>
            )}
            
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{getShopTypeIcon()}</span>
                <h1 className="text-white font-bold uppercase text-2xl">{shop.name}</h1>
              </div>
              
              {shop.shopkeeper_name && (
                <div className="text-gray-400 text-sm mb-2">
                  Proprietor: <span className="text-white">{shop.shopkeeper_name}</span>
                </div>
              )}
              
              <div className="flex items-center gap-2 mb-3">
                <span className="pill-cloud-gray uppercase text-xs">
                  {shop.shop_type} shop
                </span>
                {shop.zone_name && (
                  <span className="pill-cloud-gray text-xs">
                    📍 {shop.zone_name}
                  </span>
                )}
              </div>

              {shop.shopkeeper_quote && (
                <div className="italic text-gray-300 text-sm border-l-4 border-fuschia pl-3 mb-3">
                  "{shop.shopkeeper_quote}"
                </div>
              )}

              <p className="text-gray-400 text-sm">{shop.description}</p>
            </div>
          </div>
        </CxCard>

        {/* Messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-500 rounded text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-900/30 border border-green-500 rounded text-green-400 text-sm">
            {success}
          </div>
        )}

        {/* Inventory Grid */}
        <div className="mb-6">
          <h2 className="text-white font-bold uppercase text-xl mb-4">Available Items</h2>
          
          {inventory.length === 0 ? (
            <CxCard>
              <div className="text-center text-gray-400 py-8">No items available</div>
            </CxCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {inventory.map((item) => (
                <CxCard key={item.id}>
                  <div className="flex gap-3">
                    {item.image_url && (
                      <div className="w-20 h-20 flex-shrink-0">
                        <img 
                          src={item.image_url} 
                          alt={item.name} 
                          className="w-full h-full object-contain" 
                        />
                      </div>
                    )}
                    
                    <div className="flex-1">
                      <h3 className="text-white font-bold uppercase text-sm mb-1">{item.name}</h3>
                      <p className="text-gray-400 text-xs mb-2">{item.description}</p>
                      
                      <div className="flex items-center gap-2 mb-2">
                        <span className="pill-cloud-gray text-xs">{item.item_type}</span>
                        {item.stock >= 0 && (
                          <span className="text-gray-500 text-xs">Stock: {item.stock}</span>
                        )}
                      </div>

                      {(item.required_level || item.required_street_cred) && (
                        <div className="text-yellow-500 text-xs mb-2">
                          {item.required_level && `Lv ${item.required_level}+ `}
                          {item.required_street_cred && `${item.required_street_cred} Street Cred`}
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="text-white font-bold">
                          {item.price} {item.currency === 'credits' ? '¢' : 'SC'}
                        </div>
                        <button
                          onClick={() => handlePurchase(item.id)}
                          disabled={!canPurchase(item) || purchasing === item.id}
                          className={`cx-btn-primary px-4 py-2 text-xs ${
                            !canPurchase(item) || purchasing === item.id ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          {purchasing === item.id ? 'BUYING...' : 'BUY'}
                        </button>
                      </div>
                    </div>
                  </div>
                </CxCard>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
