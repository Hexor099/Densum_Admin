"use client";

import { useState, useEffect } from 'react';
import { Users, Shield, ShieldCheck, Mail, Lock, Plus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { fetchData, writeData, firebaseConfig } from '@/lib/firebase';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';

export function UserManagement() {
  const [users, setUsers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'staff'>('staff');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    const data = await fetchData('users');
    if (data) {
      setUsers(data);
    }
    setLoading(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please provide both email and password");
      return;
    }
    
    setIsCreating(true);
    
    try {
      // Create secondary app to avoid logging out the current admin
      let secondaryApp;
      if (!getApps().some(app => app.name === "Secondary")) {
        secondaryApp = initializeApp(firebaseConfig, "Secondary");
      } else {
        secondaryApp = getApp("Secondary");
      }
      
      const secondaryAuth = getAuth(secondaryApp);
      
      // Create the user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const newUid = userCredential.user.uid;
      
      // Save their role in our Realtime Database
      await writeData(`users/${newUid}`, {
        email,
        role
      });
      
      // Sign out of the secondary instance
      await signOut(secondaryAuth);
      
      toast.success("User created successfully!");
      
      // Reset form and reload list
      setEmail('');
      setPassword('');
      setRole('staff');
      await loadUsers();
      
    } catch (err: any) {
      toast.error(`Error creating user: ${err.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleRole = async (uid: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'staff' : 'admin';
    if (!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) return;
    
    try {
      await writeData(`users/${uid}/role`, newRole);
      toast.success("Role updated successfully!");
      await loadUsers();
    } catch (err: any) {
      toast.error(`Failed to update role: ${err.message}`);
    }
  };

  return (
    <div className="bg-panel rounded-xl border border-panel-border p-8 shadow-lg">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-panel-border/50">
        <div className="flex items-center gap-3">
          <Users size={24} className="text-accent" />
          <div>
            <h2 className="text-xl font-bold text-white">User Management</h2>
            <p className="text-xs text-foreground/60 mt-1">Manage admin and staff accounts</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Create User Form */}
        <div className="lg:col-span-1 bg-black/20 p-5 rounded-xl border border-panel-border">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Plus size={16} className="text-accent" /> Add New User
          </h3>
          
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-foreground/70 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40 w-4 h-4" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/40 border border-panel-border rounded-lg pl-9 pr-3 py-2 text-white focus:outline-none focus:border-accent text-sm"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-foreground/70 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40 w-4 h-4" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  className="w-full bg-black/40 border border-panel-border rounded-lg pl-9 pr-3 py-2 text-white focus:outline-none focus:border-accent text-sm"
                  required
                />
              </div>
              <p className="text-[10px] text-foreground/50 mt-1">Minimum 6 characters.</p>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-foreground/70 mb-1">Role</label>
              <select 
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full bg-black/40 border border-panel-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-accent text-sm"
              >
                <option value="staff">Staff (Restricted Access)</option>
                <option value="admin">Admin (Full Access)</option>
              </select>
            </div>
            
            <button 
              type="submit" 
              disabled={isCreating}
              className="w-full mt-2 py-2.5 bg-accent/20 text-accent font-bold rounded-lg hover:bg-accent/30 transition-colors flex justify-center items-center gap-2 text-sm border border-accent/20"
            >
              {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Create User
            </button>
          </form>
        </div>

        {/* Users List */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(users).map(([uid, user]) => (
                <div key={uid} className="flex flex-col sm:flex-row justify-between sm:items-center bg-black/30 border border-panel-border rounded-xl p-4 gap-4 transition-colors hover:border-panel-border/80">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${
                      user.role === 'admin' ? 'bg-accent/10 border-accent/30 text-accent' : 'bg-white/5 border-white/10 text-foreground'
                    }`}>
                      {user.role === 'admin' ? <ShieldCheck size={18} /> : <Shield size={18} />}
                    </div>
                    <div>
                      <div className="font-semibold text-white text-sm">{user.email}</div>
                      <div className="text-xs text-foreground/50 mt-0.5 font-mono">{uid.substring(0, 10)}...</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <span className={`px-2.5 py-1 text-xs font-bold rounded-md border uppercase tracking-wider ${
                      user.role === 'admin' 
                        ? 'bg-accent/10 text-accent border-accent/20' 
                        : 'bg-white/5 text-foreground/70 border-white/10'
                    }`}>
                      {user.role}
                    </span>
                    
                    <button 
                      onClick={() => handleToggleRole(uid, user.role)}
                      className="text-xs font-medium text-foreground/70 hover:text-white px-3 py-1.5 bg-black/40 hover:bg-white/10 border border-panel-border rounded-md transition-colors"
                    >
                      Change Role
                    </button>
                  </div>
                </div>
              ))}
              {Object.keys(users).length === 0 && (
                <div className="text-center p-8 text-foreground/50 border border-dashed border-panel-border rounded-xl">
                  No users found in database.
                </div>
              )}
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
