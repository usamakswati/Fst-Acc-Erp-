import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { FileText, Coins, Landmark, Calendar, Search, DollarSign, Activity } from 'lucide-react';

interface PurchaseTransaction {
  id: string;
  date: string;
  type: string; // BILL, PAYMENT, PDC
  reference: string;
  name: string; // Vendor Name
  amount: number;
  status: string;
}

export default function PurchasesAll({ currency }: { currency: string }) {
  const [transactions, setTransactions] = useState<PurchaseTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Stats metrics
  const [totalBills, setTotalBills] = useState(0);
  const [totalPayments, setTotalPayments] = useState(0);
  const [totalPDCs, setTotalPDCs] = useState(0);

  async function loadTransactions() {
    try {
      setLoading(true);

      // Fetch Bills
      const bills = await api.getBills();

      // Fetch Payments
      const payments = await api.getPayments();

      // Fetch Issued PDCs
      const cheques = await api.getIssuedCheques();

      // Compile stats
      const billSum = bills
        .filter((b: any) => b.status === 'APPROVED' || b.status === 'PAID')
        .reduce((sum: number, b: any) => sum + b.grandTotal, 0);
      const paySum = payments
        .reduce((sum: number, p: any) => sum + p.amount, 0);
      const pdcSum = cheques
        .filter((c: any) => c.status === 'PENDING')
        .reduce((sum: number, c: any) => sum + c.amount, 0);

      setTotalBills(billSum);
      setTotalPayments(paySum);
      setTotalPDCs(pdcSum);

      // Map to standard transaction structure
      const txs: PurchaseTransaction[] = [];

      bills.forEach((b: any) => {
        txs.push({
          id: b.id,
          date: b.date,
          type: 'Supplier Bill',
          reference: b.billNumber,
          name: b.contact?.name || 'Unknown Vendor',
          amount: b.grandTotal,
          status: b.status
        });
      });

      payments.forEach((p: any) => {
        txs.push({
          id: p.id,
          date: p.date,
          type: 'Vendor Payment',
          reference: p.paymentNumber,
          name: p.contact?.name || 'Supplier',
          amount: p.amount,
          status: p.status
        });
      });

      cheques.forEach((c: any) => {
        txs.push({
          id: c.id,
          date: c.chequeDate,
          type: `Issued PDC (${c.bankName})`,
          reference: c.chequeNumber,
          name: c.contact?.name || 'Supplier',
          amount: c.amount,
          status: c.status
        });
      });

      // Sort by date desc
      txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(txs);
    } catch (err) {
      console.error('Error loading transaction history:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTransactions();
  }, []);

  const filteredTransactions = transactions.filter(t => 
    t.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Metric 1 */}
        <div className="bg-brand-950/40 border border-brand-800/30 p-4 rounded-xl shadow-glass flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase">Total Bill Purchases</p>
            <h3 className="text-lg font-bold text-slate-100 mt-1">
              {currency} {totalBills.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </h3>
          </div>
          <div className="p-3 bg-rose-500/10 text-rose-450 rounded-lg">
            <FileText size={20} />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-brand-950/40 border border-brand-800/30 p-4 rounded-xl shadow-glass flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase">Total Payments Made</p>
            <h3 className="text-lg font-bold text-slate-100 mt-1">
              {currency} {totalPayments.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </h3>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <Coins size={20} />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-brand-950/40 border border-brand-800/30 p-4 rounded-xl shadow-glass flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase">Outstanding Issued PDCs</p>
            <h3 className="text-lg font-bold text-slate-100 mt-1">
              {currency} {totalPDCs.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </h3>
          </div>
          <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-lg">
            <Landmark size={20} />
          </div>
        </div>
      </div>

      {/* Action Row */}
      <div className="flex justify-between items-center gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search transaction log..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-full rounded-lg bg-brand-900/20 border border-brand-800/40 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 py-2 text-sm"
          />
        </div>
        <div className="text-xs text-slate-500 flex items-center gap-1.5 bg-brand-900/15 border border-brand-800/30 px-3 py-1.5 rounded-lg shrink-0">
          <Activity size={14} className="text-indigo-400" />
          <span>Real-time Unified Purchases Ledger Log</span>
        </div>
      </div>

      {/* Transactions list */}
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
                  <th className="p-4">Transaction Date</th>
                  <th className="p-4">Transaction Type</th>
                  <th className="p-4">Reference ID</th>
                  <th className="p-4">Supplier Name</th>
                  <th className="p-4 text-right">Amount</th>
                  <th className="p-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-800/20 text-slate-300">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      No purchase transactions found.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx, idx) => (
                    <tr key={idx} className="hover:bg-brand-900/10 transition-colors">
                      <td className="p-4 flex items-center gap-2">
                        <Calendar size={14} className="text-slate-500 shrink-0" />
                        <span>{new Date(tx.date).toLocaleDateString()}</span>
                      </td>
                      <td className="p-4 font-semibold text-slate-200">{tx.type}</td>
                      <td className="p-4 font-mono text-xs">{tx.reference}</td>
                      <td className="p-4 font-medium text-slate-100">{tx.name}</td>
                      <td className="p-4 text-right font-bold text-slate-200">
                        {currency} {tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                          tx.status === 'APPROVED' || tx.status === 'PAID' || tx.status === 'CLEARED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : tx.status === 'BOUNCED' || tx.status === 'FAILED'
                            ? 'bg-rose-500/10 text-rose-450 border border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {tx.status}
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
    </div>
  );
}
