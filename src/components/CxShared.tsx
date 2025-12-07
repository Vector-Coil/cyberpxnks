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
  cxBalance?: number;
  onMenuClick?: () => void;
  hasAlerts?: boolean;
}

export const NavStrip: React.FC<NavStripProps> = ({ 
  userProfileImage, 
  username = 'user',
  cxBalance = 0,
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
          <div className="w-[25px] h-[25px] rounded-full overflow-hidden bg-gray-700 flex items-center justify-center">
            <img src="/icon_cx-cred.png" alt="CX Token" className="w-full h-full object-cover" />
          </div>
          <span className="pill-charcoal">{cxBalance.toLocaleString()} $CX</span>
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
  alertText?: string;
}

export const CxTabLink: React.FC<CxTabLinkProps> = ({ href, label, iconSrc, alertText }) => {
  const isBlank = !label && !iconSrc;
  return (
    <a href={href}>
      <div className="cx-tab cursor-pointer">
        {alertText && (
          <div className="tab-alert absolute top-0 right-0 -mt-2 -mr-2 bg-bright-green text-black text-xs font-semibold px-2 py-0.5 rounded-full shadow-xl animate-pulse">
            {alertText}
          </div>
        )}
        {!isBlank && iconSrc && (
          <div className="tab-icon"><img src={iconSrc} alt="icon"/></div>
        )}
        <div className="tab-label">{label}</div>
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
