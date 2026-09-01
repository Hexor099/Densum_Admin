"use client";

import { useState, useEffect, useRef } from "react";
import { X, Plus, Save, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { fetchData, appendToList } from "@/lib/firebase";
import { useStore } from "@/store/useStore";

interface AddEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  sheets: { id: string; name: string }[];
  activeSheetId: string | null;
  onSave: (doctorName: string, entry: any) => void;
  onAddDoctor: (name: string) => void;
}

export function AddEntryModal({
  isOpen,
  onClose,
  sheets,
  activeSheetId,
  onSave,
  onAddDoctor,
}: AddEntryModalProps) {
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [isAddingDoctor, setIsAddingDoctor] = useState(false);
  const [newDoctorName, setNewDoctorName] = useState("");
  
  const doctorsData = useStore(state => state.doctors);
  const catalog = useStore(state => state.catalog);

  const [receivedDate, setReceivedDate] = useState("");
  const [deliveredDate, setDeliveredDate] = useState("");
  const [patientName, setPatientName] = useState("");
  const [toothNo, setToothNo] = useState("");
  const [workMaterial, setWorkMaterial] = useState("");
  const [units, setUnits] = useState("");
  const [status, setStatus] = useState("Active");

  const [materialSuggestions, setMaterialSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Set default doctor based on active sheet
      if (activeSheetId) {
        const activeSheet = sheets.find((s) => s.id === activeSheetId);
        if (activeSheet) setSelectedDoctor(activeSheet.name);
      } else if (sheets.length > 0) {
        setSelectedDoctor(sheets[0].name);
      }

      // Default dates and status
      const today = new Date().toISOString().split("T")[0];
      setReceivedDate(today);
      setDeliveredDate(""); // Clear by default
      setStatus("Active");

      // Extract existing materials from doctors' prices to populate suggestions immediately
      const defaultMaterials = new Set<string>();
      
      // From Doctors
      Object.values(doctorsData || {}).forEach((doc: any) => {
        if (doc?.prices) {
          Object.keys(doc.prices).forEach(mat => defaultMaterials.add(mat));
        }
      });

      // Load material suggestions from Firebase list (user added)
      fetchData("settings/work_materials").then((data) => {
        if (data) {
          const list = Array.isArray(data) ? data : Object.values(data);
          list.forEach(m => defaultMaterials.add(m as string));
        }
        setMaterialSuggestions(Array.from(defaultMaterials));
      });
    }
  }, [isOpen, activeSheetId, sheets, doctorsData]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const handleSave = async () => {
    let finalDoctor = selectedDoctor;

    if (isAddingDoctor) {
      if (!newDoctorName.trim()) {
        toast.error("Please enter a new doctor name.");
        return;
      }
      finalDoctor = newDoctorName.trim();
      onAddDoctor(finalDoctor);
    } else {
      if (!finalDoctor) {
        toast.error("Please select a doctor.");
        return;
      }
    }

    if (!patientName.trim()) {
      toast.error("Please enter the patient name.");
      return;
    }

    if (!units || isNaN(Number(units))) {
      toast.error("Please enter a valid number of units.");
      return;
    }

    // Check if work material is new
    if (workMaterial.trim() && !materialSuggestions.includes(workMaterial.trim())) {
      await appendToList("settings/work_materials", workMaterial.trim());
      setMaterialSuggestions((prev) => [...prev, workMaterial.trim()]);
    }

    const entry = {
      "Received Date": receivedDate,
      "Delivered Date": deliveredDate,
      "Patient Name": patientName,
      "Tooth No": toothNo,
      "Work material": workMaterial,
      "Units": Number(units),
      "Status": status,
    };

    onSave(finalDoctor, entry);
    
    // Reset form fields
    setPatientName("");
    setToothNo("");
    setWorkMaterial("");
    setUnits("");
    setStatus("Active");
    setIsAddingDoctor(false);
    setNewDoctorName("");
    toast.success("Entry added successfully!");
  };

  const filteredSuggestions = materialSuggestions.filter(m => m.toLowerCase().includes(workMaterial.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-panel border border-panel-border rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b border-panel-border">
          <h2 className="text-xl font-bold text-white">Add New Lab Entry</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          {/* Doctor Selection Row */}
          <div className="bg-black/20 p-4 rounded-lg border border-white/5">
            <label className="block text-sm font-semibold text-white/70 mb-2 uppercase tracking-wider">
              Doctor
            </label>
            {!isAddingDoctor ? (
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <select
                    value={selectedDoctor}
                    onChange={(e) => setSelectedDoctor(e.target.value)}
                    className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accent font-medium shadow-sm appearance-none"
                  >
                    <option value="" disabled>Select a doctor...</option>
                    {sheets.map((sheet) => (
                      <option key={sheet.id} value={sheet.name}>
                        {sheet.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" size={18} />
                </div>
                <button
                  onClick={() => setIsAddingDoctor(true)}
                  className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 hover:text-white text-white/70 flex items-center gap-2 transition-colors"
                >
                  <Plus size={18} />
                  New Doctor
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Enter new doctor name..."
                  value={newDoctorName}
                  onChange={(e) => setNewDoctorName(e.target.value)}
                  className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accent font-medium shadow-sm"
                  autoFocus
                />
                <button
                  onClick={() => {
                    setIsAddingDoctor(false);
                    setNewDoctorName("");
                  }}
                  className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-white/70 mb-1">Received Date</label>
              <input
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-white/70 mb-1">Delivered Date</label>
              <input
                type="date"
                value={deliveredDate}
                onChange={(e) => setDeliveredDate(e.target.value)}
                className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accent"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-white/70 mb-1">Patient Name *</label>
              <input
                type="text"
                placeholder="Enter patient name..."
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-white/70 mb-1">Tooth No</label>
              <input
                type="text"
                placeholder="e.g. 11, 12, 13"
                value={toothNo}
                onChange={(e) => setToothNo(e.target.value)}
                className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accent"
              />
            </div>
            
            <div className="relative" ref={suggestionsRef}>
              <label className="block text-sm font-semibold text-white/70 mb-1">Work Material</label>
              <input
                type="text"
                placeholder="e.g. PFM, Zirconia..."
                value={workMaterial}
                onChange={(e) => {
                  setWorkMaterial(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accent"
              />
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#0a111a] border border-panel-border rounded-lg shadow-xl overflow-hidden z-50 max-h-40 overflow-y-auto custom-scrollbar">
                  {filteredSuggestions.map((suggestion, i) => (
                    <div
                      key={i}
                      onClick={() => {
                        setWorkMaterial(suggestion);
                        setShowSuggestions(false);
                      }}
                      className="px-4 py-2 hover:bg-white/5 cursor-pointer border-b border-panel-border/30 last:border-0 text-white text-sm"
                    >
                      {suggestion}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-white/70 mb-1">Units *</label>
              <input
                type="number"
                min="1"
                placeholder="Enter units..."
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-white/70 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accent appearance-none"
              >
                <option value="Active">Active</option>
                <option value="Delivered">Delivered</option>
                <option value="Repeat">Repeat</option>
              </select>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-panel-border bg-black/20 flex justify-end gap-3 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-white/70 font-medium rounded-lg hover:text-white hover:bg-white/5 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2.5 bg-accent text-panel font-bold rounded-lg hover:bg-accent-glow transition-all shadow-[0_0_15px_rgba(0,194,255,0.4)] flex items-center gap-2"
          >
            <Save size={18} />
            Save Entry
          </button>
        </div>
      </div>
    </div>
  );
}
