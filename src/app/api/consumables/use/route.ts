import { NextRequest, NextResponse } from 'next/server';
import { getDbPool, logActivity } from '../../../../lib/db';
import { StatsService } from '../../../../lib/statsService';
import { requireParams, handleApiError } from '../../../../lib/api/errors';
import { logger } from '../../../../lib/logger';
import { getUserIdByFid } from '../../../../lib/api/userUtils';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fidParam = searchParams.get('fid');
    const fid = fidParam ? parseInt(fidParam, 10) : 300187;

    if (Number.isNaN(fid)) {
      return NextResponse.json({ error: 'Invalid fid parameter' }, { status: 400 });
    }

    const body = await request.json();
    requireParams(body, ['itemId']);
    const { itemId } = body;

    const pool = await getDbPool();
    const userId = await getUserIdByFid(pool, fid);

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Verify user owns the item
      const [inventoryRows] = await connection.execute<any[]>(
        `SELECT ui.quantity, i.name, i.item_type
         FROM user_inventory ui
         INNER JOIN items i ON ui.item_id = i.id
         WHERE ui.user_id = ? AND ui.item_id = ?
         LIMIT 1`,
        [userId, itemId]
      );

      const inventoryItem = (inventoryRows as any[])[0];

      logger.info('Consumable use - inventory check', { 
        userId, 
        itemId, 
        quantity: inventoryItem?.quantity,
        name: inventoryItem?.name 
      });

      if (!inventoryItem) {
        await connection.rollback();
        connection.release();
        return NextResponse.json({ error: 'Item not found in inventory' }, { status: 404 });
      }

      if (inventoryItem.quantity < 1) {
        await connection.rollback();
        connection.release();
        return NextResponse.json({ error: 'No items available to use' }, { status: 400 });
      }

      // Get all effects for this consumable
      const [effectRows] = await connection.execute<any[]>(
        `SELECT effect_type, effect_value, duration_minutes, description
         FROM consumable_effects
         WHERE item_id = ?`,
        [itemId]
      );

      if ((effectRows as any[]).length === 0) {
        await connection.rollback();
        connection.release();
        return NextResponse.json({ error: 'Item has no effects defined' }, { status: 400 });
      }

      const effects = effectRows as any[];
      const appliedEffects: string[] = [];

      // Apply each effect
      for (const effect of effects) {
        if (effect.duration_minutes) {
          // Temporary buff - add to active_consumable_buffs
          const expiresAt = new Date(Date.now() + effect.duration_minutes * 60 * 1000);
          
          await connection.execute(
            `INSERT INTO active_consumable_buffs 
             (user_id, item_id, effect_type, effect_value, expires_at)
             VALUES (?, ?, ?, ?, ?)`,
            [userId, itemId, effect.effect_type, effect.effect_value, expiresAt]
          );

          appliedEffects.push(`+${effect.effect_value} ${effect.effect_type} for ${effect.duration_minutes}min`);
        } else {
          // Instant effect - apply immediately
          const statsService = new StatsService(connection as any, userId);
          
          switch (effect.effect_type) {
            case 'restore_stamina':
              await statsService.modifyStats({ stamina: effect.effect_value });
              appliedEffects.push(`Restored ${effect.effect_value} stamina`);
              break;
            case 'restore_consciousness':
              await statsService.modifyStats({ consciousness: effect.effect_value });
              appliedEffects.push(`Restored ${effect.effect_value} consciousness`);
              break;
            case 'restore_charge':
              await statsService.modifyStats({ charge: effect.effect_value });
              appliedEffects.push(`Restored ${effect.effect_value} charge`);
              break;
            case 'restore_neural':
              await statsService.modifyStats({ neural: -effect.effect_value }); // Negative to reduce load
              appliedEffects.push(`Reduced neural load by ${effect.effect_value}`);
              break;
            case 'restore_thermal':
              await statsService.modifyStats({ thermal: -effect.effect_value }); // Negative to reduce load
              appliedEffects.push(`Reduced thermal load by ${effect.effect_value}`);
              break;
            case 'restore_bandwidth':
              await statsService.modifyStats({ bandwidth: effect.effect_value });
              appliedEffects.push(`Restored ${effect.effect_value} bandwidth`);
              break;
            case 'increase_neural':
              await statsService.modifyStats({ neural: effect.effect_value });
              appliedEffects.push(`Increased neural load by ${effect.effect_value}`);
              break;
            case 'increase_thermal':
              await statsService.modifyStats({ thermal: effect.effect_value });
              appliedEffects.push(`Increased thermal load by ${effect.effect_value}`);
              break;
            default:
              logger.warn('Unknown instant effect type', { effect_type: effect.effect_type });
          }
        }
      }

      // Decrement quantity
      if (inventoryItem.quantity === 1) {
        // Remove from inventory
        await connection.execute(
          'DELETE FROM user_inventory WHERE user_id = ? AND item_id = ?',
          [userId, itemId]
        );
      } else {
        // Decrement quantity
        await connection.execute(
          'UPDATE user_inventory SET quantity = quantity - 1 WHERE user_id = ? AND item_id = ?',
          [userId, itemId]
        );
      }

      // Log activity
      await logActivity(
        userId,
        'consumable',
        'used',
        0,
        itemId,
        `Used ${inventoryItem.name}: ${appliedEffects.join(', ')}`
      );

      await connection.commit();
      connection.release();

      logger.info('Consumable used successfully', {
        userId,
        itemId,
        quantityBefore: parseInt(inventoryItem.quantity, 10),
        quantityAfter: parseInt(inventoryItem.quantity, 10) - 1
      });

      return NextResponse.json({
        success: true,
        item: inventoryItem.name,
        effects: appliedEffects,
        remainingQuantity: parseInt(inventoryItem.quantity, 10) - 1,
        quantityBefore: parseInt(inventoryItem.quantity, 10)
      });

    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  } catch (err: any) {
    return handleApiError(err, 'Failed to use consumable');
  }
}
