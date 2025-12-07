/**
 * Script to automatically update zone image_url fields based on district names
 * Matches images in /public/images/ starting with "City_-_" to district names
 */

import { getDbPool } from '../src/lib/db';
import * as fs from 'fs';
import * as path from 'path';

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

async function updateZoneImages() {
  console.log('🚀 Starting zone image update process...\n');

  try {
    // 1. Get image files from /public/images/
    const imagesDir = path.join(process.cwd(), 'public', 'images');
    const allFiles = fs.readdirSync(imagesDir);
    const cityImages = allFiles.filter(file => file.startsWith('City_-_'));
    
    console.log(`📁 Found ${cityImages.length} City images:`);
    cityImages.forEach(img => console.log(`   - ${img}`));
    console.log('');

    // 2. Connect to database
    const pool = await getDbPool();

    // 3. Get all districts
    const [districtRows] = await pool.execute<any[]>(
      'SELECT id, name FROM zone_districts ORDER BY name'
    );
    const districts = districtRows as District[];
    
    console.log(`🏙️  Found ${districts.length} districts:`);
    districts.forEach(d => console.log(`   - ${d.name} (ID: ${d.id})`));
    console.log('');

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
    
    console.log(`📍 Found ${zones.length} zones\n`);

    // 5. Create mapping of district names to image URLs
    const districtImageMap = new Map<string, string>();
    
    for (const imageFile of cityImages) {
      // Extract district name from filename: "City_-_annex.png" -> "annex"
      const districtNameFromFile = imageFile
        .replace('City_-_', '')
        .replace('.png', '')
        .toLowerCase();
      
      // Try to match with district names (case-insensitive)
      for (const district of districts) {
        const districtNameLower = district.name.toLowerCase().replace(/\s+/g, '');
        const fileNameClean = districtNameFromFile.replace(/\s+/g, '');
        
        if (districtNameLower === fileNameClean || 
            districtNameLower.includes(fileNameClean) ||
            fileNameClean.includes(districtNameLower)) {
          const imageUrl = `/images/${imageFile}`;
          districtImageMap.set(district.name, imageUrl);
          console.log(`✅ Matched: "${district.name}" -> ${imageUrl}`);
        }
      }
    }
    console.log('');

    // 6. Update zones with matching images
    let updateCount = 0;
    let skippedCount = 0;

    for (const zone of zones) {
      const imageUrl = districtImageMap.get(zone.district_name);
      
      if (imageUrl && zone.image_url !== imageUrl) {
        // Update the zone
        await pool.execute(
          'UPDATE zones SET image_url = ? WHERE id = ?',
          [imageUrl, zone.id]
        );
        console.log(`🔄 Updated zone "${zone.name}" (${zone.district_name}): ${imageUrl}`);
        updateCount++;
      } else if (!imageUrl) {
        console.log(`⚠️  No image found for zone "${zone.name}" in district "${zone.district_name}"`);
        skippedCount++;
      } else {
        console.log(`✓  Zone "${zone.name}" already has correct image`);
        skippedCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✨ Update complete!`);
    console.log(`   Updated: ${updateCount} zones`);
    console.log(`   Skipped: ${skippedCount} zones`);
    console.log('='.repeat(60));

    // Close the pool
    await pool.end();

  } catch (error) {
    console.error('❌ Error updating zone images:', error);
    process.exit(1);
  }
}

// Run the script
updateZoneImages().then(() => {
  console.log('\n✅ Script completed successfully');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Script failed:', error);
  process.exit(1);
});
