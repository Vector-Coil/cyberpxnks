'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FrameHeader, CxCard, NavStrip } from '../../components/CxShared';
import NavDrawer from '../../components/NavDrawer';
import { useNavData } from '../../hooks/useNavData';
import { useAuthenticatedUser } from '../../hooks/useAuthenticatedUser';

interface UserStats {
  cognition: number;
  insight: number;
  interface: number;
  power: number;
  resilience: number;
  agility: number;
  unallocated_points: number;
}

interface CompleteStats {
  // User base stats
  cognition: number;
  insight: number;
  interface: number;
  power: number;
  resilience: number;
  agility: number;
  unallocated_points: number;
  
  // Current/Max stats
  current_consciousness: number;
  current_stamina: number;
  current_charge: number;
  current_bandwidth: number;
  current_thermal: number;
  current_neural: number;
  max_consciousness: number;
  max_stamina: number;
  max_charge: number;
  max_bandwidth: number;
  max_thermal: number;
  max_neural: number;
  
  // Tech stats (base values from user_stats)
  total_clock: number;
  total_cooling: number;
  total_signal: number;
  total_latency: number;
  total_crypt: number;
  total_cache: number;
  
  // Tech stats (calculated with hardware)
  clock_speed: number;
  cooling: number;
  signal_noise: number;
  latency: number;
  decryption: number;
  cache: number;
  
  // Hardware modifiers
  total_cell_capacity: number;
  total_processor: number;
  total_heat_sink: number;
  total_memory: number;
  total_lifi: number;
  total_encryption: number;
  
  // Slimsoft modifiers
  slimsoft_decryption: number;
  slimsoft_encryption: number;
  antivirus: number;
  
  // Combat stats (base from class)
  base_tac: number;
  base_smt: number;
  base_off: number;
  base_def: number;
  base_evn: number;
  base_sth: number;
  
  // Combat stats (mods from arsenal)
  mod_tac: number;
  mod_smt: number;
  mod_off: number;
  mod_def: number;
  mod_evn: number;
  mod_sth: number;
  
  // Combat stats (totals)
  tactical: number;
  smart_tech: number;
  offense: number;
  defense: number;
  evasion: number;
  stealth: number;
}

