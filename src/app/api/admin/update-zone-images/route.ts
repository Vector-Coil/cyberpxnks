import { NextResponse } from 'next/server';
import { getDbPool } from '../../../../lib/db';
import * as fs from 'fs';
import * as path from 'path';
import { handleApiError } from '../../../../lib/api/errors';
import { logger } from '../../../../lib/logger';

interface District {
  id: number;
  name: string;
}

interface Zone {
  id: number;
  name: string;
  district: number;
  district_name: string;
  image_url: string | null;
}

export async function POST() {
  try {
    logger.info('Starting zone image update process');

    // 1. Get image files from /public/images/
    const imagesDir = path.join(process.cwd(), 'public', 'images');
    const allFiles = fs.readdirSync(imagesDir);
    const cityImages = allFiles.filter(file => file.startsWith('City_-_'));
    
    logger.info('Found City images', { count: cityImages.length });

    // 2. Connect to database
    const pool = await getDbPool();

    // 3. Get all districts
    const [districtRows] = await pool.execute<any[]>(
      'SELECT id, name FROM zone_districts ORDER BY name'
    );
    const districts = districtRows as District[];
    
    logger.info('Found districts', { count: districts.length });

    // 4. Get all zones with their districts
    const [zoneRows] = await pool.execute<any[]>(`
      SELECT 
        z.id,
        z.name,
        z.district,
        z.image_url,
        zd.name as district_name
      FROM zones z
      LEFT JOIN zone_districts zd ON z.district = zd.id
      ORDER BY z.district, z.name
    `);
    const zones = zoneRows as Zone[];
    
    logger.info('Found zones', { count: zones.length });

    // 5. Create mapping of district names to image URLs
    const districtImageMap = new Map<string, string>();
    const matches: string[] = [];
    
    // Manual mappings for specific districts
    const manualMappings: Record<string, string> = {
      'Selica City Center': '/images/City_-_core.png',
      'Skylark': '/images/City_-_southeast.png'
    };
    
    // Add manual mappings first
    for (const district of districts) {
      if (manualMappings[district.name]) {
        districtImageMap.set(district.name, manualMappings[district.name]);
        matches.push(`✅ Matched (manual): "${district.name}" -> ${manualMappings[district.name]}`);
      }
    }
    
    for (const imageFile of cityImages) {
      // Extract district name from filename: "City_-_annex.png" -> "annex"
      const districtNameFromFile = imageFile
        .replace('City_-_', '')
        .replace('.png', '')
        .toLowerCase();
      
      // Try to match with district names (case-insensitive)
      for (const district of districts) {
        // Skip if already manually mapped
        if (districtImageMap.has(district.name)) continue;
        
        const districtNameLower = district.name.toLowerCase().replace(/\s+/g, '');
        const fileNameClean = districtNameFromFile.replace(/\s+/g, '');
        
        if (districtNameLower === fileNameClean || 
            districtNameLower.includes(fileNameClean) ||
            fileNameClean.includes(districtNameLower)) {
          const imageUrl = `/images/${imageFile}`;
          districtImageMap.set(district.name, imageUrl);
          matches.push(`✅ Matched: "${district.name}" -> ${imageUrl}`);
        }
      }
    }

    // 6. Update zones with matching images
    const updates: string[] = [];
    const skipped: string[] = [];
    let updateCount = 0;

    for (const zone of zones) {
      const imageUrl = districtImageMap.get(zone.district_name);
      
      if (imageUrl && zone.image_url !== imageUrl) {
        // Update the zone
        await pool.execute(
          'UPDATE zones SET image_url = ? WHERE id = ?',
          [imageUrl, zone.id]
        );
        updates.push(`🔄 Updated zone "${zone.name}" (${zone.district_name}): ${imageUrl}`);
        updateCount++;
      } else if (!imageUrl) {
        skipped.push(`⚠️  No image found for zone "${zone.name}" in district "${zone.district_name}"`);
      } else {
        skipped.push(`✓  Zone "${zone.name}" already has correct image`);
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalImages: cityImages.length,
        totalDistricts: districts.length,
        totalZones: zones.length,
        matchesFound: districtImageMap.size,
        zonesUpdated: updateCount,
        zonesSkipped: skipped.length
      },
      details: {
        matches,
        updates,
        skipped
      }
    });

  } catch (error: any) {
    return handleApiError(error, 'Failed to update zone images');
  }
}
