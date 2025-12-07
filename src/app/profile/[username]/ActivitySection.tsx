'use client';

import React, { useState, useEffect } from 'react';
import { CxCard } from '../../../components/CxShared';

interface Activity {
  id: number;
  user_id: number;
  timestamp: string;
  category: string;
  type: string;
  value: number | null;
  target_id: number | null;
  description: string | null;
  username: string;
  pfp_url: string;
}

export default function ActivitySection({ fid }: { fid: number }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    setActivities([]);
    setOffset(0);
    setHasMore(true);
    loadActivities(true);
  }, [fid, selectedCategory]);

  const loadActivities = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      
      const currentOffset = reset ? 0 : offset;
      const url = selectedCategory
        ? `/api/activity?fid=${fid}&category=${selectedCategory}&limit=25&offset=${currentOffset}`
        : `/api/activity?fid=${fid}&limit=25&offset=${currentOffset}`;
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const newActivities = data.activities || [];
        
        if (reset) {
          setActivities(newActivities);
        } else {
          setActivities(prev => [...prev, ...newActivities]);
        }
        
        setOffset(currentOffset + newActivities.length);
        setHasMore(newActivities.length === 25);
      }
    } catch (err) {
      console.error('Failed to load activities:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const bottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
    
    if (bottom && hasMore && !loadingMore && !loading) {
      loadActivities(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      action: 'text-blue-400',
      discovery: 'text-green-400',
      encounter: 'text-red-400',
      status: 'text-yellow-400',
      social: 'text-purple-400',
      progression: 'text-cyan-400',
      economy: 'text-amber-400',
      gear: 'text-orange-400',
      system: 'text-gray-400'
    };
    return colors[category] || 'text-gray-400';
  };

  const categories = ['action', 'discovery', 'encounter', 'status', 'progression', 'economy', 'gear'];

  return (
    <CxCard>
      <div className="font-bold uppercase mb-4" style={{ color: 'var(--fuschia)' }}>
        Recent Activity
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          className={`pill-${selectedCategory === null ? 'stat' : 'charcoal'} text-xs`}
          onClick={() => setSelectedCategory(null)}
        >
          ALL
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            className={`pill-${selectedCategory === cat ? 'stat' : 'charcoal'} text-xs`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat.toUpperCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-8 h-8 border-4 border-gray-600 border-t-fuschia rounded-full"></div>
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center text-gray-400 py-8">
          No activity yet.
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto" onScroll={handleScroll}>
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="p-3 bg-charcoal-75 rounded border border-charcoal hover:border-gray-600 transition-colors"
            >
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`font-bold text-xs uppercase ${getCategoryColor(activity.category)}`}>
                    {activity.category}
                  </span>
                  <span className="text-gray-500 text-xs">•</span>
                  <span className="text-gray-400 text-xs">{activity.type.replace(/_/g, ' ')}</span>
                </div>
                <span className="text-gray-500 text-xs">{formatTimestamp(activity.timestamp)}</span>
              </div>
              {activity.description && (
                <div className="text-sm text-gray-300 mt-1">{activity.description}</div>
              )}
            </div>
          ))}
          {loadingMore && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin w-6 h-6 border-2 border-gray-600 border-t-fuschia rounded-full"></div>
            </div>
          )}
        </div>
      )}
    </CxCard>
  );
}
