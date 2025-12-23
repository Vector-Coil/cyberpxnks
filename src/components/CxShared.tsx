"use client";
import React, { useEffect, useState } from 'react';

export const FrameHeader: React.FC<{ titleSrc?: string }> = ({ titleSrc = '/cx-title.png' }) => (
  <div className="frame-header">
    <img src={titleSrc} alt="CYBERPXNKS" />
  </div>
);

export interface NavStripProps {
  userProfileImage?: string;
  username?: string;
  cxBalance?: number; // On-chain $CX token balance from wallet
  credits?: number; // In-game credits from database
  onMenuClick?: () => void;
  hasAlerts?: boolean;
}

export const NavStrip: React.FC<NavStripProps> = ({ 
  userProfileImage, 
  username = 'user',
  cxBalance = 0,
  credits = 0,
  onMenuClick,
  hasAlerts
}) => {
  const [showAlertDot, setShowAlertDot] = useState(false);

  useEffect(() => {
    // If hasAlerts prop is explicitly provided, use it
    if (hasAlerts !== undefined) {
      setShowAlertDot(hasAlerts);
      return;
    }

    // Otherwise, fetch alerts from API
    const fetchAlerts = async () => {
      try {
        const res = await fetch('/api/alerts');
        if (res.ok) {
          const data = await res.json();
          const totalAlerts = (data.contacts || 0) + (data.gigs || 0) + (data.messages || 0) + (data.unallocatedPoints || 0);
          setShowAlertDot(totalAlerts > 0);
        }
      } catch (error) {
        console.error('Failed to fetch alerts:', error);
      }
    };

    fetchAlerts();
  }, [hasAlerts]);

  const handleMenuClick = () => {
    if (onMenuClick) {
      onMenuClick();
    } else {
      console.log('Menu clicked - no handler provided');
    }
  };

  return (
    <div className="navStrip">
      <div className="navLeft">
        <a href={`/profile/${username}`} className="block">
          <div className="w-[25px] h-[25px] rounded-full overflow-hidden bg-gray-700 flex items-center justify-center">
            {userProfileImage ? (
              <img src={userProfileImage} alt={username} className="w-full h-full object-cover" />
            ) : (
              <div className="text-xs font-bold text-gray-400">{username?.charAt(0).toUpperCase()}</div>
            )}
          </div>
        </a>
      </div>
      
      <div className="navCenter">
        <div className="flex items-center gap-2">
          {/* Credits Display */}
          <div className="flex items-center gap-1.5">
            <div className="pill-charcoal text-xs flex flex-row gap-1">{credits.toLocaleString()}
            <img 
              src="https://vectorcoil.com/cx/images/credits-currency.svg" 
              alt="Credits" 
              className="w-3 h-3"
            /></div>
          </div>
          
          {/* CX logo */}
          <a href="/dashboard" className="block">
            <div className="h-[20px] rounded-full overflow-hidden flex items-center justify-center flex-shrink-0">
              <img 
                src="https://vectorcoil.com/cx/images/cx.png" 
                alt="CYBERPXNKS" 
                className="h-5"
              />
            </div>
          </a>
          
          {/* $CX Token Display */}
          <div className="flex items-center gap-1.5">
            <span className="pill-charcoal text-xs">{cxBalance.toLocaleString()} $CX</span>
          </div>
        </div>
      </div>
      
      <div className="navRight">
        <button 
          onClick={handleMenuClick}
          className="w-[25px] h-[25px] flex items-center justify-center cursor-pointer bg-transparent border-0 relative"
          aria-label="Menu"
        >
          <span className="material-symbols-outlined text-white text-2xl">menu</span>
          {showAlertDot && (
            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-black" style={{ backgroundColor: 'var(--fuschia)' }}></div>
          )}
        </button>
      </div>
    </div>
  );
};

export const CxCard: React.FC<{ title?: string; className?: string; children?: React.ReactNode; href?: string }> = ({ title, className = '', children, href }) => (
  href ? (
    <a href={href} className={`card-cx ${className}`}>
      {title && <div className="card-cx-header">{title}</div>}
      {children}
    </a>
  ) : (
    <div className={`card-cx ${className}`}>
      {title && <div className="card-cx-header">{title}</div>}
      {children}
    </div>
  )
);

export interface CxTabLinkProps {
  href: string;
  label?: string;
  iconSrc?: string;
  icon?: string; // Material Symbols icon name (e.g. 'memory', 'swords', 'inventory_2')
  alertText?: string;
  backgroundImage?: string;
  hideIcon?: boolean;
}

export const CxTabLink: React.FC<CxTabLinkProps> = ({ href, label, iconSrc, icon, alertText, backgroundImage, hideIcon }) => {
  const isBlank = !label && !iconSrc && !icon;
  return (
    <a href={href}>
      <div className="cx-tab cursor-pointer" style={backgroundImage ? {
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'relative'
      } : {}}>
        {backgroundImage && (
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            borderRadius: '10px'
          }} />
        )}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          {alertText && (
            <div className="pill pill-alert pill-alert-pulse absolute -top-1 -right-1 z-10">
              {alertText}
            </div>
          )}
          {!isBlank && (
            icon ? (
              <div className="tab-icon">
                <span className="material-symbols-outlined" style={{ 
                  fontSize: '50px', 
                  display: 'block',
                  color: backgroundImage ? 'white' : 'inherit'
                }}>
                  {icon}
                </span>
              </div>
            ) : iconSrc ? (
              <div className="tab-icon"><img src={iconSrc} alt="icon"/></div>
            ) : null
          )}
          <div className="tab-label" style={backgroundImage ? { color: 'white' } : {}}>{label}</div>
        </div>
      </div>
    </a>
  );
};

// Hook to fetch alert counts for a given fid (defaults to 300187 for dev)
export function useAlerts(devFid = 300187) {
  const [counts, setCounts] = useState<{ contacts: number; gigs: number; messages: number }>({ contacts: 0, gigs: 0, messages: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch(`/api/alerts?fid=${devFid}`);
        if (!res.ok) {
          console.error('Failed to fetch alerts', res.status);
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (mounted) {
          setCounts({ contacts: data.contacts ?? 0, gigs: data.gigs ?? 0, messages: data.messages ?? 0 });
          setLoading(false);
        }
      } catch (err) {
        console.error('useAlerts error', err);
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [devFid]);

  return { ...counts, loading };
}

export const TopNav: React.FC<{ iconSrc?: string; devFid?: number }> = ({ iconSrc = '/icon_crest.png', devFid = 300187 }) => {
  const { contacts, gigs, messages, loading } = useAlerts(devFid as number);

  return (
    <div className="cx-tabs mb-4">
      <CxTabLink href="/contacts" label="Contacts" iconSrc={iconSrc} alertText={contacts > 0 ? `${contacts} NEW` : undefined} />
      <CxTabLink href="/gigs" label="Gigs" iconSrc={iconSrc} alertText={gigs > 0 ? `${gigs} NEW` : undefined} />
      <CxTabLink href="/messages" label="Messages" iconSrc={iconSrc} alertText={messages > 0 ? `${messages} UNREAD` : undefined} />
      {/* Could add a loading indicator if desired */}
    </div>
  );
};

export default {
  FrameHeader,
  CxCard,
  CxTabLink,
  NavStrip,
  useAlerts,
  TopNav,
};
