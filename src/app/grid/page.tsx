"use client";
import React, { useState, useEffect } from 'react';
import { NavStrip, CxCard } from '../../components/CxShared';
import ConfirmModal from '../../components/ConfirmModal';
import LevelUpModal from '../../components/LevelUpModal';
import CompactMeterStrip from '../../components/CompactMeterStrip';
import { useNavData } from '../../hooks/useNavData';
import { useAuthenticatedUser } from '../../hooks/useAuthenticatedUser';
import { useCountdownTimer } from '../../hooks/useCountdownTimer';
import { getMeterData } from '../../lib/meterUtils';

interface Subnet {
  id: number;
  name: string;
  description?: string;
  image_url?: string;
  unlocked_at: string;
  unlock_method: string;
}

interface Protocol {
  id: number;
  name: string;
  controlling_alignment_id?: number;
  description?: string;
  access_rep_id?: number;
  access_gig_id?: number;
  image_url?: string;
  alignment_name?: string;
}

interface SlimsoftEffect {
  item_id: number;
  effect_name: string;
  effect_type: string;
  available_at: string;
  target_stat?: string;
  effect_value?: number;
  is_percentage?: number;
  description?: string;
  slimsoft_name: string;
  slimsoft_image_url?: string;
}

interface HardwareItem {
  id: number;
  name: string;
  image_url?: string;
  is_equipped: number;
}

interface ScanAction {
  id: number;
  timestamp: string;
  end_time: string;
  result_status?: string;
}

interface UserStats {
  current_charge: number;
  current_bandwidth: number;
  current_neural: number;
  current_thermal: number;
  max_bandwidth: number;
}

