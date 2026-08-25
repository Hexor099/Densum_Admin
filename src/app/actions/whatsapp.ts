"use server";

import { spawn } from 'child_process';
import path from 'path';

import fs from 'fs';

export async function sendWhatsAppAction(phone: string, message: string, pdfBase64?: string) {
  return new Promise<{ success: boolean; error?: string }>((resolve) => {
    let attachmentPath = '';
    
    try {
      if (pdfBase64) {
        // Remove the data URI scheme prefix
        const base64Data = pdfBase64.replace(/^data:application\/pdf;filename=[\w-]+\.pdf;base64,/, '').replace(/^data:application\/pdf;base64,/, '');
        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        attachmentPath = path.join(tempDir, `invoice_${Date.now()}.pdf`);
        fs.writeFileSync(attachmentPath, base64Data, 'base64');
      }

      const scriptPath = path.join(process.cwd(), 'scripts', 'send_whatsapp.py');
      
      const args = [scriptPath, phone, message];
      if (attachmentPath) {
        args.push(attachmentPath);
      }
      
      const pythonProcess = spawn('python', args);
      
      let errorData = '';
      
      pythonProcess.stderr.on('data', (data) => {
        errorData += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (attachmentPath && fs.existsSync(attachmentPath)) {
          try { fs.unlinkSync(attachmentPath); } catch (e) {}
        }
        
        if (code === 0) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: errorData || `Process exited with code ${code}` });
        }
      });
    } catch (e: any) {
      if (attachmentPath && fs.existsSync(attachmentPath)) {
        try { fs.unlinkSync(attachmentPath); } catch (e) {}
      }
      resolve({ success: false, error: e.message || 'Failed to spawn python process' });
    }
  });
}
