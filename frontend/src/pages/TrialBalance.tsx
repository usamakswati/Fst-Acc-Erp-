import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export default function TrialBalance() {
  const [tbData, setTbData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadTrialBalance() {
    try {
      const data = await api.getTrialBalance();
      setTbData(data);
    } catch (error) {
      console.error('Error loading Trial Balance:', error);
    }
  }

  useEffect(() => {
    async function init() {
      setLoading(true);
      await loadTrialBalance();
      setLoading(false);
    }
    init();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTrialBalance();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500" />
        <p className="text-slate-400 text-sm font-medium">Compiling double-entry general ledger totals...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title & Refresh */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Trial Balance Report</h2>
          <p className="text-sm text-slate-400 mt-1">
            Real-time balance check verifying that Total Debits strictly equals Total Credits.
          </p>
        </div>
        <button 
          onClick={handleRefresh}
          disabled={refreshing}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {tbData && (
        <>
          {/* Balanced Status Banner */}
          <div>
            {tbData.isBalanced ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex items-center gap-3 text-emerald-400">
                <CheckCircle2 size={20} className="shrink-0" />
                <div>
                  <span className="text-sm font-semibold block">General Ledger is in Balance</span>
                  <span className="text-xs text-slate-400">
                    All double-entry postings are balanced. Sum of debits matches sum of credits.
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex items-center gap-3 text-rose-450">
                <AlertCircle size={20} className="shrink-0" />
                <div>
                  <span className="text-sm font-semibold block">General Ledger Discrepancy Detected</span>
                  <span className="text-xs text-slate-400">
                    A difference of **{Math.abs(tbData.totalDebits - tbData.totalCredits).toFixed(2)}** was detected in the ledger postings.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Trial Balance Table */}
          <div className="glass-panel overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-brand-800 bg-brand-950/60 text-slate-300">
                  <th className="px-4 py-3 font-semibold w-24">Account Code</th>
                  <th className="px-4 py-3 font-semibold">Account Name</th>
                  <th className="px-4 py-3 font-semibold w-32">Account Type</th>
                  <th className="px-4 py-3 font-semibold w-40 text-right">Debit Balance</th>
                  <th className="px-4 py-3 font-semibold w-40 text-right">Credit Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-900/10">
                {tbData.reportLines.map((line: any) => {
                  const hasBalance = line.debitBalance > 0 || line.creditBalance > 0;
                  return (
                    <tr 
                      key={line.id} 
                      className={`interactive-tr ${!hasBalance ? 'opacity-40 hover:opacity-100' : ''}`}
                    >
                      <td className="px-4 py-3 font-mono font-bold text-indigo-400 select-all">{line.code}</td>
                      <td className="px-4 py-3 font-medium text-slate-200">{line.name}</td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] bg-slate-800 text-slate-400 font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide">
                          {line.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-200">
                        {line.debitBalance > 0 ? line.debitBalance.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-200">
                        {line.creditBalance > 0 ? line.creditBalance.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                      </td>
                    </tr>
                  );
                })}

                {/* Report Totals Row */}
                <tr className="bg-brand-950/60 font-bold border-t border-brand-700">
                  <td colSpan={3} className="px-4 py-4 text-slate-300 text-right uppercase tracking-wider text-xs">
                    Report Grand Totals
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-slate-100 text-base border-double border-b-4 border-brand-600">
                    {tbData.totalDebits.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-slate-100 text-base border-double border-b-4 border-brand-600">
                    {tbData.totalCredits.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
