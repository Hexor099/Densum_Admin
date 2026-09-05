"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { CloudUpload, RefreshCw, Plus, FileSpreadsheet, PlusCircle, Edit2, Save, X, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { fetchData, writeData } from "@/lib/firebase";
import { AddEntryModal } from "./AddEntryModal";
import { formatDateForDisplay, parseDateString } from "@/lib/utils";
import { PalmerCross } from "./PalmerCross";
import { useStore } from "@/store/useStore";

type DoctorSheet = {
  id: string;
  name: string;
  rowData: any[];
};

export function ExcelWorkspace() {
  const [sheets, setSheets] = useState<DoctorSheet[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { doctors, refreshDoctors } = useStore();
  
  // Inline editing state
  const [editingRow, setEditingRow] = useState<any>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'Received Date', direction: 'desc' });

  // Load Data from Firebase
  useEffect(() => {
    async function loadData() {
      try {
        const cloudData = await fetchData("excelData");
        
        if (cloudData && Object.keys(cloudData).length > 0) {
          const loadedSheets = Object.keys(cloudData).map((sheetName) => {
            const rows = cloudData[sheetName] || [];
            const cleanRows = rows.map((row: any) => {
              const r = { ...row };
              delete r['Fitted'];
              delete r['fitted'];
              
              if (!r['Delivered Date']) r['Delivered Date'] = 'Not Delivered';
              if (!r['Status']) r['Status'] = 'Active';
              if (!r._id) r._id = Math.random().toString(36).substring(2, 11);
              
              return r;
            });
            return {
              id: `sheet_${Math.random().toString(36).substring(7)}`,
              name: sheetName,
              rowData: cleanRows
            };
          });
          
          setSheets(loadedSheets);
          if (loadedSheets.length > 0) {
            setActiveSheetId(loadedSheets[0].id);
          }
        } else {
          const defaultSheet = {
            id: 'sheet_default',
            name: "Live Workspace",
            rowData: []
          };
          setSheets([defaultSheet]);
          setActiveSheetId(defaultSheet.id);
        }
      } catch (err) {
        console.error("Failed to load cloud data", err);
        toast.error("Failed to load workspace data.");
      } finally {
        setIsInitializing(false);
      }
    }
    loadData();
  }, []);

  const handleAddSheet = () => {
    const newName = `Doctor ${sheets.length + 1}`;
    const newSheet = {
      id: `sheet_${Date.now()}`,
      name: newName,
      rowData: []
    };
    setSheets(prev => [...prev, newSheet]);
    setActiveSheetId(newSheet.id);
  };

  const handleTabSwitch = (id: string) => {
    if (editingRow !== null) {
      toast.error("Please save or cancel your edits before switching sheets.");
      return;
    }
    setActiveSheetId(id);
  };



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

  const saveWorkspaceData = async (sheetsData: any[]) => {
    setIsSyncing(true);
    try {
      const flatData: Record<string, any[]> = {};
      
      sheetsData.forEach((sheet) => {
        const validRows = sheet.rowData.filter((row: any) => {
          return row && Object.values(row).some(v => v !== null && v !== undefined && v !== "");
        });

        if (validRows.length > 0) {
          const safeSheetName = sheet.name.replace(/\./g, ' ').replace(/[#$\[\]\/]/g, '');
          const cleanRowsToSave = validRows.map((row: any) => {
            const r = { ...row };
            delete r['Fitted'];
            delete r['fitted'];
            if (!r['Delivered Date']) r['Delivered Date'] = 'Not Delivered';
            if (!r['Status']) r['Status'] = 'Active';
            return r;
          });
          flatData[safeSheetName] = cleanRowsToSave;
        }
      });

      if (Object.keys(flatData).length > 0) {
        await writeData("excelData", flatData);
        
        let changed = false;
        for (const safeSheetName of Object.keys(flatData)) {
          if (!doctors[safeSheetName]) {
            changed = true;
            await writeData(`doctors/${safeSheetName}`, { balance: 0, prices: {} });
          }
        }
        if (changed) await refreshDoctors();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to auto-save to cloud.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveEntry = async (doctorName: string, entry: any) => {
    const entryToSave = { ...entry };
    if (!entryToSave['Delivered Date']) entryToSave['Delivered Date'] = 'Not Delivered';
    if (!entryToSave['Status']) entryToSave['Status'] = 'Active';
    if (!entryToSave._id) entryToSave._id = Math.random().toString(36).substring(2, 11);

    let finalSheets: any[] = [];
    let sheetExists = false;
    const updatedSheets = sheets.map(s => {
      if (s.name.toLowerCase() === doctorName.toLowerCase()) {
        sheetExists = true;
        return { ...s, rowData: [entryToSave, ...s.rowData] };
      }
      return s;
    });

    if (!sheetExists) {
      const newSheet = {
        id: `sheet_${Date.now()}`,
        name: doctorName,
        rowData: [entryToSave]
      };
      setActiveSheetId(newSheet.id);
      finalSheets = [...updatedSheets, newSheet];
    } else {
      const targetSheet = updatedSheets.find(s => s.name.toLowerCase() === doctorName.toLowerCase());
      if (targetSheet) setActiveSheetId(targetSheet.id);
      finalSheets = updatedSheets;
    }
    
    setSheets(finalSheets);
    setIsModalOpen(false);
    await saveWorkspaceData(finalSheets);
  };

  const startEditing = (row: any) => {
    setEditingRow(row);
    setEditFormData({ ...row });
  };

  const cancelEditing = () => {
    setEditingRow(null);
    setEditFormData({});
  };

  const saveEditing = async () => {
    const finalSheets = sheets.map(sheet => {
      if (sheet.id === activeSheetId) {
        const newData = [...sheet.rowData];
        const index = newData.findIndex(r => r._id === editingRow._id);
        if (index !== -1) {
          newData[index] = editFormData;
        } else {
          // Fallback if no _id
          const fallbackIndex = newData.indexOf(editingRow);
          if (fallbackIndex !== -1) newData[fallbackIndex] = editFormData;
        }
        return { ...sheet, rowData: newData };
      }
      return sheet;
    });
    
    setSheets(finalSheets);
    setEditingRow(null);
    setEditFormData({});
    toast.success("Entry updated!");
    await saveWorkspaceData(finalSheets);
  };

  const deleteRow = async (rowToDelete: any) => {
    if (!confirm("Are you sure you want to delete this entry?")) return;
    const finalSheets = sheets.map(sheet => {
      if (sheet.id === activeSheetId) {
        const newData = sheet.rowData.filter(r => r._id ? r._id !== rowToDelete._id : r !== rowToDelete);
        return { ...sheet, rowData: newData };
      }
      return sheet;
    });
    
    setSheets(finalSheets);
    toast.success("Entry deleted!");
    await saveWorkspaceData(finalSheets);
  };

  if (isInitializing) return null;

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const renderSortHeader = (label: string, key: string) => {
    return (
      <th 
        className="px-4 py-3 whitespace-nowrap cursor-pointer hover:bg-white/5 transition-colors group select-none"
        onClick={() => handleSort(key)}
      >
        <div className="flex items-center gap-1">
          {label}
          <span className="text-foreground/30 group-hover:text-foreground/70 transition-colors">
             {sortConfig?.key === key ? (
               sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-accent" /> : <ArrowDown size={14} className="text-accent" />
             ) : (
               <ArrowUpDown size={14} />
             )}
          </span>
        </div>
      </th>
    );
  };

  const activeSheet = sheets.find(s => s.id === activeSheetId);
  // Only display rows that are not entirely empty, and sort according to sortConfig
  const displayRows = activeSheet?.rowData
    .filter(row => row && Object.values(row).some(v => v !== null && v !== undefined && v !== ""))
    .sort((a, b) => {
      if (!sortConfig) return 0;
      let valA = a[sortConfig.key] || '';
      let valB = b[sortConfig.key] || '';
      
      if (sortConfig.key.includes('Date')) {
        valA = parseDateString(valA).getTime();
        valB = parseDateString(valB).getTime();
      } else {
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
      }
      
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    }) || [];

  return (
    <div className="flex flex-col h-full bg-background relative w-full min-w-0 overflow-hidden">
      
      {/* Top Toolbar / Tab Bar */}
      <div className="flex items-center justify-between p-3 bg-black/40 border-b border-panel-border shrink-0 z-10 w-full overflow-x-auto custom-scrollbar">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <svg 
              className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50 pointer-events-none" 
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              type="text" 
              placeholder="Search doctor sheet..."
              onChange={e => {
                const q = e.target.value.toLowerCase();
                if (!q) return;
                const match = sheets.find(s => s.name.toLowerCase().includes(q));
                if (match) {
                  handleTabSwitch(match.id);
                }
              }}
              className="w-full bg-black/40 border border-panel-border rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-accent transition-colors shadow-inner"
            />
          </div>
          <button
            onClick={handleAddSheet}
            className="flex items-center gap-1 px-3 py-2 text-white/50 hover:text-white/90 hover:bg-white/10 rounded-md transition-colors shrink-0"
            title="Add new doctor sheet"
          >
            <Plus size={18} />
            <span className="text-sm font-medium hidden sm:inline">Add Sheet</span>
          </button>
        </div>

        <div className="flex gap-2 shrink-0 ml-4">
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base bg-green-600/20 text-green-400 font-semibold rounded-lg hover:bg-green-600/30 transition-all flex items-center gap-1.5 sm:gap-2 border border-green-600/50"
          >
            <PlusCircle size={18} className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
            Add Entry
          </button>
        </div>
      </div>
      
      {/* Spreadsheet Editor Area */}
      <div className="flex-1 w-full relative p-4 min-h-0 flex flex-col">
        <div className="mb-3 pl-2">
          <h2 className="text-lg font-bold text-white tracking-wide">
            {activeSheet?.name ? `Doctor: ${activeSheet.name}` : "No Doctor Selected"}
          </h2>
        </div>
        <div className="overflow-x-auto overflow-y-auto flex-1 border border-panel-border rounded-lg bg-black/20 custom-scrollbar">
          <table className="w-full text-sm text-left relative">
            <thead className="text-xs text-foreground/60 uppercase bg-[#08101a] shadow-sm sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">Patient Name</th>
                <th className="px-4 py-3 whitespace-nowrap">Received Date</th>
                <th className="px-4 py-3 whitespace-nowrap hidden md:table-cell">Delivered Date</th>
                <th className="px-4 py-3 whitespace-nowrap hidden md:table-cell">Tooth No</th>
                <th className="px-4 py-3 whitespace-nowrap">Work Material</th>
                <th className="px-4 py-3 whitespace-nowrap">Units</th>
                <th className="px-4 py-3 whitespace-nowrap">Status</th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-foreground/50">
                    No entries found in this sheet. Click "Add Entry" to begin.
                  </td>
                </tr>
              ) : displayRows.map((row, i) => {
                const isEditing = editingRow === row;
                return (
                  <tr key={i} className="border-b border-panel-border/50 hover:bg-white/5 transition-colors group">
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-white">
                      {isEditing ? (
                        <input type="text" value={editFormData['Patient Name'] || ''} onChange={(e) => setEditFormData({...editFormData, 'Patient Name': e.target.value})} className="bg-black/40 border border-panel-border rounded px-2 py-1 text-white w-full min-w-[150px]" />
                      ) : row['Patient Name']}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {isEditing ? (
                        <input type="date" value={formatDateForInput(editFormData['Received Date'])} onChange={(e) => setEditFormData({...editFormData, 'Received Date': e.target.value})} className="bg-black/40 border border-panel-border rounded px-2 py-1 text-white w-full max-w-[140px]" />
                      ) : formatDateForDisplay(row['Received Date'])}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap hidden md:table-cell">
                      {isEditing ? (
                        <input 
                          type="date" 
                          value={formatDateForInput(editFormData['Delivered Date'])} 
                          onChange={(e) => {
                            const newDate = e.target.value;
                            const newStatus = (newDate && newDate !== 'Not Delivered') ? 'Delivered' : editFormData['Status'];
                            setEditFormData({
                              ...editFormData, 
                              'Delivered Date': newDate || 'Not Delivered', 
                              'Status': newStatus
                            });
                          }} 
                          className="bg-black/40 border border-panel-border rounded px-2 py-1 text-white w-full" 
                        />
                      ) : (
                        <span className={row['Delivered Date'] === 'Not Delivered' ? 'text-foreground/50 italic' : ''}>
                          {formatDateForDisplay(row['Delivered Date'])}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap hidden md:table-cell">
                      {isEditing ? (
                        <input type="text" value={editFormData['Tooth No'] || ''} onChange={(e) => setEditFormData({...editFormData, 'Tooth No': e.target.value})} className="bg-black/40 border border-panel-border rounded px-2 py-1 text-white w-full max-w-[120px]" />
                      ) : <PalmerCross teethStr={String(row['Tooth No'] || '')} />}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {isEditing ? (
                        <input type="text" value={editFormData['Work material'] || ''} onChange={(e) => setEditFormData({...editFormData, 'Work material': e.target.value})} className="bg-black/40 border border-panel-border rounded px-2 py-1 text-white w-full" />
                      ) : row['Work material']}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {isEditing ? (
                        <input type="number" min="1" value={editFormData['Units'] || ''} onChange={(e) => setEditFormData({...editFormData, 'Units': Number(e.target.value)})} className="bg-black/40 border border-panel-border rounded px-2 py-1 text-white w-full max-w-[80px]" />
                      ) : row['Units']}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {isEditing ? (
                        <select 
                          value={editFormData['Status'] || 'Active'} 
                          onChange={(e) => {
                            const newStatus = e.target.value;
                            const updates: any = { Status: newStatus };
                            if (newStatus === 'Delivered' && (!editFormData['Delivered Date'] || editFormData['Delivered Date'] === 'Not Delivered')) {
                                updates['Delivered Date'] = new Date().toISOString().split('T')[0];
                            }
                            setEditFormData({...editFormData, ...updates});
                          }} 
                          className="bg-black/40 border border-panel-border rounded px-2 py-1 text-white w-full"
                        >
                          <option value="Active">Active</option>
                          <option value="Delivered">Delivered</option>
                          <option value="Repeat">Repeat</option>
                        </select>
                      ) : (
                        <span className={`px-2 py-1 text-xs font-semibold rounded-md border ${
                          row['Status'] === 'Delivered' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                          row['Status'] === 'Repeat' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                          'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        }`}>
                          {row['Status'] || 'Active'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={saveEditing} className="p-1.5 text-green-400 hover:text-green-300 rounded hover:bg-green-400/10" title="Save">
                            <Save size={16} />
                          </button>
                          <button onClick={cancelEditing} className="p-1.5 text-foreground/50 hover:text-foreground/80 rounded hover:bg-white/5" title="Cancel">
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEditing(row)} className="p-1.5 text-blue-400 hover:text-blue-300 rounded hover:bg-blue-400/10" title="Edit Row">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => deleteRow(row)} className="p-1.5 text-red-400 hover:text-red-300 rounded hover:bg-red-400/10" title="Delete Row">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AddEntryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        sheets={sheets}
        activeSheetId={activeSheetId}
        onSave={handleSaveEntry}
        onAddDoctor={(name) => {}}
      />
    </div>
  );
}
