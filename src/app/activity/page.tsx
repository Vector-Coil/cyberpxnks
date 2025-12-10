'use client';

import React, { useState, useEffect } from 'react';
import { CxCard, NavStrip } from '../../components/CxShared';
import { useNavData } from '../../hooks/useNavData';
import { useAuthenticatedUser } from '../../hooks/useAuthenticatedUser';
import type { NavData } from '../../types/common';

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

export default function ActivityLogPage() {
  const { userFid, isLoading: isAuthLoading } = useAuthenticatedUser();
  const navData = useNavData(userFid || 0);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    checkAdminStatus();
  }, [userFid, isAuthLoading]);

  useEffect(() => {
    if (isAdmin) {
      setActivities([]);
      setOffset(0);
      setHasMore(true);
      loadActivities(true);
    }
  }, [selectedCategory, isAdmin]);

  const checkAdminStatus = async () => {
    if (!userFid || isAuthLoading) return;
    
    try {
      // Check if user is admin
      const userRes = await fetch(`/api/user?fid=${userFid}`);
      if (userRes.ok) {
        const userData = await userRes.json();
        if (userData.admin) {
          setIsAdmin(true);
        } else {
          setError('Access Denied: Admin privileges required');
        }
      } else {
        setError('Failed to verify user status');
      }
    } catch (err) {
      console.error('Failed to check admin status:', err);
      setError('Failed to verify admin status');
    }
  };

  const loadActivities = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      
      const currentOffset = reset ? 0 : offset;
      const url = selectedCategory
        ? `/api/activity?fid=${userFid}&admin=true&category=${selectedCategory}&limit=25&offset=${currentOffset}`
        : `/api/activity?fid=${userFid}&admin=true&limit=25&offset=${currentOffset}`;
      
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
    return date.toLocaleString();
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      action: 'bg-blue-500/20 text-blue-400 border-blue-500',
      discovery: 'bg-green-500/20 text-green-400 border-green-500',
      encounter: 'bg-red-500/20 text-red-400 border-red-500',
      status: 'bg-yellow-500/20 text-yellow-400 border-yellow-500',
      social: 'bg-purple-500/20 text-purple-400 border-purple-500',
      progression: 'bg-cyan-500/20 text-cyan-400 border-cyan-500',
      economy: 'bg-amber-500/20 text-amber-400 border-amber-500',
      gear: 'bg-orange-500/20 text-orange-400 border-orange-500',
      system: 'bg-gray-500/20 text-gray-400 border-gray-500'
    };
    return colors[category] || 'bg-gray-500/20 text-gray-400 border-gray-500';
  };

  const categories = ['action', 'discovery', 'encounter', 'status', 'social', 'progression', 'economy', 'gear', 'system'];

  return (
    <div className="frame-container frame-main">
      <div className="frame-body pt-6 pb-2 px-6">
        <NavStrip 
          username={navData.username}
          userProfileImage={navData.profileImage}
          cxBalance={navData.cxBalance}
        />
      </div>

      <div className="pt-5 pb-2 px-6 flex flex-row gap-1 items-center">
        <a href="/dashboard" className="w-[25px] h-[25px] rounded-full overflow-hidden bg-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-600 transition-colors">
          <span className="material-symbols-outlined text-white text-xl">chevron_left</span>
        </a>
        <div className="masthead">ACTIVITY</div>
      </div>

      <div className="frame-body">
        {error ? (
          <CxCard className="mb-4">
            <div className="text-center py-12">
              <div className="text-red-400 text-xl font-bold mb-2">{error}</div>
              <div className="text-gray-400 mb-4">You do not have permission to view this page.</div>
              <a href="/dashboard" className="btn-cx btn-cx-secondary">
                RETURN TO DASHBOARD
              </a>
            </div>
          </CxCard>
        ) : !isAdmin ? (
          <CxCard className="mb-4">
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-12 h-12 border-4 border-gray-600 border-t-fuschia rounded-full"></div>
            </div>
          </CxCard>
        ) : (
        <CxCard className="mb-4">
          <div className="font-bold uppercase mb-4" style={{ color: 'var(--fuschia)' }}>
            All User Activity
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              className={`px-3 py-1 rounded text-xs font-bold uppercase transition-colors ${
                selectedCategory === null 
                  ? 'bg-fuschia text-white' 
                  : 'bg-charcoal-75 text-gray-400 hover:bg-charcoal'
              }`}
              onClick={() => setSelectedCategory(null)}
            >
              ALL
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                className={`px-3 py-1 rounded text-xs font-bold uppercase transition-colors ${
                  selectedCategory === cat 
                    ? 'bg-fuschia text-white' 
                    : 'bg-charcoal-75 text-gray-400 hover:bg-charcoal'
                }`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-12 h-12 border-4 border-gray-600 border-t-fuschia rounded-full"></div>
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              No activity found.
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto" onScroll={handleScroll}>
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="p-4 bg-charcoal-75 rounded border border-charcoal hover:border-gray-600 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold uppercase border ${getCategoryColor(activity.category)}`}>
                        {activity.category}
                      </span>
                      <a 
                        href={`/profile/${activity.username}`}
                        className="font-bold text-white text-sm hover:text-fuschia transition-colors"
                      >
                        {activity.username}
                      </a>
                    </div>
                    <span className="text-gray-500 text-xs">{formatTimestamp(activity.timestamp)}</span>
                  </div>
                  
                  <div className="ml-0 mt-2">
                    <div className="text-gray-400 text-sm mb-1">
                      <span className="font-mono">{activity.type.replace(/_/g, ' ')}</span>
                    </div>
                    {activity.description && (
                      <div className="text-sm text-gray-300 mb-2">{activity.description}</div>
                    )}
                    <div className="flex gap-4 text-xs text-gray-500">
                      <span>User ID: {activity.user_id}</span>
                      <span>Log ID: {activity.id}</span>
                    </div>
                  </div>
                </div>
              ))}
              {loadingMore && (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin w-8 h-8 border-4 border-gray-600 border-t-fuschia rounded-full"></div>
                </div>
              )}
            </div>
          )}
        </CxCard>
        )}
      </div>
    </div>
  );
}
