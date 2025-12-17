"use client";
import React, { useState, useEffect } from 'react';
import { NavStrip, CxCard } from '../../components/CxShared';
import ConfirmModal from '../../components/ConfirmModal';
import CompactMeterStrip from '../../components/CompactMeterStrip';
import { useNavData } from '../../hooks/useNavData';
import { useAuthenticatedUser } from '../../hooks/useAuthenticatedUser';
import NavDrawer from '../../components/NavDrawer';
import { getMeterData } from '../../lib/meterUtils';

// Hardware stat row component matching dashboard style
interface HardwareStatRowProps {
  label: string;
  mod: number;
}

const HardwareStatRow: React.FC<HardwareStatRowProps> = ({ label, mod }) => {
  const modDisplay = mod === 0 ? "-" : (mod > 0 ? `+${mod}` : `${mod}`);
  
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-700 last:border-b-0">
      <div className="text-sm font-mono text-white uppercase">{label}</div>
      <div className={`px-3 py-0.5 text-xs font-bold rounded-full ${
        mod > 0 ? 'bg-bright-blue text-black' : 'bg-gray-700 text-gray-500'
      }`}>
        {modDisplay}
      </div>
    </div>
  );
};

// Calculated stat row component
interface CalcStatRowProps {
  label: string;
  mod: number;
  value: number;
  isPreview?: boolean;
}

const CalcStatRow: React.FC<CalcStatRowProps> = ({ label, mod, value, isPreview = false }) => {
  const modDisplay = mod === 0 ? "" : (mod > 0 ? `+${mod}` : `${mod}`);
  
  return (
    <div className="flex justify-between items-center py-1 border-b border-gray-700 last:border-b-0">
      <div className="flex direction-row justify-between items-left gap-1">
        <div className="text-sm font-mono text-white uppercase">{label}</div>
        {modDisplay && (
          <div className={`px-1.5 py-0.5 text-xs font-bold rounded-full ${
            isPreview ? 'text-orange-400' : 'text-bright-blue'
          }`}>
            {modDisplay}
          </div>
        )}
      </div>
      <div className={`px-3 py-0.5 text-xs font-bold rounded-full ${
        isPreview ? 'bg-orange-500 text-white' : 'bg-fuchsia-500 text-white'
      }`}>
        {value}
      </div>
    </div>
  );
};

interface HardwareItem {
  id: number;
  name: string;
  item_type: string;
  description: string;
  tier: number;
  image_url: string;
  model: string;
  quantity: number;
  acquired_at: string;
  is_equipped: number;
  slot_name: string | null;
  // Hardware modifiers (only for cyberdecks)
  cell_capacity?: number;
  heat_sink?: number;
  processor?: number;
  memory?: number;
  lifi?: number;
  encryption?: number;
  // Upgrade data
  upgrades_with?: number;
  upgrade?: number;
  upgrade_material_name?: string;
  upgrade_material_image?: string;
  upgrade_material_count?: number;
}

