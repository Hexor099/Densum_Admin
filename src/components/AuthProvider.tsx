"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, fetchData, writeData } from "@/lib/firebase";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface AuthContextType {
  user: User | null;
  role: 'admin' | 'staff' | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, role: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export const restrictedForStaff = [
  '/',
  '/ledger',
  '/aging-report',
  '/bank-book',
  '/purchases',
  '/expenses',
  '/gst-returns',
  '/financial-statements',
  '/inventory',
  '/suppliers',
  '/settings'
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'staff' | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      let currentRole = null;
      if (currentUser) {
        try {
          const usersData = await fetchData("users");
          currentRole = usersData?.[currentUser.uid]?.role;
          
          if (!currentRole) {
            // First user to log in becomes admin, others become staff
            if (!usersData || Object.keys(usersData).length === 0) {
              currentRole = 'admin';
              await writeData(`users/${currentUser.uid}`, { role: 'admin', email: currentUser.email });
            } else {
              currentRole = 'staff';
              await writeData(`users/${currentUser.uid}`, { role: 'staff', email: currentUser.email });
            }
          }
          setRole(currentRole);
        } catch (e) {
          console.error("Failed to fetch role", e);
          currentRole = 'staff';
          setRole('staff');
        }
      } else {
        setRole(null);
      }

      setUser(currentUser);
      setLoading(false);
      
      if (!currentUser && pathname !== "/login") {
        router.push("/login");
      } else if (currentUser && pathname === "/login") {
        if (currentRole === 'staff') {
          router.push("/job-work");
        } else {
          router.push("/");
        }
      }
    });

    return () => unsubscribe();
  }, [pathname, router]);

  // Route protection for staff
  useEffect(() => {
    if (!loading && user && role === 'staff') {
      if (restrictedForStaff.includes(pathname)) {
        router.push("/job-work");
      }
    }
  }, [pathname, user, role, loading, router]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background text-white">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-accent" />
          <p className="text-foreground/70 font-medium tracking-wide">Authenticating...</p>
        </div>
      </div>
    );
  }

  // If not logged in and not on login page, don't render children (redirect will happen)
  if (!user && pathname !== "/login") {
    return null; 
  }

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
