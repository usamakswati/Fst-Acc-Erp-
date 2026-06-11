import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  Building, 
  FileText, 
  Palette, 
  Settings as SettingsIcon, 
  CheckCircle, 
  AlertCircle,
  HelpCircle,
  Printer,
  QrCode,
  Layout,
  RefreshCw
} from 'lucide-react';

interface SettingsProps {
  tenant: any;
  setTenant: (tenant: any) => void;
  currency: string;
}

export default function Settings({ tenant, setTenant, currency }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'invoice'>('general');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // 1. General Company Settings States
  const [companyName, setCompanyName] = useState(tenant?.name || '');
  const [taxRate, setTaxRate] = useState(tenant?.taxRate || 18);
  const [tenantCurrency, setTenantCurrency] = useState(tenant?.currency || 'USD');
  const [companyNtn, setCompanyNtn] = useState('');
  const [companyStrn, setCompanyStrn] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');

  // 2. Invoice Template Settings States
  const [templateStyle, setTemplateStyle] = useState<'classic' | 'indigo' | 'emerald' | 'minimalist'>('classic');
  const [primaryColor, setPrimaryColor] = useState('#4f46e5'); // indigo-600
  const [accentColor, setAccentColor] = useState('#10b981');  // emerald-500
  const [logoText, setLogoText] = useState(tenant?.name || 'Acme Enterprise Corp');
  const [termsAndConditions, setTermsAndConditions] = useState('Payment is due within 30 days of invoice issue date. Overdue invoices are subject to 1.5% interest per month.');
  const [footerNote, setFooterNote] = useState('Thank you for choosing us! We appreciate your business.');

  // Load settings from localStorage and tenant details on mount
  useEffect(() => {
    if (tenant) {
      setCompanyName(tenant.name);
      setTaxRate(tenant.taxRate);
      setTenantCurrency(tenant.currency);
      setLogoText(tenant.name);

      const localKey = `fastaccounts_settings_${tenant.id}`;
      try {
        const stored = localStorage.getItem(localKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          setCompanyNtn(parsed.ntn || '');
          setCompanyStrn(parsed.strn || '');
          setCompanyPhone(parsed.phone || '');
          setCompanyAddress(parsed.address || '');

          setTemplateStyle(parsed.templateStyle || 'classic');
          setPrimaryColor(parsed.primaryColor || '#4f46e5');
          setAccentColor(parsed.accentColor || '#10b981');
          setLogoText(parsed.logoText || tenant.name);
          setTermsAndConditions(parsed.termsAndConditions || 'Payment is due within 30 days of invoice issue date. Overdue invoices are subject to 1.5% interest per month.');
          setFooterNote(parsed.footerNote || 'Thank you for choosing us! We appreciate your business.');
        }
      } catch (err) {
        console.error('Error loading settings from local storage:', err);
      }
    }
  }, [tenant]);

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // 1. Save core settings on the backend
      const updatedTenant = await api.updateTenant({
        name: companyName,
        currency: tenantCurrency,
        taxRate: parseFloat(taxRate.toString()) || 0,
      });

      // Update parent state
      setTenant(updatedTenant);

      // 2. Save industrial details locally
      const localKey = `fastaccounts_settings_${tenant.id}`;
      const existingSettings = JSON.parse(localStorage.getItem(localKey) || '{}');
      const newSettings = {
        ...existingSettings,
        ntn: companyNtn,
        strn: companyStrn,
        phone: companyPhone,
        address: companyAddress
      };
      localStorage.setItem(localKey, JSON.stringify(newSettings));

      setSuccessMsg('General company settings updated successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update company settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveInvoiceTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const localKey = `fastaccounts_settings_${tenant.id}`;
      const existingSettings = JSON.parse(localStorage.getItem(localKey) || '{}');
      const newSettings = {
        ...existingSettings,
        templateStyle,
        primaryColor,
        accentColor,
        logoText,
        termsAndConditions,
        footerNote
      };
      localStorage.setItem(localKey, JSON.stringify(newSettings));
      
      setSuccessMsg('Invoice template options saved successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save template options');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <SettingsIcon className="text-indigo-400" size={24} />
            <span>Company Settings</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Configure company tax registers (NTN/STRN), default currencies, and design customizable invoice templates.
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-lg text-emerald-450 flex items-center gap-3 text-sm transition-all duration-300">
          <CheckCircle size={18} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-lg text-rose-455 flex items-center gap-3 text-sm transition-all duration-300">
          <AlertCircle size={18} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-brand-850 gap-2">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2.5 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'general'
              ? 'border-indigo-500 text-indigo-450 bg-indigo-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building size={16} /> General Settings
        </button>
        <button
          onClick={() => setActiveTab('invoice')}
          className={`px-4 py-2.5 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'invoice'
              ? 'border-indigo-500 text-indigo-450 bg-indigo-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Palette size={16} /> Invoice Template Designer
        </button>
      </div>

      {/* TAB CONTENT: GENERAL SETTINGS */}
      {activeTab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass-panel p-6">
            <h3 className="text-md font-bold text-slate-200 mb-4 flex items-center gap-2 border-b border-brand-850 pb-2">
              🏢 Corporate Registry Profile
            </h3>
            
            <form onSubmit={handleSaveGeneral} className="space-y-4 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Company / Tenant Name</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                    className="w-full"
                    placeholder="e.g. Acme Enterprise Corp"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Base Currency</label>
                  <select
                    value={tenantCurrency}
                    onChange={(e) => setTenantCurrency(e.target.value)}
                    className="w-full"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="PKR">PKR (Rs.)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="AED">AED (Dh)</option>
                    <option value="SAR">SAR (SR)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase">General Sales Tax Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={taxRate}
                    onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                    required
                    className="w-full font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase">National Tax Number (NTN)</label>
                  <input
                    type="text"
                    value={companyNtn}
                    onChange={(e) => setCompanyNtn(e.target.value)}
                    className="w-full font-mono"
                    placeholder="e.g. 7239102-4"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Sales Tax Reg Number (STRN)</label>
                  <input
                    type="text"
                    value={companyStrn}
                    onChange={(e) => setCompanyStrn(e.target.value)}
                    className="w-full font-mono"
                    placeholder="e.g. 1234567890123"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase">Industrial Plant / Office Address</label>
                <textarea
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  className="w-full bg-slate-900 border border-brand-800 text-slate-100 rounded p-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  rows={3}
                  placeholder="e.g. Plot 43-B, Industrial Estate Area, Sector 5, Karachi, Pakistan"
                />
              </div>

              <div className="space-y-1.5 max-w-sm">
                <label className="text-xs font-semibold text-slate-400 uppercase">Corporate Contact Phone</label>
                <input
                  type="text"
                  value={companyPhone}
                  onChange={(e) => setCompanyPhone(e.target.value)}
                  className="w-full"
                  placeholder="e.g. +92 21 34567890"
                />
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary font-bold px-6"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="animate-spin" size={16} />
                      <span>Saving Profile...</span>
                    </>
                  ) : (
                    <span>Save Corporate Registry</span>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* General Settings Tips Card */}
          <div className="glass-panel p-6 flex flex-col justify-between h-fit space-y-4">
            <div>
              <h4 className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
                <HelpCircle size={16} className="text-indigo-400" />
                <span>GST &amp; NTN/STRN Settings</span>
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed mt-2">
                In Pakistan, manufacturing units operating at large scales must integrate with the **Federal Board of Revenue (FBR) IRIS** system. 
                Providing correct NTN and STRN identifiers guarantees e-invoices are properly formatted and verified.
              </p>
              <div className="mt-4 border-l-2 border-amber-500/40 pl-3 py-1 text-[11px] text-slate-500 font-mono italic">
                * Base currency modifications will immediately recalculate new ledger accounts, journals, and reports values.
              </div>
            </div>
            <div className="bg-brand-900/15 border border-brand-800/30 rounded-lg p-3 text-xs text-slate-400 font-mono">
              <span className="font-bold text-slate-200 uppercase text-[10px] block mb-1">Database Sync Status</span>
              <p className="flex justify-between">
                <span>Tenant ID:</span>
                <span className="text-indigo-300 font-semibold text-[10px] truncate max-w-[140px]" title={tenant?.id}>{tenant?.id}</span>
              </p>
              <p className="flex justify-between mt-1">
                <span>Base Currency:</span>
                <span className="text-emerald-400 font-bold">{tenantCurrency}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: INVOICE TEMPLATE DESIGNER */}
      {activeTab === 'invoice' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          
          {/* Left Designer Form (5 cols) */}
          <div className="xl:col-span-5 glass-panel p-6 space-y-6">
            <h3 className="text-md font-bold text-slate-200 border-b border-brand-850 pb-2 flex items-center gap-2">
              <Layout size={18} className="text-indigo-400" />
              <span>Theme Customization</span>
            </h3>

            <form onSubmit={handleSaveInvoiceTemplate} className="space-y-4 text-xs">
              
              {/* Template Styles Grid */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Template Layout Style</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'classic' as const, label: 'Standard Classic', desc: 'Grayscale formal layout' },
                    { id: 'indigo' as const, label: 'Modern Indigo', desc: 'Glassmorphic indigo borders' },
                    { id: 'emerald' as const, label: 'Emerald Industrial', desc: 'Forest green headings' },
                    { id: 'minimalist' as const, label: 'Steel Minimalist', desc: 'Borderless minimalist layout' }
                  ].map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setTemplateStyle(style.id)}
                      className={`p-3 text-left border rounded-xl transition-all ${
                        templateStyle === style.id
                          ? 'bg-indigo-500/10 border-indigo-500 text-slate-100 ring-2 ring-indigo-500/20'
                          : 'bg-brand-900/10 border-brand-800 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                      }`}
                    >
                      <span className="font-semibold block text-xs">{style.label}</span>
                      <span className="text-[10px] text-slate-500 mt-1 block leading-tight">{style.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Pickers */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Primary Brand Color</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-8 h-8 rounded border border-brand-800 cursor-pointer p-0"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-full font-mono text-center"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Secondary Accent Color</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-8 h-8 rounded border border-brand-800 cursor-pointer p-0"
                    />
                    <input
                      type="text"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-full font-mono text-center"
                    />
                  </div>
                </div>
              </div>

              {/* Header Text / Logo */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Invoice Logo Header Text</label>
                <input
                  type="text"
                  value={logoText}
                  onChange={(e) => setLogoText(e.target.value)}
                  className="w-full text-xs"
                  placeholder="e.g. ACME INDUSTRY LTD."
                />
              </div>

              {/* Terms and conditions */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Invoice Terms &amp; Conditions</label>
                <textarea
                  value={termsAndConditions}
                  onChange={(e) => setTermsAndConditions(e.target.value)}
                  className="w-full bg-slate-900 border border-brand-800 text-slate-100 rounded p-2 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  rows={4}
                />
              </div>

              {/* Footer notes */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Invoice Footer Note</label>
                <input
                  type="text"
                  value={footerNote}
                  onChange={(e) => setFooterNote(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary font-bold px-6"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="animate-spin" size={16} />
                      <span>Saving Template...</span>
                    </>
                  ) : (
                    <span>Save Invoice Settings</span>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Right Live Interactive Mock Preview (7 cols) */}
          <div className="xl:col-span-7 space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Live Invoice Layout Preview</h4>
            
            {/* The Invoice Preview Frame */}
            <div className="glass-panel overflow-hidden p-6 text-slate-900 bg-white border border-slate-300 rounded-xl relative shadow-lg min-h-[500px]">
              
              {/* Dynamic Design Layout Wrapper */}
              <div className="space-y-5 text-[11px]">
                
                {/* 1. Header Design Style */}
                {templateStyle === 'classic' && (
                  <div className="border-b-4 border-double border-slate-800 pb-3 flex justify-between items-start">
                    <div>
                      <h4 className="text-lg font-black tracking-tight" style={{ color: primaryColor }}>{logoText}</h4>
                      <p className="text-[10px] text-slate-500 mt-1">{companyAddress || 'Corporate Address Road, Karachi, Pakistan'}</p>
                      {companyPhone && <p className="text-[10px] text-slate-400 mt-0.5">Phone: {companyPhone}</p>}
                    </div>
                    <div className="text-right">
                      <h3 className="text-base font-black text-slate-800 tracking-wider">SALES TAX INVOICE</h3>
                      <p className="font-mono text-slate-500 text-[10px] mt-1">NTN: {companyNtn || '7239102-4'}</p>
                      <p className="font-mono text-slate-500 text-[10px] mt-0.5">STRN: {companyStrn || '1234567890123'}</p>
                    </div>
                  </div>
                )}

                {templateStyle === 'indigo' && (
                  <div className="p-4 rounded-xl flex justify-between items-center text-white" style={{ backgroundColor: primaryColor }}>
                    <div>
                      <h4 className="text-base font-extrabold tracking-tight">{logoText}</h4>
                      <p className="text-[9px] opacity-80 mt-1">{companyAddress || 'Industrial Area Plot, Karachi, Pakistan'}</p>
                    </div>
                    <div className="text-right">
                      <h3 className="text-sm font-black tracking-widest uppercase">E-TAX INVOICE</h3>
                      <p className="font-mono text-[9px] opacity-70 mt-1">NTN: {companyNtn || '7239102-4'}</p>
                      <p className="font-mono text-[9px] opacity-70">STRN: {companyStrn || '1234567890123'}</p>
                    </div>
                  </div>
                )}

                {templateStyle === 'emerald' && (
                  <div className="border-l-4 pl-4 py-2 flex justify-between items-start" style={{ borderColor: primaryColor }}>
                    <div>
                      <h4 className="text-md font-extrabold tracking-tight" style={{ color: primaryColor }}>{logoText}</h4>
                      <p className="text-[9px] text-slate-500 mt-0.5">{companyAddress || 'Corporate Plant Location, Karachi, Pakistan'}</p>
                    </div>
                    <div className="text-right">
                      <h3 className="text-sm font-bold text-slate-800 uppercase" style={{ color: accentColor }}>Tax Invoice (FBR Verified)</h3>
                      <p className="font-mono text-[9px] text-slate-500 mt-1">NTN: {companyNtn || '7239102-4'} | STRN: {companyStrn || '1234567890123'}</p>
                    </div>
                  </div>
                )}

                {templateStyle === 'minimalist' && (
                  <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                    <div>
                      <h4 className="text-md font-bold tracking-tight text-slate-800">{logoText}</h4>
                      <p className="text-[9px] text-slate-400 mt-0.5">{companyAddress || 'Industrial Plot 44-B, Karachi'}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-600 block">INVOICE</span>
                      <span className="font-mono text-[9px] text-slate-400 block mt-1">NTN: {companyNtn || '7239102-4'}</span>
                      <span className="font-mono text-[9px] text-slate-400 block">STRN: {companyStrn || '1234567890123'}</span>
                    </div>
                  </div>
                )}

                {/* Seller & Customer block */}
                <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-3 text-slate-700">
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-bold text-slate-400">Invoice Registry</span>
                    <p className="text-[10px]">Invoice No: <strong className="text-slate-800 font-mono">INV-2026-0042</strong></p>
                    <p className="text-[10px]">Date of Issue: <strong>2026-06-11</strong></p>
                    <p className="text-[10px]">Due Date: <strong>2026-07-11</strong></p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-bold text-slate-400">Bill To</span>
                    <h5 className="font-bold text-slate-800">Stark Industries Pakistan Ltd</h5>
                    <p className="text-[9px] text-slate-400">Sector 15, Korangi Industrial Area, Karachi</p>
                    <p className="text-[9px] text-slate-400">NTN: 8901234-5 | STRN: 9876543210987</p>
                  </div>
                </div>

                {/* Grid Table */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-[10px] border-collapse">
                    <thead>
                      <tr className="text-slate-800 border-b border-slate-200 font-semibold" style={{ backgroundColor: templateStyle === 'indigo' ? '#f8fafc' : '#f1f5f9' }}>
                        <th className="px-3 py-1.5">Item Description</th>
                        <th className="px-3 py-1.5 text-right w-12">Qty</th>
                        <th className="px-3 py-1.5 text-right w-16">Price</th>
                        <th className="px-3 py-1.5 text-right w-16">Tax (GST)</th>
                        <th className="px-3 py-1.5 text-right w-20">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      <tr>
                        <td className="px-3 py-2">
                          <strong className="font-mono text-slate-800 mr-1.5">[RAW-STL-01]</strong>
                          <span>Structural Steel Angles (Standard 20ft)</span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono">15</td>
                        <td className="px-3 py-2 text-right font-mono">{currency} 120.00</td>
                        <td className="px-3 py-2 text-right font-mono">{taxRate}%</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900">{currency} 2,124.00</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2">
                          <strong className="font-mono text-slate-800 mr-1.5">[RAW-CMT-50]</strong>
                          <span>Premium Portland Cement Bag (50kg)</span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono">100</td>
                        <td className="px-3 py-2 text-right font-mono">{currency} 8.50</td>
                        <td className="px-3 py-2 text-right font-mono">{taxRate}%</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900">{currency} 1,003.00</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Calculations & Sign */}
                <div className="flex justify-between items-start pt-3">
                  <div className="w-48 text-[9px] text-slate-400 space-y-1 leading-normal">
                    <p className="font-bold text-slate-600 uppercase">FBR Compliance Declaration</p>
                    <p>This document is verified under FBR Rules for POS integration. Scanner apps can validate using the official QR code signature.</p>
                    
                    {/* QR Code mockup */}
                    <div className="flex items-center gap-2 mt-2 border border-slate-200 p-1.5 bg-slate-50 rounded-lg w-fit">
                      <QrCode size={24} className="text-slate-700" />
                      <span className="text-[7px] text-slate-600 font-mono block uppercase">FBR INTEGRATED VERIFIED RECEIPT</span>
                    </div>
                  </div>
                  
                  <div className="w-56 space-y-1.5 text-slate-500 text-right">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span className="font-mono text-slate-700">{currency} 2,650.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sales Tax ({taxRate}% GST):</span>
                      <span className="font-mono text-slate-700">{currency} {((2650 * taxRate) / 100).toFixed(2)}</span>
                    </div>
                    <div className="w-full h-px bg-slate-200 my-1" />
                    <div className="flex justify-between font-black text-slate-900 text-xs">
                      <span>Grand Total:</span>
                      <span className="font-mono" style={{ color: primaryColor }}>{currency} {(2650 + (2650 * taxRate) / 100).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Footer notes block */}
                <div className="border-t border-dashed border-slate-200 pt-4 mt-4 text-center">
                  <p className="text-[10px] text-slate-700 font-bold" style={{ color: primaryColor }}>{termsAndConditions}</p>
                  <p className="text-[9px] text-slate-500 mt-1 italic">{footerNote}</p>
                </div>

              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
