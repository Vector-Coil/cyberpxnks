"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { NavStrip, CxCard } from '../../../components/CxShared';
import { useNavData } from '../../../hooks/useNavData';
import { getItemTypeColor } from '../../../lib/itemUtils';

interface ItemDetail {
  id: number;
  name: string;
  item_type: string;
  description: string;
  callout: string;
  credits_cost: number;
  is_stackable: number;
  is_equippable: number;
  is_consumable: number;
  required_level: number;
  model: string;
  tier: number;
  image_url: string;
}

interface ItemData {
  item: ItemDetail;
  owned: boolean;
  quantity: number;
  acquired_at: string | null;
  is_equipped: boolean;
  slot_name: string | null;
  slot_type: string | null;
  upgrade: number;
}

export default function GearItemPage({ params }: { params: Promise<{ item: string }> }) {
  const router = useRouter();
  const [itemId, setItemId] = useState<number | null>(null);
  const navData = useNavData(300187);
  const [itemData, setItemData] = useState<ItemData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then(({ item }) => {
      setItemId(parseInt(item, 10));
    });
  }, [params]);

  useEffect(() => {
    if (!itemId || Number.isNaN(itemId)) return;
    loadData();
  }, [itemId]);

  async function loadData() {
    try {
      setLoading(true);
      const itemRes = await fetch(`/api/items/${itemId}?fid=300187`);

      if (itemRes.ok) {
        const data = await itemRes.json();
        setItemData(data);
      }
    } catch (err) {
      console.error('Failed to load item details:', err);
    } finally {
      setLoading(false);
    }
  }

  const getTierColor = (tier: number) => {
    const colors: { [key: number]: string } = {
      1: 'text-gray-400',
      2: 'text-green-400',
      3: 'text-blue-400',
      4: 'text-purple-400',
      5: 'text-yellow-400'
    };
    return colors[tier] || 'text-gray-400';
  };

  if (loading) {
    return (
      <div className="frame-container frame-main">
        <div className="frame-body pt-6 pb-2 px-6 mb-2">
          <NavStrip 
            username={navData.username}
            userProfileImage={navData.profileImage}
            cxBalance={navData.cxBalance}
          />
        </div>
        <div className="frame-body flex items-center justify-center min-h-[400px]">
          <div className="animate-spin w-12 h-12 border-4 border-gray-600 border-t-fuschia rounded-full"></div>
        </div>
      </div>
    );
  }

  if (!itemData || !itemData.owned) {
    return (
      <div className="frame-container frame-main">
        <div className="frame-body pt-6 pb-2 px-6 mb-2">
          <NavStrip 
            username={navData.username}
            userProfileImage={navData.profileImage}
            cxBalance={navData.cxBalance}
          />
        </div>
        <div className="pt-5 pb-2 px-6 flex flex-row gap-1">
          <a href="/gear" className="w-[25px] h-[25px] rounded-full overflow-hidden bg-bright-blue flex items-center justify-center cursor-pointer hover:bg-gray-600 transition-colors">
            <span className="material-symbols-outlined text-white text-xl">chevron_left</span>
          </a>
          <div className="masthead">ITEM NOT FOUND</div>
        </div>
        <div className="frame-body pt-0">
          <CxCard>
            <div className="text-center text-gray-400 py-12">
              <span className="material-symbols-outlined text-6xl mb-4 block">error</span>
              <div className="text-lg">You don't own this item</div>
            </div>
          </CxCard>
        </div>
      </div>
    );
  }

  const { item } = itemData;

  return (
    <div className="frame-container frame-main">
      <div className="frame-body pt-6 pb-2 px-6 mb-2">
        <NavStrip 
          username={navData.username}
          userProfileImage={navData.profileImage}
          cxBalance={navData.cxBalance}
        />
      </div>

      <div className="pt-5 pb-2 px-6 flex flex-row gap-3">
        <a href="/gear" className="w-[25px] h-[25px] rounded-full overflow-hidden bg-bright-blue flex items-center justify-center cursor-pointer hover:bg-gray-600 transition-colors">
          <span className="material-symbols-outlined text-white text-xl">chevron_left</span>
        </a>
        <div className="masthead">GEAR</div>
      </div>

      <div className="frame-body pt-0">
        {/* Item Image Card */}
        
          <div className="aspect-square">
            {item.image_url ? (
              <img 
                src={item.image_url} 
                alt={item.name}
                className="max-w-full max-h-full object-contain p-6"
              />
            ) : (
              <div className="text-8xl text-gray-600">
                <span className="material-symbols-outlined text-inherit">
                  {item.is_consumable ? 'medication' : item.is_equippable ? 'shield' : 'inventory_2'}
                </span>
              </div>
            )}
          </div>

          <div className="text-center mb-2">
            <h1 className="text-2xl font-bold text-white uppercase mb-2">
              {item.name.toUpperCase()}{itemData.upgrade && itemData.upgrade > 0 ? ` +${itemData.upgrade}` : ''}
            </h1>
          </div>
          <div className="mb-2">
            {item.description || 'No description available.'}
          </div>
          <div className="mb-6">
            {item.callout && (
              <div className="callout">{item.callout}</div>
            )}
            </div>
          


        {/* Item Details */}
        <CxCard className="mb-4">
          <div className="font-bold uppercase mb-4" style={{ color: 'var(--fuschia)' }}>Details</div>
          
          <div className="space-y-3">
            {/* Type & Tier */}
            <div className="flex items-center justify-between">
              <span className="text-gray-400 uppercase text-sm">Type</span>
              <span className={`font-bold uppercase ${getItemTypeColor(item.item_type)}`}>{item.item_type}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-400 uppercase text-sm">Tier</span>
              <span className={`font-bold ${getTierColor(item.tier)}`}>
                {'★'.repeat(item.tier)}
              </span>
            </div>

            {/* Model */}
            {item.model && (
              <div className="flex items-center justify-between">
                <span className="text-gray-400 uppercase text-sm">Model</span>
                <span className="text-white font-mono text-sm">{item.model}</span>
              </div>
            )}

            {/* Required Level */}
            <div className="flex items-center justify-between">
              <span className="text-gray-400 uppercase text-sm">Required Level</span>
              <span className="pill-stat">{item.required_level}</span>
            </div>

            {/* Value */}
            <div className="flex items-center justify-between">
              <span className="text-gray-400 uppercase text-sm">Value</span>
              <span className="text-yellow-400 font-bold">{item.credits_cost} CR</span>
            </div>

            {/* Quantity (if stackable) */}
            {item.is_stackable === 1 && (
              <div className="flex items-center justify-between">
                <span className="text-gray-400 uppercase text-sm">Quantity</span>
                <span className="pill-stat">x{itemData.quantity}</span>
              </div>
            )}

            {/* Properties */}
            <div className="flex items-center justify-between">
              <span className="text-gray-400 uppercase text-sm">Properties</span>
              <div className="flex gap-1">
                {item.is_equippable === 1 && <span className="pill-charcoal text-xs">EQUIPPABLE</span>}
                {item.is_consumable === 1 && <span className="pill-charcoal text-xs">CONSUMABLE</span>}
                {item.is_stackable === 1 && <span className="pill-charcoal text-xs">STACKABLE</span>}
              </div>
            </div>

            {/* Equipped Status */}
            {itemData.is_equipped && (
              <div className="flex items-center justify-between">
                <span className="text-gray-400 uppercase text-sm">Status</span>
                <span className="pill-stat">EQUIPPED</span>
              </div>
            )}
          </div>
        </CxCard>

        {/* Actions */}
        {item.is_equippable === 1 && (
          <CxCard>
            <div className="font-bold uppercase mb-3" style={{ color: 'var(--fuschia)' }}>Actions</div>
            <div className="space-y-2">
              {['cyberdeck', 'peripheral', 'slimsoft'].includes(item.item_type.toLowerCase()) ? (
                // Hardware/Slimsoft items - Link to hardware page with anchor for slimsoft
                <a
                  href={item.item_type.toLowerCase() === 'slimsoft' ? '/hardware#slimsoft' : '/hardware'}
                  className="w-full py-3 px-4 rounded bg-bright-blue hover:bg-blue-600 text-white font-bold uppercase transition-colors flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-xl mr-2">settings</span>
                  {itemData.is_equipped ? 'Manage Hardware' : 'Equip Hardware'}
                </a>
              ) : (
                // Other equippable items
                <>
                  {itemData.is_equipped ? (
                    <button
                      className="w-full py-3 px-4 rounded bg-red-600 hover:bg-red-700 text-white font-bold uppercase transition-colors"
                      onClick={() => {/* TODO: Implement unequip for other items */}}
                    >
                      <span className="material-symbols-outlined text-xl mr-2 align-middle">close</span>
                      Unequip
                    </button>
                  ) : (
                    <button
                      className="w-full py-3 px-4 rounded bg-bright-blue hover:bg-blue-600 text-white font-bold uppercase transition-colors"
                      onClick={() => {/* TODO: Implement equip for other items */}}
                    >
                      <span className="material-symbols-outlined text-xl mr-2 align-middle">check_circle</span>
                      Equip
                    </button>
                  )}
                </>
              )}
            </div>
          </CxCard>
        )}

        {item.is_consumable === 1 && (
          <CxCard className="mt-4">
            <div className="font-bold uppercase mb-3" style={{ color: 'var(--fuschia)' }}>Actions</div>
            <button
              className="w-full py-3 px-4 rounded bg-green-600 hover:bg-green-700 text-white font-bold uppercase transition-colors"
              onClick={() => {/* TODO: Implement consume */}}
            >
              <span className="material-symbols-outlined text-xl mr-2 align-middle">medication</span>
              Use Item
            </button>
          </CxCard>
        )}
      </div>
    </div>
  );
}
