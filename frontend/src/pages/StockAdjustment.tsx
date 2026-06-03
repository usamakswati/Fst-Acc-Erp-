import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  ArrowRightLeft, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  Info,
  Sliders,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

interface StockAdjustmentProps {
  currency: string;
}

export default function StockAdjustment({ currency }: StockAdjustmentProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modal / Form state
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  
  const [warehouse, setWarehouse] = useState('Main Warehouse');
  const [type, setType] = useState('INCREASE'); // INCREASE, DECREASE
  const [quantity, setQuantity] = useState('1');
  const [unitCost, setUnitCost] = useState('0.00');
  const [description, setDescription] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await api.getProducts();
      // Only stock items can be adjusted
      setProducts(data.filter((p: any) => p.type === 'STOCK'));
    } catch (error) {
      console.error('Error loading products for adjustment:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const openAdjustment = (prod: any) => {
    setSelectedProduct(prod);
    setUnitCost(prod.costPrice.toFixed(2));
    setQuantity('1');
    setType('INCREASE');
    setWarehouse('Main Warehouse');
    setDescription('');
    setErrorMsg('');
    setSuccessMsg('');
    setIsAdjusting(true);
  };

  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedProduct) return;

    const qtyVal = parseFloat(quantity);
    const costVal = parseFloat(unitCost) || 0.0;

    if (isNaN(qtyVal) || qtyVal <= 0) {
      setErrorMsg('Quantity must be greater than zero');
      return;
    }
    if (type === 'INCREASE' && costVal < 0) {
      setErrorMsg('Unit cost cannot be negative');
      return;
    }

    // Check stock if doing a decrease
    if (type === 'DECREASE') {
      const currentStock = selectedProduct.warehouseQuantities?.[warehouse] || 0;
      if (currentStock < qtyVal) {
        setErrorMsg(`Insufficient stock in ${warehouse}. Available: ${currentStock}, Requested decrease: ${qtyVal}`);
        return;
      }
    }

    // Set signed quantity (positive for increase, negative for decrease)
    const finalQty = type === 'INCREASE' ? qtyVal : -qtyVal;

    try {
      setSubmitting(true);
      await api.adjustStock(selectedProduct.id, {
        quantity: finalQty,
        unitCost: costVal,
        description: description || `Manual adjustment: ${type}`,
        warehouse
      });

      setSuccessMsg(`Manual stock adjustment posted successfully.`);
      await loadProducts();
      
      setTimeout(() => {
        setIsAdjusting(false);
        setSelectedProduct(null);
        setSuccessMsg('');
      }, 1500);
    } catch (error: any) {
      setErrorMsg(error.message || 'Error posting stock adjustment');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500" />
        <p className="text-slate-400 text-sm font-medium">Loading stock balances...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div>
        <h2 className="text-2xl font-bold text-slate-100 font-sans">Stock Adjustment Hub</h2>
        <p className="text-sm text-slate-400 mt-1">
          Perform audit adjustments, inventory corrections, write-offs, or initial stock setup per warehouse location.
        </p>
      </div>

      {errorMsg && !isAdjusting && (
        <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-lg text-rose-450 flex items-center gap-3 text-sm">
          <AlertTriangle size={18} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Product List */}
      <div className="glass-panel overflow-hidden">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-brand-800 bg-brand-950/60 text-slate-300">
              <th className="px-4 py-3 font-semibold w-32">SKU Code</th>
              <th className="px-4 py-3 font-semibold">Product Name</th>
              <th className="px-4 py-3 font-semibold w-32 text-center text-indigo-400">Valuation Mode</th>
              <th className="px-4 py-3 font-semibold w-40 text-center">Warehouse Stocks</th>
              <th className="px-4 py-3 font-semibold w-28 text-right font-mono">Total Stock</th>
              <th className="px-4 py-3 font-semibold w-28 text-right">Avg Unit Cost</th>
              <th className="px-4 py-3 font-semibold w-28 text-right">Asset Value</th>
              <th className="px-4 py-3 font-semibold w-28 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-900/10">
            {products.map((p) => (
              <tr key={p.id} className="interactive-tr">
                <td className="px-4 py-3 font-mono font-bold text-slate-200">{p.sku}</td>
                <td className="px-4 py-3 font-medium text-slate-300">
                  <div>{p.name}</div>
                  <span className="text-[10px] text-slate-550">Pack: {p.packSize}</span>
                </td>
                <td className="px-4 py-3 text-center text-xs font-semibold text-indigo-400">
                  {p.inventoryValuationMethod === 'FIFO' ? 'FIFO' : 'Weighted Avg'}
                </td>
                <td className="px-4 py-3 text-center text-xs">
                  {p.warehouseQuantities ? (
                    <div className="flex flex-col gap-0.5 text-left font-mono max-w-[140px] mx-auto text-slate-450">
                      <div className="flex justify-between">
                        <span>Main Wh:</span>
                        <span className="font-semibold text-indigo-300">{p.warehouseQuantities["Main Warehouse"] || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Retail Wh:</span>
                        <span className="font-semibold text-emerald-300">{p.warehouseQuantities["Retail Outlet"] || 0}</span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-600">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-slate-200">{p.stockQuantity}</td>
                <td className="px-4 py-3 text-right font-mono">{currency}{p.averageCost.toFixed(2)}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-slate-200">
                  {currency}{p.stockValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => openAdjustment(p)}
                    className="btn-secondary px-3 py-1 text-xs flex items-center gap-1.5 mx-auto"
                  >
                    <Sliders size={12} />
                    <span>Adjust Stock</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ADJUSTMENT MODAL */}
      {isAdjusting && selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-brand-800 rounded-xl p-6 w-full max-w-md space-y-6 shadow-premium">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-200">Inventory Stock Adjustment</h3>
              <p className="text-xs text-slate-400">Post audit corrections for: <strong>[{selectedProduct.sku}] {selectedProduct.name}</strong></p>
            </div>

            {errorMsg && (
              <div className="bg-rose-500/10 border border-rose-500/20 p-3.5 rounded-lg text-rose-450 text-xs flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-lg text-emerald-450 text-xs flex items-center gap-2">
                <CheckCircle size={16} className="shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleAdjustmentSubmit} className="space-y-4 text-sm text-slate-350">
              <div className="bg-indigo-500/5 border border-indigo-500/10 p-3.5 rounded-lg flex gap-2.5 text-indigo-400 text-xs">
                <Info size={16} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Double-Entry Journal Postings:</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {type === 'INCREASE' 
                      ? '• Debit: Inventory Asset [13100] (+ Asset)\n• Credit: Retained Earnings [30200] (+ Equity)' 
                      : '• Debit: Retained Earnings [30200] (- Equity)\n• Credit: Inventory Asset [13100] (- Asset)'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Adjustment Warehouse</label>
                  <select
                    value={warehouse}
                    onChange={(e) => setWarehouse(e.target.value)}
                    className="w-full text-slate-200 bg-slate-950 border border-brand-800 rounded-lg p-2.5"
                  >
                    <option value="Main Warehouse">Main Warehouse</option>
                    <option value="Retail Outlet">Retail Outlet</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Adjustment Type</label>
                  <div className="flex gap-2 p-1 bg-slate-950 border border-brand-800 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setType('INCREASE')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md transition-all font-medium ${
                        type === 'INCREASE'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <TrendingUp size={14} />
                      <span>Add</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setType('DECREASE')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md transition-all font-medium ${
                        type === 'DECREASE'
                          ? 'bg-rose-500/10 text-rose-450 border border-rose-500/20'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <TrendingDown size={14} />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full"
                    required
                  />
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Available in {warehouse}: <strong>{selectedProduct.warehouseQuantities?.[warehouse] || 0}</strong> units
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">
                    {type === 'INCREASE' ? 'Unit Cost (Inflow)' : 'Unit Cost (FIFO Computed)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    disabled={type === 'DECREASE'}
                    className={`w-full ${type === 'DECREASE' ? 'opacity-50 cursor-not-allowed bg-slate-950' : ''}`}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase">Audit Description / Memo</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Annual physical count variance adjustment"
                  className="w-full"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsAdjusting(false); setSelectedProduct(null); }}
                  className="btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex items-center gap-1.5"
                  disabled={submitting}
                >
                  {submitting && <RefreshCw className="animate-spin" size={12} />}
                  <span>Post Adjustment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
