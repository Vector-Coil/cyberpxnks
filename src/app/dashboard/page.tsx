"use client";
import React, { useState, useEffect} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { sdk } from '@farcaster/miniapp-sdk';
import { useNeynarContext } from '@neynar/react';
import { useDailyFarcasterSync } from '../../hooks/useDailyFarcasterSync';
import { NavStrip } from '../../components/CxShared';
import { useNavData } from '../../hooks/useNavData';
import { useRegenTimer } from '../../hooks/useRegenTimer';

// 1. Define the Expected Data Structure from the Database Query
interface UserStatsData {
    user_id?: number;
    max_consciousness: number;
    current_consciousness: number;
    max_stamina: number;
    current_stamina: number;
    max_charge: number;
    current_charge: number;
    max_bandwidth: number;
    current_bandwidth: number;
    max_thermal: number;
    current_thermal: number;
    max_neural?: number;
    current_neural?: number;
    // Tech stats (total from user_stats + hardware modifiers)
    clock_speed: number;
    cooling: number;
    signal_noise: number;
    latency: number;
    decryption: number;
    cache: number;
    // Base tech stats (from user_stats, aligned with class defaults)
    base_clock: number;
    base_cooling: number;
    base_signal: number;
    base_latency: number;
    base_crypt: number;
    base_cache: number;
    // Mod tech stats (from user_stats, future items/software modifiers)
    mod_clock: number;
    mod_cooling: number;
    mod_signal: number;
    mod_latency: number;
    mod_crypt: number;
    mod_cache: number;
    // Total tech stats (from user_stats: base + mod, before hardware)
    total_clock: number;
    total_cooling: number;
    total_signal: number;
    total_latency: number;
    total_crypt: number;
    total_cache: number;
    // Hardware modifiers for display (from equipped cyberdeck)
    clock_speed_mod: number;
    cooling_mod: number;
    signal_noise_mod: number;
    latency_mod: number;
    decryption_mod: number;
    cache_mod: number;
}

/*
// 2. Mock Data Fetching Function (Simulates fetching from the DB via an API)
const fetchUserStats = (): Promise<UserStats> => {
    // Simulate database latency
    return new Promise((resolve) => {
        setTimeout(() => {
            const mockStats: UserStats = {
                // Meters Data
                max_consciousness: 100, current_consciousness: 85,
                max_charge: 500, current_charge: 375,
                max_bandwidth: 200, current_bandwidth: 190,
                max_thermal: 100, current_thermal: 30, // Low thermal load
                max_neural: 100, current_neural: 10, // Low neural load
                // Calculated Stats Data
                base_clock: 90, mod_clock: 10, total_clock: 100,
                base_cooling: 2400, mod_cooling: 125, total_cooling: 2525,
                base_signal: 70, mod_signal: 18, total_signal: 88, // Using total_signal as the primary stat
                base_latency: 350, mod_latency: -28, total_latency: 322,
                base_crypt: 950, mod_crypt: 49, total_crypt: 999,
                base_cache: 300, mod_cache: 0, total_cache: 300,
            };
            resolve(mockStats);
        }, 500);
    });
};
*/

interface FrameHeaderProps { titleSrc?: string }
const FrameHeader: React.FC<FrameHeaderProps> = ({ titleSrc }) => (
  <div className="frame-header">
    <img src={titleSrc} alt="CYBERPXNKS" />
  </div>
);

interface CxCardProps {
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}
const CxCard: React.FC<CxCardProps> = ({ title, children, className = '' }) => (
  <div className={`card-cx ${className}`}>
    {title ? <div className="card-cx-header">{title}</div> : null}
    {children}
  </div>
);

interface CxTabLinkProps {
  href: string;
  label?: string;
  iconSrc?: string;
  icon?: string; // Material Symbols icon name
  alertText?: string;
  alertActive?: boolean;
  backgroundImage?: string;
  hideIcon?: boolean;
}

