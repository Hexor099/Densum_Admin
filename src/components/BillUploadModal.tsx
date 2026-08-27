"use client";

import { useState, useRef } from "react";
import { Camera, X, Loader2, FileCheck, AlertCircle, Building2 } from "lucide-react";
import { parseBillImageAction } from "@/app/actions/inventory";
import { fetchData, writeData } from "@/lib/firebase";
import { useEffect } from "react";

interface BillUploadModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedBill {
  invoiceNo: string;
  totalAmount: number;
  items: { name: string; qty: number; rate: number }[];
}

export function BillUploadModal({ onClose, onSuccess }: BillUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [fullDataUrl, setFullDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedBill, setParsedBill] = useState<ParsedBill | null>(null);
  const [customNote, setCustomNote] = useState<string>('');
  
  const [suppliers, setSuppliers] = useState<Record<string, any>>({});
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');

  useEffect(() => {
    async function loadSuppliers() {
      const supps = await fetchData('suppliers');
      if (supps) setSuppliers(supps);
    }
    loadSuppliers();
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));

      if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = (event) => {
          const img = new Image();
          img.src = event.target?.result as string;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1200;
            const MAX_HEIGHT = 1600;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            
            // compress to JPEG with 0.7 quality
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            setFullDataUrl(dataUrl);
            setBase64Image(dataUrl.split(',')[1]);
          };
        };
        reader.readAsDataURL(selectedFile);
      } else {
        // For PDFs or other types, just read directly
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          setFullDataUrl(base64String);
          const base64Data = base64String.split(',')[1];
          setBase64Image(base64Data);
        };
        reader.readAsDataURL(selectedFile);
      }
    }
  };

  const handleParse = async () => {
    if (!base64Image || !file) return;
    if (!selectedSupplier) return setError("Please select a supplier first.");

    setLoading(true);
    setError(null);
    
    try {
      const res = await parseBillImageAction(base64Image, file.type, customNote);
      if (res.success && res.data) {
        setParsedBill(res.data);
      } else {
        setError(res.error || "Failed to parse bill.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!parsedBill) return;
    setLoading(true);
    
    try {
      // Check for duplicate invoice
      if (parsedBill.invoiceNo && parsedBill.invoiceNo !== "Unknown") {
        const existingBills = await fetchData('bills');
        if (existingBills) {
          const isDuplicate = Object.values(existingBills).some(
            (b: any) => b.invoiceNo === parsedBill.invoiceNo
          );
          if (isDuplicate) {
            setError(`Invoice #${parsedBill.invoiceNo} has already been scanned and added to inventory!`);
            setLoading(false);
            return;
          }
        }
      }

      // Process all items concurrently for speed
      await Promise.all(parsedBill.items.map(async (item) => {
        // Simple ID generation for new items based on name
        const itemId = item.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        
        // Fetch existing data to add quantity instead of overwriting
        const existingData = await fetchData(`lab_catalog/${itemId}`);
        const currentQty = existingData?.qty || 0;
        const existingBarcode = existingData?.barcode;
        
        const stockData = {
          name: item.name,
          qty: currentQty + item.qty, // Add the new quantity to the existing quantity
          last_purchase_rate: item.rate,
          min_limit: existingData?.min_limit || 5, // preserve existing min_limit or default to 5
          barcode: existingBarcode || Math.floor(100000000000 + Math.random() * 900000000000).toString() // Preserve existing barcode or generate new
        };

        // Write to catalog
        await writeData(`lab_catalog/${itemId}`, stockData);
        
        // Log history
        const histId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
        await writeData(`inventory_history/${histId}`, {
          item: item.name,
          change: item.qty,
          date: new Date().toISOString().replace('T', ' ').substring(0, 16),
          user: 'Admin (Bill Upload)'
        });
      }));

      // Save the bill metadata
      const billId = Date.now().toString();
      const supplierName = suppliers[selectedSupplier]?.name || 'Unknown Supplier';

      await writeData(`bills/${billId}`, {
        date: new Date().toISOString(),
        invoiceNo: parsedBill.invoiceNo,
        supplierId: selectedSupplier,
        supplierName: supplierName,
        totalAmount: parsedBill.totalAmount,
        items: parsedBill.items,
        image: fullDataUrl // Use the exact original data URL
      });

      // Update Supplier Ledger and Balance
      const currentSupplier = suppliers[selectedSupplier];
      if (currentSupplier) {
        const newTx = {
          id: Date.now().toString(),
          date: new Date().toISOString().split('T')[0],
          type: 'Bill',
          amount: parsedBill.totalAmount || 0, // positive amount increases debt
          refNumber: parsedBill.invoiceNo
        };
        const suppLedger = await fetchData(`supplier_ledger/${selectedSupplier}`) || [];
        await writeData(`supplier_ledger/${selectedSupplier}`, [...suppLedger, newTx]);
        await writeData(`suppliers/${selectedSupplier}/balance`, (Number(currentSupplier.balance) || 0) + (parsedBill.totalAmount || 0));
      }

      // Add to Expenses
      const rawExpenses = await fetchData('expenses');
      const currentExpenses = Array.isArray(rawExpenses) ? rawExpenses : (rawExpenses ? Object.values(rawExpenses) : []);
      
      const newExpense = {
        id: Date.now(),
        date: new Date().toISOString().split('T')[0],
        category: "Inventory Purchase",
        amount: parsedBill.totalAmount || 0,
        desc: `Bill from ${supplierName} (Invoice #${parsedBill.invoiceNo || 'Unknown'})`
      };
      await writeData('expenses', [...currentExpenses, newExpense]);

      onSuccess();
    } catch (err: any) {
      setError("Failed to save inventory to database: " + err.message);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-panel border border-panel-border rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-panel-border/50 bg-black/20">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Camera className="text-accent" /> Scan Purchase Bill
          </h2>
          <button onClick={onClose} className="text-foreground/50 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
          {!parsedBill ? (
            <div className="space-y-6">
              <p className="text-foreground/70">
                Upload an image of a purchase bill/receipt. Our AI will automatically extract the items and quantities to update your inventory.
              </p>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                  <Building2 size={16} className="text-accent" /> Select Supplier *
                </label>
                <select 
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className="w-full bg-black/40 border border-panel-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent"
                >
                  <option value="">-- Choose Supplier --</option>
                  {Object.values(suppliers).map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {Object.keys(suppliers).length === 0 && (
                  <p className="text-xs text-yellow-400 mt-1">No suppliers found. Please add a supplier first in the Suppliers page.</p>
                )}
              </div>

              <div 
                className="border-2 border-dashed border-panel-border rounded-xl p-8 text-center hover:border-accent/50 hover:bg-white/5 transition-all cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                {previewUrl ? (
                  <div className="relative w-full max-w-sm mx-auto aspect-[3/4] rounded-lg overflow-hidden border border-panel-border shadow-lg bg-black/20 flex flex-col items-center justify-center">
                    {file?.type === "application/pdf" ? (
                      <div className="flex flex-col items-center justify-center text-accent h-full p-6">
                        <FileCheck size={64} className="mb-4" />
                        <span className="font-bold text-lg text-center break-all">{file.name}</span>
                        <span className="text-sm text-white/50 mt-2">PDF Document Ready</span>
                      </div>
                    ) : (
                      <img src={previewUrl} alt="Bill Preview" className="object-cover w-full h-full" />
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <p className="text-white font-bold">Change Image</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 py-10">
                    <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
                      <Camera size={32} className="text-accent" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">Click to upload an image or PDF</p>
                      <p className="text-sm text-foreground/50 mt-1">Supports JPG, PNG, WebP, PDF</p>
                    </div>
                  </div>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="image/*,application/pdf" 
                  className="hidden" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">Custom Instructions for AI (Optional)</label>
                <textarea 
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="E.g., Ignore shipping fees, treat 'AquaZ' as 'Aquazir White Blank', etc."
                  className="w-full bg-black/40 border border-panel-border rounded-xl px-4 py-3 text-white placeholder-foreground/40 focus:outline-none focus:border-accent resize-none h-20"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
              <div className="flex items-center justify-between gap-3 text-green-400 bg-green-500/10 border border-green-500/20 p-4 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileCheck size={24} />
                  <div>
                    <p className="font-medium">Successfully extracted {parsedBill.items.length} items.</p>
                    <p className="text-sm opacity-80">Invoice #: {parsedBill.invoiceNo}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm opacity-80">Total Amount</p>
                  <p className="font-bold text-lg">₹{parsedBill.totalAmount?.toLocaleString()}</p>
                </div>
              </div>

              <div className="bg-black/20 border border-panel-border rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-foreground/60 uppercase bg-black/40">
                    <tr>
                      <th className="px-6 py-3">Item Name</th>
                      <th className="px-6 py-3 text-center">Rate</th>
                      <th className="px-6 py-3 text-center">Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedBill.items.map((item, idx) => (
                      <tr key={idx} className="border-b border-panel-border/30 last:border-0">
                        <td className="px-6 py-3 font-medium text-white">{item.name}</td>
                        <td className="px-6 py-3 text-center text-foreground/80">₹{item.rate?.toLocaleString()}</td>
                        <td className="px-6 py-3 text-center font-bold text-accent">{item.qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-foreground/50 text-center">
                Confirming will add these items to your lab catalog and log them in your usage history.
              </p>
            </div>
          )}
          
          {error && (
            <div className="mt-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-3 animate-in fade-in zoom-in-95">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <p className="text-sm break-words flex-1">{error}</p>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-panel-border/50 bg-black/20 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 text-foreground/70 font-medium hover:text-white transition-colors"
            disabled={loading}
          >
            Cancel
          </button>

          {!parsedBill ? (
            <button
              onClick={handleParse}
              disabled={!file || loading}
              className="px-5 py-2.5 bg-accent text-panel font-bold rounded-lg hover:bg-accent-glow transition-all shadow-[0_0_15px_rgba(0,194,255,0.4)] disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <><Loader2 size={18} className="animate-spin" /> Analyzing Bill...</>
              ) : (
                "Extract Items via AI"
              )}
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="px-5 py-2.5 bg-green-500 text-white font-bold rounded-lg hover:bg-green-400 transition-all shadow-[0_0_15px_rgba(34,197,94,0.4)] disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <><Loader2 size={18} className="animate-spin" /> Saving...</>
              ) : (
                "Confirm & Update Inventory"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
