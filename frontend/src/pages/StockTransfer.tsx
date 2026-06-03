import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  ArrowRightLeft, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  Layers,
  Calendar,
  ClipboardList
} from 'lucide-react';

interface StockTransferProps {
  currency: string;
}

export default function StockTransfer({ currency }: StockTransferProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [fromWarehouse, setFromWarehouse] = useState('Main Warehouse');
  const [toWarehouse, setToWarehouse] = useState('Retail Outlet');
  const [transferNumber, setTransferNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [prodData, transData] = await Promise.all([
        api.getProducts(),
        api.getStockTransfers()
      ]);
      // Only keep stockable items
      setProducts(prodData.filter((p: any) => p.type === 'STOCK'));
      setTransfers(transData);
    } catch (error) {
      console.error('Error loading stock transfer data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedProductId) {
      setErrorMsg('Please select a product to transfer');
      return;
    }
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setErrorMsg('Quantity must be greater than zero');
      return;
    }
    if (fromWarehouse === toWarehouse) {
      setErrorMsg('Source and destination warehouses cannot be the same');
      return;
    }

    // Check frontend stock bounds
    const prod = products.find(p => p.id === selectedProductId);
    const availableQty = prod?.warehouseQuantities?.[fromWarehouse] || 0;
    if (availableQty < qty) {
      setErrorMsg(`Insufficient stock in ${fromWarehouse}. Available: ${availableQty}, Requested: ${qty}`);
      return;
    }

    try {
      setSubmitting(true);
      const result = await api.createStockTransfer({
        productId: selectedProductId,
        quantity: qty,
        fromWarehouse,
        toWarehouse,
        transferNumber: transferNumber || undefined,
        date: date ? new Date(date).toISOString() : undefined
      });

      setSuccessMsg(`Stock transfer ${result.transferNumber} posted successfully.`);
      
      // Reset form
      setQuantity('');
      setTransferNumber('');
      
      await loadData();
    } catch (error: any) {
      setErrorMsg(error.message || 'Error processing stock transfer');
    } finally {
      setSubmitting(false);
    }
  };

  const getProductDisplay = (productId: string) => {
    const p = products.find(prod => prod.id === productId);
    if (!p) return '';
    return `[${p.sku}] ${p.name}`;
  };

  const getAvailableStockText = () => {
    if (!selectedProductId) return '';
    const p = products.find(prod => prod.id === selectedProductId);
    if (!p) return '';
    const mainQty = p.warehouseQuantities?.['Main Warehouse'] || 0;
    const retailQty = p.warehouseQuantities?.['Retail Outlet'] || 0;
    return `Available Stock - Main Warehouse: ${mainQty} units | Retail Outlet: ${retailQty} units`;
  };

  if (loading && products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500" />
        <p className="text-slate-400 text-sm font-medium">Loading warehouse stocks...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div>
        <h2 className="text-2xl font-bold text-slate-100 font-sans">Stock Transfer Registry</h2>
        <p className="text-sm text-slate-400 mt-1">
          Move physical stock between warehouse locations. The cost is calculated automatically using FIFO or average cost depending on product configurations.
        </p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transfer form */}
        <div className="lg:col-span-1 glass-panel p-6 space-y-6 self-start">
          <div className="flex items-center gap-2 border-b border-brand-800 pb-3">
            <ArrowRightLeft className="text-indigo-400" size={18} />
            <h3 className="text-md font-bold text-slate-200">New Internal Transfer</h3>
          </div>

          <form onSubmit={handleTransferSubmit} className="space-y-4 text-sm text-slate-350">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase">Product (Stocked Only)</label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full text-slate-200 bg-slate-950 border border-brand-800 rounded-lg p-2.5"
                required
              >
                <option value="">-- Select Product --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} - {p.name}
                  </option>
                ))}
              </select>
              {selectedProductId && (
                <p className="text-[11px] text-indigo-400 font-semibold font-mono mt-1">
                  {getAvailableStockText()}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase">From Location</label>
                <select
                  value={fromWarehouse}
                  onChange={(e) => setFromWarehouse(e.target.value)}
                  className="w-full text-slate-200 bg-slate-950 border border-brand-800 rounded-lg p-2.5"
                >
                  <option value="Main Warehouse">Main Warehouse</option>
                  <option value="Retail Outlet">Retail Outlet</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase">To Location</label>
                <select
                  value={toWarehouse}
                  onChange={(e) => setToWarehouse(e.target.value)}
                  className="w-full text-slate-200 bg-slate-950 border border-brand-800 rounded-lg p-2.5"
                >
                  <option value="Retail Outlet">Retail Outlet</option>
                  <option value="Main Warehouse">Main Warehouse</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase">Transfer Qty</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="e.g. 10"
                  className="w-full"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase">Transfer Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full text-slate-200 bg-slate-950 border border-brand-800 rounded-lg p-2"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase">Transfer Slip # (Auto if empty)</label>
              <input
                type="text"
                value={transferNumber}
                onChange={(e) => setTransferNumber(e.target.value)}
                placeholder="e.g. TR-00042"
                className="w-full"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full btn-primary py-2.5 font-bold flex items-center justify-center gap-2 mt-2"
            >
              {submitting ? <RefreshCw className="animate-spin" size={16} /> : <ArrowRightLeft size={16} />}
              <span>Post Stock Transfer</span>
            </button>
          </form>
        </div>

        {/* History list */}
        <div className="lg:col-span-2 glass-panel p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-brand-800 pb-3">
            <ClipboardList className="text-emerald-400" size={18} />
            <h3 className="text-md font-bold text-slate-200">Stock Transfer History logs</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-brand-800 bg-brand-950/40 text-slate-300">
                  <th className="px-4 py-2.5 font-semibold w-28">Date</th>
                  <th className="px-4 py-2.5 font-semibold w-28">Transfer Slip #</th>
                  <th className="px-4 py-2.5 font-semibold">Product Name</th>
                  <th className="px-4 py-2.5 font-semibold w-24 text-right">Qty Moved</th>
                  <th className="px-4 py-2.5 font-semibold">Route</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-900/10">
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-500 font-medium">
                      No stock transfers found. Create one to begin.
                    </td>
                  </tr>
                ) : (
                  transfers.map((t) => (
                    <tr key={t.id} className="interactive-tr">
                      <td className="px-4 py-3 text-xs text-slate-400 font-mono">
                        {new Date(t.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-indigo-400">{t.transferNumber}</td>
                      <td className="px-4 py-3 font-medium text-slate-300">
                        <div>{t.product?.name}</div>
                        <span className="text-[10px] text-slate-500">SKU: {t.product?.sku}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">{t.quantity}</td>
                      <td className="px-4 py-3 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-400 font-medium">
                          <span className="text-indigo-300">{t.fromWarehouse}</span>
                          <span className="text-slate-600">→</span>
                          <span className="text-emerald-300">{t.toWarehouse}</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
