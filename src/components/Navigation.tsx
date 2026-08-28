"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, Users, Package, ReceiptIndianRupee, Settings, Search, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchData } from '@/lib/firebase';
import { useStore } from '@/store/useStore';

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Ledger', href: '/ledger', icon: Users },
  { name: 'Aging Report', href: '/aging-report', icon: Users },
  { name: 'Bank Book', href: '/bank-book', icon: ReceiptIndianRupee },
  { name: 'Inventory', href: '/inventory', icon: Package },
  { name: 'Suppliers', href: '/suppliers', icon: Users },
  { name: 'Purchases', href: '/purchases', icon: ReceiptIndianRupee },
  { name: 'Expenses', href: '/expenses', icon: ReceiptIndianRupee },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();

  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchData, setSearchData] = useState<{ doctors: any, catalog: any, expenses: any } | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const storeDoctors = useStore((state) => state.doctors);
  const storeCatalog = useStore((state) => state.catalog);

  const handleSearchFocus = async () => {
    setIsSearching(true);
    if (!searchData) {
      try {
        const expenses = await fetchData('expenses');
        setSearchData({ doctors: storeDoctors, catalog: storeCatalog, expenses: expenses || [] });
      } catch (e) {
        console.error("Failed to load search data", e);
      }
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearching(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (pathname === "/login") return null;

  let results: { type: string, title: string, subtitle: string, href: string }[] = [];
  if (searchTerm.trim() && searchData) {
    const term = searchTerm.toLowerCase();
    
    // Doctors
    Object.keys(searchData.doctors).forEach(docName => {
      if (docName.toLowerCase().includes(term)) {
        results.push({ type: 'Doctor', title: docName, subtitle: 'Ledger Profile', href: '/ledger' });
      }
    });

    // Catalog
    Object.keys(searchData.catalog).forEach(itemId => {
      const item = searchData.catalog[itemId];
      if (itemId.toLowerCase().includes(term) || (item.name && item.name.toLowerCase().includes(term))) {
        results.push({ type: 'Inventory', title: item.name || itemId, subtitle: `Qty: ${item.qty || 0}`, href: '/inventory' });
      }
    });

    // Expenses
    const exps = Array.isArray(searchData.expenses) ? searchData.expenses : Object.values(searchData.expenses);
    exps.forEach((exp: any) => {
      if (exp.desc?.toLowerCase().includes(term) || exp.category?.toLowerCase().includes(term)) {
        results.push({ type: 'Expense', title: exp.desc, subtitle: `₹${exp.amount} - ${exp.category}`, href: '/expenses' });
      }
    });
    
    // limit results
    results = results.slice(0, 10);
  }

  return (
    <nav className="w-64 bg-panel border-r border-panel-border h-full flex flex-col z-50 relative">
      <div className="p-6 border-b border-panel-border flex items-center justify-center gap-3 bg-black">
        <img src="/app-logo.png" alt="Densum Logo" className="w-12 h-12 object-contain rounded-xl drop-shadow-[0_0_15px_rgba(0,194,255,0.4)]" />
        <h1 className="text-2xl font-bold text-accent-glow tracking-widest drop-shadow-[0_0_10px_rgba(0,194,255,0.5)]">DENSUM</h1>
      </div>
      
      <div className="p-4" ref={searchRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50" size={16} />
          <input 
            type="text" 
            placeholder="Search anything..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={handleSearchFocus}
            className="w-full bg-black/40 border border-panel-border rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-accent transition-colors shadow-inner"
          />
          
          {isSearching && searchTerm.trim() && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-panel border border-panel-border rounded-lg shadow-xl overflow-hidden z-50 max-h-60 overflow-y-auto custom-scrollbar">
              {results.length > 0 ? (
                <div className="py-2">
                  {results.map((res, i) => (
                    <div 
                      key={i} 
                      onClick={() => {
                        setIsSearching(false);
                        setSearchTerm('');
                        router.push(res.href);
                      }}
                      className="px-4 py-2 hover:bg-white/5 cursor-pointer border-b border-panel-border/30 last:border-0"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white text-sm truncate max-w-[120px]">{res.title}</span>
                        <span className="text-[10px] uppercase tracking-wider text-accent font-bold px-1.5 py-0.5 bg-accent/10 rounded">{res.type}</span>
                      </div>
                      <div className="text-xs text-foreground/50 truncate mt-0.5">{res.subtitle}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-foreground/50">No results found</div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 pb-6 flex flex-col gap-2 px-4 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300",
                isActive 
                  ? "bg-accent/15 text-accent-glow border border-accent/30 shadow-[0_0_20px_rgba(0,194,255,0.15)]" 
                  : "text-foreground/70 hover:text-foreground hover:bg-white/5 border border-transparent"
              )}
            >
              <Icon size={20} className={cn(isActive && "drop-shadow-[0_0_8px_rgba(0,194,255,0.8)]")} />
              <span className="font-medium tracking-wide">{item.name}</span>
            </Link>
          );
        })}
      </div>
      
      <div className="p-4 border-t border-panel-border/50 bg-black/20">
        <button
          onClick={() => {
            if(confirm('Are you sure you want to logout?')) {
               document.cookie = "auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
               window.location.href = '/login';
            }
          }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-300 font-medium tracking-wide"
        >
          <LogOut size={20} />
          Logout
        </button>
      </div>
    </nav>
  );
}
