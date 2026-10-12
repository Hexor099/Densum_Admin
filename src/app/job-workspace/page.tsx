"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { 
  Copy, 
  Check, 
  Download, 
  Search, 
  Filter, 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  X, 
  Pause, 
  Table, 
  ClipboardCheck, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Sparkles,
  FileSpreadsheet
} from "lucide-react";
import { toast } from "sonner";
import { writeData } from "@/lib/firebase";
import { useStore } from "@/store/useStore";
import { formatDateForDisplay, parseDateString } from "@/lib/utils";
import { PalmerCross } from "@/components/PalmerCross";
import { useAuth } from "@/components/AuthProvider";

// Excel column order: Received Date | Delivered Date | Patient Name | Tooth No. | Work material | Units

export default function JobWorkspacePage() {
  const { role } = useAuth();
  const jobWorkspaceData = useStore(state => state.jobWorkspaceData);
  const procuredData = useStore(state => state.procuredData);
  const activeDoctorId = useStore(state => state.activeDoctorId);
  const setActiveDoctorId = useStore(state => state.setActiveDoctorId);

  const [selectedDoctor, setSelectedDoctor] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null);
  const [includeHeaders, setIncludeHeaders] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Sorting
  const [sortField, setSortField] = useState<string>("Received Date");
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Inline editing
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});

  // Auto-sync previously approved entries from procuredData if jobWorkspaceData is empty
  useEffect(() => {
    async function checkAndSyncApprovedEntries() {
      if (!procuredData || Object.keys(procuredData).length === 0) return;
      if (role !== 'admin') return;

      const hasJobWorkspaceData = jobWorkspaceData && Object.keys(jobWorkspaceData).length > 0;
      if (!hasJobWorkspaceData) {
        // Collect all approved entries from procuredData
        let count = 0;
        const initialJobs: Record<string, any[]> = {};
        
        for (const [docName, entries] of Object.entries(procuredData)) {
          if (!Array.isArray(entries)) continue;
          const approved = entries.filter((e: any) => e.isApproved);
          if (approved.length > 0) {
            initialJobs[docName] = approved.map((e: any) => {
              const { isApproved, isRejected, ...rest } = e;
              return {
                ...rest,
                _id: rest._id || Math.random().toString(36).substring(2, 11),
                approvedAt: rest.processedAt || new Date().toISOString()
              };
            });
            count += approved.length;
          }
        }

        if (count > 0) {
          for (const [docName, rows] of Object.entries(initialJobs)) {
            await writeData(`jobWorkspaceData/${docName}`, rows);
          }
          console.log(`Synced ${count} previously approved entries into Job Workspace`);
        }
      }
    }

    checkAndSyncApprovedEntries();
  }, [procuredData, jobWorkspaceData, role]);

  // Sync selected doctor with global store if activeDoctorId changes
  useEffect(() => {
    if (activeDoctorId && selectedDoctor === 'all') {
      setSelectedDoctor(activeDoctorId);
    }
  }, [activeDoctorId]);

  // Combine and flatten jobs across all doctors with doctorName attached
  const allDoctorNames = useMemo(() => {
    const names = new Set<string>();
    Object.keys(jobWorkspaceData || {}).forEach(k => names.add(k));
    return Array.from(names).sort();
  }, [jobWorkspaceData]);

  const allRows = useMemo(() => {
    const list: any[] = [];
    Object.entries(jobWorkspaceData || {}).forEach(([docName, rows]) => {
      if (Array.isArray(rows)) {
        rows.forEach(r => {
          list.push({ ...r, doctorName: docName });
        });
      }
    });
    return list;
  }, [jobWorkspaceData]);

  // Filter and sort
  const filteredRows = useMemo(() => {
    return allRows.filter(row => {
      // Doctor filter
      if (selectedDoctor !== "all" && row.doctorName !== selectedDoctor) {
        return false;
      }
      // Status filter
      if (statusFilter !== "all" && (row.Status || "Active") !== statusFilter) {
        return false;
      }
      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const patient = String(row['Patient Name'] || '').toLowerCase();
        const mat = String(row['Work material'] || '').toLowerCase();
        const tooth = String(row['Tooth No'] || '').toLowerCase();
        const shade = String(row['Shade'] || '').toLowerCase();
        const loc = String(row['Location'] || '').toLowerCase();
        const doc = String(row.doctorName || '').toLowerCase();
        if (!patient.includes(q) && !mat.includes(q) && !tooth.includes(q) && !shade.includes(q) && !loc.includes(q) && !doc.includes(q)) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField.toLowerCase().includes('date')) {
        const timeA = parseDateString(valA).getTime();
        const timeB = parseDateString(valB).getTime();
        return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA || '').toLowerCase();
      const strB = String(valB || '').toLowerCase();
      if (strA < strB) return sortDirection === 'asc' ? -1 : 1;
      if (strA > strB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [allRows, selectedDoctor, statusFilter, searchTerm, sortField, sortDirection]);

  // KPI calculations
  const totalJobsCount = filteredRows.length;
  const totalUnits = useMemo(() => {
    return filteredRows.reduce((acc, r) => acc + (Number(r.Units) || 0), 0);
  }, [filteredRows]);
  const activeCount = useMemo(() => {
    return filteredRows.filter(r => (r.Status || 'Active') === 'Active' || r.Status === 'Procured').length;
  }, [filteredRows]);
  const deliveredCount = useMemo(() => {
    return filteredRows.filter(r => r.Status === 'Delivered').length;
  }, [filteredRows]);

  // Handle header sorting click
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  /**
   * Format row data into exact Excel TSV string.
   * Column order matches the imported Excel:
   * Received Date | Delivered Date | Patient Name | Tooth No. | Work material | Units
   */
  const formatRowForExcel = (row: any): string => {
    const receivedDate = formatDateForDisplay(row['Received Date']);
    const deliveredDate = (row['Delivered Date'] && row['Delivered Date'] !== 'Not Delivered') 
      ? formatDateForDisplay(row['Delivered Date']) 
      : '';
    const patientName = String(row['Patient Name'] || '').trim();
    const toothNo = String(row['Tooth No'] || '').trim();
    const workMaterial = String(row['Work material'] || '').trim();
    const units = String(row['Units'] || '').trim();

    // Exact Excel column order: Received Date | Delivered Date | Patient Name | Tooth No. | Work material | Units
    return `${receivedDate}\t${deliveredDate}\t${patientName}\t${toothNo}\t${workMaterial}\t${units}`;
  };

  const getExcelHeaders = (): string => {
    return "Received Date\tDelivered Date\tPatient Name\tTooth No.\tWork material\tUnits";
  };

  // Copy Single Row in exact Excel column order
  const handleCopyRow = async (row: any) => {
    try {
      let tsvText = formatRowForExcel(row);
      if (includeHeaders) {
        tsvText = `${getExcelHeaders()}\n${tsvText}`;
      }

      await navigator.clipboard.writeText(tsvText);
      setCopiedRowId(row._id);
      setTimeout(() => setCopiedRowId(null), 2500);

      toast.success(
        `Copied "${row['Patient Name']}" → paste directly into Excel (Ctrl+V)`,
        { duration: 3000 }
      );
    } catch (err: any) {
      toast.error("Failed to copy row: " + err.message);
    }
  };

  // Copy All Filtered Rows in exact Excel column order
  const handleCopyAllRows = async () => {
    if (filteredRows.length === 0) {
      toast.error("No rows to copy.");
      return;
    }

    try {
      const rowStrings = filteredRows.map(r => formatRowForExcel(r));
      let content = rowStrings.join('\n');
      if (includeHeaders) {
        content = `${getExcelHeaders()}\n${content}`;
      }

      await navigator.clipboard.writeText(content);
      toast.success(`Copied ${filteredRows.length} rows in Excel column order to clipboard!`);
    } catch (err: any) {
      toast.error("Failed to copy rows: " + err.message);
    }
  };

  // Export to .xlsx file
  const handleExportXLSX = async () => {
    if (filteredRows.length === 0) {
      toast.error("No rows to export.");
      return;
    }

    try {
      const xlsx = await import('xlsx');
      const exportData = filteredRows.map(r => ({
        'Patient Name': r['Patient Name'] || '',
        'Doctor': r.doctorName || '',
        'Shade': r['Shade'] || '',
        'Location': r['Location'] || '',
        'Received Date': formatDateForDisplay(r['Received Date']),
        'Delivered Date': r['Delivered Date'] === 'Not Delivered' ? '' : formatDateForDisplay(r['Delivered Date']),
        'Tooth No': r['Tooth No'] || '',
        'Work Material': r['Work material'] || '',
        'Units': Number(r['Units']) || 1,
        'Status': r['Status'] || 'Active',
      }));

      const worksheet = xlsx.utils.json_to_sheet(exportData);
      const workbook = xlsx.utils.book_new();
      const sheetTitle = selectedDoctor === 'all' ? "Approved_Jobs" : selectedDoctor.substring(0, 31);
      xlsx.utils.book_append_sheet(workbook, worksheet, sheetTitle);
      
      const fileName = `Job_Workspace_${selectedDoctor}_${new Date().toISOString().split('T')[0]}.xlsx`;
      xlsx.writeFile(workbook, fileName);
      toast.success(`Exported ${filteredRows.length} rows to ${fileName}`);
    } catch (err: any) {
      toast.error("Failed to export Excel file: " + err.message);
    }
  };

  // Start row inline editing
  const startEditing = (row: any) => {
    setEditingRowId(row._id);
    setEditFormData({ ...row });
  };

  const cancelEditing = () => {
    setEditingRowId(null);
    setEditFormData({});
  };

  // Save edited row
  const saveEditing = async (doctorName: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const currentRows = jobWorkspaceData[doctorName] || [];
      const updatedRows = currentRows.map((r: any) => 
        r._id === editingRowId ? { ...r, ...editFormData } : r
      );

      await writeData(`jobWorkspaceData/${doctorName}`, updatedRows);
      toast.success("Job entry updated successfully.");
      setEditingRowId(null);
      setEditFormData({});
    } catch (err: any) {
      toast.error("Failed to update row: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Toggle Hold status
  const toggleHold = async (row: any) => {
    const doctorName = row.doctorName;
    const isCurrentlyHold = row['Status'] === 'Hold';
    const newStatus = isCurrentlyHold ? 'Active' : 'Hold';

    try {
      const currentRows = jobWorkspaceData[doctorName] || [];
      const updatedRows = currentRows.map((r: any) => 
        r._id === row._id ? { ...r, Status: newStatus } : r
      );

      await writeData(`jobWorkspaceData/${doctorName}`, updatedRows);
      toast.success(`Job marked as ${newStatus}`);
    } catch (err: any) {
      toast.error("Failed to update status: " + err.message);
    }
  };

  // Delete single row from Job Workspace
  const deleteRow = async (row: any) => {
    if (!confirm(`Are you sure you want to remove the job entry for "${row['Patient Name']}" from Job Workspace?`)) {
      return;
    }

    const doctorName = row.doctorName;
    try {
      const currentRows = jobWorkspaceData[doctorName] || [];
      const updatedRows = currentRows.filter((r: any) => r._id !== row._id);

      await writeData(`jobWorkspaceData/${doctorName}`, updatedRows);
      toast.success("Job removed from Job Workspace.");
    } catch (err: any) {
      toast.error("Failed to delete entry: " + err.message);
    }
  };

  const formatDateForInput = (val: string) => {
    if (!val || val === 'Not Delivered') return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    const parts = val.split('/');
    if (parts.length === 3) {
      let [m, d, y] = parts;
      if (y.length === 2) y = '20' + y;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return '';
  };

  return (
    <div className="flex flex-col h-full bg-background relative w-full min-w-0 overflow-hidden">
      {/* Top Header */}
      <div className="p-6 border-b border-panel-border bg-black/40 flex flex-col md:flex-row justify-between items-start md:items-center shrink-0 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Table className="text-accent" />
              Job Workspace
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-accent/10 text-accent border border-accent/20">
              Approved Job Ledger
            </span>
          </div>
          <p className="text-foreground/70 mt-1 text-sm">
            Live tabular records of approved job works. Use the Copy button on any row to paste directly into your Excel file.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <Link
            href="/job-board"
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-lg bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ClipboardCheck size={16} className="text-accent" />
            <span>Job Board</span>
          </Link>

          <Link
            href="/job-work"
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-bold text-panel bg-accent rounded-lg hover:bg-accent-glow shadow-[0_0_12px_rgba(0,194,255,0.35)] transition-all"
          >
            <Plus size={16} />
            <span>New Job Entry</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-black/20 border-b border-panel-border/60 shrink-0">
        <div className="bg-panel border border-panel-border/80 rounded-xl p-3.5 shadow-sm">
          <div className="text-xs uppercase font-semibold text-white/50 tracking-wider">Total Jobs</div>
          <div className="text-xl font-bold text-white mt-1">{totalJobsCount}</div>
        </div>
        <div className="bg-panel border border-panel-border/80 rounded-xl p-3.5 shadow-sm">
          <div className="text-xs uppercase font-semibold text-white/50 tracking-wider">Total Units</div>
          <div className="text-xl font-bold text-accent mt-1">{totalUnits}</div>
        </div>
        <div className="bg-panel border border-panel-border/80 rounded-xl p-3.5 shadow-sm">
          <div className="text-xs uppercase font-semibold text-white/50 tracking-wider">Active / In Progress</div>
          <div className="text-xl font-bold text-blue-400 mt-1">{activeCount}</div>
        </div>
        <div className="bg-panel border border-panel-border/80 rounded-xl p-3.5 shadow-sm">
          <div className="text-xs uppercase font-semibold text-white/50 tracking-wider">Delivered</div>
          <div className="text-xl font-bold text-green-400 mt-1">{deliveredCount}</div>
        </div>
      </div>

      {/* Doctor Tabs */}
      <div className="px-6 py-2.5 border-b border-panel-border bg-black/30 flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0">
        <button
          onClick={() => {
            setSelectedDoctor("all");
            setActiveDoctorId(null);
          }}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
            selectedDoctor === "all"
              ? "bg-accent/20 text-accent border border-accent/30 shadow-[0_0_10px_rgba(0,194,255,0.15)]"
              : "text-white/60 hover:text-white hover:bg-white/5 border border-transparent"
          }`}
        >
          <span>All Doctors</span>
          <span className="px-1.5 py-0.2 rounded-full bg-white/10 text-[10px] text-white/70">
            {allRows.length}
          </span>
        </button>

        {allDoctorNames.map((docName) => {
          const docRowCount = (jobWorkspaceData[docName] || []).length;
          const isSelected = selectedDoctor === docName;
          return (
            <button
              key={docName}
              onClick={() => {
                setSelectedDoctor(docName);
                setActiveDoctorId(docName);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
                isSelected
                  ? "bg-accent/20 text-accent border border-accent/30 shadow-[0_0_10px_rgba(0,194,255,0.15)]"
                  : "text-white/60 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              <span>{docName}</span>
              <span className="px-1.5 py-0.2 rounded-full bg-white/10 text-[10px] text-white/70">
                {docRowCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* Controls: Search, Filter, Copy Format Selector, Bulk Actions */}
      <div className="px-6 py-3 border-b border-panel-border/60 bg-black/10 flex flex-wrap items-center justify-between gap-4 shrink-0">
        {/* Left: Search & Status Filter */}
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative min-w-[200px] max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={15} />
            <input
              type="text"
              placeholder="Search patient, material, tooth no..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-black/40 border border-panel-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-white/60">
            <Filter size={14} />
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-black/40 border border-panel-border rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-accent"
            >
              <option value="all">All</option>
              <option value="Active">Active</option>
              <option value="Delivered">Delivered</option>
              <option value="Repeat">Repeat</option>
              <option value="Hold">Hold</option>
            </select>
          </div>
        </div>

        {/* Right: Copy Options & Bulk Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Excel column order badge */}
          <div className="hidden sm:flex items-center gap-1.5 bg-black/40 border border-panel-border/60 px-2.5 py-1 rounded-lg">
            <FileSpreadsheet size={12} className="text-green-400" />
            <span className="text-[10px] text-white/40 font-mono tracking-tight">
              Rcv.Date · Del.Date · Patient · Tooth · Material · Units
            </span>
          </div>

          <label className="flex items-center gap-1.5 text-xs text-white/60 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeHeaders}
              onChange={(e) => setIncludeHeaders(e.target.checked)}
              className="rounded bg-black/40 border-panel-border text-accent focus:ring-0 w-3.5 h-3.5"
            />
            <span>With Headers</span>
          </label>

          <button
            onClick={handleCopyAllRows}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white/90 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 hover:border-accent/30 transition-colors"
            title="Copy all currently filtered rows in Excel column order (TSV — paste with Ctrl+V)"
          >
            <Copy size={13} className="text-accent" />
            <span>Copy All ({filteredRows.length})</span>
          </button>

          <button
            onClick={handleExportXLSX}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white/90 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
            title="Download as Excel file (.xlsx)"
          >
            <Download size={13} className="text-green-400" />
            <span>Export .xlsx</span>
          </button>
        </div>
      </div>

      {/* Main Table Area */}
      <div className="flex-1 w-full relative p-6 min-h-0 flex flex-col overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto flex-1 border border-panel-border rounded-xl bg-black/25 custom-scrollbar shadow-inner">
          <table className="w-full text-sm text-left relative border-collapse">
            <thead className="text-xs text-foreground/60 uppercase bg-[#08101a] sticky top-0 z-20 shadow-sm select-none">
              <tr className="border-b border-panel-border">
                {selectedDoctor === "all" && (
                  <th 
                    onClick={() => handleSort('doctorName')} 
                    className="px-4 py-3.5 whitespace-nowrap cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Doctor</span>
                      {sortField === 'doctorName' ? (
                        sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                      ) : <ArrowUpDown size={12} className="opacity-30" />}
                    </div>
                  </th>
                )}
                <th 
                  onClick={() => handleSort('Patient Name')} 
                  className="px-4 py-3.5 whitespace-nowrap cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Patient Name</span>
                    {sortField === 'Patient Name' ? (
                      sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                    ) : <ArrowUpDown size={12} className="opacity-30" />}
                  </div>
                </th>
                <th className="px-3 py-3.5 whitespace-nowrap">Shade</th>
                <th className="px-3 py-3.5 whitespace-nowrap hidden lg:table-cell">Location</th>
                <th 
                  onClick={() => handleSort('Received Date')} 
                  className="px-4 py-3.5 whitespace-nowrap cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Received Date</span>
                    {sortField === 'Received Date' ? (
                      sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                    ) : <ArrowUpDown size={12} className="opacity-30" />}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('Delivered Date')} 
                  className="px-4 py-3.5 whitespace-nowrap cursor-pointer hover:text-white transition-colors hidden md:table-cell"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Due Date</span>
                    {sortField === 'Delivered Date' ? (
                      sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                    ) : <ArrowUpDown size={12} className="opacity-30" />}
                  </div>
                </th>
                <th className="px-4 py-3.5 whitespace-nowrap">Tooth No</th>
                <th 
                  onClick={() => handleSort('Work material')} 
                  className="px-4 py-3.5 whitespace-nowrap cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Work Material</span>
                    {sortField === 'Work material' ? (
                      sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                    ) : <ArrowUpDown size={12} className="opacity-30" />}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('Units')} 
                  className="px-3 py-3.5 whitespace-nowrap cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Units</span>
                    {sortField === 'Units' ? (
                      sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                    ) : <ArrowUpDown size={12} className="opacity-30" />}
                  </div>
                </th>
                <th className="px-4 py-3.5 whitespace-nowrap">Status</th>
                <th className="px-4 py-3.5 whitespace-nowrap text-right sticky right-0 bg-[#08101a] z-30 shadow-[-4px_0_8px_-1px_rgba(0,0,0,0.3)]">
                  Actions & Excel Copy
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={selectedDoctor === "all" ? 11 : 10} className="text-center py-16 text-foreground/50">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Table size={40} className="text-white/20 mb-2" />
                      <p className="text-base text-white/70 font-semibold">No approved jobs found.</p>
                      <p className="text-xs text-white/40">
                        {selectedDoctor !== 'all' 
                          ? `No entries for ${selectedDoctor}. Review and approve entries in the Job Board to see them here.`
                          : "Review and approve entries in the Job Board to see them here."}
                      </p>
                      <Link
                        href="/job-board"
                        className="mt-3 px-4 py-2 bg-accent/10 border border-accent/20 text-accent rounded-lg hover:bg-accent/20 transition-colors text-xs font-semibold flex items-center gap-1.5"
                      >
                        <ClipboardCheck size={14} /> Go to Job Board
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const isEditing = editingRowId === row._id;
                  const isCopied = copiedRowId === row._id;

                  return (
                    <tr 
                      key={row._id} 
                      className={`border-b border-panel-border/40 hover:bg-white/[0.04] transition-colors group ${
                        isCopied ? 'bg-accent/10' : ''
                      }`}
                    >
                      {/* Doctor Name (if all doctors view) */}
                      {selectedDoctor === "all" && (
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-accent text-xs">
                          {row.doctorName}
                        </td>
                      )}

                      {/* Patient Name */}
                      <td className="px-4 py-3 whitespace-nowrap font-semibold text-white">
                        {isEditing ? (
                          <input 
                            type="text" 
                            value={editFormData['Patient Name'] || ''} 
                            onChange={(e) => setEditFormData({...editFormData, 'Patient Name': e.target.value})} 
                            className="bg-black/40 border border-panel-border rounded px-2 py-1 text-white text-xs w-full min-w-[140px]" 
                          />
                        ) : row['Patient Name']}
                      </td>

                      {/* Shade */}
                      <td className="px-3 py-3 whitespace-nowrap text-white/70 text-xs">
                        {isEditing ? (
                          <input 
                            type="text" 
                            value={editFormData['Shade'] || ''} 
                            onChange={(e) => setEditFormData({...editFormData, 'Shade': e.target.value})} 
                            className="bg-black/40 border border-panel-border rounded px-2 py-1 text-white text-xs w-full max-w-[70px]" 
                          />
                        ) : (row['Shade'] || '-')}
                      </td>

                      {/* Location */}
                      <td className="px-3 py-3 whitespace-nowrap text-white/70 text-xs hidden lg:table-cell">
                        {isEditing ? (
                          <input 
                            type="text" 
                            value={editFormData['Location'] || ''} 
                            onChange={(e) => setEditFormData({...editFormData, 'Location': e.target.value})} 
                            className="bg-black/40 border border-panel-border rounded px-2 py-1 text-white text-xs w-full max-w-[100px]" 
                          />
                        ) : (row['Location'] || '-')}
                      </td>

                      {/* Received Date */}
                      <td className="px-4 py-3 whitespace-nowrap text-xs">
                        {isEditing ? (
                          <input 
                            type="date" 
                            value={formatDateForInput(editFormData['Received Date'])} 
                            onChange={(e) => setEditFormData({...editFormData, 'Received Date': e.target.value})} 
                            className="bg-black/40 border border-panel-border rounded px-2 py-1 text-white text-xs max-w-[130px]" 
                            style={{ colorScheme: 'dark' }} 
                          />
                        ) : formatDateForDisplay(row['Received Date'])}
                      </td>

                      {/* Due Date */}
                      <td className="px-4 py-3 whitespace-nowrap text-xs hidden md:table-cell">
                        {isEditing ? (
                          <input 
                            type="date" 
                            value={formatDateForInput(editFormData['Delivered Date'])} 
                            onChange={(e) => setEditFormData({...editFormData, 'Delivered Date': e.target.value || 'Not Delivered'})} 
                            className="bg-black/40 border border-panel-border rounded px-2 py-1 text-white text-xs max-w-[130px]" 
                            style={{ colorScheme: 'dark' }} 
                          />
                        ) : (
                          <span className={row['Delivered Date'] === 'Not Delivered' || !row['Delivered Date'] ? 'text-foreground/40 italic' : ''}>
                            {row['Delivered Date'] ? formatDateForDisplay(row['Delivered Date']) : 'Not Delivered'}
                          </span>
                        )}
                      </td>

                      {/* Tooth No */}
                      <td className="px-4 py-3 whitespace-nowrap text-xs">
                        {isEditing ? (
                          <input 
                            type="text" 
                            value={editFormData['Tooth No'] || ''} 
                            onChange={(e) => setEditFormData({...editFormData, 'Tooth No': e.target.value})} 
                            className="bg-black/40 border border-panel-border rounded px-2 py-1 text-white text-xs max-w-[90px]" 
                          />
                        ) : (
                          row['Tooth No'] ? <PalmerCross teethStr={String(row['Tooth No'])} /> : <span className="text-white/40">-</span>
                        )}
                      </td>

                      {/* Work Material */}
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-white text-xs">
                        {isEditing ? (
                          <input 
                            type="text" 
                            value={editFormData['Work material'] || ''} 
                            onChange={(e) => setEditFormData({...editFormData, 'Work material': e.target.value})} 
                            className="bg-black/40 border border-panel-border rounded px-2 py-1 text-white text-xs w-full min-w-[120px]" 
                          />
                        ) : row['Work material']}
                      </td>

                      {/* Units */}
                      <td className="px-3 py-3 whitespace-nowrap font-bold text-accent text-xs">
                        {isEditing ? (
                          <input 
                            type="number" 
                            min="1" 
                            value={editFormData['Units'] || ''} 
                            onChange={(e) => setEditFormData({...editFormData, 'Units': Number(e.target.value)})} 
                            className="bg-black/40 border border-panel-border rounded px-2 py-1 text-white text-xs max-w-[60px]" 
                          />
                        ) : row['Units']}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isEditing ? (
                          <select 
                            value={editFormData['Status'] || 'Active'} 
                            onChange={(e) => setEditFormData({...editFormData, 'Status': e.target.value})} 
                            className="bg-black/40 border border-panel-border rounded px-2 py-1 text-white text-xs"
                          >
                            <option value="Active">Active</option>
                            <option value="Delivered">Delivered</option>
                            <option value="Repeat">Repeat</option>
                            <option value="Hold">Hold</option>
                            <option value="Procured">Procured</option>
                          </select>
                        ) : (
                          <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${
                            row['Status'] === 'Delivered' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                            row['Status'] === 'Repeat' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                            row['Status'] === 'Hold' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                            row['Status'] === 'Procured' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                            'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          }`}>
                            {row['Status'] || 'Active'}
                          </span>
                        )}
                      </td>

                      {/* Actions & Copy Column */}
                      <td className="px-4 py-3 whitespace-nowrap text-right sticky right-0 bg-[#0a0f18] group-hover:bg-[#111926] shadow-[-4px_0_8px_-1px_rgba(0,0,0,0.25)] transition-colors z-10">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => saveEditing(row.doctorName)} 
                              className="p-1.5 text-green-400 hover:text-green-300 rounded hover:bg-green-400/10" 
                              title="Save Changes"
                            >
                              <Save size={15} />
                            </button>
                            <button 
                              onClick={cancelEditing} 
                              className="p-1.5 text-white/50 hover:text-white rounded hover:bg-white/5" 
                              title="Cancel Edit"
                            >
                              <X size={15} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            {/* THE COPY FOR EXCEL BUTTON */}
                            <button
                              onClick={() => handleCopyRow(row)}
                              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                                isCopied
                                  ? "bg-green-500/20 text-green-400 border-green-500/40 shadow-[0_0_10px_rgba(34,197,94,0.3)]"
                                  : "bg-accent/15 text-accent-glow hover:bg-accent/25 hover:text-white border-accent/30 shadow-[0_0_8px_rgba(0,194,255,0.2)]"
                              }`}
                              title="Copy row in Excel format (Tab-separated values ready to paste into Excel)"
                            >
                              {isCopied ? <Check size={14} className="text-green-400" /> : <Copy size={13} />}
                              <span>{isCopied ? "Copied!" : "Copy for Excel"}</span>
                            </button>

                            {/* Status Hold/Resume */}
                            <button 
                              onClick={() => toggleHold(row)} 
                              className="p-1.5 text-orange-400 hover:text-orange-300 rounded hover:bg-orange-400/10" 
                              title={row['Status'] === 'Hold' ? "Resume Job" : "Put on Hold"}
                            >
                              <Pause size={14} />
                            </button>

                            {/* Edit */}
                            <button 
                              onClick={() => startEditing(row)} 
                              className="p-1.5 text-blue-400 hover:text-blue-300 rounded hover:bg-blue-400/10" 
                              title="Edit Entry"
                            >
                              <Edit2 size={14} />
                            </button>

                            {/* Delete */}
                            <button 
                              onClick={() => deleteRow(row)} 
                              className="p-1.5 text-red-400 hover:text-red-300 rounded hover:bg-red-400/10" 
                              title="Delete Entry"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
