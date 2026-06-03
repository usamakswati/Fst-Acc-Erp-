import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Plus, Search, Edit2, Check, X, ShieldAlert, Phone, Mail, MapPin } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  ntn: string | null;
  strn: string | null;
  balance: number;
}

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [ntn, setNtn] = useState('');
  const [strn, setStrn] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function fetchCustomers() {
    try {
      setLoading(true);
      const data = await api.getCustomers();
      setCustomers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCustomers();
  }, []);

  const openCreateModal = () => {
    setEditingCustomer(null);
    setName('');
    setEmail('');
    setPhone('');
    setAddress('');
    setNtn('');
    setStrn('');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setName(customer.name);
    setEmail(customer.email || '');
    setPhone(customer.phone || '');
    setAddress(customer.address || '');
    setNtn(customer.ntn || '');
    setStrn(customer.strn || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Customer name is required');
      return;
    }
    setFormError('');
    setSubmitting(true);

    try {
      const payload = { name, email, phone, address, ntn, strn };
      if (editingCustomer) {
        await api.updateCustomer(editingCustomer.id, payload);
      } else {
        await api.createCustomer(payload);
      }
      setIsModalOpen(false);
      fetchCustomers();
    } catch (err: any) {
      setFormError(err.message || 'An error occurred while saving customer');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (c.phone && c.phone.includes(searchQuery))
  );

  return (
    <div className="space-y-6">
      {/* Action Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search customers..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-full rounded-lg bg-brand-900/20 border border-brand-800/40 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 py-2 text-sm"
          />
        </div>
        
        <button 
          onClick={openCreateModal}
          className="btn-primary flex items-center gap-2 py-2 px-4 text-sm font-semibold rounded-lg"
        >
          <Plus size={18} /> Add Customer
        </button>
      </div>

      {/* Loading state */}
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
                  <th className="p-4">Customer Details</th>
                  <th className="p-4">Contact Info</th>
                  <th className="p-4">Tax Identifiers</th>
                  <th className="p-4 text-right">Outstanding Balance</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-800/20 text-slate-300">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      No customers found. Click "Add Customer" to register one.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-brand-900/10 transition-colors">
                      <td className="p-4">
                        <div className="font-semibold text-slate-100">{customer.name}</div>
                        {customer.address && (
                          <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                            <MapPin size={12} className="shrink-0" />
                            <span className="truncate max-w-[200px]">{customer.address}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-4 space-y-1">
                        {customer.email && (
                          <div className="text-xs text-slate-400 flex items-center gap-1.5">
                            <Mail size={12} className="shrink-0" />
                            <span>{customer.email}</span>
                          </div>
                        )}
                        {customer.phone && (
                          <div className="text-xs text-slate-400 flex items-center gap-1.5">
                            <Phone size={12} className="shrink-0" />
                            <span>{customer.phone}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-4 space-y-1">
                        {customer.ntn && (
                          <div className="text-xs">
                            <span className="text-slate-500">NTN: </span>
                            <span className="font-mono text-slate-300">{customer.ntn}</span>
                          </div>
                        )}
                        {customer.strn && (
                          <div className="text-xs">
                            <span className="text-slate-500">STRN: </span>
                            <span className="font-mono text-slate-300">{customer.strn}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-right font-semibold">
                        <span className={customer.balance > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                          PKR {customer.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <button 
                          onClick={() => openEditModal(customer)}
                          className="p-1.5 hover:bg-indigo-500/10 hover:text-indigo-400 rounded transition-colors text-slate-400"
                          title="Edit Customer"
                        >
                          <Edit2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-brand-950 border border-brand-800/40 rounded-xl p-6 shadow-glass space-y-4">
            <div className="flex justify-between items-center border-b border-brand-800/30 pb-3">
              <h3 className="text-lg font-bold text-slate-100">
                {editingCustomer ? 'Edit Customer Details' : 'Register New Customer'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-450 hover:text-slate-200"
              >
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg text-rose-400 text-xs flex items-center gap-2">
                <ShieldAlert size={16} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase">Customer Name *</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="e.g. Acme Corporation"
                  className="w-full rounded-lg bg-brand-900/20 border border-brand-800/40 text-slate-200 p-2.5"
                  required 
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Email Address</label>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    placeholder="e.g. accounts@acme.com"
                    className="w-full rounded-lg bg-brand-900/20 border border-brand-800/40 text-slate-200 p-2.5"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Phone Number</label>
                  <input 
                    type="text" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)} 
                    placeholder="e.g. +923001234567"
                    className="w-full rounded-lg bg-brand-900/20 border border-brand-800/40 text-slate-200 p-2.5"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase">Billing Address</label>
                <input 
                  type="text" 
                  value={address} 
                  onChange={(e) => setAddress(e.target.value)} 
                  placeholder="e.g. Office 101, Business Center, Karachi"
                  className="w-full rounded-lg bg-brand-900/20 border border-brand-800/40 text-slate-200 p-2.5"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">National Tax Number (NTN)</label>
                  <input 
                    type="text" 
                    value={ntn} 
                    onChange={(e) => setNtn(e.target.value)} 
                    placeholder="e.g. 1234567-8"
                    className="w-full rounded-lg bg-brand-900/20 border border-brand-800/40 text-slate-200 p-2.5 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Sales Tax Registration (STRN)</label>
                  <input 
                    type="text" 
                    value={strn} 
                    onChange={(e) => setStrn(e.target.value)} 
                    placeholder="e.g. 1234567890123"
                    className="w-full rounded-lg bg-brand-900/20 border border-brand-800/40 text-slate-200 p-2.5 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-brand-800/30">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="py-2 px-4 rounded-lg bg-brand-900/40 text-slate-300 hover:text-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="btn-primary py-2 px-6 rounded-lg font-semibold flex items-center gap-1.5"
                >
                  {submitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    <Check size={16} />
                  )}
                  {editingCustomer ? 'Save Changes' : 'Register Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
