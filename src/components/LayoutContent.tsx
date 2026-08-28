"use client";

import { usePathname } from "next/navigation";
import { Navigation } from "./Navigation";
import { useStore } from "@/store/useStore";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

export function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  const initializeStore = useStore((state) => state.initializeStore);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLoginPage) {
      initializeStore();
    }
  }, [isLoginPage, initializeStore]);

  // Close menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <>
      {!isLoginPage && (
        <>
          {/* Mobile Menu Button */}
          <button 
            className="md:hidden fixed top-4 right-4 z-[60] p-2 bg-panel border border-panel-border rounded-lg text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          
          {/* Overlay for mobile */}
          {mobileMenuOpen && (
            <div 
              className="md:hidden fixed inset-0 bg-black/60 z-[45] backdrop-blur-sm" 
              onClick={() => setMobileMenuOpen(false)}
            />
          )}

          <div className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <Navigation />
          </div>
        </>
      )}
      <main className={isLoginPage ? "w-full min-h-screen" : "flex-1 md:ml-64 p-4 md:p-8 min-h-screen pt-20 md:pt-8"}>
        {children}
      </main>
    </>
  );
}
