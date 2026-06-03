import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  Hammer, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  CheckCircle, 
  Cpu, 
  Activity, 
  Maximize2,
  Lock,
  ArrowRight
} from 'lucide-react';

interface ComponentInput {
  rawProductId: string;
  quantity: number;
}

interface ManufacturingProps {
  currency: string;
}

export default function Manufacturing({ currency }: ManufacturingProps) {
  const [boms, setBoms] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Layout switcher
  const [isCreatingBOM, setIsCreatingBOM] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [selectedBOM, setSelectedBOM] = useState<any>(null);

  // New BOM form states
  const [finishedProductId, setFinishedProductId] = useState('');
  const [bomName, setBomName] = useState('');
  const [laborCost, setLaborCost] = useState('0.00');
  const [overheadCost, setOverheadCost] = useState('0.00');
  const [components, setComponents] = useState<ComponentInput[]>([
    { rawProductId: '', quantity: 1 }
  ]);

  // Production Run form states
  const [qtyToBuild, setQtyToBuild] = useState('1');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [bomData, productData, jobData] = await Promise.all([
        api.getBOMs(),
        api.getProducts(),
        api.getJobs()
      ]);
      setBoms(bomData);
      setProducts(productData);
      setJobs(jobData);
    } catch (error) {
      console.error('Error loading manufacturing data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const addComponentRow = () => {
    setComponents([...components, { rawProductId: '', quantity: 1 }]);
  };

  const removeComponentRow = (index: number) => {
    setComponents(components.filter((_, idx) => idx !== index));
  };

  const updateComponent = (index: number, field: keyof ComponentInput, value: any) => {
    const updated = [...components];
    const comp = { ...updated[index] };
    if (field === 'rawProductId') {
      comp.rawProductId = value;
    } else if (field === 'quantity') {
      comp.quantity = Math.max(0.0001, parseFloat(value) || 0);
    }
    updated[index] = comp;
    setComponents(updated);
  };

  const handleCreateBOM = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!finishedProductId || !bomName || components.some(c => !c.rawProductId || c.quantity <= 0)) {
      setErrorMsg('Please specify the finished product, BOM name, and valid quantities for all components.');
      return;
    }

    try {
      await api.createBOM({
        finishedProductId,
        name: bomName,
        laborCost,
        overheadCost,
        items: components.map(c => ({
          rawProductId: c.rawProductId,
          quantity: c.quantity
        }))
      });

      setSuccessMsg(`BOM "${bomName}" created successfully!`);
      await loadData();

      // Reset
      setFinishedProductId('');
      setBomName('');
      setLaborCost('0.00');
      setOverheadCost('0.00');
      setComponents([{ rawProductId: '', quantity: 1 }]);

      setTimeout(() => {
        setIsCreatingBOM(false);
        setSuccessMsg('');
      }, 1500);
    } catch (error: any) {
      setErrorMsg(error.message || 'Error creating BOM');
    }
  };

  const handleRunAssembly = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedBOM) return;

    try {
      const response = await api.runJob({
        bomId: selectedBOM.id,
        quantityToBuild: parseFloat(qtyToBuild)
      });

      setSuccessMsg(`Assembly run completed successfully! Added ${qtyToBuild} units to finished stock.`);
      await loadData();

      setTimeout(() => {
        setIsBuilding(false);
        setSelectedBOM(null);
        setQtyToBuild('1');
        setSuccessMsg('');
      }, 2000);
    } catch (error: any) {
      setErrorMsg(error.message || 'Error executing production assembly job');
    }
  };

  const openBuildModal = (bom: any) => {
    setSelectedBOM(bom);
    setIsBuilding(true);
  };

  if (loading && boms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500" />
        <p className="text-slate-400 text-sm font-medium">Loading BOM formulas and job logs...</p>
      </div>
    );
  }

  const stockProducts = products.filter(p => p.type === 'STOCK');

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Light Manufacturing & Assembly</h2>
          <p className="text-sm text-slate-400 mt-1">
            Build finished items by consuming raw stocks, allocating labor overheads, and updating the ledger.
          </p>
        </div>
        {!isCreatingBOM && !isBuilding && (
          <button onClick={() => setIsCreatingBOM(true)} className="btn-primary">
            <Plus size={16} /> Define New BOM
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-lg text-rose-400 flex items-center gap-3 text-sm">
          <AlertTriangle size={18} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-lg text-emerald-400 flex items-center gap-3 text-sm">
          <CheckCircle size={18} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* CREATE BOM VIEW */}
      {isCreatingBOM ? (
        <form onSubmit={handleCreateBOM} className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-200">New Bill of Materials Formula</h3>
            <button type="button" onClick={() => setIsCreatingBOM(false)} className="btn-secondary">Back to list</button>
          </div>

          {/* Header Info */}
          <div className="glass-panel p-6 grid grid-cols-1 md:grid-cols-4 gap-6 text-sm">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase">BOM Name</label>
              <input type="text" value={bomName} onChange={(e) => setBomName(e.target.value)} placeholder="e.g. Standard PC Build" className="w-full" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase">Finished Stock Item</label>
              <select value={finishedProductId} onChange={(e) => setFinishedProductId(e.target.value)} className="w-full" required>
                <option value="">-- Select Output Product --</option>
                {stockProducts.map(p => (
                  <option key={p.id} value={p.id}>[{p.sku}] {p.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase">Est. Labor Fee / unit</label>
              <input type="number" min="0" step="any" value={laborCost} onChange={(e) => setLaborCost(e.target.value)} className="w-full" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase">Est. Overhead / unit</label>
              <input type="number" min="0" step="any" value={overheadCost} onChange={(e) => setOverheadCost(e.target.value)} className="w-full" />
            </div>
          </div>

          {/* Components Grid */}
          <div className="glass-panel overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-brand-800 bg-brand-950/60 text-slate-300">
                  <th className="px-3 py-2.5 font-medium w-12 text-center">#</th>
                  <th className="px-3 py-2.5 font-medium">Raw Component Material</th>
                  <th className="px-3 py-2.5 font-medium w-48">Qty Needed (Per Finished Good)</th>
                  <th className="px-3 py-2.5 font-medium w-24 text-center">Delete</th>
                </tr>
              </thead>
              <tbody>
                {components.map((comp, idx) => (
                  <tr key={idx} className="border-b border-brand-900/10 hover:bg-brand-900/5">
                    <td className="px-3 py-2 text-center text-slate-400 text-xs font-bold">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <select
                        value={comp.rawProductId}
                        onChange={(e) => updateComponent(idx, 'rawProductId', e.target.value)}
                        className="w-full"
                        required
                      >
                        <option value="">-- Select Component Item --</option>
                        {stockProducts.map(p => (
                          <option key={p.id} value={p.id}>[{p.sku}] {p.name} - (Stock: {p.stockQuantity})</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0.0001"
                        step="any"
                        value={comp.quantity}
                        onChange={(e) => updateComponent(idx, 'quantity', e.target.value)}
                        className="w-full text-right"
                        required
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeComponentRow(idx)}
                        disabled={components.length <= 1}
                        className="p-1 hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 rounded transition-colors disabled:opacity-30"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-3 bg-brand-950/40 border-t border-brand-800/40">
              <button type="button" onClick={addComponentRow} className="btn-secondary text-indigo-400 border-indigo-500/20">
                <Plus size={16} /> Add Raw Material Component
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setIsCreatingBOM(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Save BOM Recipe</button>
          </div>
        </form>
      ) : isBuilding && selectedBOM ? (
        // PRODUCTION RUN ASSEMBLY FORM
        <form onSubmit={handleRunAssembly} className="space-y-6">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => { setIsBuilding(false); setSelectedBOM(null); }} className="p-1 rounded hover:bg-brand-900/50 text-slate-400 hover:text-slate-200">
              <ArrowRight size={18} className="rotate-185" />
            </button>
            <h3 className="text-base font-bold text-slate-200">Run Production Job</h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {/* Recipe checklist */}
              <div className="glass-panel p-6 space-y-4">
                <h4 className="text-sm font-semibold text-slate-300 border-b border-brand-850 pb-2">
                  BOM Checklist: {selectedBOM.name}
                </h4>
                
                <div className="grid grid-cols-2 gap-4 text-xs text-slate-400">
                  <p>Finished Good: <strong>[{selectedBOM.finishedProduct.sku}] {selectedBOM.finishedProduct.name}</strong></p>
                  <p>Labor allocation: <strong>{currency} {selectedBOM.laborCost} /unit</strong></p>
                  <p>Overhead allocation: <strong>{currency} {selectedBOM.overheadCost} /unit</strong></p>
                </div>

                <div className="border border-brand-850 rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-brand-950/60 text-slate-400 border-b border-brand-800">
                        <th className="px-3 py-2 font-medium">Component</th>
                        <th className="px-3 py-2 font-medium text-right w-32">Needed / unit</th>
                        <th className="px-3 py-2 font-medium text-right w-32">Total Required</th>
                        <th className="px-3 py-2 font-medium text-right w-32">In Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBOM.items.map((item: any) => {
                        const totalReq = item.quantity * parseFloat(qtyToBuild || '0');
                        const isShortage = item.rawProduct.stockQuantity < totalReq;

                        return (
                          <tr key={item.id} className="border-b border-brand-900/10 hover:bg-brand-900/5">
                            <td className="px-3 py-2.5">
                              <span className="font-mono font-bold text-indigo-400 mr-2">[{item.rawProduct.sku}]</span>
                              <span className="text-slate-200">{item.rawProduct.name}</span>
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono">{item.quantity}</td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-200">{totalReq.toFixed(4)}</td>
                            <td className={`px-3 py-2.5 text-right font-mono font-bold ${isShortage ? 'text-rose-450' : 'text-emerald-400'}`}>
                              {item.rawProduct.stockQuantity}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Run Assembly trigger widget */}
            <div className="glass-panel p-6 space-y-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Production Parameters</span>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-semibold block">Quantity to Assemble</label>
                <input
                  type="number"
                  min="1"
                  value={qtyToBuild}
                  onChange={(e) => setQtyToBuild(e.target.value)}
                  className="w-full text-center text-lg font-bold"
                  required
                />
              </div>

              <div className="bg-brand-900/20 border border-brand-800/40 p-3 rounded-lg text-[10px] text-slate-450 leading-relaxed space-y-1">
                <span className="font-bold text-slate-300 block mb-0.5">Automated Auditing Posting Actions</span>
                <p>1. Deducts required raw materials from stock levels.</p>
                <p>2. Evaluates consumption costs (FIFO/Weighted Average costing).</p>
                <p>3. Feeds finished desktop asset stocks (+qty).</p>
                <p>4. Generates balanced double-entry manufacturing vouchers.</p>
              </div>

              <button type="submit" className="w-full btn-success font-bold flex items-center justify-center gap-2 py-2.5 shadow-lg shadow-emerald-500/10">
                <Hammer size={18} /> Execute Assembly Run
              </button>
            </div>
          </div>
        </form>
      ) : (
        // SHOW MANUFACTURING OVERVIEW (BOM LIST & JOBS HISTORY)
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Left Column: list of BOM formulas */}
          <div className="xl:col-span-2 space-y-4">
            <h3 className="text-base font-semibold text-slate-200">Bill of Materials (BOM) Formulas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {boms.map(bom => (
                <div key={bom.id} className="glass-panel p-5 flex flex-col justify-between h-[250px]">
                  <div>
                    <div className="flex justify-between items-start">
                      <h4 className="text-base font-bold text-slate-200">{bom.name}</h4>
                      <Cpu size={16} className="text-indigo-400" />
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-1 uppercase font-semibold">
                      Yields: [{bom.finishedProduct.sku}] {bom.finishedProduct.name}
                    </span>
                    <p className="text-xs text-slate-450 mt-3 line-clamp-3">
                      Composed of {bom.items.length} component raw material(s). Includes allocations of {currency} {bom.laborCost} labor and {currency} {bom.overheadCost} overheads.
                    </p>
                  </div>
                  <div className="border-t border-brand-850/50 pt-4 flex justify-between items-center">
                    <span className="text-[10px] font-mono text-slate-500">Created: {new Date(bom.createdAt).toLocaleDateString()}</span>
                    <button 
                      onClick={() => openBuildModal(bom)}
                      className="btn-primary text-xs py-1.5 px-3"
                    >
                      Assemble Item
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Production jobs log */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-slate-200">Completed Assembly Vouchers</h3>
            <div className="glass-panel overflow-hidden max-h-[550px] overflow-y-auto">
              {jobs.length > 0 ? (
                <div className="divide-y divide-brand-900/30">
                  {jobs.map((job) => (
                    <div key={job.id} className="p-4 hover:bg-brand-900/10 transition-colors flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-200">
                            JOB-{job.id.substring(0, 8).toUpperCase()}
                          </span>
                          <span className="text-[9px] uppercase font-bold bg-emerald-500/10 text-emerald-400 px-1 border border-emerald-500/20 rounded">
                            {job.status}
                          </span>
                        </div>
                        <p className="text-slate-450 mt-1">
                          Yields: [{job.bom.finishedProduct.sku}] x {job.quantityToBuild}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Date: {new Date(job.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-slate-200">
                          {currency} {job.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                        <p className="text-[9px] text-slate-500 mt-1 uppercase font-semibold">Total Cost</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 text-sm font-medium">
                  No assembly runs completed yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
