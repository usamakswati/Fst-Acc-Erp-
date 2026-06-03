import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import BillGrid, { BillLineItem } from '../components/BillGrid';
import { 
  Plus, 
  CheckCircle, 
  AlertCircle, 
  ArrowLeft, 
  Eye, 
  ShieldCheck
} from 'lucide-react';

interface BillsProps {
  currency: string;
  taxRate: number;
}

export default function Bills({ currency, taxRate }: BillsProps) {
  const [bills, setBills] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedBill, setSelectedBill] = useState<any>(null);

  // Bill Form states
  const [contactId, setContactId] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 30*24*60*60*1000).toISOString().substring(0, 10)); // 30 days due
  const [lines, setLines] = useState<BillLineItem[]>([
    { productId: '', sku: '', name: '', quantity: 1, unitCost: 0.0, discountPercent: 0.0, taxPercent: taxRate, lineTotal: 0.0 }
  ]);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [billData, contactData, productData] = await Promise.all([
        api.getBills(),
        api.getInvoiceContacts(), // Contact dropdown contains all types
        api.getProducts()
      ]);
      setBills(billData);
      setContacts(contactData.filter((c: any) => c.type === 'SUPPLIER' || c.type === 'BOTH'));
      setProducts(productData);

      // Auto-generate bill number based on current count
      setBillNumber(`BIL-2026-${String(billData.length + 1).padStart(4, '0')}`);
    } catch (error) {
      console.error('Error loading Bills data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!contactId) {
      setErrorMsg('Please select a supplier for this bill.');
      return;
    }

    const hasEmptyProduct = lines.find((l) => !l.productId || l.quantity <= 0);
    if (hasEmptyProduct) {
      setErrorMsg('Please select a valid product and input a quantity greater than zero for all lines.');
      return;
    }

    try {
      const created = await api.createBill({
        billNumber,
        contactId,
        date,
        dueDate,
        lines: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitCost: l.unitCost,
          discountPercent: l.discountPercent,
          taxPercent: l.taxPercent
        }))
      });

      setSuccessMsg(`Supplier Bill ${created.billNumber} created as DRAFT successfully.`);
      await loadData();
      
      // Reset form
      setContactId('');
      setLines([{ productId: '', sku: '', name: '', quantity: 1, unitCost: 0.0, discountPercent: 0.0, taxPercent: taxRate, lineTotal: 0.0 }]);
      
      setTimeout(() => {
        setIsCreating(false);
        setSuccessMsg('');
      }, 1500);
    } catch (error: any) {
      setErrorMsg(error.message || 'Error creating purchase bill');
    }
  };

  const handleApprove = async (id: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.approveBill(id);
      setSuccessMsg('Bill approved! Stock received into inventory, average costing updated, and ledger postings recorded.');
      
      // Reload bills list and select the updated details
      await loadData();
      
      // Refresh the detailed view
      const freshBill = await api.getBill(id);
      setSelectedBill(freshBill);

      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (error: any) {
      setErrorMsg(error.message || 'Error approving supplier bill');
    }
  };

  const viewDetails = async (id: string) => {
    try {
      setLoading(true);
      const detail = await api.getBill(id);
      setSelectedBill(detail);
    } catch (error) {
      console.error('Error fetching bill detail:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && bills.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500" />
        <p className="text-slate-400 text-sm font-medium">Fetching supplier bill registries...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Supplier Purchase Bills</h2>
          <p className="text-sm text-slate-400 mt-1">
            {isCreating 
              ? 'Draft a new supplier purchase bill.' 
              : selectedBill 
                ? `Supplier Bill Details for ${selectedBill.billNumber}`
                : 'Track supplier accounts payables, stock additions, and weighted average cost revaluation.'
            }
          </p>
        </div>
        {!isCreating && !selectedBill && (
          <button onClick={() => setIsCreating(true)} className="btn-primary">
            <Plus size={16} /> Record Supplier Bill
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-lg text-rose-400 flex items-center gap-3 text-sm">
          <AlertCircle size={18} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-lg text-emerald-400 flex items-center gap-3 text-sm">
          <CheckCircle size={18} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {isCreating ? (
        // BILL CREATE FORM
        <form onSubmit={handleCreateSubmit} className="space-y-6">
          <div className="flex items-center gap-3">
            <button 
              type="button" 
              onClick={() => setIsCreating(false)}
              className="p-1 rounded-lg hover:bg-brand-900/50 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <h3 className="text-base font-bold text-slate-200">New Bill Draft</h3>
          </div>

          <div className="glass-panel p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase">Supplier</label>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="w-full"
                required
              >
                <option value="">-- Choose Supplier --</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.email || 'No email'})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase">Bill #</label>
              <input 
                type="text" 
                value={billNumber}
                onChange={(e) => setBillNumber(e.target.value)}
                className="w-full"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase">Bill Date</label>
              <input 
                type="date" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase">Due Date</label>
              <input 
                type="date" 
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full"
                required
              />
            </div>
          </div>

          {/* Line items spreadsheet grid */}
          <BillGrid
            lines={lines}
            setLines={setLines}
            products={products}
            taxRate={taxRate}
            currency={currency}
          />

          <div className="flex justify-end gap-3">
            <button 
              type="button" 
              onClick={() => setIsCreating(false)} 
              className="btn-secondary"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-primary px-6"
            >
              Save Bill Draft
            </button>
          </div>
        </form>

      ) : selectedBill ? (
        // BILL DETAIL VIEW
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <button 
              type="button" 
              onClick={() => setSelectedBill(null)}
              className="p-1 rounded-lg hover:bg-brand-900/50 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <h3 className="text-base font-bold text-slate-200">Bill Details</h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left side: details block */}
            <div className="lg:col-span-2 space-y-6">
              <div className="glass-panel p-6 space-y-6">
                {/* Header metadata */}
                <div className="flex justify-between items-start border-b border-brand-850 pb-6">
                  <div>
                    <h4 className="text-2xl font-bold text-indigo-400">{selectedBill.billNumber}</h4>
                    <p className="text-xs text-slate-450 mt-1">Status: 
                      <span className={`ml-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        selectedBill.status === 'APPROVED' 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {selectedBill.status}
                      </span>
                    </p>
                  </div>
                  <div className="text-right text-sm space-y-1 text-slate-400">
                    <p>Bill Date: <strong>{new Date(selectedBill.date).toLocaleDateString()}</strong></p>
                    <p>Due Date: <strong>{new Date(selectedBill.dueDate).toLocaleDateString()}</strong></p>
                  </div>
                </div>

                {/* Supplier Details */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Supplier Contact</span>
                    <h5 className="text-base font-bold text-slate-200 mt-1">{selectedBill.contact.name}</h5>
                    <p className="text-xs text-slate-400 mt-1">{selectedBill.contact.address || 'No billing address specified'}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{selectedBill.contact.phone}</p>
                    <p className="text-xs text-indigo-300 mt-0.5">{selectedBill.contact.email}</p>
                  </div>
                </div>

                {/* Bill Lines Table */}
                <div className="border border-brand-850 rounded-lg overflow-hidden">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="bg-brand-950/60 text-slate-300 border-b border-brand-800">
                        <th className="px-3 py-2 font-medium">SKU / Item</th>
                        <th className="px-3 py-2 font-medium w-16 text-right">Qty</th>
                        <th className="px-3 py-2 font-medium w-24 text-right">Cost Price</th>
                        <th className="px-3 py-2 font-medium w-20 text-right">Discount</th>
                        <th className="px-3 py-2 font-medium w-16 text-right">Tax</th>
                        <th className="px-3 py-2 font-medium w-28 text-right">Net Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBill.lines.map((line: any) => (
                        <tr key={line.id} className="border-b border-brand-900/20 hover:bg-brand-900/5">
                          <td className="px-3 py-3">
                            <span className="font-mono font-bold text-indigo-400 mr-2">[{line.product.sku}]</span>
                            <span className="text-slate-200">{line.product.name}</span>
                          </td>
                          <td className="px-3 py-3 text-right font-mono">{line.quantity}</td>
                          <td className="px-3 py-3 text-right font-mono">{currency} {line.unitCost.toFixed(2)}</td>
                          <td className="px-3 py-3 text-right font-mono text-rose-400">
                            {line.discountPercent > 0 ? `${line.discountPercent}%` : '-'}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-slate-400">{line.taxPercent}%</td>
                          <td className="px-3 py-3 text-right font-mono font-semibold text-slate-200">
                            {currency} {line.lineTotal.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Calculations Summaries */}
                <div className="flex justify-end border-t border-brand-850 pt-6">
                  <div className="w-80 space-y-2 text-sm">
                    <div className="flex justify-between text-slate-400">
                      <span>Subtotal:</span>
                      <span className="font-mono">{currency} {selectedBill.subTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-rose-400">
                      <span>Discount Total:</span>
                      <span className="font-mono">- {currency} {selectedBill.discountTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Tax (Input GST):</span>
                      <span className="font-mono">{currency} {selectedBill.taxTotal.toFixed(2)}</span>
                    </div>
                    <div className="w-full h-px bg-brand-800/60 my-2" />
                    <div className="flex justify-between font-bold text-slate-100 text-base">
                      <span>Grand Total:</span>
                      <span className="font-mono">{currency} {selectedBill.grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side: Ledger Posting & Inventory Receipt Verification Action card */}
            <div className="space-y-6">
              <h4 className="text-base font-semibold text-slate-200">Ledger & Inventory Action</h4>
              <div className="glass-panel p-6 space-y-4">
                {selectedBill.status === 'DRAFT' ? (
                  <div className="space-y-4">
                    <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-lg flex items-start gap-2.5">
                      <AlertCircle className="text-amber-400 shrink-0 mt-0.5" size={16} />
                      <p className="text-xs text-slate-400 leading-relaxed">
                        This bill is in **DRAFT** state. Approving this bill will **instantly update inventory stock levels** and recalculate average item costs, posting double-entry records to the GL.
                      </p>
                    </div>
                    <button
                      onClick={() => handleApprove(selectedBill.id)}
                      className="w-full btn-success py-2.5 font-bold flex items-center justify-center gap-2"
                    >
                      <ShieldCheck size={18} /> Approve & Post to GL
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-lg flex items-start gap-2.5 text-emerald-400">
                      <CheckCircle className="shrink-0 mt-0.5" size={16} />
                      <div>
                        <span className="text-xs font-semibold block">Inventory Received & Posted</span>
                        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                          Stock inflow is confirmed. Weighted average costs and FIFO lots have updated automatically.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Ledger Postings Registered</span>
                      <div className="bg-brand-900/20 p-2.5 border border-brand-800/40 rounded space-y-1 font-mono text-[10px] text-slate-300">
                        <p className="text-indigo-400 font-bold">DR: Stock Assets [13100] (+{currency}{(selectedBill.subTotal - selectedBill.discountTotal).toFixed(2)})</p>
                        {selectedBill.taxTotal > 0 && (
                          <p className="text-indigo-400 font-bold">DR: Tax Payable [21100] (Input Tax: +{currency}{selectedBill.taxTotal.toFixed(2)})</p>
                        )}
                        <p className="text-rose-450 font-bold">CR: Accounts Payable [20100] (-{currency}{selectedBill.grandTotal.toFixed(2)})</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      ) : (
        // BILLS LIST TABLE
        <div className="glass-panel overflow-hidden">
          {bills.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-brand-800 bg-brand-950/60 text-slate-300">
                    <th className="px-4 py-3 font-semibold">Bill Number</th>
                    <th className="px-4 py-3 font-semibold">Supplier</th>
                    <th className="px-4 py-3 font-semibold w-28">Date</th>
                    <th className="px-4 py-3 font-semibold w-24 text-right">Grand Total</th>
                    <th className="px-4 py-3 font-semibold w-28 text-center">Status</th>
                    <th className="px-4 py-3 font-semibold w-20 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-900/10">
                  {bills.map((b) => (
                    <tr key={b.id} className="interactive-tr">
                      <td className="px-4 py-3.5 font-bold text-slate-200">{b.billNumber}</td>
                      <td className="px-4 py-3.5 text-slate-300 font-medium">{b.contact.name}</td>
                      <td className="px-4 py-3.5 text-slate-400 font-mono">{new Date(b.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-200">
                        {currency} {b.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                          b.status === 'APPROVED' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => viewDetails(b.id)}
                          className="p-1 hover:bg-indigo-500/10 text-indigo-400 hover:text-indigo-300 rounded transition-all"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 text-sm font-medium bg-brand-950/20">
              No supplier bills found. Press "Record Supplier Bill" to start.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
