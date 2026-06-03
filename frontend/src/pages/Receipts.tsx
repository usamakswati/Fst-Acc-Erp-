import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Plus, Search, Check, X, ShieldAlert, Coins, Calendar, FileText, User } from 'lucide-react';

interface Receipt {
  id: string;
  receiptNumber: string;
  contactId: string;
  contact: { name: string };
  accountId: string;
  account: { name: string; code: string };
  date: string;
  amount: number;
  paymentMethod: string;
  reference: string | null;
  narration: string | null;
  status: string;
}

export default function Receipts({ currency }: { currency: string }) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [isOpen, setIsOpen] = useState(false);
  
  // Form states
  const [receiptNumber, setReceiptNumber] = useState('');
  const [contactId, setContactId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [reference, setReference] = useState('');
  const [narration, setNarration] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Master data lists
  const [customers, setCustomers] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);

  async function fetchReceipts() {
    try {
      setLoading(true);
      const data = await api.getReceipts();
      setReceipts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchMetadata() {
    try {
      // Load customers
      const contacts = await api.getInvoiceContacts();
      setCustomers(contacts.filter((c: any) => c.type === 'CUSTOMER' || c.type === 'BOTH'));
      
      // Load Cash/Bank accounts
      const coa = await api.getCoA();
      const cashBank = coa.filter((a: any) => a.code === '10100' || a.code === '10200');
      setAccounts(cashBank);
    } catch (err) {
      console.error('Error fetching metadata:', err);
    }
  }

  useEffect(() => {
    fetchReceipts();
    fetchMetadata();
  }, []);

  const openModal = () => {
    setReceiptNumber(`RCP-${Math.floor(100000 + Math.random() * 900000)}`);
    setContactId('');
    if (accounts.length > 0) {
      setAccountId(accounts[0].id); // Pre-select first account (Cash in Hand)
    } else {
      setAccountId('');
    }
    setDate(new Date().toISOString().split('T')[0]);
    setAmount('');
    setPaymentMethod('CASH');
    setReference('');
    setNarration('');
    setFormError('');
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!contactId) {
      setFormError('Please select a customer');
      return;
    }
    if (!accountId) {
      setFormError('Please select a cash/bank ledger account');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setFormError('Receipt amount must be greater than zero');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        receiptNumber,
        contactId,
        accountId,
        date,
        amount: parseFloat(amount),
        paymentMethod,
        reference: reference || undefined,
        narration: narration || undefined,
      };

      await api.createReceipt(payload);
      setIsOpen(false);
      fetchReceipts();
    } catch (err: any) {
      setFormError(err.message || 'Error recording customer payment');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredReceipts = receipts.filter(r => 
    r.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.reference && r.reference.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Action Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search receipts..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-full rounded-lg bg-brand-900/20 border border-brand-800/40 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 py-2 text-sm"
          />
        </div>
        
        <button 
          onClick={openModal}
          className="btn-primary flex items-center gap-2 py-2 px-4 text-sm font-semibold rounded-lg"
        >
          <Plus size={18} /> Record Customer Receipt
        </button>
      </div>

      {/* Receipts Table */}
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
                  <th className="p-4">Receipt Number</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Deposit Account</th>
                  <th className="p-4">Payment Method</th>
                  <th className="p-4">Reference</th>
                  <th className="p-4 text-right">Amount Received</th>
                  <th className="p-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-800/20 text-slate-300">
                {filteredReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500">
                      No customer receipts found.
                    </td>
                  </tr>
                ) : (
                  filteredReceipts.map((receipt) => (
                    <tr key={receipt.id} className="hover:bg-brand-900/10 transition-colors">
                      <td className="p-4 font-mono font-semibold text-slate-200">{receipt.receiptNumber}</td>
                      <td className="p-4">{new Date(receipt.date).toLocaleDateString()}</td>
                      <td className="p-4 font-medium text-slate-100">{receipt.contact?.name}</td>
                      <td className="p-4 text-xs">
                        <span className="text-indigo-400 font-semibold bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/15">
                          {receipt.account?.name}
                        </span>
                      </td>
                      <td className="p-4 text-xs font-semibold uppercase">{receipt.paymentMethod}</td>
                      <td className="p-4 text-xs text-slate-400 italic max-w-xs truncate">{receipt.reference || '-'}</td>
                      <td className="p-4 text-right font-bold text-emerald-400">
                        {currency} {receipt.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-center">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 uppercase tracking-wider">
                          ✓ APPROVED
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Receipt Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-brand-950 border border-brand-800/40 rounded-xl p-6 shadow-glass space-y-4">
            <div className="flex justify-between items-center border-b border-brand-800/30 pb-3">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Coins className="text-indigo-400" /> Record Customer Payment Receipt
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-slate-450 hover:text-slate-200">
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg text-rose-450 text-xs flex items-center gap-2">
                <ShieldAlert size={16} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Receipt Reference #</label>
                  <input 
                    type="text" 
                    value={receiptNumber} 
                    onChange={(e) => setReceiptNumber(e.target.value)} 
                    className="w-full rounded-lg bg-brand-900/20 border border-brand-800/40 text-slate-250 p-2.5 font-mono"
                    required 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Receipt Date</label>
                  <input 
                    type="date" 
                    value={date} 
                    onChange={(e) => setDate(e.target.value)} 
                    className="w-full rounded-lg bg-brand-900/20 border border-brand-800/40 text-slate-250 p-2.5"
                    required 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Received From Customer *</label>
                  <select 
                    value={contactId} 
                    onChange={(e) => setContactId(e.target.value)} 
                    className="w-full rounded-lg bg-brand-900/20 border border-brand-800/40 text-slate-250 p-2.5"
                    required
                  >
                    <option value="" disabled className="bg-slate-950">Select Customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id} className="bg-slate-950">{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Deposit Into Account *</label>
                  <select 
                    value={accountId} 
                    onChange={(e) => setAccountId(e.target.value)} 
                    className="w-full rounded-lg bg-brand-900/20 border border-brand-800/40 text-slate-250 p-2.5"
                    required
                  >
                    <option value="" disabled className="bg-slate-950">Select Destination Account</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id} className="bg-slate-950">[{a.code}] {a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Amount Received *</label>
                  <input 
                    type="number" 
                    min="0.01"
                    step="any"
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)} 
                    placeholder="0.00"
                    className="w-full rounded-lg bg-brand-900/20 border border-brand-800/40 text-slate-250 p-2.5 font-semibold text-emerald-400"
                    required 
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Payment Method</label>
                  <select 
                    value={paymentMethod} 
                    onChange={(e) => setPaymentMethod(e.target.value)} 
                    className="w-full rounded-lg bg-brand-900/20 border border-brand-800/40 text-slate-250 p-2.5"
                  >
                    <option value="CASH" className="bg-slate-950">Cash</option>
                    <option value="BANK" className="bg-slate-950">Bank Transfer</option>
                    <option value="CHEQUE" className="bg-slate-950">Cheque</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Reference / Cheque Number</label>
                  <input 
                    type="text" 
                    value={reference} 
                    onChange={(e) => setReference(e.target.value)} 
                    placeholder="e.g. Txn Ref # or Cheque #"
                    className="w-full rounded-lg bg-brand-900/20 border border-brand-800/40 text-slate-250 p-2.5"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Narration / Memo</label>
                  <input 
                    type="text" 
                    value={narration} 
                    onChange={(e) => setNarration(e.target.value)} 
                    placeholder="Optional details for ledger postings"
                    className="w-full rounded-lg bg-brand-900/20 border border-brand-800/40 text-slate-250 p-2.5"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-brand-800/30">
                <button 
                  type="button" 
                  onClick={() => setIsOpen(false)}
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
                  Record & Post Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
