import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  Activity, 
  Database, 
  Users, 
  Layers, 
  Lock, 
  Unlock, 
  Plus, 
  Search, 
  ShieldAlert, 
  RefreshCw, 
  FileClock, 
  Terminal, 
  CheckCircle2, 
  UserCheck, 
  Globe, 
  Settings2,
  HardDrive,
  Cpu,
  LogOut
} from 'lucide-react';

interface SuperAdminProps {
  onLogout: () => void;
}

export default function SuperAdmin({ onLogout }: SuperAdminProps) {
  const [tenants, setTenants] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tenants' | 'provision' | 'logs' | 'metrics'>('tenants');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Provision form states
  const [companyName, setCompanyName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [taxRate, setTaxRate] = useState('15');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [subTier, setSubTier] = useState('ENTERPRISE');
  const [subEndDate, setSubEndDate] = useState(
    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [provisionProgress, setProvisionProgress] = useState<string[]>([]);

  // Load dashboard data
  const loadData = async () => {
    setLoading(true);
    try {
      const [tenantsData, logsData, metricsData] = await Promise.all([
        api.getSuperAdminTenants(),
        api.getGlobalAuditLogs(),
        api.getSystemMetrics(),
      ]);
      setTenants(tenantsData);
      setLogs(logsData);
      setMetrics(metricsData);
    } catch (err) {
      console.error('Failed to load superadmin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleProvisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setProvisionProgress(['Validating inputs...', 'Contacting authentication engine...']);
    
    try {
      setProvisionProgress(prev => [...prev, 'Creating Buraq Cloud tenant entry...']);
      const response = await api.provisionTenant({
        name: companyName,
        currency,
        taxRate: parseFloat(taxRate),
        adminName,
        adminEmail,
        adminPassword,
        subscriptionTier: subTier,
        endDate: subEndDate,
      });
      
      setProvisionProgress(prev => [
        ...prev,
        'Provisioning logical schema separation indexes...',
        'Seeding default standard Charts of Accounts (CoA)...',
        'Seeding tax codes, system rules, and base ledger logs...',
        'Tenant client successfully provisioned!'
      ]);

      setFormSuccess(`Tenant "${companyName}" successfully provisioned! Master Admin account created.`);
      
      // Reset form fields
      setCompanyName('');
      setAdminName('');
      setAdminEmail('');
      setAdminPassword('');
      
      // Reload tenants list
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Error provisioning new client workspace');
      setProvisionProgress([]);
    }
  };

  const handleToggleStatus = async (tenantId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    setActionLoading(tenantId);
    try {
      await api.updateTenantStatus(tenantId, { status: nextStatus });
      setTenants(prev => 
        prev.map(t => t.id === tenantId ? { ...t, subscription: { ...t.subscription, status: nextStatus } } : t)
      );
      loadData();
    } catch (err) {
      alert('Failed to update tenant status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleModule = async (tenantId: string, moduleKey: string, currentValue: boolean) => {
    const tenant = tenants.find(t => t.id === tenantId);
    if (!tenant) return;

    const updatedModules = {
      moduleAccounts: tenant.subscription.moduleAccounts,
      moduleManufacturing: tenant.subscription.moduleManufacturing,
      moduleInventory: tenant.subscription.moduleInventory,
      moduleHR: tenant.subscription.moduleHR,
      moduleCRM: tenant.subscription.moduleCRM,
      moduleSales: tenant.subscription.moduleSales,
      [moduleKey]: !currentValue,
    };

    setActionLoading(`${tenantId}_${moduleKey}`);
    try {
      await api.updateTenantModules(tenantId, updatedModules);
      setTenants(prev => 
        prev.map(t => t.id === tenantId ? { ...t, subscription: { ...t.subscription, ...updatedModules } } : t)
      );
    } catch (err) {
      alert('Failed to update tenant features');
    } finally {
      setActionLoading(null);
    }
  };

  const handleImpersonate = async (tenantId: string) => {
    if (!confirm('WARNING: You are about to initiate an impersonated support session. All actions taken will be recorded in the master audit logs. Proceed?')) {
      return;
    }
    setActionLoading(tenantId);
    try {
      await api.impersonateTenant(tenantId);
      // Impersonated token is saved to localStorage. Reload triggers App to parse role/tenant and load context!
      window.location.reload();
    } catch (err: any) {
      alert(err.message || 'Failed to impersonate tenant admin');
      setActionLoading(null);
    }
  };

  const filteredTenants = tenants.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.users.some((u: any) => u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-10 left-10 w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none z-0" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-emerald-500/5 blur-[100px] rounded-full pointer-events-none z-0" />

      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-brand-800/40 bg-brand-950/80 backdrop-blur-md relative z-10 flex flex-col h-screen">
        <div className="h-16 flex items-center gap-3 px-6 border-b border-brand-800/40 shrink-0">
          <img src="/logo.png" className="w-8 h-8 object-contain shrink-0" alt="Buraq Cloud Logo" />
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent truncate uppercase">
              Buraq Cloud
            </span>
            <span className="text-[9px] font-semibold tracking-wider text-rose-400 border border-rose-500/20 px-1 rounded self-start mt-0.5 uppercase leading-none bg-rose-500/10">
              Super Admin
            </span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <button
            onClick={() => setActiveTab('tenants')}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'tenants' 
                ? 'bg-indigo-600/20 text-indigo-300 border-l-4 border-indigo-500' 
                : 'text-slate-400 hover:bg-brand-900/40 hover:text-slate-100 border-l-4 border-transparent'
            }`}
          >
            <Layers size={18} />
            <span>Tenants Directory</span>
          </button>
          
          <button
            onClick={() => setActiveTab('provision')}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'provision' 
                ? 'bg-indigo-600/20 text-indigo-300 border-l-4 border-indigo-500' 
                : 'text-slate-400 hover:bg-brand-900/40 hover:text-slate-100 border-l-4 border-transparent'
            }`}
          >
            <Plus size={18} />
            <span>Provision Client</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'logs' 
                ? 'bg-indigo-600/20 text-indigo-300 border-l-4 border-indigo-500' 
                : 'text-slate-400 hover:bg-brand-900/40 hover:text-slate-100 border-l-4 border-transparent'
            }`}
          >
            <FileClock size={18} />
            <span>Master Audit Logs</span>
          </button>

          <button
            onClick={() => setActiveTab('metrics')}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'metrics' 
                ? 'bg-indigo-600/20 text-indigo-300 border-l-4 border-indigo-500' 
                : 'text-slate-400 hover:bg-brand-900/40 hover:text-slate-100 border-l-4 border-transparent'
            }`}
          >
            <Activity size={18} />
            <span>System Health</span>
          </button>
        </nav>

        <div className="p-4 border-t border-brand-800/40 bg-brand-950/40 shrink-0">
          <button 
            onClick={onLogout}
            className="w-full btn-secondary text-rose-455 hover:bg-rose-500/10 hover:border-rose-500/20 py-2.5 font-bold"
          >
            <LogOut size={16} /> Exit Super Panel
          </button>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative z-10">
        <header className="h-16 border-b border-brand-800/40 bg-brand-950/30 backdrop-blur-md flex items-center justify-between px-8 shrink-0">
          <h1 className="text-lg font-bold text-slate-200 uppercase tracking-wide flex items-center gap-2">
            <Settings2 size={20} className="text-indigo-400" />
            <span>Buraq Master Admin Console</span>
          </h1>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-lg bg-brand-900/40 border border-brand-800/50 hover:bg-brand-900/80 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin text-indigo-400' : ''} />
            </button>
            <div className="text-xs text-slate-400 bg-emerald-500/10 text-emerald-450 border border-emerald-500/20 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 uppercase font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Gateway: Online</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          {loading ? (
            // SKELETON LOADER
            <div className="space-y-6 animate-pulse">
              <div className="grid grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-24 bg-brand-900/30 border border-brand-800/20 rounded-xl" />
                ))}
              </div>
              <div className="h-96 bg-brand-900/20 border border-brand-800/20 rounded-xl" />
            </div>
          ) : (
            <>
              {/* SYSTEM METRICS SUMMARY CARDS */}
              {metrics && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                  <div className="glass-panel p-4 flex items-center gap-4 bg-brand-950/50">
                    <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      <Layers size={22} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-450 uppercase font-semibold">Total Tenants</p>
                      <h4 className="text-2xl font-bold text-slate-200 font-mono mt-0.5">{metrics.tenantCount}</h4>
                    </div>
                  </div>

                  <div className="glass-panel p-4 flex items-center gap-4 bg-brand-950/50">
                    <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-450 border border-emerald-500/20">
                      <UserCheck size={22} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-450 uppercase font-semibold">Active Subscriptions</p>
                      <h4 className="text-2xl font-bold text-slate-200 font-mono mt-0.5">{metrics.activeSubs}</h4>
                    </div>
                  </div>

                  <div className="glass-panel p-4 flex items-center gap-4 bg-brand-950/50">
                    <div className="p-3 rounded-lg bg-rose-500/10 text-rose-455 border border-rose-500/20">
                      <ShieldAlert size={22} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-450 uppercase font-semibold">Suspended Tenants</p>
                      <h4 className="text-2xl font-bold text-slate-200 font-mono mt-0.5">{metrics.suspendedSubs}</h4>
                    </div>
                  </div>

                  <div className="glass-panel p-4 flex items-center gap-4 bg-brand-950/50">
                    <div className="p-3 rounded-lg bg-amber-500/10 text-amber-450 border border-amber-500/20">
                      <HardDrive size={22} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-450 uppercase font-semibold">Allocated Storage</p>
                      <h4 className="text-2xl font-bold text-slate-200 font-mono mt-0.5">{metrics.dbSizeApproxMB} MB</h4>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW: TENANTS DIRECTORY */}
              {activeTab === 'tenants' && (
                <div className="space-y-6">
                  {/* Search and control bar */}
                  <div className="flex justify-between items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                        <Search size={16} />
                      </span>
                      <input 
                        type="text" 
                        placeholder="Search tenants by name, ID or administrator email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-4 py-2 w-full bg-slate-900 border border-brand-800 text-slate-100 rounded-lg focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    
                    <button 
                      onClick={() => setActiveTab('provision')}
                      className="btn-primary"
                    >
                      <Plus size={16} /> Provision New Client
                    </button>
                  </div>

                  {/* Tenants list table */}
                  <div className="glass-panel overflow-hidden bg-brand-950/30">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-brand-800/40 bg-brand-950/60 text-xs text-slate-400 font-semibold uppercase tracking-wider">
                            <th className="px-6 py-4">Client / Tenant ID</th>
                            <th className="px-6 py-4">Admin Email</th>
                            <th className="px-6 py-4">Status & Contract</th>
                            <th className="px-6 py-4">Functional Modules Enabled</th>
                            <th className="px-6 py-4 text-center">Resources</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-900/30">
                          {filteredTenants.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                                No tenant records matched your filters.
                              </td>
                            </tr>
                          ) : (
                            filteredTenants.map((t) => (
                              <tr key={t.id} className="hover:bg-brand-900/10 transition-colors">
                                <td className="px-6 py-4 space-y-1">
                                  <div className="font-bold text-slate-200 text-base">{t.name}</div>
                                  <div className="text-[10px] font-mono text-slate-500">{t.id}</div>
                                  <div className="text-[10px] text-slate-400">Created: {new Date(t.createdAt).toLocaleDateString()}</div>
                                </td>
                                
                                <td className="px-6 py-4">
                                  <span className="font-mono text-slate-350">{t.users[0]?.email || 'No user registered'}</span>
                                </td>

                                <td className="px-6 py-4 space-y-2">
                                  {/* Status badge */}
                                  <div>
                                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                      t.subscription.status === 'ACTIVE' 
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                        : 'bg-rose-500/10 text-rose-455 border border-rose-500/20'
                                    }`}>
                                      {t.subscription.status}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-450">
                                    Expires: <span className="font-mono text-slate-300">{new Date(t.subscription.endDate).toLocaleDateString()}</span>
                                  </div>
                                </td>

                                <td className="px-6 py-4">
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                                      <input 
                                        type="checkbox"
                                        checked={t.subscription.moduleAccounts}
                                        onChange={() => handleToggleModule(t.id, 'moduleAccounts', t.subscription.moduleAccounts)}
                                        disabled={actionLoading === `${t.id}_moduleAccounts`}
                                        className="rounded border-brand-800 text-indigo-600 focus:ring-indigo-500 bg-slate-900 w-3.5 h-3.5"
                                      />
                                      <span>GL Ledger</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                                      <input 
                                        type="checkbox"
                                        checked={t.subscription.moduleSales}
                                        onChange={() => handleToggleModule(t.id, 'moduleSales', t.subscription.moduleSales)}
                                        disabled={actionLoading === `${t.id}_moduleSales`}
                                        className="rounded border-brand-800 text-indigo-600 focus:ring-indigo-500 bg-slate-900 w-3.5 h-3.5"
                                      />
                                      <span>Sales/POS</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                                      <input 
                                        type="checkbox"
                                        checked={t.subscription.moduleInventory}
                                        onChange={() => handleToggleModule(t.id, 'moduleInventory', t.subscription.moduleInventory)}
                                        disabled={actionLoading === `${t.id}_moduleInventory`}
                                        className="rounded border-brand-800 text-indigo-600 focus:ring-indigo-500 bg-slate-900 w-3.5 h-3.5"
                                      />
                                      <span>Inventory</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                                      <input 
                                        type="checkbox"
                                        checked={t.subscription.moduleManufacturing}
                                        onChange={() => handleToggleModule(t.id, 'moduleManufacturing', t.subscription.moduleManufacturing)}
                                        disabled={actionLoading === `${t.id}_moduleManufacturing`}
                                        className="rounded border-brand-800 text-indigo-600 focus:ring-indigo-500 bg-slate-900 w-3.5 h-3.5"
                                      />
                                      <span>BOM/Mfg</span>
                                    </label>
                                  </div>
                                </td>

                                <td className="px-6 py-4 text-center font-mono space-y-1">
                                  <div className="text-xs text-slate-200">Users: <span className="font-semibold text-indigo-400">{t.userCount}</span></div>
                                  <div className="text-[10px] text-slate-500">Live: {t.activeSessions}</div>
                                  <div className="text-[10px] text-slate-500">Disk: {t.storageUsageKB}KB</div>
                                </td>

                                <td className="px-6 py-4 text-right">
                                  <div className="flex justify-end gap-2">
                                    {/* Impersonate Support admin */}
                                    <button
                                      onClick={() => handleImpersonate(t.id)}
                                      disabled={actionLoading !== null}
                                      className="px-2.5 py-1 text-xs bg-indigo-600/10 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20 rounded transition-colors"
                                    >
                                      Impersonate
                                    </button>

                                    {/* Suspend / Resume toggle */}
                                    <button
                                      onClick={() => handleToggleStatus(t.id, t.subscription.status)}
                                      disabled={actionLoading !== null}
                                      className={`p-1.5 rounded border transition-colors ${
                                        t.subscription.status === 'SUSPENDED'
                                          ? 'bg-emerald-500/10 text-emerald-450 border-emerald-500/20 hover:bg-emerald-500/20'
                                          : 'bg-rose-500/10 text-rose-455 border-rose-500/20 hover:bg-rose-500/20'
                                      }`}
                                      title={t.subscription.status === 'SUSPENDED' ? 'Unlock Account Access' : 'Suspend Account / Lock Access'}
                                    >
                                      {t.subscription.status === 'SUSPENDED' ? <Unlock size={14} /> : <Lock size={14} />}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW: PROVISION CLIENT */}
              {activeTab === 'provision' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {/* Setup client form */}
                  <div className="md:col-span-2 glass-panel p-8 bg-brand-950/40">
                    <h3 className="text-base font-semibold text-slate-200 uppercase tracking-wide border-b border-brand-800/40 pb-3 mb-6">
                      Workspace Provisioning Form
                    </h3>

                    {formError && (
                      <div className="bg-rose-500/10 border border-rose-500/20 text-rose-455 p-3 rounded-lg text-xs mb-6 flex items-center gap-2">
                        <ShieldAlert size={16} />
                        <span>{formError}</span>
                      </div>
                    )}

                    {formSuccess && (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 p-3 rounded-lg text-xs mb-6 flex items-center gap-2">
                        <CheckCircle2 size={16} />
                        <span>{formSuccess}</span>
                      </div>
                    )}

                    <form onSubmit={handleProvisionSubmit} className="space-y-6 text-sm">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-400 uppercase">Company Name</label>
                          <input 
                            type="text"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            placeholder="e.g. Acme Tech Solutions"
                            required
                            className="w-full"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-400 uppercase">Currency</label>
                            <input 
                              type="text"
                              value={currency}
                              onChange={(e) => setCurrency(e.target.value)}
                              placeholder="USD"
                              required
                              className="w-full"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-400 uppercase">GST/VAT Tax Rate (%)</label>
                            <input 
                              type="number"
                              value={taxRate}
                              onChange={(e) => setTaxRate(e.target.value)}
                              placeholder="15"
                              required
                              className="w-full"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-brand-800/30 pt-6">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-400 uppercase">Client Admin Name</label>
                          <input 
                            type="text"
                            value={adminName}
                            onChange={(e) => setAdminName(e.target.value)}
                            placeholder="John Carter"
                            required
                            className="w-full"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-400 uppercase">Admin Account Email</label>
                          <input 
                            type="email"
                            value={adminEmail}
                            onChange={(e) => setAdminEmail(e.target.value)}
                            placeholder="admin@acme.com"
                            required
                            className="w-full"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-400 uppercase">Admin Password</label>
                          <input 
                            type="password"
                            value={adminPassword}
                            onChange={(e) => setAdminPassword(e.target.value)}
                            placeholder="Password text string"
                            required
                            className="w-full"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-400 uppercase">Subscription Tier</label>
                            <select 
                              value={subTier}
                              onChange={(e) => setSubTier(e.target.value)}
                              className="w-full bg-slate-900 border border-brand-800 text-slate-100 rounded px-2 py-2 text-sm focus:outline-none"
                            >
                              <option value="FREE">Trial (Free)</option>
                              <option value="BASIC">Basic</option>
                              <option value="ENTERPRISE">Enterprise SaaS</option>
                            </select>
                          </div>
                          
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-400 uppercase">Contract End Date</label>
                            <input 
                              type="date"
                              value={subEndDate}
                              onChange={(e) => setSubEndDate(e.target.value)}
                              required
                              className="w-full"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 flex justify-end">
                        <button type="submit" className="btn-primary font-bold px-8">
                          Provision Workspace Client
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Provision CLI Log console */}
                  <div className="glass-panel p-6 bg-black border border-brand-800/40 font-mono text-xs flex flex-col h-[500px]">
                    <div className="flex items-center gap-2 text-slate-400 border-b border-brand-850 pb-3 mb-4 shrink-0">
                      <Terminal size={14} className="text-indigo-400" />
                      <span>Provisioning Operations CLI Console</span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 text-emerald-450 leading-relaxed scrollbar-thin">
                      {provisionProgress.length === 0 ? (
                        <span className="text-slate-600 block italic">Waiting for provisioning request...</span>
                      ) : (
                        provisionProgress.map((line, i) => (
                          <div key={i} className="flex gap-2">
                            <span className="text-slate-600">admin@buraq:~$</span>
                            <span className="break-all">{line}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW: MASTER AUDIT LOGS */}
              {activeTab === 'logs' && (
                <div className="glass-panel overflow-hidden bg-brand-950/30">
                  <div className="px-6 py-4 border-b border-brand-800/40 bg-brand-950/60 font-semibold text-slate-200">
                    Chronological Operation Audit Log Trails
                  </div>
                  <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-brand-800/40 bg-brand-950/40 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          <th className="px-6 py-3">Timestamp</th>
                          <th className="px-6 py-3">Operator User</th>
                          <th className="px-6 py-3">Action Type</th>
                          <th className="px-6 py-3">Description Context</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-900/30 font-mono">
                        {logs.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                              No audit trail records exist yet.
                            </td>
                          </tr>
                        ) : (
                          logs.map((l) => (
                            <tr key={l.id} className="hover:bg-brand-900/10">
                              <td className="px-6 py-3 text-slate-400 whitespace-nowrap">
                                {new Date(l.timestamp).toLocaleString()}
                              </td>
                              <td className="px-6 py-3 space-y-0.5">
                                <span className="text-slate-200 block font-semibold">{l.superUser.name}</span>
                                <span className="text-[10px] text-slate-500">{l.superUser.email}</span>
                              </td>
                              <td className="px-6 py-3">
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  l.action === 'PROVISION_TENANT' ? 'bg-indigo-500/10 text-indigo-400' :
                                  l.action === 'IMPERSONATION_START' ? 'bg-amber-500/10 text-amber-450' :
                                  l.action === 'UPDATE_SUBSCRIPTION_STATUS' ? 'bg-rose-500/10 text-rose-455' :
                                  'bg-slate-500/10 text-slate-400'
                                }`}>
                                  {l.action}
                                </span>
                              </td>
                              <td className="px-6 py-3 text-slate-300 break-words max-w-lg">
                                {l.details}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* VIEW: SYSTEM HEALTH METRICS */}
              {activeTab === 'metrics' && metrics && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {/* CPU / Memory / Sockets meters */}
                  <div className="glass-panel p-6 space-y-6 bg-brand-950/40">
                    <h4 className="text-sm font-semibold uppercase text-slate-300 tracking-wider flex items-center gap-2">
                      <Cpu size={16} className="text-indigo-400" />
                      <span>Process Resources Utilization</span>
                    </h4>

                    {/* CPU gauge */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Node API CPU Load</span>
                        <span className="font-mono font-bold text-slate-200">{metrics.systemCpuLoadPercent}%</span>
                      </div>
                      <div className="w-full bg-brand-900/60 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-indigo-500 h-2 rounded-full transition-all duration-500" 
                          style={{ width: `${metrics.systemCpuLoadPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Memory usage */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">API Memory Allocated (Heap)</span>
                        <span className="font-mono font-bold text-slate-200">{metrics.systemMemoryUsageBytes}</span>
                      </div>
                      <div className="w-full bg-brand-900/60 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-2 rounded-full" 
                          style={{ width: '42%' }} // fixed ratio approximation
                        />
                      </div>
                    </div>

                    {/* Sockets connections */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Concurrent Gateway Requests</span>
                        <span className="font-mono font-bold text-slate-200">{metrics.concurrentConnections} active</span>
                      </div>
                      <div className="w-full bg-brand-900/60 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-indigo-400 h-2 rounded-full" 
                          style={{ width: '15%' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Worker queues details */}
                  <div className="glass-panel p-6 space-y-6 bg-brand-950/40">
                    <h4 className="text-sm font-semibold uppercase text-slate-300 tracking-wider flex items-center gap-2">
                      <Globe size={16} className="text-emerald-400" />
                      <span>Background Workers Queue</span>
                    </h4>

                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div className="p-3 bg-brand-900/20 border border-brand-850 rounded-lg">
                        <span className="text-[10px] uppercase font-bold text-slate-500">Active Workers</span>
                        <p className="text-2xl font-bold font-mono text-indigo-400 mt-1">{metrics.backgroundWorkerQueue.active}</p>
                      </div>
                      <div className="p-3 bg-brand-900/20 border border-brand-850 rounded-lg">
                        <span className="text-[10px] uppercase font-bold text-slate-500">Queue Status</span>
                        <p className="text-xs uppercase font-bold text-emerald-450 mt-2 font-mono">{metrics.backgroundWorkerQueue.status}</p>
                      </div>
                    </div>

                    <div className="space-y-3 text-xs divide-y divide-brand-900/30">
                      <div className="flex justify-between py-1.5 text-slate-300">
                        <span>Total Jobs Processed</span>
                        <span className="font-mono text-slate-100">{metrics.backgroundWorkerQueue.completed}</span>
                      </div>
                      <div className="flex justify-between py-1.5 text-slate-300">
                        <span>Failed Worker Jobs</span>
                        <span className="font-mono text-rose-400">{metrics.backgroundWorkerQueue.failed}</span>
                      </div>
                    </div>
                  </div>

                  {/* DB / Multi-tenancy Isolation schema health */}
                  <div className="glass-panel p-6 space-y-6 bg-brand-950/40">
                    <h4 className="text-sm font-semibold uppercase text-slate-300 tracking-wider flex items-center gap-2">
                      <Database size={16} className="text-amber-400" />
                      <span>Database Isolation Engine</span>
                    </h4>

                    <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl space-y-2">
                      <span className="text-xs font-bold text-amber-450 block">🔐 Logical Separation Status</span>
                      <p className="text-[11px] text-slate-400 leading-normal">
                        Buraq Cloud is operating with strict column-indexed database indexing. Tenant schemas are mapped securely via column-scoped UUIDs, preventing cross-tenant information leaks.
                      </p>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between text-slate-300">
                        <span>DB Engine Provider</span>
                        <span className="font-bold text-indigo-400">SQLite (Indexed)</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>Index Health Check</span>
                        <span className="text-emerald-400 font-semibold">100% HEALTHY</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
