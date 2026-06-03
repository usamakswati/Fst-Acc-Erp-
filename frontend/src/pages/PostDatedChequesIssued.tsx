import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Plus, Search, Check, X, ShieldAlert, CreditCard, Calendar, CheckSquare, AlertTriangle } from 'lucide-react';

interface IssuedCheque {
  id: string;
  chequeNumber: string;
  contactId: string;
  contact: { name: string };
  accountId: string;
  account: { name: string; code: string };
  dateIssued: string;
  chequeDate: string;
  amount: number;
  bankName: string;
  status: string;
}

export default function PostDatedChequesIssued({ currency }: { currency: string }) {
  const [cheques, setCheques] = useState<IssuedCheque[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [isOpen, setIsOpen] = useState(false);
  
  // Form states
  const [chequeNumber, setChequeNumber] = useState('');
  const [contactId, setContactId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [chequeDate, setChequeDate] = useState('');
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Master data
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

  async function fetchCheques() {
    try {
      setLoading(true);
      const data = await api.getIssuedCheques();
      setCheques(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchMetadata() {
    try {
      const contacts = await api.getInvoiceContacts();
      setSuppliers(contacts.filter((c: any) => c.type === 'SUPPLIER' || c.type === 'BOTH'));
      
      const coa = await api.getCoA();
      setBankAccounts(coa.filter((a: any) => a.code === '10200')); // Bank account
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    fetchCheques();
    fetchMetadata();
  }, []);

  const openModal = () => {
    setChequeNumber('');
    setContactId('');
    if (bankAccounts.length > 0) {
      setAccountId(bankAccounts[0].id);
    } else {
      setAccountId('');
    }
    setChequeDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]); // Default to +7 days
    setAmount('');
    setBankName('');
    setFormError('');
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!chequeNumber.trim()) {
      setFormError('Cheque number is required');
      return;
    }
    if (!contactId) {
      setFormError('Please select a supplier');
      return;
    }
    if (!accountId) {
      setFormError('Please select a bank account');
      return;
    }
    if (!chequeDate) {
      setFormError('Cheque date is required');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setFormError('Amount must be greater than zero');
      return;
    }
    if (!bankName.trim()) {
      setFormError('Bank name is required');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        chequeNumber,
        contactId,
        accountId,
        chequeDate,
        amount: parseFloat(amount),
        bankName,
      };

      await api.createIssuedCheque(payload);
      setIsOpen(false);
      fetchCheques();
    } catch (err: any) {
      setFormError(err.message || 'Error recording cheque');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = async (id: string) => {
    if (!confirm('Clear this issued cheque? This will deduct the funds from your bank account and post to general ledger.')) return;
    try {
      await api.clearIssuedCheque(id);
      fetchCheques();
    } catch (err: any) {
      alert(err.message || 'Error clearing cheque');
    }
  };

  const handleBounce = async (id: string) => {
    if (!confirm('Mark this issued cheque as BOUNCED?')) return;
    try {
      await api.bounceIssuedCheque(id);
      fetchCheques();
    } catch (err: any) {
      alert(err.message || 'Error marking cheque');
    }
  };

  const filteredCheques = cheques.filter(c => 
    c.chequeNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.bankName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Action Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search issued PDCs..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-full rounded-lg bg-brand-900/20 border border-brand-800/40 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 py-2 text-sm"
          />
        </div>
        
        <button 
          onClick={openModal}
          className="btn-primary flex items-center gap-2 py-2 px-4 text-sm font-semibold rounded-lg"
        >
          <Plus size={18} /> Record Issued Cheque
        </button>
      </div>

      {/* Cheques table */}
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
                  <th className="p-4">Cheque Number</th>
                  <th className="p-4">Cheque Date (Clearing)</th>
                  <th className="p-4">Supplier</th>
                  <th className="p-4">Issuing Bank</th>
                  <th className="p-4 text-right">Amount</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-800/20 text-slate-300">
                {filteredCheques.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      No issued post dated cheques found.
                    </td>
                  </tr>
                ) : (
                  filteredCheques.map((cheque) => (
                    <tr key={cheque.id} className="hover:bg-brand-900/10 transition-colors">
                      <td className="p-4 font-mono font-semibold text-slate-200">{cheque.chequeNumber}</td>
                      <td className="p-4">
                        <div className="font-semibold text-slate-200">{new Date(cheque.chequeDate).toLocaleDateString()}</div>
                        <div className="text-[10px] text-slate-500">Issued: {new Date(cheque.dateIssued).toLocaleDateString()}</div>
                      </td>
                      <td className="p-4 font-medium text-slate-100">{cheque.contact?.name}</td>
                      <td className="p-4 font-medium">{cheque.bankName}</td>
                      <td className="p-4 text-right font-bold text-rose-450">
                        {currency} {cheque.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                          cheque.status === 'CLEARED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : cheque.status === 'BOUNCED'
                            ? 'bg-rose-500/10 text-rose-450 border border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {cheque.status}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {cheque.status === 'PENDING' ? (
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => handleClear(cheque.id)}
                              className="p-1 hover:bg-emerald-500/10 hover:text-emerald-400 text-slate-400 rounded text-xs flex items-center gap-1 border border-transparent hover:border-emerald-500/20 px-2.5 py-1"
                            >
                              <CheckSquare size={14} /> Clear
                            </button>
                            <button
                              onClick={() => handleBounce(cheque.id)}
                              className="p-1 hover:bg-rose-500/10 hover:text-rose-450 text-slate-400 rounded text-xs flex items-center gap-1 border border-transparent hover:border-rose-500/20 px-2.5 py-1"
                            >
                              <AlertTriangle size={14} /> Bounce
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500 font-semibold">Processed</span>
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

      {/* Record PDC Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-brand-950 border border-brand-800/40 rounded-xl p-6 shadow-glass space-y-4">
            <div className="flex justify-between items-center border-b border-brand-800/30 pb-3">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <CreditCard className="text-indigo-400" /> Record Issued Post Dated Cheque
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
                  <label className="text-xs font-semibold text-slate-400 uppercase">Cheque Number *</label>
                  <input 
                    type="text" 
                    value={chequeNumber} 
                    onChange={(e) => setChequeNumber(e.target.value)} 
                    placeholder="e.g. CHQ-654321"
                    className="w-full rounded-lg bg-brand-900/20 border border-brand-800/40 text-slate-250 p-2.5 font-mono"
                    required 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Cheque Date (Clearing) *</label>
                  <input 
                    type="date" 
                    value={chequeDate} 
                    onChange={(e) => setChequeDate(e.target.value)} 
                    className="w-full rounded-lg bg-brand-900/20 border border-brand-800/40 text-slate-250 p-2.5 font-semibold text-amber-400"
                    required 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Paid To Vendor *</label>
                  <select 
                    value={contactId} 
                    onChange={(e) => setContactId(e.target.value)} 
                    className="w-full rounded-lg bg-brand-900/20 border border-brand-800/40 text-slate-250 p-2.5"
                    required
                  >
                    <option value="" disabled className="bg-slate-950">Select Vendor</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id} className="bg-slate-950">{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Bank Source Account *</label>
                  <select 
                    value={accountId} 
                    onChange={(e) => setAccountId(e.target.value)} 
                    className="w-full rounded-lg bg-brand-900/20 border border-brand-800/40 text-slate-250 p-2.5"
                    required
                  >
                    <option value="" disabled className="bg-slate-950">Select Bank Account</option>
                    {bankAccounts.map(a => (
                      <option key={a.id} value={a.id} className="bg-slate-950">[{a.code}] {a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Cheque Amount *</label>
                  <input 
                    type="number" 
                    min="0.01"
                    step="any"
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)} 
                    placeholder="0.00"
                    className="w-full rounded-lg bg-brand-900/20 border border-brand-800/40 text-slate-250 p-2.5 font-semibold text-slate-100"
                    required 
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Our Issuing Bank *</label>
                  <input 
                    type="text" 
                    value={bankName} 
                    onChange={(e) => setBankName(e.target.value)} 
                    placeholder="e.g. Bank Current Account"
                    className="w-full rounded-lg bg-brand-900/20 border border-brand-800/40 text-slate-250 p-2.5"
                    required 
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
                  Record Issued Cheque
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
