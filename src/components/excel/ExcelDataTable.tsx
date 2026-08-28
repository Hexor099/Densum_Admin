import { AlertTriangle, AlertCircle, RefreshCw } from 'lucide-react';

interface RowData {
  originalIndex: number;
  [key: string]: any;
}

interface ExcelDataTableProps {
  data: RowData[];
  expectedHeaders: string[];
  rowStatus: Record<number, 'success' | 'error' | 'duplicate'>;
  validationErrors: Record<number, string>;
  isSyncing: boolean;
  onEditAmount: (index: number, newAmount: string) => void;
}

export function ExcelDataTable({
  data,
  expectedHeaders,
  rowStatus,
  validationErrors,
  isSyncing,
  onEditAmount
}: ExcelDataTableProps) {
  
  if (data.length === 0) {
    return (
      <div className="flex-1 border-t border-panel-border/50 flex flex-col items-center justify-center p-10 text-foreground/50 relative z-10">
        <RefreshCw size={48} className={`mb-4 opacity-20 ${isSyncing ? "animate-spin" : ""}`} />
        <p className="text-lg">No data loaded.</p>
        <p className="text-sm mt-1">Upload a file and click "Process Data".</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto custom-scrollbar border-t border-panel-border/50 relative z-10 bg-black/20">
      <table className="w-full text-sm text-left relative">
        <thead className="text-xs text-foreground/60 uppercase bg-black/60 sticky top-0 z-20 backdrop-blur-md">
          <tr>
            <th className="px-6 py-4 font-bold border-b border-white/5">Status</th>
            {expectedHeaders.map(h => (
              <th key={h} className="px-6 py-4 font-bold border-b border-white/5 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const status = rowStatus[i];
            const error = validationErrors[i];
            const isError = status === 'error';
            const isDuplicate = status === 'duplicate';
            const isSuccess = status === 'success';
            
            return (
              <tr 
                key={i} 
                className={`border-b border-panel-border/30 transition-colors
                  ${isError ? 'bg-red-500/10 hover:bg-red-500/20' : 
                    isDuplicate ? 'bg-yellow-500/10 hover:bg-yellow-500/20' : 
                    isSuccess ? 'bg-green-500/5 hover:bg-green-500/10' : 'hover:bg-white/5'}
                `}
              >
                <td className="px-6 py-3 whitespace-nowrap w-32">
                  {isError && (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-red-400 bg-red-500/10 px-2 py-1 rounded-md" title={error}>
                      <AlertCircle size={14} /> Error
                    </span>
                  )}
                  {isDuplicate && (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded-md">
                      <AlertTriangle size={14} /> Duplicate
                    </span>
                  )}
                  {isSuccess && (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-green-400 bg-green-500/10 px-2 py-1 rounded-md">
                      <div className="w-2 h-2 rounded-full bg-green-400"></div> Ready
                    </span>
                  )}
                </td>
                {expectedHeaders.map(h => {
                  const val = row[h] || '';
                  if (h === 'AMOUNT' && (isError || isDuplicate)) {
                     // Editable field for amounts with error/duplicate status
                     return (
                       <td key={h} className="px-6 py-3 whitespace-nowrap">
                         <input 
                           type="text"
                           value={val}
                           onChange={(e) => onEditAmount(i, e.target.value)}
                           className="w-24 bg-black/60 border border-panel-border/80 px-2 py-1 rounded focus:outline-none focus:border-accent text-white"
                         />
                       </td>
                     );
                  }
                  return (
                    <td key={h} className="px-6 py-3 whitespace-nowrap font-medium text-foreground/90">
                      {val}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
