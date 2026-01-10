import React from 'react';
import { CxCard } from './CxShared';

interface GigCardProps {
  gig: any;
  isNew?: boolean;
  showDetails?: boolean;
  className?: string;
}

const GigCard: React.FC<GigCardProps> = ({ gig, isNew = false, showDetails = false, className = '' }) => {
  const statusNorm = String(gig.status ?? '').toUpperCase();

  return (
    <div>
      <CxCard className={`cursor-pointer hover:opacity-90 transition-opacity relative ${className}`}>
        {gig.status && (
          <div className={`absolute -top-2 -right-2 z-10 px-2 py-0.5 text-xs font-bold rounded-full ${statusNorm === 'COMPLETED' ? 'bg-bright-green text-black' : (statusNorm === 'IN PROGRESS' || statusNorm === 'STARTED') ? 'bg-yellow-400 text-black' : 'bg-gray-600 text-white'}`}>
            {gig.status}
          </div>
        )}

        <div className="flex flex-row items-start gap-4">
          <div className="w-20 h-20 bg-gray-700 rounded overflow-hidden flex-shrink-0 relative">
            {gig.image_url ? (
              <img src={gig.image_url} alt={gig.title || gig.gig_code} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-2xl">
                {(gig.title || gig.gig_code || '').charAt(0)}
              </div>
            )}

            {(statusNorm === 'STARTED' || statusNorm === 'IN PROGRESS') && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="w-3/4 h-3/4 flex items-center justify-center text-yellow-400">
                  <svg viewBox="0 0 120 120" className="w-full h-full" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="30" cy="60" r="12" />
                    <circle cx="60" cy="60" r="12" />
                    <circle cx="90" cy="60" r="12" />
                  </svg>
                </div>
              </div>
            )}

            {(statusNorm === 'COMPLETED' || statusNorm === 'COMPLETE') && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="w-3/4 h-3/4 flex items-center justify-center text-blue-500">
                  <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="32" cy="32" r="28" />
                    <path d="M20 34l8 8 16-20" />
                  </svg>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col justify-between min-h-[80px]">
            <div>
              <div className="card-title uppercase relative">
                {gig.title || gig.gig_code}
                {isNew ? (
                  <span className="pill pill-alert pill-alert-pulse absolute -top-2 right-0 z-10">NEW</span>
                ) : null}
              </div>

              <div className="mt-1 text-gray-300">{gig.description}</div>

              {showDetails && (
                <>
                  <div className="mt-2">
                    <span className="meta-heading text-sm">Objectives:</span>{' '}
                    <div className="mt-1">
                      {gig.objectives && gig.objectives.length > 0 ? (
                        <ul className="list-disc ml-6">
                          {gig.objectives.map((obj: string, i: number) => (
                            <li key={i} className="text-blue-400">{obj}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-gray-400">No objectives</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2">
                    <span className="meta-heading text-sm">Reward:</span>{' '}
                    <span className="text-bright-green">{gig.reward_credits ?? 0} CX</span>
                  </div>
                </>
              )}
            </div>

            <div className="mt-3">
              <a href={`/gigs/${gig.id}`} className="inline-block w-full">
                <button className="btn-cx btn-cx-primary btn-cx-full">VIEW GIG</button>
              </a>
            </div>
          </div>
        </div>
      </CxCard>
    </div>
  );
};

export default GigCard;
