import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Plus, Minus, Trash2, Check, ShieldAlert, ShoppingCart, User, Landmark, Printer, X } from 'lucide-react';

interface Product {
  id: string;
  sku: string;
  name: string;
  salesPrice: number;
  type: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

export default function POSInvoices({ currency }: { currency: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Cart & POS state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [formError, setFormError] = useState('');
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [createdInvoice, setCreatedInvoice] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadMetadata() {
    try {
      setLoading(true);
      
      // Load products
      const productsData = await api.getProducts();
      setProducts(productsData.filter((p: any) => p.type === 'STOCK' || p.type === 'SERVICE'));

      // Load contacts (customers)
      const contactsData = await api.getInvoiceContacts();
      const custs = contactsData.filter((c: any) => c.type === 'CUSTOMER' || c.type === 'BOTH');
      setCustomers(custs);
      if (custs.length > 0) {
        setSelectedCustomerId(custs[0].id); // Pre-select first
      }

      // Load accounts for payment destination (Cash/Bank)
      const coa = await api.getCoA();
      const paymentAccs = coa.filter((a: any) => a.code === '10100' || a.code === '10200');
      setAccounts(paymentAccs);
      if (paymentAccs.length > 0) {
        setPaymentAccountId(paymentAccs[0].id); // Pre-select cash
      }
    } catch (err) {
      console.error('Error loading POS metadata:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMetadata();
  }, []);

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      setCart(cart.map(item => 
        item.product.id === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId: string, amount: number) => {
    const updated = cart.map(item => {
      if (item.product.id === productId) {
        const newQty = item.quantity + amount;
        return newQty > 0 ? { ...item, quantity: newQty } : null;
      }
      return item;
    }).filter(Boolean) as CartItem[];
    setCart(updated);
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const getSubtotal = () => cart.reduce((acc, item) => acc + (item.product.salesPrice * item.quantity), 0);
  const getTax = () => getSubtotal() * 0.18; // 18% standard GST
  const getGrandTotal = () => getSubtotal() + getTax();

  const handleCheckout = async () => {
    if (cart.length === 0) {
      setFormError('Cart is empty. Please add items before checkout.');
      return;
    }
    if (!selectedCustomerId) {
      setFormError('Please select a customer.');
      return;
    }
    if (!paymentAccountId) {
      setFormError('Please select a payment destination account.');
      return;
    }

    setFormError('');
    setSubmitting(true);

    try {
      const invoiceNumber = `POS-${Math.floor(100000 + Math.random() * 900000)}`;
      const payload = {
        invoiceNumber,
        contactId: selectedCustomerId,
        date: new Date().toISOString(),
        dueDate: new Date().toISOString(), // POS is cleared instantly
        isPos: true,
        paymentAccountId,
        lines: cart.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: item.product.salesPrice,
          discountPercent: 0,
          taxPercent: 18 // standard 18% tax
        }))
      };

      const result = await api.createInvoice(payload);
      setCreatedInvoice(result);
      setCheckoutSuccess(true);
      setCart([]); // Clear cart
    } catch (err: any) {
      setFormError(err.message || 'Error occurred during POS checkout');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-[calc(100vh-12rem)] flex gap-6">
      {/* Products list (Left) */}
      <div className="flex-1 flex flex-col min-w-0 bg-brand-950/20 border border-brand-800/30 rounded-xl overflow-hidden shadow-glass p-5 space-y-4">
        <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
          🏪 Product Register
        </h3>
        
        {loading ? (
          <div className="flex-1 flex justify-center items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-1">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map(product => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="group bg-brand-900/10 hover:bg-brand-900/30 border border-brand-800/35 hover:border-indigo-500/40 rounded-xl p-4 text-left transition-all duration-200 space-y-3"
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-xs uppercase font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                      {product.sku}
                    </span>
                    <span className="text-xs text-slate-500 font-semibold uppercase">
                      {product.type}
                    </span>
                  </div>
                  <h4 className="font-semibold text-slate-200 truncate group-hover:text-indigo-300 transition-colors">
                    {product.name}
                  </h4>
                  <div className="flex justify-between items-center pt-2 border-t border-brand-800/10">
                    <span className="text-xs text-slate-500">Unit Price</span>
                    <span className="text-sm font-bold text-slate-100">
                      {currency} {product.salesPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Cart register & Checkout (Right) */}
      <div className="w-96 flex flex-col bg-brand-950/40 border border-brand-800/30 rounded-xl overflow-hidden shadow-glass p-5 space-y-4 shrink-0">
        <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
          <ShoppingCart size={18} className="text-indigo-400" /> Active Order Cart
        </h3>

        {formError && (
          <div className="bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg text-rose-450 text-xs flex items-center gap-1.5">
            <ShieldAlert size={14} className="shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Cart items list */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col justify-center items-center text-slate-500 space-y-2 py-12">
              <ShoppingCart size={32} className="opacity-20" />
              <p className="text-xs font-semibold text-center">Cart is empty.<br/>Select products from register.</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.product.id} className="bg-brand-900/10 border border-brand-800/20 p-3 rounded-lg flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-slate-200 truncate">{item.product.name}</h4>
                  <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                    {currency} {item.product.salesPrice.toFixed(2)} × {item.quantity}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button 
                    onClick={() => updateQuantity(item.product.id, -1)}
                    className="p-1 bg-brand-800/40 text-slate-400 hover:bg-brand-800 hover:text-slate-200 rounded"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="font-bold text-slate-200 w-6 text-center">{item.quantity}</span>
                  <button 
                    onClick={() => updateQuantity(item.product.id, 1)}
                    className="p-1 bg-brand-800/40 text-slate-400 hover:bg-brand-800 hover:text-slate-200 rounded"
                  >
                    <Plus size={12} />
                  </button>
                  <button 
                    onClick={() => removeFromCart(item.product.id)}
                    className="p-1 text-slate-500 hover:text-rose-450 ml-1"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Checkout config */}
        <div className="space-y-3 pt-3 border-t border-brand-800/30">
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-slate-450 uppercase flex items-center gap-1">
              <User size={12} /> Customer
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full rounded-lg bg-brand-900/20 border border-brand-800/40 text-slate-350 p-2 text-xs"
            >
              {customers.map(c => (
                <option key={c.id} value={c.id} className="bg-slate-950">{c.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-slate-450 uppercase flex items-center gap-1">
              <Landmark size={12} /> Payment Destination
            </label>
            <select
              value={paymentAccountId}
              onChange={(e) => setPaymentAccountId(e.target.value)}
              className="w-full rounded-lg bg-brand-900/20 border border-brand-800/40 text-slate-350 p-2 text-xs"
            >
              {accounts.map(a => (
                <option key={a.id} value={a.id} className="bg-slate-950">[{a.code}] {a.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Pricing Summary */}
        <div className="bg-brand-900/10 p-3 rounded-lg border border-brand-800/20 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">Cart Subtotal:</span>
            <span className="text-slate-300 font-medium">{currency} {getSubtotal().toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Sales Tax (GST 18%):</span>
            <span className="text-slate-300 font-medium">{currency} {getTax().toFixed(2)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-brand-800/10 text-sm font-bold text-slate-200">
            <span>Grand Total:</span>
            <span className="text-indigo-400">{currency} {getGrandTotal().toFixed(2)}</span>
          </div>
        </div>

        <button
          onClick={handleCheckout}
          disabled={submitting || cart.length === 0}
          className="w-full btn-primary py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2"
        >
          {submitting ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          ) : (
            <Check size={16} />
          )}
          Instantly Checkout (POS)
        </button>
      </div>

      {/* POS Receipt clearance Modal */}
      {checkoutSuccess && createdInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white text-slate-900 rounded-xl p-6 shadow-glass relative space-y-4 border border-slate-200">
            <button 
              onClick={() => { setCheckoutSuccess(false); setCreatedInvoice(null); }}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X size={18} />
            </button>

            {/* Receipt headers */}
            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold tracking-tight text-slate-900">BURAQ CLOUD ERP</h2>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Point of Sale Transaction</p>
              <div className="w-full border-t border-dashed border-slate-300 pt-2 text-[10px] text-slate-500 flex justify-between">
                <span>Receipt: <strong>{createdInvoice.invoiceNumber}</strong></span>
                <span>Date: {new Date(createdInvoice.date).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Receipt lines */}
            <div className="border-t border-dashed border-slate-300 py-2 space-y-1.5 text-xs">
              <div className="grid grid-cols-12 font-bold text-[10px] text-slate-500 border-b border-slate-200 pb-1">
                <span className="col-span-6">Item Description</span>
                <span className="col-span-2 text-right">Qty</span>
                <span className="col-span-4 text-right">Total</span>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                {createdInvoice.lines?.map((line: any, idx: number) => (
                  <div key={idx} className="grid grid-cols-12 text-[11px] text-slate-800 font-mono">
                    <span className="col-span-6 truncate">{line.product?.name || 'Stock Item'}</span>
                    <span className="col-span-2 text-right">{line.quantity}</span>
                    <span className="col-span-4 text-right">{currency} {line.lineTotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="border-t border-dashed border-slate-300 pt-2 space-y-1 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Net Subtotal:</span>
                <span>{currency} {createdInvoice.subTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sales Tax (GST 18%):</span>
                <span>{currency} {createdInvoice.taxTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-dashed border-slate-300 pt-1.5">
                <span>GRAND TOTAL:</span>
                <span>{currency} {createdInvoice.grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center pt-2 border-t border-dashed border-slate-300 text-[10px] text-slate-400 font-medium">
              <p>Paid via Cash / Bank instantly.</p>
              <p className="mt-1">Thank you for your business!</p>
              
              <button
                onClick={() => { alert('Receipt print command triggered (Simulated)'); }}
                className="mt-4 w-full flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white py-2 rounded-lg text-xs font-semibold"
              >
                <Printer size={14} /> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
