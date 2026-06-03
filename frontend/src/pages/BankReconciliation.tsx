import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  ArrowLeft, 
  Plus,
  ArrowRight,
  FileSpreadsheet,
  Trash2,
  Bookmark
} from 'lucide-react';

interface BankReconciliationProps {
  currency: string;
}

export default function BankReconciliation({ currency }: BankReconciliationProps) {
  const [statements, setStatements] = useState<any[]>([]);
  const [coa, setCoa] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatement, setSelectedStatement] = useState<any>(null);
  const [selectedLine, setSelectedLine] = useState<any>(null);

  // Import states
  const [isImporting, setIsImporting] = useState(false);
  const [bankAccountId, setBankAccountId] = useState('');
  const [fileName, setFileName] = useState('');
  const [csvText, setCsvText] = useState('');
  const [fileInput, setFileInput] = useState<File | null>(null);

  // Manual posting offset state
  const [offsetAccountId, setOffsetAccountId] = useState('');
  const [directReference, setDirectReference] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statementData, coaData] = await Promise.all([
        api.getBankStatements(),
        api.getCoA()
      ]);
      setStatements(statementData);
      // Flatten hierarchical CoA if nested, or use standard array
      const flatCoa = Array.isArray(coaData) ? coaData : [];
      setCoa(flatCoa);
    } catch (error) {
      console.error('Error loading bank reconciliation data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadStatementDetails = async (id: string) => {
    try {
      setLoading(true);
      const detail = await api.getBankStatement(id);
      setSelectedStatement(detail);
      // Auto-select first unmatched line if available
      const firstUnmatched = detail.lines.find((l: any) => l.status === 'UNMATCHED');
      setSelectedLine(firstUnmatched || detail.lines[0] || null);
    } catch (error) {
      console.error('Error loading statement details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileInput(file);
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvText(event.target?.result as string || '');
      };
      reader.readAsText(file);
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!bankAccountId) {
      setErrorMsg('Please select a bank account to associate with this statement.');
      return;
    }

    if (!csvText.trim()) {
      setErrorMsg('Please upload a statement file or paste CSV content.');
      return;
    }

    try {
      setActionLoading(true);
      await api.importBankStatement({
        bankAccountId,
        fileName: fileName || 'statement_pasted.csv',
        csvText
      });
      setSuccessMsg('Bank statement imported successfully.');
      setIsImporting(false);
      
      // Reset form
      setBankAccountId('');
      setFileName('');
      setCsvText('');
      setFileInput(null);

      await loadData();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error: any) {
      setErrorMsg(error.error || error.message || 'Failed to import statement');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMatch = async (candidate: any) => {
    if (!selectedLine) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      setActionLoading(true);
      await api.matchStatementLine({
        lineId: selectedLine.id,
        targetType: candidate.type,
        targetId: candidate.id
      });
      setSuccessMsg('Transaction matched and general ledger updated.');
      
      // Reload statement details to refresh matches
      await loadStatementDetails(selectedStatement.id);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error: any) {
      setErrorMsg(error.error || error.message || 'Matching failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLine || !offsetAccountId) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      setActionLoading(true);
      await api.createMatchStatementLine({
        lineId: selectedLine.id,
        offsetAccountId,
        reference: directReference || 'BANK-RECON'
      });
      setSuccessMsg('GL entry recorded and transaction reconciled successfully.');
      setOffsetAccountId('');
      setDirectReference('');
      
      // Reload details
      await loadStatementDetails(selectedStatement.id);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error: any) {
      setErrorMsg(error.error || error.message || 'Direct reconciliation failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnmatch = async (lineId: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      setActionLoading(true);
      await api.unmatchStatementLine(lineId);
      setSuccessMsg('Reconciliation reverted. Journal entries removed and document status reset.');
      
      // Reload details
      await loadStatementDetails(selectedStatement.id);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error: any) {
      setErrorMsg(error.error || error.message || 'Unmatching failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter Chart of accounts for Bank accounts vs offset accounts
  const bankAccounts = coa.filter((acc: any) => acc.type === 'ASSET' && (acc.code.startsWith('101') || acc.code.startsWith('102')));
  const offsetAccounts = coa.filter((acc: any) => acc.id !== selectedStatement?.bankAccountId);

  // Template/Dummy CSV generator
  const downloadSample = () => {
    const csvContent = "Date,Description,Amount,Reference\n" +
      "2026-05-20,Invoice clearing Stark Logistics,1416.00,REC-INV-001\n" +
      "2026-05-20,Supplier payment RAM purchase,-590.00,PAY-BIL-001\n" +
      "2026-05-20,Direct Bank Fees withdrawal,-15.00,FEE-MAY-01\n" +
      "2026-05-20,Dividend Interest Credit,250.00,INT-MAY-01\n";
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "bank_statement_sample.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && statements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500" />
        <p className="text-slate-400 text-sm font-medium">Fetching bank accounts statements...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Bank & Cash Reconciliation</h2>
          <p className="text-sm text-slate-400 mt-1">
            {isImporting 
              ? 'Import bank statement CSV ledger' 
              : selectedStatement 
                ? `Reconciling statement for ${selectedStatement.bankAccount.name}` 
                : 'Import statements and match bank line clearings to sales invoices, supplier bills, or post direct bank fees.'
            }
          </p>
        </div>
        {!isImporting && !selectedStatement && (
          <button onClick={() => setIsImporting(true)} className="btn-primary">
            <Upload size={16} /> Import Statement
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

      {isImporting ? (
        // IMPORT VIEW
        <form onSubmit={handleImportSubmit} className="space-y-6 max-w-3xl">
          <div className="flex items-center gap-3">
            <button 
              type="button" 
              onClick={() => setIsImporting(false)}
              className="p-1 rounded-lg hover:bg-brand-900/50 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <h3 className="text-base font-bold text-slate-200">Import Statement File</h3>
          </div>

          <div className="glass-panel p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase">Reconcile Target GL Account</label>
                <select
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(e.target.value)}
                  className="w-full"
                  required
                >
                  <option value="">-- Choose Cash/Bank GL --</option>
                  {bankAccounts.map((acc: any) => (
                    <option key={acc.id} value={acc.id}>
                      [{acc.code}] {acc.name}
                    </option>
                  ))}
                  {bankAccounts.length === 0 && (
                    <option disabled>No Asset accounts starting with 101/102 found</option>
                  )}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase">Statement Name / Label</label>
                <input 
                  type="text" 
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="e.g. AlliedBank_May2026.csv"
                  className="w-full"
                  required
                />
              </div>
            </div>

            {/* CSV selector / Uploader */}
            <div className="border-2 border-dashed border-brand-800/80 rounded-xl p-8 text-center bg-brand-950/20 hover:bg-brand-900/10 hover:border-indigo-500/40 transition-all space-y-4">
              <div className="flex justify-center">
                <Upload size={36} className="text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-300">
                  {fileInput ? `File Selected: ${fileInput.name}` : 'Drag and drop your bank CSV statement here, or click to browse'}
                </p>
                <p className="text-xs text-slate-500 mt-1">Accepts standard comma-separated formats (.csv)</p>
              </div>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="statement-file-input"
              />
              <div className="flex justify-center gap-3">
                <label
                  htmlFor="statement-file-input"
                  className="btn-secondary text-xs px-4 py-1.5 cursor-pointer"
                >
                  Browse File
                </label>
                <button
                  type="button"
                  onClick={downloadSample}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                >
                  Download Sample CSV Template
                </button>
              </div>
            </div>

            {/* Paste CSV Area fallback */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase">Or Paste Raw CSV Data Directly</label>
              <textarea
                rows={5}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="Date,Description,Amount,Reference&#10;2026-05-20,Customer stark clearing,1416.00,REC-INV-001&#10;2026-05-20,Interest credit,120.00,"
                className="w-full font-mono text-xs bg-slate-900 border border-brand-800 text-slate-200"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button 
              type="button" 
              onClick={() => setIsImporting(false)} 
              className="btn-secondary"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={actionLoading}
              className="btn-primary px-6"
            >
              {actionLoading ? 'Uploading...' : 'Import Statement'}
            </button>
          </div>
        </form>

      ) : selectedStatement ? (
        // RECONCILIATION WORKSPACE VIEW
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                type="button" 
                onClick={() => { setSelectedStatement(null); setSelectedLine(null); loadData(); }}
                className="p-1 rounded-lg hover:bg-brand-900/50 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <h3 className="text-base font-bold text-slate-200">{selectedStatement.fileName}</h3>
                <p className="text-xs text-slate-450 mt-0.5">Account: <span className="font-semibold text-indigo-300">[{selectedStatement.bankAccount.code}] {selectedStatement.bankAccount.name}</span></p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                selectedStatement.status === 'COMPLETED' 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}>
                {selectedStatement.status}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Left Col: Imported Statement lines (Span 3) */}
            <div className="lg:col-span-3 space-y-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Bank Statement Transactions Ledger</span>
              <div className="glass-panel overflow-hidden border border-brand-850">
                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-brand-950/60 text-slate-300 border-b border-brand-800/80 sticky top-0 z-10">
                        <th className="px-3 py-2 font-medium w-24">Date</th>
                        <th className="px-3 py-2 font-medium">Description / Reference</th>
                        <th className="px-3 py-2 font-medium text-right w-24">Amount</th>
                        <th className="px-3 py-2 font-medium text-center w-24">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-900/10">
                      {selectedStatement.lines.map((line: any) => {
                        const isSelected = selectedLine?.id === line.id;
                        const isMatched = line.status === 'MATCHED';
                        const isDeposit = line.amount > 0;
                        return (
                          <tr 
                            key={line.id} 
                            onClick={() => setSelectedLine(line)}
                            className={`cursor-pointer transition-all ${
                              isSelected 
                                ? 'bg-indigo-500/10 hover:bg-indigo-500/15 border-l-2 border-indigo-500' 
                                : 'hover:bg-brand-900/5'
                            }`}
                          >
                            <td className="px-3 py-3 text-slate-400 font-mono">
                              {new Date(line.date).toLocaleDateString()}
                            </td>
                            <td className="px-3 py-3">
                              <span className="text-slate-200 font-medium block">{line.description}</span>
                              {line.reference && (
                                <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">Ref: {line.reference}</span>
                              )}
                            </td>
                            <td className={`px-3 py-3 text-right font-mono font-bold ${
                              isDeposit ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {isDeposit ? '+' : ''}{line.amount.toFixed(2)}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                                isMatched 
                                  ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/10' 
                                  : 'bg-slate-500/10 text-slate-400 border border-slate-500/10'
                              }`}>
                                {line.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right Col: Reconciliation Actions (Span 2) */}
            <div className="lg:col-span-2 space-y-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Match and Ledger Posting Panel</span>
              
              {selectedLine ? (
                <div className="glass-panel p-5 space-y-6 border border-brand-850">
                  {/* Selected Line details */}
                  <div className="bg-brand-950/40 p-4 rounded-xl border border-brand-900/40 space-y-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Currently Selected Bank Record</span>
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-sm font-bold text-slate-100">{selectedLine.description}</h4>
                        <p className="text-xs text-slate-450 mt-1">Date: <strong>{new Date(selectedLine.date).toLocaleDateString()}</strong></p>
                      </div>
                      <span className={`text-base font-mono font-extrabold ${selectedLine.amount > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {selectedLine.amount > 0 ? '+' : ''}{currency} {selectedLine.amount.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {selectedLine.status === 'MATCHED' ? (
                    // MATCHED STATUS CARD
                    <div className="space-y-4">
                      <div className="bg-emerald-500/5 border border-emerald-500/15 p-4 rounded-lg text-emerald-450 flex items-start gap-2.5">
                        <CheckCircle className="shrink-0 mt-0.5" size={16} />
                        <div className="text-xs space-y-1">
                          <span className="font-bold block">Reconciled & Matched</span>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            Matched to: <strong>{selectedLine.matchedTransactionType}</strong>
                          </p>
                          {selectedLine.matchDetail && (
                            <p className="text-[11px] text-slate-400 font-mono">
                              Doc Reference: {
                                selectedLine.matchedTransactionType === 'INVOICE' 
                                  ? selectedLine.matchDetail.invoiceNumber 
                                  : selectedLine.matchedTransactionType === 'BILL' 
                                    ? selectedLine.matchDetail.billNumber 
                                    : selectedLine.matchDetail.reference
                              }
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleUnmatch(selectedLine.id)}
                        disabled={actionLoading}
                        className="w-full btn-secondary text-rose-400 border-rose-500/20 hover:bg-rose-500/10 py-2 text-xs font-bold flex items-center justify-center gap-1.5"
                      >
                        <Trash2 size={14} /> Revert Match (Unmatch)
                      </button>
                    </div>
                  ) : (
                    // UNMATCHED MATCH OPTIONS
                    <div className="space-y-6">
                      {/* Suggestions list */}
                      <div className="space-y-3">
                        <span className="text-[10px] font-bold text-slate-550 uppercase tracking-wide block">
                          Suggested Match Candidates (Amount Matches)
                        </span>

                        {selectedLine.candidates && selectedLine.candidates.length > 0 ? (
                          <div className="space-y-2">
                            {selectedLine.candidates.map((cand: any) => (
                              <div 
                                key={cand.id}
                                className="bg-slate-900 border border-brand-800 rounded-lg p-3 flex items-center justify-between hover:border-indigo-500/30 transition-all"
                              >
                                <div className="text-xs space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-indigo-400">[{cand.type}]</span>
                                    <span className="text-slate-200 font-medium">{cand.reference}</span>
                                  </div>
                                  <p className="text-[11px] text-slate-400">{cand.contactName}</p>
                                  <p className="text-[10px] text-slate-500 font-mono">{new Date(cand.date).toLocaleDateString()}</p>
                                </div>
                                <button
                                  onClick={() => handleMatch(cand)}
                                  disabled={actionLoading}
                                  className="btn-success text-[11px] px-2.5 py-1 font-bold"
                                >
                                  OK / Match
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 rounded-lg bg-brand-950/20 text-center text-xs text-slate-500 border border-brand-900/10">
                            No matching unpaid invoices or bills found in system with this exact total.
                          </div>
                        )}
                      </div>

                      {/* Manual create reconciliation direct ledger voucher */}
                      <div className="border-t border-brand-850 pt-5 space-y-4">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-550 uppercase tracking-wide">
                          <Bookmark size={12} /> Post Direct GL Payment Match
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">
                          For transactions not tied to an invoice/bill (e.g. bank interest, service charge, wire fee), select an offset account to post a direct journal payment.
                        </p>

                        <form onSubmit={handleCreateMatch} className="space-y-3 text-xs">
                          <div className="space-y-1">
                            <label className="text-slate-450 font-semibold block">Offset Ledger Account</label>
                            <select
                              value={offsetAccountId}
                              onChange={(e) => setOffsetAccountId(e.target.value)}
                              className="w-full py-1 text-xs"
                              required
                            >
                              <option value="">-- Select GL Account --</option>
                              {offsetAccounts.map((acc: any) => (
                                <option key={acc.id} value={acc.id}>
                                  [{acc.code}] {acc.name} - ({acc.type})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-slate-450 font-semibold block">Posting Reference</label>
                            <input
                              type="text"
                              value={directReference}
                              onChange={(e) => setDirectReference(e.target.value)}
                              placeholder="e.g. BankFee_May"
                              className="w-full text-xs"
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={actionLoading || !offsetAccountId}
                            className="w-full btn-primary py-2 text-xs font-bold flex items-center justify-center gap-1"
                          >
                            <Plus size={14} /> Create & Match Posting
                          </button>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-12 text-center text-xs text-slate-500 bg-brand-950/20 rounded-xl border border-brand-900/10">
                  Select a statement line on the left to start match reconciliation.
                </div>
              )}
            </div>
          </div>
        </div>

      ) : (
        // DASHBOARD VIEW (LIST OF STATEMENTS)
        <div className="glass-panel overflow-hidden">
          {statements.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-brand-800 bg-brand-950/60 text-slate-300">
                    <th className="px-4 py-3 font-semibold">Statement File / Name</th>
                    <th className="px-4 py-3 font-semibold">Associated Account</th>
                    <th className="px-4 py-3 font-semibold w-32">Imported</th>
                    <th className="px-4 py-3 font-semibold w-24 text-center">Lines</th>
                    <th className="px-4 py-3 font-semibold w-28 text-center">Status</th>
                    <th className="px-4 py-3 font-semibold w-20 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-900/10">
                  {statements.map((st) => (
                    <tr key={st.id} className="interactive-tr">
                      <td className="px-4 py-3.5 font-bold text-slate-200">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet size={16} className="text-indigo-400" />
                          <span>{st.fileName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-350 font-medium">
                        [{st.bankAccount.code}] {st.bankAccount.name}
                      </td>
                      <td className="px-4 py-3.5 text-slate-400 font-mono">
                        {new Date(st.importDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3.5 text-center font-mono font-semibold text-slate-350">
                        {st._count.lines}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                          st.status === 'COMPLETED' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {st.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => loadStatementDetails(st.id)}
                          className="btn-secondary text-xs px-3 py-1 font-bold flex items-center justify-center gap-1 text-indigo-400 border-indigo-500/25 hover:bg-indigo-500/10"
                        >
                          Reconcile <ArrowRight size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 text-sm font-medium bg-brand-950/20">
              No bank statement ledgers imported yet. Press "Import Statement" to upload your CSV file.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
