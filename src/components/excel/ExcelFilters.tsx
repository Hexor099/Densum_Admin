interface ExcelFiltersProps {
  sheetNames: string[];
  currentSheet: string;
  onSearchSheet: (sheet: string) => void;
  availableMonths: string[];
  selectedMonth: string;
  onMonthChange: (month: string) => void;
}

export function ExcelFilters({
  sheetNames,
  currentSheet,
  onSearchSheet,
  availableMonths,
  selectedMonth,
  onMonthChange
}: ExcelFiltersProps) {
  if (sheetNames.length === 0) return null;

  return (
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
              const match = sheetNames.find(n => n.toLowerCase().includes(q));
              if (match) {
                onSearchSheet(match);
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
          onChange={(e) => onMonthChange(e.target.value)}
          className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accent font-medium shadow-sm appearance-none"
        >
          <option value="All">All Months (View Only)</option>
          {availableMonths.map(month => (
            <option key={month} value={month}>{month}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
