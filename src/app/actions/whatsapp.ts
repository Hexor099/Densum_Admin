"use server";

import { spawn } from 'child_process';
import path from 'path';

export async function sendWhatsAppAction(phone: string, message: string) {
  return new Promise<{ success: boolean; error?: string }>((resolve) => {
    try {
      const scriptPath = path.join(process.cwd(), 'scripts', 'send_whatsapp.py');
      
      const pythonProcess = spawn('python', [scriptPath, phone, message]);
      
      let errorData = '';
      
      pythonProcess.stderr.on('data', (data) => {
        errorData += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: errorData || `Process exited with code ${code}` });
        }
      });
    } catch (e: any) {
      resolve({ success: false, error: e.message || 'Failed to spawn python process' });
    }
  });
}
