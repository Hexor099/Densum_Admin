import { RefreshCw, FileText, Upload, CloudUpload, CloudDownload, Trash2 } from 'lucide-react';

interface ExcelControlsProps {
  file: File | null;
  isSyncing: boolean;
  hasData: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSync: () => void;
  onUploadToCloud: () => void;
  onLoadFromCloud: () => void;
  onClearAllLedgers: () => void;
}

export function ExcelControls({
  file,
  isSyncing,
  hasData,
  onFileChange,
  onSync,
  onUploadToCloud,
  onLoadFromCloud,
  onClearAllLedgers
}: ExcelControlsProps) {
  return (
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
          <input type="file" accept=".xlsx, .xlsm" className="hidden" onChange={onFileChange} />
        </label>
        
        <button 
          onClick={onSync}
          disabled={isSyncing || !file}
          className="px-5 py-2.5 bg-panel-border border border-white/10 text-white font-medium rounded-lg hover:bg-white/10 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw size={18} className={isSyncing ? "animate-spin text-accent" : "text-accent"} />
          {isSyncing ? "Syncing..." : "Process Data"}
        </button>
        
        <button 
          onClick={onUploadToCloud}
          disabled={!hasData || isSyncing}
          className="px-5 py-2.5 bg-accent/20 text-accent font-medium rounded-lg hover:bg-accent/30 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Save this processed data to Firebase so it loads everywhere"
        >
          <CloudUpload size={18} />
          Save to Cloud
        </button>
        
        <button 
          onClick={onLoadFromCloud}
          disabled={isSyncing}
          className="px-5 py-2.5 bg-blue-500/20 text-blue-400 font-medium rounded-lg hover:bg-blue-500/30 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Load data from Firebase cloud"
        >
          <CloudDownload size={18} />
          Load from Cloud
        </button>
        
        <button 
          onClick={onClearAllLedgers}
          disabled={isSyncing}
          className="px-5 py-2.5 bg-red-500/20 text-red-400 font-medium rounded-lg hover:bg-red-500/30 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Clear all ledgers for testing"
        >
          <Trash2 size={18} />
          Clear Ledgers
        </button>
      </div>
    </div>
  );
}
