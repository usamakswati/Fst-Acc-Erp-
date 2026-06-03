import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import InvoiceGrid, { InvoiceLineItem } from '../components/InvoiceGrid';
import { 
  Plus, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  ChevronRight, 
  ArrowLeft, 
  Eye, 
  TrendingUp,
  ShieldCheck,
  Printer,
  QrCode,
  UserPlus
} from 'lucide-react';

interface InvoicesProps {
  currency: string;
  taxRate: number;
}

export default function Invoices({ currency, taxRate }: InvoicesProps) {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  // Invoice Form states
  const [contactId, setContactId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 30*24*60*60*1000).toISOString().substring(0, 10)); // 30 days due
  const [lines, setLines] = useState<InvoiceLineItem[]>([
    { productId: '', sku: '', name: '', quantity: 1, unitPrice: 0.0, discountPercent: 0.0, taxPercent: taxRate, lineTotal: 0.0 }
  ]);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // FBR states & inline Customer modal
  const [submittingFbr, setSubmittingFbr] = useState(false);
  const [isCreatingContact, setIsCreatingContact] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactAddress, setContactAddress] = useState('');
  const [contactNtn, setContactNtn] = useState('');
  const [contactStrn, setContactStrn] = useState('');

  const handleCreateContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!contactName) {
      setErrorMsg('Customer name is required.');
      return;
    }

    try {
      const created = await api.createContact({
        name: contactName,
        type: 'CUSTOMER',
        email: contactEmail || null,
        phone: contactPhone || null,
        address: contactAddress || null,
        ntn: contactNtn || null,
        strn: contactStrn || null
      });

      setSuccessMsg(`Customer "${created.name}" created successfully.`);
      
      // Reload contacts list
      const contactData = await api.getInvoiceContacts();
      setContacts(contactData.filter((c: any) => c.type === 'CUSTOMER' || c.type === 'BOTH'));
      
      // Select the newly created contact
      setContactId(created.id);
      
      // Reset contact fields
      setContactName('');
      setContactEmail('');
      setContactPhone('');
      setContactAddress('');
      setContactNtn('');
      setContactStrn('');
      
      setTimeout(() => {
        setIsCreatingContact(false);
        setSuccessMsg('');
      }, 1500);
    } catch (error: any) {
      setErrorMsg(error.message || 'Error creating customer contact');
    }
  };

  const handleFbrSubmit = async (id: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    setSubmittingFbr(true);
    try {
      const res = await api.submitInvoiceToFbr(id);
      setSuccessMsg(res.msg || 'e-Invoice successfully integrated and registered with FBR Portal!');
      
      // Reload invoices list
      await loadData();
      
      // Refresh the detailed view
      const freshInv = await api.getInvoice(id);
      setSelectedInvoice(freshInv);
      
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (error: any) {
      setErrorMsg(error.message || 'Error submitting to FBR');
    } finally {
      setSubmittingFbr(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [invoiceData, contactData, productData] = await Promise.all([
        api.getInvoices(),
        api.getInvoiceContacts(),
        api.getProducts()
      ]);
      setInvoices(invoiceData);
      setContacts(contactData.filter((c: any) => c.type === 'CUSTOMER' || c.type === 'BOTH'));
      setProducts(productData);

      // Auto-generate invoice number based on current count
      setInvoiceNumber(`INV-2026-${String(invoiceData.length + 1).padStart(4, '0')}`);
    } catch (error) {
      console.error('Error loading Invoices data:', error);
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
      setErrorMsg('Please select a customer for this invoice.');
      return;
    }

    const hasEmptyProduct = lines.find((l) => !l.productId || l.quantity <= 0);
    if (hasEmptyProduct) {
      setErrorMsg('Please select a valid product and input a quantity greater than zero for all lines.');
      return;
    }

    try {
      const created = await api.createInvoice({
        invoiceNumber,
        contactId,
        date,
        dueDate,
        lines: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discountPercent: l.discountPercent,
          taxPercent: l.taxPercent
        }))
      });

      setSuccessMsg(`Invoice ${created.invoiceNumber} created as DRAFT successfully.`);
      await loadData();
      
      // Reset form
      setContactId('');
      setLines([{ productId: '', sku: '', name: '', quantity: 1, unitPrice: 0.0, discountPercent: 0.0, taxPercent: taxRate, lineTotal: 0.0 }]);
      
      setTimeout(() => {
        setIsCreating(false);
        setSuccessMsg('');
      }, 1500);
    } catch (error: any) {
      setErrorMsg(error.message || 'Error creating sales invoice');
    }
  };

  const handleApprove = async (id: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await api.approveInvoice(id);
      setSuccessMsg('Invoice approved successfully. Ledger postings recorded!');
      
      // Reload invoices list and select the updated invoice details
      await loadData();
      
      // Refresh the detailed view
      const freshInv = await api.getInvoice(id);
      setSelectedInvoice(freshInv);

      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error: any) {
      setErrorMsg(error.message || 'Error approving invoice');
    }
  };

  const viewDetails = async (id: string) => {
    try {
      setLoading(true);
      const detail = await api.getInvoice(id);
      setSelectedInvoice(detail);
    } catch (error) {
      console.error('Error fetching invoice detail:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500" />
        <p className="text-slate-400 text-sm font-medium">Fetching invoice registries...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Sales Invoices</h2>
          <p className="text-sm text-slate-400 mt-1">
            {isCreating 
              ? 'Draft a new customer invoice.' 
              : selectedInvoice 
                ? `Invoice Details for ${selectedInvoice.invoiceNumber}`
                : 'Manage customer accounts receivables and GL postings.'
            }
          </p>
        </div>
        {!isCreating && !selectedInvoice && (
          <button onClick={() => setIsCreating(true)} className="btn-primary">
            <Plus size={16} /> Create Invoice
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
        // INVOICE CREATE FORM
        <form onSubmit={handleCreateSubmit} className="space-y-6">
          <div className="flex items-center gap-3">
            <button 
              type="button" 
              onClick={() => setIsCreating(false)}
              className="p-1 rounded-lg hover:bg-brand-900/50 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <h3 className="text-base font-bold text-slate-200">Invoice Draft Form</h3>
          </div>

          <div className="glass-panel p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-1.5 col-span-1">
              <label className="text-xs font-semibold text-slate-400 uppercase">Customer</label>
              <div className="flex gap-2">
                <select
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className="w-full"
                  required
                >
                  <option value="">-- Choose Customer --</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.email || 'No email'})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setIsCreatingContact(true)}
                  className="btn-secondary px-3 py-2 flex items-center justify-center shrink-0 border border-brand-800 bg-brand-950/60 hover:bg-brand-900/60 rounded"
                  title="Add New Customer"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase">Invoice #</label>
              <input 
                type="text" 
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase">Invoice Date</label>
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
          <InvoiceGrid
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
              Save Invoice Draft
            </button>
          </div>
        </form>

      ) : selectedInvoice ? (
        // INVOICE DETAIL VIEW
        <div className="space-y-6">
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              body * {
                visibility: hidden !important;
              }
              #printable-fbr-invoice, #printable-fbr-invoice * {
                visibility: visible !important;
              }
              #printable-fbr-invoice {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                color: #000000 !important;
                background: #ffffff !important;
                border: none !important;
                box-shadow: none !important;
                padding: 20px !important;
                margin: 0 !important;
              }
              #printable-fbr-invoice table, 
              #printable-fbr-invoice th, 
              #printable-fbr-invoice td {
                border-color: #cbd5e1 !important;
                color: #0f172a !important;
              }
              #printable-fbr-invoice th {
                background-color: #f1f5f9 !important;
                color: #0f172a !important;
              }
              #printable-fbr-invoice span,
              #printable-fbr-invoice p,
              #printable-fbr-invoice h4,
              #printable-fbr-invoice h5,
              #printable-fbr-invoice strong {
                color: #0f172a !important;
              }
              #printable-fbr-invoice .text-indigo-400,
              #printable-fbr-invoice .text-indigo-300 {
                color: #1e3a8a !important;
              }
              #printable-fbr-invoice .font-mono {
                color: #1e293b !important;
              }
            }
          `}} />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                type="button" 
                onClick={() => setSelectedInvoice(null)}
                className="p-1 rounded-lg hover:bg-brand-900/50 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <ArrowLeft size={18} />
              </button>
              <h3 className="text-base font-bold text-slate-200">Invoice Details</h3>
            </div>
            
            {selectedInvoice.fbrStatus === 'SUBMITTED' && (
              <button
                onClick={() => window.print()}
                className="btn-secondary py-1.5 px-4 font-bold flex items-center gap-2 text-xs border border-brand-800 bg-brand-950/60 hover:bg-brand-900/60 rounded"
              >
                <Printer size={15} /> Print Tax Invoice
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left side: details block */}
            <div className="lg:col-span-2 space-y-6">
              <div id="printable-fbr-invoice" className="glass-panel p-6 space-y-6 bg-slate-900 border border-brand-850">
                {/* Print Only Official FBR Header */}
                {selectedInvoice.fbrStatus === 'SUBMITTED' && (
                  <div className="hidden print:flex flex-col items-center border-b-2 border-dashed border-slate-300 pb-4 mb-4 text-center">
                    <h2 className="text-xl font-extrabold text-slate-900">PAKISTAN FEDERAL BOARD OF REVENUE</h2>
                    <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">Official Computer Registered Tax Invoice</p>
                    <p className="text-[10px] text-slate-500 mt-1">POS REGISTRATION NUMBER: POS-ACME-KHI-01</p>
                  </div>
                )}

                {/* Header metadata */}
                <div className="flex justify-between items-start border-b border-brand-850 pb-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-2xl font-bold text-indigo-400">{selectedInvoice.invoiceNumber}</h4>
                      {selectedInvoice.fbrStatus === 'SUBMITTED' && (
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide print:hidden">
                          🇵🇰 FBR Integrated
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-455 mt-1">Status: 
                      <span className={`ml-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        selectedInvoice.status === 'APPROVED' 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {selectedInvoice.status}
                      </span>
                    </p>
                  </div>
                  <div className="text-right text-sm space-y-1 text-slate-400">
                    <p>Issue Date: <strong>{new Date(selectedInvoice.date).toLocaleDateString()}</strong></p>
                    <p>Due Date: <strong>{new Date(selectedInvoice.dueDate).toLocaleDateString()}</strong></p>
                  </div>
                </div>

                {/* Seller & Buyer Details */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Seller (Billed From)</span>
                    <h5 className="text-sm font-bold text-slate-200 mt-1">Acme Enterprise Corp</h5>
                    <p className="text-xs text-slate-400">Industrial Area, Karachi, Pakistan</p>
                    <p className="text-xs text-slate-455 mt-1">NTN: <strong className="font-mono text-indigo-300">7239102-4</strong></p>
                    <p className="text-xs text-slate-455 mt-0.5">STRN: <strong className="font-mono text-emerald-300">1234567890123</strong></p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Billed To</span>
                    <h5 className="text-sm font-bold text-slate-200 mt-1">{selectedInvoice.contact.name}</h5>
                    <p className="text-xs text-slate-400">{selectedInvoice.contact.address || 'No billing address specified'}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{selectedInvoice.contact.phone}</p>
                    <p className="text-xs text-indigo-300 mt-0.5">{selectedInvoice.contact.email}</p>
                    {selectedInvoice.contact.ntn && (
                      <p className="text-xs text-slate-455 mt-1">NTN: <strong className="font-mono text-indigo-300">{selectedInvoice.contact.ntn}</strong></p>
                    )}
                    {selectedInvoice.contact.strn && (
                      <p className="text-xs text-slate-455 mt-0.5">STRN: <strong className="font-mono text-emerald-300">{selectedInvoice.contact.strn}</strong></p>
                    )}
                  </div>
                </div>

                {/* Invoice Lines Table */}
                <div className="border border-brand-850 rounded-lg overflow-hidden">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="bg-brand-950/60 text-slate-300 border-b border-brand-800">
                        <th className="px-3 py-2 font-medium">SKU / Item Details</th>
                        <th className="px-3 py-2 font-medium w-16 text-right">Qty</th>
                        <th className="px-3 py-2 font-medium w-24 text-right">Price</th>
                        <th className="px-3 py-2 font-medium w-20 text-right">Discount</th>
                        <th className="px-3 py-2 font-medium w-16 text-right">Tax (GST)</th>
                        <th className="px-3 py-2 font-medium w-28 text-right">Net Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoice.lines.map((line: any) => (
                        <tr key={line.id} className="border-b border-brand-900/20 hover:bg-brand-900/5">
                          <td className="px-3 py-3">
                            <span className="font-mono font-bold text-indigo-400 mr-2">[{line.product.sku}]</span>
                            <span className="text-slate-200">{line.product.name}</span>
                            {line.product.hsCode && (
                              <span className="text-[10px] text-slate-500 block font-mono">HS Code: {line.product.hsCode}</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-slate-300">{line.quantity}</td>
                          <td className="px-3 py-3 text-right font-mono text-slate-300">{currency} {line.unitPrice.toFixed(2)}</td>
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
                <div className="flex justify-between items-start border-t border-brand-850 pt-6">
                  {/* Left element: e-Invoice info for print layout */}
                  <div className="text-[10px] text-slate-500 max-w-xs space-y-1">
                    <p className="font-bold text-slate-400 uppercase tracking-wide print:text-slate-800">E-Invoice Notes</p>
                    <p className="leading-relaxed">This computer-generated document represents a verified electronic tax invoice integrated directly with the FBR sandbox portal system under standard rules (18.00% GST).</p>
                  </div>
                  
                  <div className="w-80 space-y-2 text-sm">
                    <div className="flex justify-between text-slate-400">
                      <span>Subtotal:</span>
                      <span className="font-mono">{currency} {selectedInvoice.subTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-rose-455">
                      <span>Discount Total:</span>
                      <span className="font-mono">- {currency} {selectedInvoice.discountTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Tax (18% GST Collected):</span>
                      <span className="font-mono">{currency} {selectedInvoice.taxTotal.toFixed(2)}</span>
                    </div>
                    <div className="w-full h-px bg-brand-800/60 my-2 border-t border-slate-300 print:border-slate-400" />
                    <div className="flex justify-between font-bold text-slate-100 text-base">
                      <span>Grand Total:</span>
                      <span className="font-mono">{currency} {selectedInvoice.grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Print Only FBR Footer & Verification QR */}
                {selectedInvoice.fbrStatus === 'SUBMITTED' && (
                  <div className="hidden print:flex flex-col items-center border-t-2 border-dashed border-slate-300 pt-4 mt-6 text-center text-xs text-slate-500">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(selectedInvoice.fbrQrCode)}`} 
                      alt="FBR Tax Verification QR"
                      className="w-24 h-24 mb-2"
                    />
                    <p className="font-bold text-slate-800">FBR INVOICE ID: {selectedInvoice.fbrInvoiceId}</p>
                    <p className="mt-1 font-semibold text-slate-600">Scan this QR Code using FBR Tax Asaan Mobile App for validation.</p>
                    <p className="text-[9px] text-slate-400 mt-2 font-mono">POWERED BY ACME ENTERPRISE FASTACCOUNTS POS CONNECTOR</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right side: Ledger Posting & e-Invoicing Compliance Action card */}
            <div className="space-y-6">
              {/* Ledger Posting status card */}
              <h4 className="text-base font-semibold text-slate-200">Ledger Posting</h4>
              <div className="glass-panel p-6 space-y-4 bg-slate-900 border border-brand-850">
                {selectedInvoice.status === 'DRAFT' ? (
                  <div className="space-y-4">
                    <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-lg flex items-start gap-2.5">
                      <AlertCircle className="text-amber-400 shrink-0 mt-0.5" size={16} />
                      <p className="text-xs text-slate-400 leading-relaxed">
                        This invoice is currently in **DRAFT** state. It has not impacted stock levels, sales revenue, or receivables ledger balances.
                      </p>
                    </div>
                    <button
                      onClick={() => handleApprove(selectedInvoice.id)}
                      className="w-full btn-success py-2.5 font-bold flex items-center justify-center gap-2 rounded bg-emerald-650 hover:bg-emerald-600"
                    >
                      <ShieldCheck size={18} /> Approve & Post to GL
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-lg flex items-start gap-2.5 text-emerald-400">
                      <CheckCircle className="shrink-0 mt-0.5" size={16} />
                      <div>
                        <span className="text-xs font-semibold block text-slate-200">Posted to Ledger</span>
                        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                          Ledger postings are committed. Inventory asset valuation balances have updated (FIFO/Weighted Average COGS applied).
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Ledger Rules Applied</span>
                      <div className="bg-brand-900/20 p-2.5 border border-brand-800/40 rounded space-y-1 font-mono text-[10px] text-slate-300">
                        <p className="text-indigo-400 font-bold">DR: Receivables [12100] (+{currency}{selectedInvoice.grandTotal.toFixed(2)})</p>
                        <p className="text-rose-455 font-bold">CR: Sales Revenue [40100] (-{currency}{(selectedInvoice.subTotal - selectedInvoice.discountTotal).toFixed(2)})</p>
                        {selectedInvoice.taxTotal > 0 && (
                          <p className="text-rose-455 font-bold">CR: Tax Payable [21100] (-{currency}{selectedInvoice.taxTotal.toFixed(2)})</p>
                        )}
                        <p className="text-slate-500 border-t border-brand-800/50 mt-1 pt-1 italic">COGS Expense & Stock offsets posted dynamically.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Pakistan FBR e-Invoicing Compliance Card */}
              <h4 className="text-base font-semibold text-slate-200">Pakistan FBR Compliance</h4>
              <div className="glass-panel p-6 space-y-4 bg-slate-900 border border-brand-850">
                {selectedInvoice.status === 'DRAFT' ? (
                  <div className="bg-slate-800/40 p-4 border border-brand-850 rounded-lg text-xs space-y-2 text-slate-400">
                    <p className="font-bold flex items-center gap-1.5 text-amber-500">
                      <AlertCircle size={14} /> FBR Registration Locked
                    </p>
                    <p className="leading-relaxed">
                      Invoices must be approved and posted to the General Ledger first before they can be registered with the FBR IRIS e-invoicing portal.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(!selectedInvoice.fbrStatus || selectedInvoice.fbrStatus === 'PENDING') && (
                      <div className="space-y-4">
                        <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-lg flex items-start gap-2.5">
                          <AlertCircle className="text-amber-400 shrink-0 mt-0.5" size={16} />
                          <div>
                            <span className="text-xs font-semibold block text-slate-300">Pending FBR Submission</span>
                            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                              This sales transaction is posted to the GL, but not yet declared to the Federal Board of Revenue. Submitting will register it in the FBR IRIS sandbox.
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleFbrSubmit(selectedInvoice.id)}
                          disabled={submittingFbr}
                          className="w-full btn-primary py-2.5 font-bold flex items-center justify-center gap-2 bg-indigo-650 hover:bg-indigo-600 disabled:opacity-50 text-sm"
                        >
                          {submittingFbr ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                              <span>Registering POS Invoice...</span>
                            </>
                          ) : (
                            <>
                              <ShieldCheck size={18} /> Submit to Pakistan FBR
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {selectedInvoice.fbrStatus === 'SUBMITTED' && (
                      <div className="space-y-4">
                        <div className="bg-emerald-500/5 border border-emerald-500/15 p-4 rounded-lg flex items-start gap-2.5 text-emerald-400">
                          <CheckCircle className="shrink-0 mt-0.5" size={16} />
                          <div>
                            <span className="text-xs font-semibold block">🇵🇰 FBR Integrated POS e-Invoice</span>
                            <p className="text-[11px] text-slate-455 mt-1 leading-relaxed">
                              Invoice successfully registered. Verifiable signature code generated by the FBR IRIS POS portal.
                            </p>
                          </div>
                        </div>

                        {/* Interactive Official Tax Invoice PDF/Print Layout Trigger */}
                        <div className="border border-brand-850 rounded-lg p-3 bg-brand-950/40 text-xs space-y-3 font-mono">
                          <div className="space-y-1">
                            <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wide">FBR Invoice ID</span>
                            <span className="text-[11px] text-indigo-300 font-bold block select-all break-all">{selectedInvoice.fbrInvoiceId}</span>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wide">FBR Message</span>
                            <span className="text-[11px] text-slate-300 block">{selectedInvoice.fbrResponseMsg}</span>
                          </div>
                          
                          {/* Live Scan QR Code */}
                          <div className="flex flex-col items-center justify-center p-3 bg-white rounded-lg border border-slate-200 mt-2">
                            <img 
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(selectedInvoice.fbrQrCode)}`} 
                              alt="FBR Tax Verification QR"
                              className="w-32 h-32"
                            />
                            <span className="text-[9px] text-slate-800 font-extrabold tracking-tight mt-1.5 text-center">FBR VERIFIED POS RECEIPT</span>
                          </div>
                        </div>

                        {/* Print Button */}
                        <button
                          onClick={() => window.print()}
                          className="w-full btn-secondary py-2.5 font-bold flex items-center justify-center gap-2 text-xs border border-brand-800 bg-brand-950/60 hover:bg-brand-900/60 rounded"
                        >
                          <Printer size={15} /> Print Formal Tax Invoice
                        </button>
                      </div>
                    )}

                    {selectedInvoice.fbrStatus === 'FAILED' && (
                      <div className="space-y-4">
                        <div className="bg-rose-500/5 border border-rose-500/10 p-4 rounded-lg flex items-start gap-2.5 text-rose-455">
                          <AlertCircle className="shrink-0 mt-0.5" size={16} />
                          <div>
                            <span className="text-xs font-semibold block text-slate-200">e-Invoice Submission Failed</span>
                            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                              {selectedInvoice.fbrResponseMsg || 'The validation payload contains incorrect tax identification formats.'}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleFbrSubmit(selectedInvoice.id)}
                          disabled={submittingFbr}
                          className="w-full btn-primary py-2.5 font-bold flex items-center justify-center gap-2 bg-rose-650 hover:bg-rose-600 disabled:opacity-50 text-sm"
                        >
                          {submittingFbr ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                          ) : (
                            <span>Retry FBR Submission</span>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      ) : (
        // INVOICES LIST TABLE
        <div className="glass-panel overflow-hidden">
          {invoices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-brand-800 bg-brand-950/60 text-slate-300">
                    <th className="px-4 py-3 font-semibold">Invoice Number</th>
                    <th className="px-4 py-3 font-semibold">Customer</th>
                    <th className="px-4 py-3 font-semibold w-28">Date</th>
                    <th className="px-4 py-3 font-semibold w-24 text-right">Grand Total</th>
                    <th className="px-4 py-3 font-semibold w-28 text-center">GL Posting</th>
                    <th className="px-4 py-3 font-semibold w-32 text-center">e-Invoice Status</th>
                    <th className="px-4 py-3 font-semibold w-20 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-900/10">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="interactive-tr">
                      <td className="px-4 py-3.5 font-bold text-slate-200">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3.5 text-slate-300 font-medium">
                        <div>
                          <span>{inv.contact.name}</span>
                          {(inv.contact.ntn || inv.contact.strn) && (
                            <span className="text-[9px] text-slate-500 block mt-0.5 font-mono">
                              {inv.contact.strn ? `STRN: ${inv.contact.strn}` : `NTN: ${inv.contact.ntn}`}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-400 font-mono">{new Date(inv.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-200">
                        {currency} {inv.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                          inv.status === 'APPROVED' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                          inv.fbrStatus === 'SUBMITTED' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : inv.fbrStatus === 'FAILED'
                              ? 'bg-rose-500/10 text-rose-455 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {inv.fbrStatus || 'PENDING'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => viewDetails(inv.id)}
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
              No sales invoices found. Press "Create Invoice" to start.
            </div>
          )}
        </div>
      )}

      {/* INLINE CUSTOMER MODAL */}
      {isCreatingContact && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-brand-800 rounded-xl p-6 w-full max-w-md space-y-6 shadow-premium">
            <div className="flex items-center gap-2 text-indigo-400">
              <UserPlus size={20} />
              <h3 className="text-lg font-bold text-slate-200">Register New Customer</h3>
            </div>
            
            <form onSubmit={handleCreateContactSubmit} className="space-y-4 text-sm">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase">Full Name (Required)</label>
                <input 
                  type="text" 
                  value={contactName} 
                  onChange={(e) => setContactName(e.target.value)} 
                  placeholder="e.g. Stark Industries Logistics" 
                  className="w-full bg-slate-950 border border-brand-850 rounded px-3 py-2 text-slate-200" 
                  required 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Email</label>
                  <input 
                    type="email" 
                    value={contactEmail} 
                    onChange={(e) => setContactEmail(e.target.value)} 
                    placeholder="billing@company.com" 
                    className="w-full bg-slate-950 border border-brand-850 rounded px-3 py-2 text-slate-200" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Phone</label>
                  <input 
                    type="text" 
                    value={contactPhone} 
                    onChange={(e) => setContactPhone(e.target.value)} 
                    placeholder="+92 300 1234567" 
                    className="w-full bg-slate-950 border border-brand-850 rounded px-3 py-2 text-slate-200" 
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase">Billing Address</label>
                <input 
                  type="text" 
                  value={contactAddress} 
                  onChange={(e) => setContactAddress(e.target.value)} 
                  placeholder="Street, City, Pakistan" 
                  className="w-full bg-slate-950 border border-brand-850 rounded px-3 py-2 text-slate-200" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4 bg-brand-950/40 p-3 rounded-lg border border-brand-850/50">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">NTN / CNIC</label>
                  <input 
                    type="text" 
                    value={contactNtn} 
                    onChange={(e) => setContactNtn(e.target.value)} 
                    placeholder="e.g. 1234567-8" 
                    className="w-full bg-slate-950 border border-brand-850 rounded px-3 py-2 text-slate-200 font-mono text-xs" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">STRN (13-digit)</label>
                  <input 
                    type="text" 
                    value={contactStrn} 
                    onChange={(e) => setContactStrn(e.target.value)} 
                    placeholder="Corporate 13-digit" 
                    className="w-full bg-slate-950 border border-brand-850 rounded px-3 py-2 text-slate-200 font-mono text-xs" 
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsCreatingContact(false)} 
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary font-bold"
                >
                  Register Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
