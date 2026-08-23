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
    
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const json = xlsx.utils.sheet_to_json(worksheet, { raw: false, dateNF: 'dd-mm-yyyy' });
      sheetsData[sheetName] = json;
    }

    // Deep clone to ensure plain objects are passed to Client Components
    const plainSheetsData = JSON.parse(JSON.stringify(sheetsData));

    return { success: true, data: plainSheetsData, sheetNames: workbook.SheetNames };
  } catch (error: any) {
    console.error("Error reading Excel file:", error);
    return { success: false, error: error.message || "Failed to parse Excel data" };
  }
}
