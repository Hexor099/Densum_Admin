"use client";

import { useStore } from "@/store/useStore";
import { useEffect, useState } from "react";
import { Bell, Clock, AlertCircle } from "lucide-react";
import { parseDateString, formatDateForDisplay } from "@/lib/utils";

interface NotificationItem {
  id: string;
  patientName: string;
  doctorName: string;
  receivedDate: string;
  message: string;
  timestamp: number;
}

export default function NotificationCenter() {
  const storeExcelData = useStore((state) => (state as any).excelData);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const triggerTestNotification = () => {
    const title = "Test Notification 🚀";
    const options = {
      body: "This is a trial notification from Densum Digital Lab!",
      icon: "/app-logo.png",
    };

    const send = () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
          registration.showNotification(title, options);
        });
      } else {
        new Notification(title, options);
      }
    };

    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        send();
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
          if (permission === "granted") send();
        });
      }
    } else {
      alert("Your browser does not support notifications.");
    }
  };

  useEffect(() => {
    // We compute the notifications dynamically based on the criteria
    const notifs: NotificationItem[] = [];
    const now = new Date();
    
    Object.entries(storeExcelData || {}).forEach(([doctorName, rows]: [string, any]) => {
      if (Array.isArray(rows)) {
        rows.forEach((row) => {
          if (!row['Received Date'] || row['Delivered Date'] !== 'Not Delivered' || row['Status'] === 'Delivered') {
            return;
          }

          const receivedDate = parseDateString(row['Received Date']);
          if (isNaN(receivedDate.getTime())) return;

          // Target is 11 AM next day
          const targetDate = new Date(receivedDate);
          targetDate.setDate(targetDate.getDate() + 1);
          targetDate.setHours(11, 0, 0, 0);

          if (now >= targetDate) {
            // Calculate how many hours past the target date we are
            const diffMs = now.getTime() - targetDate.getTime();
            const hoursPast = Math.floor(diffMs / (1000 * 60 * 60));
            
            notifs.push({
              id: row._id || `${doctorName}-${row['Patient Name']}`,
              patientName: row['Patient Name'],
              doctorName: doctorName,
              receivedDate: row['Received Date'],
              message: `Order pending delivery for ${hoursPast} hour(s) past the deadline.`,
              timestamp: targetDate.getTime()
            });
          }
        });
      }
    });

    // Sort by timestamp descending (newest issues first)
    notifs.sort((a, b) => b.timestamp - a.timestamp);
    setNotifications(notifs);
  }, [storeExcelData]);

  return (
    <div className="max-w-4xl mx-auto space-y-6 flex flex-col h-[calc(100vh-6rem)] w-full">
      <header className="mb-2 shrink-0 flex items-center gap-3">
        <div className="p-3 bg-accent/20 rounded-xl text-accent">
          <Bell size={28} />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Notification Center</h1>
          <p className="text-foreground/70">
            Alerts for orders exceeding the delivery deadline (Next day 11:00 AM)
          </p>
        </div>
        <div className="ml-auto">
          <button 
            onClick={triggerTestNotification}
            className="px-4 py-2 bg-accent/20 text-accent font-medium rounded-lg hover:bg-accent/30 transition-colors flex items-center gap-2"
          >
            <Bell size={18} />
            Test Notification
          </button>
        </div>
      </header>

      <div className="flex-1 bg-panel rounded-xl border border-panel-border shadow-lg overflow-y-auto custom-scrollbar p-6">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-foreground/50 gap-4">
            <AlertCircle size={48} className="text-foreground/20" />
            <p className="text-lg">No pending notifications at this time.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notif) => (
              <div 
                key={notif.id} 
                className="flex items-start gap-4 p-4 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-colors"
              >
                <div className="mt-1 p-2 bg-red-500/20 text-red-400 rounded-lg shrink-0">
                  <Clock size={20} />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                    {notif.patientName} 
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-foreground/80 font-normal">
                      Doctor: {notif.doctorName}
                    </span>
                  </h3>
                  <p className="text-red-400 mt-1">{notif.message}</p>
                  <p className="text-sm text-foreground/60 mt-2 flex items-center gap-1">
                    <AlertCircle size={14} /> Received on {formatDateForDisplay(notif.receivedDate)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
