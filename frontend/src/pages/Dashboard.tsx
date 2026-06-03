import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Layers, 
  FileSpreadsheet, 
  Clock, 
  PlusCircle, 
  ArrowRightLeft, 
  Briefcase 
} from 'lucide-react';
import { api } from '../services/api';

interface DashboardProps {
  setCurrentTab: (tab: string) => void;
  currency: string;
}

export default function Dashboard({ setCurrentTab, currency }: DashboardProps) {
  const [stats, setStats] = useState({
    revenue: 0.0,
    receivables: 0.0,
    cashBalance: 0.0,
    stockValue: 0.0,
    totalProducts: 0,
    invoicesCount: 0,
    journalsCount: 0,
  });
  const [recentJournals, setRecentJournals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);
        // Load Trial Balance for Cash & Asset calculation
        const tbData = await api.getTrialBalance();
        // Load Invoices
        const invoices = await api.getInvoices();
        // Load Products
        const products = await api.getProducts();
        // Load Journals
        const journals = await api.getJournals();

        // 1. Calculate Revenue (Total Sales Code 40100 debited/credited)
        const revenueLine = tbData.reportLines.find((r: any) => r.code === '40100');
        const rev = revenueLine ? revenueLine.creditBalance : 0.0;

        // 2. Calculate Receivables (AR Code 12100)
        const arLine = tbData.reportLines.find((r: any) => r.code === '12100');
        const ar = arLine ? arLine.debitBalance : 0.0;

        // 3. Cash & Bank balances (10100 + 10200)
        const cashLine = tbData.reportLines.find((r: any) => r.code === '10100');
        const bankLine = tbData.reportLines.find((r: any) => r.code === '10200');
        const cash = (cashLine ? cashLine.debitBalance : 0.0) + (bankLine ? bankLine.debitBalance : 0.0);

        // 4. Inventory Stock Value (Code 13100)
        const invLine = tbData.reportLines.find((r: any) => r.code === '13100');
        const stockVal = invLine ? invLine.debitBalance : 0.0;

        setStats({
          revenue: rev,
          receivables: ar,
          cashBalance: cash,
          stockValue: stockVal,
          totalProducts: products.length,
          invoicesCount: invoices.length,
          journalsCount: journals.length,
        });

        setRecentJournals(journals.slice(0, 5)); // show top 5 recent JVs
      } catch (error) {
        console.error('Error loading dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  const cardStats = [
    {
      title: 'Gross Revenue',
      value: `${currency} ${stats.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      icon: TrendingUp,
      color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      description: 'Total revenue recorded from invoice sales.',
    },
    {
      title: 'Accounts Receivable (AR)',
      value: `${currency} ${stats.receivables.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      description: 'Outstanding payments due from customers.',
    },
    {
      title: 'Liquid Cash & Bank',
      value: `${currency} ${stats.cashBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      icon: Briefcase,
      color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      description: 'Available cash and current bank holdings.',
    },
    {
      title: 'Stock Assets Value',
      value: `${currency} ${stats.stockValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      icon: Layers,
      color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      description: 'Real-time asset valuation of stocked items.',
    },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500" />
        <p className="text-slate-400 text-sm font-medium">Aggregating real-time financial ledger metrics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 relative">
      {/* Welcome banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Financial Performance Overview</h2>
          <p className="text-sm text-slate-400 mt-1">Real-time SaaS bookkeeping, multi-tenant auditing, and warehouse costing logs.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setCurrentTab('invoices')}
            className="btn-primary"
          >
            <PlusCircle size={16} /> New Sales Invoice
          </button>
          <button 
            onClick={() => setCurrentTab('journals')}
            className="btn-secondary"
          >
            <ArrowRightLeft size={16} /> Manual JV Entry
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {cardStats.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="glass-card p-6 flex flex-col justify-between h-40">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  {card.title}
                </span>
                <div className={`p-2 rounded-lg border ${card.color}`}>
                  <Icon size={18} />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-xl font-bold text-slate-100 tracking-tight">{card.value}</h3>
                <p className="text-[11px] text-slate-500 mt-1">{card.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Double Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Recent Transactions Log */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-200">Recent Journal Ledger Log</h3>
            <button 
              onClick={() => setCurrentTab('journals')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              View all vouchers
            </button>
          </div>
          <div className="glass-panel overflow-hidden">
            {recentJournals.length > 0 ? (
              <div className="divide-y divide-brand-900/30">
                {recentJournals.map((jv) => (
                  <div key={jv.id} className="p-4 hover:bg-brand-900/10 transition-colors flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-brand-900/50 rounded-lg text-slate-400 border border-brand-800/40">
                        <Clock size={16} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-200">
                            {jv.reference || `JV-${jv.id.substring(0, 6).toUpperCase()}`}
                          </span>
                          {jv.narration?.includes('Auto-generated') && (
                            <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-1 rounded uppercase tracking-wider font-medium border border-indigo-500/20">
                              System
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 truncate w-64 md:w-96 mt-0.5">{jv.narration || 'No memo available'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-slate-200">
                        {currency} {jv.lines.reduce((sum: number, l: any) => sum + l.debit, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {new Date(jv.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 text-sm font-medium bg-brand-950/20">
                No ledger postings recorded yet. Approve invoices or post manual JVs.
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Quick Setup Checklists / Actions */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-slate-200">System Information</h3>
          <div className="glass-panel p-6 space-y-4">
            <div className="space-y-2">
              <span className="text-xs text-slate-400 font-semibold block">Inventory Configurations</span>
              <p className="text-xs text-slate-300">
                Products configured with **FIFO** and **Weighted Average Costing** costing mechanisms can be assembled via the Manufacturing tab.
              </p>
            </div>
            <div className="w-full h-px bg-brand-800/50" />
            <div className="space-y-2">
              <span className="text-xs text-slate-400 font-semibold block">SaaS Subscription Info</span>
              <div className="flex justify-between items-center bg-indigo-500/5 p-2 rounded border border-indigo-500/10">
                <span className="text-xs text-indigo-300 font-semibold">Tier: Enterprise SaaS</span>
                <span className="text-[10px] bg-indigo-400/20 text-indigo-300 px-1.5 py-0.5 rounded font-bold">ACTIVE</span>
              </div>
            </div>
            <div className="w-full h-px bg-brand-800/50" />
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 bg-brand-900/20 border border-brand-800/40 rounded-lg">
                <h4 className="text-lg font-bold text-slate-200">{stats.totalProducts}</h4>
                <p className="text-[10px] text-slate-400 font-medium uppercase mt-0.5">Items / SKUs</p>
              </div>
              <div className="p-3 bg-brand-900/20 border border-brand-800/40 rounded-lg">
                <h4 className="text-lg font-bold text-slate-200">{stats.invoicesCount}</h4>
                <p className="text-[10px] text-slate-400 font-medium uppercase mt-0.5">Sales Invoices</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
