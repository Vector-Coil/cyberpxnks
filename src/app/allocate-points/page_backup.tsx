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
}

export default function AllocatePointsPage() {
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
      // Fetch complete stats from stats API
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
        const data = await res.json();
        // Success - navigate back to dashboard
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
    cognition: { name: 'Cognition', desc: 'Mental processing and analysis' },
    insight: { name: 'Insight', desc: 'Perception and awareness' },
    interface: { name: 'Interface', desc: 'Technical interaction ability' },
    power: { name: 'Power', desc: 'Raw strength and force' },
    resilience: { name: 'Resilience', desc: 'Durability and endurance' },
    agility: { name: 'Agility', desc: 'Speed and reflexes' }
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

  if (!stats) {
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
  const pointsRemaining = (stats?.unallocated_points || 0) - totalAllocated;
  const hasPoints = (stats?.unallocated_points || 0) > 0;
  const hasChanges = totalAllocated > 0;

  // Helper function to render collapsible section header
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

  // Helper function to render stat pills in table format
  const renderStatRow = (label: string, base: number, mod: number, total: number, description?: string) => (
    <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 items-center py-2 border-b border-gray-700">
      <div>
        <div className="text-white font-semibold text-sm">{label}</div>
        {description && <div className="text-gray-500 text-xs">{description}</div>}
      </div>
      <div className="text-center">
        <span className="pill-charcoal text-xs">{base}</span>
      </div>
      <div className="text-center">
        {mod > 0 ? (
          <span className="pill-stat text-xs text-bright-green">+{mod}</span>
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
        <FrameHeader />
      
      <div className="frame-body p-6">
        <h1 className="text-2xl font-bold text-white uppercase mb-6">Allocate Stat Points</h1>

        {error && (
          <div className="bg-red-900/30 border border-red-500 text-red-400 p-4 rounded mb-4">
            {error}
          </div>
        )}

        {!hasPoints && (
          <CxCard className="mb-6">
            <div className="text-center text-gray-400">
              <p className="mb-2">You have no stat points to allocate.</p>
              <p className="text-sm">Gain more points by leveling up.</p>
            </div>
          </CxCard>
        )}

        {hasPoints && (
          <>
            <CxCard className="mb-6">
              <div className="text-center">
                <span className="text-white font-bold text-2xl">{pointsRemaining}</span>
                <span className="text-gray-400 ml-2">points remaining</span>
              </div>
            </CxCard>

            <div className="space-y-3 mb-6">
              {Object.entries(statLabels).map(([key, { name, desc }]) => {
                const currentValue = stats[key as keyof typeof stats] as number;
                const newValue = currentValue + allocations[key];
                const hasAllocation = allocations[key] > 0;

                return (
                  <CxCard key={key}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-white font-bold uppercase text-sm">{name}</div>
                        <div className="text-gray-500 text-xs">{desc}</div>
                        <div className="text-gray-400 text-sm mt-1">
                          Current: {currentValue}
                          {hasAllocation && (
                            <span className="text-fuschia ml-2">
                              → {newValue}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          className="w-8 h-8 bg-gray-700 text-white rounded flex items-center justify-center hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          onClick={() => decrement(key)}
                          disabled={allocations[key] === 0 || !hasPoints}
                        >
                          <span className="material-symbols-outlined text-lg">remove</span>
                        </button>
                        <span className="text-white font-bold text-lg w-8 text-center">
                          +{allocations[key]}
                        </span>
                        <button
                          className="w-8 h-8 bg-fuschia text-white rounded flex items-center justify-center hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
                          onClick={() => increment(key)}
                          disabled={pointsRemaining === 0 || !hasPoints}
                        >
                          <span className="material-symbols-outlined text-lg">add</span>
                        </button>
                      </div>
                    </div>
                  </CxCard>
                );
              })}
            </div>
          </>
        )}

        <div className="flex gap-3">
          <button 
            className="btn-cx btn-cx-secondary flex-1"
            onClick={() => router.push('/dashboard')}
          >
            {hasChanges ? 'CANCEL' : 'BACK'}
          </button>
          {hasPoints && (
            <button 
              className="btn-cx btn-cx-primary flex-1"
              onClick={handleSave}
              disabled={!hasChanges}
            >
              {hasChanges ? 'SAVE' : 'NO CHANGES'}
            </button>
          )}
        </div>
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
