import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getVal } from './utils';

function parsePalmerNotation(teethStr: string) {
  if (!teethStr) return { left: '-', right: '', hasFDI: false };
  
  const q1: string[] = [], q2: string[] = [], q3: string[] = [], q4: string[] = [];
  const matches = String(teethStr).match(/\d+/g) || [];
  
  let hasFDI = false;
  
  matches.forEach(t => {
    if (t.length === 2) {
      const quad = t[0];
      const tooth = t[1];
      if (tooth >= '1' && tooth <= '8' && quad >= '1' && quad <= '4') {
        hasFDI = true;
        if (quad === '1' && !q1.includes(tooth)) q1.push(tooth);
        else if (quad === '2' && !q2.includes(tooth)) q2.push(tooth);
        else if (quad === '3' && !q3.includes(tooth)) q3.push(tooth);
        else if (quad === '4' && !q4.includes(tooth)) q4.push(tooth);
      }
    }
  });

  if (!hasFDI) {
    return { left: String(teethStr), right: '', hasFDI: false };
  }

  q1.sort((a, b) => b.localeCompare(a));
  q4.sort((a, b) => b.localeCompare(a));
  
  q2.sort((a, b) => a.localeCompare(b));
  q3.sort((a, b) => a.localeCompare(b));

  const topL = q1.length ? q1.join('') : ' ';
  const botL = q4.length ? q4.join('') : ' ';
  const topR = q2.length ? q2.join('') : ' ';
  const botR = q3.length ? q3.join('') : ' ';

  return {
    left: `${topL}\n${botL}`,
    right: `${topR}\n${botR}`,
    hasFDI: true
  };
}

export async function generateInvoicePDF(data: any[], doctorName: string, doctorProfile: any, settings: any, monthName?: string) {
  const doc = new jsPDF();
  
  const labName = settings.labName || 'Densum Digital Lab';
  const labState = settings.state || 'Maharashtra';
  const labGSTIN = settings.gstin || '';
  const labAddress = settings.address || '';
  const hsnCode = settings.hsnCode || '9021';

  const docAddress = doctorProfile.address || 'Address not provided';
  const docPhone = doctorProfile.phone || '';

  // Header
  try {
    const response = await fetch('/logo.jpg');
    if (response.ok) {
      const blob = await response.blob();
      const base64data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => resolve(reader.result as string);
      });
      doc.addImage(base64data, 'JPEG', 14, 8, 70, 22);
    } else {
      throw new Error("Logo not found");
    }
  } catch (e) {
    doc.setFontSize(22);
    doc.setTextColor(0, 168, 232); // Densum Accent Cyan
    doc.text(labName, 14, 20);
  }
  
  // BILL OF SUPPLY (not Tax Invoice — mandatory under Composition Scheme)
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL OF SUPPLY', 14, 36);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(50);
  doc.text(`${labAddress}\nState: ${labState}\nGSTIN: ${labGSTIN}`, 14, 43);
  
  const invNo = `BOS-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${settings.invoiceSequence || 1}`;
  doc.text(`Bill No: ${invNo}\nDate: ${new Date().toLocaleDateString()}`, 140, 43);

  doc.text(`Billed To:\n${doctorName}\n${docAddress}\nPhone: ${docPhone}`, 14, 63);

  if (!data || data.length === 0) return;
  
  let totalAmount = 0;
  
  // Prepare table data
  const headers = [
    { content: '#', rowSpan: 1 },
    { content: 'Order Date', rowSpan: 1 },
    { content: 'Patient', rowSpan: 1 },
    { content: 'Product', rowSpan: 1 },
    { content: 'Teeth #', colSpan: 2, styles: { halign: 'center' as const } },
    { content: 'Units', rowSpan: 1 },
    { content: 'Rate /unit', rowSpan: 1 },
    { content: 'Amount', rowSpan: 1 }
  ];

  const rows = data.map((row, idx) => {
    const total = Number(row.Total) || 0;
    totalAmount += total;

    const toothParsed = parsePalmerNotation(getVal(row, ['tooth no', 'tooth no.']));

    return [
      String(idx + 1),
      getVal(row, ['received date']) || '-',
      (getVal(row, ['patient name']) || '-').substring(0, 18),
      (getVal(row, ['work material']) || '-').substring(0, 22),
      toothParsed.left,
      toothParsed.right,
      String(getVal(row, ['units']) || 0),
      (Number(row['Rate']) || 0).toFixed(2),
      total.toFixed(2),
      toothParsed.hasFDI
    ];
  });

  autoTable(doc, {
    head: [headers as any],
    body: rows,
    startY: 88,
    theme: 'grid',
    styles: {
      lineWidth: 0.5,
      lineColor: [0, 0, 0]
    },
    headStyles: { fillColor: [13, 24, 38], textColor: [255, 255, 255] },
    columnStyles: {
      4: { halign: 'right' as const, cellPadding: { top: 2, bottom: 2, left: 1, right: 1 }, minCellWidth: 15 },
      5: { halign: 'left' as const, cellPadding: { top: 2, bottom: 2, left: 1, right: 1 }, minCellWidth: 15 }
    },
    didDrawCell: function(data) {
      if (data.section === 'body') {
        const rawRow = data.row.raw as any[];
        const hasFDI = rawRow[9];
        if (hasFDI && (data.column.index === 4 || data.column.index === 5)) {
          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(0.5);
          const midY = data.cell.y + (data.cell.height / 2);
          doc.line(data.cell.x, midY, data.cell.x + data.cell.width, midY);
        }
      }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;
  
  // Under Composition Scheme: NO GST breakup. Total is the final amount.
  const prevBalance = Number(doctorProfile.balance) || 0;
  const netAmount = totalAmount + prevBalance;

  // Summary Table (simplified — no tax breakup)
  const summaryHeaders = ['Description', 'Amount (INR)'];
  const summaryRows = [
    ['Bill Total:', totalAmount.toFixed(2)],
    ['Previous Balance:', prevBalance.toFixed(2)],
    ['Grand Total Due:', netAmount.toFixed(2)]
  ];

  autoTable(doc, {
    head: [summaryHeaders],
    body: summaryRows,
    startY: finalY,
    margin: { left: 120 },
    theme: 'grid',
    styles: {
      lineWidth: 0.5,
      lineColor: [0, 0, 0]
    },
    headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0] },
    columnStyles: { 1: { halign: 'right' } }
  });

  const summaryFinalY = (doc as any).lastAutoTable.finalY + 8;

  // HSN Code
  doc.setFontSize(9);
  doc.text(`HSN Code: ${hsnCode}`, 14, finalY + 10);

  // Mandatory Composition Scheme Disclaimer (required by Rule 46(1) of CGST Rules)
  doc.setFontSize(8);
  doc.setTextColor(150, 0, 0);
  doc.setFont('helvetica', 'bold');
  const disclaimerY = Math.max(summaryFinalY + 5, finalY + 20);
  doc.text(
    '"Composition taxable person, not eligible to collect tax on supplies"',
    14,
    disclaimerY,
    { maxWidth: 180 }
  );

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.setFontSize(7);
  doc.text('This is a Bill of Supply issued under GST Composition Scheme (Section 10, CGST Act 2017).', 14, disclaimerY + 6);
  
  const monthSuffix = monthName ? `_${monthName.replace(/[^a-z0-9]/gi, '_')}` : '';
  doc.save(`Bill_of_Supply_${doctorName.replace(/[^a-z0-9]/gi, '_')}${monthSuffix}.pdf`);
  
  return doc.output('datauristring');
}

