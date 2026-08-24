"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Package, ReceiptIndianRupee, Settings } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Ledger', href: '/ledger', icon: Users },
  { name: 'Inventory', href: '/inventory', icon: Package },
  { name: 'Expenses', href: '/expenses', icon: ReceiptIndianRupee },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="w-64 bg-panel border-r border-panel-border h-screen flex flex-col fixed left-0 top-0 z-50">
      <div className="p-6 border-b border-panel-border flex items-center justify-center gap-3 bg-white/5">
        <img src="/app-logo.png" alt="Densum Logo" className="w-12 h-12 object-contain mix-blend-screen drop-shadow-[0_0_15px_rgba(0,194,255,0.4)]" />
        <h1 className="text-2xl font-bold text-accent-glow tracking-widest drop-shadow-[0_0_10px_rgba(0,194,255,0.5)]">DENSUM</h1>
      </div>
      <div className="flex-1 py-6 flex flex-col gap-2 px-4">
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
    </nav>
  );
}
