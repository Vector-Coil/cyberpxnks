'use client';

import React from 'react';

interface MeterData {
    label: string;
    current: number;
    max: number;
    color: string;
}

interface CompactMeterStripProps {
    meters: MeterData[];
}

const CompactMeterStrip: React.FC<CompactMeterStripProps> = ({ meters }) => {
    return (
        <div className="compact-meter-strip bg-gray-900/80 border-b border-gray-700/50 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-4 py-2">
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    {meters.map((meter, index) => {
                        const fillPercentage = meter.max > 0 ? Math.min(100, (meter.current / meter.max) * 100) : 0;
                        const fillStyle = { width: `${fillPercentage}%` };

                        let meterColor = meter.color;
                        if (meter.label.includes("THERMAL") || meter.label.includes("NEURAL")) {
                            if (fillPercentage >= 70) meterColor = 'bg-red-500';
                            else meterColor = 'bg-lime-400';
                        }

                        // Custom label mapping for specific meters
                        const getAbbreviation = (label: string) => {
                            if (label === "THERMAL") return "THRM";
                            if (label === "CHARGE") return "CHRG";
                            return label.slice(0, 4);
                        };

                        return (
                            <div key={index} className="flex flex-col space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-mono font-semibold text-fuchsia-300 uppercase tracking-tight">
                                        {getAbbreviation(meter.label)}
                                    </span>
                                    <span className="text-xs font-mono text-gray-400">
                                        {meter.current}/{meter.max}
                                    </span>
                                </div>
                                <div className="h-1.5 bg-gray-700/50 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full ${meterColor} rounded-full transition-all duration-700`} 
                                        style={fillStyle}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default CompactMeterStrip;
