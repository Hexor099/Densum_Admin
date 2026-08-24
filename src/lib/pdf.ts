import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function generateInvoicePDF(data: any[], doctorName: string, doctorProfile: any, settings: any) {
  const doc = new jsPDF();
  
  const labName = settings.labName || 'Densum Digital Lab';
  const labState = settings.state || 'Maharashtra';
  const labGSTIN = settings.gstin || '';
  const labAddress = settings.address || '';
  const hsnCode = settings.hsnCode || '9021';
  const gstRate = Number(settings.gstRate) || 18.0;

  const docAddress = doctorProfile.address || 'Address not provided';
  const docState = doctorProfile.state || '';
  const docGSTIN = doctorProfile.gstin || 'Unregistered';
  const docPhone = doctorProfile.phone || '';

  const isInterstate = docState && labState.toLowerCase() !== docState.toLowerCase();

  // Header
  doc.setFontSize(22);
  doc.setTextColor(0, 168, 232); // Densum Accent Cyan
  doc.text(labName, 14, 20);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('TAX INVOICE', 14, 28);

  doc.setFontSize(9);
  doc.setTextColor(50);
  doc.text(`${labAddress}\nState: ${labState}\nGSTIN: ${labGSTIN}`, 14, 35);
  
  const invNo = `INV-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${settings.invoiceSequence || 1}`;
  doc.text(`Invoice #: ${invNo}\nDate: ${new Date().toLocaleDateString()}`, 140, 35);

  doc.text(`Billed To:\n${doctorName}\n${docAddress}\nState: ${docState} | GSTIN: ${docGSTIN}\nPhone: ${docPhone}`, 14, 55);

  if (!data || data.length === 0) return;
  
  let totalInclusive = 0;
  
  // Prepare table data
  const headers = ['#', 'Order Date', 'Patient', 'Product', 'Teeth #', 'Units', 'Rate /unit', 'Total Amount'];
  const rows = data.map((row, idx) => {
    const total = Number(row.Total) || 0;
    totalInclusive += total;

    const getVal = (possibleKeys: string[]) => {
      const foundKey = Object.keys(row).find(k => possibleKeys.some(pk => k.toLowerCase() === pk.toLowerCase()));
      return foundKey ? row[foundKey] : undefined;
    };

    return [
      String(idx + 1),
      getVal(['received date']) || '-',
      (getVal(['patient name']) || '-').substring(0, 18),
      (getVal(['work material']) || '-').substring(0, 22),
      getVal(['tooth no', 'tooth no.']) || '-',
      String(getVal(['units']) || 0),
      Number(row['Rate']).toFixed(2),
      total.toFixed(2)
    ];
  });

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 80,
    theme: 'grid',
    headStyles: { fillColor: [13, 24, 38], textColor: [255, 255, 255] },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;
  
  const taxableValue = totalInclusive / (1 + (gstRate / 100));
  const totalTax = totalInclusive - taxableValue;
  
  let igst = 0, cgst = 0, sgst = 0;
  if (isInterstate) {
    igst = totalTax;
  } else {
    cgst = totalTax / 2;
    sgst = totalTax / 2;
  }

  const prevBalance = Number(doctorProfile.balance) || 0;
  const netAmount = totalInclusive + prevBalance;

  // Summary Table
  const summaryHeaders = ['Description', 'Amount (INR)'];
  const summaryRows = [
    ['Taxable Value (Base):', taxableValue.toFixed(2)]
  ];

  if (isInterstate) {
    summaryRows.push([`IGST (${gstRate}%):`, igst.toFixed(2)]);
  } else {
    summaryRows.push([`CGST (${gstRate/2}%):`, cgst.toFixed(2)]);
    summaryRows.push([`SGST (${gstRate/2}%):`, sgst.toFixed(2)]);
  }

  summaryRows.push(['Invoice Total:', totalInclusive.toFixed(2)]);
  summaryRows.push(['Previous Balance:', prevBalance.toFixed(2)]);
  summaryRows.push(['Grand Total Due:', netAmount.toFixed(2)]);

  autoTable(doc, {
    head: [summaryHeaders],
    body: summaryRows,
    startY: finalY,
    margin: { left: 120 },
    theme: 'grid',
    headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0] },
    columnStyles: { 1: { halign: 'right' } }
  });

  doc.setFontSize(9);
  doc.text(`HSN Code: ${hsnCode}`, 14, finalY + 10);
  
  doc.save(`Tax_Invoice_${doctorName.replace(/[^a-z0-9]/gi, '_')}.pdf`);
}
