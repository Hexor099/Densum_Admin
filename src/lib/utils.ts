import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// ─── Shared Utilities ────────────────────────────────────────────────────────

/** Tailwind class merger (clsx + twMerge) */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Case-insensitive key accessor for Excel row objects.
 * Finds the first key in `row` that matches any of `possibleKeys`.
 */
export function getVal(row: Record<string, any>, possibleKeys: string[]): any {
  const foundKey = Object.keys(row).find(k =>
    possibleKeys.some(pk => k.trim().toLowerCase() === pk.toLowerCase())
  );
  return foundKey ? row[foundKey] : undefined;
}

/** Generate a unique ID using crypto.randomUUID with a timestamp prefix */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 10);
}

// ─── TypeScript Interfaces ───────────────────────────────────────────────────

export interface Doctor {
  balance: number;
  phone?: string;
  address?: string;
  state?: string;
  gstin?: string;
  prices?: Record<string, number>;
}

export interface Transaction {
  id: string | number;
  date: string;
  type: 'Payment' | 'Bill' | 'Credit Note' | 'Debit Note' | 'Invoice Generated' | 'Invoice' | 'Charge';
  amount: number;
  description?: string;
  paymentMode?: string | null;
  refNumber?: string | null;
  cleared?: boolean;
}

export interface Expense {
  id: string | number;
  date: string;
  category: string;
  amount: number;
  desc: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  qty: number;
  min_limit?: number;
  last_purchase_rate?: number;
  supplierId?: string;
  barcode?: string;
}

export interface HistoryEntry {
  id: string;
  item: string;
  change: number;
  date: string;
  user: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  gstin: string;
  address: string;
  balance: number;
}

export interface ParsedBill {
  invoiceNo: string;
  billDate?: string;
  totalAmount: number;
  items: { name: string; qty: number; rate: number }[];
}

export interface Bill {
  id: string;
  date: string;
  invoiceNo: string;
  supplierId: string;
  supplierName: string;
  totalAmount: number;
  items: { name: string; qty: number; rate: number }[];
  image?: string;
}

export interface LabSettings {
  labName: string;
  gstin: string;
  address: string;
  state: string;
  hsnCode: string;
  invoiceSequence: number;
  gstRate: number;
  recurring_expenses?: Record<string, RecurringExpense>;
}

export interface RecurringExpense {
  id: string;
  desc: string;
  category: string;
  amount: number;
  dayOfMonth: number;
}

export interface AgingBuckets {
  '0_30': number;
  '31_60': number;
  '61_90': number;
  '90_plus': number;
}

export interface AgingReportEntry {
  docId: string;
  docName: string;
  phone?: string;
  totalOutstanding: number;
  buckets: AgingBuckets;
}
