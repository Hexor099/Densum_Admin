"use client";

import { usePathname } from "next/navigation";
import { Navigation } from "./Navigation";
import { useStore } from "@/store/useStore";
import { useEffect } from "react";

export function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  const initializeStore = useStore((state) => state.initializeStore);

  useEffect(() => {
    if (!isLoginPage) {
      initializeStore();
    }
  }, [isLoginPage, initializeStore]);

  return (
    <>
      {!isLoginPage && <Navigation />}
      <main className={isLoginPage ? "w-full min-h-screen" : "flex-1 ml-64 p-8 min-h-screen"}>
        {children}
      </main>
    </>
  );
}