const CxTabLink: React.FC<CxTabLinkProps> = ({ href, label, iconSrc, icon, alertText, alertActive = false, backgroundImage, hideIcon }) => {
  // Determine if the tab is 'blank' based on props
  const isBlank = !label && !iconSrc && !icon;

  return (
    <a href={href}>
      <div className="cx-tab cursor-pointer relative">
        {/* Background image with reduced opacity */}
        {backgroundImage && (
          <div 
            className="absolute inset-0 rounded-lg"
            style={{ 
              backgroundImage: `url(${backgroundImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: 0.4
            }}
          />
        )}
        
        {/* Content wrapper with relative positioning */}
        <div className="relative z-10 w-full h-full flex flex-col items-center justify-end pb-2">
          {alertText && (
            <div className={`tab-alert absolute top-0 right-0 -mt-2 -mr-2 text-xs font-semibold px-2 py-0.5 rounded-full shadow-xl ${
              alertActive 
                ? 'bg-bright-green text-black animate-pulse' 
                : 'bg-gray-600 text-gray-300'
            }`}>
              {alertText}
            </div>
          )}
          {!isBlank && !hideIcon && (
            icon ? (
              <div className="tab-icon mb-auto">
                <span className="material-symbols-outlined" style={{ 
                  fontSize: '50px', 
                  color: backgroundImage ? 'white' : 'inherit'
                }}>
                  {icon}
                </span>
              </div>
            ) : iconSrc ? (
              <div className="tab-icon mb-auto">
                <img 
                  src={iconSrc} 
                  alt="Icon"  
                />
              </div>
            ) : null
          )}
          {/* Spacer to keep label at bottom when no icon */}
          {hideIcon && <div className="flex-grow" />}
          <div className="tab-label" style={backgroundImage ? { color: 'white' } : {}}>{label}</div>
        </div>
      </div>
    </a>
  );
};

interface CxSlimsoftSlotProps {
  href: string;
  label?: string;
  image?: string;
  alertText?: string;
}

const CxSlimsoftSlot: React.FC<CxSlimsoftSlotProps> = ({ href, label, image, alertText }) => {
  // Determine if the tab is 'blank' based on props
  const isBlank = !label && !image;

  return (
    <a href={href}>
      <div 
        className="cx-tab-blank cursor-pointer relative"
        style={image ? { 
          backgroundImage: `url(${image})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        } : undefined}
      >
        {alertText && (
          <div className="tab-alert absolute top-0 right-0 -mt-2 -mr-2 bg-bright-green text-black text-xs font-semibold px-2 py-0.5 rounded-full shadow-xl animate-pulse">
            {alertText}
          </div>
        )}
      </div>
    </a>
  );
};

// 4. MeterGauge Component
interface MeterGaugeProps {
    label: string;
    current: number;
    max: number;
    color: string;
    regenAmount?: number;
    timeToRegen?: string;
    isLoadStat?: boolean; // For thermal/neural which decrease instead of increase
}
// const MeterGauge = ({ label, fillPercentage, color = 'bg-teal-500' }) => {
const MeterGauge: React.FC<MeterGaugeProps> = ({ label, current, max, color, regenAmount, timeToRegen, isLoadStat }) => {
    // Dynamically setting the width based on the fillPercentage prop
    const fillPercentage = max > 0 ? Math.min(100, (current / max) * 100) : 0;
    const fillStyle = { width: `${fillPercentage}%` };

    let meterColor = color;
    if (label.includes("THERMAL") || label.includes("NEURAL")) {
      // Use bright-red for high load (Thermal/Neural)
      if (fillPercentage >= 70) meterColor = 'bg-red-500';
      // Use #ff6663 for low load (Thermal/Neural)
      else meterColor = 'bg-[#ff6663]';
    }

    // Determine if regen timer should be shown
    const shouldShowRegen = regenAmount !== undefined && timeToRegen && (
        isLoadStat 
            ? current > 0 // Show for load stats (thermal/neural) when they're actively decreasing
            : current < max // Show for regen stats when not at max
    );

    return (
        // .meter-row
        <div className="mb-2">
            <div className="flex items-center space-x-4">
                <div className="w-1/3 text-sm font-mono font-light text-gray-300 uppercase">
                    <span className="font-semibold text-fuchsia-300">{label}</span>
                </div>
                
                {/* .meter-gauge */}
                <div className="w-2/3 relative">
                    <div className="h-4 bg-gray-500/25 rounded-xl overflow-hidden p-0.5">
                        {/* .meter-gauge-fill */}
                        <div className={`h-full ${meterColor} rounded-full transition-all duration-700`} style={fillStyle}></div>
                    </div>
                    {/* Numeric display overlay */}
                    <div className="absolute inset-0 flex items-center justify-end pr-2 text-xs font-mono text-white/90 pointer-events-none">
                        <span className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{current} / {max}</span>
                    </div>
                </div>
            </div>
            {/* Regen timer for regenerating stats */}
            {shouldShowRegen && (
                <div className="flex items-center space-x-4 mt-1">
                    <div className="w-1/3"></div>
                    <div className="w-2/3 text-xs font-mono text-gray-400 pl-1">
                        {isLoadStat ? '-' : '+'}{regenAmount} in {timeToRegen}
                    </div>
                </div>
            )}
        </div>
    );
};

// 5. ActionBanner
interface ActionBannerProps {
  href: string;
  heading1: string;
  heading2: string;
  buttonLabel: string;
  className?: string;
}

const ActionBanner: React.FC<ActionBannerProps> = ({ href, heading1, heading2, buttonLabel, className }) => (
  <a href={href} className="block mb-6">
    <div className={`cx-banner ${className}`}>
      
      {/* Banner Left (Headings) */}
      <div className="banner-left">
        <div className="banner-heading-1">{heading1}</div>
        <div className="banner-heading-2">{heading2}</div>
      </div>
      
      {/* Banner Right (CTA Button) */}
      <div className="banner-right">

        <button className="btn-cx btn-xs btn-cx-action">
          <span className="btn-cx__label">{buttonLabel}</span>
          <span className="btn-cx__icon">check_circle</span> 
        </button>
      </div>
    </div>
  </a>
);

// 6. StatRow Component (For the statistics grid)
interface StatRowProps {
    label: string;
    mod: number;
    value: number | string; // Use string for ratios like '88/92'
}
// const StatRow = ({ label, mod, value }) => (
const StatRow: React.FC<StatRowProps> = ({ label, mod, value }) => {
    const modDisplay = mod === 0 ? "" : (mod > 0 ? `+${mod}` : `${mod}`);
    // .stat_row
    return (
    <div className="flex justify-between items-center py-1 border-b border-gray-700 last:border-b-0">
        <div className="flex direction-row justify-between items-left gap-1">
        
            <div className="text-sm font-mono text-white uppercase">{label}</div>
        
            {modDisplay && (
                <div className="px-1.5 py-0.5 text-bright-blue text-xs font-bold rounded-full">
                    {modDisplay}
                </div>
            )}

        </div>

        <div className="px-3 py-0.5 bg-fuchsia-500 text-white text-xs font-bold rounded-full">
            {value}
        </div>
        
    </div>
    );
};

interface ButtonCxProps {
  label: string;
  icon?: string;
  link: string;
  style?: string;
  size?: string;
}

const ButtonCx: React.FC<ButtonCxProps> = ({ label, icon, link, style, size }) => (
  <a href={`${link}`}>
    <button className={`btn-cx ${size} ${style}`}>
      <span className="btn-cx__label">{label}</span>
      <span className="btn-cx__icon">{icon}</span>
    </button>
  </a>
);

export default function Dashboard() {
    const router = useRouter();
    const { user: neynarUser } = useNeynarContext();
    const [userFid, setUserFid] = useState<number | null>(null);
    const navData = useNavData(userFid || 0);
    const [stats, setStats] = useState<UserStatsData | null>(null);
    const [activeJobs, setActiveJobs] = useState<any[]>([]);
    const [jobTimers, setJobTimers] = useState<Map<string, string>>(new Map());
    const [equippedSlimsoft, setEquippedSlimsoft] = useState<any[]>([]);
    const [equippedCyberdeck, setEquippedCyberdeck] = useState<any>(null);
    const [equippedArsenal, setEquippedArsenal] = useState<any>(null);
    const [recentInventoryItem, setRecentInventoryItem] = useState<any>(null);
    const [currentLocation, setCurrentLocation] = useState<{ zoneId: number; zoneName: string; zoneImage: string } | null>(null);
    const [isLoadingAuth, setIsLoadingAuth] = useState(true);
    const [isLoadingStats, setIsLoadingStats] = useState(true);
    const [statsError, setStatsError] = useState<string | null>(null);
    
    // Regen timer for displaying next regen interval
    const { timeToRegen } = useRegenTimer();

  // Get authenticated user's FID from SDK or Neynar
  useEffect(() => {
    const getAuthenticatedFid = async () => {
      try {
        // Try SDK context first (mini-app)
        try {
          const context = await sdk.context;
          if (context?.user?.fid) {
            setUserFid(context.user.fid);
            setIsLoadingAuth(false);
            return;
          }
        } catch (sdkError) {
          console.log('No SDK context available');
        }

        // Try Neynar context (web)
        if (neynarUser?.fid) {
          setUserFid(neynarUser.fid);
          setIsLoadingAuth(false);
          return;
        }

        // No authentication found - redirect to landing
        console.log('No authenticated user found, redirecting to landing');
        router.push('/');
      } catch (error) {
        console.error('Error getting authenticated FID:', error);
        router.push('/');
      }
    };

    getAuthenticatedFid();
  }, [neynarUser, router]);

  // Sync user data from Farcaster once per day
  useDailyFarcasterSync(userFid || 0);

  // Fetch live stats with regeneration and alert counts on mount
  useEffect(() => {
    if (!userFid || isLoadingAuth) return;

    let mounted = true;
    setIsLoadingStats(true);
    
    async function load() {
      try {
        // Parallelize all independent API calls for faster loading
        const [statsRes, regenRes, alertsRes, jobsRes, hardwareRes, inventoryRes] = await Promise.all([
          fetch(`/api/stats?fid=${userFid}`),  // Fetch calculated stats (tech stats + hardware modifiers)
          fetch(`/api/regenerate?fid=${userFid}`, { method: 'POST' }),  // Regenerate time-based meters
          fetch(`/api/alerts?fid=${userFid}`),
          fetch(`/api/active-jobs?fid=${userFid}`),
          fetch(`/api/hardware?fid=${userFid}`),  // Fetch hardware including equipped slimsoft
          fetch(`/api/inventory?fid=${userFid}&sortBy=acquisition`)  // Fetch inventory for arsenal and recent items
        ]);

        // Process calculated stats (static until hardware/stat allocation changes)
        if (statsRes.ok && mounted) {
          const statsData = await statsRes.json();
          console.log('Stats data loaded:', statsData);
          setStats(statsData);
        } else {
          console.error('Stats API failed:', statsRes.status, statsRes.statusText);
          const errorData = await statsRes.text();
          console.error('Stats API error response:', errorData);
          setStatsError(`API Error ${statsRes.status}: ${errorData.substring(0, 200)}`);
        }

        // Process regeneration (only affects meters: consciousness, stamina, charge, thermal, neural)
        if (regenRes.ok) {
          const regenData = await regenRes.json();
          if (regenData.intervalsElapsed > 0) {
            console.log(`Regenerated ${regenData.intervalsElapsed} intervals (${regenData.intervalsElapsed * 15} minutes)`);
            // Refetch stats to get updated current meter values
            const updatedStatsRes = await fetch(`/api/stats?fid=${userFid}`);
            if (updatedStatsRes.ok && mounted) {
              const updatedStats = await updatedStatsRes.json();
              setStats(updatedStats);
            }
          }
        }

        // Process alerts
        if (alertsRes && alertsRes.ok) {
          const aData = await alertsRes.json();
          console.log('Dashboard alerts data:', aData);
          const contactsCount = aData?.contacts ?? 0;
          const gigsCount = aData?.gigs ?? 0;
          const messagesCount = aData?.messages ?? 0;

          // Set current location data
          if (mounted && aData?.location) {
            console.log('Setting location:', aData.location);
            setCurrentLocation(aData.location);
          } else {
            console.log('No location data in alerts response');
          }

          if (mounted) {
            setNavTabs((prev) => prev.map((tab) => {
              if (tab.href === '/contacts') {
                return { 
                  ...tab, 
                  alertText: contactsCount > 0 ? `${contactsCount} NEW` : '0 NEW',
                  alertActive: contactsCount > 0
                };
              }
              if (tab.href === '/gigs') {
                return { 
                  ...tab, 
                  alertText: gigsCount > 0 ? `${gigsCount} NEW` : '0 NEW',
                  alertActive: gigsCount > 0
                };
              }
              if (tab.href === '/messages') {
                return { 
                  ...tab, 
                  alertText: messagesCount > 0 ? `${messagesCount} UNREAD` : '0 UNREAD',
                  alertActive: messagesCount > 0
                };
              }
              return tab;
            }));
          }
        } else if (alertsRes) {
          console.error('Failed to fetch alerts:', alertsRes.status, await alertsRes.text());
        }

        // Process active jobs
        if (jobsRes.ok) {
          const jobsData = await jobsRes.json();
          if (mounted) {
            setActiveJobs(jobsData.jobs || []);
          }
        }

        // Process hardware data to get equipped slimsoft
        if (hardwareRes.ok) {
          const hardwareData = await hardwareRes.json();
          if (mounted && hardwareData.slimsoft) {
            const equipped = hardwareData.slimsoft.filter((s: any) => s.is_equipped === 1);
            setEquippedSlimsoft(equipped);
          }
          if (mounted && hardwareData.cyberdecks) {
            const equippedDeck = hardwareData.cyberdecks.find((d: any) => d.is_equipped === 1);
            setEquippedCyberdeck(equippedDeck || null);
          }
        }

        // Process inventory data to get equipped arsenal and most recent item
        if (inventoryRes.ok) {
          const inventoryData = await inventoryRes.json();
          if (mounted && inventoryData.items) {
            // Get first equipped arsenal item (weapon, accessory, or relic)
            const arsenalTypes = ['weapon', 'accessory', 'relic'];
            const equippedArsenalItem = inventoryData.items.find((item: any) => 
              arsenalTypes.includes(item.item_type?.toLowerCase()) && item.is_equipped === 1
            );
            setEquippedArsenal(equippedArsenalItem || null);
            
            // Get most recently acquired item (first in acquisition sort)
            const mostRecent = inventoryData.items[0] || null;
            setRecentInventoryItem(mostRecent);
          }
        }

      } catch (err) {
        console.error('Error fetching stats/alerts:', err);
      } finally {
        if (mounted) {
          setIsLoadingStats(false);
        }
      }
    }

    load();
    return () => { mounted = false; };
  }, [userFid, isLoadingAuth]);

  // Countdown timer for active jobs
  useEffect(() => {
    if (activeJobs.length === 0) return;

    const interval = setInterval(() => {
      const newTimers = new Map<string, string>();
      
      activeJobs.forEach((job) => {
        const now = new Date().getTime();
        const endTime = new Date(job.end_time).getTime();
        const distance = endTime - now;

        if (distance <= 0) {
          newTimers.set(`${job.action_type}-${job.id}`, '00:00:00');
        } else {
          const hours = Math.floor(distance / (1000 * 60 * 60));
          const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((distance % (1000 * 60)) / 1000);
          newTimers.set(`${job.action_type}-${job.id}`, 
            `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
          );
        }
      });

      setJobTimers(newTimers);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeJobs]);

  // Regeneration timer: triggers every 5 minutes while page is open
  useEffect(() => {
    let mounted = true;
    
    async function regenerate() {
      try {
        const res = await fetch('/api/regenerate?fid=300187', {
          method: 'POST'
        });
        
        if (res.ok) {
          const data = await res.json();
          if (mounted && data.stats) {
            setStats(data.stats);
            if (data.intervalsElapsed > 0) {
              console.log(`Regenerated ${data.intervalsElapsed} intervals (${data.intervalsElapsed * 15} minutes)`);
            }
          }
        }
      } catch (err) {
        console.error('Error regenerating stats:', err);
      }
    }

    // Set up interval to run every 5 minutes (300000ms) while page is open
    const interval = setInterval(regenerate, 900000); // 15 minutes

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

    /*
    // Fetch data on component mount
    useEffect(() => {
        setIsLoading(true);
        fetchUserStats()
            .then(data => {
                setStats(data);
                setIsLoading(false);
            })
            .catch(error => {
                console.error("Failed to fetch user stats:", error);
                setIsLoading(false);
            });
    }, []);
    */

    // Helper function to map dynamic stats to meter component props
    const getMeterData = (data: UserStatsData) => [
        { label: "CONSCIOUSNESS", current: data.current_consciousness || 0, max: data.max_consciousness || 0, color: 'bg-red-500', regenAmount: 5 },
        { label: "STAMINA", current: data.current_stamina || 0, max: data.max_stamina || 0, color: 'bg-red-500', regenAmount: 5 },
        { label: "CHARGE", current: data.current_charge || 0, max: data.max_charge || 0, color: 'bg-lime-400', regenAmount: 5 },
        { label: "BANDWIDTH", current: data.current_bandwidth || 0, max: data.max_bandwidth || 0, color: 'bg-blue-500' },
        { label: "THERMAL LOAD", current: data.current_thermal || 0, max: data.max_thermal || 0, color: 'bg-lime-400', regenAmount: 5, isLoadStat: true },
        { label: "NEURAL LOAD", current: data.current_neural || 0, max: data.max_neural || 0, color: 'bg-red-500', regenAmount: 5, isLoadStat: true },
    ];

    // Helper function to map dynamic stats to stat rows
    const getStatsData = (data: UserStatsData) => [
        { label: "CLOCK SPEED", mod: data.clock_speed_mod || 0, value: data.clock_speed || 0 },
        { label: "COOLING", mod: data.cooling_mod || 0, value: data.cooling || 0 },
        { label: "SIGNAL/NOISE", mod: data.signal_noise_mod || 0, value: data.signal_noise || 0 }, 
        { label: "LATENCY", mod: data.latency_mod || 0, value: data.latency || 0 },
        { label: "CRYPT", mod: data.decryption_mod || 0, value: data.decryption || 0 },
        { label: "CACHE", mod: data.cache_mod || 0, value: data.cache || 0 },
    ];

// Mock data for repeated elements
  const iconSrc = "/icon_crest.png";
  // navTabs will be stateful so we can update alert pills from the API
  const [navTabs, setNavTabs] = useState<Array<{ href: string; label: string; iconSrc?: string; alertText?: string; alertActive?: boolean }>>([
    { href: "/contacts", label: "Contacts", iconSrc: "/icon_contacts.png" },
    { href: "/gigs", label: "Gigs", iconSrc: "/icon_gigs.png" },
    { href: "/messages", label: "Messages", iconSrc: "/icon_msg.png" },
  ]);
  
  /*
  const meterData = [
    { label: "Consciousness", fill: 100, color: 'bg-red-500' }, 
    { label: "Charge", fill: 75, color: 'bg-lime-400' }, 
    { label: "Bandwidth", fill: 90, color: 'bg-blue-500' }, 
    { label: "Thermal Load", fill: 30, color: 'bg-blue-500' }, 
    { label: "Neural Load", fill: 10, color: 'bg-red-500' },
  ];
  */
  
  const techStackTabs = [
    { href: "/hardware", label: "Hardware", icon: "memory", backgroundImage: equippedCyberdeck?.image_url },
    { href: "/hardware#arsenal", label: "Arsenal", icon: "swords", backgroundImage: equippedArsenal?.image_url },
    { href: "/gear", label: "Gear", icon: "inventory_2", backgroundImage: recentInventoryItem?.image_url },
  ];
  
  /*
  const statsData = [
    { label: "Clock Speed", mod: "+10", value: "100" },
    { label: "Cooling", mod: "+32", value: "2525" },
    { label: "Signal/Noise", mod: "", value: "88/92" },
    { label: "Latency", mod: "-12", value: "322" },
    { label: "Crypt", mod: "+20", value: "999" },
    { label: "Cache", mod: "", value: "300" },
  ];
  */

/*
    // Display a loading state if data is not ready
    if (isLoading || !stats) {
        return (
             <div className="frame-container frame-main flex items-center justify-center">
                 <div className="spinner h-12 w-12 border-4 border-t-fuchsia-500"></div>
             </div>
        );
    }
    */

    // Show loading state while authenticating
    if (isLoadingAuth || !userFid) {
        return (
             <div className="frame-container frame-main flex items-center justify-center min-h-screen">
                 <div className="flex flex-col items-center">
                    <div className="animate-spin inline-block w-12 h-12 border-4 border-t-cyan-400 border-purple-600 rounded-full mb-4"></div>
                    <p className="text-cyan-400 text-lg font-mono">AUTHENTICATING...</p>
                 </div>
             </div>
        );
    }

    // Show loading state while fetching stats
    if (isLoadingStats) {
        return (
             <div className="frame-container frame-main flex items-center justify-center min-h-screen">
                 <div className="flex flex-col items-center">
                    <div className="animate-spin inline-block w-12 h-12 border-4 border-t-cyan-400 border-purple-600 rounded-full mb-4"></div>
                    <p className="text-cyan-400 text-lg font-mono">LOADING DASHBOARD...</p>
                 </div>
             </div>
        );
    }

    // Display an error state if no stats were found (user needs onboarding)
    if (!stats) {
        return (
             <div className="frame-container frame-main flex items-center justify-center min-h-screen">
                 <div className="flex flex-col items-center p-8 bg-gray-800/50 rounded-lg shadow-2xl max-w-md">
                    <div className="text-xl text-red-400 font-mono mb-4">ERROR 404: USER NOT INITIALIZED</div>
                    <p className="text-gray-300 text-center mb-4">Your cybernetic profile hasn't been initialized yet.</p>
                    
                    {/* Debug info */}
                    <div className="w-full bg-gray-900/50 rounded p-4 mb-4 font-mono text-sm">
                      <div className="text-cyan-400 mb-2">Authentication Debug:</div>
                      <div className="text-gray-300">FID: <span className="text-white">{userFid || 'null'}</span></div>
                      <div className="text-gray-300">Username: <span className="text-white">{neynarUser?.username || 'unknown'}</span></div>
                      <div className="text-gray-300">Display Name: <span className="text-white">{neynarUser?.display_name || 'unknown'}</span></div>
                      <div className="text-cyan-400 mt-3 mb-2">Stats API Debug:</div>
                      <div className="text-gray-300">Stats Loaded: <span className="text-white">{stats ? 'YES' : 'NO'}</span></div>
                      {statsError && (
                        <div className="text-red-400 mt-2 text-xs break-words">Error: {statsError}</div>
                      )}
                    </div>
                    
                    <button 
                      onClick={() => router.push('/onboarding')}
                      className="px-6 py-3 bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-mono uppercase tracking-wider rounded-lg hover:from-purple-500 hover:to-cyan-500 transition-all"
                    >
                      Initialize Profile
                    </button>
                 </div>
             </div>
        );
    }
    
    const meterData = getMeterData(stats);
    const statsData = getStatsData(stats);

  return (
    <>
      <div className="frame-container frame-main">
        <div className="frame-body pt-6 pb-2 px-6">
          <NavStrip 
            username={navData.username}
            userProfileImage={navData.profileImage}
            credits={navData.credits}
            cxBalance={navData.cxBalance}
          />
        </div>

        <FrameHeader titleSrc="/cx-title.png" />

        <div className="frame-body">

            <CxCard title="Your Dashboard" className="mb-6">
                <div className="cx-tabs">
                    {navTabs.map((tab: { href: string; label: string; iconSrc?: string; alertText?: string; alertActive?: boolean }) => (
                        <CxTabLink 
                            key={tab.href}
                            href={tab.href}
                            label={tab.label}
                            iconSrc={tab.iconSrc}
                            alertText={tab.alertText}
                            alertActive={tab.alertActive}
                        />
                        ))}
                </div>

                {/* Meter Gauges */}
                <div className="meter-container">
                    {meterData.map((meter, index) => (
                    <MeterGauge 
                        key={index}
                        label={meter.label}
                        // fillPercentage={meter.fill}
                        current={meter.current}
                        max={meter.max}
                        color={meter.color}
                        regenAmount={meter.regenAmount}
                        timeToRegen={meter.regenAmount ? timeToRegen : undefined}
                        isLoadStat={meter.isLoadStat}
                    />
                    ))}
                </div>
          
        </CxCard>

        {/* IN PROGRESS JOBS Card */}
        {activeJobs.length > 0 && (
          <CxCard title="IN PROGRESS JOBS" className="mb-6">
            <div className="space-y-3">
              {activeJobs.map((job) => {
                const jobKey = `${job.action_type}-${job.id}`;
                const timeLeft = jobTimers.get(jobKey) || '...';
                const isComplete = timeLeft === '00:00:00';
                
                return (
                  <div key={jobKey} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded">
                    <div className="flex-1">
                      <Link href={job.action_type === 'OvernetScan' ? '/grid' : job.zone_id ? `/city/${job.zone_id}` : '/city'} className="text-cyan-400 hover:text-cyan-300 font-semibold uppercase text-sm">
                        {job.location || job.zone_name || 'City'}
                      </Link>
                      <p className="text-gray-400 text-xs mt-1">
                        {job.action_type === 'Breached' && `Breaching ${job.poi_name || 'Terminal'}`}
                        {job.action_type === 'Scouted' && 'Scouting'}
                        {job.action_type === 'Exploring' && 'Exploring'}
                        {job.action_type === 'OvernetScan' && 'Overnet Scan'}
                        {job.action_type === 'RemoteBreach' && `Remote Breach ${job.poi_name || 'Terminal'}`}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      {isComplete ? (
                        <Link href={job.action_type === 'OvernetScan' ? '/grid' : job.action_type === 'Exploring' ? '/city' : `/city/${job.zone_id}`}>
                          <button className="btn-cx btn-cx-pause px-4 py-2 text-xs">
                            COMPLETE
                          </button>
                        </Link>
                      ) : (
                        <button 
                          className="btn-cx btn-cx-pause px-4 py-2 text-xs cursor-default opacity-75"
                          disabled
                        >
                          IN PROGRESS
                        </button>
                      )}
                      <div className="text-white text-center text-xs mt-1">{timeLeft}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CxCard>
        )}

        {/* Current Location Banner */}
        {currentLocation && currentLocation.zoneId && (
          <div 
            className="relative w-full h-[120px] rounded-lg overflow-hidden mb-4 cursor-pointer"
            style={{
              backgroundImage: currentLocation.zoneImage ? `url(${currentLocation.zoneImage})` : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
            onClick={() => router.push(`/city/${currentLocation.zoneId}`)}
          >
            {/* Dark overlay for better text visibility */}
            <div className="absolute inset-0 bg-black bg-opacity-40"></div>
            
            {/* Content */}
            <div className="relative h-full flex items-center justify-between px-6">
              {/* Left side: Location info */}
              <div>
                <div className="text-gray-300 text-sm uppercase mb-1">Current location:</div>
                <div className="text-white font-bold text-2xl uppercase" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
                  {currentLocation.zoneName}
                </div>
              </div>
              
              {/* Right side: View button */}
              <button className="btn-cx btn-cx-primary px-6 py-2">
                VIEW
              </button>
            </div>
          </div>
        )}

        <ActionBanner
          href="/city"
          heading1="The"
          heading2="City"
          buttonLabel="Enter"
          className="cta-city"
        />

        <ActionBanner
          href="/grid"
          heading1="Cyberspace"
          heading2="Run"
          buttonLabel="Jack in"
          className="cta-grid"
        />

        
        {/* Equipment Loadout Card */}
        <CxCard title="Equipment Loadout" className="mb-2">
          
            <div className="dashboard-container">

                {/* Equipment Loadout Tabs (Hardware, Arsenal, Gear) */}
                <div className="cx-tabs">
                    {techStackTabs.map((tab) => (
                    <CxTabLink 
                        key={tab.href}
                        href={tab.href}
                        label={tab.label}
                        icon={tab.icon}
                        backgroundImage={tab.backgroundImage}
                    />
                    ))}
                </div>

            </div>

            <div className="dashboard-container">

                {/* Equipped Slimsoft Header */}
                <div className="card-cx-header">
                    Equipped Slimsoft
                </div>
                
                {/* Equipped Slimsoft Tabs (Show equipped items or blank placeholders) */}
                <div className="cx-tabs">
                    {[0, 1, 2].map((slotIndex) => {
                      const soft = equippedSlimsoft[slotIndex];
                      return (
                        <CxSlimsoftSlot 
                          key={slotIndex}
                          href={soft ? `/gear/${soft.id}` : "/hardware#slimsoft"}
                          label={soft ? soft.name : ""}
                          image={soft ? soft.image_url : "/soft_new.png"}
                        />
                      );
                    })}
                </div>

                {/* Manage Slimsoft Button: Using a primary button style close to bright-blue/black or a standard theme one. */}
                <ButtonCx 
                    label="Manage Slimsoft" 
                    icon="check_circle" 
                    link="/hardware#slimsoft" 
                    style="btn-cx-secondary" 
                    size="btn-cx-full" 
                />

          </div>
          
        </CxCard>
        
        </div>

      </div>
    </>
  );
}