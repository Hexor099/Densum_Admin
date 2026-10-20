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
          if (key.trim().toLowerCase() === 'fitted') continue;
          
          let safeKey = key.replace(/[#$\[\]\/]/g, '').trim();
          const cleanKey = safeKey.toLowerCase().replace(/[^a-z0-9]/g, '');

          // Normalize known headers to exact casing required by the app (completely generic, handles trailing punctuation like commas, dots, colons)
          if (cleanKey === 'delivereddate' || cleanKey === 'deliverydate' || cleanKey === 'deliverdate' || cleanKey === 'duedate') {
            safeKey = 'Delivered Date';
          } else if (cleanKey === 'receiveddate' || cleanKey === 'receivedate' || cleanKey === 'date' || cleanKey === 'orderdate') {
            safeKey = 'Received Date';
          } else if (cleanKey === 'patientname' || cleanKey === 'patient') {
            safeKey = 'Patient Name';
          } else if (cleanKey === 'toothno' || cleanKey === 'tooth' || cleanKey === 'teeth' || cleanKey === 'teethno' || cleanKey === 'toothnum' || cleanKey === 'toothnumber') {
            safeKey = 'Tooth No';
          } else if (cleanKey === 'workmaterial' || cleanKey === 'material' || cleanKey === 'work') {
            safeKey = 'Work material';
          } else if (['units', 'unit', 'qty', 'quantity', 'nos', 'count', 'noofunits', 'totalunits'].includes(cleanKey)) {
            safeKey = 'Units';
          }
          
          newRow[safeKey] = row[key];
        }

        // Clean & parse Units
        const parsedUnits = Number(newRow['Units']);
        if (!isNaN(parsedUnits) && parsedUnits > 0) {
          newRow['Units'] = parsedUnits;
        } else {
          // If Units column was blank or omitted in Excel, infer from Tooth No count
          const toothStr = String(newRow['Tooth No'] || '').trim();
          const matches = toothStr.match(/\d+/g) || [];
          newRow['Units'] = matches.length > 0 ? matches.length : 1;
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
