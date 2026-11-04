import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// ─── Shared Utilities ────────────────────────────────────────────────────────

/** Tailwind class merger (clsx + twMerge) */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Case-insensitive and punctuation-tolerant key accessor for Excel row objects.
 * Finds the first key in `row` that matches any of `possibleKeys`, prioritizing non-empty values.
 */
export function getVal(row: Record<string, any>, possibleKeys: string[]): any {
  if (!row || typeof row !== 'object') return undefined;

  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

  const matchingKeys = Object.keys(row).filter(k =>
    possibleKeys.some(pk => k.trim().toLowerCase() === pk.trim().toLowerCase() || clean(k) === clean(pk))
  );

  // Return the first matching key with a non-empty, non-null value
  for (const k of matchingKeys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
      return row[k];
    }
  }

  return matchingKeys.length > 0 ? row[matchingKeys[0]] : undefined;
}

export function parsePalmerNotation(teethStr: string) {
  if (!teethStr) return { left: '-', right: '', hasFDI: false };
  
  const q1: string[] = [], q2: string[] = [], q3: string[] = [], q4: string[] = [];
  const matches = String(teethStr).match(/\d+/g) || [];
  
  let hasFDI = false;
  
  matches.forEach(t => {
    if (t.length === 2) {
      const quad = t[0];
      const tooth = t[1];
      if (tooth >= '1' && tooth <= '8' && quad >= '1' && quad <= '4') {
        hasFDI = true;
        if (quad === '1' && !q1.includes(tooth)) q1.push(tooth);
        else if (quad === '2' && !q2.includes(tooth)) q2.push(tooth);
        else if (quad === '3' && !q3.includes(tooth)) q3.push(tooth);
        else if (quad === '4' && !q4.includes(tooth)) q4.push(tooth);
      }
    }
  });

  if (!hasFDI) {
    return { left: String(teethStr), right: '', hasFDI: false };
  }

  q1.sort((a, b) => b.localeCompare(a));
  q4.sort((a, b) => b.localeCompare(a));
  
  q2.sort((a, b) => a.localeCompare(b));
  q3.sort((a, b) => a.localeCompare(b));

  const topL = q1.length ? q1.join('') : ' ';
  const botL = q4.length ? q4.join('') : ' ';
  const topR = q2.length ? q2.join('') : ' ';
  const botR = q3.length ? q3.join('') : ' ';

  return {
    left: `${topL}\n${botL}`,
    right: `${topR}\n${botR}`,
    hasFDI: true
  };
}

/** Generate a unique ID using crypto.randomUUID with a timestamp prefix */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 10);
}

/** Parses a date string into a Date object for sorting */
export function parseDateString(val: string | undefined | null): Date {
  if (!val) return new Date(0);
  const str = String(val).trim();
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return new Date(str);
  }
  
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      let [m, d, y] = parts;
      if (y.length === 2) y = '20' + y;
      return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
    }
  }
  
  if (str.includes('-')) {
     const parts = str.split('-');
     if (parts.length === 3) {
       let day = parseInt(parts[0], 10);
       let month = parseInt(parts[1], 10);
       let year = parseInt(parts[2], 10);
       if (year < 100) year += 2000;
       
       if (day <= 31 && month <= 12) {
         return new Date(year, month - 1, day);
       }
     }
  }
  
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;
  
  return new Date(0);
}

/** Formats a date for display consistently as M/D/YY */
export function formatDateForDisplay(val: string | undefined | null): string {
  if (!val || val === 'Not Delivered' || val === 'Unknown') return val || '';
  const str = String(val).trim();
  const d = parseDateString(str);
  if (d.getTime() === 0) return str;
  
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear().toString().slice(-2)}`;
}

// ─── TypeScript Interfaces ───────────────────────────────────────────────────

/**
 * Checks whether a material name corresponds to Flexible RPD.
 * Handles variations like:
 * - "Flexible RPD", "flexible rpd", "Flexible Rpd", "FLEXIBLE RPD"
 * - "Flexible (RPD)", "Flexible - RPD", "Flexible R.P.D."
 * - "RPD Flexible", "Flex RPD", "Flexible"
 * (Explicitly excludes Denture)
 */
export function isFlexibleRPD(material: string | undefined | null): boolean {
  if (!material) return false;
  const str = String(material).trim().toLowerCase();
  
  // Do not include any Denture items
  if (str.includes('denture')) return false;

  const clean = str.replace(/[^a-z0-9]/g, '');
  if (clean.includes('flexiblerpd') || clean.includes('rpdflexible')) return true;
  if (str.includes('flexible') && str.includes('rpd')) return true;
  if (str.includes('flex') && str.includes('rpd')) return true;
  if (clean === 'flexible') return true;
  
  return false;
}

/**
 * Finds custom material rate from a doctor's prices object.
 * Tolerant to case and punctuation differences.
 */
export function findDoctorPrice(docPrices: Record<string, any> | undefined | null, material: string): number {
  if (!docPrices || !material) return 0;

  // Direct key match
  if (typeof docPrices[material] === 'number') return docPrices[material];
  if (docPrices[material] && typeof docPrices[material] === 'object' && docPrices[material].rate !== undefined) {
    const r = Number(docPrices[material].rate);
    if (!isNaN(r)) return r;
  }

  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanMaterial = clean(material);

  // Case/punctuation-tolerant match on keys
  for (const [key, val] of Object.entries(docPrices)) {
    if (clean(key) === cleanMaterial) {
      if (typeof val === 'number') return val;
      if (val && typeof val === 'object' && val.rate !== undefined) {
        const r = Number(val.rate);
        if (!isNaN(r)) return r;
      }
    }
  }

  // Case/punctuation-tolerant match on val.name
  for (const val of Object.values(docPrices)) {
    if (val && typeof val === 'object' && val.name && clean(String(val.name)) === cleanMaterial) {
      const r = Number(val.rate);
      if (!isNaN(r)) return r;
    }
  }

  // If this is Flexible RPD, check if any doctor price is also Flexible RPD variant
  if (isFlexibleRPD(material)) {
    for (const [key, val] of Object.entries(docPrices)) {
      const name = val && typeof val === 'object' && val.name ? String(val.name) : key;
      if (isFlexibleRPD(name)) {
        const r = typeof val === 'number' ? val : Number(val?.rate);
        if (!isNaN(r) && r > 0) return r;
      }
    }
  }

  return 0;
}

/**
 * Calculates the rate and total amount for a lab work row.
 * For Flexible RPD:
 *  - 1 unit is ₹1,500 (or custom doctor base rate if configured)
 *  - Each additional unit adds ₹150: baseRate + (units - 1) * 150
 * For other materials:
 *  - total = units * rate
 */
export function calculateItemTotal(
  material: string,
  units: number,
  docPrices?: Record<string, any> | null,
  status?: string
): { rate: number; total: number } {
  const isHold = (status || '').trim().toLowerCase() === 'hold';
  const customRate = findDoctorPrice(docPrices, material);

  if (isFlexibleRPD(material)) {
    const baseRate = customRate > 0 ? customRate : 1500;
    const rate = baseRate;
    if (isHold || units <= 0) {
      return { rate, total: 0 };
    }
    const total = baseRate + Math.max(0, units - 1) * 150;
    return { rate, total };
  }

  const rate = customRate;
  const total = isHold || units <= 0 ? 0 : (units * rate);
  return { rate, total };
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
