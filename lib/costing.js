/**
 * lib/costing.js — Inventory Costing, Valuation (WAC), & Barcode Resolution Service
 * 
 * Implements:
 * 1. Moving Weighted Average Cost (WAC) calculations
 * 2. Sale-level financial snapshotting (COGS, Gross Profit, Margin %)
 * 3. Barcode resolution and uniqueness validation
 * 4. Pluggable Costing Strategy interface for future FIFO/Batch support
 */

/**
 * Calculates new Moving Weighted Average Cost (WAC) when receiving fresh inventory stock.
 * Formula: ((currentStock * currentCost) + (addedQty * newBatchCost)) / (currentStock + addedQty)
 * 
 * @param {number} currentStock - Existing units in stock before restock
 * @param {number} currentCost - Existing unit purchase price (WAC)
 * @param {number} addedQty - Incoming quantity being added
 * @param {number} newBatchCost - Purchase price per unit for the new batch
 * @returns {number} Updated unit purchase price rounded to 2 decimal places
 */
export function computeWAC(currentStock, currentCost, addedQty, newBatchCost) {
  const stock = Number(currentStock) || 0;
  const cost = Number(currentCost) || 0;
  const addQty = Number(addedQty) || 0;
  const addCost = Number(newBatchCost) || 0;

  if (addQty <= 0) return Math.round(cost * 100) / 100;
  
  // If no prior stock or prior cost was zero/unset, adoption of new batch cost
  if (stock <= 0 || cost <= 0) {
    return Math.round(addCost * 100) / 100;
  }

  const currentValuation = stock * cost;
  const incomingValuation = addQty * addCost;
  const totalQty = stock + addQty;

  const blendedUnitCost = (currentValuation + incomingValuation) / totalQty;
  return Math.round(blendedUnitCost * 100) / 100;
}

/**
 * Calculates unit profit and profit margin percentage for an item.
 * 
 * @param {number} sellingPrice - Selling price (MRP)
 * @param {number} purchasePrice - Unit cost / purchase price
 * @returns {{ profit: number, marginPct: number }}
 */
export function calculateUnitMargin(sellingPrice, purchasePrice) {
  const sp = Number(sellingPrice) || 0;
  const pp = Number(purchasePrice) || 0;
  const profit = Math.round((sp - pp) * 100) / 100;
  const marginPct = sp > 0 ? Math.round(((profit / sp) * 100) * 10) / 10 : 0;
  return { profit, marginPct };
}

/**
 * Calculates Cost of Goods Sold (COGS), Gross Profit, and Profit Margin %
 * for a sale bill snapshot.
 * 
 * @param {Array<Object>} cartItems - Array of cart item rows
 * @param {number} totalSaleAmount - Final payable amount of the sale (after discounts)
 * @returns {{ cogs: number, gross_profit: number, profit_margin_pct: number }}
 */
export function calculateSaleFinancials(cartItems, totalSaleAmount) {
  const total = Number(totalSaleAmount) || 0;
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return { cogs: 0, gross_profit: total, profit_margin_pct: total > 0 ? 100 : 0 };
  }

  // Sum line costs
  const cogsRaw = cartItems.reduce((acc, item) => {
    const qty = Number(item.qty || item.quantity || 0);
    const purchasePrice = Number(item.purchase_price || 0);
    return acc + (qty * purchasePrice);
  }, 0);

  const cogs = Math.round(cogsRaw * 100) / 100;
  const grossProfit = Math.round((total - cogs) * 100) / 100;
  const profitMarginPct = total > 0 ? Math.round(((grossProfit / total) * 100) * 100) / 100 : 0;

  return {
    cogs,
    gross_profit: grossProfit,
    profit_margin_pct: profitMarginPct
  };
}

/**
 * Looks up an inventory item by its exact barcode.
 * Handles both item-level and variant-level barcodes.
 * 
 * @param {Array<Object>} inventory - Array of inventory items
 * @param {string} barcode - Barcode to search
 * @returns {Object|null} Matching inventory item (and variant info if applicable)
 */
export function findItemByBarcode(inventory, barcode) {
  if (!barcode || !Array.isArray(inventory)) return null;
  const code = String(barcode).trim();
  if (!code) return null;

  for (const item of inventory) {
    // 1. Direct item barcode match
    if (item.barcode && String(item.barcode).trim() === code) {
      return { item, variant: null };
    }

    // 2. Multi-dimensional variant barcode match (if present)
    if (item.has_colors && Array.isArray(item.variants)) {
      const matchedVariant = item.variants.find(v => v.barcode && String(v.barcode).trim() === code);
      if (matchedVariant) {
        return { item, variant: matchedVariant, variantType: 'color_variant' };
      }
    }

    // 3. Size map barcode match (if present)
    if (item.hasSizes && item.sizes && typeof item.sizes === 'object') {
      for (const [key, sizeObj] of Object.entries(item.sizes)) {
        if (sizeObj && sizeObj.barcode && String(sizeObj.barcode).trim() === code) {
          return { item, variant: sizeObj, sizeKey: key, variantType: 'size_variant' };
        }
      }
    }
  }

  return null;
}

/**
 * Checks if a barcode is already used by another inventory item or variant.
 * 
 * @param {Array<Object>} inventory - Array of inventory items
 * @param {string} barcode - Barcode string to validate
 * @param {string|null} currentItemId - Current item ID being edited (to exclude self)
 * @returns {boolean} True if barcode is already claimed by another item
 */
export function isBarcodeDuplicate(inventory, barcode, currentItemId = null) {
  if (!barcode || !Array.isArray(inventory)) return false;
  const code = String(barcode).trim();
  if (!code) return false;

  for (const it of inventory) {
    if (currentItemId && it.id === currentItemId) continue;

    // Check item-level barcode
    if (it.barcode && String(it.barcode).trim() === code) {
      return true;
    }

    // Check variants
    if (it.has_colors && Array.isArray(it.variants)) {
      if (it.variants.some(v => v.barcode && String(v.barcode).trim() === code)) {
        return true;
      }
    }
    if (it.hasSizes && it.sizes && typeof it.sizes === 'object') {
      if (Object.values(it.sizes).some(s => s && s.barcode && String(s.barcode).trim() === code)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Costing Strategy Router (Strategy Pattern)
 */
export class WACCostingStrategy {
  calculateRestockCost(currentStock, currentCost, addedQty, newBatchCost) {
    return computeWAC(currentStock, currentCost, addedQty, newBatchCost);
  }

  resolveSaleCOGS(cartItems, totalSaleAmount) {
    return calculateSaleFinancials(cartItems, totalSaleAmount);
  }
}

const STRATEGIES = {
  wac: new WACCostingStrategy()
};

export function getCostingStrategy(method = 'wac') {
  return STRATEGIES[method] || STRATEGIES.wac;
}
