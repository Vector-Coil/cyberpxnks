import React from 'react';

interface ZoneCardProps {
  zone: {
    id: number;
    name: string;
    zone_type: number;
    zone_type_name?: string;
    district_name?: string;
    image_url?: string;
    shop_count?: number;
    terminal_count?: number;
  };
  isCurrentLocation?: boolean;
  href?: string;
}

export default function ZoneCard({ zone, isCurrentLocation = false, href }: ZoneCardProps) {
  const card = (
    <div 
      className={`cx-banner ${isCurrentLocation ? 'ring-2 ring-cyan-400 shadow-lg shadow-cyan-400/50' : ''}`}
      style={zone.image_url ? { 
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url(${zone.image_url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      } : undefined}
    >
      <div className="banner-left flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {zone.district_name && (
              <span className="px-2 py-1 bg-fuschia text-white text-xs font-bold uppercase rounded flex-shrink-0">
                {zone.district_name}
              </span>
            )}
          </div>
          <span className="pill-cloud-gray uppercase flex-shrink-0">{zone.zone_type_name || zone.zone_type}</span>
        </div>
        <div className="flex items-end justify-between gap-2">
          <div className="text-white font-bold uppercase text-lg flex items-center gap-2">
            {isCurrentLocation && (
              <span className="material-symbols-outlined text-cyan-400" style={{ fontSize: '20px' }}>location_on</span>
            )}
            {zone.name}
          </div>
          {/* POI Indicators */}
          {((zone.terminal_count || 0) > 0 || (zone.shop_count || 0) > 0) && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {(zone.terminal_count || 0) > 0 && (
                <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-black/60 rounded text-xs">
                  <span className="material-symbols-outlined text-cyan-400" style={{ fontSize: '14px' }}>terminal</span>
                  <span className="text-cyan-400 font-semibold">{zone.terminal_count}</span>
                </div>
              )}
              {(zone.shop_count || 0) > 0 && (
                <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-black/60 rounded text-xs">
                  <span className="material-symbols-outlined text-green-400" style={{ fontSize: '14px' }}>storefront</span>
                  <span className="text-green-400 font-semibold">{zone.shop_count}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block">
        {card}
      </a>
    );
  }

  return card;
}
