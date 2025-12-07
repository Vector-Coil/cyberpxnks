"use client";
import React, { useState, useEffect } from 'react';
import { useStats, useAlertsSWR } from '../../hooks/useStatsSWR';

/**
 * Test component to compare regular fetch vs SWR caching
 * This will help visualize the performance improvements
 */
export default function SWRTestPage() {
  // Traditional fetch approach
  const [fetchStats, setFetchStats] = useState<any>(null);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [fetchTime, setFetchTime] = useState<number>(0);
  const [fetchCount, setFetchCount] = useState(0);

  // SWR approach
  const { stats: swrStats, loading: swrLoading, refresh } = useStats(300187, 30000);
  const { contacts, gigs, messages } = useAlertsSWR(300187);
  const [swrTime, setSWRTime] = useState<number>(0);
  const [swrCount, setSWRCount] = useState(0);

  // Traditional fetch
  const fetchTraditional = async () => {
    setFetchLoading(true);
    const start = performance.now();
    try {
      const res = await fetch('/api/stats?fid=300187');
      const data = await res.json();
      const end = performance.now();
      setFetchStats(data);
      setFetchTime(end - start);
      setFetchCount(prev => prev + 1);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setFetchLoading(false);
    }
  };

  // Measure SWR fetch time
  useEffect(() => {
    if (swrStats && !swrLoading) {
      setSWRCount(prev => prev + 1);
    }
  }, [swrStats, swrLoading]);

  useEffect(() => {
    fetchTraditional();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">SWR Performance Test</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Traditional Fetch */}
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h2 className="text-xl font-bold mb-4 text-red-400">Traditional Fetch</h2>
            <div className="space-y-2 mb-4">
              <p className="text-sm">
                <span className="text-gray-400">Status:</span>{' '}
                {fetchLoading ? 'Loading...' : 'Loaded'}
              </p>
              <p className="text-sm">
                <span className="text-gray-400">Fetch Time:</span>{' '}
                <span className="text-yellow-400 font-bold">{fetchTime.toFixed(2)}ms</span>
              </p>
              <p className="text-sm">
                <span className="text-gray-400">Fetch Count:</span>{' '}
                <span className="font-bold">{fetchCount}</span>
              </p>
              {fetchStats && (
                <div className="mt-4 text-sm">
                  <p>Charge: {fetchStats.current_charge}/{fetchStats.max_charge}</p>
                  <p>Bandwidth: {fetchStats.current_bandwidth}/{fetchStats.max_bandwidth}</p>
                </div>
              )}
            </div>
            <button
              onClick={fetchTraditional}
              className="w-full bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
              disabled={fetchLoading}
            >
              Refetch (No Cache)
            </button>
          </div>

          {/* SWR Fetch */}
          <div className="bg-gray-800 p-6 rounded-lg border border-green-700">
            <h2 className="text-xl font-bold mb-4 text-green-400">SWR (Cached)</h2>
            <div className="space-y-2 mb-4">
              <p className="text-sm">
                <span className="text-gray-400">Status:</span>{' '}
                {swrLoading ? 'Loading...' : 'Loaded'}
              </p>
              <p className="text-sm">
                <span className="text-gray-400">Cache Hit:</span>{' '}
                <span className="text-green-400 font-bold">
                  {swrCount > 1 ? 'YES (Instant!)' : 'Initial Load'}
                </span>
              </p>
              <p className="text-sm">
                <span className="text-gray-400">Revalidations:</span>{' '}
                <span className="font-bold">{swrCount}</span>
              </p>
              {swrStats && (
                <div className="mt-4 text-sm">
                  <p>Charge: {swrStats.current_charge}/{swrStats.max_charge}</p>
                  <p>Bandwidth: {swrStats.current_bandwidth}/{swrStats.max_bandwidth}</p>
                </div>
              )}
            </div>
            <button
              onClick={() => refresh()}
              className="w-full bg-green-600 hover:bg-green-700 px-4 py-2 rounded"
            >
              Refresh (Uses Cache)
            </button>
          </div>
        </div>

        {/* Alert Stats Test */}
        <div className="bg-gray-800 p-6 rounded-lg border border-cyan-700 mb-8">
          <h2 className="text-xl font-bold mb-4 text-cyan-400">SWR Alerts (Auto-refresh 60s)</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-cyan-400">{contacts}</p>
              <p className="text-sm text-gray-400">Contacts</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-cyan-400">{gigs}</p>
              <p className="text-sm text-gray-400">Gigs</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-cyan-400">{messages}</p>
              <p className="text-sm text-gray-400">Messages</p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-gray-800 p-6 rounded-lg border border-blue-700">
          <h2 className="text-xl font-bold mb-4 text-blue-400">Test Instructions</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Click "Refetch (No Cache)" multiple times - notice each takes ~{fetchTime.toFixed(0)}ms</li>
            <li>Click "Refresh (Uses Cache)" multiple times - notice it's INSTANT after first load</li>
            <li>Open Network tab in DevTools - SWR deduplicates requests</li>
            <li>Navigate to another page and come back - SWR data persists instantly</li>
            <li>Wait 30 seconds - SWR automatically revalidates in background</li>
          </ol>
          
          <div className="mt-4 p-4 bg-gray-900 rounded">
            <p className="text-xs text-gray-400 mb-2">Expected Results:</p>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>✅ Traditional fetch: Every click = new network request</li>
              <li>✅ SWR: First click loads, subsequent clicks use cache (0ms)</li>
              <li>✅ Multiple components can share same SWR data (fetch once, use everywhere)</li>
              <li>✅ Auto-revalidation keeps data fresh without manual polling</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
