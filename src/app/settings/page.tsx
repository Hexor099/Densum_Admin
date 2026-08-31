"use client";

import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, CheckCircle2, Building, MapPin, Hash, FileDigit, Repeat, Plus, Trash2, AlertTriangle, CreditCard, ShieldCheck, Loader2, Lock, X } from 'lucide-react';
import { fetchData, writeData, auth } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { generateId } from '@/lib/utils';
import { toast } from 'sonner';
import { useStore } from '@/store/useStore';

export default function SettingsPage() {
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // 2-step verification state
  const [showVerification, setShowVerification] = useState(false);
  const [verifyOtp, setVerifyOtp] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [verifyError, setVerifyError] = useState("");

  const [formData, setFormData] = useState({
    labName: 'Densum Digital Lab',
    gstin: '',
    address: '',
    state: 'Maharashtra',
    hsnCode: '9021',
    invoiceSequence: 1,
    // Composition Scheme fields
    compositionRate: 1.0, // 1% for manufacturers (0.5% CGST + 0.5% SGST)
    compositionTurnoverLimit: 15000000, // ₹1.5 Crore
    // ITR fields
    panNumber: '',
    bankName: '',
    bankAccountNo: '',
    bankIFSC: '',
  });

  const [recurringExpenses, setRecurringExpenses] = useState<any[]>([]);

  const storeSettings = useStore(state => state.settings);
  const { refreshSettings, suppliers: storeSuppliers } = useStore();
  const [isStoreLoaded, setIsStoreLoaded] = useState(false);

  useEffect(() => {
    if (storeSettings && Object.keys(storeSettings).length > 0 && !isStoreLoaded) {
      const { recurring_expenses, ...generalSettings } = storeSettings;
      if (Object.keys(generalSettings).length > 0) {
        setFormData(prev => ({ ...prev, ...generalSettings } as any));
      }
      if (recurring_expenses) {
        setRecurringExpenses(Object.values(recurring_expenses));
      }
      setIsStoreLoaded(true);
      setLoading(false);
    } else if (Object.keys(storeSettings).length === 0) {
      setLoading(false);
    }
  }, [storeSettings, isStoreLoaded]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const numericFields = ['invoiceSequence', 'compositionRate', 'compositionTurnoverLimit'];
    setFormData({ 
      ...formData, 
      [name]: numericFields.includes(name) ? Number(value) : value 
    });
    setSaved(false);
  };

  const handleActualSave = async () => {
    setIsSaving(true);
    
    const recObj: any = {};
    recurringExpenses.forEach(r => { recObj[r.id] = r; });
    
    // Save everything together to prevent Firebase from overwriting child nodes
    const finalData = { ...formData, recurring_expenses: recObj };
    const result = await writeData('settings', finalData);
    
    setIsSaving(false);
    if (result.success) {
      await refreshSettings();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      toast.error("Failed to save settings");
    }
  };

  const handleSave = async () => {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(otp);
    setShowVerification(true);
    setVerifyOtp('');
    setVerifyError('');
    
    toast.loading("Sending OTP to your email...", { id: 'otp-toast' });

    try {
      // Using FormSubmit for frictionless email sending
      const response = await fetch("https://formsubmit.co/ajax/baleeghhaider04101999@gmail.com", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          _subject: "Densum Admin - Security Verification",
          OTP_Code: otp,
          Message: "Please use this 6-digit OTP to verify your settings changes. Do not share this with anyone.",
          _template: "box",
          _captcha: "false"
        })
      });
      
      const data = await response.json();
      if (data.success) {
        toast.success(`OTP sent to baleeghhaider... (Check spam/activation if first time)`, { id: 'otp-toast', duration: 8000 });
      } else {
        toast.success(`Security Check: OTP simulated (Service error). Demo OTP: ${otp}`, { id: 'otp-toast', duration: 8000 });
      }
    } catch (err) {
      toast.success(`Security Check: Network error. (Demo OTP: ${otp})`, { id: 'otp-toast', duration: 8000 });
    }
  };

  const handleVerifyAndSave = (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError('');
    
    if (verifyOtp === generatedOtp) {
      setShowVerification(false);
      handleActualSave();
    } else {
      setVerifyError("Incorrect OTP. Please try again.");
    }
  };

  const addRecurringExpense = () => {
    setRecurringExpenses([...recurringExpenses, {
      id: generateId(),
      desc: '',
      category: 'Rent',
      amount: '',
      dayOfMonth: 1
    }]);
  };

  const updateRecurring = (id: string, field: string, value: any) => {
    setRecurringExpenses(recurringExpenses.map(r => r.id === id ? { ...r, [field]: value } : r));
    setSaved(false);
  };

  const removeRecurring = (id: string) => {
    setRecurringExpenses(recurringExpenses.filter(r => r.id !== id));
    setSaved(false);
  };

  if (loading) {
    return <div className="p-8 text-center text-white">Loading settings...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Lab Settings</h1>
        <p className="text-foreground/70">Configure your lab details, GST Composition Scheme, and ITR settings.</p>
      </header>

      {/* General Configuration */}
      <div className="bg-panel rounded-xl border border-panel-border p-8 shadow-lg">
        <div className="flex items-center gap-3 mb-8 pb-4 border-b border-panel-border/50">
          <SettingsIcon size={24} className="text-accent" />
          <h2 className="text-xl font-bold text-white">General Configuration</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-foreground/70 mb-2">
                <Building size={16} /> Lab Name
              </label>
              <input 
                type="text" name="labName"
                value={formData.labName} onChange={handleChange}
                className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-foreground/70 mb-2">
                <Hash size={16} /> GSTIN
              </label>
              <input 
                type="text" name="gstin"
                value={formData.gstin} onChange={handleChange}
                className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent transition-colors uppercase"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-foreground/70 mb-2">
                <Hash size={16} /> Default HSN/SAC Code
              </label>
              <input 
                type="text" name="hsnCode"
                value={formData.hsnCode} onChange={handleChange}
                className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent transition-colors"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-foreground/70 mb-2">
                <CreditCard size={16} /> PAN Number
              </label>
              <input 
                type="text" name="panNumber"
                value={formData.panNumber} onChange={handleChange}
                placeholder="ABCDE1234F"
                className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent transition-colors uppercase"
              />
              <p className="text-xs text-foreground/50 mt-1">Required for ITR filing.</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-foreground/70 mb-2">
                <MapPin size={16} /> State
              </label>
              <input 
                type="text" name="state"
                value={formData.state} onChange={handleChange}
                className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent transition-colors"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-foreground/70 mb-2">
                <MapPin size={16} /> Full Address
              </label>
              <textarea 
                name="address"
                value={formData.address} onChange={handleChange}
                className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent resize-none h-[116px] transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-panel-border/50">
          <div className="max-w-md">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground/70 mb-2">
              <FileDigit size={16} /> Next Invoice Sequence Number
            </label>
            <input 
              type="number" name="invoiceSequence"
              value={formData.invoiceSequence} onChange={handleChange}
              className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent transition-colors"
            />
            <p className="text-xs text-foreground/50 mt-2">This will automatically increment when a new Bill of Supply is generated.</p>
          </div>
        </div>
      </div>

      {/* GST Composition Scheme */}
      <div className="bg-panel rounded-xl border border-green-500/30 p-8 shadow-lg">
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-panel-border/50">
          <ShieldCheck size={24} className="text-green-400" />
          <div>
            <h2 className="text-xl font-bold text-white">GST Composition Scheme</h2>
            <p className="text-xs text-green-400/80 mt-1">Section 10 of CGST Act — Manufacturer category</p>
          </div>
        </div>

        <div className="mb-6 p-4 bg-green-500/5 border border-green-500/20 rounded-lg">
          <p className="text-sm text-foreground/70">
            Under the Composition Scheme, you pay a <strong className="text-green-400">flat tax on total turnover</strong> instead of charging GST to customers. 
            Your invoices will be issued as <strong className="text-white">"Bill of Supply"</strong> (not Tax Invoice) and will include the mandatory disclaimer.
            You <strong className="text-yellow-400">cannot claim Input Tax Credit (ITC)</strong> on purchases.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-foreground/70 mb-2">
              <Hash size={16} /> Composition Tax Rate (%)
            </label>
            <input 
              type="number" name="compositionRate" step="0.1"
              value={formData.compositionRate} onChange={handleChange}
              className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent transition-colors"
            />
            <p className="text-xs text-foreground/50 mt-1">
              Manufacturers: 1% (0.5% CGST + 0.5% SGST) • Service Providers: 6% (3% CGST + 3% SGST)
            </p>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-foreground/70 mb-2">
              <AlertTriangle size={16} /> Annual Turnover Limit (₹)
            </label>
            <input 
              type="number" name="compositionTurnoverLimit"
              value={formData.compositionTurnoverLimit} onChange={handleChange}
              className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent transition-colors"
            />
            <p className="text-xs text-foreground/50 mt-1">
              ₹1.5 Crore for regular states • ₹75 Lakh for special category states. You&apos;ll be alerted when approaching this limit.
            </p>
          </div>
        </div>
      </div>

      {/* Bank Details for ITR */}
      <div className="bg-panel rounded-xl border border-panel-border p-8 shadow-lg">
        <div className="flex items-center gap-3 mb-8 pb-4 border-b border-panel-border/50">
          <CreditCard size={24} className="text-accent" />
          <h2 className="text-xl font-bold text-white">Bank Details (for ITR)</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-foreground/70 mb-2">Bank Name</label>
            <input type="text" name="bankName" value={formData.bankName} onChange={handleChange}
              className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent transition-colors"
              placeholder="e.g. State Bank of India"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground/70 mb-2">Account Number</label>
            <input type="text" name="bankAccountNo" value={formData.bankAccountNo} onChange={handleChange}
              className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent transition-colors"
              placeholder="e.g. 123456789012"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground/70 mb-2">IFSC Code</label>
            <input type="text" name="bankIFSC" value={formData.bankIFSC} onChange={handleChange}
              className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent transition-colors uppercase"
              placeholder="e.g. SBIN0001234"
            />
          </div>
        </div>
      </div>

      {/* Recurring Expenses Section */}
      <div className="bg-panel rounded-xl border border-panel-border p-8 shadow-lg">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-panel-border/50">
          <div className="flex items-center gap-3">
            <Repeat size={24} className="text-accent" />
            <h2 className="text-xl font-bold text-white">Recurring Expenses (Auto-Log)</h2>
          </div>
          <button 
            onClick={addRecurringExpense}
            className="px-4 py-2 bg-accent/20 text-accent font-bold rounded-lg hover:bg-accent/30 flex items-center gap-2 text-sm"
          >
            <Plus size={16} /> Add Template
          </button>
        </div>

        <div className="space-y-4">
          {recurringExpenses.length === 0 ? (
            <p className="text-foreground/50 text-center py-4">No recurring expenses set up.</p>
          ) : (
            recurringExpenses.map((r, index) => (
              <div key={r.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-black/20 p-4 rounded-lg border border-panel-border/50">
                <div className="md:col-span-4">
                  <label className="block text-xs font-medium text-foreground/70 mb-1">Description</label>
                  <input 
                    type="text" 
                    value={r.desc} 
                    onChange={e => updateRecurring(r.id, 'desc', e.target.value)}
                    placeholder="e.g. Office Rent"
                    className="w-full bg-black/40 border border-panel-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-accent text-sm"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-medium text-foreground/70 mb-1">Category</label>
                  <select 
                    value={r.category} 
                    onChange={e => updateRecurring(r.id, 'category', e.target.value)}
                    className="w-full bg-black/40 border border-panel-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-accent text-sm"
                  >
                    <option value="Rent">Rent</option>
                    <option value="Salary">Salary &amp; Wages</option>
                    <option value="EMI">EMI / Loan Interest</option>
                    <option value="Software">Software/Subscriptions</option>
                    <option value="Utilities">Utilities (Power, Water)</option>
                    <option value="Insurance">Insurance</option>
                    <option value="Professional Fees">Professional Fees (CA/Legal)</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-foreground/70 mb-1">Amount (₹)</label>
                  <input 
                    type="number" 
                    value={r.amount} 
                    onChange={e => updateRecurring(r.id, 'amount', Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-black/40 border border-panel-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-accent text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-foreground/70 mb-1">Day of Month</label>
                  <input 
                    type="number" 
                    min="1" max="31"
                    value={r.dayOfMonth} 
                    onChange={e => updateRecurring(r.id, 'dayOfMonth', Number(e.target.value))}
                    className="w-full bg-black/40 border border-panel-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-accent text-sm"
                  />
                </div>
                <div className="md:col-span-1 flex justify-end pb-1">
                  <button onClick={() => removeRecurring(r.id)} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-10 flex items-center justify-end gap-4 border-t border-panel-border/50 pt-8">
          {saved && (
            <span className="text-green-400 flex items-center gap-2 animate-in fade-in slide-in-from-right-4">
              <CheckCircle2 size={18} /> Settings Saved successfully
            </span>
          )}
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-8 py-3 bg-accent text-panel font-bold rounded-lg hover:bg-accent-glow transition-all shadow-[0_0_15px_rgba(0,194,255,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <span className="w-5 h-5 border-2 border-panel border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <Save size={18} />
            )}
            Save Changes
          </button>
        </div>
      </div>

      {/* Data Management Section (Testing) */}
      <div className="bg-panel rounded-xl border border-red-500/30 p-8 shadow-lg mt-8">
        <div className="flex items-center gap-3 mb-8 pb-4 border-b border-panel-border/50">
          <AlertTriangle size={24} className="text-red-400" />
          <h2 className="text-xl font-bold text-white">Data Management (Testing)</h2>
        </div>
        <p className="text-foreground/70 mb-6 text-sm">
          Warning: These actions are destructive and cannot be undone. They will permanently delete data from your database.
        </p>
        <div className="flex flex-wrap gap-4">
          <button 
            onClick={async () => {
              if (confirm('Are you sure you want to completely clear the inventory and history? This is for testing only.')) {
                setLoading(true);
                await writeData('lab_catalog', null);
                await writeData('inventory_history', null);
                await writeData('bills', null);
                await writeData('supplier_ledger', null);
                for (const id of Object.keys(storeSuppliers)) {
                  await writeData(`suppliers/${id}/balance`, 0);
                }
                toast.success('Inventory cleared successfully');
                setLoading(false);
              }
            }}
            className="px-5 py-3 bg-red-500/20 text-red-400 font-bold rounded-xl hover:bg-red-500/30 transition-all border border-red-500/30 flex items-center gap-2"
          >
            <Trash2 size={20} />
            Clear Inventory
          </button>
          
          <button 
            onClick={async () => {
              if (confirm('Are you sure you want to completely clear all expenses? This is for testing only.')) {
                setLoading(true);
                await writeData('expenses', null);
                toast.success('Expenses cleared successfully');
                setLoading(false);
              }
            }}
            className="px-5 py-3 bg-red-500/20 text-red-400 font-bold rounded-xl hover:bg-red-500/30 transition-all border border-red-500/30 flex items-center gap-2"
          >
            <Trash2 size={20} />
            Clear Expenses
          </button>
        </div>
      </div>

      {/* 2-Step Verification Modal */}
      {showVerification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in p-4">
          <div className="w-full max-w-md bg-panel border border-panel-border rounded-2xl shadow-2xl p-6 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent">
                  <Lock size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Security Verification</h3>
                  <p className="text-xs text-foreground/60">2-step verification required</p>
                </div>
              </div>
              <button onClick={() => setShowVerification(false)} className="p-2 text-foreground/50 hover:bg-black/20 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleVerifyAndSave} className="space-y-4">
              {verifyError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg flex items-center gap-2">
                  <AlertTriangle size={16} /> {verifyError}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-2 text-center">Enter 6-Digit OTP</label>
                <div className="relative max-w-[200px] mx-auto">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/40" />
                  <input
                    type="text"
                    maxLength={6}
                    value={verifyOtp}
                    onChange={(e) => setVerifyOtp(e.target.value.replace(/\D/g, ''))}
                    required
                    autoFocus
                    className="w-full bg-black/40 border border-panel-border rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-accent transition-colors tracking-[0.5em] font-mono text-center"
                    placeholder="••••••"
                  />
                </div>
                <p className="text-xs text-foreground/50 mt-3 text-center">We've sent a 6-digit verification code to baleeghhaider04101999@gmail.com.</p>
              </div>
              
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-panel-border/50">
                <button
                  type="button"
                  onClick={() => setShowVerification(false)}
                  className="px-4 py-2 bg-black/20 text-foreground font-medium rounded-lg hover:bg-black/40 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-accent text-panel font-bold rounded-lg hover:bg-accent-glow transition-all shadow-[0_0_15px_rgba(0,194,255,0.3)] flex items-center gap-2"
                >
                  <Save size={18} />
                  Verify & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