export default function StatsPage() {
  const router = useRouter();
  const { userFid, isLoading: isAuthLoading } = useAuthenticatedUser();
  const navData = useNavData(userFid || 0);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [completeStats, setCompleteStats] = useState<CompleteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [allocations, setAllocations] = useState<{[key: string]: number}>({
    cognition: 0,
    insight: 0,
    interface: 0,
    power: 0,
    resilience: 0,
    agility: 0
  });
  const [saving, setSaving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Section collapse states
  const [showUserStats, setShowUserStats] = useState(true);
  const [showTechStats, setShowTechStats] = useState(true);
  const [showCalculatedStats, setShowCalculatedStats] = useState(true);

  useEffect(() => {
    if (userFid && !isAuthLoading) {
      fetchStats();
    }
  }, [userFid, isAuthLoading]);

  const fetchStats = async () => {
    if (!userFid) return;
    
    try {
      const res = await fetch(`/api/stats?fid=${userFid}`);
      if (res.ok) {
        const data = await res.json();
        setCompleteStats(data);
        setStats({
          cognition: data.cognition || 5,
          insight: data.insight || 5,
          interface: data.interface || 5,
          power: data.power || 5,
          resilience: data.resilience || 5,
          agility: data.agility || 5,
          unallocated_points: data.unallocated_points || 0
        });
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
      setError('Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  const increment = (stat: string) => {
    const totalAllocated = Object.values(allocations).reduce((sum, val) => sum + val, 0);
    if (stats && totalAllocated < stats.unallocated_points) {
      setAllocations(prev => ({ ...prev, [stat]: prev[stat] + 1 }));
    }
  };

  const decrement = (stat: string) => {
    if (allocations[stat] > 0) {
      setAllocations(prev => ({ ...prev, [stat]: prev[stat] - 1 }));
    }
  };

  const handleSave = () => {
    const totalAllocated = Object.values(allocations).reduce((sum, val) => sum + val, 0);
    if (totalAllocated === 0) {
      router.push('/dashboard');
      return;
    }
    setShowConfirmModal(true);
  };

  const handleConfirm = async () => {
    if (!stats || !userFid) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/allocate-points?fid=${userFid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocations })
      });

      if (res.ok) {
        router.push('/dashboard');
      } else {
        const errorData = await res.json();
        setError(errorData.error || 'Failed to allocate points');
        setShowConfirmModal(false);
      }
    } catch (err) {
      console.error('Failed to allocate points:', err);
      setError('Network error. Please try again.');
      setShowConfirmModal(false);
    } finally {
      setSaving(false);
    }
  };

  const statLabels = {
    cognition: { name: 'Cognition', desc: 'Mental processing → Max Consciousness' },
    insight: { name: 'Insight', desc: 'Perception → Max Consciousness' },
    interface: { name: 'Interface', desc: 'Technical interaction' },
    power: { name: 'Power', desc: 'Raw strength → Max Stamina' },
    resilience: { name: 'Resilience', desc: 'Endurance → Max Stamina & Consciousness' },
    agility: { name: 'Agility', desc: 'Speed and reflexes → Max Stamina' }
  };

  if (loading) {
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
          <div className="frame-body pt-6 pb-2 px-6">
            <NavStrip 
              username={navData.username}
              userProfileImage={navData.profileImage}
              cxBalance={navData.cxBalance}
              onMenuClick={() => setIsDrawerOpen(true)}
            />
          </div>
          <FrameHeader />
          <div className="frame-body flex items-center justify-center">
            <div className="animate-spin w-16 h-16 border-4 border-gray-600 border-t-fuschia rounded-full"></div>
          </div>
        </div>
      </>
    );
  }

  if (!stats || !completeStats) {
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
          <div className="frame-body pt-6 pb-2 px-6">
            <NavStrip 
              username={navData.username}
              userProfileImage={navData.profileImage}
              cxBalance={navData.cxBalance}
              onMenuClick={() => setIsDrawerOpen(true)}
            />
          </div>
          <FrameHeader />
          <div className="frame-body p-6">
            <div className="text-red-400">Failed to load stats</div>
          </div>
        </div>
      </>
    );
  }

  const totalAllocated = Object.values(allocations).reduce((sum, val) => sum + val, 0);
  const pointsRemaining = stats.unallocated_points - totalAllocated;
  const hasPoints = stats.unallocated_points > 0;
  const hasChanges = totalAllocated > 0;

  // Helper to render collapsible section header
  const renderSectionHeader = (title: string, isOpen: boolean, toggle: () => void) => (
    <div 
      className="flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity mb-4"
      onClick={toggle}
    >
      <h2 className="text-xl font-bold uppercase text-fuschia">{title}</h2>
      <span className="material-symbols-outlined text-fuschia">
        {isOpen ? 'expand_less' : 'expand_more'}
      </span>
    </div>
  );

  // Helper to render stat row in table format
  const renderStatRow = (label: string, base: number, mod: number, total: number, description?: string) => (
    <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 items-center py-2 border-b border-gray-700 last:border-0">
      <div>
        <div className="text-white font-semibold text-sm">{label}</div>
        {description && <div className="text-gray-500 text-xs">{description}</div>}
      </div>
      <div className="text-center">
        {base === 0 ? (
          <span className="pill-charcoal text-xs opacity-50">—</span>
        ) : (
          <span className="pill-charcoal text-xs">{base}</span>
        )}
      </div>
      <div className="text-center">
        {mod > 0 ? (
          <span className="pill-stat text-xs" style={{ color: 'var(--bright-green)' }}>+{mod}</span>
        ) : (
          <span className="pill-charcoal text-xs opacity-50">—</span>
        )}
      </div>
      <div className="text-center">
        <span className="pill-cloud-gray text-xs font-bold">{total}</span>
      </div>
    </div>
  );

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
        <div className="frame-body pt-6 pb-2 px-6">
          <NavStrip 
            username={navData.username}
            userProfileImage={navData.profileImage}
            cxBalance={navData.cxBalance}
            onMenuClick={() => setIsDrawerOpen(true)}
          />
        </div>
        
        <div className="pt-5 pb-2 px-6 flex flex-row gap-3 items-center">
          <a href="/dashboard" className="w-[25px] h-[25px] rounded-full overflow-hidden bg-bright-blue flex items-center justify-center cursor-pointer hover:bg-gray-600 transition-colors">
            <span className="material-symbols-outlined text-white text-xl">chevron_left</span>
          </a>
          <div className="masthead">STATS</div>
        </div>
      
        <div className="frame-body p-6 space-y-6">
          {error && (
            <div className="bg-red-900/30 border border-red-500 text-red-400 p-4 rounded">
              {error}
            </div>
          )}

          {/* Point Allocation Section - Only show when points available */}
          {hasPoints && (
            <CxCard>
              <h2 className="text-xl font-bold uppercase text-fuschia mb-4">Allocate Stat Points</h2>
              
              <div className="text-center mb-6 p-4 bg-charcoal-75 rounded">
                <span className="text-white font-bold text-2xl">{pointsRemaining}</span>
                <span className="text-gray-400 ml-2">points remaining</span>
              </div>

              <div className="space-y-3 mb-6">
                {Object.entries(statLabels).map(([key, { name, desc }]) => {
                  const currentValue = stats[key as keyof typeof stats] as number;
                  const newValue = currentValue + allocations[key];
                  const hasAllocation = allocations[key] > 0;

                  return (
                    <div key={key} className="flex items-center justify-between p-3 bg-charcoal-75 rounded">
                      <div className="flex-1">
                        <div className="text-white font-bold uppercase text-sm">{name}</div>
                        <div className="text-gray-500 text-xs">{desc}</div>
                        <div className="text-gray-400 text-sm mt-1">
                          Current: {currentValue}
                          {hasAllocation && (
                            <span className="text-fuschia ml-2">→ {newValue}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          className="w-8 h-8 bg-gray-700 text-white rounded flex items-center justify-center hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          onClick={() => decrement(key)}
                          disabled={allocations[key] === 0}
                        >
                          <span className="material-symbols-outlined text-lg">remove</span>
                        </button>
                        <span className="text-white font-bold text-lg w-8 text-center">
                          +{allocations[key]}
                        </span>
                        <button
                          className="w-8 h-8 bg-fuschia text-white rounded flex items-center justify-center hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
                          onClick={() => increment(key)}
                          disabled={pointsRemaining === 0}
                        >
                          <span className="material-symbols-outlined text-lg">add</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <button 
                  className="btn-cx btn-cx-secondary flex-1"
                  onClick={() => router.push('/dashboard')}
                >
                  {hasChanges ? 'CANCEL' : 'BACK'}
                </button>
                <button 
                  className="btn-cx btn-cx-primary flex-1"
                  onClick={handleSave}
                  disabled={!hasChanges}
                >
                  {hasChanges ? 'SAVE' : 'NO CHANGES'}
                </button>
              </div>
            </CxCard>
          )}

          {/* Netrunner Base Stats Section */}
          <CxCard>
            {renderSectionHeader('Netrunner Base Stats', showUserStats, () => setShowUserStats(!showUserStats))}
            
            {showUserStats && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column - Base Stats */}
                <div>
                  <div className="text-fuschia font-bold text-xs uppercase mb-3">Attributes</div>
                  <div className="space-y-3">
                    {Object.entries(statLabels).map(([key, { name, desc }]) => {
                      const value = stats[key as keyof typeof stats] as number;
                      return (
                        <div key={key} className="flex items-center justify-between p-3 bg-charcoal-75 rounded">
                          <div className="flex-1">
                            <div className="text-white font-bold uppercase text-sm">{name}</div>
                            <div className="text-gray-500 text-xs">{desc}</div>
                          </div>
                          <div>
                            <span className="pill-cloud-gray text-lg font-bold">{value}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* Right Column - Combat Stats */}
                <div>
                  <div className="text-fuschia font-bold text-xs uppercase mb-3">Combat Stats</div>
                  
                  {/* Table header */}
                  <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 items-center py-2 border-b-2 border-fuschia mb-3">
                    <div className="text-fuschia font-bold text-xs uppercase">Stat</div>
                    <div className="text-center text-fuschia font-bold text-xs uppercase">Base</div>
                    <div className="text-center text-fuschia font-bold text-xs uppercase">Mods</div>
                    <div className="text-center text-fuschia font-bold text-xs uppercase">Total</div>
                  </div>
                  
                  <div className="space-y-0">
                    {renderStatRow('Tactical', completeStats.base_tac || 0, completeStats.mod_tac || 0, completeStats.tactical || 0, 'Combat planning & strategy')}
                    {renderStatRow('Smart Tech', completeStats.base_smt || 0, completeStats.mod_smt || 0, completeStats.smart_tech || 0, 'Smart weapons & systems')}
                    {renderStatRow('Offense', completeStats.base_off || 0, completeStats.mod_off || 0, completeStats.offense || 0, 'Damage output & critical hits')}
                    {renderStatRow('Defense', completeStats.base_def || 0, completeStats.mod_def || 0, completeStats.defense || 0, 'Damage mitigation & resilience')}
                    {renderStatRow('Evasion', completeStats.base_evn || 0, completeStats.mod_evn || 0, completeStats.evasion || 0, 'Dodge & avoidance')}
                    {renderStatRow('Stealth', completeStats.base_sth || 0, completeStats.mod_sth || 0, completeStats.stealth || 0, 'Covert operations')}
                  </div>
                </div>
              </div>
            )}
          </CxCard>

          {/* Tech Stats Section (Hardware-based) */}
          <CxCard>
            {renderSectionHeader('Tech Stats', showTechStats, () => setShowTechStats(!showTechStats))}
            
            {showTechStats && (
              <>
                {/* Table header */}
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 items-center py-2 border-b-2 border-fuschia mb-3">
                  <div className="text-fuschia font-bold text-xs uppercase">Stat</div>
                  <div className="text-center text-fuschia font-bold text-xs uppercase">Base</div>
                  <div className="text-center text-fuschia font-bold text-xs uppercase">Mods</div>
                  <div className="text-center text-fuschia font-bold text-xs uppercase">Total</div>
                </div>

                {/* Tech Stats */}
                <div className="mb-4">
                  <div className="text-gray-400 text-xs uppercase font-bold mb-2">Calculated Stats</div>
                  {renderStatRow('Clock Speed', completeStats.total_clock, completeStats.total_processor, completeStats.clock_speed)}
                  {renderStatRow('Cooling', completeStats.total_cooling, completeStats.total_heat_sink, completeStats.cooling)}
                  {renderStatRow('Signal/Noise', completeStats.total_signal, completeStats.total_memory + completeStats.total_lifi, completeStats.signal_noise)}
                  {renderStatRow('Latency', completeStats.total_latency, completeStats.total_lifi, completeStats.latency)}
                  {renderStatRow('Decryption', completeStats.total_crypt, completeStats.total_encryption + (completeStats.slimsoft_decryption || 0), completeStats.decryption)}
                  {renderStatRow('Cache', completeStats.total_cache, completeStats.total_memory, completeStats.cache)}
                </div>

                {/* Hardware Stats */}
                <div>
                  <div className="text-gray-400 text-xs uppercase font-bold mb-2">Hardware Components</div>
                  <div className="space-y-2">
                    {renderStatRow('Cell Capacity', 0, completeStats.total_cell_capacity, completeStats.total_cell_capacity)}
                    {renderStatRow('Processor', 0, completeStats.total_processor, completeStats.total_processor)}
                    {renderStatRow('Heat Sink', 0, completeStats.total_heat_sink, completeStats.total_heat_sink)}
                    {renderStatRow('Memory', 0, completeStats.total_memory, completeStats.total_memory)}
                    {renderStatRow('Li-Fi', 0, completeStats.total_lifi, completeStats.total_lifi)}
                    {renderStatRow('Encryption', 0, completeStats.total_encryption, completeStats.total_encryption)}
                  </div>
                </div>
              </>
            )}
          </CxCard>

          {/* Calculated Stats Section */}
          <CxCard>
            {renderSectionHeader('Stat Meters', showCalculatedStats, () => setShowCalculatedStats(!showCalculatedStats))}
            
            {showCalculatedStats && (
              <div className="space-y-4">
                {/* Consciousness */}
                <div className="p-3 bg-charcoal-75 rounded">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-bold text-sm">Max Consciousness</span>
                    <span className="pill-cloud-gray font-bold">{completeStats.max_consciousness}</span>
                  </div>
                  <div className="text-gray-400 text-xs">
                    Cognition × Resilience
                  </div>
                  <div className="text-gray-500 text-xs mt-1">
                    {stats.cognition} × {stats.resilience} = {stats.cognition * stats.resilience}
                  </div>
                </div>

                {/* Stamina */}
                <div className="p-3 bg-charcoal-75 rounded">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-bold text-sm">Max Stamina</span>
                    <span className="pill-cloud-gray font-bold">{completeStats.max_stamina}</span>
                  </div>
                  <div className="text-gray-400 text-xs">
                    Power × Resilience
                  </div>
                  <div className="text-gray-500 text-xs mt-1">
                    {stats.power} × {stats.resilience} = {stats.power * stats.resilience}
                  </div>
                </div>

                {/* Charge */}
                <div className="p-3 bg-charcoal-75 rounded">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-bold text-sm">Max Charge</span>
                    <span className="pill-cloud-gray font-bold">{completeStats.max_charge}</span>
                  </div>
                  <div className="text-gray-400 text-xs">
                    Clock Speed + Cell Capacity
                  </div>
                  <div className="text-gray-500 text-xs mt-1">
                    {completeStats.clock_speed} + {completeStats.total_cell_capacity} = {completeStats.clock_speed + completeStats.total_cell_capacity}
                  </div>
                </div>

                {/* Thermal */}
                <div className="p-3 bg-charcoal-75 rounded">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-bold text-sm">Max Thermal Load</span>
                    <span className="pill-cloud-gray font-bold">{completeStats.max_thermal}</span>
                  </div>
                  <div className="text-gray-400 text-xs">
                    Clock Speed + Cooling
                  </div>
                  <div className="text-gray-500 text-xs mt-1">
                    {completeStats.clock_speed} + {completeStats.cooling} = {completeStats.clock_speed + completeStats.cooling}
                  </div>
                </div>

                {/* Neural */}
                <div className="p-3 bg-charcoal-75 rounded">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-bold text-sm">Max Neural Load</span>
                    <span className="pill-cloud-gray font-bold">{completeStats.max_neural}</span>
                  </div>
                  <div className="text-gray-400 text-xs">
                    Cognition + Resilience + Max Bandwidth
                  </div>
                  <div className="text-gray-500 text-xs mt-1">
                    {stats.cognition} + {stats.resilience} + {completeStats.max_bandwidth} = {stats.cognition + stats.resilience + completeStats.max_bandwidth}
                  </div>
                </div>

                {/* Bandwidth */}
                <div className="p-3 bg-charcoal-75 rounded">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-bold text-sm">Max Bandwidth</span>
                    <span className="pill-cloud-gray font-bold">{completeStats.max_bandwidth}</span>
                  </div>
                  <div className="text-gray-400 text-xs">
                    ((Processor + Memory) × ((Clock + Cache) / Latency)) / Li-Fi
                  </div>
                  <div className="text-gray-500 text-xs mt-1">
                    (({completeStats.total_processor} + {completeStats.total_memory}) × (({completeStats.clock_speed} + {completeStats.cache}) / {completeStats.latency || 1})) / {completeStats.total_lifi || 1}
                  </div>
                  <div className="text-gray-600 text-xs mt-1">
                    = {Math.floor(((completeStats.total_processor + completeStats.total_memory) * ((completeStats.clock_speed + completeStats.cache) / (completeStats.latency || 1))) / (completeStats.total_lifi || 1))}
                  </div>
                </div>
              </div>
            )}
          </CxCard>

        </div>

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-charcoal border border-fuschia rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-bold text-white uppercase mb-4">Confirm Allocation</h2>
              <p className="text-gray-300 mb-4">
                You are about to allocate {totalAllocated} stat point{totalAllocated !== 1 ? 's' : ''}:
              </p>
              <ul className="text-gray-400 text-sm mb-6 space-y-1">
                {Object.entries(allocations)
                  .filter(([_, points]) => points > 0)
                  .map(([stat, points]) => (
                    <li key={stat}>
                      • {statLabels[stat as keyof typeof statLabels].name}: +{points}
                    </li>
                  ))}
              </ul>
              <p className="text-gray-400 text-sm mb-6">
                This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button 
                  className="btn-cx btn-cx-secondary flex-1"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={saving}
                >
                  CANCEL
                </button>
                <button 
                  className="btn-cx btn-cx-primary flex-1"
                  onClick={handleConfirm}
                  disabled={saving}
                >
                  {saving ? 'SAVING...' : 'CONFIRM'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
