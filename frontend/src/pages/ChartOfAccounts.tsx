import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Network, Plus, FolderTree } from 'lucide-react';

export default function ChartOfAccounts() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAccounts() {
      try {
        setLoading(true);
        const data = await api.getCoA();
        setAccounts(data);
      } catch (error) {
        console.error('Error loading CoA:', error);
      } finally {
        setLoading(false);
      }
    }
    loadAccounts();
  }, []);

  const accountTypes = [
    { type: 'ASSET', title: 'Assets', description: 'What you own (Cash, Inventory, Receivables)', color: 'border-l-4 border-indigo-500' },
    { type: 'LIABILITY', title: 'Liabilities', description: 'What you owe (Payables, Tax Payable)', color: 'border-l-4 border-rose-500' },
    { type: 'EQUITY', title: 'Equity', description: 'Owner\'s capital & retained earnings', color: 'border-l-4 border-emerald-500' },
    { type: 'REVENUE', title: 'Revenue', description: 'Income from sales and services', color: 'border-l-4 border-sky-500' },
    { type: 'EXPENSE', title: 'Expenses', description: 'Cost of doing business (COGS, Labor)', color: 'border-l-4 border-amber-500' }
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500" />
        <p className="text-slate-400 text-sm font-medium">Fetching general ledger chart structures...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-100">Chart of Accounts (CoA)</h2>
        <p className="text-sm text-slate-400 mt-1">Hierarchical tree tracking accounts ledger definitions with standard numbering conventions.</p>
      </div>

      {/* Account Type Grid cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accountTypes.map((category) => {
          const catAccounts = accounts.filter((a) => a.type === category.type);

          return (
            <div key={category.type} className="glass-panel p-5 flex flex-col h-[400px]">
              {/* Category Header */}
              <div className={`pl-3 pb-3 mb-4 border-b border-brand-850 ${category.color}`}>
                <h3 className="text-base font-bold text-slate-200">{category.title}</h3>
                <span className="text-[11px] text-slate-500 block mt-0.5">{category.description}</span>
              </div>

              {/* Account codes list */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {catAccounts.length > 0 ? (
                  catAccounts.map((acc) => (
                    <div 
                      key={acc.id} 
                      className="p-2.5 bg-brand-900/10 hover:bg-brand-900/30 border border-brand-800/30 hover:border-brand-700/40 rounded-lg flex justify-between items-center transition-all"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-mono font-bold text-indigo-400 select-all">
                          {acc.code}
                        </span>
                        <h4 className="text-xs font-semibold text-slate-200 truncate" title={acc.name}>
                          {acc.name}
                        </h4>
                      </div>
                      <span className="text-[9px] uppercase bg-slate-800 text-slate-400 font-semibold px-1 rounded">
                        {acc.type.substring(0, 3)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-xs text-slate-650 py-8">
                    No accounts defined for this category.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