export default function HardwarePage() {
  const { userFid, isLoading: isAuthLoading } = useAuthenticatedUser();
  const navData = useNavData(userFid || 0);
  const [cyberdecks, setCyberdecks] = useState<HardwareItem[]>([]);
  const [peripherals, setPeripherals] = useState<HardwareItem[]>([]);
  const [slimsoft, setSlimsoft] = useState<HardwareItem[]>([]);
  const [arsenalItems, setArsenalItems] = useState<HardwareItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCyberdeck, setExpandedCyberdeck] = useState<number | null>(null);
  const [previewSoftId, setPreviewSoftId] = useState<number | null>(null);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [pendingEquip, setPendingEquip] = useState<{ itemId: number; slotType: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewDeckId, setPreviewDeckId] = useState<number | null>(null);
  const [userStats, setUserStats] = useState<any>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeTarget, setUpgradeTarget] = useState<{ hardwareId: number; upgradeMaterial: HardwareItem | null; requiredQty: number } | null>(null);
  const [equippedDeckTier, setEquippedDeckTier] = useState<number>(0);
  const [selectedSoftId, setSelectedSoftId] = useState<number | null>(null);
  const [showUnequipModal, setShowUnequipModal] = useState(false);
  const [unequipTarget, setUnequipTarget] = useState<{ itemId: number; name: string } | null>(null);
  const [slimsoftEffects, setSlimsoftEffects] = useState<any[]>([]);
  const [selectedIncompatibleId, setSelectedIncompatibleId] = useState<number | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'tech' | 'arsenal'>('tech');
  const [selectedArsenalId, setSelectedArsenalId] = useState<number | null>(null);
  const [previewArsenalId, setPreviewArsenalId] = useState<number | null>(null);

  useEffect(() => {
    if (userFid && !isAuthLoading) {
      loadData();
    }
  }, [userFid, isAuthLoading]);

  // Check URL hash to set initial active tab
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'arsenal') {
      setActiveTab('arsenal');
    } else if (hash === 'slimsoft' || hash === 'tech') {
      setActiveTab('tech');
    }
  }, []);

  // Dismiss selected slimsoft when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Check if click is outside slimsoft tiles
      if (selectedSoftId !== null && !target.closest('.slimsoft-tile') && !target.closest('[role="dialog"]')) {
        setSelectedSoftId(null);
      }
      if (selectedIncompatibleId !== null && !target.closest('.incompatible-soft-tile') && !target.closest('[role="dialog"]')) {
        setSelectedIncompatibleId(null);
      }
      if (selectedArsenalId !== null && !target.closest('.arsenal-tile') && !target.closest('[role="dialog"]')) {
        setSelectedArsenalId(null);
      }
    };

    if (selectedSoftId !== null || selectedIncompatibleId !== null || selectedArsenalId !== null) {
      // Use setTimeout to add listener after current click finishes
      const timeoutId = setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 0);
      
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [selectedSoftId, selectedIncompatibleId, selectedArsenalId]);

  async function loadData() {
    if (!userFid) return;
    
    try {
      setLoading(true);
      const [hardwareRes, statsRes, inventoryRes] = await Promise.all([
        fetch(`/api/hardware?fid=${userFid}`),
        fetch(`/api/stats?fid=${userFid}`),
        fetch(`/api/inventory?fid=${userFid}`)
      ]);

      if (hardwareRes.ok) {
        const data = await hardwareRes.json();
        setCyberdecks(data.cyberdecks || []);
        setPeripherals(data.peripherals || []);
        setSlimsoft(data.slimsoft || []);
        setEquippedDeckTier(data.equippedDeckTier || 0);
      }

      if (statsRes.ok) {
        const stats = await statsRes.json();
        setUserStats(stats);
      }

      if (inventoryRes.ok) {
        const inv = await inventoryRes.json();
        // Filter for weapons, accessories, and relics
        const arsenalTypes = ['weapon', 'accessory', 'relic'];
        const arsenalFiltered = (inv.items || []).filter((item: any) => 
          arsenalTypes.includes(item.item_type.toLowerCase())
        );
        setArsenalItems(arsenalFiltered);
      }

      // Fetch slimsoft effects
      const effectsRes = await fetch(`/api/slimsoft/effects?fid=${userFid}`);
      if (effectsRes.ok) {
        const effectsData = await effectsRes.json();
        setSlimsoftEffects(effectsData.effects || []);
      }
    } catch (err) {
      console.error('Failed to load hardware:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleEquip(itemId: number, slotType: string) {
    if (slotType === 'cyberdeck') {
      const isEquipped = cyberdecks.some(d => d.is_equipped === 1);
      if (isEquipped) {
        setPendingEquip({ itemId, slotType });
        setShowReplaceModal(true);
        return;
      }
    } else if (slotType === 'slimsoft') {
      const equippedCount = slimsoft.filter(s => s.is_equipped === 1).length;
      if (equippedCount >= 3) {
        // Slimsoft slots full - could add modal here if needed
        return;
      }
    } else if (slotType === 'arsenal') {
      const power = userStats?.power || 0;
      const arsenalSlots = Math.max(1, Math.floor(Math.floor(power / 2) - 2));
      const equippedCount = arsenalItems.filter(item => item.is_equipped === 1).length;
      if (equippedCount >= arsenalSlots) {
        // Arsenal slots full
        return;
      }
    }

    await performEquip(itemId, slotType);
  }

  async function performEquip(itemId: number, slotType: string) {
    if (!userFid) {
      console.error('Cannot equip: userFid is null');
      return;
    }
    
    console.log('Attempting to equip:', { itemId, slotType, userFid });
    
    try {
      setIsProcessing(true);
      const res = await fetch('/api/hardware/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid: userFid, itemId, slotType, action: 'equip' })
      });

      const result = await res.json();

      if (res.ok) {
        console.log('Equip successful:', result);
        await loadData();
        setExpandedCyberdeck(null);
        setSelectedSoftId(null);
        setPreviewSoftId(null);
        setPreviewDeckId(null);
        setSelectedArsenalId(null);
        setPreviewArsenalId(null);
      } else {
        console.error('Equip failed:', result);
        // Show the specific error message from the server
        const errorMsg = result.error || result.message || 'Unknown error';
        alert(`Failed to equip: ${errorMsg}`);
      }
    } catch (err) {
      console.error('Failed to equip (exception):', err);
      alert(`Failed to equip item: ${err instanceof Error ? err.message : 'Network error'}`);
    } finally {
      setIsProcessing(false);
      setShowReplaceModal(false);
      setPendingEquip(null);
    }
  }

  async function handleUnequip(itemId: number, slotType: string) {
    if (!userFid) return;
    
    try {
      setIsProcessing(true);
      const res = await fetch('/api/hardware/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid: userFid, itemId, slotType, action: 'unequip' })
      });

      if (res.ok) {
        await loadData();
      }
    } catch (err) {
      console.error('Failed to unequip:', err);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleUpgrade() {
    if (!upgradeTarget || !userFid) return;

    try {
      setIsProcessing(true);
      const res = await fetch('/api/hardware/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fid: userFid,
          hardwareId: upgradeTarget.hardwareId,
          requiredQty: upgradeTarget.requiredQty
        })
      });

      if (res.ok) {
        await loadData();
        setShowUpgradeModal(false);
        setUpgradeTarget(null);
      } else {
        const error = await res.json();
        console.error('Upgrade failed:', error.error);
        alert(error.error || 'Upgrade failed');
      }
    } catch (err) {
      console.error('Failed to upgrade:', err);
      alert('Failed to upgrade hardware');
    } finally {
      setIsProcessing(false);
    }
  }

  const equippedCyberdeck = cyberdecks.find(d => d.is_equipped === 1);
  const unequippedCyberdecks = cyberdecks.filter(d => d.is_equipped === 0);
  const equippedSlimsoft = slimsoft.filter(s => s.is_equipped === 1);
  const unequippedSlimsoft = slimsoft.filter(s => s.is_equipped === 0);

  const getTierColor = (tier: number): string => {
    const colors: { [key: number]: string } = {
      1: 'text-gray-400',
      2: 'text-green-400',
      3: 'text-blue-400',
      4: 'text-purple-400',
      5: 'text-orange-400',
    };
    return colors[tier] || 'text-gray-400';
  };

  // Get comparison between current equipped deck and preview deck
  const getStatComparison = (currentValue: number | undefined, newValue: number | undefined) => {
    const current = currentValue || 0;
    const newVal = newValue || 0;
    const diff = newVal - current;
    
    if (diff === 0) return { change: 0, color: 'text-gray-400', arrow: '', display: `${newVal || '-'}` };
    if (diff > 0) return { change: diff, color: 'text-green-400', arrow: '↑', display: `${newVal} (+${diff})` };
    return { change: diff, color: 'text-red-400', arrow: '↓', display: `${newVal} (${diff})` };
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
        <div className="masthead">LOADOUT</div>
      </div>

      <div className="frame-body pt-0">
        {/* Tabs */}
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setActiveTab('tech')}
            className={`flex-1 py-3 px-4 rounded-lg font-bold uppercase text-sm transition-colors ${
              activeTab === 'tech' 
                ? 'bg-fuschia text-white' 
                : 'bg-charcoal text-gray-400 hover:bg-charcoal-75'
            }`}
          >
            Tech Stack
          </button>
          <button
            onClick={() => setActiveTab('arsenal')}
            className={`flex-1 py-3 px-4 rounded-lg font-bold uppercase text-sm transition-colors ${
              activeTab === 'arsenal' 
                ? 'bg-fuschia text-white' 
                : 'bg-charcoal text-gray-400 hover:bg-charcoal-75'
            }`}
          >
            Arsenal
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-gray-600 border-t-fuschia rounded-full"></div>
          </div>
        ) : activeTab === 'tech' ? (
          <>
            <div className="mb-4">
              <p className="text-gray-400 text-sm">Your personal tech stack of equipped hardware and software. Manage and optimize your technical loadout.</p>
            </div>

            {/* HARDWARE SECTION - Cyberdecks */}
            <CxCard className="mb-4">
              <div className="font-bold uppercase mb-4" style={{ color: 'var(--fuschia)' }}>Cyberdeck</div>
              
              {/* Equipped Cyberdeck */}
              {equippedCyberdeck ? (
                <div className="mb-4 p-3 bg-charcoal-75 rounded border-2 border-bright-blue">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0">
                      <a href={`/gear/${equippedCyberdeck.id}`} className="w-24 h-24 rounded bg-charcoal flex items-center justify-center mb-2 hover:bg-gray-700 transition-colors">
                        {equippedCyberdeck.image_url ? (
                          <img src={equippedCyberdeck.image_url} alt={equippedCyberdeck.name} className="max-w-full max-h-full object-contain p-2" />
                        ) : (
                          <span className="material-symbols-outlined text-4xl text-gray-600">memory</span>
                        )}
                      </a>
                      <button
                        onClick={() => handleUnequip(equippedCyberdeck.id, 'cyberdeck')}
                        disabled={isProcessing}
                        className="w-24 py-2 px-2 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase transition-colors disabled:opacity-50"
                      >
                        Unequip
                      </button>
                      
                      {/* Upgrade Section */}
                      {equippedCyberdeck.upgrades_with && equippedCyberdeck.upgrades_with > 0 && (() => {
                        const upgradeLevel = equippedCyberdeck.upgrade || 0;
                        const requiredQty = 1 + upgradeLevel;
                        const materialCount = equippedCyberdeck.upgrade_material_count || 0;
                        const hasEnough = materialCount >= requiredQty;
                        const materialName = equippedCyberdeck.upgrade_material_name || 'item';
                        const materialImage = equippedCyberdeck.upgrade_material_image;
                        
                        return (
                          <div className="mt-2 w-24">
                            {hasEnough ? (
                              <div className="p-2 bg-charcoal rounded border border-gray-700">
                                <div className="w-full aspect-square bg-charcoal-75 rounded flex items-center justify-center mb-1">
                                  {materialImage ? (
                                    <img src={materialImage} alt={materialName} className="max-w-full max-h-full object-contain p-1" />
                                  ) : (
                                    <span className="material-symbols-outlined text-lg text-gray-600">memory</span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-400 truncate mb-1">{materialName} (x{requiredQty})</div>
                                <button
                                  onClick={() => {
                                    setUpgradeTarget({ 
                                      hardwareId: equippedCyberdeck.id, 
                                      upgradeMaterial: { name: materialName, image_url: materialImage } as any, 
                                      requiredQty 
                                    });
                                    setShowUpgradeModal(true);
                                  }}
                                  disabled={isProcessing}
                                  className="w-full py-1 px-2 rounded bg-green-600 hover:bg-green-700 text-white text-xs font-bold uppercase transition-colors disabled:opacity-50"
                                >
                                  Upgrade
                                </button>
                              </div>
                            ) : (
                              <div className="p-2 bg-charcoal-75 rounded border border-gray-700 text-center">
                                <div className="w-full aspect-square bg-charcoal rounded flex items-center justify-center mb-1 relative">
                                  {materialImage ? (
                                    <>
                                      <img src={materialImage} alt={materialName} className="max-w-full max-h-full object-contain p-1 opacity-30" />
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-2xl text-gray-600">lock</span>
                                      </div>
                                    </>
                                  ) : (
                                    <span className="material-symbols-outlined text-lg text-gray-600">lock</span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500 leading-tight">
                                  Acquire {materialName} (x{requiredQty}) to upgrade
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-bold text-white text-lg">
                            {equippedCyberdeck.name}{equippedCyberdeck.upgrade && equippedCyberdeck.upgrade > 0 ? ` +${equippedCyberdeck.upgrade}` : ''}
                          </div>
                          <div className="text-xs text-gray-400">{equippedCyberdeck.model}</div>
                        </div>
                        <div className={`flex items-center gap-0.5 ${getTierColor(equippedCyberdeck.tier)}`}>
                          <span className="material-symbols-outlined text-xl" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
                          <span className="text-sm font-bold">{equippedCyberdeck.tier}</span>
                        </div>
                      </div>
                      
                      {/* Hardware Stats - Full width, matching dashboard style */}
                      <div className="border-t border-gray-700">
                        <HardwareStatRow 
                          label="CELL CAPACITY" 
                          mod={(equippedCyberdeck.cell_capacity || 0) + (equippedCyberdeck.upgrade || 0)}
                        />
                        <HardwareStatRow 
                          label="PROCESSOR" 
                          mod={(equippedCyberdeck.processor || 0) + (equippedCyberdeck.upgrade || 0)}
                        />
                        <HardwareStatRow 
                          label="HEAT SINK" 
                          mod={(equippedCyberdeck.heat_sink || 0) + (equippedCyberdeck.upgrade || 0)}
                        />
                        <HardwareStatRow 
                          label="MEMORY" 
                          mod={(equippedCyberdeck.memory || 0) + (equippedCyberdeck.upgrade || 0)}
                        />
                        <HardwareStatRow 
                          label="LI-FI" 
                          mod={(equippedCyberdeck.lifi || 0) + (equippedCyberdeck.upgrade || 0)}
                        />
                        <HardwareStatRow 
                          label="ENCRYPTION" 
                          mod={(equippedCyberdeck.encryption || 0) + (equippedCyberdeck.upgrade || 0)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-4 p-4 bg-charcoal-75 rounded border border-charcoal text-center text-gray-400">
                  <span className="material-symbols-outlined text-4xl mb-2 block">memory</span>
                  <div className="text-sm">No cyberdeck equipped</div>
                </div>
              )}

              {/* Calculated Stats Section */}
              {userStats && (() => {
                const previewDeck = previewDeckId ? cyberdecks.find(d => d.id === previewDeckId) : null;
                const isPreview = !!previewDeck;
                
                // Calculate stats with preview deck or equipped deck
                const activeDeck = previewDeck || equippedCyberdeck;
                const upgradeLevel = activeDeck?.upgrade || 0;
                
                // Apply upgrade bonus to all modifiers
                const cellCapacity = (activeDeck?.cell_capacity || 0) + upgradeLevel;
                const processor = (activeDeck?.processor || 0) + upgradeLevel;
                const heatSink = (activeDeck?.heat_sink || 0) + upgradeLevel;
                const memory = (activeDeck?.memory || 0) + upgradeLevel;
                const lifi = (activeDeck?.lifi || 0) + upgradeLevel;
                const encryption = (activeDeck?.encryption || 0) + upgradeLevel;
                
                const clockSpeed = userStats.total_clock + processor;
                const cooling = userStats.total_cooling + heatSink;
                const signalNoise = userStats.total_signal + memory + lifi;
                const latency = userStats.total_latency + lifi;
                const decryption = userStats.total_crypt + encryption;
                const cache = userStats.total_cache + memory;
                
                return (
                  <div className="mb-4">
                    <div className="font-bold uppercase mb-2 text-sm" style={{ color: isPreview ? 'var(--orange)' : 'var(--fuschia)' }}>
                      {isPreview ? 'Preview: Calculated Stats' : 'Your Calculated Stats'}
                    </div>
                    <div className="border-t border-gray-700">
                      <CalcStatRow label="CLOCK SPEED" mod={processor} value={clockSpeed} isPreview={isPreview} />
                      <CalcStatRow label="COOLING" mod={heatSink} value={cooling} isPreview={isPreview} />
                      <CalcStatRow label="SIGNAL/NOISE" mod={memory + lifi} value={signalNoise} isPreview={isPreview} />
                      <CalcStatRow label="LATENCY" mod={lifi} value={latency} isPreview={isPreview} />
                      <CalcStatRow label="CRYPT" mod={encryption} value={decryption} isPreview={isPreview} />
                      <CalcStatRow label="CACHE" mod={memory} value={cache} isPreview={isPreview} />
                    </div>
                  </div>
                );
              })()}

              <a href="/allocate-points" className="block mb-4">
                <button className="btn-cx btn-cx-secondary btn-cx-full">
                  <span className="material-symbols-outlined text-lg">bar_chart</span>
                  Stats Breakdown
                </button>
              </a>

              {/* Other Cyberdecks */}
              {unequippedCyberdecks.length > 0 && (
                <>
                  <div className="font-bold uppercase mb-3 text-sm" style={{ color: 'var(--fuschia)' }}>Available Hardware</div>
                  <div className="grid grid-cols-3 gap-3">
                  {unequippedCyberdecks.map((deck) => (
                    <div 
                      key={deck.id} 
                      className="aspect-square rounded-lg overflow-hidden bg-charcoal-75 hover:bg-charcoal transition-all border border-charcoal relative cursor-pointer"
                      onClick={() => {
                        const isExpanding = expandedCyberdeck !== deck.id;
                        setExpandedCyberdeck(isExpanding ? deck.id : null);
                        setPreviewDeckId(isExpanding ? deck.id : null);
                      }}
                    >
                      <div className="w-full h-full flex flex-col relative">
                        {/* Item Image */}
                        <div className="flex-1 flex items-center justify-center p-1 relative">
                          {deck.image_url ? (
                            <img 
                              src={deck.image_url} 
                              alt={deck.name}
                              className="max-w-full max-h-full object-contain"
                            />
                          ) : (
                            <div className="text-4xl text-gray-600">
                              <span className="material-symbols-outlined text-inherit">memory</span>
                            </div>
                          )}
                          
                          {/* Power Score Badge (top-right) */}
                          {(() => {
                            const totalPower = (deck.cell_capacity || 0) + (deck.processor || 0) + 
                                             (deck.heat_sink || 0) + (deck.memory || 0) + 
                                             (deck.lifi || 0) + (deck.encryption || 0);
                            const currentPower = equippedCyberdeck ? 
                              ((equippedCyberdeck.cell_capacity || 0) + (equippedCyberdeck.processor || 0) + 
                               (equippedCyberdeck.heat_sink || 0) + (equippedCyberdeck.memory || 0) + 
                               (equippedCyberdeck.lifi || 0) + (equippedCyberdeck.encryption || 0)) : 0;
                            const isUpgrade = totalPower > currentPower;
                            const isDowngrade = totalPower < currentPower && equippedCyberdeck;
                            
                            return (
                              <div className="absolute top-2 right-2">
                                <div className={`px-2 py-1 rounded-full text-xs font-bold ${
                                  isUpgrade ? 'bg-green-500 text-black' :
                                  isDowngrade ? 'bg-red-500/80 text-white' :
                                  'bg-gray-700 text-gray-300'
                                }`}>
                                  {isUpgrade && '↑ '}
                                  {isDowngrade && '↓ '}
                                  +{totalPower}
                                </div>
                              </div>
                            );
                          })()}
                          
                          {/* Item Name Overlay (bottom of image area) */}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                            <div className="text-xs font-bold text-white line-clamp-2">
                              {deck.name}{deck.upgrade && deck.upgrade > 0 ? ` +${deck.upgrade}` : ''}
                            </div>
                          </div>

                          {/* Stats Preview & Equip Button Overlay */}
                          {expandedCyberdeck === deck.id && (() => {
                            const cellComp = getStatComparison(equippedCyberdeck?.cell_capacity, deck.cell_capacity);
                            const procComp = getStatComparison(equippedCyberdeck?.processor, deck.processor);
                            const heatComp = getStatComparison(equippedCyberdeck?.heat_sink, deck.heat_sink);
                            const memComp = getStatComparison(equippedCyberdeck?.memory, deck.memory);
                            const lifiComp = getStatComparison(equippedCyberdeck?.lifi, deck.lifi);
                            const encComp = getStatComparison(equippedCyberdeck?.encryption, deck.encryption);
                            
                            return (
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 p-3">
                                <div className="flex items-center gap-2 text-sm text-orange-400 font-bold mb-4">
                                  <span>PREVIEW</span>
                                  <span className="material-symbols-outlined text-lg">close</span>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEquip(deck.id, 'cyberdeck');
                                  }}
                                  disabled={isProcessing}
                                  className="py-2 px-6 rounded bg-bright-blue hover:bg-blue-600 text-white text-xs font-bold uppercase transition-colors disabled:opacity-50"
                                >
                                  Equip
                                </button>
                                <a 
                                  href={`/gear/${deck.id}`}
                                  className="mt-2 text-xs text-gray-400 hover:text-bright-blue transition-colors underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  See details
                                </a>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Item Info */}
                        <div className="p-2 bg-charcoal">
                          <div className="text-xs font-bold text-white truncate">
                            {deck.name}{deck.upgrade && deck.upgrade > 0 ? ` +${deck.upgrade}` : ''}
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-gray-400 truncate">{deck.model}</span>
                            <div className={`flex items-center gap-0.5 ${getTierColor(deck.tier)}`}>
                              <span className="material-symbols-outlined text-sm" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
                              <span className="text-xs font-bold">{deck.tier}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                </>
              )}
            </CxCard>

            {/* PERIPHERALS SECTION */}
            <CxCard className="mb-4">
              <div className="font-bold uppercase mb-4" style={{ color: 'var(--fuschia)' }}>Peripherals</div>
              
              {peripherals.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <span className="material-symbols-outlined text-5xl mb-2 block">devices</span>
                  <div>No peripherals acquired</div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {peripherals.map((peripheral) => (
                    <div key={peripheral.id} className="aspect-square rounded-lg overflow-hidden bg-charcoal-75 hover:bg-charcoal transition-all border border-charcoal relative">
                      <div className="w-full h-full flex flex-col relative">
                        {/* Item Image */}
                        <a href={`/gear/${peripheral.id}`} className="flex-1 flex items-center justify-center p-1 relative hover:bg-charcoal-50 transition-colors">
                          {peripheral.image_url ? (
                            <img 
                              src={peripheral.image_url} 
                              alt={peripheral.name}
                              className="max-w-full max-h-full object-contain"
                            />
                          ) : (
                            <div className="text-4xl text-gray-600">
                              <span className="material-symbols-outlined text-inherit">devices</span>
                            </div>
                          )}
                        </a>
                        <div className="absolute inset-0 pointer-events-none">
                          
                          {/* Item Name Overlay (bottom of image area) */}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                            <div className="text-xs font-bold text-white line-clamp-2">
                              {peripheral.name}{peripheral.upgrade && peripheral.upgrade > 0 ? ` +${peripheral.upgrade}` : ''}
                            </div>
                          </div>
                          
                          {/* Quantity Badge (top-right corner of image area) */}
                          {peripheral.quantity > 1 && (
                            <div className="absolute top-1 right-1">
                              <span className="pill-stat text-xs">x{peripheral.quantity}</span>
                            </div>
                          )}
                        </div>

                        {/* Item Info */}
                        <div className="p-2 bg-charcoal">
                          <div className="text-xs font-bold text-white truncate">
                            {peripheral.name}{peripheral.upgrade && peripheral.upgrade > 0 ? ` +${peripheral.upgrade}` : ''}
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <div className={`flex items-center gap-0.5 ${getTierColor(peripheral.tier)}`}>
                              <span className="material-symbols-outlined text-sm" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
                              <span className="text-xs font-bold">{peripheral.tier}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CxCard>

            {/* SOFTWARE SECTION - Slimsoft */}
            <div id="slimsoft">
              <CxCard>
                <div className="font-bold uppercase mb-4" style={{ color: 'var(--fuschia)' }}>
                  Software (3 slots)
                </div>
              
              {/* Three Slimsoft Slots - Always Visible */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[0, 1, 2].map((slotIndex) => {
                  const soft = equippedSlimsoft[slotIndex];
                  
                  if (!soft) {
                    // Empty slot placeholder
                    return (
                      <div key={`empty-${slotIndex}`} className="aspect-square rounded-lg overflow-hidden bg-charcoal-75 border border-charcoal">
                        <div className="w-full h-full flex flex-col items-center justify-center p-4">
                          <img src="/images/soft_new.png" alt="Empty slot" className="w-16 h-16 opacity-30 mb-2" />
                          <div className="text-xs text-gray-600 text-center">Empty Slot</div>
                        </div>
                      </div>
                    );
                  }

                  // Equipped slimsoft
                  const isSelected = selectedSoftId === soft.id;
                  return (
                    <div 
                      key={soft.id} 
                      className={`slimsoft-tile rounded-lg bg-charcoal-75 border-2 ${isSelected ? 'border-red-500' : 'border-bright-blue'} relative cursor-pointer transition-colors`}
                      onClick={(e) => {
                        e.preventDefault();
                        setSelectedSoftId(isSelected ? null : soft.id);
                      }}
                    >
                      <div className="w-full flex flex-col relative">
                        <div className="aspect-square flex items-center justify-center p-2 relative overflow-hidden rounded-t-lg">
                          {soft.image_url ? (
                            <img src={soft.image_url} alt={soft.name} className="max-w-full max-h-full object-contain" />
                          ) : (
                            <span className="material-symbols-outlined text-4xl text-gray-600">terminal</span>
                          )}

                          {/* Tier Badge */}
                          <div className="absolute top-2 right-2">
                            <div className={`flex items-center gap-0.5 px-2 py-1 rounded-full ${getTierColor(soft.tier)} bg-black/80`}>
                              <span className="material-symbols-outlined text-sm" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
                              <span className="text-xs font-bold">{soft.tier}</span>
                            </div>
                          </div>

                          {/* Item Name Overlay */}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                            <div className="text-xs font-bold text-white line-clamp-2">
                              {soft.name}{soft.upgrade && soft.upgrade > 0 ? ` +${soft.upgrade}` : ''}
                            </div>
                          </div>

                          {/* Unequip Overlay - Shows when selected */}
                          {isSelected && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 p-3">
                              <div className="flex items-center gap-2 text-sm text-red-400 font-bold mb-4">
                                <span>SELECTED</span>
                                <span className="material-symbols-outlined text-lg">close</span>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setUnequipTarget({ itemId: soft.id, name: soft.name });
                                  setShowUnequipModal(true);
                                }}
                                disabled={isProcessing}
                                className="py-2 px-6 rounded bg-red-500 hover:bg-red-400 text-white text-xs font-bold uppercase transition-colors disabled:opacity-50"
                              >
                                Unequip
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Effects Preview Section */}
              {(equippedSlimsoft.length > 0 || previewSoftId) && (() => {
                // Get effects for equipped slimsoft
                const equippedIds = equippedSlimsoft.map(s => s.id);
                const equippedEffects = slimsoftEffects.filter(e => equippedIds.includes(e.item_id));
                
                // Get effects for preview slimsoft if any
                const previewEffects = previewSoftId 
                  ? slimsoftEffects.filter(e => e.item_id === previewSoftId)
                  : [];

                const hasEffects = equippedEffects.length > 0 || previewEffects.length > 0;

                if (!hasEffects) return null;

                return (
                  <div className="mb-4 p-3 bg-charcoal-75 rounded border border-gray-700">
                    <div className="font-bold uppercase text-xs mb-3" style={{ color: previewSoftId ? 'var(--orange)' : 'var(--fuschia)' }}>
                      {previewSoftId ? 'Preview: Software Effects' : 'Active Software Effects'}
                    </div>
                    
                    {/* Active Effects */}
                    {equippedEffects.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {equippedEffects.map((effect, idx) => (
                          <div key={idx} className="text-xs bg-charcoal p-2 rounded border border-gray-700">
                            <div className="flex items-start justify-between mb-1">
                              <div className="font-bold text-bright-blue">
                                {effect.effect_name || (
                                  effect.target_stat && (
                                    <>
                                      <span className="uppercase">{effect.target_stat}</span>
                                      {' '}
                                      <span className="text-green-400">
                                        {effect.effect_value > 0 ? '+' : ''}{effect.effect_value}{effect.is_percentage ? '%' : ''}
                                      </span>
                                    </>
                                  )
                                )}
                              </div>
                              <div className="text-fuchsia-400 text-[10px] uppercase">{effect.effect_type}</div>
                            </div>
                            {effect.description && (
                              <div className="text-gray-400 text-[11px]">{effect.description}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Preview Effects */}
                    {previewSoftId && previewEffects.length > 0 && (
                      <div>
                        {equippedEffects.length > 0 && (
                          <div className="text-xs text-orange-400 font-bold uppercase mb-2 pt-2 border-t border-gray-700">
                            Additional Effects:
                          </div>
                        )}
                        <div className="space-y-2">
                          {previewEffects.map((effect, idx) => (
                            <div key={idx} className="text-xs bg-charcoal p-2 rounded border border-orange-500/30">
                              <div className="flex items-start justify-between mb-1">
                                <div className="font-bold text-orange-400">
                                  {effect.effect_name || (
                                    effect.target_stat && (
                                      <>
                                        <span className="uppercase">{effect.target_stat}</span>
                                        {' '}
                                        <span className="text-green-400">
                                          {effect.effect_value > 0 ? '+' : ''}{effect.effect_value}{effect.is_percentage ? '%' : ''}
                                        </span>
                                      </>
                                    )
                                  )}
                                </div>
                                <div className="text-orange-400/70 text-[10px] uppercase">{effect.effect_type}</div>
                              </div>
                              {effect.description && (
                                <div className="text-gray-400 text-[11px]">{effect.description}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Available Slimsoft - Grid Layout Like Cyberdecks */}
              {unequippedSlimsoft.length > 0 && (
                <>
                  <div className="font-bold uppercase mb-3 text-sm" style={{ color: 'var(--fuschia)' }}>Available Software</div>
                  <div className="grid grid-cols-3 gap-3">
                  {unequippedSlimsoft.map((soft) => {
                    const isCompatible = soft.tier <= equippedDeckTier;
                    
                    return (
                      <div 
                        key={soft.id} 
                        className={`aspect-square rounded-lg overflow-hidden bg-charcoal-75 transition-all border border-charcoal relative cursor-pointer ${!isCompatible ? 'incompatible-soft-tile' : ''}`}
                        onClick={() => {
                          if (!isCompatible) {
                            const isSelecting = selectedIncompatibleId !== soft.id;
                            setSelectedIncompatibleId(isSelecting ? soft.id : null);
                            return;
                          }
                          const isExpanding = previewSoftId !== soft.id;
                          setPreviewSoftId(isExpanding ? soft.id : null);
                        }}
                      >
                        <div className="w-full h-full flex flex-col relative">
                          {/* Item Image */}
                          <div className="flex-1 flex items-center justify-center p-1 relative">
                            {soft.image_url ? (
                              <img 
                                src={soft.image_url} 
                                alt={soft.name}
                                className={`max-w-full max-h-full object-contain ${!isCompatible ? 'opacity-30' : ''}`}
                              />
                            ) : (
                              <span className={`material-symbols-outlined text-4xl ${!isCompatible ? 'text-gray-700' : 'text-gray-600'}`}>
                                terminal
                              </span>
                            )}
                            
                            {/* Tier Badge */}
                            <div className="absolute top-2 right-2">
                              <div className={`flex items-center gap-0.5 px-2 py-1 rounded-full ${getTierColor(soft.tier)} ${!isCompatible ? 'bg-black/60' : 'bg-black/80'}`}>
                                <span className="material-symbols-outlined text-sm" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
                                <span className="text-xs font-bold">{soft.tier}</span>
                              </div>
                            </div>
                            
                            {/* Incompatible Lock Overlay - Default State */}
                            {!isCompatible && selectedIncompatibleId !== soft.id && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="material-symbols-outlined text-2xl text-gray-600">lock</span>
                              </div>
                            )}

                            {/* Incompatible Details Link Overlay - Selected State */}
                            {!isCompatible && selectedIncompatibleId === soft.id && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 p-3">
                                <div className="flex items-center gap-2 text-sm text-red-400 font-bold mb-4">
                                  <span>LOCKED</span>
                                  <span className="material-symbols-outlined text-lg">lock</span>
                                </div>
                                <div className="text-xs text-gray-400 mb-3 text-center">
                                  Requires Tier {soft.tier}+ Deck
                                </div>
                                <a 
                                  href={`/gear/${soft.id}`}
                                  className="text-xs text-gray-400 hover:text-bright-blue transition-colors underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  See details
                                </a>
                              </div>
                            )}
                            
                            {/* Item Name Overlay */}
                            {selectedIncompatibleId !== soft.id && (
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                                <div className="text-xs font-bold text-white line-clamp-2">
                                  {soft.name}{soft.upgrade && soft.upgrade > 0 ? ` +${soft.upgrade}` : ''}
                                </div>
                              </div>
                            )}

                            {/* Preview & Equip Overlay - Compatible Items */}
                            {previewSoftId === soft.id && isCompatible && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 p-3">
                                <div className="flex items-center gap-2 text-sm text-orange-400 font-bold mb-4">
                                  <span>PREVIEW</span>
                                  <span className="material-symbols-outlined text-lg">close</span>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEquip(soft.id, 'slimsoft');
                                  }}
                                  disabled={isProcessing || equippedSlimsoft.length >= 3}
                                  className="py-2 px-6 rounded bg-bright-blue hover:bg-blue-600 text-white text-xs font-bold uppercase transition-colors disabled:opacity-50 mb-2"
                                >
                                  Equip
                                </button>
                                <a 
                                  href={`/gear/${soft.id}`}
                                  className="text-xs text-gray-400 hover:text-bright-blue transition-colors underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  See details
                                </a>
                              </div>
                            )}
                          </div>

                          {/* Item Info */}
                          <div className="p-2 bg-charcoal">
                            <div className="text-xs font-bold text-white truncate">
                              {soft.name}{soft.upgrade && soft.upgrade > 0 ? ` +${soft.upgrade}` : ''}
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <div className={`flex items-center gap-0.5 ${getTierColor(soft.tier)}`}>
                                <span className="material-symbols-outlined text-sm" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
                                <span className="text-xs font-bold">{soft.tier}</span>
                              </div>
                            </div>
                            {!isCompatible && (
                              <div className="mt-1 text-[10px] text-red-400">
                                Requires Tier {soft.tier}+ Deck
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                </>
              )}

              {unequippedSlimsoft.length === 0 && equippedSlimsoft.length === 0 && (
                <div className="text-center text-gray-400 py-8">
                  <span className="material-symbols-outlined text-5xl mb-2 block">terminal</span>
                  <div>No software acquired</div>
                </div>
              )}
              </CxCard>
            </div>

            {/* View All Gear Button */}
            <div className="mt-4">
              <a 
                href="/gear"
                className="block w-full py-3 px-4 rounded bg-bright-blue hover:bg-blue-600 text-white text-center font-bold uppercase transition-colors"
              >
                View All Gear
              </a>
            </div>
          </>
        ) : (
          /* ARSENAL TAB */
          <>
            <div className="mb-4">
              <p className="text-gray-400 text-sm">Your carry capacity of equipped weapons, accessories, and key items. Total equip capacity determined by Power attribute.</p>
            </div>

            {/* Arsenal Slots Card */}
            <CxCard className="mb-4">
              {(() => {
                const power = userStats?.power || 0;
                const arsenalSlots = Math.max(1, Math.floor(Math.floor(power / 2) - 2));
                const equippedArsenal = arsenalItems.filter(item => item.is_equipped === 1);
                
                return (
                  <>
                    <div className="font-bold uppercase mb-4" style={{ color: 'var(--fuschia)' }}>
                      Arsenal ({equippedArsenal.length}/{arsenalSlots} slots)
                    </div>

                    {/* Equipped Arsenal Slots */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      {Array.from({ length: arsenalSlots }).map((_, index) => {
                        const item = equippedArsenal[index];
                        
                        return (
                          <div key={index} className={`aspect-square rounded bg-charcoal-75 flex items-center justify-center border-2 ${
                            item ? 'border-bright-blue' : 'border-gray-700 border-dashed'
                          }`}>
                            {item ? (
                              <div className="w-full h-full p-2">
                                <a href={`/gear/${item.id}`} className="w-full h-[calc(100%-32px)] flex items-center justify-center mb-2 hover:opacity-75 transition-opacity">
                                  {item.image_url ? (
                                    <img src={item.image_url} alt={item.name} className="max-w-full max-h-full object-contain" />
                                  ) : (
                                    <span className="material-symbols-outlined text-4xl text-gray-600">
                                      {item.item_type.toLowerCase() === 'weapon' ? 'swords' : 
                                       item.item_type.toLowerCase() === 'accessory' ? 'watch' : 'star'}
                                    </span>
                                  )}
                                </a>
                                <button
                                  onClick={() => handleUnequip(item.id, 'arsenal')}
                                  disabled={isProcessing}
                                  className="w-full py-1 px-2 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase transition-colors disabled:opacity-50"
                                >
                                  Unequip
                                </button>
                              </div>
                            ) : (
                              <div className="text-center">
                                <span className="material-symbols-outlined text-4xl text-gray-700">add_circle</span>
                                <div className="text-xs text-gray-600 mt-1">Empty Slot</div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Active Arsenal Effects */}
                    <div className="mt-4 p-3 bg-charcoal-75 rounded">
                      <div className="font-bold text-sm mb-2" style={{ color: 'var(--fuschia)' }}>Active Arsenal Effects</div>
                      <div className="text-sm text-gray-400 italic">Arsenal effects coming soon...</div>
                    </div>
                  </>
                );
              })()}
            </CxCard>

            {/* Arsenal Effects Preview Section */}
            {previewArsenalId && (() => {
              const previewItem = arsenalItems.find(item => item.id === previewArsenalId);
              if (!previewItem) return null;

              return (
                <div className="mb-4 p-3 bg-charcoal-75 rounded border border-orange-500">
                  <div className="font-bold uppercase text-xs mb-3 text-orange-400">
                    Preview: Arsenal Item
                  </div>
                  
                  <div className="text-xs bg-charcoal p-2 rounded border border-gray-700">
                    <div className="flex items-start justify-between mb-1">
                      <div className="font-bold text-bright-blue">
                        {previewItem.name}{previewItem.upgrade && previewItem.upgrade > 0 ? ` +${previewItem.upgrade}` : ''}
                      </div>
                      <div className="text-fuchsia-400 text-[10px] uppercase">{previewItem.item_type}</div>
                    </div>
                    {previewItem.description && (
                      <div className="text-gray-400 text-[11px] mt-2">{previewItem.description}</div>
                    )}
                    <div className="mt-2 text-gray-500 text-[11px] italic">
                      Arsenal effects coming soon...
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Available Items */}
            <CxCard>
              <div className="font-bold uppercase mb-3 text-sm" style={{ color: 'var(--fuschia)' }}>Available Items</div>
              
              {(() => {
                const unequippedArsenal = arsenalItems.filter(item => item.is_equipped !== 1);
                const power = userStats?.power || 0;
                const arsenalSlots = Math.max(1, Math.floor(Math.floor(power / 2) - 2));
                const equippedCount = arsenalItems.filter(item => item.is_equipped === 1).length;
                const canEquipMore = equippedCount < arsenalSlots;
                
                if (unequippedArsenal.length === 0) {
                  return (
                    <div className="text-center text-gray-400 py-8">
                      <span className="material-symbols-outlined text-5xl mb-2 block">swords</span>
                      <div>No unequipped arsenal items</div>
                    </div>
                  );
                }
                
                return (
                  <div className="grid grid-cols-3 gap-3">
                    {unequippedArsenal.map((item) => (
                      <div 
                        key={item.id}
                        className={`arsenal-tile rounded-lg bg-charcoal-75 border-2 ${
                          selectedArsenalId === item.id
                            ? 'border-bright-blue'
                            : 'border-gray-700'
                        } relative cursor-pointer transition-colors`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedArsenalId(selectedArsenalId === item.id ? null : item.id);
                          setPreviewArsenalId(item.id);
                        }}
                      >
                        <div className="w-full flex flex-col relative">
                          <div className="aspect-square flex items-center justify-center p-2 relative overflow-hidden rounded-t-lg">
                            {item.image_url ? (
                              <img src={item.image_url} alt={item.name} className="max-w-full max-h-full object-contain" />
                            ) : (
                              <span className="material-symbols-outlined text-4xl text-gray-600">
                                {item.item_type.toLowerCase() === 'weapon' ? 'swords' : 
                                 item.item_type.toLowerCase() === 'accessory' ? 'watch' : 'star'}
                              </span>
                            )}
                            
                            {/* Item Name Overlay */}
                            {selectedArsenalId !== item.id && (
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                                <div className="text-xs font-bold text-white line-clamp-2">
                                  {item.name}{item.upgrade && item.upgrade > 0 ? ` +${item.upgrade}` : ''}
                                </div>
                              </div>
                            )}

                            {/* Action buttons when selected */}
                            {selectedArsenalId === item.id && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 p-3">
                                <div className="flex items-center gap-2 text-sm text-bright-blue font-bold mb-4">
                                  <span>SELECTED</span>
                                  <span className="material-symbols-outlined text-lg">close</span>
                                </div>
                                {canEquipMore ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEquip(item.id, 'arsenal');
                                    }}
                                    disabled={isProcessing}
                                    className="py-2 px-6 rounded bg-bright-blue hover:bg-blue-600 text-white text-xs font-bold uppercase transition-colors disabled:opacity-50 mb-2"
                                  >
                                    Equip
                                  </button>
                                ) : (
                                  <div className="py-2 px-6 rounded bg-gray-700 text-gray-400 text-xs font-bold uppercase mb-2">
                                    Arsenal Full
                                  </div>
                                )}
                                <a 
                                  href={`/gear/${item.id}`}
                                  className="text-xs text-gray-400 hover:text-bright-blue transition-colors underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  See details
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CxCard>

            {/* View All Gear Button */}
            <div className="mt-4">
              <a 
                href="/gear"
                className="block w-full py-3 px-4 rounded bg-bright-blue hover:bg-blue-600 text-white text-center font-bold uppercase transition-colors"
              >
                View All Gear
              </a>
            </div>
          </>
        )}
      </div>

      {/* Unequip Slimsoft Modal */}
      <ConfirmModal
        isOpen={showUnequipModal}
        title="Unequip Slimsoft"
        description={`Do you want to unequip ${unequipTarget?.name || 'this slimsoft'}?`}
        onConfirm={async () => {
          if (unequipTarget) {
            await handleUnequip(unequipTarget.itemId, 'slimsoft');
            setUnequipTarget(null);
            setSelectedSoftId(null);
          }
          setShowUnequipModal(false);
        }}
        onCancel={() => {
          setShowUnequipModal(false);
          setUnequipTarget(null);
        }}
        isConfirming={isProcessing}
      />

      {/* Replace Cyberdeck Confirmation Modal */}
      {showReplaceModal && pendingEquip && (
        <ConfirmModal
          isOpen={showReplaceModal}
          title="Replace Cyberdeck"
          description="Do you want to replace the equipped cyberdeck with this one?"
          onConfirm={() => performEquip(pendingEquip.itemId, pendingEquip.slotType)}
          onCancel={() => {
            setShowReplaceModal(false);
            setPendingEquip(null);
          }}
          isConfirming={isProcessing}
        />
      )}

      {/* Upgrade Hardware Confirmation Modal */}
      {showUpgradeModal && upgradeTarget && (
        <ConfirmModal
          isOpen={showUpgradeModal}
          title="Upgrade your hardware?"
          description={`This will consume ${upgradeTarget.requiredQty} ${upgradeTarget.upgradeMaterial?.name || 'material'}${upgradeTarget.requiredQty > 1 ? 's' : ''}.`}
          onConfirm={handleUpgrade}
          onCancel={() => {
            setShowUpgradeModal(false);
            setUpgradeTarget(null);
          }}
          isConfirming={isProcessing}
        />
      )}
      </div>
    </>
  );
}
