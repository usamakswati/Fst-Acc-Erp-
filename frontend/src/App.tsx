import React, { useState, useEffect } from 'react';
import { api } from './services/api';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ChartOfAccounts from './pages/ChartOfAccounts';
import JournalVouchers from './pages/JournalVouchers';
import Invoices from './pages/Invoices';
import POSInvoices from './pages/POSInvoices';
import Receipts from './pages/Receipts';
import PostDatedCheques from './pages/PostDatedCheques';
import SalesAll from './pages/SalesAll';
import SalesOrders from './pages/SalesOrders';
import Customers from './pages/Customers';
import Products from './pages/Products';
import StockTransfer from './pages/StockTransfer';
import StockAdjustment from './pages/StockAdjustment';
import AnalyticalReports from './pages/AnalyticalReports';
import Manufacturing from './pages/Manufacturing';
import TrialBalance from './pages/TrialBalance';
import Reports from './pages/Reports';
import Bills from './pages/Bills';
import Payments from './pages/Payments';
import PostDatedChequesIssued from './pages/PostDatedChequesIssued';
import PurchasesAll from './pages/PurchasesAll';
import PurchaseOrders from './pages/PurchaseOrders';
import Suppliers from './pages/Suppliers';
import BankReconciliation from './pages/BankReconciliation';
import { ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('erp_token'));
  const [user, setUser] = useState<any>(null);
  const [tenant, setTenant] = useState<any>(null);
  
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  // Login states
  const [isLoginView, setIsLoginView] = useState(true);
  const [loginEmail, setLoginEmail] = useState('admin@acme.com'); // Pre-fill for instant demo
  const [loginPassword, setLoginPassword] = useState('admin123'); // Pre-fill for instant demo

  // Register states
  const [regName, setRegName] = useState('');
  const [regCompany, setRegCompany] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    async function checkSession() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const response = await api.getMe();
        setUser(response.user);
        setTenant(response.tenant);
      } catch (error) {
        console.error('Session expired', error);
        api.logout();
        setToken(null);
      } finally {
        setLoading(false);
      }
    }
    checkSession();
  }, [token]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const data = await api.login({ email: loginEmail, passwordHash: loginPassword });
      setToken(data.token);
      setUser(data.user);
      setTenant(data.tenant);
    } catch (err: any) {
      setAuthError(err.message || 'Invalid email or password');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const data = await api.register({
        name: regName,
        companyName: regCompany,
        email: regEmail,
        password: regPassword
      });
      setToken(data.token);
      setUser(data.user);
      setTenant(data.tenant);
    } catch (err: any) {
      setAuthError(err.message || 'Error during registration process');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    api.logout();
    setToken(null);
    setUser(null);
    setTenant(null);
    setCurrentTab('dashboard');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500" />
        <p className="text-slate-400 text-sm font-medium mt-4">Initializing ledger components...</p>
      </div>
    );
  }

  // Render Authentication Views if no token
  if (!token) {
    return (
      <div className="flex min-h-screen bg-slate-950 items-center justify-center p-6 relative overflow-hidden font-sans">
        <div className="glow-bg" />
        <div className="glow-bg-alt" />
        
        <div className="w-full max-w-md bg-brand-950/80 border border-brand-800/40 backdrop-blur-md rounded-2xl p-8 shadow-glass relative z-10 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20 mb-2">
              <ShieldCheck size={28} />
            </div>
            <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">
              FastAccounts ERP
            </h2>
            <p className="text-xs text-slate-400 font-medium">Double-entry accounting, FIFO/Average costing engine, and RBAC security.</p>
          </div>

          {authError && (
            <div className="bg-rose-500/10 border border-rose-500/20 p-3.5 rounded-lg text-rose-450 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {isLoginView ? (
            // LOGIN FORM
            <form onSubmit={handleLoginSubmit} className="space-y-4 text-sm">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase">Email Address</label>
                <input 
                  type="email" 
                  value={loginEmail} 
                  onChange={(e) => setLoginEmail(e.target.value)} 
                  placeholder="e.g. admin@acme.com"
                  className="w-full"
                  required 
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase">Password</label>
                <input 
                  type="password" 
                  value={loginPassword} 
                  onChange={(e) => setLoginPassword(e.target.value)} 
                  placeholder="Password string"
                  className="w-full"
                  required 
                />
              </div>
              <button 
                type="submit" 
                disabled={authLoading}
                className="w-full btn-primary py-2.5 font-bold mt-2"
              >
                {authLoading ? <RefreshCw className="animate-spin" size={16} /> : 'Authenticate Credentials'}
              </button>
              <div className="text-center pt-2">
                <button 
                  type="button" 
                  onClick={() => { setIsLoginView(false); setAuthError(''); }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                >
                  Create tenant / Register New Company
                </button>
              </div>
            </form>
          ) : (
            // REGISTER FORM
            <form onSubmit={handleRegisterSubmit} className="space-y-4 text-sm">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase">Your Name</label>
                <input 
                  type="text" 
                  value={regName} 
                  onChange={(e) => setRegName(e.target.value)} 
                  placeholder="e.g. John Doe"
                  className="w-full"
                  required 
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase">Company Name (Tenant)</label>
                <input 
                  type="text" 
                  value={regCompany} 
                  onChange={(e) => setRegCompany(e.target.value)} 
                  placeholder="e.g. Stark Industries"
                  className="w-full"
                  required 
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase">Email Address</label>
                <input 
                  type="email" 
                  value={regEmail} 
                  onChange={(e) => setRegEmail(e.target.value)} 
                  placeholder="e.g. ceo@stark.com"
                  className="w-full"
                  required 
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase">Password</label>
                <input 
                  type="password" 
                  value={regPassword} 
                  onChange={(e) => setRegPassword(e.target.value)} 
                  placeholder="Secure password"
                  className="w-full"
                  required 
                />
              </div>
              <button 
                type="submit" 
                disabled={authLoading}
                className="w-full btn-primary py-2.5 font-bold mt-2"
              >
                {authLoading ? <RefreshCw className="animate-spin" size={16} /> : 'Setup Company & Register'}
              </button>
              <div className="text-center pt-2">
                <button 
                  type="button" 
                  onClick={() => { setIsLoginView(true); setAuthError(''); }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                >
                  Already registered? Sign in
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Render Dashboard Layout wrapper when logged in
  const currencySign = tenant?.currency === 'USD' ? '$' : tenant?.currency || '$';

  return (
    <Layout 
      currentTab={currentTab} 
      setCurrentTab={setCurrentTab} 
      user={user} 
      tenant={tenant}
      onLogout={handleLogout}
    >
      {currentTab === 'dashboard' && <Dashboard setCurrentTab={setCurrentTab} currency={currencySign} />}
      {currentTab === 'coa' && <ChartOfAccounts />}
      {currentTab === 'journals' && <JournalVouchers />}
      {currentTab === 'sales-invoices' && <Invoices currency={currencySign} taxRate={tenant?.taxRate || 18} />}
      {currentTab === 'sales-pos' && <POSInvoices currency={currencySign} />}
      {currentTab === 'sales-receipts' && <Receipts currency={currencySign} />}
      {currentTab === 'sales-pdc' && <PostDatedCheques currency={currencySign} />}
      {currentTab === 'sales-all' && <SalesAll currency={currencySign} />}
      {currentTab === 'sales-orders' && <SalesOrders currency={currencySign} />}
      {currentTab === 'sales-customers' && <Customers />}
      {currentTab === 'purchases-bills' && <Bills currency={currencySign} taxRate={tenant?.taxRate || 18} />}
      {currentTab === 'purchases-payments' && <Payments currency={currencySign} />}
      {currentTab === 'purchases-pdc' && <PostDatedChequesIssued currency={currencySign} />}
      {currentTab === 'purchases-all' && <PurchasesAll currency={currencySign} />}
      {currentTab === 'purchases-po' && <PurchaseOrders currency={currencySign} />}
      {currentTab === 'purchases-suppliers' && <Suppliers />}
      {currentTab === 'inventory' && <Products currency={currencySign} />}
      {currentTab === 'inventory-products' && <Products currency={currencySign} />}
      {currentTab === 'inventory-transfer' && <StockTransfer currency={currencySign} />}
      {currentTab === 'inventory-adjustment' && <StockAdjustment currency={currencySign} />}
      {currentTab === 'manufacturing' && <Manufacturing currency={currencySign} />}
      {currentTab === 'bank-reconciliation' && <BankReconciliation currency={currencySign} />}
      {currentTab === 'trialbalance' && <TrialBalance />}
      {currentTab === 'reports' && <Reports currency={currencySign} />}
      {currentTab === 'analytical-reports' && <AnalyticalReports currency={currencySign} />}
    </Layout>
  );
}
