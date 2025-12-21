import { NextResponse } from 'next/server';
import { getDbPool } from '../../../../lib/db';
import { handleApiError } from '../../../../lib/api/errors';
import { logger } from '../../../../lib/logger';

export async function POST() {
  try {
    logger.info('Starting district image migration from zones table');

    const pool = await getDbPool();

    // Step 1: Update zone_districts.image_url by concatenating CDN URL with zones.image_url
    const [updateResult] = await pool.execute<any>(
      `UPDATE zone_districts zd
       INNER JOIN (
         SELECT 
           z.district,
           MIN(z.id) as first_zone_id
         FROM zones z
         WHERE z.image_url IS NOT NULL AND z.image_url != ''
         GROUP BY z.district
       ) first_zones ON zd.id = first_zones.district
       INNER JOIN zones z ON z.id = first_zones.first_zone_id
       SET zd.image_url = CONCAT('https://vectorcoil.com/cx', z.image_url)
       WHERE zd.image_url IS NULL OR zd.image_url = ''`
    );

    const rowsUpdated = (updateResult as any).affectedRows || 0;
    logger.info('District images updated', { rowsUpdated });

    // Step 2: Verify the migration
    const [districts] = await pool.execute<any[]>(
      `SELECT 
         zd.id,
         zd.name as district_name,
         zd.image_url as district_image,
         COUNT(z.id) as zone_count
       FROM zone_districts zd
       LEFT JOIN zones z ON z.district = zd.id
       GROUP BY zd.id, zd.name, zd.image_url
       ORDER BY zd.name`
    );

    // Step 3: Check for districts still missing images
    const [missingImages] = await pool.execute<any[]>(
      `SELECT 
         zd.id,
         zd.name,
         COUNT(z.id) as zone_count
       FROM zone_districts zd
       LEFT JOIN zones z ON z.district = zd.id
       WHERE zd.image_url IS NULL OR zd.image_url = ''
       GROUP BY zd.id, zd.name
       ORDER BY zd.name`
    );

    logger.info('Migration complete', {
      totalDistricts: districts.length,
      districtsWithImages: districts.filter((d: any) => d.district_image).length,
      districtsMissingImages: missingImages.length
    });

    return NextResponse.json({
      success: true,
      rowsUpdated,
      totalDistricts: districts.length,
      districtsWithImages: districts.filter((d: any) => d.district_image).length,
      districtsMissingImages: missingImages.length,
      districts,
      missingImages
    });

  } catch (err: any) {
    logger.error('District image migration failed', { error: err.message, stack: err.stack });
    return handleApiError(err, 'Failed to migrate district images');
  }
}
