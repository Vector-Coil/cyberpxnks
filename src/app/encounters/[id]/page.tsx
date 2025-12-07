'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FrameHeader, CxCard } from '../../../components/CxShared';

interface EncounterAction {
  id: number;
  name: string;
  sentiment: string;
  sentimentColor: string;
  successRate: number;
  requirementText: string;
  creditCost: number;
  statCost: number;
  costStat: string | null;
  successRewards: {
    rep: number;
    streetCred: number;
    xp: number;
    credits: number;
  };
  failureConsequences: {
    rep: number;
    streetCred: number;
    xp: number;
    credits: number;
  };
  successDesc: string;
  failureDesc: string;
  meetsRequirements: boolean;
  canAfford: boolean;
}

interface EncounterDetails {
  id: number;
  name: string;
  imageUrl: string | null;
  type: string;
  sentiment: string;
  sentimentColor: string;
  dialogue: string;
  zoneId: number;
}

export default function EncounterPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [encounter, setEncounter] = useState<EncounterDetails | null>(null);
  const [actions, setActions] = useState<EncounterAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEncounter();
  }, []);

  const fetchEncounter = async () => {
    try {
      const res = await fetch(`/api/encounters/${params.id}?fid=300187`);
      if (res.ok) {
        const data = await res.json();
        setEncounter(data.encounter);
        setActions(data.actions);
      } else {
        setError('Failed to load encounter');
      }
    } catch (err) {
      console.error('Error fetching encounter:', err);
      setError('Failed to load encounter');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (actionId: number) => {
    setProcessing(true);
    setError(null);

    try {
      const res = await fetch(`/api/encounters/${params.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid: 300187, actionId })
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data);
      } else {
        const errorData = await res.json();
        setError(errorData.error || 'Action failed');
      }
    } catch (err) {
      console.error('Error executing action:', err);
      setError('Network error');
    } finally {
      setProcessing(false);
    }
  };

  const handleFlee = async () => {
    setProcessing(true);

    try {
      const res = await fetch(`/api/encounters/${params.id}/flee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid: 300187 })
      });

      if (res.ok) {
        const data = await res.json();
        // Redirect back to zone after fleeing
        router.push(encounter?.zoneId ? `/city/${encounter.zoneId}` : '/dashboard');
      } else {
        setError('Failed to flee');
      }
    } catch (err) {
      console.error('Error fleeing:', err);
      setError('Network error');
    } finally {
      setProcessing(false);
    }
  };

  const handleDismissResult = () => {
    // Return to zone after completing encounter
    router.push(encounter?.zoneId ? `/city/${encounter.zoneId}` : '/dashboard');
  };

  if (loading) {
    return (
      <div className="frame-container frame-main">
        <FrameHeader />
        <div className="frame-body flex items-center justify-center">
          <div className="animate-spin w-16 h-16 border-4 border-gray-600 border-t-fuschia rounded-full"></div>
        </div>
      </div>
    );
  }

  if (!encounter) {
    return (
      <div className="frame-container frame-main">
        <FrameHeader />
        <div className="frame-body p-6">
          <div className="text-red-400">{error || 'Encounter not found'}</div>
        </div>
      </div>
    );
  }

  // Show results screen
  if (result) {
    return (
      <div className="frame-container frame-main">
        <FrameHeader />
        <div className="frame-body p-6">
          <div className="masthead mb-6 flex items-center justify-between">
            <span>ENCOUNTER RESULT</span>
            <span 
              className="text-2xl font-bold italic"
              style={{ color: result.success ? '#4a9eff' : '#f81216' }}
            >
              {result.success ? 'SUCCESS' : 'FAILURE'}
            </span>
          </div>

          <CxCard className="mb-6">
            <div className="space-y-4">
              <div>
                <div className="text-sm text-gray-400">Encounter</div>
                <div className="text-white font-bold">{result.encounter.name}</div>
              </div>
              
              <div>
                <div className="text-sm text-gray-400">Action</div>
                <div className="text-white font-bold">{result.action.name}</div>
              </div>

              <div>
                <div className="text-sm text-gray-400 mb-2">Success Rate</div>
                <div className="text-white">{result.successRate}% (Rolled: {result.roll})</div>
              </div>

              <div className="border-t border-gray-700 pt-4">
                <div className="text-sm text-gray-400 mb-2">Description</div>
                <div className="text-white italic">{result.results.description}</div>
              </div>

              <div className="border-t border-gray-700 pt-4">
                <div className="text-sm text-gray-400 mb-2">Rewards & Consequences</div>
                <div className="space-y-1">
                  {result.results.xp > 0 && (
                    <div className="text-bright-blue">+{result.results.xp} XP</div>
                  )}
                  {result.results.streetCred !== 0 && (
                    <div style={{ color: result.results.streetCred > 0 ? '#4a9eff' : '#f81216' }}>
                      {result.results.streetCred > 0 ? '+' : ''}{result.results.streetCred} Street Cred
                    </div>
                  )}
                  {result.results.reputation !== 0 && (
                    <div style={{ color: result.results.reputation > 0 ? '#4a9eff' : '#f81216' }}>
                      {result.results.reputation > 0 ? '+' : ''}{result.results.reputation} Reputation
                    </div>
                  )}
                  {result.results.credits !== 0 && (
                    <div style={{ color: result.results.credits > 0 ? '#4a9eff' : '#f81216' }}>
                      {result.results.credits > 0 ? '+' : ''}{result.results.credits} $CX
                    </div>
                  )}
                </div>
              </div>

              {Object.keys(result.resourceCosts || {}).length > 0 && (
                <div className="border-t border-gray-700 pt-4">
                  <div className="text-sm text-gray-400 mb-2">Resource Costs</div>
                  <div className="space-y-1">
                    {Object.entries(result.resourceCosts).map(([stat, value]: [string, any]) => (
                      <div key={stat} className="text-red-400">
                        {value > 0 ? '+' : ''}{value} {stat}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CxCard>

          <button 
            className="btn-cx btn-cx-primary w-full"
            onClick={handleDismissResult}
          >
            DISMISS
          </button>
        </div>
      </div>
    );
  }

  // Show encounter screen
  return (
    <div className="frame-container frame-main">
      <FrameHeader />
      <div className="frame-body p-6">
        
        <div className="masthead mb-6 flex items-center justify-between">
          <span>ENCOUNTER</span>
          <span 
            className="text-2xl font-bold italic uppercase"
            style={{ color: encounter.sentimentColor }}
          >
            {encounter.sentiment}
          </span>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-500 text-red-400 p-4 rounded mb-4">
            {error}
          </div>
        )}

        <CxCard className="mb-6">
          <div className="flex gap-4">
            {encounter.imageUrl && (
              <div className="w-24 h-24 flex-shrink-0">
                <img 
                  src={encounter.imageUrl} 
                  alt={encounter.name}
                  className="w-full h-full object-cover rounded"
                />
              </div>
            )}
            <div className="flex-1">
              <div className="text-xl font-bold text-white mb-2">{encounter.name}</div>
              <div className="pill-charcoal inline-block mb-3">{encounter.type}</div>
              <div className="text-gray-300 italic">"{encounter.dialogue}"</div>
            </div>
          </div>
        </CxCard>

        <div className="masthead mb-4">ACTIONS</div>

        <div className="space-y-3 mb-6">
          {actions.map((action) => (
            <CxCard key={action.id} className={!action.meetsRequirements || !action.canAfford ? 'opacity-50' : ''}>
              <div className="space-y-3">
                {/* Row 1: Action info and button */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-baseline gap-3 mb-1">
                      <span className="text-white font-bold text-lg">{action.name}</span>
                      <span 
                        className="text-sm font-bold italic uppercase"
                        style={{ color: action.sentimentColor }}
                      >
                        {action.sentiment}
                      </span>
                    </div>
                    <div className="text-bright-blue text-sm">{action.successRate}% chance</div>
                  </div>
                  <button 
                    className="btn-cx btn-cx-primary"
                    onClick={() => handleAction(action.id)}
                    disabled={processing || !action.meetsRequirements || !action.canAfford}
                  >
                    {action.requirementText || 'EXECUTE'}
                  </button>
                </div>

                {/* Row 2: Outcomes */}
                <div className="space-y-1 text-sm">
                  <div>
                    <span className="text-white font-bold">On success: </span>
                    <span className="text-bright-blue">+{action.successRewards.xp} XP</span>
                    {action.successRewards.streetCred !== 0 && (
                      <span className="text-bright-blue">, +{action.successRewards.streetCred} Street Cred</span>
                    )}
                  </div>
                  <div>
                    <span className="text-white font-bold">On fail: </span>
                    <span className="text-red-400">-{Math.abs(action.failureConsequences.streetCred)} Street Cred</span>
                    {action.creditCost > 0 && (
                      <span className="text-red-400">, -{action.creditCost} $CX</span>
                    )}
                  </div>
                </div>
              </div>
            </CxCard>
          ))}
        </div>

        <button 
          className="btn-cx btn-cx-secondary w-full"
          onClick={handleFlee}
          disabled={processing}
        >
          {processing ? 'PROCESSING...' : 'RUN AWAY (DISMISS)'}
        </button>
      </div>
    </div>
  );
}
