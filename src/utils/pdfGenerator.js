import { formatMoney, numberToWordsIndian, pad2, refNoFull, currentFinancialYear } from './numberToWords.js';

async function getJsPdfConstructor() {
  if (typeof window !== 'undefined') {
    if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
    if (window.jsPDF) return window.jsPDF;
  }
  try {
    const mod = await import('jspdf');
    return mod.jsPDF || mod.default;
  } catch (e) {
    // fallback
  }
  throw new Error('jsPDF library is not loaded. Please ensure the jsPDF script is included.');
}

async function getPdfLibDocument() {
  if (typeof window !== 'undefined') {
    if (window.PDFLib && window.PDFLib.PDFDocument) return window.PDFLib.PDFDocument;
    if (window.PDFDocument) return window.PDFDocument;
  }
  try {
    const mod = await import('pdf-lib');
    return mod.PDFDocument;
  } catch (e) {
    // fallback
  }
  throw new Error('PDFLib library is not loaded. Please ensure the pdf-lib script is included.');
}

export async function generateSingleOrMultiSanctionPdfBytes(snapshots) {
  const JsPDF = await getJsPdfConstructor();
  const doc = new JsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 18;
  const marginRight = 18;
  const contentWidth = pageWidth - marginLeft - marginRight;

  snapshots.forEach((snap, snapIndex) => {
    if (snapIndex > 0) {
      doc.addPage();
    }

    const total = (snap.billRows || []).reduce((sum, r) => {
      const v = parseFloat(r.amt);
      return sum + (isNaN(v) ? 0 : v);
    }, 0);
    const amtWords = numberToWordsIndian(total);
    const fy = currentFinancialYear();
    const ref = refNoFull(snap.refNo);

    let y = 16;

    // Header line: School ID & Phone
    doc.setFont('times', 'bold');
    doc.setFontSize(10);
    doc.text(`SCHOOL ID - ${snap.schoolId || ''}`, marginLeft, y);
    const phoneText = `PHONE - ${snap.phone || ''}`;
    const phoneWidth = doc.getTextWidth(phoneText);
    doc.text(phoneText, pageWidth - marginRight - phoneWidth, y);

    // School Name (Centered, large)
    y += 7;
    doc.setFontSize(14);
    doc.setFont('times', 'bold');
    doc.text(snap.schoolName || 'SARVODAYA VIDYALAYA', pageWidth / 2, y, { align: 'center' });

    // Address (Centered)
    y += 5.5;
    doc.setFontSize(10.5);
    doc.text(snap.address || '', pageWidth / 2, y, { align: 'center' });

    // Ref No & Date
    y += 7;
    doc.setFontSize(10);
    doc.setFont('times', 'bold');
    doc.text(`Ref. No. ${ref}`, marginLeft, y);
    const dateText = `Dated: ${snap.date || ''}`;
    const dateWidth = doc.getTextWidth(dateText);
    doc.text(dateText, pageWidth - marginRight - dateWidth, y);

    // Title: SANCTION ORDER (Underlined, centered)
    y += 7.5;
    doc.setFontSize(12.5);
    doc.setFont('times', 'bold');
    doc.text('SANCTION ORDER', pageWidth / 2, y, { align: 'center' });
    const titleWidth = doc.getTextWidth('SANCTION ORDER');
    doc.line((pageWidth / 2) - (titleWidth / 2), y + 1, (pageWidth / 2) + (titleWidth / 2), y + 1);

    // Body paragraph
    y += 7;
    doc.setFontSize(10);
    doc.setFont('times', 'normal');
    
    const bodyText = `Sanction is hereby conveyed for incurring an expenditure of Rs. ${formatMoney(total)} (Rs. ${amtWords}) for making payment under head ${snap.budgetHead || ''} as per details below: --`;
    const splitBody = doc.splitTextToSize(bodyText, contentWidth);
    doc.text(splitBody, marginLeft, y);
    y += splitBody.length * 4.8 + 2;

    // Bill Details Table
    const tableBody = (snap.billRows || []).map((r, idx) => {
      const amtVal = parseFloat(r.amt);
      return [
        pad2(idx + 1),
        r.firm || '',
        r.bill || '',
        formatMoney(isNaN(amtVal) ? 0 : amtVal)
      ];
    });

    // Add total row
    tableBody.push([
      { content: 'TOTAL', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
      { content: formatMoney(total), styles: { halign: 'right', fontStyle: 'bold' } }
    ]);

    const tableConfig = {
      startY: y,
      margin: { left: marginLeft, right: marginRight },
      head: [['SL. NO.', 'NAME OF FIRM', 'BILL NO & DATE', 'AMOUNT (Rs.)']],
      body: tableBody,
      theme: 'grid',
      styles: {
        font: 'times',
        fontSize: 9,
        cellPadding: 2,
        textColor: [20, 20, 20],
        lineColor: [120, 120, 120],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [217, 217, 217],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'left',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 16 },
        1: { halign: 'left', cellWidth: 62 },
        2: { halign: 'left', cellWidth: 64 },
        3: { halign: 'right', cellWidth: 32 },
      },
      didParseCell: (data) => {
        if (data.section === 'head' && (data.column.index === 0 || data.column.index === 3)) {
          data.cell.styles.halign = data.column.index === 0 ? 'center' : 'right';
        }
      }
    };

    if (typeof doc.autoTable === 'function') {
      doc.autoTable(tableConfig);
    } else if (typeof window.jspdfAutoTable === 'function') {
      window.jspdfAutoTable(doc, tableConfig);
    }

    const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) || (y + 40);
    y = finalY + 5;

    // Paragraph 1: Major Head & Powers delegated
    doc.setFont('times', 'normal');
    doc.setFontSize(9.5);
    const p1 = `Major Head: ${snap.budgetHead || ''} This Sanction has been accorded/conveyed in exercise of the powers delegated by the finance department Govt. NCT of Delhi and in consultation with account functionaries of the Department.`;
    const splitP1 = doc.splitTextToSize(p1, contentWidth);
    doc.text(splitP1, marginLeft, y);
    y += splitP1.length * 4.2 + 2.5;

    // Paragraph 2: Prior approval
    const p2 = `This issues with the prior approval of Deputy Director of Education/Regional Director of Education/Head of department/Competent Authority/Secretary of Education.`;
    const splitP2 = doc.splitTextToSize(p2, contentWidth);
    doc.text(splitP2, marginLeft, y);
    y += splitP2.length * 4.2 + 2.5;

    // Paragraph 3: Expenditure debited
    const p3 = `The expenditure involved on this account would be debatable to the under mentioned Head of Account the year ${fy} under demand for Grant no. 6.\nMajor Head ${snap.budgetHead || ''}`;
    const splitP3 = doc.splitTextToSize(p3, contentWidth);
    doc.text(splitP3, marginLeft, y);
    y += splitP3.length * 4.2 + 8;

    // Signature (Right aligned)
    doc.setFont('times', 'bold');
    doc.setFontSize(10);
    doc.text('HEAD OF SCHOOL', pageWidth - marginRight, y, { align: 'right' });
    y += 7;

    // Copy To section
    doc.setFont('times', 'bold');
    doc.setFontSize(9.5);
    doc.text('Copy to:-', marginLeft, y);
    y += 4.5;

    doc.setFont('times', 'normal');
    doc.setFontSize(9);
    const copyLines = (snap.copyTo || '')
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    copyLines.forEach(line => {
      doc.text(line, marginLeft, y);
      y += 4;
    });
  });

  const arrayBuffer = doc.output('arraybuffer');
  return new Uint8Array(arrayBuffer);
}

/**
 * Appends generated sanction order page(s) to an existing uploaded PDF
 */
export async function appendSanctionsToExistingPdf(existingPdfBytes, newSnapshots) {
  // 1. Generate new sanction pages as a PDF Uint8Array
  const newPdfBytes = await generateSingleOrMultiSanctionPdfBytes(newSnapshots);

  // 2. Load existing PDF via pdf-lib
  const PDFDocument = await getPdfLibDocument();
  const existingPdfDoc = await PDFDocument.load(existingPdfBytes);

  // 3. Load newly generated PDF via pdf-lib
  const newPdfDoc = await PDFDocument.load(newPdfBytes);

  // 4. Copy all pages from newPdfDoc to existingPdfDoc
  const copiedPages = await existingPdfDoc.copyPages(newPdfDoc, newPdfDoc.getPageIndices());
  copiedPages.forEach((page) => {
    existingPdfDoc.addPage(page);
  });

  // 5. Save and return combined PDF
  const mergedPdfBytes = await existingPdfDoc.save();
  return mergedPdfBytes;
}

export function downloadBlob(data, filename) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 4000);
}
