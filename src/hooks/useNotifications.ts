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
      console.log("[NotificationCheck] Started running check...");
      if (typeof window === "undefined" || !("Notification" in window)) {
        console.log("[NotificationCheck] Browser doesn't support notifications");
        return;
      }
      console.log("[NotificationCheck] Permission status:", Notification.permission);
      if (Notification.permission !== "granted") {
        console.log("[NotificationCheck] Aborting because permission is not granted");
        return;
      }

      const now = new Date();
      console.log("[NotificationCheck] Store Excel Data Keys:", Object.keys(storeExcelData || {}).length);

      const pendingOrders: Array<{ row: any, doctorName: string, hoursPast: number, storageKey: string }> = [];

      Object.entries(storeExcelData || {}).forEach(([doctorName, rows]: [string, any]) => {
        if (Array.isArray(rows)) {
          rows.forEach((row) => {
            const isNotDelivered = !row['Delivered Date'] || row['Delivered Date'] === 'Not Delivered' || String(row['Delivered Date']).trim() === '';
            if (!row['Received Date'] || !isNotDelivered || row['Status'] === 'Delivered') {
              return;
            }

            const receivedDate = parseDateString(row['Received Date']);
            if (isNaN(receivedDate.getTime())) return;

            console.log(`[NotificationCheck] Pending Case Found! Patient: ${row['Patient Name']}`);

            // Target 1: 4 PM on the received day
            const target4PM = new Date(receivedDate);
            target4PM.setHours(16, 0, 0, 0);

            // Target 2: 11 AM on the next day
            const target11AM = new Date(receivedDate);
            target11AM.setDate(target11AM.getDate() + 1);
            target11AM.setHours(11, 0, 0, 0);

            let activeTarget = null;
            if (now >= target11AM) {
              activeTarget = target11AM;
            } else if (now >= target4PM) {
              activeTarget = target4PM;
            }

            if (!activeTarget) return;

            const diffMs = now.getTime() - activeTarget.getTime();
            const hoursPast = Math.floor(diffMs / (1000 * 60 * 60));
            
            const orderId = row._id || `${doctorName}-${row['Patient Name']}`;
            // Use target time in the key so 4PM and 11AM deadlines track independently
            const storageKey = `notified_${activeTarget.getTime()}_${orderId}`;
            
            const lastNotifiedHour = parseInt(localStorage.getItem(storageKey) || "-1", 10);

            if (hoursPast > lastNotifiedHour) {
              pendingOrders.push({ row, doctorName, hoursPast, storageKey });
            }
          });
        }
      });

      if (pendingOrders.length > 0) {
        console.log(`[NotificationCheck] Attempting to trigger notification for ${pendingOrders.length} orders...`);
        const title = "Order Pending Delivery";
        let message = "";

        if (pendingOrders.length === 1) {
          const { row, doctorName, hoursPast } = pendingOrders[0];
          message = `Order for ${row['Patient Name']} (Doctor: ${doctorName}) is pending delivery! (${hoursPast}h past deadline)`;
        } else {
          message = `You have ${pendingOrders.length} orders pending delivery!`;
        }

        try {
          if ('serviceWorker' in navigator) {
            console.log("[NotificationCheck] serviceWorker found in navigator, waiting for ready...");
            navigator.serviceWorker.ready.then((registration) => {
              console.log("[NotificationCheck] serviceWorker is ready! Calling showNotification...");
              registration.showNotification(title, {
                body: message,
                icon: '/app-logo.png'
              }).then(() => {
                console.log("[NotificationCheck] showNotification Promise resolved successfully.");
              }).catch(err => {
                console.error("[NotificationCheck] showNotification Promise rejected!", err);
                alert("Notification blocked by browser: " + err.message);
              });
            });
          } else {
            new Notification(title, {
              body: message,
              icon: '/app-logo.png',
              requireInteraction: true,
              tag: 'pending-deliveries'
            });
          }

          // Mark all as notified
          pendingOrders.forEach(({ storageKey, hoursPast }) => {
            localStorage.setItem(storageKey, hoursPast.toString());
          });
        } catch (e) {
          console.error("Failed to send notification", e);
        }
      }
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
