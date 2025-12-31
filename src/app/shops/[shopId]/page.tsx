"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { NavStrip, CxCard } from '../../../components/CxShared';
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
  const [isAdminShop, setIsAdminShop] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);

  useEffect(() => {
    if (!shopId || Number.isNaN(shopId) || !userFid || isAuthLoading) return;

    async function loadShopData() {
      try {
        setLoading(true);
        console.log('[Shop] Loading shop data for ID:', shopId, 'User FID:', userFid);
        
        const [shopRes, inventoryRes, statsRes] = await Promise.all([
          fetch(`/api/shops/${shopId}/details?fid=${userFid}`),
          fetch(`/api/shops/${shopId}/inventory`),
          fetch(`/api/stats?fid=${userFid}`)
        ]);

        console.log('[Shop] API responses:', { 
          shop: shopRes.status, 
          inventory: inventoryRes.status, 
          stats: statsRes.status 
        });

        if (shopRes.ok) {
          const shopData = await shopRes.json();
          console.log('[Shop] Shop data:', shopData);
          
          // Check if user needs to be at location for physical shops
          if (shopData.zone_id && shopData.atWrongLocation) {
            console.warn('[Shop] User at wrong location, redirecting to dashboard');
            router.push('/dashboard');
            return;
          }
          
          setShop(shopData);
        } else {
          const errorData = await shopRes.json();
          console.error('[Shop] Shop details error:', errorData);
          
          // If it's a location error, redirect to dashboard
          if (shopRes.status === 403 || errorData.error?.includes('location')) {
            console.warn('[Shop] Location error, redirecting to dashboard');
            router.push('/dashboard');
            return;
          }
          
          setError(errorData.error || 'Failed to load shop');
        }

        if (inventoryRes.ok) {
          const invData = await inventoryRes.json();
          console.log('[Shop] Inventory data:', invData);
          setInventory(invData.items || []);
          setIsAdminShop(invData.isAdminShop || false);
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

  const handlePurchaseClick = (item: ShopItem) => {
    setSelectedItem(item);
    setShowConfirmModal(true);
  };

  const handleConfirmPurchase = async () => {
    if (!selectedItem) return;
    
    const itemId = isAdminShop ? selectedItem.item_id : selectedItem.id;
    if (!itemId) return;
    
    setPurchasing(itemId);
    setError(null);
    setSuccess(null);
    setShowConfirmModal(false);
    
    try {
      console.log('[Shop] Making purchase request:', { shopId, itemId, isAdminShop });
      
      const res = await fetch(`/api/shops/purchase?fid=${userFid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId, itemId })
      });

      console.log('[Shop] Purchase response status:', res.status);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('[Shop] Purchase error response:', errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          throw new Error(`Purchase failed: ${res.status} ${res.statusText}`);
        }
        
        throw new Error(errorData.error || 'Purchase failed');
      }

      const data = await res.json();
      console.log('[Shop] Purchase success:', data);

      setSuccess(isAdminShop ? `Added ${data.item.name} to inventory!` : `Purchased ${data.item.name}!`);
      
      // Refresh inventory
      const invRes = await fetch(`/api/shops/${shopId}/inventory?fid=${userFid}`);
      const invData = await invRes.json();
      setInventory(invData.items || []);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('[Shop] Purchase error:', err);
      setError(err.message || 'Failed to complete purchase');
    } finally {
      setPurchasing(null);
      setSelectedItem(null);
    }
  };

  const canPurchase = (item: ShopItem): boolean => {
    if (isAdminShop) return true; // Admin shop - always allow
    if (item.required_level && userLevel < item.required_level) return false;
    if (item.required_street_cred && userStreetCred < item.required_street_cred) return false;
    if (item.currency === 'credits' && (navData?.credits || 0) < item.price) return false;
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
    <>

      <div className="frame-container frame-main">
        <div className="frame-body pt-6 pb-2 px-6">
          <NavStrip 
            username={navData.username} 
            userProfileImage={navData.profileImage} 
            credits={navData.credits}
            cxBalance={navData.cxBalance}
            onMenuClick={() => setIsDrawerOpen(true)}
          />
        </div>

        <div className="frame-body px-6 py-4">
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
            <div className="grid grid-cols-1 gap-4">
              {inventory.map((item) => (
                <CxCard key={item.id}>
                  <div className="flex gap-3">
                    <div className="flex flex-col gap-2">
                      {item.image_url && (
                        <div className="w-20 h-20 flex-shrink-0">
                          <img 
                            src={item.image_url} 
                            alt={item.name} 
                            className="w-full h-full object-contain" 
                          />
                        </div>
                      )}
                      <div className="flex flex-col gap-1 items-center">
                        <span className="pill-cloud-gray text-xs">{item.item_type}</span>
                        {item.stock >= 0 && (
                          <span className="text-gray-500 text-xs">Stock: {item.stock}</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="text-white font-bold uppercase text-sm mb-1">{item.name}</h3>
                      <p className="text-gray-400 text-xs mb-2">{item.description}</p>

                      <div className="flex items-center justify-between mt-auto">
                        <div className="flex items-center gap-1">
                          {isAdminShop ? (
                            <span className="text-green-400 font-bold">FREE</span>
                          ) : (
                            <>
                              <span className="text-white font-bold">{item.price}</span>
                              <img src="/images/credits-currency.svg" alt="Credits" className="w-4 h-4" />
                            </>
                          )}
                        </div>
                        <button
                          onClick={() => handlePurchaseClick(item)}
                          disabled={!canPurchase(item) || purchasing === (isAdminShop ? item.item_id : item.id)}
                          className={`btn-cx px-4 py-1.5 text-xs ${
                            !canPurchase(item) || purchasing === (isAdminShop ? item.item_id : item.id) 
                              ? 'btn-cx-disabled' 
                              : 'btn-cx-primary'
                          }`}
                        >
                          {purchasing === (isAdminShop ? item.item_id : item.id) ? (isAdminShop ? 'ADDING...' : 'BUYING...') : (isAdminShop ? 'ADD' : 'BUY')}
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

      {/* Confirmation Modal */}
      {showConfirmModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-gray-900 border-2 border-fuschia rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-white font-bold uppercase text-lg mb-4">Confirm Purchase</h3>
            <p className="text-gray-300 mb-6">
              Do you want to purchase <span className="text-white font-semibold">{selectedItem.name}</span> for{' '}
              <span className="inline-flex items-center gap-1">
                <span className="text-white font-bold">{selectedItem.price}</span>
                {selectedItem.currency === 'credits' ? (
                  <img src="/images/credits-currency.svg" alt="Credits" className="w-4 h-4" />
                ) : (
                  <span className="text-yellow-400">Credits</span>
                )}
              </span>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setSelectedItem(null);
                }}
                className="btn-cx btn-cx-secondary btn-cx-full flex-1"
              >
                CANCEL
              </button>
              <button
                onClick={handleConfirmPurchase}
                className="btn-cx btn-cx-primary btn-cx-full flex-1"
              >
                CONFIRM
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
