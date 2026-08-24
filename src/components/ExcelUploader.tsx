"use client";

import { useState, useEffect } from 'react';
import { RefreshCw, FileText, AlertCircle, Upload, CheckCircle2, CloudUpload, CloudDownload } from 'lucide-react';
import { generateInvoicePDF } from '@/lib/pdf';
import { syncExcelData } from '@/app/actions/excel';
import { fetchData, writeData } from '@/lib/firebase';

export interface ExcelUploaderProps {
  onDataProcessed?: (data: Record<string, any[]>) => void;
}

export function ExcelUploader({ onDataProcessed }: ExcelUploaderProps) {
  const [allSheetsData, setAllSheetsData] = useState<Record<string, any[]> | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [currentSheet, setCurrentSheet] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [doctorsData, setDoctorsData] = useState<Record<string, any>>({});
  const [settings, setSettings] = useState<any>({});

  useEffect(() => {
    // Load doctor pricing and lab settings from Firebase
    async function loadData() {
      const docs = await fetchData('doctors');
      if (docs) setDoctorsData(docs);
      
      const sets = await fetchData('settings');
      if (sets) setSettings(sets);

      const cloudData = await fetchData('excelData');
      if (cloudData) {
        setAllSheetsData(cloudData);
        const sheets = Object.keys(cloudData);
        setSheetNames(sheets);
        if (sheets.length > 0) setCurrentSheet(sheets[0]);
      }
    }
    loadData();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSync = async () => {
    if (!file) {
      setError("Please select an Excel file first.");
      return;
    }
    setIsSyncing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const result = await syncExcelData(formData);
      if (result.success) {
        setAllSheetsData(result.data);
        setSheetNames(result.sheetNames || []);
        
        // Auto-create missing doctors in Firebase
        if (result.sheetNames) {
          const updatedDocs = { ...doctorsData };
          let changed = false;
          for (const docName of result.sheetNames) {
            if (!updatedDocs[docName]) {
               updatedDocs[docName] = { balance: 0, prices: {} };
               changed = true;
               await writeData(`doctors/${docName}`, updatedDocs[docName]);
            }
          }
          if (changed) setDoctorsData(updatedDocs);
        }

        if (result.sheetNames && result.sheetNames.length > 0 && !currentSheet) {
          setCurrentSheet(result.sheetNames[0]);
        }
      } else {
        setError(result.error || "Failed to sync");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUploadToCloud = async () => {
    if (!allSheetsData) return;
    setIsSyncing(true);
    try {
      await writeData('excelData', allSheetsData);
      alert("Excel data successfully saved to the cloud! It will now load automatically on any PC.");
    } catch (err) {
      alert("Failed to save to cloud.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLoadFromCloud = async () => {
    setIsSyncing(true);
    try {
      const cloudData = await fetchData('excelData');
      if (cloudData) {
        setAllSheetsData(cloudData);
        const sheets = Object.keys(cloudData);
        setSheetNames(sheets);
        if (sheets.length > 0) setCurrentSheet(sheets[0]);
        alert("Data successfully loaded from the cloud!");
      } else {
        alert("No data found in the cloud.");
      }
    } catch (err) {
      alert("Failed to load from cloud.");
    } finally {
      setIsSyncing(false);
    }
  };

  const [allEnhancedData, setAllEnhancedData] = useState<Record<string, any[]>>({});

  useEffect(() => {
    if (!allSheetsData) return;
    const enhanced: Record<string, any[]> = {};
    for (const sheet of Object.keys(allSheetsData)) {
      enhanced[sheet] = allSheetsData[sheet].map(row => {
        const units = Number(row['Units']) || 0;
        const material = String(row['Work material'] || '').trim();
        const docPrices = doctorsData[sheet]?.prices || {};
        const rate = Number(docPrices[material]) || 0;
        const totalAmount = units * rate;
        return { ...row, Rate: rate, Total: totalAmount };
      });
    }
    setAllEnhancedData(enhanced);
    if (onDataProcessed) {
      onDataProcessed(enhanced);
    }
  }, [allSheetsData, doctorsData]);

  const currentData = allSheetsData && currentSheet ? allSheetsData[currentSheet] : null;
  const enhancedData = currentSheet ? allEnhancedData[currentSheet] : null;

  const handleGeneratePDF = async () => {
    if (enhancedData && currentSheet) {
      const docProfile = doctorsData[currentSheet] || {};
      generateInvoicePDF(enhancedData, currentSheet, docProfile, settings);
      
      // Auto-update ledger
      let totalInclusive = 0;
      enhancedData.forEach((row: any) => {
        totalInclusive += Number(row.Total) || 0;
      });

      if (totalInclusive > 0) {
        // Fetch current ledger
        const currentLedger = await fetchData(`ledger/${currentSheet}`) || [];
        const newTransaction = {
          id: Date.now(),
          date: new Date().toISOString().split('T')[0],
          type: 'Invoice Generated',
          amount: totalInclusive,
          description: `Auto-generated Invoice`
        };
        const updatedTransactions = [...currentLedger, newTransaction];
        await writeData(`ledger/${currentSheet}`, updatedTransactions);

        // Update balance
        const currentBalance = Number(docProfile.balance) || 0;
        const newBalance = currentBalance + totalInclusive;
        
        const updatedDocProfile = { ...docProfile, balance: newBalance };
        setDoctorsData({ ...doctorsData, [currentSheet]: updatedDocProfile });
        await writeData(`doctors/${currentSheet}/balance`, newBalance);
        
        alert(`Invoice generated and ₹${totalInclusive.toFixed(2)} added to ${currentSheet}'s ledger!`);
      }
    }
  };

  return (
    <div className="bg-panel rounded-xl border border-panel-border p-6 mt-6 shadow-lg relative">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="text-accent" /> Excel Sync
          </h2>
          <p className="text-sm text-foreground/60 mt-1">Upload your Lab Work Excel file to generate bills.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <label className="flex-1 md:flex-none flex items-center gap-2 px-4 py-2.5 bg-black/40 border border-panel-border text-foreground/80 font-medium rounded-lg hover:border-accent hover:text-white transition-all cursor-pointer">
            <Upload size={18} />
            <span className="truncate max-w-[150px]">{file ? file.name : "Choose File"}</span>
            <input type="file" accept=".xlsx, .xlsm" className="hidden" onChange={handleFileChange} />
          </label>
          <button 
            onClick={handleSync}
            disabled={isSyncing || !file}
            className="px-5 py-2.5 bg-panel-border border border-white/10 text-white font-medium rounded-lg hover:bg-white/10 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={18} className={isSyncing ? "animate-spin text-accent" : "text-accent"} />
            {isSyncing ? "Syncing..." : "Process Data"}
          </button>
          <button 
            onClick={handleUploadToCloud}
            disabled={!allSheetsData || isSyncing}
            className="px-5 py-2.5 bg-accent/20 text-accent font-medium rounded-lg hover:bg-accent/30 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Save this processed data to Firebase so it loads everywhere"
          >
            <CloudUpload size={18} />
            Save to Cloud
          </button>
          <button 
            onClick={handleLoadFromCloud}
            disabled={isSyncing}
            className="px-5 py-2.5 bg-blue-500/20 text-blue-400 font-medium rounded-lg hover:bg-blue-500/30 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Load data from Firebase cloud"
          >
            <CloudDownload size={18} />
            Load from Cloud
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-3">
          <AlertCircle size={20} className="shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {sheetNames.length > 0 && (
        <div className="mb-4 animate-in fade-in duration-300 relative z-20">
          <label className="text-sm font-semibold text-foreground/70 uppercase block mb-2">Search Doctor Sheet:</label>
          <div className="relative max-w-md">
            <svg 
              className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50 pointer-events-none" 
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              type="text" 
              placeholder={currentSheet || "Type doctor name..."}
              onChange={e => {
                const q = e.target.value.toLowerCase();
                if (!q) return;
                // Basic fuzzy search: find first sheet that includes the text
                const match = sheetNames.find(n => n.toLowerCase().includes(q));
                if (match) {
                  setCurrentSheet(match);
                }
              }}
              className="w-full bg-black/40 border border-panel-border rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-accent font-medium shadow-sm"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
               <span className="text-xs font-semibold px-2 py-1 bg-accent/20 text-accent rounded-md">
                 {currentSheet}
               </span>
            </div>
          </div>
        </div>
      )}

      {enhancedData && enhancedData.length > 0 ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-4 mt-2">
            <h3 className="font-semibold text-white flex items-center gap-2">
               Data Synced ({enhancedData.length} rows)
            </h3>
            <button 
              onClick={handleGeneratePDF}
              className="px-4 py-2 bg-accent text-panel font-bold rounded-lg hover:bg-accent-glow transition-all shadow-[0_0_15px_rgba(0,194,255,0.4)]"
            >
              Generate PDF
            </button>
          </div>
          <div className="overflow-x-auto max-h-[400px] border border-panel-border rounded-lg bg-black/20 custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-foreground/60 uppercase bg-[#08101a] shadow-sm sticky top-0 z-10">
                <tr>
                  {Object.keys(enhancedData[0]).map(k => (
                    <th key={k} className="px-4 py-3 whitespace-nowrap">{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {enhancedData.map((row: any, i: number) => (
                  <tr key={i} className="border-b border-panel-border/50 hover:bg-white/5 transition-colors">
                    {Object.values(row).map((v: any, j: number) => (
                      <td key={j} className="px-4 py-3 whitespace-nowrap">{String(v)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        !error && !isSyncing && (
          <div className="text-center py-10 text-foreground/50">
            {sheetNames.length > 0 ? "No data found in the Excel file for this sheet." : "Upload an Excel file to begin."}
          </div>
        )
      )}
    </div>
  );
}
