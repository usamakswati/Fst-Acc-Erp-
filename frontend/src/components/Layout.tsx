import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Network, 
  BookOpen, 
  FileText, 
  ShoppingBag,
  Layers, 
  Hammer, 
  Scale, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  User,
  Building2,
  Lock,
  FileSpreadsheet,
  Landmark,
  DollarSign,
  ChevronDown,
  Banknote,
  Boxes,
  Settings,
  BarChart3
} from 'lucide-react';

interface LayoutProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  user: any;
  tenant: any;
  onLogout: () => void;
  children: React.ReactNode;
}

export default function Layout({ 
  currentTab, 
  setCurrentTab, 
  user, 
  tenant, 
  onLogout, 
  children 
}: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [salesOpen, setSalesOpen] = useState(currentTab.startsWith('sales-'));
  const [purchasesOpen, setPurchasesOpen] = useState(currentTab.startsWith('purchases-'));
  const [inventoryOpen, setInventoryOpen] = useState(currentTab.startsWith('inventory-'));

  const salesSubItems = [
    { id: 'sales-invoices', name: 'Invoices' },
    { id: 'sales-pos', name: 'POS Invoices' },
    { id: 'sales-receipts', name: 'Receipts' },
    { id: 'sales-pdc', name: 'Post Dated Cheque Received' },
    { id: 'sales-all', name: 'Sales All' },
    { id: 'sales-orders', name: 'Orders' },
    { id: 'sales-customers', name: 'Customers' },
  ];

  const purchasesSubItems = [
    { id: 'purchases-all', name: 'Purchases All' },
    { id: 'purchases-bills', name: 'Bills' },
    { id: 'purchases-payments', name: 'Payments' },
    { id: 'purchases-pdc', name: 'Post Dated Cheque Issued' },
    { id: 'purchases-po', name: 'PO' },
    { id: 'purchases-suppliers', name: 'Suppliers' },
  ];

  const inventorySubItems = [
    { id: 'inventory-products', name: 'Products' },
    { id: 'inventory-transfer', name: 'Stock Transfer' },
    { id: 'inventory-adjustment', name: 'Stock Adjustment' },
  ];

  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'coa', name: 'Chart of Accounts', icon: Network },
    { id: 'journals', name: 'Journal Vouchers', icon: BookOpen },
    { id: 'sales-dropdown', name: 'Sales', icon: DollarSign, isDropdown: true },
    { id: 'purchases-dropdown', name: 'Purchases', icon: Banknote, isDropdown: true },
    { id: 'inventory-dropdown', name: 'Inventory', icon: Boxes, isDropdown: true },
    { id: 'manufacturing', name: 'Manufacturing (BOM)', icon: Hammer },
    { id: 'bank-reconciliation', name: 'Bank Reconciliation', icon: Landmark },
    { id: 'trialbalance', name: 'Trial Balance', icon: Scale },
    { id: 'reports', name: 'Reports', icon: FileSpreadsheet },
    { id: 'analytical-reports', name: 'Analytical Reports', icon: FileText },
    { id: 'reports-hub', name: 'BI Reports Hub', icon: BarChart3 },
    { id: 'settings', name: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 overflow-hidden relative font-sans">
      {/* Dynamic Background Glows */}
      <div className="glow-bg" />
      <div className="glow-bg-alt" />

      {/* Sidebar Container */}
      <aside 
        className={`relative z-10 flex flex-col h-screen bg-brand-950/80 border-r border-brand-800/40 backdrop-blur-md transition-all duration-300 ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-brand-800/40">
          {!collapsed ? (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <img src="/logo.png" className="w-8 h-8 object-contain shrink-0" alt="Buraq Cloud Logo" />
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent truncate uppercase">
                  Buraq Cloud
                </span>
                <span className="text-[9px] font-semibold tracking-wider text-indigo-400 border border-indigo-400/40 px-1 rounded self-start mt-0.5 uppercase leading-none">
                  ERP
                </span>
              </div>
            </div>
          ) : (
            <div className="mx-auto">
              <img src="/logo.png" className="w-7 h-7 object-contain" alt="Buraq Cloud Logo" />
            </div>
          )}
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg hover:bg-brand-900/50 text-slate-400 hover:text-slate-100 transition-colors"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Company Header Selector */}
        {!collapsed && tenant && (
          <div className="mx-4 mt-4 p-3 bg-brand-900/30 border border-brand-800/30 rounded-lg flex items-center gap-3">
            <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-md">
              <Building2 size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 font-medium">Active Company</p>
              <h4 className="text-sm font-semibold truncate text-slate-200">{tenant.name}</h4>
            </div>
          </div>
        )}

        {/* Navigation Menu */}
        <nav className="flex-1 px-3 mt-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            if (item.isDropdown) {
              const isSales = item.id === 'sales-dropdown';
              const isPurchases = item.id === 'purchases-dropdown';
              const isInventory = item.id === 'inventory-dropdown';

              const isAnySubActive = isSales 
                ? currentTab.startsWith('sales-') 
                : isPurchases 
                  ? currentTab.startsWith('purchases-') 
                  : currentTab.startsWith('inventory-');

              const isOpen = isSales ? salesOpen : isPurchases ? purchasesOpen : inventoryOpen;
              const setIsOpen = isSales ? setSalesOpen : isPurchases ? setPurchasesOpen : setInventoryOpen;
              const subItems = isSales ? salesSubItems : isPurchases ? purchasesSubItems : inventorySubItems;

              return (
                <div key={item.id} className="space-y-1">
                  <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg text-sm font-medium transition-all duration-150 ${
                      isAnySubActive 
                        ? 'bg-indigo-600/20 text-indigo-300 border-l-4 border-indigo-500' 
                        : 'text-slate-400 hover:bg-brand-900/40 hover:text-slate-100 border-l-4 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={20} className={isAnySubActive ? 'text-indigo-400' : 'text-slate-400'} />
                      {!collapsed && <span>{item.name}</span>}
                    </div>
                    {!collapsed && (
                      <ChevronDown 
                        size={16} 
                        className={`transition-transform duration-250 ${isOpen ? 'rotate-180' : ''} ${isAnySubActive ? 'text-indigo-400' : 'text-slate-400'}`} 
                      />
                    )}
                  </button>
                  
                  {isOpen && !collapsed && (
                    <div className="pl-8 py-1 space-y-1 border-l border-brand-800/30 ml-5">
                      {subItems.map((sub) => {
                        const isSubActive = currentTab === sub.id;
                        return (
                          <button
                            key={sub.id}
                            onClick={() => setCurrentTab(sub.id)}
                            className={`w-full flex items-center p-2 rounded-md text-xs font-medium transition-all duration-150 ${
                              isSubActive 
                                ? 'text-indigo-300 font-semibold' 
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <span>{sub.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive 
                    ? 'bg-indigo-600/20 text-indigo-300 border-l-4 border-indigo-500' 
                    : 'text-slate-400 hover:bg-brand-900/40 hover:text-slate-100 border-l-4 border-transparent'
                }`}
              >
                <Icon size={20} className={isActive ? 'text-indigo-400' : 'text-slate-400'} />
                {!collapsed && <span>{item.name}</span>}
              </button>
            );
          })}
        </nav>


        {/* User Card & Logout */}
        <div className="p-4 border-t border-brand-800/40 bg-brand-950/40">
          {!collapsed ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-brand-800 flex items-center justify-center text-slate-200 border border-brand-700/50">
                  <User size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-200 truncate">{user?.name}</p>
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-full border border-emerald-500/20 uppercase tracking-wide">
                    <Lock size={8} /> {user?.role}
                  </span>
                </div>
              </div>
              <button 
                onClick={onLogout}
                className="w-full btn-secondary text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 hover:border-rose-500/20"
              >
                <LogOut size={16} /> Logout
              </button>
            </div>
          ) : (
            <button 
              onClick={onLogout}
              title="Logout"
              className="mx-auto p-2 rounded-lg text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors flex items-center justify-center"
            >
              <LogOut size={20} />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative z-10">
        {/* Top Header */}
        <header className="h-16 border-b border-brand-800/40 bg-brand-950/30 backdrop-blur-md flex items-center justify-between px-8">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold capitalize text-slate-200">
              {salesSubItems.find(i => i.id === currentTab)?.name || 
               purchasesSubItems.find(i => i.id === currentTab)?.name || 
               inventorySubItems.find(i => i.id === currentTab)?.name || 
               menuItems.find(i => i.id === currentTab)?.name || 
               'ERP System'}
            </h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-400 bg-brand-900/20 px-3 py-1.5 border border-brand-800/40 rounded-lg">
            <span>Currency: <strong>{tenant?.currency || 'USD'}</strong></span>
            <span className="w-px h-4 bg-brand-800/60" />
            <span>Tax Locale: <strong>GST ({tenant?.taxRate || 15}%)</strong></span>
          </div>
        </header>

        {/* Content Box */}
        <div className="flex-1 overflow-y-auto p-8 relative">
          {children}
        </div>
      </main>
    </div>
  );
}
