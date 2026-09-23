"use client";

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Clock, Check, History, ListTodo, Edit, Save, X } from "lucide-react";
import { toast } from "sonner";
import { writeData } from "@/lib/firebase";
import { useStore } from "@/store/useStore";
import { formatDateForDisplay } from "@/lib/utils";
import { PalmerCross } from "@/components/PalmerCross";
import { useAuth } from "@/components/AuthProvider";

export default function ProcuredWorksPage() {
  const { role } = useAuth();
  const procuredData = useStore(state => state.procuredData);
  const excelData = useStore(state => state.excelData);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [editingWorkId, setEditingWorkId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  // Auto-cleanup history older than 7 days
  useEffect(() => {
    if (!procuredData || Object.keys(procuredData).length === 0 || role !== 'admin') return;
    
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const cleanup = async () => {
      for (const [doctorName, entries] of Object.entries(procuredData)) {
        if (!Array.isArray(entries)) continue;
        
        const validEntries = entries.filter(entry => {
          if ((entry.isApproved || entry.isRejected) && entry.processedAt) {
            const processedTime = new Date(entry.processedAt).getTime();
            if (now - processedTime > SEVEN_DAYS_MS) {
              return false; // Remove this entry
            }
          }
          return true; // Keep
        });

        if (validEntries.length !== entries.length) {
          await writeData(`procuredData/${doctorName}`, validEntries);
        }
      }
    };
    
    cleanup();
  }, [procuredData, role]);

  const formatDateForInput = (val: string) => {
    if (!val || val === 'Not Delivered') return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    
    // Convert M/D/YY to YYYY-MM-DD
    const parts = val.split('/');
    if (parts.length === 3) {
      let [m, d, y] = parts;
      if (y.length === 2) y = '20' + y;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return '';
  };

  // Flatten procured data for display
  const allWorks = Object.entries(procuredData || {}).flatMap(([doctorName, entries]) => 
    (Array.isArray(entries) ? entries : []).map(entry => ({ ...entry, doctorName }))
  );

  const pendingWorks = allWorks.filter(w => !w.isApproved && !w.isRejected);
  const historyWorks = allWorks.filter(w => w.isApproved || w.isRejected)
    .sort((a, b) => new Date(b.processedAt || 0).getTime() - new Date(a.processedAt || 0).getTime());
    
  const displayWorks = activeTab === 'pending' ? pendingWorks : historyWorks;

  const handleApprove = async (doctorName: string, entry: any) => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    try {
      // Add to excelData
      const safeDoctorName = doctorName;
      const existingExcelRows = excelData[safeDoctorName] || [];
      // Clean entry by removing the temporary doctorName property and metadata
      const { doctorName: _, isApproved, isRejected, processedAt, ...cleanEntry } = entry;
      const newExcelRows = [cleanEntry, ...existingExcelRows];
      
      // Update in procuredData to keep history
      const existingProcuredRows = procuredData[safeDoctorName] || [];
      const newProcuredRows = existingProcuredRows.map((r: any) => 
        r._id === entry._id ? { ...r, isApproved: true, processedAt: new Date().toISOString() } : r
      );

      // We can update both simultaneously, though doing it sequentially is fine
      await writeData(`excelData/${safeDoctorName}`, newExcelRows);
      await writeData(`procuredData/${safeDoctorName}`, newProcuredRows);
      
      toast.success("Work entry approved and added to workspace.");
    } catch (err: any) {
      toast.error("Failed to approve entry: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApproveAll = async () => {
    if (pendingWorks.length === 0 || isProcessing) return;
    if (!confirm(`Are you sure you want to approve all ${pendingWorks.length} pending works?`)) return;
    
    setIsProcessing(true);
    try {
      // Group by doctor
      const byDoctor: Record<string, any[]> = {};
      pendingWorks.forEach(work => {
        if (!byDoctor[work.doctorName]) byDoctor[work.doctorName] = [];
        const { doctorName: _, isApproved, isRejected, processedAt, ...cleanEntry } = work;
        byDoctor[work.doctorName].push(cleanEntry);
      });
      
      // Save all at once
      for (const [docName, entries] of Object.entries(byDoctor)) {
        const existingExcelRows = excelData[docName] || [];
        const newExcelRows = [...entries, ...existingExcelRows];
        await writeData(`excelData/${docName}`, newExcelRows);
        
        const existingProcured = procuredData[docName] || [];
        const updatedProcured = existingProcured.map((r: any) => {
          if (entries.find((e: any) => e._id === r._id)) {
            return { ...r, isApproved: true, processedAt: new Date().toISOString() };
          }
          return r;
        });
        await writeData(`procuredData/${docName}`, updatedProcured);
      }
      
      toast.success(`Successfully approved ${pendingWorks.length} entries.`);
    } catch (err: any) {
      toast.error("Failed to approve all entries: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (doctorName: string, entry: any) => {
    if (isProcessing) return;
    if (!confirm("Are you sure you want to reject this entry?")) return;
    setIsProcessing(true);
    
    try {
      const safeDoctorName = doctorName;
      const existingProcuredRows = procuredData[safeDoctorName] || [];
      const newProcuredRows = existingProcuredRows.map((r: any) => 
        r._id === entry._id ? { ...r, isRejected: true, processedAt: new Date().toISOString() } : r
      );

      await writeData(`procuredData/${safeDoctorName}`, newProcuredRows);
      
      toast.success("Work entry rejected and moved to history.");
    } catch (err: any) {
      toast.error("Failed to reject entry: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveEdit = async (doctorName: string, originalWork: any) => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    try {
      const existingProcuredRows = procuredData[doctorName] || [];
      const newProcuredRows = existingProcuredRows.map((r: any) => 
        r._id === originalWork._id ? { ...r, ...editForm } : r
      );

      await writeData(`procuredData/${doctorName}`, newProcuredRows);
      
      toast.success("Work entry updated successfully.");
      setEditingWorkId(null);
    } catch (err: any) {
      toast.error("Failed to update entry: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background relative w-full min-w-0 overflow-hidden">
      <div className="p-6 border-b border-panel-border bg-black/40 flex flex-col md:flex-row justify-between items-start md:items-center shrink-0 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Clock className="text-accent" />
            Procured Works Staging
          </h1>
          <p className="text-foreground/70 mt-1">Review and approve job works entered by the collection team.</p>
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex bg-black/40 p-1 rounded-lg border border-panel-border w-full md:w-auto">
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                activeTab === 'pending' 
                  ? 'bg-accent/20 text-accent shadow-[0_0_10px_rgba(0,194,255,0.15)] border border-accent/20' 
                  : 'text-foreground/60 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <ListTodo size={16} />
              Pending ({pendingWorks.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                activeTab === 'history' 
                  ? 'bg-white/10 text-white border border-white/20 shadow-lg' 
                  : 'text-foreground/60 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <History size={16} />
              History
            </button>
          </div>
          
          {activeTab === 'pending' && pendingWorks.length > 0 && role === 'admin' && (
            <button 
              onClick={handleApproveAll}
              disabled={isProcessing}
              className="hidden md:flex px-4 py-2 items-center gap-2 text-sm font-bold text-panel bg-accent rounded-lg hover:bg-accent-glow shadow-[0_0_10px_rgba(0,194,255,0.3)] transition-all disabled:opacity-50 shrink-0"
            >
              <CheckCircle size={18} />
              Approve All
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 w-full relative p-6 min-h-0 overflow-y-auto custom-scrollbar">
        {displayWorks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-foreground/50 bg-black/20 rounded-xl border border-dashed border-panel-border">
            {activeTab === 'pending' ? (
              <>
                <CheckCircle size={48} className="mb-4 text-green-500/30" />
                <p className="text-lg text-white/70">No pending works to review.</p>
                <p className="text-sm mt-1">All caught up!</p>
              </>
            ) : (
              <>
                <History size={48} className="mb-4 opacity-50" />
                <p className="text-lg text-white/70">No history found.</p>
                <p className="text-sm mt-1">Approved or rejected works will appear here.</p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {displayWorks.map((work) => {
              const isEditing = editingWorkId === work._id;
              
              return (
              <div key={work._id} className={`bg-panel border rounded-xl p-5 shadow-lg flex flex-col justify-between group transition-colors ${
                work.isApproved ? 'border-green-500/20' : 
                work.isRejected ? 'border-red-500/20' : 
                'border-panel-border hover:border-accent/30'
              }`}>
                {isEditing ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-lg font-bold text-white">Edit Entry</h3>
                      <button onClick={() => setEditingWorkId(null)} className="text-foreground/50 hover:text-white">
                        <X size={20} />
                      </button>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-semibold text-white/50 mb-1">Patient Name</label>
                      <input type="text" value={editForm['Patient Name'] || ''} onChange={(e) => setEditForm({...editForm, 'Patient Name': e.target.value})} className="w-full bg-black/40 border border-panel-border rounded-lg px-3 py-2 text-white text-sm" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-white/50 mb-1">Material</label>
                        <input type="text" value={editForm['Work material'] || ''} onChange={(e) => setEditForm({...editForm, 'Work material': e.target.value})} className="w-full bg-black/40 border border-panel-border rounded-lg px-3 py-2 text-white text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-white/50 mb-1">Units</label>
                        <input type="number" value={editForm['Units'] || ''} onChange={(e) => setEditForm({...editForm, 'Units': Number(e.target.value)})} className="w-full bg-black/40 border border-panel-border rounded-lg px-3 py-2 text-white text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-white/50 mb-1">Tooth No</label>
                        <input type="text" value={editForm['Tooth No'] || ''} onChange={(e) => setEditForm({...editForm, 'Tooth No': e.target.value})} className="w-full bg-black/40 border border-panel-border rounded-lg px-3 py-2 text-white text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-white/50 mb-1">Shade</label>
                        <input type="text" value={editForm['Shade'] || ''} onChange={(e) => setEditForm({...editForm, 'Shade': e.target.value})} className="w-full bg-black/40 border border-panel-border rounded-lg px-3 py-2 text-white text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-white/50 mb-1">Received Date</label>
                        <input type="date" value={formatDateForInput(editForm['Received Date'])} onChange={(e) => setEditForm({...editForm, 'Received Date': e.target.value})} className="w-full bg-black/40 border border-panel-border rounded-lg px-3 py-2 text-white text-sm" style={{ colorScheme: 'dark' }} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-white/50 mb-1">Due Date</label>
                        <input type="date" value={formatDateForInput(editForm['Delivered Date'])} onChange={(e) => setEditForm({...editForm, 'Delivered Date': e.target.value || 'Not Delivered'})} className="w-full bg-black/40 border border-panel-border rounded-lg px-3 py-2 text-white text-sm" style={{ colorScheme: 'dark' }} />
                      </div>
                    </div>
                    
                    <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-panel-border">
                      <button 
                        onClick={() => setEditingWorkId(null)}
                        className="px-4 py-2 text-sm text-foreground/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => handleSaveEdit(work.doctorName, work)}
                        disabled={isProcessing}
                        className="px-4 py-2 flex items-center gap-2 text-sm font-bold text-panel bg-accent rounded-lg hover:bg-accent-glow transition-all disabled:opacity-50"
                      >
                        <Save size={16} /> Save Changes
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                <div className="mb-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-white">{work['Patient Name']}</h3>
                      <div className="text-sm text-accent font-medium mt-0.5">Doctor: {work.doctorName}</div>
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${
                      work.isApproved ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                      work.isRejected ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                      'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                    }`}>
                      {work.isApproved ? 'Approved' : work.isRejected ? 'Rejected' : 'Pending Review'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mt-4 bg-black/20 p-3 rounded-lg border border-white/5">
                    <div>
                      <div className="text-xs text-foreground/50 mb-1">Material</div>
                      <div className="text-sm text-white font-medium">{work['Work material']} <span className="text-foreground/50">({work['Units']} units)</span></div>
                    </div>
                    <div className="flex flex-col">
                      <div className="text-xs text-foreground/50 mb-1">Tooth No</div>
                      <div className="text-sm text-white font-medium">
                        {work['Tooth No'] ? <PalmerCross teethStr={String(work['Tooth No'])} /> : <span className="text-foreground/50">N/A</span>}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-foreground/50 mb-1">Received Date</div>
                      <div className="text-sm text-white">{formatDateForDisplay(work['Received Date'])}</div>
                    </div>
                    <div>
                      <div className="text-xs text-foreground/50 mb-1">Due Date</div>
                      <div className="text-sm text-white">{work['Delivered Date'] === 'Not Delivered' ? <span className="italic text-foreground/50">Not Delivered</span> : formatDateForDisplay(work['Delivered Date'])}</div>
                    </div>
                    {activeTab === 'history' && work.processedAt && (
                      <div className="col-span-2 mt-2 pt-2 border-t border-white/5">
                        <div className="text-xs text-foreground/50 mb-1">Processed At</div>
                        <div className="text-sm text-white/80">{new Date(work.processedAt).toLocaleString()}</div>
                      </div>
                    )}
                  </div>
                </div>
                
                {activeTab === 'pending' && (
                  <div className="flex justify-end gap-3 pt-4 border-t border-panel-border">
                    <button 
                      onClick={() => {
                        setEditingWorkId(work._id);
                        setEditForm({
                          'Patient Name': work['Patient Name'] || '',
                          'Work material': work['Work material'] || '',
                          'Units': work['Units'] || '',
                          'Tooth No': work['Tooth No'] || '',
                          'Shade': work['Shade'] || '',
                          'Received Date': work['Received Date'] || '',
                          'Delivered Date': work['Delivered Date'] || '',
                        });
                      }}
                      disabled={isProcessing}
                      className="px-4 py-2 flex items-center gap-2 text-sm font-medium text-white/70 bg-white/5 rounded-lg hover:bg-white/10 border border-white/10 transition-colors disabled:opacity-50 mr-auto"
                    >
                      <Edit size={16} />
                      Edit
                    </button>
                    {role === 'admin' && (
                      <>
                        <button 
                          onClick={() => handleReject(work.doctorName, work)}
                          disabled={isProcessing}
                          className="px-4 py-2 flex items-center gap-2 text-sm font-medium text-red-400 bg-red-500/10 rounded-lg hover:bg-red-500/20 border border-red-500/20 transition-colors disabled:opacity-50"
                        >
                          <XCircle size={16} />
                          Reject
                        </button>
                        <button 
                          onClick={() => handleApprove(work.doctorName, work)}
                          disabled={isProcessing}
                          className="px-4 py-2 flex items-center gap-2 text-sm font-bold text-white bg-white/10 rounded-lg hover:bg-white/20 border border-white/10 transition-all disabled:opacity-50"
                        >
                          <Check size={16} />
                          Approve
                        </button>
                      </>
                    )}
                  </div>
                )}
                </>
                )}
              </div>
            )})}
          </div>
        )}
      </div>
    </div>
  );
}
