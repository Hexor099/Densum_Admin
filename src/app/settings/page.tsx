"use client";

import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, CheckCircle2, Building, MapPin, Hash, FileDigit } from 'lucide-react';
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

  useEffect(() => {
    async function loadSettings() {
      const data = await fetchData('settings');
      if (data) {
        setFormData(data);
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
    const result = await writeData('settings', formData);
    setIsSaving(false);
    if (result.success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      alert("Failed to save settings");
    }
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

        <div className="mt-10 flex items-center justify-end gap-4">
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
