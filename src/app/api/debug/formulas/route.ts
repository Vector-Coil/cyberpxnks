import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../lib/db';
import { StatsService } from '../../../../lib/statsService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = parseInt(searchParams.get('fid') || '300187', 10);

    const pool = await getDbPool();
    
    // Get complete stats
    const stats = await StatsService.getStatsByFid(pool, fid);
    
    // Get raw database values for comparison
    const [userRows] = await pool.execute(
      `SELECT 
        u.id, u.cognition, u.power, u.resilience,
        c.class_clock_speed, c.class_cooling
      FROM users u
      LEFT JOIN classes c ON u.class_id = c.id
      WHERE u.fid = ?`,
      [fid]
    );
    const user = (userRows as any[])[0];

    // Manual formula calculations
    const formulas = {
      // User Attributes
      cognition: stats.attributes.cognition,
      power: stats.attributes.power,
      resilience: stats.attributes.resilience,
      
      // Class Base Stats
      base_clock_speed: user.class_clock_speed,
      base_cooling: user.class_cooling,
      
      // Hardware Modifiers
      hw_processor: stats.hardware.processor,
      hw_heat_sink: stats.hardware.heat_sink,
      hw_cell_capacity: stats.hardware.cell_capacity,
      hw_memory: stats.hardware.memory,
      hw_lifi: stats.hardware.lifi,
      
      // Step 1: Calculate Tech Stats
      tech_clock_speed: {
        formula: 'base_clock_speed + hw_processor',
        calculation: `${user.class_clock_speed} + ${stats.hardware.processor}`,
        result: stats.tech.clock_speed,
        expected: user.class_clock_speed + stats.hardware.processor
      },
      tech_cooling: {
        formula: 'base_cooling + hw_heat_sink',
        calculation: `${user.class_cooling} + ${stats.hardware.heat_sink}`,
        result: stats.tech.cooling,
        expected: user.class_cooling + stats.hardware.heat_sink
      },
      tech_cache: {
        formula: 'base_cache + hw_memory',
        result: stats.tech.cache
      },
      
      // Step 2: Calculate Max Stats
      max_consciousness: {
        formula: 'cognition × resilience',
        calculation: `${stats.attributes.cognition} × ${stats.attributes.resilience}`,
        result: stats.max.consciousness,
        expected: stats.attributes.cognition * stats.attributes.resilience
      },
      max_stamina: {
        formula: 'power × resilience',
        calculation: `${stats.attributes.power} × ${stats.attributes.resilience}`,
        result: stats.max.stamina,
        expected: stats.attributes.power * stats.attributes.resilience
      },
      max_charge: {
        formula: 'tech_clock_speed + hw_cell_capacity',
        calculation: `${stats.tech.clock_speed} + ${stats.hardware.cell_capacity}`,
        result: stats.max.charge,
        expected: stats.tech.clock_speed + stats.hardware.cell_capacity
      },
      max_thermal: {
        formula: 'tech_clock_speed + tech_cooling',
        calculation: `${stats.tech.clock_speed} + ${stats.tech.cooling}`,
        result: stats.max.thermal,
        expected: stats.tech.clock_speed + stats.tech.cooling,
        note: 'tech_cooling already includes hw_heat_sink'
      },
      max_neural: {
        formula: 'tech_clock_speed + tech_cooling',
        calculation: `${stats.tech.clock_speed} + ${stats.tech.cooling}`,
        result: stats.max.neural,
        expected: stats.tech.clock_speed + stats.tech.cooling,
        note: 'Same as thermal'
      },
      max_bandwidth: {
        formula: 'floor(((hw_processor + hw_memory) × ((tech_clock_speed + tech_cache) / tech_latency)) / hw_lifi)',
        calculation: `floor(((${stats.hardware.processor} + ${stats.hardware.memory}) × ((${stats.tech.clock_speed} + ${stats.tech.cache}) / ${stats.tech.latency})) / ${stats.hardware.lifi})`,
        result: stats.max.bandwidth,
        expected: Math.floor(
          ((stats.hardware.processor + stats.hardware.memory) * 
           ((stats.tech.clock_speed + stats.tech.cache) / (stats.tech.latency || 1))) / 
          (stats.hardware.lifi || 1)
        )
      }
    };

    // Check for discrepancies
    const issues: string[] = [];
    
    if (formulas.tech_clock_speed.result !== formulas.tech_clock_speed.expected) {
      issues.push(`tech_clock_speed mismatch: ${formulas.tech_clock_speed.result} !== ${formulas.tech_clock_speed.expected}`);
    }
    if (formulas.tech_cooling.result !== formulas.tech_cooling.expected) {
      issues.push(`tech_cooling mismatch: ${formulas.tech_cooling.result} !== ${formulas.tech_cooling.expected}`);
    }
    if (formulas.max_consciousness.result !== formulas.max_consciousness.expected) {
      issues.push(`max_consciousness mismatch: ${formulas.max_consciousness.result} !== ${formulas.max_consciousness.expected}`);
    }
    if (formulas.max_stamina.result !== formulas.max_stamina.expected) {
      issues.push(`max_stamina mismatch: ${formulas.max_stamina.result} !== ${formulas.max_stamina.expected}`);
    }
    if (formulas.max_charge.result !== formulas.max_charge.expected) {
      issues.push(`max_charge mismatch: ${formulas.max_charge.result} !== ${formulas.max_charge.expected}`);
    }
    if (formulas.max_thermal.result !== formulas.max_thermal.expected) {
      issues.push(`max_thermal mismatch: ${formulas.max_thermal.result} !== ${formulas.max_thermal.expected}`);
    }
    if (formulas.max_neural.result !== formulas.max_neural.expected) {
      issues.push(`max_neural mismatch: ${formulas.max_neural.result} !== ${formulas.max_neural.expected}`);
    }
    if (formulas.max_bandwidth.result !== formulas.max_bandwidth.expected) {
      issues.push(`max_bandwidth mismatch: ${formulas.max_bandwidth.result} !== ${formulas.max_bandwidth.expected}`);
    }

    return NextResponse.json({
      user_id: user.id,
      fid,
      formulas,
      issues: issues.length > 0 ? issues : ['All formulas validated ✓'],
      raw_stats: stats
    });

  } catch (err: any) {
    console.error('Formula debug error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to debug formulas' },
      { status: 500 }
    );
  }
}
