/**
 * Item-related utility functions for gear and inventory
 */

/**
 * Get color class for item type badge
 */
export function getItemTypeColor(itemType: string): string {
  const colors: { [key: string]: string } = {
    weapon: 'text-red-400',
    armor: 'text-blue-400',
    accessory: 'text-purple-400',
    consumable: 'text-green-400',
    material: 'text-yellow-400',
    tool: 'text-cyan-400',
    cyberdeck: 'text-fuschia',
    peripheral: 'text-bright-blue',
    slimsoft: 'text-bright-green',
  };
  return colors[itemType.toLowerCase()] || 'text-gray-400';
}

/**
 * Get border class for item card based on equipped status
 */
export function getItemBorderClass(item: { is_equipped?: boolean | number }): string {
  if (item.is_equipped === true || item.is_equipped === 1) {
    return 'border-2 border-bright-blue';
  }
  return 'border border-charcoal';
}

/**
 * Get rarity color class
 */
export function getRarityColor(rarity?: string): string {
  if (!rarity) return 'text-gray-400';
  
  const colors: { [key: string]: string } = {
    common: 'text-gray-400',
    uncommon: 'text-green-400',
    rare: 'text-blue-400',
    epic: 'text-purple-400',
    legendary: 'text-yellow-400',
  };
  return colors[rarity.toLowerCase()] || 'text-gray-400';
}
