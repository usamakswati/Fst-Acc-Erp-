import React from 'react';
import { Trash2, Plus } from 'lucide-react';

export interface InvoiceLineItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxPercent: number;
  lineTotal: number;
}

interface InvoiceGridProps {
  lines: InvoiceLineItem[];
  setLines: React.Dispatch<React.SetStateAction<InvoiceLineItem[]>>;
  products: any[];
  taxRate: number;
  currency: string;
}

export default function InvoiceGrid({
  lines,
  setLines,
  products,
  taxRate,
  currency,
}: InvoiceGridProps) {

  const addLine = () => {
    setLines([
      ...lines,
      {
        productId: '',
        sku: '',
        name: '',
        quantity: 1,
        unitPrice: 0.0,
        discountPercent: 0.0,
        taxPercent: taxRate, // default to tenant tax rate
        lineTotal: 0.0,
      },
    ]);
  };

  const removeLine = (index: number) => {
    const updated = lines.filter((_, i) => i !== index);
    setLines(updated);
  };

  const updateLine = (index: number, field: keyof InvoiceLineItem, value: any) => {
    const updated = [...lines];
    const line = { ...updated[index] };

    if (field === 'productId') {
      const selectedProd = products.find((p) => p.id === value);
      if (selectedProd) {
        line.productId = selectedProd.id;
        line.sku = selectedProd.sku;
        line.name = selectedProd.name;
        line.unitPrice = selectedProd.salesPrice || 0.0;
      } else {
        line.productId = '';
        line.sku = '';
        line.name = '';
        line.unitPrice = 0.0;
      }
    } else if (field === 'quantity') {
      line.quantity = Math.max(0, parseFloat(value) || 0);
    } else if (field === 'unitPrice') {
      line.unitPrice = Math.max(0, parseFloat(value) || 0);
    } else if (field === 'discountPercent') {
      line.discountPercent = Math.min(100, Math.max(0, parseFloat(value) || 0));
    } else if (field === 'taxPercent') {
      line.taxPercent = Math.min(100, Math.max(0, parseFloat(value) || 0));
    }

    // Calculate line totals
    const rawSub = line.quantity * line.unitPrice;
    const disc = rawSub * (line.discountPercent / 100);
    const netSub = rawSub - disc;
    const tax = netSub * (line.taxPercent / 100);
    
    line.lineTotal = parseFloat((netSub + tax).toFixed(2));
    updated[index] = line;
    setLines(updated);
  };

  // Aggregated calculations
  const calculateTotals = () => {
    let subTotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;

    lines.forEach((line) => {
      const rawLineSub = line.quantity * line.unitPrice;
      const lineDisc = rawLineSub * (line.discountPercent / 100);
      const netLineSub = rawLineSub - lineDisc;
      const lineTax = netLineSub * (line.taxPercent / 100);

      subTotal += rawLineSub;
      discountTotal += lineDisc;
      taxTotal += lineTax;
    });

    const grandTotal = subTotal - discountTotal + taxTotal;

    return {
      subTotal: parseFloat(subTotal.toFixed(2)),
      discountTotal: parseFloat(discountTotal.toFixed(2)),
      taxTotal: parseFloat(taxTotal.toFixed(2)),
      grandTotal: parseFloat(grandTotal.toFixed(2)),
    };
  };

  const totals = calculateTotals();

  return (
    <div className="space-y-4">
      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm min-w-[800px]">
            <thead>
              <tr className="border-b border-brand-800 bg-brand-950/60 text-slate-300">
                <th className="px-3 py-2.5 font-medium w-12 text-center">#</th>
                <th className="px-3 py-2.5 font-medium w-1/3">Item Details (Product/Service)</th>
                <th className="px-3 py-2.5 font-medium w-24">Qty</th>
                <th className="px-3 py-2.5 font-medium w-28">Unit Price</th>
                <th className="px-3 py-2.5 font-medium w-24">Discount %</th>
                <th className="px-3 py-2.5 font-medium w-32">Tax Type (VAT)</th>
                <th className="px-3 py-2.5 font-medium w-32 text-right">Line Net Total</th>
                <th className="px-3 py-2.5 font-medium w-12 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} className="border-b border-brand-900/20 hover:bg-brand-900/10">
                  <td className="px-3 py-2 text-center text-slate-400 text-xs font-semibold">
                    {idx + 1}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={line.productId}
                      onChange={(e) => updateLine(idx, 'productId', e.target.value)}
                      className="w-full bg-slate-900 border border-brand-800 text-slate-100 rounded px-2 py-1 text-sm focus:outline-none"
                    >
                      <option value="">-- Select Product/Service --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          [{p.sku}] {p.name} - ({p.type})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="1"
                      step="any"
                      value={line.quantity}
                      onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                      className="w-full text-right"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="relative">
                      <span className="absolute left-2 top-1 text-xs text-slate-500">{currency}</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={line.unitPrice}
                        onChange={(e) => updateLine(idx, 'unitPrice', e.target.value)}
                        className="w-full text-right pl-7"
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      value={line.discountPercent}
                      onChange={(e) => updateLine(idx, 'discountPercent', e.target.value)}
                      className="w-full text-right"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={line.taxPercent}
                      onChange={(e) => updateLine(idx, 'taxPercent', e.target.value)}
                      className="w-full"
                    >
                      <option value={taxRate}>Standard ({taxRate}%)</option>
                      <option value="0">Zero Rated (0%)</option>
                      <option value="5">Low Rate (5%)</option>
                      <option value="10">Mid Rate (10%)</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-slate-200">
                    {currency} {line.lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      disabled={lines.length === 1}
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

        {/* Footing / Add Line */}
        <div className="flex items-center justify-between p-3 bg-brand-950/40 border-t border-brand-800/40">
          <button
            type="button"
            onClick={addLine}
            className="btn-secondary text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/10"
          >
            <Plus size={16} /> Add Row
          </button>
        </div>
      </div>

      {/* Calculations Total Summary Card */}
      <div className="flex justify-end">
        <div className="w-80 bg-brand-950/50 border border-brand-800/40 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm text-slate-400">
            <span>Subtotal:</span>
            <span>{currency} {totals.subTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-sm text-rose-400/90">
            <span>Total Discount:</span>
            <span>- {currency} {totals.discountTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-400">
            <span>Tax (GST/VAT):</span>
            <span>{currency} {totals.taxTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="w-full h-px bg-brand-800/60 my-2" />
          <div className="flex justify-between font-bold text-base text-slate-100">
            <span>Grand Total:</span>
            <span>{currency} {totals.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
