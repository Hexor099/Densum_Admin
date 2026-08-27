"use client";

import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, CheckCircle2, Building, MapPin, Hash, FileDigit, Repeat, Plus, Trash2 } from 'lucide-react';
import { fetchData, writeData } from '@/lib/firebase';

export default function SettingsPage() {
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    labName: 'Densum Digital Lab',
    gstin: '',
    address: '',
    state: 'Maharashtra',
    hsnCode: '9021',
    invoiceSequence: 1,
    gstRate: 18.0
  });

  const [recurringExpenses, setRecurringExpenses] = useState<any[]>([]);

  useEffect(() => {
    async function loadSettings() {
      const data = await fetchData('settings');
      if (data) {
        setFormData(data);
      }
      const rec = await fetchData('settings/recurring_expenses');
      if (rec) {
        setRecurringExpenses(Object.values(rec));
      }
      setLoading(false);
    }
    loadSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ 
      ...formData, 
      [name]: name === 'invoiceSequence' || name === 'gstRate' ? Number(value) : value 
    });
    setSaved(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    // Convert array back to object for firebase, or just save as array if Firebase accepts (Firebase accepts arrays but objects are better)
    const recObj: any = {};
    recurringExpenses.forEach(r => { recObj[r.id] = r; });
    
    await writeData('settings/recurring_expenses', recObj);
    const result = await writeData('settings', formData);
    
    setIsSaving(false);
    if (result.success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      alert("Failed to save settings");
    }
  };

  const addRecurringExpense = () => {
    setRecurringExpenses([...recurringExpenses, {
      id: Date.now().toString(),
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
        <p className="text-foreground/70">Configure your lab details, GST, and invoice settings.</p>
      </header>

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
                <Hash size={16} /> Default GST Rate (%)
              </label>
              <input 
                type="number" name="gstRate"
                value={formData.gstRate} onChange={handleChange}
                className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent transition-colors"
              />
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
            <p className="text-xs text-foreground/50 mt-2">This will automatically increment when a new invoice is generated.</p>
          </div>
        </div>
      </div>

      {/* Recurring Expenses Section */}
      <div className="bg-panel rounded-xl border border-panel-border p-8 shadow-lg mt-8">
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
                    <option value="Salary">Salary</option>
                    <option value="EMI">EMI</option>
                    <option value="Software">Software/Subscriptions</option>
                    <option value="Utilities">Utilities</option>
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
    </div>
  );
}
