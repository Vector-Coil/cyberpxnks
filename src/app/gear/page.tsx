"use client";
import React, { useState, useEffect } from 'react';
import { NavStrip, CxCard } from '../../components/CxShared';
import Link from 'next/link';
import CompactMeterStrip from '../../components/CompactMeterStrip';
import NavDrawer from '../../components/NavDrawer';
import { useNavData } from '../../hooks/useNavData';
import { useAuthenticatedUser } from '../../hooks/useAuthenticatedUser';
import { getItemTypeColor, getItemBorderClass } from '../../lib/itemUtils';
import { getMeterData } from '../../lib/meterUtils';

interface Item {
  id: number;
  name: string;
  item_type: string;
  description: string;
  credits_cost: number;
  is_stackable: number;
  is_equippable: number;
  is_consumable: number;
  required_level: number;
  model: string;
  tier: number;
  image_url: string;
  quantity: number;
  acquired_at: string;
  is_equipped: number;
  upgrade: number;
}

export default function GearPage() {
  const { userFid, isLoading: isAuthLoading } = useAuthenticatedUser();
  const navData = useNavData(userFid || 0);
  const [items, setItems] = useState<Item[]>([]);
  const [userStats, setUserStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'acquisition' | 'alphabetical' | 'type'>('acquisition');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    if (userFid && !isAuthLoading) {
      loadData();
    }
  }, [sortBy, userFid, isAuthLoading]);

  async function loadData() {
    if (!userFid) return;
    
    try {
      setLoading(true);
      const [inventoryRes, statsRes] = await Promise.all([
        fetch(`/api/inventory?fid=${userFid}&sortBy=${sortBy}`),
        fetch(`/api/stats?fid=${userFid}`)
      ]);

      if (inventoryRes.ok) {
        const inventory = await inventoryRes.json();
        setItems(inventory.items || []);
      }
      
      if (statsRes.ok) {
        const stats = await statsRes.json();
        setUserStats(stats);
      }
    } catch (err) {
      console.error('Failed to load gear page:', err);
    } finally {
      setLoading(false);
    }
  }

  const getItemTypeIcon = (itemType: string) => {
    const icons: { [key: string]: string } = {
      chip: 'memory',
      cyberdeck: 'computer',
      peripheral: 'devices',
      'key item': 'nearby',
      upgrade: 'upgrade',
      accessory: 'watch',
      intel: 'article',
      slimsoft: 'terminal'
    };
    return icons[itemType.toLowerCase()] || 'inventory_2';
  };

  return (
    <>
      <NavDrawer 
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        username={navData.username}
        profileImage={navData.profileImage}
        cxBalance={navData.cxBalance}
      />
      <div className="frame-container frame-main">
        <div className="frame-body pt-6 pb-2 px-6 mb-2">
          <NavStrip 
            username={navData.username}
            userProfileImage={navData.profileImage}
            cxBalance={navData.cxBalance}
            onMenuClick={() => setIsDrawerOpen(true)}
          />
        </div>
      <CompactMeterStrip meters={getMeterData(userStats)} />

      <div className="pt-5 pb-2 px-6 flex flex-row gap-3">
        <a href="/dashboard" className="w-[25px] h-[25px] rounded-full overflow-hidden bg-bright-blue flex items-center justify-center cursor-pointer hover:bg-gray-600 transition-colors">
          <span className="material-symbols-outlined text-white text-xl">chevron_left</span>
        </a>
        <div className="masthead">GEAR</div>
      </div>

      <div className="frame-body pt-0">
        {/* Sorting Options */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-3">
            <div className="font-bold uppercase" style={{ color: 'var(--fuschia)' }}>Sort By</div>
            <div className="flex gap-2">
              <button
                onClick={() => setSortBy('acquisition')}
                className={`pill-${sortBy === 'acquisition' ? 'stat' : 'charcoal'} text-xs`}
              >
                ACQUIRED
              </button>
              <button
                onClick={() => setSortBy('alphabetical')}
                className={`pill-${sortBy === 'alphabetical' ? 'stat' : 'charcoal'} text-xs`}
              >
                A-Z
              </button>
              <button
                onClick={() => setSortBy('type')}
                className={`pill-${sortBy === 'type' ? 'stat' : 'charcoal'} text-xs`}
              >
                TYPE
              </button>
            </div>
          </div>
        </div>

        {/* Inventory Grid */}
        <CxCard>
          <div className="flex justify-between align-center mb-4">
            <div className="meta-heading" style={{ color: 'var(--fuschia)' }}>
                Inventory
            </div>
            <div className="meta-eyebrow">{items.length} items</div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-12 h-12 border-4 border-gray-600 border-t-fuschia rounded-full"></div>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              <span className="material-symbols-outlined text-6xl mb-4 block">inventory_2</span>
              <div className="text-lg">No items in inventory</div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {items.map((item) => (
                <Link 
                  key={item.id} 
                  href={`/gear/${item.id}`}
                  className={`aspect-square rounded-lg overflow-hidden bg-charcoal-75 hover:bg-charcoal transition-all cursor-pointer ${getItemBorderClass(item)} relative`}
                >
                  <div className={`w-full h-full flex flex-col relative ${item.is_equipped === 1 ? 'bg-fuschia' : ''}`}>
                    {/* Item Image */}
                    <div className="flex-1 flex items-center justify-center p-1 relative">
                      {item.image_url ? (
                        <img 
                          src={item.image_url} 
                          alt={item.name}
                          className="max-w-full max-h-full object-contain"
                        />
                      ) : (
                        <div className="text-4xl text-gray-600">
                          <span className="material-symbols-outlined text-inherit">
                            {item.is_consumable ? 'medication' : item.is_equippable ? 'shield' : 'inventory_2'}
                          </span>
                        </div>
                      )}
                      
                      {/* Item Name Overlay (bottom of image area) */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                        <div>
                          <span className="material-symbols-outlined text-2xl text-gray-400 block mb-0.5">
                            {getItemTypeIcon(item.item_type)}
                          </span>
                          <div className="text-xs font-bold text-white line-clamp-2">
                            {item.name}{item.upgrade && item.upgrade > 0 ? ` +${item.upgrade}` : ''}
                          </div>
                        </div>
                      </div>
                      
                      {/* Quantity Badge (top-right corner of image area) */}
                      {item.quantity > 1 && (
                        <div className="absolute top-0 right-0">
                          <span className="pill-sm-charcoal text-xs">x{item.quantity}</span>
                        </div>
                      )}

                      {/* Equipped (top-left corner) */}
                      {item.is_equipped === 1 && (
                        <div className="absolute top-0 left-0">
                          <span className="pill-sm text-xs">E</span>
                        </div>
                      )}
                    </div>

                    {/* Item Info */}
                    <div className="p-2 bg-charcoal">
                      <span className="material-symbols-outlined text-2xl text-gray-400 block mb-0.5">
                        {getItemTypeIcon(item.item_type)}
                      </span>
                      <div className="text-xs font-bold text-white truncate">
                        {item.name}{item.upgrade && item.upgrade > 0 ? ` +${item.upgrade}` : ''}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className={`text-xs uppercase ${getItemTypeColor(item.item_type)}`}>
                          {item.item_type}
                        </span>
                      </div>
                      {item.is_equipped === 1 && (
                        <div className="mt-1">
                          <span className="pill-stat text-xs">EQUIPPED</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CxCard>
      </div>
    </div>
    </>
  );
}
