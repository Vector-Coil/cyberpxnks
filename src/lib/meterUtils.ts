// Meter utility functions for CompactMeterStrip

interface MeterData {
    label: string;
    current: number;
    max: number;
    color: string;
}

interface UserStatsData {
    current_consciousness?: number;
    max_consciousness?: number;
    current_stamina?: number;
    max_stamina?: number;
    current_charge?: number;
    max_charge?: number;
    current_thermal?: number;
    max_thermal?: number;
    current_bandwidth?: number;
    max_bandwidth?: number;
    current_neural?: number;
    max_neural?: number;
}

export const getMeterData = (stats: UserStatsData | null): MeterData[] => {
    if (!stats) {
        return [
            { label: "CONSCIOUSNESS", current: 0, max: 100, color: 'bg-red-500' },
            { label: "STAMINA", current: 0, max: 100, color: 'bg-orange-500' },
            { label: "CHARGE", current: 0, max: 500, color: 'bg-green-500' },
            { label: "THERMAL", current: 0, max: 100, color: 'bg-blue-500' },
            { label: "BANDWIDTH", current: 0, max: 200, color: 'bg-cyan-500' },
            { label: "NEURAL", current: 0, max: 100, color: 'bg-purple-500' }
        ];
    }

    return [
        { label: "CONSCIOUSNESS", current: stats.current_consciousness || 0, max: stats.max_consciousness || 100, color: 'bg-red-500' },
        { label: "STAMINA", current: stats.current_stamina || 0, max: stats.max_stamina || 100, color: 'bg-orange-500' },
        { label: "CHARGE", current: stats.current_charge || 0, max: stats.max_charge || 500, color: 'bg-green-500' },
        { label: "THERMAL", current: stats.current_thermal || 0, max: stats.max_thermal || 100, color: 'bg-blue-500' },
        { label: "BANDWIDTH", current: stats.current_bandwidth || 0, max: stats.max_bandwidth || 200, color: 'bg-cyan-500' },
        { label: "NEURAL", current: stats.current_neural || 0, max: stats.max_neural || 100, color: 'bg-purple-500' }
    ];
};
