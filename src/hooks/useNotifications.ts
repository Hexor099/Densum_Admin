"use client";

import { useEffect } from "react";
import { useStore } from "@/store/useStore";
import { parseDateString } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";

export function useNotifications() {
  const storeExcelData = useStore((state) => (state as any).excelData);

  useEffect(() => {
    // Request permission on mount
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }

    const checkNotifications = () => {
      if (typeof window === "undefined" || !("Notification" in window)) return;
      if (Notification.permission !== "granted") return;

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
              const diffMs = now.getTime() - targetDate.getTime();
              const hoursPast = Math.floor(diffMs / (1000 * 60 * 60));
              
              const orderId = row._id || `${doctorName}-${row['Patient Name']}`;
              const storageKey = `notified_${orderId}`;
              
              const lastNotifiedHour = parseInt(localStorage.getItem(storageKey) || "-1", 10);

              if (hoursPast > lastNotifiedHour) {
                // Send notification
                const title = "Order Pending Delivery";
                const message = `Order for ${row['Patient Name']} (Doctor: ${doctorName}) is pending delivery! (${hoursPast}h past deadline)`;
                
                try {
                  if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.ready.then((registration) => {
                      registration.showNotification(title, {
                        body: message,
                        icon: '/app-logo.png',
                      });
                    });
                  } else {
                    new Notification(title, {
                      body: message,
                      icon: '/app-logo.png',
                    });
                  }
                  localStorage.setItem(storageKey, hoursPast.toString());
                } catch (e) {
                  console.error("Failed to send notification", e);
                }
              }
            }
          });
        }
      });
    };

    // Check immediately on mount, then every 60 seconds
    checkNotifications();
    const interval = setInterval(checkNotifications, 60 * 1000);

    return () => clearInterval(interval);
  }, [storeExcelData]);

  // Global Test Notification Listener
  useEffect(() => {
    let initialLoad = true;
    const testNotifRef = ref(db, 'test_notifications/trigger');
    
    const unsubscribe = onValue(testNotifRef, (snapshot) => {
      if (initialLoad) {
        initialLoad = false;
        return;
      }
      
      const val = snapshot.val();
      if (val) {
        const title = "Test Notification 🚀";
        const message = "This is a trial notification from Densum Digital Lab!";
        
        try {
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.ready.then((registration) => {
                registration.showNotification(title, {
                  body: message,
                  icon: '/app-logo.png',
                });
              });
            } else {
              new Notification(title, {
                body: message,
                icon: '/app-logo.png',
              });
            }
          }
        } catch (e) {
          console.error("Failed to send test notification", e);
        }
      }
    });

    return () => unsubscribe();
  }, []);
}
