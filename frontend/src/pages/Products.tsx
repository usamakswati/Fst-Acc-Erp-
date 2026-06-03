import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  PlusCircle, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  Archive,
  Boxes
} from 'lucide-react';

interface ProductsProps {
  currency: string;
}

export default function Products({ currency }: ProductsProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals status
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);

  // New Product form state
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('STOCK'); // STOCK, NON_STOCK, SERVICE
  const [salesPrice, setSalesPrice] = useState('0.00');
  const [costPrice, setCostPrice] = useState('0.00');
  const [valuationMethod, setValuationMethod] = useState('FIFO'); // FIFO, WEIGHTED_AVERAGE
  const [packSize, setPackSize] = useState('Single');
  const [openingQty, setOpeningQty] = useState('0');
  const [hsCode, setHsCode] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await api.getProducts();
      setProducts(data);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!sku || !name || !type) {
      setErrorMsg('SKU, name, and type are required');
      return;
    }

    try {
      await api.createProduct({
        sku,
        name,
        type,
        salesPrice: parseFloat(salesPrice),
        costPrice: parseFloat(costPrice),
        inventoryValuationMethod: valuationMethod,
        packSize,
        hsCode,
        openingStockQty: parseFloat(openingQty),
      });

      setSuccessMsg(`Product [${sku}] created successfully.`);
      await loadProducts();
      
      // Reset form
      setSku('');
      setName('');
      setSalesPrice('0.00');
      setCostPrice('0.00');
      setOpeningQty('0');
      setHsCode('');
      
      setTimeout(() => {
        setIsCreatingProduct(false);
        setSuccessMsg('');
      }, 1500);
    } catch (error: any) {
      setErrorMsg(error.message || 'Error creating product');
    }
  };

  if (loading && products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500" />
        <p className="text-slate-400 text-sm font-medium">Fetching real-time inventory ledger quantities...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Products & Services</h2>
          <p className="text-sm text-slate-400 mt-1">
            Track asset profiles, update pricing, configure FIFO/Weighted Average valuation, and view real-time warehouse distributions.
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsCreatingProduct(true)}
            className="btn-primary"
          >
            <PlusCircle size={16} /> Add Product/Service
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-lg text-rose-450 flex items-center gap-3 text-sm">
          <AlertTriangle size={18} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-lg text-emerald-450 flex items-center gap-3 text-sm">
          <CheckCircle size={18} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* CREATE PRODUCT MODAL */}
      {isCreatingProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-brand-800 rounded-xl p-6 w-full max-w-lg space-y-6 shadow-premium">
            <h3 className="text-lg font-bold text-slate-200">Add New Item Definition</h3>
            <form onSubmit={handleCreateProduct} className="space-y-4 text-sm text-slate-350">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">SKU Code (Unique)</label>
                  <input type="text" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="e.g. FG-ITEM-01" className="w-full" required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Item Name</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Product descriptive name" className="w-full" required />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1 col-span-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Item Type</label>
                  <select value={type} onChange={(e) => setType(e.target.value)} className="w-full text-slate-200 bg-slate-950 border border-brand-800 rounded-lg p-2">
                    <option value="STOCK">Stock Item</option>
                    <option value="NON_STOCK">Non-Stock Item</option>
                    <option value="SERVICE">Service</option>
                  </select>
                </div>
                <div className="space-y-1 col-span-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Pack Size</label>
                  <input type="text" value={packSize} onChange={(e) => setPackSize(e.target.value)} placeholder="e.g. Box of 10, Single" className="w-full" />
                </div>
                <div className="space-y-1 col-span-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">FBR HS Code</label>
                  <input type="text" value={hsCode} onChange={(e) => setHsCode(e.target.value)} placeholder="e.g. 8471.3010" className="w-full" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Sales Price</label>
                  <input type="number" min="0" step="any" value={salesPrice} onChange={(e) => setSalesPrice(e.target.value)} className="w-full" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Cost Price</label>
                  <input type="number" min="0" step="any" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} className="w-full" />
                </div>
              </div>

              {type === 'STOCK' && (
                <div className="grid grid-cols-2 gap-4 bg-brand-950/40 p-3 rounded-lg border border-brand-850/50">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 uppercase">Valuation Costing</label>
                    <select value={valuationMethod} onChange={(e) => setValuationMethod(e.target.value)} className="w-full text-slate-200 bg-slate-950 border border-brand-800 rounded-lg p-2">
                      <option value="FIFO">FIFO (First-In First-Out)</option>
                      <option value="WEIGHTED_AVERAGE">Weighted Average Cost</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 uppercase">Opening Stock (Main Wh)</label>
                    <input type="number" min="0" value={openingQty} onChange={(e) => setOpeningQty(e.target.value)} className="w-full" />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsCreatingProduct(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRODUCTS DISPLAY LIST */}
      <div className="glass-panel overflow-hidden">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-brand-800 bg-brand-950/60 text-slate-300">
              <th className="px-4 py-3 font-semibold w-32">SKU Code</th>
              <th className="px-4 py-3 font-semibold">Product/Service Name</th>
              <th className="px-4 py-3 font-semibold w-28">FBR HS Code</th>
              <th className="px-4 py-3 font-semibold w-24">Type</th>
              <th className="px-4 py-3 font-semibold w-24 text-right">Sales Price</th>
              <th className="px-4 py-3 font-semibold w-32 text-center text-indigo-400">Valuation Mode</th>
              <th className="px-4 py-3 font-semibold w-36 text-center">Warehouse Stocks</th>
              <th className="px-4 py-3 font-semibold w-24 text-right">Total In Stock</th>
              <th className="px-4 py-3 font-semibold w-28 text-right">Avg Unit Cost</th>
              <th className="px-4 py-3 font-semibold w-28 text-right">Total Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-900/10">
            {products.map((p) => {
              const isStock = p.type === 'STOCK';
              return (
                <tr key={p.id} className="interactive-tr">
                  <td className="px-4 py-3 font-mono font-bold text-slate-200">{p.sku}</td>
                  <td className="px-4 py-3 font-medium text-slate-300">
                    <div>{p.name}</div>
                    <span className="text-[10px] text-slate-500">Pack: {p.packSize}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{p.hsCode || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      p.type === 'STOCK' 
                        ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                        : p.type === 'SERVICE'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-800 text-slate-450'
                    }`}>
                      {p.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{currency}{p.salesPrice.toFixed(2)}</td>
                  <td className="px-4 py-3 text-center text-xs font-semibold text-indigo-400">
                    {isStock ? (
                      p.inventoryValuationMethod === 'FIFO' ? 'FIFO' : 'Weighted Avg'
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-xs">
                    {isStock && p.warehouseQuantities ? (
                      <div className="flex flex-col gap-0.5 text-left font-mono max-w-[140px] mx-auto text-slate-400">
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
                  <td className="px-4 py-3 text-right font-mono">
                    {isStock ? (
                      <span className={p.stockQuantity === 0 ? 'text-slate-500 font-bold' : 'text-slate-200 font-bold'}>
                        {p.stockQuantity}
                      </span>
                    ) : (
                      <span className="text-slate-650">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {isStock ? `${currency}${p.averageCost.toFixed(2)}` : <span className="text-slate-650">-</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-slate-200">
                    {isStock ? `${currency}${p.stockValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : <span className="text-slate-650">-</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
