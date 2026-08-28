"use client";

import { useState, useEffect, useMemo } from 'react';
import { Building2, Search, Plus, Trash2, Phone, MapPin, Receipt, Edit, DollarSign } from 'lucide-react';
import { fetchData, writeData, atomicIncrement } from '@/lib/firebase';
import { generateId } from '@/lib/utils';
import { toast } from 'sonner';
import { useStore } from '@/store/useStore';

type Supplier = {
  id: string;
  name: string;
  phone: string;
  gstin: string;
  address: string;
  balance: number;
};

export default function SuppliersPage() {
  const { suppliers, supplier_ledger: ledger, isInitialized, initializeStore, refreshSuppliers, refreshSupplierLedger } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  
  // Modals
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    gstin: '',
    address: ''
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    date: new Date().toISOString().substring(0, 10),
    paymentMode: 'Bank Transfer',
    refNumber: ''
  });

  useEffect(() => {
    if (!isInitialized) initializeStore();
  }, [isInitialized, initializeStore]);

  const filteredSuppliers = useMemo(() => {
    return Object.values(suppliers).filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.phone.includes(searchTerm)
    ).sort((a, b) => b.balance - a.balance);
  }, [suppliers, searchTerm]);

  const totalPayable = useMemo(() => {
    return Object.values(suppliers).reduce((sum, s) => sum + (Number(s.balance) || 0), 0);
  }, [suppliers]);

  const openSupplierModal = (id?: string) => {
    if (id && suppliers[id]) {
      setEditingSupplierId(id);
      setFormData(suppliers[id]);
    } else {
      setEditingSupplierId(null);
      setFormData({ name: '', phone: '', gstin: '', address: '' });
    }
    setIsSupplierModalOpen(true);
  };

  const handleSaveSupplier = async () => {
    if (!formData.name) {
      toast.error("Name is required");
      return;
    }
    
    const id = editingSupplierId || `SUP-${generateId()}`;
    const newSupplier = {
      ...formData,
      id,
      balance: editingSupplierId ? suppliers[editingSupplierId].balance : 0
    };

    setIsSupplierModalOpen(false);

    await writeData(`suppliers/${id}`, newSupplier);
    await refreshSuppliers();
  };

  const openPaymentModal = (id: string) => {
    setSelectedSupplier(id);
    setPaymentForm({
      amount: '',
      date: new Date().toISOString().substring(0, 10),
      paymentMode: 'Bank Transfer',
      refNumber: ''
    });
    setIsPaymentModalOpen(true);
  };

  const handleSavePayment = async () => {
    if (!selectedSupplier || !paymentForm.amount || Number(paymentForm.amount) <= 0) {
      toast.error("Valid amount is required");
      return;
    }
    
    const amountNum = Number(paymentForm.amount);
    
    const newTx = {
      id: generateId(),
      date: paymentForm.date,
      type: 'Payment',
      amount: -amountNum, // Reduces what we owe
      paymentMode: paymentForm.paymentMode,
      refNumber: paymentForm.refNumber
    };

    setIsPaymentModalOpen(false);

    // Write to Firebase atomically
    const { appendToList } = await import('@/lib/firebase');
    await appendToList(`supplier_ledger/${selectedSupplier}`, newTx);
    await atomicIncrement(`suppliers/${selectedSupplier}/balance`, -amountNum);
    
    await refreshSuppliers();
    await refreshSupplierLedger();
  };

  if (!isInitialized) {
    return <div className="p-10 text-center text-foreground/50 animate-pulse">Loading Suppliers...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <Building2 className="text-accent" /> Supplier Management
          </h1>
          <p className="text-foreground/70">Track vendors and accounts payable.</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-panel border border-panel-border px-5 py-3 rounded-xl shadow-lg flex items-center gap-4">
            <div className="text-sm text-foreground/60 font-bold uppercase tracking-wider">Total Payable</div>
            <div className="text-2xl font-bold text-red-400">₹{totalPayable.toLocaleString()}</div>
          </div>
          <button 
            onClick={() => openSupplierModal()}
            className="px-5 py-3 bg-accent text-panel font-bold rounded-xl hover:bg-accent-glow transition-all shadow-[0_0_15px_rgba(0,194,255,0.3)] flex items-center gap-2"
          >
            <Plus size={20} /> Add Supplier
          </button>
        </div>
      </header>

      <div className="bg-panel rounded-xl border border-panel-border overflow-hidden shadow-lg">
        <div className="p-5 border-b border-panel-border/50 bg-black/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="font-bold text-white text-lg">Supplier Directory</h3>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50" size={20} />
            <input 
              type="text" 
              placeholder="Search by name or phone..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-black/40 border border-panel-border rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-accent transition-colors shadow-inner"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-foreground/60 uppercase bg-black/40">
              <tr>
                <th className="px-6 py-4">Supplier Name</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">GSTIN / Address</th>
                <th className="px-6 py-4 text-right">Balance Due (₹)</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.map((s) => (
                <tr key={s.id} className="border-b border-panel-border/30 hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4 font-semibold text-white">
                    {s.name}
                  </td>
                  <td className="px-6 py-4 text-foreground/80">
                    <div className="flex items-center gap-2">
                      <Phone size={14} className="text-foreground/50" /> {s.phone || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-foreground/80">
                    {s.gstin && <div className="text-xs font-mono bg-white/5 px-2 py-1 rounded inline-block mb-1">{s.gstin}</div>}
                    <div className="flex items-center gap-2 text-xs truncate max-w-[200px]" title={s.address}>
                      {s.address && <MapPin size={12} className="text-foreground/50" />} {s.address}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-bold text-lg ${s.balance > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {s.balance.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => openPaymentModal(s.id)}
                        className="px-3 py-1.5 bg-green-500/20 text-green-400 font-bold rounded border border-green-500/30 hover:bg-green-500/30 flex items-center gap-1 text-xs"
                      >
                        <DollarSign size={14} /> Pay
                      </button>
                      <button 
                        onClick={() => openSupplierModal(s.id)}
                        className="p-1.5 text-accent hover:bg-accent/20 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredSuppliers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-foreground/50">No suppliers found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supplier Modal */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-panel border border-panel-border rounded-xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-panel-border/50 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">{editingSupplierId ? 'Edit Supplier' : 'Add New Supplier'}</h2>
              <button onClick={() => setIsSupplierModalOpen(false)} className="text-foreground/50 hover:text-white">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-1">Supplier Name *</label>
                <input 
                  type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-1">Phone Number</label>
                <input 
                  type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}
                  className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-1">GSTIN</label>
                <input 
                  type="text" value={formData.gstin} onChange={e => setFormData({...formData, gstin: e.target.value})}
                  className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accent uppercase"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-1">Address</label>
                <textarea 
                  value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})}
                  className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accent resize-none h-20"
                />
              </div>
            </div>
            <div className="p-6 border-t border-panel-border/50 flex justify-end gap-3 bg-black/20 rounded-b-xl">
              <button onClick={() => setIsSupplierModalOpen(false)} className="px-4 py-2 text-foreground/70 hover:text-white font-medium">Cancel</button>
              <button onClick={handleSaveSupplier} className="px-6 py-2 bg-accent text-panel font-bold rounded-lg hover:bg-accent-glow">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {isPaymentModalOpen && selectedSupplier && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-panel border border-panel-border rounded-xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-panel-border/50 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">Record Payment</h2>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-foreground/50 hover:text-white">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-4 bg-accent/10 border border-accent/20 rounded-lg">
                <div className="text-xs text-accent uppercase font-bold tracking-wider mb-1">Paying To</div>
                <div className="font-bold text-white">{suppliers[selectedSupplier].name}</div>
                <div className="text-sm text-foreground/70">Current Balance: ₹{suppliers[selectedSupplier].balance.toLocaleString()}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-1">Payment Amount (₹) *</label>
                <input 
                  type="number" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})}
                  className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-3 text-2xl font-bold text-white focus:outline-none focus:border-accent"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground/70 mb-1">Date</label>
                  <input 
                    type="date" value={paymentForm.date} onChange={e => setPaymentForm({...paymentForm, date: e.target.value})}
                    className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground/70 mb-1">Mode</label>
                  <select 
                    value={paymentForm.paymentMode} onChange={e => setPaymentForm({...paymentForm, paymentMode: e.target.value})}
                    className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accent"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="UPI">UPI</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-1">Reference No. (Optional)</label>
                <input 
                  type="text" value={paymentForm.refNumber} onChange={e => setPaymentForm({...paymentForm, refNumber: e.target.value})}
                  placeholder="e.g. UTR / Cheque No"
                  className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accent"
                />
              </div>
            </div>
            <div className="p-6 border-t border-panel-border/50 flex justify-end gap-3 bg-black/20 rounded-b-xl">
              <button onClick={() => setIsPaymentModalOpen(false)} className="px-4 py-2 text-foreground/70 hover:text-white font-medium">Cancel</button>
              <button onClick={handleSavePayment} className="px-6 py-2 bg-green-500 text-black font-bold rounded-lg hover:bg-green-400 transition-colors">Record Payment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
