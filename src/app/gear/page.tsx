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
  const [activeTab, setActiveTab] = useState<'all' | 'hardware' | 'software' | 'data' | 'arsenal' | 'consumable'>('all');
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
      slimsoft: 'terminal',
      weapon: 'swords',
      relic: 'star'
    };
    return icons[itemType.toLowerCase()] || 'inventory_2';
  };

  // Filter items based on active tab
  const getFilteredItems = () => {
    switch (activeTab) {
      case 'hardware':
        return items.filter(item => 
          ['chip', 'cyberdeck', 'peripheral', 'key item', 'upgrade'].includes(item.item_type.toLowerCase())
        );
      case 'software':
        return items.filter(item => item.item_type.toLowerCase() === 'slimsoft');
      case 'data':
        return items.filter(item => item.item_type.toLowerCase() === 'intel');
      case 'arsenal':
        return items.filter(item => 
          ['weapon', 'accessory', 'relic'].includes(item.item_type.toLowerCase())
        );
      case 'consumable':
        return items.filter(item => item.item_type.toLowerCase() === 'consumable');
      case 'all':
      default:
        return items;
    }
  };

  const filteredItems = getFilteredItems();

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
        {/* Tabs */}
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 min-w-[80px] py-2 px-3 rounded-lg font-bold uppercase text-xs transition-colors ${
              activeTab === 'all' 
                ? 'bg-fuschia text-white' 
                : 'bg-charcoal text-gray-400 hover:bg-charcoal-75'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab('hardware')}
            className={`flex-1 min-w-[80px] py-2 px-3 rounded-lg font-bold uppercase text-xs transition-colors ${
              activeTab === 'hardware' 
                ? 'bg-fuschia text-white' 
                : 'bg-charcoal text-gray-400 hover:bg-charcoal-75'
            }`}
          >
            Hardware
          </button>
          <button
            onClick={() => setActiveTab('arsenal')}
            className={`flex-1 min-w-[80px] py-2 px-3 rounded-lg font-bold uppercase text-xs transition-colors ${
              activeTab === 'arsenal' 
                ? 'bg-fuschia text-white' 
                : 'bg-charcoal text-gray-400 hover:bg-charcoal-75'
            }`}
          >
            Arsenal
          </button>
          <button
            onClick={() => setActiveTab('software')}
            className={`flex-1 min-w-[80px] py-2 px-3 rounded-lg font-bold uppercase text-xs transition-colors ${
              activeTab === 'software' 
                ? 'bg-fuschia text-white' 
                : 'bg-charcoal text-gray-400 hover:bg-charcoal-75'
            }`}
          >
            Software
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`flex-1 min-w-[80px] py-2 px-3 rounded-lg font-bold uppercase text-xs transition-colors ${
              activeTab === 'data' 
                ? 'bg-fuschia text-white' 
                : 'bg-charcoal text-gray-400 hover:bg-charcoal-75'
            }`}
          >
            Data
          </button>
          <button
            onClick={() => setActiveTab('consumable')}
            className={`flex-1 min-w-[80px] py-2 px-3 rounded-lg font-bold uppercase text-xs transition-colors ${
              activeTab === 'consumable' 
                ? 'bg-fuschia text-white' 
                : 'bg-charcoal text-gray-400 hover:bg-charcoal-75'
            }`}
          >
            Consumable
          </button>
        </div>

        {/* Inventory Grid */}
        <CxCard>
          {/* Sorting Options - moved inside card */}
          <div className="flex items-center justify-between mb-4">
            <div className="font-bold uppercase text-sm" style={{ color: 'var(--fuschia)' }}>Sort By</div>
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

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-12 h-12 border-4 border-gray-600 border-t-fuschia rounded-full"></div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              <span className="material-symbols-outlined text-6xl mb-4 block">inventory_2</span>
              <div className="text-lg">No items in this category</div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {filteredItems.map((item) => (
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
