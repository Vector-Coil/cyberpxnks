import React from 'react';
import { redirect } from 'next/navigation';
import { FrameHeader, CxCard } from '../../../components/CxShared';
import { getDbPool } from '../../../lib/db';
import { getNavStripData } from '../../../lib/navUtils';
import ActivitySection from './ActivitySection';
import ProfileLayout from './ProfileLayout';

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const p = await params;
  const username = p.username;

  try {
    const pool = await getDbPool();

    // Fetch NavStrip data for test user
    const navData = await getNavStripData(300187);

    // Fetch user by username with all required fields
    const [userRows] = await pool.execute<any[]>(
      `SELECT 
        u.fid, u.username, u.subversive_id, u.rednet_id, u.bio, 
        u.street_cred, u.credits, u.level, u.xp, u.unallocated_points, u.location,
        u.cognition, u.insight, u.interface, u.power, u.resilience, u.agility,
        u.initialized_at, u.last_action_at, u.class_id, u.alignment_id, u.pfp_url,
        c.name as class_name,
        a.name as alignment_name
      FROM users u
      LEFT JOIN classes c ON u.class_id = c.id
      LEFT JOIN alignments a ON u.alignment_id = a.id
      WHERE u.username = ? 
      LIMIT 1`,
      [username]
    );
    const user = (userRows as any[])[0];

    if (!user) {
      return (
        <div className="frame-container frame-main">
          <FrameHeader />
          <div className="frame-body">
            <div className="p-6 text-red-400">User not found.</div>
          </div>
        </div>
      );
    }

    // Fetch XP required for next level
    const nextLevel = (user.level || 1) + 1;
    const [levelRows] = await pool.execute<any[]>(
      'SELECT xp_required FROM level_thresholds WHERE level = ? LIMIT 1',
      [nextLevel]
    );
    const levelData = (levelRows as any[])[0];
    const xpToNextLevel = levelData?.xp_required || 1000;

    // Calculate XP percentage
    const currentXp = user.xp || 0;
    const xpPercentage = Math.min((currentXp / xpToNextLevel) * 100, 100);

    // Stats come directly from user table
    const cognition = user.cognition || 0;
    const interfaceStat = user.interface || 0;
    const resilience = user.resilience || 0;
    const insight = user.insight || 0;
    const power = user.power || 0;
    const agility = user.agility || 0;

    return (
      <ProfileLayout
        username={navData.username}
        profileImage={navData.profileImage}
        cxBalance={navData.cxBalance}
      >
        <div className="pt-5 pb-2 px-6 flex flex-row gap-3">
          <a href="/dashboard" className="w-[25px] h-[25px] rounded-full overflow-hidden bg-bright-blue flex items-center justify-center cursor-pointer hover:bg-gray-600 transition-colors">
            <span className="material-symbols-outlined text-white text-xl">chevron_left</span>
          </a>
          <div className="masthead">PROFILE</div>
        </div>
        <div className="frame-body pt-0">

          {/* Profile Image */}
          <div className="flex flex-col items-center justify-center mb-6 gap-1">
              <div className="w-[100px] h-[100px] rounded-full overflow-hidden bg-gray-700 flex items-center justify-center">
                {user.pfp_url ? (
                  <img src={user.pfp_url} alt={user.username} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-4xl font-bold text-gray-400">{user.username?.charAt(0).toUpperCase()}</div>
                )}
              </div>
              <div className="meta-heading text-center">{user.username}</div>
          </div>

          {/* Level Card */}
          <CxCard className="mb-4">
            <div className="flex items-center justify-between">
              <div className="font-bold uppercase" style={{ color: 'var(--fuschia)' }}>Level</div>
              <div className="flex gap-2">
                <span className="pill-stat">
                  {user.level || 1}
                </span>
                <span className="pill-charcoal">RANK</span>
              </div>
            </div>
          </CxCard>

          {/* Experience Card */}
          <CxCard className="mb-4">
            <div className="flex items-center justify-between gap-4">
              <div className="font-bold uppercase" style={{ color: 'var(--fuschia)' }}>Experience</div>
              <div className="relative flex-1 h-8 bg-charcoal-75 rounded-full overflow-hidden">
                <div
                  className="absolute top-0 left-0 h-full transition-all duration-300"
                  style={{ width: `${xpPercentage}%`, background: 'var(--fuschia)' }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-white text-sm font-bold">
                  {currentXp} / {xpToNextLevel}
                </div>
              </div>
            </div>
          </CxCard>

          {/* Alignment Card */}
          <CxCard className="mb-4">
            <div className="flex items-center justify-between">
              <div className="font-bold uppercase" style={{ color: 'var(--fuschia)' }}>Alignment</div>
              <span className="pill-charcoal">{user.alignment_name?.toUpperCase() || 'UNALIGNED'}</span>
            </div>
          </CxCard>

          {/* Class and Vocation - Side by Side */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <CxCard className="aspect-square flex items-center justify-center">
              <div className="text-center">
                <div className="font-bold uppercase mb-2" style={{ color: 'var(--fuschia)' }}>Class</div>
                <div className="text-gray-300 uppercase">{user.class_name?.toUpperCase() || 'UNDEFINED'}</div>
              </div>
            </CxCard>
            <CxCard className="aspect-square flex items-center justify-center">
              <div className="text-center">
                <div className="font-bold uppercase mb-2" style={{ color: 'var(--fuschia)' }}>Vocation</div>
                <div className="text-gray-300 uppercase">UNDEFINED</div>
              </div>
            </CxCard>
          </div>

          {/* Stats Table */}
          <CxCard>
            <div className="flex items-center justify-between mb-4">
              <div className="font-bold uppercase" style={{ color: 'var(--fuschia)' }}>Stats</div>
              {(user.unallocated_points || 0) > 0 && (
                <a 
                  href="/allocate-points" 
                  className="text-xs text-bright-blue hover:text-fuschia transition-colors underline"
                >
                  Unallocated points to spend
                </a>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">

              {/* Left Column */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-white uppercase font-bold text-sm">Cognition</span>
                  <span className="pill-stat">{cognition}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white uppercase font-bold text-sm">Interface</span>
                  <span className="pill-stat">{interfaceStat}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white uppercase font-bold text-sm">Resilience</span>
                  <span className="pill-stat">{resilience}</span>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-white uppercase font-bold text-sm">Insight</span>
                  <span className="pill-stat">{insight}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white uppercase font-bold text-sm">Power</span>
                  <span className="pill-stat">{power}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white uppercase font-bold text-sm">Agility</span>
                  <span className="pill-stat">{agility}</span>
                </div>
              </div>
            </div>
          </CxCard>

          {/* Activity Section */}
          <div className="mt-4">
            <ActivitySection fid={user.fid} />
          </div>

        </div>
      </ProfileLayout>
    );
  } catch (err: any) {
    console.error('Profile page error', err?.stack || err);
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    return (
      <div className="frame-container frame-main flex items-center justify-center min-h-screen">
        <div className="p-6 bg-gray-900 rounded shadow-lg max-w-2xl">
          <div className="text-lg font-bold text-red-400 mb-2">Failed to load profile</div>
          <div className="text-sm text-gray-300 mb-2">{message}</div>
        </div>
      </div>
    );
  }
}
