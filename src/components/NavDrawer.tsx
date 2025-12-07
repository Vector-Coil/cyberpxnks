"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';

interface NavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  profileImage?: string;
  cxBalance: number;
}

interface Alerts {
  contacts: number;
  gigs: number;
  messages: number;
  unallocatedPoints: number;
}

const NavDrawer: React.FC<NavDrawerProps> = ({ isOpen, onClose, username, profileImage, cxBalance }) => {
  const [alerts, setAlerts] = useState<Alerts>({ contacts: 0, gigs: 0, messages: 0, unallocatedPoints: 0 });

  useEffect(() => {
    if (isOpen) {
      fetchAlerts();
    }
  }, [isOpen]);

  const fetchAlerts = async () => {
    try {
      const res = await fetch('/api/alerts');
      if (res.ok) {
        const data = await res.json();
        setAlerts({
          contacts: data.contacts || 0,
          gigs: data.gigs || 0,
          messages: data.messages || 0,
          unallocatedPoints: data.unallocatedPoints || 0,
        });
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    }
  };

  if (!isOpen) return null;

  const renderAlertPill = (count: number) => {
    if (count === 0) return null;
    return (
      <div className="absolute top-1 right-1 bg-fuschia text-black text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
        {count}
      </div>
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed inset-0 bg-black bg-opacity-95 z-50 overflow-y-auto">
        {/* NavStrip at top */}
        <div className="navStrip mb-6 px-5 py-3">
          {/* Left: Profile Image */}
          <div className="navLeft">
            <Link href="/profile">
              <img
                src={profileImage || '/icon_crest.png'}
                alt={username}
                className="w-8 h-8 rounded-full cursor-pointer"
                onClick={onClose}
              />
            </Link>
          </div>

          {/* Center: CyberPxnks Logo */}
          <div className="navCenter">
            <img 
              src="/cx-title-sm.png" 
              alt="CYBERPXNKS" 
              className="h-8"
            />
          </div>

          {/* Right: Close X */}
          <div className="navRight">
            <button 
              onClick={onClose}
              className="text-white text-2xl font-bold w-8 h-8 flex items-center justify-center"
            >
              ×
            </button>
          </div>
        </div>

        {/* Navigation Grid */}
        <div className="px-5">
          {/* Row 1: Dashboard, Stats, Profile */}
          <div className="cx-tabs">
            {/* Dashboard */}
            <Link href="/dashboard" onClick={onClose}>
              <div className="cx-tab cursor-pointer">
                <div className="tab-icon">
                  <img src="/icon_crest.png" alt="Dashboard" />
                </div>
                <div className="tab-label text-white">Dashboard</div>
              </div>
            </Link>

            {/* Stats */}
            <Link href="/allocate-points" onClick={onClose}>
              <div className="cx-tab cursor-pointer relative">
                <div className="tab-icon">
                  <img src="/icon_crest.png" alt="Stats" />
                </div>
                <div className="tab-label text-white">Stats</div>
                {renderAlertPill(alerts.unallocatedPoints)}
              </div>
            </Link>

            {/* Profile */}
            <Link href="/profile" onClick={onClose}>
              <div className="cx-tab cursor-pointer">
                <div className="tab-icon">
                  <img 
                    src={profileImage || '/icon_crest.png'} 
                    alt="Profile"
                    className="w-12 h-12 rounded-full mx-auto mb-3"
                  />
                </div>
                <div className="tab-label text-white">Profile</div>
              </div>
            </Link>
          </div>

          {/* Row 2: Contacts, Gigs, Messages */}
          <div className="cx-tabs">
            {/* Contacts */}
            <Link href="/contacts" onClick={onClose}>
              <div className="cx-tab cursor-pointer relative">
                <div className="tab-icon">
                  <img src="/icon_contacts.png" alt="Contacts" />
                </div>
                <div className="tab-label text-white">Contacts</div>
                {renderAlertPill(alerts.contacts)}
              </div>
            </Link>

            {/* Gigs */}
            <Link href="/gigs" onClick={onClose}>
              <div className="cx-tab cursor-pointer relative">
                <div className="tab-icon">
                  <img src="/icon_gigs.png" alt="Gigs" />
                </div>
                <div className="tab-label text-white">Gigs</div>
                {renderAlertPill(alerts.gigs)}
              </div>
            </Link>

            {/* Messages */}
            <Link href="/messages" onClick={onClose}>
              <div className="cx-tab cursor-pointer relative">
                <div className="tab-icon">
                  <img src="/icon_msg.png" alt="Messages" />
                </div>
                <div className="tab-label text-white">Messages</div>
                {renderAlertPill(alerts.messages)}
              </div>
            </Link>
          </div>

          {/* Row 3: Hardware, Slimsoft, Inventory */}
          <div className="cx-tabs">
            {/* Hardware */}
            <Link href="/hardware" onClick={onClose}>
              <div className="cx-tab cursor-pointer">
                <div className="tab-icon">
                  <img src="/icon_crest.png" alt="Hardware" />
                </div>
                <div className="tab-label text-white">Hardware</div>
              </div>
            </Link>

            {/* Slimsoft */}
            <Link href="/slimsoft" onClick={onClose}>
              <div className="cx-tab cursor-pointer">
                <div className="tab-icon">
                  <img src="/icon_crest.png" alt="Slimsoft" />
                </div>
                <div className="tab-label text-white">Slimsoft</div>
              </div>
            </Link>

            {/* Inventory (Gear) */}
            <Link href="/gear" onClick={onClose}>
              <div className="cx-tab cursor-pointer">
                <div className="tab-icon">
                  <img src="/icon_crest.png" alt="Inventory" />
                </div>
                <div className="tab-label text-white">Inventory</div>
              </div>
            </Link>
          </div>

          {/* Row 4: Crafting, Factions, Precepts (Placeholders) */}
          <div className="cx-tabs">
            {/* Crafting */}
            <div className="cx-tab opacity-50">
              <div className="tab-icon">
                <img src="/icon_crest.png" alt="Crafting" />
              </div>
              <div className="tab-label text-white">Crafting</div>
            </div>

            {/* Factions */}
            <div className="cx-tab opacity-50">
              <div className="tab-icon">
                <img src="/icon_crest.png" alt="Factions" />
              </div>
              <div className="tab-label text-white">Factions</div>
            </div>

            {/* Precepts */}
            <div className="cx-tab opacity-50">
              <div className="tab-icon">
                <img src="/icon_crest.png" alt="Precepts" />
              </div>
              <div className="tab-label text-white">Precepts</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default NavDrawer;
