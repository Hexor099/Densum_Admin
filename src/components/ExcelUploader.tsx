"use client";

import { useState, useEffect } from 'react';
import { RefreshCw, FileText, AlertCircle, Upload, CheckCircle2, CloudUpload, CloudDownload, Trash2 } from 'lucide-react';
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
  const [selectedMonth, setSelectedMonth] = useState<string>('');

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
      const res = await writeData('excelData', allSheetsData);
      if (!res.success) throw new Error("Failed to write to database. It might be too large or contain invalid characters.");
      alert("Excel data successfully saved to the cloud! It will now load automatically on any PC.");
    } catch (err: any) {
      alert("Failed to save to cloud: " + (err.message || "Unknown error"));
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
        const getVal = (possibleKeys: string[]) => {
          const foundKey = Object.keys(row).find(k => possibleKeys.some(pk => k.toLowerCase() === pk.toLowerCase()));
          return foundKey ? row[foundKey] : undefined;
        };

        const units = Number(getVal(['units'])) || 0;
        const material = String(getVal(['work material']) || '').trim();
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

  // Helper to extract month-year from date string
  const getMonthYear = (dateString: string) => {
    if (!dateString || typeof dateString !== 'string') return 'Unknown';
    const str = dateString.trim();
    
    // Check if it's formatted by xlsx as dd-mm-yyyy (it will have dashes)
    if (str.includes('-')) {
      const parts = str.split('-');
      if (parts.length === 3) {
        let day = parseInt(parts[0], 10);
        let month = parseInt(parts[1], 10);
        let year = parseInt(parts[2], 10);
        if (year < 100) year += 2000;
        
        if (!isNaN(day) && !isNaN(month) && !isNaN(year) && month >= 1 && month <= 12) {
          if (day > 31) {
             // It's probably YYYY-MM-DD
             const d = new Date(str);
             if (!isNaN(d.getTime())) return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
          } else {
            const d = new Date(year, month - 1, day);
            return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
          }
        }
      }
    }

    // Fallback to standard JS Date parsing for slashes (like 8/10/26) or standard strings
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    }
    
    return 'Unknown';
  };

  // Get available months across all data
  const availableMonths = Array.from(new Set(
    Object.values(allEnhancedData || {}).flatMap(sheetData => 
      (sheetData || []).map(row => {
        const getVal = (possibleKeys: string[]) => {
          const foundKey = Object.keys(row).find(k => possibleKeys.some(pk => k.trim().toLowerCase() === pk.toLowerCase()));
          return foundKey ? row[foundKey] : undefined;
        };
        const dateVal = String(getVal(['received date', 'date', 'order date']) || '');
        return getMonthYear(dateVal);
      })
    )
  )).filter(m => m !== 'Unknown');

  // Sort months properly (basic string sort or date sort)
  availableMonths.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  // Auto-select first month if current selection is invalid
  useEffect(() => {
    if (availableMonths.length > 0 && !availableMonths.includes(selectedMonth)) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths.join(','), selectedMonth]);

  // Filter data based on selected month
  const filteredData = enhancedData ? enhancedData.filter(row => {
    if (!selectedMonth) return false;
    const getVal = (possibleKeys: string[]) => {
      const foundKey = Object.keys(row).find(k => possibleKeys.some(pk => k.trim().toLowerCase() === pk.toLowerCase()));
      return foundKey ? row[foundKey] : undefined;
    };
    const dateVal = String(getVal(['received date', 'date', 'order date']) || '');
    return getMonthYear(dateVal) === selectedMonth;
  }) : null;

  const handleGeneratePDF = async () => {
    if (filteredData && currentSheet && filteredData.length > 0) {
      const docProfile = doctorsData[currentSheet] || {};
      generateInvoicePDF(filteredData, currentSheet, docProfile, settings);
      
      // Auto-update ledger
      let totalInclusive = 0;
      filteredData.forEach((row: any) => {
        totalInclusive += Number(row.Total) || 0;
      });

      if (totalInclusive > 0) {
        // Fetch current ledger
        const currentLedger = await fetchData(`ledger/${currentSheet}`) || [];
        
        // Prevent duplicate bill
        const invoiceDescription = `Auto-generated Invoice - ${selectedMonth}`;
        if (currentLedger.some((tx: any) => tx.description === invoiceDescription)) {
          alert(`An invoice for ${selectedMonth} has already been generated for ${currentSheet}.`);
          return;
        }

        const newTransaction = {
          id: Date.now(),
          date: new Date().toISOString().split('T')[0],
          type: 'Invoice Generated',
          amount: totalInclusive,
          description: invoiceDescription
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

  const handleGenerateAll = async () => {
    if (!allEnhancedData || Object.keys(allEnhancedData).length === 0) return;
    
    if (!confirm("This will generate invoices and update the ledger for ALL doctors. Continue?")) return;

    let processedCount = 0;
    let skippedCount = 0;
    const newDocsData = { ...doctorsData };

    for (const sheet of Object.keys(allEnhancedData)) {
      let sheetData = allEnhancedData[sheet];
      if (!sheetData || sheetData.length === 0) continue;
      
      // Apply month filter
      if (selectedMonth) {
        sheetData = sheetData.filter(row => {
          const getVal = (possibleKeys: string[]) => {
            const foundKey = Object.keys(row).find(k => possibleKeys.some(pk => k.trim().toLowerCase() === pk.toLowerCase()));
            return foundKey ? row[foundKey] : undefined;
          };
          const dateVal = String(getVal(['received date', 'date', 'order date']) || '');
          return getMonthYear(dateVal) === selectedMonth;
        });
      }

      if (sheetData.length === 0) continue;
      
      let totalInclusive = 0;
      sheetData.forEach((row: any) => {
        totalInclusive += Number(row.Total) || 0;
      });

      if (totalInclusive > 0) {
        const docProfile = newDocsData[sheet] || {};
        
        // Generate PDF
        generateInvoicePDF(sheetData, sheet, docProfile, settings);
        
        // Update Ledger
        const currentLedger = await fetchData(`ledger/${sheet}`) || [];
        
        // Prevent duplicate bill
        const invoiceDescription = `Auto-generated Invoice - ${selectedMonth}`;
        if (currentLedger.some((tx: any) => tx.description === invoiceDescription)) {
          skippedCount++;
          continue;
        }

        const newTransaction = {
          id: Date.now() + processedCount, // ensure unique
          date: new Date().toISOString().split('T')[0],
          type: 'Invoice Generated',
          amount: totalInclusive,
          description: invoiceDescription
        };
        
        const updatedTransactions = [...currentLedger, newTransaction];
        await writeData(`ledger/${sheet}`, updatedTransactions);

        // Update Balance
        const currentBalance = Number(docProfile.balance) || 0;
        const newBalance = currentBalance + totalInclusive;
        newDocsData[sheet] = { ...docProfile, balance: newBalance };
        await writeData(`doctors/${sheet}/balance`, newBalance);
        
        processedCount++;
        
        // Slight delay to prevent browser download blocking
        await new Promise(res => setTimeout(res, 800));
      }
    }

    setDoctorsData(newDocsData);
    if (processedCount > 0 || skippedCount > 0) {
      alert(`Successfully generated PDFs and updated ledgers for ${processedCount} doctors!${skippedCount > 0 ? ` Skipped ${skippedCount} doctors who already had bills generated for ${selectedMonth}.` : ''}`);
    } else {
      alert("No valid billable data found to generate.");
    }
  };

  const handleClearAllLedgers = async () => {
    if (!confirm("Are you sure you want to completely clear the ledgers and reset balances to zero for ALL doctors? This cannot be undone!")) return;
    setIsSyncing(true);
    try {
      const updatedDocs = { ...doctorsData };
      let count = 0;
      for (const docName of Object.keys(updatedDocs)) {
        await writeData(`ledger/${docName}`, null);
        updatedDocs[docName].balance = 0;
        await writeData(`doctors/${docName}/balance`, 0);
        count++;
      }
      setDoctorsData(updatedDocs);
      alert(`Successfully cleared ledgers and reset balances for ${count} doctors.`);
    } catch (err: any) {
      alert("Failed to clear ledgers: " + (err.message || "Unknown error"));
    } finally {
      setIsSyncing(false);
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
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
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
          <button 
            onClick={handleClearAllLedgers}
            disabled={isSyncing}
            className="px-5 py-2.5 bg-red-500/20 text-red-400 font-medium rounded-lg hover:bg-red-500/30 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Clear all ledgers for testing"
          >
            <Trash2 size={18} />
            Clear Ledgers
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
        <div className="mb-4 flex flex-col md:flex-row gap-4 animate-in fade-in duration-300 relative z-20">
          <div className="flex-1">
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
          
          <div className="w-full md:w-64">
            <label className="text-sm font-semibold text-foreground/70 uppercase block mb-2">Select Billing Month:</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accent font-medium shadow-sm appearance-none"
            >
              {availableMonths.length === 0 && <option value="">No months available</option>}
              {availableMonths.map(month => (
                <option key={month} value={month}>{month}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {filteredData && filteredData.length > 0 ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-4 mt-2">
            <h3 className="font-semibold text-white flex items-center gap-2">
               Data Synced ({filteredData.length} rows)
            </h3>
            <div className="flex gap-3">
              <button 
                onClick={handleGenerateAll}
                className="px-4 py-2 bg-purple-500/20 text-purple-400 font-bold rounded-lg hover:bg-purple-500/30 transition-all shadow-sm border border-purple-500/30"
              >
                Generate All Invoices
              </button>
              <button 
                onClick={handleGeneratePDF}
                className="px-4 py-2 bg-accent text-panel font-bold rounded-lg hover:bg-accent-glow transition-all shadow-[0_0_15px_rgba(0,194,255,0.4)]"
              >
                Generate PDF (Current)
              </button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[400px] border border-panel-border rounded-lg bg-black/20 custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-foreground/60 uppercase bg-[#08101a] shadow-sm sticky top-0 z-10">
                <tr>
                  {Object.keys(filteredData[0]).map(k => (
                    <th key={k} className="px-4 py-3 whitespace-nowrap">{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row: any, i: number) => (
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
