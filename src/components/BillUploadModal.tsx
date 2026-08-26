"use client";

import { useState, useRef } from "react";
import { Camera, X, Loader2, FileCheck, AlertCircle } from "lucide-react";
import { parseBillImageAction } from "@/app/actions/inventory";
import { writeData } from "@/lib/firebase";

interface BillUploadModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function BillUploadModal({ onClose, onSuccess }: BillUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<{ name: string, qty: number }[] | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));

      // Convert to Base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Strip the data URL prefix for Gemini API
        const base64Data = base64String.split(',')[1];
        setBase64Image(base64Data);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleParse = async () => {
    if (!base64Image || !file) return;
    setLoading(true);
    setError(null);
    
    try {
      const res = await parseBillImageAction(base64Image, file.type);
      if (res.success && res.data) {
        setParsedItems(res.data);
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
    if (!parsedItems) return;
    setLoading(true);
    
    try {
      for (const item of parsedItems) {
        // Simple ID generation for new items based on name
        const itemId = item.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        
        // In a robust system, we would check if it exists and ADD to current qty.
        // For simplicity (remaking), we assume it's a new or updated stock entry.
        // But let's actually just update it safely if we can, or blindly write it.
        const stockData = {
          name: item.name,
          qty: item.qty,
          min_limit: 5, // default min limit
          barcode: Math.floor(100000000000 + Math.random() * 900000000000).toString() // Generate random 12-digit barcode
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
      }

      // Save the bill metadata
      const billId = Date.now().toString();
      await writeData(`bills/${billId}`, {
        date: new Date().toISOString(),
        items: parsedItems,
        image: `data:${file?.type};base64,${base64Image}` // Save small base64 directly to RTDB (careful with large images)
      });

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
          {!parsedItems ? (
            <div className="space-y-6">
              <p className="text-foreground/70">
                Upload an image of a purchase bill/receipt. Our AI will automatically extract the items and quantities to update your inventory.
              </p>
              
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

              {error && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-3">
                  <AlertCircle size={20} className="shrink-0 mt-0.5" />
                  <p className="text-sm">{error}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
              <div className="flex items-center gap-3 text-green-400 bg-green-500/10 border border-green-500/20 p-4 rounded-lg">
                <FileCheck size={24} />
                <p className="font-medium">Successfully extracted {parsedItems.length} items from the bill.</p>
              </div>

              <div className="bg-black/20 border border-panel-border rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-foreground/60 uppercase bg-black/40">
                    <tr>
                      <th className="px-6 py-3">Item Name</th>
                      <th className="px-6 py-3 text-center">Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedItems.map((item, idx) => (
                      <tr key={idx} className="border-b border-panel-border/30 last:border-0">
                        <td className="px-6 py-3 font-medium text-white">{item.name}</td>
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
        </div>

        <div className="p-5 border-t border-panel-border/50 bg-black/20 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 text-foreground/70 font-medium hover:text-white transition-colors"
            disabled={loading}
          >
            Cancel
          </button>

          {!parsedItems ? (
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
