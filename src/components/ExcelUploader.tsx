"use client";

import { useState, useEffect } from 'react';
import { RefreshCw, FileText, AlertCircle, Upload, CheckCircle2, CloudUpload, CloudDownload, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { generateInvoicePDF } from '@/lib/pdf';
import { syncExcelData } from '@/app/actions/excel';
import { fetchData, writeData, atomicIncrement, appendToList } from '@/lib/firebase';
import { getVal, generateId, parseDateString, formatDateForDisplay } from '@/lib/utils';
import { useStore } from '@/store/useStore';
import { PalmerCross } from './PalmerCross';

export interface ExcelUploaderProps {
  onDataProcessed?: (data: Record<string, any[]>) => void;
}

export function ExcelUploader({ onDataProcessed }: ExcelUploaderProps) {
  const [allSheetsData, setAllSheetsData] = useState<Record<string, any[]> | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const { doctors: doctorsData, settings, refreshDoctors, refreshSettings, refreshLedger, activeDoctorId, setActiveDoctorId } = useStore();
  const currentSheet = activeDoctorId || 'All Doctors';
  const [selectedMonth, setSelectedMonth] = useState<string>('All');
  const [searchMaterial, setSearchMaterial] = useState<string>('');
  
  useEffect(() => {
    async function loadCloudData() {
      const cloudData = await fetchData('excelData');
      if (cloudData) {
        setAllSheetsData(cloudData);
        const sheets = Object.keys(cloudData);
        setSheetNames(sheets);
        if (sheets.length > 0 && useStore.getState().activeDoctorId === null) useStore.getState().setActiveDoctorId(sheets[0]);
      }
    }
    loadCloudData();
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
        // ── Clean overwrite: no merging, no duplicates ──────────────────────
        // Assign a fresh _id to every row and sort by Received Date descending.
        const freshData: Record<string, any[]> = {};
        const sheetNames = Object.keys(result.data).sort();

        for (const sheetName of sheetNames) {
          const rows = (result.data[sheetName] || []).map((row: any) => ({
            ...row,
            _id: Math.random().toString(36).substring(2, 11),
          }));

          rows.sort((a: any, b: any) => {
            const dateA = parseDateString(getVal(a, ['received date']) || '').getTime();
            const dateB = parseDateString(getVal(b, ['received date']) || '').getTime();
            return dateB - dateA;
          });

          freshData[sheetName] = rows;
        }

        // Auto-create missing doctors in Firebase
        for (const docName of sheetNames) {
          if (!doctorsData[docName]) {
            await writeData(`doctors/${docName}`, { balance: 0, prices: {} });
          }
        }
        await refreshDoctors();

        if (sheetNames.length > 0 && useStore.getState().activeDoctorId === null) {
          setActiveDoctorId(sheetNames[0]);
        }

        // Wipe old data and write fresh
        try {
          const res = await writeData('excelData', freshData);
          if (res.success) {
            setAllSheetsData(freshData);
            setSheetNames(sheetNames);
            toast.success(`Excel imported cleanly! ${sheetNames.length} doctor sheet(s) saved to database.`);
          } else {
            toast.error("Failed to write to database. File may be too large or contain invalid characters.");
          }
        } catch (err: any) {
          toast.error("Failed to save to cloud: " + (err.message || "Unknown error"));
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

  const handleLoadFromCloud = async () => {
    setIsSyncing(true);
    try {
      const cloudData = await fetchData('excelData');
      if (cloudData) {
        setAllSheetsData(cloudData);
        const sheets = Object.keys(cloudData);
        setSheetNames(sheets);
        if (sheets.length > 0 && useStore.getState().activeDoctorId === null) setActiveDoctorId(sheets[0]);
        toast.success("Data successfully loaded from the cloud!");
      } else {
        toast.info("No data found in the cloud.");
      }
    } catch (error) {
      toast.error("Failed to load from cloud.");
    } finally {
      setIsSyncing(false);
    }
  };

  // ─── Duplicate preview modal state ────────────────────────────────────────
  interface DupGroup {
    type: 'exact' | 'near';
    sheetName: string;
    rows: any[];          // first = suggested keeper
    daysDiff?: number;    // for near groups
  }
  const [dupGroups, setDupGroups] = useState<DupGroup[]>([]);
  const [dupModalOpen, setDupModalOpen] = useState(false);
  // rowKey: `${sheetName}__${rowIndex}` → checked means "mark for removal"
  const [markedForRemoval, setMarkedForRemoval] = useState<Set<string>>(new Set());

  // ─── Phase 1: scan & preview ───────────────────────────────────────────────
  const handleFindDuplicates = async () => {
    setIsSyncing(true);
    try {
      const cloudData: Record<string, any[]> = await fetchData('excelData') || {};

      const getCanonicalKey = (r: any) => {
        const name  = String(r['Patient Name']  || '').toLowerCase().trim();
        const parsedDate = parseDateString(r['Received Date']);
        const date  = parsedDate.getTime() !== 0
          ? parsedDate.toISOString().split('T')[0]
          : String(r['Received Date'] || '').trim().toLowerCase();
        const mat   = String(r['Work material'] || '').toLowerCase().trim();
        const tooth = String(r['Tooth No']      || '').toLowerCase().replace(/\s+/g, '');
        const units = String(r['Units']         || '').toLowerCase().trim();
        return `${name}_${date}_${mat}_${tooth}_${units}`;
      };

      // Near-match key (ignores date & units — used for fuzzy grouping)
      const getNearKey = (r: any) => {
        const name  = String(r['Patient Name']  || '').toLowerCase().trim();
        const mat   = String(r['Work material'] || '').toLowerCase().trim();
        const tooth = String(r['Tooth No']      || '').toLowerCase().replace(/\s+/g, '');
        return `${name}__${mat}__${tooth}`;
      };

      const NEAR_DAYS = 14; // rows within this many days are flagged as "near-duplicate"

      const found: DupGroup[] = [];
      const defaultMarked = new Set<string>();

      for (const sheetName of Object.keys(cloudData)) {
        const rows: any[] = Array.isArray(cloudData[sheetName]) ? cloudData[sheetName] : [];

        // --- Exact duplicates ---
        const exactSeen = new Map<string, { rowIdx: number }>();
        const exactGroups = new Map<string, number[]>(); // key → [indices]
        rows.forEach((r, i) => {
          const k = getCanonicalKey(r);
          if (!exactSeen.has(k)) {
            exactSeen.set(k, { rowIdx: i });
            exactGroups.set(k, [i]);
          } else {
            exactGroups.get(k)!.push(i);
          }
        });
        exactGroups.forEach((indices, _k) => {
          if (indices.length < 2) return;
          const groupRows = indices.map(i => ({ ...rows[i], __origIdx: i }));
          found.push({ type: 'exact', sheetName, rows: groupRows });
          // All but the first are pre-checked for removal
          indices.slice(1).forEach(i =>
            defaultMarked.add(`${sheetName}__${i}`)
          );
        });

        // --- Near duplicates (same name+material+tooth, date within NEAR_DAYS) ---
        const nearBuckets = new Map<string, number[]>();
        rows.forEach((r, i) => {
          const nk = getNearKey(r);
          if (!nearBuckets.has(nk)) nearBuckets.set(nk, []);
          nearBuckets.get(nk)!.push(i);
        });
        nearBuckets.forEach((indices) => {
          if (indices.length < 2) return;
          // Compare every pair
          for (let a = 0; a < indices.length; a++) {
            for (let b = a + 1; b < indices.length; b++) {
              const ia = indices[a], ib = indices[b];
              // Skip if already flagged as exact duplicate
              if (defaultMarked.has(`${sheetName}__${ib}`)) continue;
              const dateA = parseDateString(rows[ia]['Received Date']);
              const dateB = parseDateString(rows[ib]['Received Date']);
              const diff  = Math.abs(dateA.getTime() - dateB.getTime()) / 86400000;
              if (diff > 0 && diff <= NEAR_DAYS) {
                // Only add the pair once
                const alreadyAdded = found.some(
                  g => g.type === 'near' && g.sheetName === sheetName &&
                    g.rows.some(r2 => r2.__origIdx === ia) &&
                    g.rows.some(r2 => r2.__origIdx === ib)
                );
                if (!alreadyAdded) {
                  found.push({
                    type: 'near',
                    sheetName,
                    rows: [rows[ia], rows[ib]].map((r, ri) => ({ ...r, __origIdx: [ia,ib][ri] })),
                    daysDiff: Math.round(diff),
                  });
                  // Near-dups are NOT pre-checked — user must decide
                }
              }
            }
          }
        });
      }

      if (found.length === 0) {
        toast.success('No duplicates or near-duplicates found — your database is clean!');
        setIsSyncing(false);
        return;
      }

      setDupGroups(found);
      setMarkedForRemoval(defaultMarked);
      setDupModalOpen(true);
    } catch (err: any) {
      toast.error('Scan error: ' + (err.message || 'Unknown'));
    } finally {
      setIsSyncing(false);
    }
  };

  // ─── Phase 2: commit removal of checked rows ───────────────────────────────
  const handleCommitRemoval = async () => {
    if (markedForRemoval.size === 0) {
      toast.info('Nothing is checked for removal.');
      return;
    }
    if (!confirm(`Remove ${markedForRemoval.size} selected row(s) from Firebase? This cannot be undone.`)) return;

    setIsSyncing(true);
    try {
      const cloudData: Record<string, any[]> = await fetchData('excelData') || {};
      const cleaned: Record<string, any[]> = {};

      for (const sheetName of Object.keys(cloudData)) {
        const rows: any[] = Array.isArray(cloudData[sheetName]) ? cloudData[sheetName] : [];
        cleaned[sheetName] = rows.filter((_r, i) => !markedForRemoval.has(`${sheetName}__${i}`));
      }

      const res = await writeData('excelData', cleaned);
      if (res.success) {
        setAllSheetsData(cleaned);
        setSheetNames(Object.keys(cleaned));
        setDupModalOpen(false);
        setDupGroups([]);
        setMarkedForRemoval(new Set());
        toast.success(`Removed ${markedForRemoval.size} row(s) from the database.`);
      } else {
        toast.error('Failed to write cleaned data back to Firebase.');
      }
    } catch (err: any) {
      toast.error('Removal error: ' + (err.message || 'Unknown'));
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
        const units = Number(getVal(row, ['units'])) || 0;
        const material = String(getVal(row, ['work material']) || '').trim();
        const toothNoRaw = String(getVal(row, ['tooth no', 'tooth no.']) || '').toLowerCase().trim();
        const isFullMouth = toothNoRaw.includes('full mouth') || toothNoRaw === 'fm';
        const docPrices = doctorsData[sheet]?.prices || {};
        const status = String(getVal(row, ['status']) || '').trim().toLowerCase();
        
        let rate = 0;
        if (typeof docPrices[material] === 'number') {
            rate = docPrices[material];
        } else {
            const found = Object.values(docPrices).find((p: any) => p && typeof p === 'object' && p.name === material);
            if (found) rate = Number((found as any).rate) || 0;
        }
        
        const totalAmount = status === 'hold' ? 0 : (isFullMouth ? rate : (units * rate));
        return { ...row, Rate: rate, Total: totalAmount };
      });
    }
    setAllEnhancedData(enhanced);
    if (onDataProcessed) {
      onDataProcessed(enhanced);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSheetsData, doctorsData]);

  const currentData = allSheetsData && currentSheet && currentSheet !== 'All Doctors' ? allSheetsData[currentSheet] : null;
  const enhancedData = currentSheet === 'All Doctors' 
    ? Object.values(allEnhancedData).flat()
    : (currentSheet ? allEnhancedData[currentSheet] : null);

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
        const dateVal = String(getVal(row, ['received date', 'date', 'order date']) || '');
        return getMonthYear(dateVal);
      })
    )
  )).filter(m => m !== 'Unknown');

  // Sort months properly (basic string sort or date sort)
  availableMonths.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  // Filter and sort data based on selected month and material
  const filteredData = enhancedData ? enhancedData.filter(row => {
    if (selectedMonth !== 'All') {
      const dateVal = String(getVal(row, ['received date', 'date', 'order date']) || '');
      if (getMonthYear(dateVal) !== selectedMonth) return false;
    }
    
    if (searchMaterial) {
      const materialVal = String(getVal(row, ['work material', 'material', 'work']) || '').toLowerCase();
      if (!materialVal.includes(searchMaterial.toLowerCase())) return false;
    }
    
    return true;
  }).sort((a, b) => {
    const dateA = parseDateString(getVal(a, ['received date', 'date', 'order date']) || '').getTime();
    const dateB = parseDateString(getVal(b, ['received date', 'date', 'order date']) || '').getTime();
    return dateB - dateA;
  }) : null;

  const { totalFilteredUnits, totalFilteredAmount } = filteredData ? filteredData.reduce((acc, row) => {
    const units = Number(getVal(row, ['units', 'unit'])) || 0;
    const amount = Number(getVal(row, ['total', 'amount'])) || 0;
    return {
      totalFilteredUnits: acc.totalFilteredUnits + units,
      totalFilteredAmount: acc.totalFilteredAmount + amount
    };
  }, { totalFilteredUnits: 0, totalFilteredAmount: 0 }) : { totalFilteredUnits: 0, totalFilteredAmount: 0 };

  const handleGeneratePDF = async () => {
    if (currentSheet === 'All Doctors') {
      toast.error("Cannot generate a single invoice for 'All Doctors'. Please select a specific doctor.");
      return;
    }
    if (selectedMonth === 'All') {
      toast.error("Please select a specific Billing Month first. You cannot generate a bill for 'All Months'.");
      return;
    }
    
    if (filteredData && currentSheet && filteredData.length > 0) {
      const docProfile = doctorsData[currentSheet] || {};
      
      let totalInclusive = 0;
      filteredData.forEach((row: any) => {
        totalInclusive += Number(row.Total) || 0;
      });

      if (totalInclusive > 0) {
        // Fetch current ledger FIRST to prevent duplicate entry or incorrect PDF balance
        const currentLedger = await fetchData(`ledger/${currentSheet}`) || [];
        
        const invoiceDescription = `Auto-generated Invoice - ${selectedMonth}`;
        const existingTxIndex = currentLedger.findIndex((tx: any) => tx.description === invoiceDescription);
        const isDuplicate = existingTxIndex !== -1;
        
        let prevBalance = Number(docProfile.balance) || 0;

        if (isDuplicate) {
          const wantToRedownload = confirm(`An invoice for ${selectedMonth} has already been generated for ${currentSheet}. Do you want to re-download a copy?`);
          if (!wantToRedownload) return;
          
          // Re-calculate the balance BEFORE this invoice was generated
          prevBalance = 0;
          for (let i = 0; i < existingTxIndex; i++) {
             prevBalance += Number(currentLedger[i].amount) || 0;
          }
        }

        // Generate PDF with the corrected balance
        const tempDocProfile = { ...docProfile, balance: prevBalance };
        await generateInvoicePDF(filteredData, currentSheet, tempDocProfile, settings, selectedMonth !== 'All' ? selectedMonth : undefined);

        // Stop here if it was already in the ledger
        if (isDuplicate) return;

        const newTransaction = {
          id: generateId(),
          date: new Date().toISOString().split('T')[0],
          type: 'Invoice Generated',
          amount: totalInclusive,
          description: invoiceDescription
        };
        await appendToList(`ledger/${currentSheet}`, newTransaction);

        // Update balance
        await atomicIncrement(`doctors/${currentSheet}/balance`, totalInclusive);
        await refreshDoctors();
        await refreshLedger();

        // Auto-increment invoice sequence number
        const nextSeq = (Number(settings.invoiceSequence) || 1) + 1;
        await writeData('settings/invoiceSequence', nextSeq);
        await refreshSettings();
        
        toast.success(`Invoice generated and ₹${totalInclusive.toFixed(2)} added to ${currentSheet}'s ledger!`);
      }
    }
  };



  const handleClearAllLedgers = async () => {
    if (!confirm("Are you sure you want to clear the ledger for ALL doctors? This will reset all balances to 0 and erase all transaction history. This cannot be undone.")) return;
    setIsSyncing(true);
    try {
      let count = 0;
      for (const docName of Object.keys(doctorsData)) {
        await writeData(`ledger/${docName}`, null);
        await writeData(`doctors/${docName}/balance`, 0);
        count++;
      }
      await refreshDoctors();
      await refreshLedger();
      toast.success(`Successfully cleared ledgers and reset balances for ${count} doctors.`);
    } catch (err: any) {
      toast.error("Failed to clear ledgers: " + (err.message || "Unknown error"));
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="bg-panel rounded-xl border border-panel-border p-4 md:p-6 mt-6 shadow-lg relative w-full min-w-0 overflow-hidden">
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
            className="px-4 py-2 sm:px-5 sm:py-2.5 text-sm sm:text-base bg-panel-border border border-white/10 text-white font-medium rounded-lg hover:bg-white/10 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={18} className={`w-4 h-4 sm:w-[18px] sm:h-[18px] ${isSyncing ? "animate-spin text-accent" : "text-accent"}`} />
            {isSyncing ? "Syncing..." : "Process Data"}
          </button>
          <button 
            onClick={handleLoadFromCloud}
            disabled={isSyncing}
            className="px-4 py-2 sm:px-5 sm:py-2.5 text-sm sm:text-base bg-blue-500/20 text-blue-400 font-medium rounded-lg hover:bg-blue-500/30 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Load data from Firebase cloud"
          >
            <CloudDownload size={18} className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
            Load from Cloud
          </button>
          <button 
            onClick={handleFindDuplicates}
            disabled={isSyncing}
            className="px-4 py-2 sm:px-5 sm:py-2.5 text-sm sm:text-base bg-yellow-500/20 text-yellow-400 font-medium rounded-lg hover:bg-yellow-500/30 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Scan the database and preview duplicate rows before deleting"
          >
            <CheckCircle2 size={18} className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
            Find Duplicates
          </button>
          <button 
            onClick={handleClearAllLedgers}
            disabled={isSyncing}
            className="px-4 py-2 sm:px-5 sm:py-2.5 text-sm sm:text-base bg-red-500/20 text-red-400 font-medium rounded-lg hover:bg-red-500/30 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Clear all ledgers for testing"
          >
            <Trash2 size={18} className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
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
          <div className="flex-1 flex flex-col gap-4">
            <div>
              <label className="text-sm font-semibold text-foreground/70 uppercase block mb-2">Select Doctor Sheet:</label>
              <div className="relative max-w-md">
                <select 
                  value={currentSheet === 'All Doctors' ? '' : currentSheet}
                  onChange={e => setActiveDoctorId(e.target.value)}
                  className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accent font-medium shadow-sm appearance-none"
                >
                  <option value="">All Doctors (Summary)</option>
                  {sheetNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-foreground/70 uppercase block mb-2">Filter by Work Material:</label>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative max-w-md flex-1">
                  <svg 
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50 pointer-events-none" 
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                  <input 
                    type="text" 
                    value={searchMaterial}
                    onChange={e => setSearchMaterial(e.target.value)}
                    placeholder="e.g. Zirconia, PFM..."
                    className="w-full bg-black/40 border border-panel-border rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-accent font-medium shadow-sm"
                  />
                </div>
                
                <div className="relative w-full sm:w-auto shrink-0">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50 pointer-events-none font-semibold text-xs sm:text-sm uppercase">
                    Total Units:
                  </div>
                  <input 
                    type="text" 
                    readOnly
                    value={totalFilteredUnits}
                    className="w-full sm:w-[160px] bg-black/20 border border-panel-border/50 rounded-lg pl-[90px] sm:pl-[100px] pr-3 py-2.5 text-sm sm:text-base text-accent font-bold shadow-sm cursor-default outline-none focus:border-panel-border/50"
                  />
                </div>
                
                <div className="relative w-full sm:w-auto shrink-0">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50 pointer-events-none font-semibold text-xs sm:text-sm uppercase">
                    Total Amount:
                  </div>
                  <input 
                    type="text" 
                    readOnly
                    value={`₹${totalFilteredAmount.toFixed(2)}`}
                    className="w-full sm:w-[240px] bg-black/20 border border-panel-border/50 rounded-lg pl-[110px] sm:pl-[125px] pr-4 py-2.5 text-sm sm:text-base text-green-400 font-bold shadow-sm cursor-default outline-none focus:border-panel-border/50"
                  />
                </div>
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
              <option value="All">All Months (View Only)</option>
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
               {currentSheet === 'All Doctors' ? "All Doctors Summary" : (currentSheet ? `Doctor: ${currentSheet}` : "Data Synced")} <span className="text-foreground/50 font-normal">({filteredData.length} rows)</span>
            </h3>
            <div className="flex gap-3">

              <button 
                onClick={handleGeneratePDF}
                className="px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base bg-accent text-panel font-bold rounded-lg hover:bg-accent-glow transition-all shadow-[0_0_15px_rgba(0,194,255,0.4)]"
              >
                Generate PDF (Current)
              </button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[400px] border border-panel-border rounded-lg bg-black/20 custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-foreground/60 uppercase bg-[#08101a] shadow-sm sticky top-0 z-10">
                <tr>
                  {(() => {
                    const allKeys = Object.keys(filteredData[0]);
                    const preferredOrder = ['Patient Name', 'Received Date', 'Delivered Date', 'Tooth No', 'Work material', 'Units', 'Status', 'Rate', 'Total'];
                    const finalOrder = [...preferredOrder, ...allKeys.filter(k => !preferredOrder.includes(k))];
                    return finalOrder.map(k => {
                      const isMobileHidden = ['Delivered Date', 'Tooth No', 'Rate', 'Total'].includes(k) || k.toLowerCase() === 'tooth no.';
                      return <th key={k} className={`px-4 py-3 whitespace-nowrap ${isMobileHidden ? 'hidden md:table-cell' : ''}`}>{k}</th>
                    });
                  })()}
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row: any, i: number) => (
                  <tr key={i} className="border-b border-panel-border/50 hover:bg-white/5 transition-colors">
                    {(() => {
                      const allKeys = Object.keys(filteredData[0]);
                      const preferredOrder = ['Patient Name', 'Received Date', 'Delivered Date', 'Tooth No', 'Work material', 'Units', 'Status', 'Rate', 'Total'];
                      const finalOrder = [...preferredOrder, ...allKeys.filter(k => !preferredOrder.includes(k))];
                      return finalOrder.map((k: string, j: number) => {
                        let valStr = String(row[k] ?? '');
                        if (k.toLowerCase().includes('date') && valStr) {
                           valStr = formatDateForDisplay(valStr);
                        }
                        const isMobileHidden = ['Delivered Date', 'Tooth No', 'Rate', 'Total'].includes(k) || k.toLowerCase() === 'tooth no.';
                        
                        if (k.toLowerCase() === 'tooth no' || k.toLowerCase() === 'tooth no.') {
                          return <td key={j} className={`px-4 py-3 whitespace-nowrap ${isMobileHidden ? 'hidden md:table-cell' : ''}`}><PalmerCross teethStr={valStr} /></td>;
                        }
                        
                        return <td key={j} className={`px-4 py-3 whitespace-nowrap ${isMobileHidden ? 'hidden md:table-cell' : ''}`}>{valStr}</td>;
                      });
                    })()}
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

      {/* ── Duplicate Review Modal ─────────────────────────────────────────── */}
      {dupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0d1a26] border border-panel-border rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-panel-border">
              <div>
                <h2 className="text-lg font-bold text-white">Duplicate Review</h2>
                <p className="text-sm text-foreground/60 mt-0.5">
                  Review all matches below. <span className="text-red-400 font-medium">Exact duplicates</span> are pre-checked.&nbsp;
                  <span className="text-yellow-400 font-medium">Near-duplicates</span> (within 14 days) are unchecked — decide manually.
                </p>
              </div>
              <button onClick={() => setDupModalOpen(false)} className="text-foreground/50 hover:text-white transition-colors text-2xl leading-none">&times;</button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-6 custom-scrollbar">
              {dupGroups.map((group, gi) => {
                const isExact = group.type === 'exact';
                return (
                  <div key={gi} className={`rounded-xl border p-4 ${isExact ? 'border-red-500/40 bg-red-500/5' : 'border-yellow-500/40 bg-yellow-500/5'}`}>
                    {/* Group header */}
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${isExact ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                        {isExact ? '🔴 EXACT DUPLICATE' : `🟡 NEAR-DUPLICATE (${group.daysDiff}d apart)`}
                      </span>
                      <span className="text-sm text-foreground/60">Doctor: <span className="text-white font-medium">{group.sheetName}</span></span>
                      <span className="text-sm text-foreground/60">{group.rows.length} rows</span>
                    </div>

                    {/* Row cards */}
                    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(group.rows.length, 3)}, minmax(0,1fr))` }}>
                      {group.rows.map((row, ri) => {
                        const rowKey = `${group.sheetName}__${row.__origIdx}`;
                        const isKeeper = ri === 0 && isExact; // first row is the suggested keeper for exact dups
                        const checked = markedForRemoval.has(rowKey);
                        return (
                          <div key={ri} className={`rounded-lg border p-3 text-sm space-y-1.5 relative transition-all ${
                            isKeeper
                              ? 'border-green-500/50 bg-green-500/10'
                              : checked
                                ? 'border-red-500/50 bg-red-500/10 opacity-80'
                                : 'border-panel-border bg-black/20'
                          }`}>
                            {/* Keep / Remove badge */}
                            {isKeeper && (
                              <span className="absolute top-2 right-2 text-[10px] bg-green-500/20 text-green-400 font-bold px-2 py-0.5 rounded-full">KEEP</span>
                            )}
                            {!isKeeper && (
                              <label className="absolute top-2 right-2 flex items-center gap-1.5 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    setMarkedForRemoval(prev => {
                                      const next = new Set(prev);
                                      if (next.has(rowKey)) next.delete(rowKey); else next.add(rowKey);
                                      return next;
                                    });
                                  }}
                                  className="accent-red-500 w-4 h-4"
                                />
                                <span className={`text-[10px] font-bold ${checked ? 'text-red-400' : 'text-foreground/50'}`}>
                                  {checked ? 'REMOVE' : 'KEEP'}
                                </span>
                              </label>
                            )}

                            {/* Row fields */}
                            {[
                              ['Patient', row['Patient Name']],
                              ['Received', formatDateForDisplay(row['Received Date'])],
                              ['Delivered', formatDateForDisplay(row['Delivered Date'])],
                              ['Material', row['Work material']],
                              ['Tooth', row['Tooth No']],
                              ['Units', row['Units']],
                              ['Status', row['Status']],
                            ].map(([label, val]) => (
                              <div key={label as string} className="flex gap-2">
                                <span className="text-foreground/50 w-16 shrink-0">{label}:</span>
                                <span className="text-white font-medium truncate">{String(val ?? '—')}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-panel-border flex items-center justify-between gap-4">
              <div className="text-sm text-foreground/60">
                <span className="text-red-400 font-bold">{markedForRemoval.size}</span> row{markedForRemoval.size !== 1 ? 's' : ''} marked for removal
                &nbsp;·&nbsp;
                <span className="text-yellow-400 font-bold">{dupGroups.filter(g => g.type === 'near').length}</span> near-duplicate group{dupGroups.filter(g => g.type === 'near').length !== 1 ? 's' : ''} (review manually)
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setDupModalOpen(false); setDupGroups([]); setMarkedForRemoval(new Set()); }}
                  className="px-5 py-2 rounded-lg bg-white/5 border border-panel-border text-foreground/70 hover:text-white transition-all text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCommitRemoval}
                  disabled={markedForRemoval.size === 0 || isSyncing}
                  className="px-5 py-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 transition-all text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Trash2 size={15} />
                  Remove {markedForRemoval.size} Selected
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
