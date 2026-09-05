"use server";

import * as xlsx from 'xlsx';

export async function syncExcelData(formData: FormData) {
  try {
    const file = formData.get('file') as File;
    if (!file) {
      return { success: false, error: "No file provided" };
    }

    const buffer = await file.arrayBuffer();
    const workbook = xlsx.read(Buffer.from(buffer), { type: 'buffer', cellDates: true });
    
    const sheetsData: Record<string, any[]> = {};
    
    const sanitizedSheetNames: string[] = [];
    
    for (const rawSheetName of workbook.SheetNames) {
      // Firebase keys cannot contain . # $ [ ] /
      const sheetName = rawSheetName.replace(/\./g, ' ').replace(/[#$\[\]\/]/g, '');
      sanitizedSheetNames.push(sheetName);

      const worksheet = workbook.Sheets[rawSheetName];
      
      if (worksheet['!ref']) {
        // Skip column F (FITTED) by deleting its cells
        Object.keys(worksheet).forEach(key => {
          if (key.match(/^F\d+$/)) {
            delete worksheet[key];
          }
        });
      }
      
      const rawJson = xlsx.utils.sheet_to_json(worksheet, { raw: false, dateNF: 'dd-mm-yyyy' });
      
      const json = rawJson.map((row: any) => {
        const newRow: any = {
          'Patient Name': '',
          'Received Date': '',
          'Delivered Date': '',
          'Tooth No': '',
          'Work material': '',
          'Units': '',
          'Status': ''
        };
        for (const key in row) {
          if (key.startsWith('__EMPTY')) continue;
          
          let safeKey = key.replace(/\./g, '').replace(/[#$\[\]]/g, '').trim();
          
          // Normalize known headers to exact casing required by the app
          const upperKey = safeKey.toUpperCase();
          if (upperKey === 'DELIVERED DATE' || upperKey === 'DELIVERY DATE' || upperKey === 'DELIVER DATE') safeKey = 'Delivered Date';
          else if (upperKey === 'RECEIVED DATE' || upperKey === 'RECEIVE DATE' || upperKey === 'DATE') safeKey = 'Received Date';
          else if (upperKey === 'PATIENT NAME' || upperKey === 'PATIENT') safeKey = 'Patient Name';
          else if (upperKey === 'TOOTH NO' || upperKey === 'TOOTH NO.' || upperKey === 'TOOTH') safeKey = 'Tooth No';
          else if (upperKey === 'WORK MATERIAL') safeKey = 'Work material';
          else if (upperKey === 'UNITS') safeKey = 'Units';
          
          newRow[safeKey] = row[key];
        }
        
        // Auto-populate missing defaults
        if (!newRow['Delivered Date']) {
          newRow['Delivered Date'] = 'Not Delivered';
          if (!newRow['Status']) newRow['Status'] = 'Active';
        } else {
          // If there is a Delivered Date from Excel, auto-mark as Delivered
          if (!newRow['Status']) newRow['Status'] = 'Delivered';
        }
        
        return newRow;
      }).filter((row: any) => row['Patient Name'] && String(row['Patient Name']).trim() !== '');
      
      sheetsData[sheetName] = json;
    }

    // Deep clone to ensure plain objects are passed to Client Components
    const plainSheetsData = JSON.parse(JSON.stringify(sheetsData));

    return { success: true, data: plainSheetsData, sheetNames: sanitizedSheetNames };
  } catch (error: any) {
    console.error("Error reading Excel file:", error);
    return { success: false, error: error.message || "Failed to parse Excel data" };
  }
}
