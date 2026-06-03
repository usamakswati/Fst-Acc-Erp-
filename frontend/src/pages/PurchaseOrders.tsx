import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Plus, Search, Check, X, ShieldAlert, FileText, ShoppingBag, Eye, Trash2, ClipboardCheck } from 'lucide-react';

interface PurchaseOrder {
  id: string;
  poNumber: string;
  contactId: string;
  contact: { name: string };
  date: string;
  status: string;
  subTotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  lines: Array<{
    id: string;
    productId: string;
    product: { name: string; sku: string };
    quantity: number;
    unitCost: number;
    lineTotal: number;
  }>;
}

export default function PurchaseOrders({ currency }: { currency: string }) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);

  // Form states
  const [poNumber, setPoNumber] = useState('');
  const [contactId, setContactId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [orderLines, setOrderLines] = useState<any[]>([{ productId: '', quantity: 1, unitCost: 0 }]);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Master data
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  async function fetchOrders() {
    try {
      setLoading(true);
      const data = await api.getPurchaseOrders();
      setOrders(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchMetadata() {
    try {
      const contactsData = await api.getInvoiceContacts();
      setSuppliers(contactsData.filter((c: any) => c.type === 'SUPPLIER' || c.type === 'BOTH'));
      const productsData = await api.getProducts();
      setProducts(productsData.filter((p: any) => p.type === 'STOCK')); // Usually PO raw materials
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    fetchOrders();
    fetchMetadata();
  }, []);

  const openCreateModal = () => {
    setPoNumber(`PO-${Math.floor(100000 + Math.random() * 900000)}`);
    setContactId('');
    setDate(new Date().toISOString().split('T')[0]);
    setOrderLines([{ productId: '', quantity: 1, unitCost: 0 }]);
    setFormError('');
    setIsCreateOpen(true);
  };

  const handleAddLine = () => {
    setOrderLines([...orderLines, { productId: '', quantity: 1, unitCost: 0 }]);
  };

  const handleRemoveLine = (index: number) => {
    if (orderLines.length === 1) return;
    setOrderLines(orderLines.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: string, value: any) => {
    const updated = [...orderLines];
    updated[index][field] = value;
    
    // Auto-populate cost price when product changes
    if (field === 'productId') {
      const prod = products.find(p => p.id === value);
      if (prod) {
        updated[index].unitCost = prod.costPrice;
      }
    }
    setOrderLines(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    
    if (!contactId) {
      setFormError('Please select a supplier');
      return;
    }

    const hasEmptyProduct = orderLines.some(l => !l.productId);
    if (hasEmptyProduct) {
      setFormError('Please select a product for all lines');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        poNumber,
        contactId,
        date,
        lines: orderLines.map(l => ({
          productId: l.productId,
          quantity: parseFloat(l.quantity),
          unitCost: parseFloat(l.unitCost),
          discountPercent: 0,
          taxPercent: 18
        }))
      };

      await api.createPurchaseOrder(payload);
      setIsCreateOpen(false);
      fetchOrders();
    } catch (err: any) {
      setFormError(err.message || 'Error creating purchase order');
    } finally {
      setSubmitting(false);
    }
  };

  const convertToBill = async (id: string) => {
    if (!confirm('Convert this PO to a Supplier Bill? It will create a Draft Bill which you can approve under Bills.')) return;
    try {
      await api.convertPoToBill(id);
      alert('Converted to Bill successfully! You can find it in the Bills section.');
      setIsDetailOpen(false);
      fetchOrders();
    } catch (err: any) {
      alert(err.message || 'Error converting PO');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Purchase Order?')) return;
    try {
      await api.deletePurchaseOrder(id);
      fetchOrders();
    } catch (err: any) {
      alert(err.message || 'Error deleting PO');
    }
  };

  const filteredOrders = orders.filter(o => 
    o.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.contact.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Action Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search POs..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-full rounded-lg bg-brand-900/20 border border-brand-800/40 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 py-2 text-sm"
          />
        </div>
        
        <button 
          onClick={openCreateModal}
          className="btn-primary flex items-center gap-2 py-2 px-4 text-sm font-semibold rounded-lg"
        >
          <Plus size={18} /> New Purchase Order
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
        </div>
      ) : (
        <div className="bg-brand-950/40 border border-brand-800/30 rounded-xl overflow-hidden shadow-glass">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-brand-800/40 bg-brand-900/10 text-slate-400 font-medium">
                  <th className="p-4">PO Number</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Supplier</th>
                  <th className="p-4 text-right">Total Cost</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-800/20 text-slate-300">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      No purchase orders found.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-brand-900/10 transition-colors">
                      <td className="p-4 font-mono font-semibold text-slate-200">{order.poNumber}</td>
                      <td className="p-4">{new Date(order.date).toLocaleDateString()}</td>
                      <td className="p-4 font-medium text-slate-100">{order.contact?.name}</td>
                      <td className="p-4 text-right font-semibold text-slate-200">
                        {currency} {order.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                          order.status === 'BILLED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : order.status === 'CANCELLED'
                            ? 'bg-rose-500/10 text-rose-450 border border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="p-4 text-center space-x-2">
                        <button 
                          onClick={() => { setSelectedOrder(order); setIsDetailOpen(true); }}
                          className="p-1.5 hover:bg-brand-800/50 rounded text-slate-400"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        {order.status === 'PENDING' && (
                          <button 
                            onClick={() => handleDelete(order.id)}
                            className="p-1.5 hover:bg-rose-500/10 hover:text-rose-450 rounded text-slate-400"
                            title="Delete PO"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Order Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-3xl bg-brand-950 border border-brand-800/40 rounded-xl p-6 shadow-glass space-y-4 my-8">
            <div className="flex justify-between items-center border-b border-brand-800/30 pb-3">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <ClipboardCheck className="text-indigo-400" /> Draft Purchase Order
              </h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-450 hover:text-slate-200">
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg text-rose-400 text-xs flex items-center gap-2">
                <ShieldAlert size={16} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">PO Reference #</label>
                  <input 
                    type="text" 
                    value={poNumber} 
                    onChange={(e) => setPoNumber(e.target.value)} 
                    className="w-full rounded-lg bg-brand-900/20 border border-brand-800/40 text-slate-250 p-2.5 font-mono"
                    required 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Supplier *</label>
                  <select 
                    value={contactId} 
                    onChange={(e) => setContactId(e.target.value)} 
                    className="w-full rounded-lg bg-brand-900/20 border border-brand-800/40 text-slate-250 p-2.5"
                    required
                  >
                    <option value="" disabled className="bg-slate-950">Select Supplier</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id} className="bg-slate-950">{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">PO Date</label>
                  <input 
                    type="date" 
                    value={date} 
                    onChange={(e) => setDate(e.target.value)} 
                    className="w-full rounded-lg bg-brand-900/20 border border-brand-800/40 text-slate-250 p-2.5"
                    required 
                  />
                </div>
              </div>

              {/* Lines */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold text-slate-300">Items & Cost Quantities</h4>
                  <button 
                    type="button" 
                    onClick={handleAddLine}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                  >
                    + Add Line Item
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {orderLines.map((line, idx) => (
                    <div key={idx} className="flex gap-3 items-end bg-brand-900/10 p-3 rounded-lg border border-brand-800/20">
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-semibold text-slate-500 uppercase">Stock Product</label>
                        <select 
                          value={line.productId} 
                          onChange={(e) => handleLineChange(idx, 'productId', e.target.value)} 
                          className="w-full rounded bg-brand-900/20 border border-brand-800/40 text-slate-250 p-2 text-xs"
                          required
                        >
                          <option value="" disabled className="bg-slate-950">Select Stock Product</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id} className="bg-slate-950">[{p.sku}] {p.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="w-24 space-y-1">
                        <label className="text-[10px] font-semibold text-slate-500 uppercase">Qty</label>
                        <input 
                          type="number" 
                          min="1"
                          step="any"
                          value={line.quantity} 
                          onChange={(e) => handleLineChange(idx, 'quantity', e.target.value)} 
                          className="w-full rounded bg-brand-900/20 border border-brand-800/40 text-slate-250 p-2 text-xs"
                          required 
                        />
                      </div>

                      <div className="w-32 space-y-1">
                        <label className="text-[10px] font-semibold text-slate-500 uppercase">Unit Cost</label>
                        <input 
                          type="number" 
                          min="0"
                          step="any"
                          value={line.unitCost} 
                          onChange={(e) => handleLineChange(idx, 'unitCost', e.target.value)} 
                          className="w-full rounded bg-brand-900/20 border border-brand-800/40 text-slate-250 p-2 text-xs"
                          required 
                        />
                      </div>

                      <button 
                        type="button" 
                        onClick={() => handleRemoveLine(idx)}
                        disabled={orderLines.length === 1}
                        className="p-2 text-slate-500 hover:text-rose-450 disabled:opacity-30"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-brand-800/30">
                <button 
                  type="button" 
                  onClick={() => setIsCreateOpen(false)}
                  className="py-2 px-4 rounded-lg bg-brand-900/40 text-slate-300 hover:text-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="btn-primary py-2 px-6 rounded-lg font-semibold flex items-center gap-1.5"
                >
                  {submitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    <Check size={16} />
                  )}
                  Save Purchase Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {isDetailOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-brand-950 border border-brand-800/40 rounded-xl p-6 shadow-glass space-y-4">
            <div className="flex justify-between items-center border-b border-brand-800/30 pb-3">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <FileText className="text-indigo-400" /> Purchase Order Details - {selectedOrder.poNumber}
              </h3>
              <button onClick={() => setIsDetailOpen(false)} className="text-slate-450 hover:text-slate-200">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs text-slate-400 bg-brand-900/10 p-3 rounded-lg border border-brand-800/20">
              <div>
                Supplier: <strong className="text-slate-200">{selectedOrder.contact?.name}</strong>
              </div>
              <div>
                PO Date: <strong className="text-slate-200">{new Date(selectedOrder.date).toLocaleDateString()}</strong>
              </div>
              <div>
                Grand Total: <strong className="text-slate-200">{currency} {selectedOrder.grandTotal.toFixed(2)}</strong>
              </div>
              <div>
                Current Status: <span className="text-indigo-400 font-bold uppercase">{selectedOrder.status}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Line Items</h4>
              <div className="max-h-48 overflow-y-auto border border-brand-800/30 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-brand-900/20 text-slate-500">
                    <tr className="border-b border-brand-800/40">
                      <th className="p-2">Item</th>
                      <th className="p-2 text-right">Qty</th>
                      <th className="p-2 text-right">Cost Unit</th>
                      <th className="p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-800/10 text-slate-350">
                    {selectedOrder.lines.map((line, idx) => (
                      <tr key={idx}>
                        <td className="p-2 font-medium">[{line.product?.sku}] {line.product?.name}</td>
                        <td className="p-2 text-right">{line.quantity}</td>
                        <td className="p-2 text-right">{currency} {line.unitCost.toFixed(2)}</td>
                        <td className="p-2 text-right font-mono font-semibold">{currency} {line.lineTotal.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-brand-800/30">
              {selectedOrder.status === 'PENDING' ? (
                <button 
                  onClick={() => convertToBill(selectedOrder.id)}
                  className="btn-primary py-2 px-5 rounded-lg text-sm font-semibold flex items-center gap-1.5"
                >
                  <ShoppingBag size={16} /> Convert to Supplier Bill
                </button>
              ) : (
                <span className="text-xs text-slate-500 font-medium">
                  {selectedOrder.status === 'BILLED' ? '✓ Bill has been generated for this PO.' : 'This order has been cancelled.'}
                </span>
              )}
              
              <button 
                onClick={() => setIsDetailOpen(false)}
                className="py-2 px-4 rounded-lg bg-brand-900/40 text-slate-300 hover:text-slate-100 transition-colors text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
