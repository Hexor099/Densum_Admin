"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Save, ChevronDown, X } from "lucide-react";
import { toast } from "sonner";
import { fetchData, appendToList, writeData } from "@/lib/firebase";
import { useStore } from "@/store/useStore";

export default function JobWorkPage() {
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [isAddingDoctor, setIsAddingDoctor] = useState(false);
  const [newDoctorName, setNewDoctorName] = useState("");
  
  const doctorsData = useStore(state => state.doctors);
  const procuredData = useStore(state => state.procuredData);
  
  const [receivedDate, setReceivedDate] = useState("");
  const [deliveredDate, setDeliveredDate] = useState("");
  const [patientName, setPatientName] = useState("");
  const [location, setLocation] = useState("");
  const [shade, setShade] = useState("");
  
  interface WorkItem {
    toothNo: string;
    workMaterial: string;
    units: string;
  }
  const [workItems, setWorkItems] = useState<WorkItem[]>([{ toothNo: "", workMaterial: "", units: "" }]);
  
  const [status, setStatus] = useState("Procured");

  const [materialSuggestions, setMaterialSuggestions] = useState<string[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Default dates and status
    const today = new Date().toISOString().split("T")[0];
    setReceivedDate(today);
    setDeliveredDate(""); // Clear by default
    setStatus("Active");
    setWorkItems([{ toothNo: "", workMaterial: "", units: "" }]);
    setActiveSuggestionIndex(null);

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
  }, [doctorsData]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setActiveSuggestionIndex(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const doctorOptions = Object.keys(doctorsData || {});

  const handleSave = async () => {
    let finalDoctor = selectedDoctor;

    if (isAddingDoctor) {
      if (!newDoctorName.trim()) {
        toast.error("Please enter a new doctor name.");
        return;
      }
      finalDoctor = newDoctorName.trim();
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

    for (const item of workItems) {
      if (!item.units || isNaN(Number(item.units))) {
        toast.error("Please enter a valid number of units for all work materials.");
        return;
      }
      if (!item.workMaterial.trim()) {
        toast.error("Please specify the work material for all items.");
        return;
      }
      if (item.workMaterial.trim() && !materialSuggestions.includes(item.workMaterial.trim())) {
        await appendToList("settings/work_materials", item.workMaterial.trim());
        setMaterialSuggestions((prev) => [...prev, item.workMaterial.trim()]);
      }
    }

    const safeDoctorName = finalDoctor.replace(/\./g, ' ').replace(/[#$\[\]\/]/g, '');

    const entries = workItems.map(item => ({
      _id: Math.random().toString(36).substring(2, 11),
      "Received Date": receivedDate,
      "Delivered Date": deliveredDate || "Not Delivered",
      "Patient Name": patientName,
      "Location": location,
      "Shade": shade,
      "Tooth No": item.toothNo,
      "Work material": item.workMaterial,
      "Units": Number(item.units),
      "Status": status,
    }));

    try {
      // Create doctor if it doesn't exist
      if (!doctorsData[safeDoctorName]) {
        await writeData(`doctors/${safeDoctorName}`, { balance: 0, prices: {} });
      }

      // Add to procuredData
      const existingSheetRows = procuredData[safeDoctorName] || [];
      const newSheetRows = [...entries, ...existingSheetRows];
      await writeData(`procuredData/${safeDoctorName}`, newSheetRows);

      toast.success("Entry added successfully!");

      // Reset form fields
      setPatientName("");
      setLocation("");
      setShade("");
      setWorkItems([{ toothNo: "", workMaterial: "", units: "" }]);
      setStatus("Procured");
      setIsAddingDoctor(false);
      setNewDoctorName("");
    } catch (err: any) {
      toast.error("Failed to save entry: " + err.message);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background relative w-full min-w-0 overflow-y-auto custom-scrollbar p-6">
      <div className="max-w-3xl mx-auto w-full">
        <h1 className="text-2xl font-bold text-white mb-6">Job Work Entry</h1>
        <p className="text-foreground/70 mb-8">Staff and collection team can enter new job work procured from doctors here.</p>

        <div className="bg-panel border border-panel-border rounded-xl shadow-2xl flex flex-col p-6 space-y-6">
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
                    {doctorOptions.map((docName) => (
                      <option key={docName} value={docName}>
                        {docName}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" size={18} />
                </div>
                <button
                  onClick={() => setIsAddingDoctor(true)}
                  className="px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 hover:text-white text-white/70 flex items-center gap-1.5 sm:gap-2 transition-colors shrink-0"
                >
                  <Plus size={18} className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                  <span className="hidden sm:inline">New Doctor</span>
                  <span className="sm:hidden">New</span>
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
                  className="px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors shrink-0"
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
                style={{ colorScheme: 'dark' }}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-white/70 mb-1">Due Date</label>
              <input
                type="date"
                value={deliveredDate}
                onChange={(e) => setDeliveredDate(e.target.value)}
                className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accent"
                style={{ colorScheme: 'dark' }}
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
              <label className="block text-sm font-semibold text-white/70 mb-1">Location</label>
              <input
                type="text"
                placeholder="Location..."
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-white/70 mb-1">Shade</label>
              <input
                type="text"
                placeholder="Shade (e.g. A1, B2)..."
                value={shade}
                onChange={(e) => setShade(e.target.value)}
                className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accent"
              />
            </div>
            
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-white/70">Work Materials *</label>
              </div>
              
              {workItems.map((item, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 bg-black/20 rounded-lg border border-white/5 relative">
                  {workItems.length > 1 && (
                    <button
                      onClick={() => setWorkItems(workItems.filter((_, i) => i !== index))}
                      className="absolute -top-2 -right-2 bg-red-500/20 text-red-400 rounded-full p-1 hover:bg-red-500 hover:text-white transition-colors z-10"
                      title="Remove"
                    >
                      <X size={14} />
                    </button>
                  )}
                  
                  <div className="md:col-span-3">
                    <label className="block text-xs font-semibold text-white/50 mb-1">Tooth No</label>
                    <input
                      type="text"
                      placeholder="e.g. 11, 12, 13"
                      value={item.toothNo}
                      onChange={(e) => {
                        const newItems = [...workItems];
                        newItems[index].toothNo = e.target.value;
                        setWorkItems(newItems);
                      }}
                      className="w-full bg-black/40 border border-panel-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-accent text-sm"
                    />
                  </div>
                  
                  <div className="md:col-span-6 relative" ref={activeSuggestionIndex === index ? suggestionsRef : null}>
                    <label className="block text-xs font-semibold text-white/50 mb-1">Work Material *</label>
                    <input
                      type="text"
                      placeholder="e.g. PFM, Zirconia..."
                      value={item.workMaterial}
                      onChange={(e) => {
                        const newItems = [...workItems];
                        newItems[index].workMaterial = e.target.value;
                        setWorkItems(newItems);
                        setActiveSuggestionIndex(index);
                      }}
                      onFocus={() => setActiveSuggestionIndex(index)}
                      className="w-full bg-black/40 border border-panel-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-accent text-sm"
                    />
                    {activeSuggestionIndex === index && materialSuggestions.filter(m => m.toLowerCase().includes(item.workMaterial.toLowerCase())).length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-[#0a111a] border border-panel-border rounded-lg shadow-xl overflow-hidden z-50 max-h-40 overflow-y-auto custom-scrollbar">
                        {materialSuggestions.filter(m => m.toLowerCase().includes(item.workMaterial.toLowerCase())).map((suggestion, i) => (
                          <div
                            key={i}
                            onClick={() => {
                              const newItems = [...workItems];
                              newItems[index].workMaterial = suggestion;
                              setWorkItems(newItems);
                              setActiveSuggestionIndex(null);
                            }}
                            className="px-4 py-2 hover:bg-white/5 cursor-pointer border-b border-panel-border/30 last:border-0 text-white text-sm"
                          >
                            {suggestion}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="md:col-span-3">
                    <label className="block text-xs font-semibold text-white/50 mb-1">Units *</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="Units"
                      value={item.units}
                      onChange={(e) => {
                        const newItems = [...workItems];
                        newItems[index].units = e.target.value;
                        setWorkItems(newItems);
                      }}
                      className="w-full bg-black/40 border border-panel-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-accent text-sm"
                    />
                  </div>
                </div>
              ))}
              
              <button
                onClick={() => setWorkItems([...workItems, { toothNo: "", workMaterial: "", units: "" }])}
                className="w-full py-2 border border-dashed border-white/20 rounded-lg text-white/50 hover:text-white hover:border-white/40 hover:bg-white/5 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
              >
                <Plus size={16} />
                Add Work Material
              </button>
            </div>
            <div>
              <label className="block text-sm font-semibold text-white/70 mb-1">Status</label>
              <div className="w-full bg-black/40 border border-panel-border rounded-lg px-4 py-2.5 text-yellow-500/70 font-medium bg-yellow-500/5 cursor-not-allowed">
                Procured
              </div>
            </div>
          </div>
          
          <div className="pt-4 border-t border-panel-border flex justify-end">
            <button
              onClick={handleSave}
              className="px-6 py-3 bg-accent text-panel font-bold rounded-lg hover:bg-accent-glow transition-all shadow-[0_0_15px_rgba(0,194,255,0.4)] flex items-center gap-2"
            >
              <Save size={20} />
              Save Entry
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
