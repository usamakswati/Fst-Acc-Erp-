import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Plus, CheckCircle, AlertTriangle, ArrowLeft, ArrowRightLeft, PlusCircle, Trash2 } from 'lucide-react';

interface JournalLineInput {
  accountId: string;
  debit: number;
  credit: number;
  narration: string;
}

export default function JournalVouchers() {
  const [journals, setJournals] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [reference, setReference] = useState('');
  const [narration, setNarration] = useState('');
  const [lines, setLines] = useState<JournalLineInput[]>([
    { accountId: '', debit: 0, credit: 0, narration: '' },
    { accountId: '', debit: 0, credit: 0, narration: '' }
  ]);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [jvData, coaData] = await Promise.all([
          api.getJournals(),
          api.getCoA()
        ]);
        setJournals(jvData);
        setAccounts(coaData);
      } catch (error) {
        console.error('Error loading JV data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const addLine = () => {
    setLines([...lines, { accountId: '', debit: 0, credit: 0, narration: '' }]);
  };

  const removeLine = (index: number) => {
    const updated = lines.filter((_, idx) => idx !== index);
    setLines(updated);
  };

  const updateLine = (index: number, field: keyof JournalLineInput, value: any) => {
    const updated = [...lines];
    const line = { ...updated[index] };

    if (field === 'accountId') {
      line.accountId = value;
    } else if (field === 'debit') {
      line.debit = Math.max(0, parseFloat(value) || 0);
      if (line.debit > 0) line.credit = 0; // cannot have both
    } else if (field === 'credit') {
      line.credit = Math.max(0, parseFloat(value) || 0);
      if (line.credit > 0) line.debit = 0; // cannot have both
    } else if (field === 'narration') {
      line.narration = value;
    }

    updated[index] = line;
    setLines(updated);
  };

  const getTotals = () => {
    const totalDebits = lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredits = lines.reduce((sum, l) => sum + l.credit, 0);
    return {
      debit: parseFloat(totalDebits.toFixed(2)),
      credit: parseFloat(totalCredits.toFixed(2)),
      diff: parseFloat(Math.abs(totalDebits - totalCredits).toFixed(2))
    };
  };

  const totals = getTotals();
  const isBalanced = totals.debit > 0 && totals.debit === totals.credit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!isBalanced) {
      setErrorMsg('Journal Voucher must be balanced (Total Debits must strictly equal Total Credits).');
      return;
    }

    // Verify all selected accounts
    const invalidLine = lines.find((l) => !l.accountId || (l.debit === 0 && l.credit === 0));
    if (invalidLine) {
      setErrorMsg('Please select a valid account and specify a debit or credit value for all rows.');
      return;
    }

    try {
      const entry = await api.createJournal({
        date,
        reference,
        narration,
        lines: lines.map((l) => ({
          accountId: l.accountId,
          debit: l.debit,
          credit: l.credit,
          narration: l.narration
        }))
      });

      setSuccessMsg(`Journal Entry posted successfully! Reference ID: ${entry.reference || entry.id.substring(0, 8)}`);
      // Reload journals list
      const jvData = await api.getJournals();
      setJournals(jvData);
      
      // Reset form
      setDate(new Date().toISOString().substring(0, 10));
      setReference('');
      setNarration('');
      setLines([
        { accountId: '', debit: 0, credit: 0, narration: '' },
        { accountId: '', debit: 0, credit: 0, narration: '' }
      ]);
      setTimeout(() => {
        setIsCreating(false);
        setSuccessMsg('');
      }, 1500);

    } catch (error: any) {
      setErrorMsg(error.message || 'Failed to post Journal Voucher.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500" />
        <p className="text-slate-400 text-sm font-medium">Fetching journal transaction vouchers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Journal Vouchers (JV)</h2>
          <p className="text-sm text-slate-400 mt-1">
            {isCreating ? 'Create manual balanced accounting entries.' : 'View general ledger entries and audit transactions.'}
          </p>
        </div>
        {!isCreating && (
          <button onClick={() => setIsCreating(true)} className="btn-primary">
            <PlusCircle size={16} /> New Journal Voucher
          </button>
        )}
      </div>

      {isCreating ? (
        // CREATE JOURNAL VOUCHER FORM
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center gap-3">
            <button 
              type="button" 
              onClick={() => setIsCreating(false)}
              className="p-1 rounded-lg hover:bg-brand-900/50 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <h3 className="text-base font-bold text-slate-200">Manual Entry Form</h3>
          </div>

          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-lg text-rose-400 flex items-center gap-3 text-sm">
              <AlertTriangle size={18} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-lg text-emerald-400 flex items-center gap-3 text-sm">
              <CheckCircle size={18} className="shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Header Details */}
          <div className="glass-panel p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase">Voucher Date</label>
              <input 
                type="date" 
                value={date} 
                onChange={(e) => setDate(e.target.value)} 
                className="w-full"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase">Reference #</label>
              <input 
                type="text" 
                value={reference} 
                onChange={(e) => setReference(e.target.value)} 
                placeholder="e.g. JV-2026-0001"
                className="w-full"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase">Narration / Memo</label>
              <input 
                type="text" 
                value={narration} 
                onChange={(e) => setNarration(e.target.value)} 
                placeholder="Voucher narrative description"
                className="w-full"
              />
            </div>
          </div>

          {/* Lines Table */}
          <div className="glass-panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm min-w-[800px]">
                <thead>
                  <tr className="border-b border-brand-800 bg-brand-950/60 text-slate-300">
                    <th className="px-3 py-2.5 font-medium w-12 text-center">#</th>
                    <th className="px-3 py-2.5 font-medium w-1/3">Account Selection</th>
                    <th className="px-3 py-2.5 font-medium w-28">Debit</th>
                    <th className="px-3 py-2.5 font-medium w-28">Credit</th>
                    <th className="px-3 py-2.5 font-medium w-2/5">Line Narrative</th>
                    <th className="px-3 py-2.5 font-medium w-12 text-center">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={idx} className="border-b border-brand-900/20 hover:bg-brand-900/10">
                      <td className="px-3 py-2 text-center text-slate-400 text-xs font-semibold">{idx + 1}</td>
                      <td className="px-3 py-2">
                        <select
                          value={line.accountId}
                          onChange={(e) => updateLine(idx, 'accountId', e.target.value)}
                          className="w-full"
                        >
                          <option value="">-- Select GL Account --</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              [{a.code}] {a.name} - ({a.type})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={line.debit || ''}
                          placeholder="0.00"
                          onChange={(e) => updateLine(idx, 'debit', e.target.value)}
                          className="w-full text-right font-mono"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={line.credit || ''}
                          placeholder="0.00"
                          onChange={(e) => updateLine(idx, 'credit', e.target.value)}
                          className="w-full text-right font-mono"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={line.narration}
                          placeholder="Line level reference notes"
                          onChange={(e) => updateLine(idx, 'narration', e.target.value)}
                          className="w-full"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          disabled={lines.length <= 2}
                          className="p-1 hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions Panel */}
            <div className="flex items-center justify-between p-3 bg-brand-950/40 border-t border-brand-800/40">
              <button
                type="button"
                onClick={addLine}
                className="btn-secondary text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/10"
              >
                <Plus size={16} /> Add Line Row
              </button>
            </div>
          </div>

          {/* Ledger Balancing Indicator */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Warning Banner */}
            <div>
              {!isBalanced && (
                <div className="bg-amber-500/5 border border-amber-500/15 p-4 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={18} />
                  <div>
                    <h5 className="text-xs font-semibold text-amber-400 uppercase tracking-wide">Journal Discrepancy</h5>
                    <p className="text-xs text-slate-400 mt-1">
                      Debits and credits must match. Current imbalance difference is **{totals.diff}**.
                    </p>
                  </div>
                </div>
              )}
              {isBalanced && (
                <div className="bg-emerald-500/5 border border-emerald-500/15 p-4 rounded-xl flex items-start gap-3">
                  <CheckCircle className="text-emerald-400 shrink-0 mt-0.5" size={18} />
                  <div>
                    <h5 className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">Ledger Balanced</h5>
                    <p className="text-xs text-slate-400 mt-1">
                      Debits equal credits. The entry is ready to be committed to the database.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Calculations Summary */}
            <div className="flex justify-end">
              <div className="w-80 bg-brand-950/50 border border-brand-800/40 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Debits:</span>
                  <span className="font-mono font-bold text-slate-200">{totals.debit.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Credits:</span>
                  <span className="font-mono font-bold text-slate-200">{totals.credit.toFixed(2)}</span>
                </div>
                <div className="w-full h-px bg-brand-800/60 my-2" />
                <div className="flex justify-between font-bold">
                  <span className="text-slate-400">Difference:</span>
                  <span className={totals.diff > 0 ? 'text-rose-450 font-mono' : 'text-emerald-400 font-mono'}>
                    {totals.diff.toFixed(2)}
                  </span>
                </div>
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={!isBalanced}
                    className="w-full btn-primary bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Post Journal Voucher
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      ) : (
        // LIST JOURNAL VOUCHERS
        <div className="glass-panel overflow-hidden">
          {journals.length > 0 ? (
            <div className="divide-y divide-brand-900/30">
              {journals.map((jv) => (
                <div key={jv.id} className="p-6 hover:bg-brand-900/5 transition-colors">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-slate-200">
                          {jv.reference || `JV-${jv.id.substring(0, 6).toUpperCase()}`}
                        </span>
                        {jv.narration?.includes('Auto-generated') && (
                          <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/20 font-bold uppercase">
                            System Posting
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{jv.narration || 'Manual Journal entry voucher.'}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-500">Date: {new Date(jv.date).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Lines details table */}
                  <div className="bg-brand-950/40 rounded-lg border border-brand-850/40 overflow-hidden">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-brand-900/20 text-slate-400 border-b border-brand-800/40">
                          <th className="px-3 py-2 font-medium w-1/4">Account Code & Name</th>
                          <th className="px-3 py-2 font-medium w-2/5">Line Description</th>
                          <th className="px-3 py-2 font-medium w-28 text-right">Debit</th>
                          <th className="px-3 py-2 font-medium w-28 text-right">Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jv.lines.map((l: any) => (
                          <tr key={l.id} className="border-b border-brand-900/10 hover:bg-brand-900/5">
                            <td className="px-3 py-2 text-slate-300">
                              <span className="font-mono font-semibold text-indigo-400 mr-2">[{l.account.code}]</span>
                              {l.account.name}
                            </td>
                            <td className="px-3 py-2 text-slate-400 truncate max-w-xs">{l.narration || '-'}</td>
                            <td className="px-3 py-2 text-right font-mono font-semibold text-slate-200">
                              {l.debit > 0 ? l.debit.toFixed(2) : '-'}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-semibold text-slate-200">
                              {l.credit > 0 ? l.credit.toFixed(2) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 text-sm font-medium bg-brand-950/20">
              No journal transactions recorded. Press "New Journal Voucher" to create.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