export default function GridPage() {
  const { userFid, isLoading: isAuthLoading } = useAuthenticatedUser();
  const navData = useNavData(userFid || 0);
  const [subnets, setSubnets] = useState<Subnet[]>([]);
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [slimsoftEffects, setSlimsoftEffects] = useState<SlimsoftEffect[]>([]);
  const [equippedSlimsoft, setEquippedSlimsoft] = useState<HardwareItem[]>([]);
  const [hasMirror, setHasMirror] = useState(false);
  const [mirrorItem, setMirrorItem] = useState<HardwareItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [activeScan, setActiveScan] = useState<ScanAction | null>(null);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showScanResults, setShowScanResults] = useState(false);
  const [scanResults, setScanResults] = useState<any>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [newLevel, setNewLevel] = useState(0);
  const [isLoadingScanResults, setIsLoadingScanResults] = useState(false);
  
  // Use countdown timer hook for active scan
  const { timeRemaining, isComplete: isScanComplete } = useCountdownTimer(activeScan?.end_time || null);

  useEffect(() => {
    async function loadData() {
      if (!userFid) return;
      
      try {
        // Parallelize all independent API calls
        const [subnetsRes, protocolsRes, hardwareRes, effectsRes, statsRes, scanStatusRes] = await Promise.all([
          fetch(`/api/subnets?fid=${userFid}`),
          fetch(`/api/protocols?fid=${userFid}`),
          fetch(`/api/hardware?fid=${userFid}`),
          fetch(`/api/slimsoft/effects?fid=${userFid}`),
          fetch(`/api/stats?fid=${userFid}`),
          fetch(`/api/grid/scan-status?fid=${userFid}`)
        ]);

        // Process user stats
        if (statsRes.ok) {
          const stats = await statsRes.json();
          setUserStats(stats);
        }

        // Process scan status
        if (scanStatusRes.ok) {
          const scanData = await scanStatusRes.json();
          if (scanData.activeScan) {
            setActiveScan(scanData.activeScan);
          }
        }

        // Process subnets
        if (subnetsRes.ok) {
          const subnetsData = await subnetsRes.json();
          setSubnets(subnetsData);
        }

        // Process protocols
        if (protocolsRes.ok) {
          const protocolsData = await protocolsRes.json();
          setProtocols(protocolsData);
        }

        // Process hardware to check for equipped slimsoft
        let equippedSlimsoftItems: HardwareItem[] = [];
        if (hardwareRes.ok) {
          const hardwareData = await hardwareRes.json();
          if (hardwareData.slimsoft) {
            equippedSlimsoftItems = hardwareData.slimsoft.filter((s: HardwareItem) => s.is_equipped === 1);
            setEquippedSlimsoft(equippedSlimsoftItems);
            
            // Check if item id 68 (MIRROR) is equipped
            const mirror = equippedSlimsoftItems.find((s: HardwareItem) => s.id === 68);
            setHasMirror(!!mirror);
            setMirrorItem(mirror || null);
          }
        }

        // Process slimsoft effects for grid actions
        if (effectsRes.ok) {
          const effectsData = await effectsRes.json();
          if (effectsData.effects) {
            // Filter for action effects available in grid from equipped slimsoft
            const equippedIds = equippedSlimsoftItems.map(s => s.id);
            const gridActions = effectsData.effects.filter((e: SlimsoftEffect) => {
              if (!equippedIds.includes(e.item_id)) return false;
              if (e.effect_type !== 'action') return false;
              if (!e.available_at) return false;
              const locations = e.available_at.split(',').map(loc => loc.trim().toLowerCase());
              return locations.includes('grid') || locations.includes('cyberspace');
            });
            setSlimsoftEffects(gridActions);
          }
        }
      } catch (err) {
        console.error('Failed to load grid data:', err);
      } finally {
        setLoading(false);
      }
    }
    
    if (userFid && !isAuthLoading) {
      loadData();
    }
  }, [userFid, isAuthLoading]);

  const chargeCost = 15;
  const canScan = userStats && 
    userStats.current_charge >= chargeCost &&
    userStats.current_bandwidth >= 1 &&
    !activeScan;

  const handleScanClick = () => {
    console.log('Scan button clicked');
    console.log('canScan:', canScan);
    console.log('userStats:', userStats);
    console.log('activeScan:', activeScan);
    if (canScan) {
      setShowScanModal(true);
    } else {
      console.log('Cannot scan - conditions not met:');
      console.log('  - userStats exists:', !!userStats);
      console.log('  - current_charge:', userStats?.current_charge);
      console.log('  - chargeCost:', chargeCost);
      console.log('  - current_bandwidth:', userStats?.current_bandwidth);
      console.log('  - activeScan:', activeScan);
    }
  };

  const handleConfirmScan = async () => {
    if (isConfirming) return;
    
    setIsConfirming(true);
    try {
      const res = await fetch(`/api/grid/scan?fid=${userFid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chargeCost })
      });

      if (res.ok) {
        const data = await res.json();
        setActiveScan(data.scanAction);
        setUserStats(data.updatedStats);
        setShowScanModal(false);
      }
    } catch (err) {
      console.error('Failed to start scan:', err);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleViewScanResults = async () => {
    if (isLoadingScanResults) return;
    setIsLoadingScanResults(true);
    try {
      const res = await fetch(`/api/grid/scan-results?fid=${userFid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historyId: activeScan?.id })
      });

      if (res.ok) {
        const data = await res.json();
        setScanResults(data);
        setActiveScan(null);
        
        // Update user stats
        if (data.updatedStats) {
          setUserStats(data.updatedStats);
        }
        
        // Check for level up
        if (data.levelUp && data.levelUp.leveledUp) {
          setNewLevel(data.levelUp.newLevel);
          setShowLevelUpModal(true);
        }
      }
    } catch (err) {
      console.error('Failed to get scan results:', err);
    } finally {
      setIsLoadingScanResults(false);
    }
  };

  const handleBackFromScanResults = () => {
    setScanResults(null);
  };

  if (loading) {
    return (
      <div className="frame-container frame-grid">
        <div className="frame-body flex items-center justify-center min-h-[600px]">
          <div className="animate-spin w-16 h-16 border-4 border-gray-600 border-t-fuschia rounded-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="frame-container frame-grid">
      <div className="frame-body pt-6 pb-2 px-6">
        <NavStrip 
          username={navData.username}
          userProfileImage={navData.profileImage}
          cxBalance={navData.cxBalance}
        />
      </div>
      <CompactMeterStrip meters={getMeterData(userStats)} />

      <div className="pt-5 pb-2 px-6 flex flex-row gap-3 items-center">
        <a href="/dashboard" className="w-[25px] h-[25px] rounded-full overflow-hidden bg-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-600 transition-colors">
          <span className="material-symbols-outlined text-white text-xl">chevron_left</span>
        </a>
        <div className="masthead">CYBERSPACE</div>
      </div>

      <div className="frame-body">
        {/* Welcome Message */}
        <div className="py-6 text-center" style={{ fontFamily: 'var(--font-mono)' }}>
          <div className="text-xl font-semibold text-white mb-1.5">WELCOME TO CXNET</div>
          <div className="text-xs text-gray-400">BUILD 104.76.3.10</div>
        </div>

        {/* MIRROR Check (Slimsoft ID 68) */}
        <CxCard className="mb-6">
          {!hasMirror ? (
            <div className="text-center text-gray-400 py-2">
              No identity obfuscation utility detected
            </div>
          ) : (
            <div className="flex items-center gap-4">
              {mirrorItem?.image_url && (
                <div className="w-[50px] h-[50px] flex-shrink-0">
                  <img 
                    src={mirrorItem.image_url} 
                    alt={mirrorItem.name} 
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex-1 text-center text-white">
                MIRROR: Digital identity is obfuscated.
              </div>
            </div>
          )}
        </CxCard>

        {/* Actions Section */}
        <div className="mb-6">
          <h2 className="text-white font-bold uppercase text-lg mb-3">ACTIONS</h2>
          
          {/* Overnet Scan Action */}
          <div className="mb-3">
            {scanResults ? (
              <div>
                <div className="modal-base mb-2">
                  <div className="modal-title mb-2">SCAN RESULTS</div>
                  <div className="modal-body-data space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">Gained XP</span>
                      <span className="pill-cloud-gray">{scanResults.xpGained} XP</span>
                    </div>
                    {scanResults.discoveredSubnet && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">Discovered Subnet</span>
                        <span className="text-green-400 font-semibold">{scanResults.discoveredSubnet.name}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {scanResults.encounter && (
                  <div className="modal-base mb-2 border-2 border-yellow-500/50">
                    <div className="modal-title mb-2 text-yellow-400">⚠ ENCOUNTER DETECTED</div>
                    <div className="modal-body-data space-y-2">
                      <div className="text-gray-300 text-sm">
                        You've encountered <span className="text-white font-semibold">{scanResults.encounter.name}</span>, 
                        a <span className="text-cyan-400">{scanResults.encounter.type}</span> with {' '}
                        <span className={`font-semibold ${
                          scanResults.encounter.sentiment === 'attack' ? 'text-red-500' :
                          scanResults.encounter.sentiment === 'hostile' ? 'text-orange-500' :
                          scanResults.encounter.sentiment === 'neutral' ? 'text-yellow-400' :
                          'text-green-400'
                        }`}>{scanResults.encounter.sentiment}</span> intentions.
                      </div>
                    </div>
                  </div>
                )}

                {scanResults.encounter ? (
                  <div className="space-y-2">
                    <button 
                      className="btn-cx btn-cx-primary btn-cx-full"
                      onClick={() => window.location.href = `/encounters/${scanResults.encounter.id}`}
                    >
                      OPEN ENCOUNTER
                    </button>
                    <button 
                      className="btn-cx btn-cx-secondary btn-cx-full"
                      onClick={handleBackFromScanResults}
                    >
                      RUN AWAY (DISMISS)
                    </button>
                  </div>
                ) : (
                  <button 
                    className="btn-cx btn-cx-secondary btn-cx-full"
                    onClick={handleBackFromScanResults}
                  >
                    DISMISS
                  </button>
                )}
              </div>
            ) : activeScan ? (
              <div>
                <button 
                  className={`btn-cx btn-cx-pause btn-cx-full mb-2 ${!isScanComplete || isLoadingScanResults ? 'cursor-default opacity-75' : ''}`}
                  onClick={handleViewScanResults}
                  disabled={!isScanComplete || isLoadingScanResults}
                >
                  {isLoadingScanResults ? 'LOADING RESULTS...' : isScanComplete ? 'VIEW RESULTS' : 'SCANNING IN PROGRESS'}
                </button>
                <div className="text-white text-center text-xs">{timeRemaining}</div>
              </div>
            ) : (
              <button 
                className={`btn-cx btn-cx-full ${canScan ? 'btn-cx-primary' : 'btn-cx-disabled'}`}
                onClick={handleScanClick}
                disabled={!canScan}
              >
                OVERNET SCAN
              </button>
            )}
          </div>

          {/* Slimsoft Actions */}
          {slimsoftEffects.length === 0 ? (
            <div className="text-center text-gray-400 py-4 mb-3">
              No equipped slimsoft
            </div>
          ) : slimsoftEffects.length === 1 ? (
            // Single action: full width button with left-aligned image and centered text
            <button 
              className="btn-cx btn-cx-action btn-cx-full mb-3 relative flex items-center justify-center py-4"
              disabled
            >
              {slimsoftEffects[0].slimsoft_image_url && (
                <div className="absolute left-4">
                  <img 
                    src={slimsoftEffects[0].slimsoft_image_url} 
                    alt={slimsoftEffects[0].effect_name} 
                    className="w-[50px] h-[50px]"
                  />
                </div>
              )}
              <span 
                className="text-xl"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {slimsoftEffects[0].effect_name?.toUpperCase() || 'ACTION'}
              </span>
            </button>
          ) : (
            // Multiple actions: two-column grid
            <div className="grid grid-cols-2 gap-1.5 mb-3">
              {slimsoftEffects.map((action) => (
                <button 
                  key={action.item_id}
                  className="btn-cx btn-cx-action flex flex-col items-center justify-center py-4"
                  disabled
                >
                  {action.slimsoft_image_url && (
                    <img 
                      src={action.slimsoft_image_url} 
                      alt={action.effect_name} 
                      className="w-[50px] h-[50px] mb-2"
                    />
                  )}
                  <span 
                    className="text-xs"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {action.effect_name?.toUpperCase() || 'ACTION'}
                  </span>
                </button>
              ))}
            </div>
          )}
          
          <a href="/hardware#slimsoft" className="btn-cx btn-cx-secondary btn-cx-full block text-center">
            MANAGE SLIMSOFT
          </a>
        </div>

        {/* Subnets Section */}
        <div className="mb-6">
          <h2 className="text-white font-bold uppercase text-lg mb-3">SUBNETS</h2>
          
          {subnets.length === 0 ? (
            <div className="text-center text-gray-400 text-xs py-4">
              Explore the Net to discover more
            </div>
          ) : (
            <>
              <div className="space-y-3 mb-3">
                {subnets.map((subnet) => (
                  <CxCard key={subnet.id} href={`/grid/subnet/${subnet.id}`}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-white font-bold uppercase text-lg">{subnet.name}</h3>
                    </div>
                  </CxCard>
                ))}
              </div>
              <div className="text-center text-gray-400 text-xs">
                Explore the Net to discover more
              </div>
            </>
          )}
        </div>

        {/* Protocols Section */}
        <div className="mb-6">
          <h2 className="text-white font-bold uppercase text-lg mb-3">PROTOCOLS</h2>
          
          {protocols.length === 0 ? (
            <div className="text-center text-gray-400 text-xs py-4">
              Complete gigs to unlock new protocols
            </div>
          ) : (
            <>
              <div className="space-y-3 mb-3">
                {protocols.map((protocol) => (
                  <CxCard key={protocol.id}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-white font-bold uppercase text-lg">{protocol.name}</h3>
                      {protocol.alignment_name && (
                        <span className="pill-cloud-gray text-xs">{protocol.alignment_name}</span>
                      )}
                    </div>
                  </CxCard>
                ))}
              </div>
              <div className="text-center text-gray-400 text-xs">
                Complete gigs to unlock new protocols
              </div>
            </>
          )}
        </div>
      </div>

      {/* Overnet Scan Confirmation Modal */}
      <ConfirmModal
        isOpen={showScanModal}
        title="Start Overnet Scan?"
        description="Scan the Overnet for new subnets, protocols, and data."
        costInfo={[`Cost: ${chargeCost} Charge, 1 Bandwidth`]}
        durationInfo="Duration: 1 hour"
        onCancel={() => setShowScanModal(false)}
        onConfirm={handleConfirmScan}
        isConfirming={isConfirming}
      />

      {/* Level Up Modal */}
      <LevelUpModal 
        isOpen={showLevelUpModal} 
        newLevel={newLevel} 
        onDismiss={() => setShowLevelUpModal(false)} 
      />
    </div>
  );
}
