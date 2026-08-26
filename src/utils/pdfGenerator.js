import { formatMoney, numberToWordsIndian, pad2, refNoFull, currentFinancialYear } from './numberToWords.js';

const MEDICAL_BUDGET_HEADS = [
  '2202 02 101 94 00 06-Pre Primary-Medical Treatm.',
  '2202 02 109 87 00 06-Additional Schooling Facilities-Medical Treatment',
  '2202 02 109 96 00 06-Govt. Sec. Schooling Medical',
];

function isMedicalBudget(budgetHead) {
  return MEDICAL_BUDGET_HEADS.includes(budgetHead);
}

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

// ------------------------------------------------------------------
// Helper: render inline mixed bold/normal text with word wrapping.
// segments = [{ text: '...', bold: true/false }, ...]
// ------------------------------------------------------------------
function drawMixedText(doc, segments, startX, startY, maxWidth, lineHeight) {
  let x = startX;
  let y = startY;
  const spaceWidth = doc.getTextWidth(' ');

  for (const seg of segments) {
    doc.setFont('times', seg.bold ? 'bold' : 'normal');
    const lines = seg.text.split('\n');
    lines.forEach((line, lineIdx) => {
      if (lineIdx > 0) {
        y += lineHeight;
        x = startX;
      }
      const words = line.trim().split(/\s+/).filter(w => w.length > 0);
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const w = doc.getTextWidth(word);
        const advance = (x > startX) ? spaceWidth : 0;
        if (x + advance + w > startX + maxWidth && x > startX) {
          y += lineHeight;
          x = startX;
        }
        if (x > startX) x += advance;
        doc.text(word, x, y);
        x += w;
      }
    });
  }
  doc.setFont('times', 'normal');
  return y;
}

// ------------------------------------------------------------------
// Main PDF generator
// ------------------------------------------------------------------
export async function generateSingleOrMultiSanctionPdfBytes(snapshots) {
  const JsPDF = await getJsPdfConstructor();
  const doc = new JsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();   // 210 mm
  const marginLeft = 18;
  const marginRight = 18;
  const contentWidth = pageWidth - marginLeft - marginRight;

  snapshots.forEach((snap, snapIndex) => {
    if (snapIndex > 0) {
      doc.addPage();
    }

    const isMedical = isMedicalBudget(snap.budgetHead);
    let total = 0;
    let tableBody = [];
    let tableHead = [];
    let columnStyles = {};
    let amountColIndex = 3;

    // --------------------------------------------------------
    // Build table data
    // --------------------------------------------------------
    if (isMedical) {
      amountColIndex = 4;
      total = (snap.medicalRows || []).reduce((sum, group) => {
        return sum + (group.patients || []).reduce((pSum, p) => {
          const v = parseFloat(p.amt);
          return pSum + (isNaN(v) ? 0 : v);
        }, 0);
      }, 0);

      let slNo = 1;
      (snap.medicalRows || []).forEach((group) => {
        const patients = group.patients || [];
        patients.forEach((p, pIdx) => {
          const amtVal = parseFloat(p.amt);
          tableBody.push([
            pIdx === 0 ? pad2(slNo) : '',
            pIdx === 0 ? (group.employeeName || '').toUpperCase() : '',
            `${p.relativeName || ''}${p.relation ? ' (' + p.relation + ')' : ''}`,
            p.hospital || '',
            formatMoney(isNaN(amtVal) ? 0 : amtVal)
          ]);
        });
        slNo++;
      });

      tableBody.push([
        { content: 'TOTAL', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: formatMoney(total), styles: { halign: 'right', fontStyle: 'bold' } }
      ]);

      tableHead = [['SL. NO.', 'NAME OF EMPLOYEE', 'NAME OF RELATIVES (RELATION)', 'NAME OF HOSPITAL', 'AMOUNT (Rs.)']];

      columnStyles = {
        0: { halign: 'center', cellWidth: 14 },
        1: { halign: 'left', cellWidth: 48 },
        2: { halign: 'left', cellWidth: 52 },
        3: { halign: 'left', cellWidth: 40 },
        4: { halign: 'right', cellWidth: 28 },
      };
    } else {
      total = (snap.billRows || []).reduce((sum, group) => {
        return sum + (group.bills || []).reduce((bSum, b) => {
          const v = parseFloat(b.amt);
          return bSum + (isNaN(v) ? 0 : v);
        }, 0);
      }, 0);

      let slNo = 1;
      (snap.billRows || []).forEach((group) => {
        const bills = group.bills || [];
        bills.forEach((b, bIdx) => {
          const amtVal = parseFloat(b.amt);
          tableBody.push([
            bIdx === 0 ? pad2(slNo) : '',
            bIdx === 0 ? (group.firm || '').toUpperCase() : '',
            b.bill || '',
            formatMoney(isNaN(amtVal) ? 0 : amtVal)
          ]);
        });
        slNo++;
      });

      tableBody.push([
        { content: 'TOTAL', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: formatMoney(total), styles: { halign: 'right', fontStyle: 'bold' } }
      ]);

      tableHead = [['SL. NO.', 'NAME OF FIRM', 'BILL NO & DATE', 'AMOUNT (Rs.)']];

      columnStyles = {
        0: { halign: 'center', cellWidth: 16 },
        1: { halign: 'left', cellWidth: 62 },
        2: { halign: 'left', cellWidth: 64 },
        3: { halign: 'right', cellWidth: 32 },
      };
    }

    const amtWords = numberToWordsIndian(total);
    const fy = currentFinancialYear();
    const ref = refNoFull(snap.refNo);

    // --------------------------------------------------------
    // Document layout (matches live preview spacing)
    // --------------------------------------------------------
    let y = 18; // top margin = 18mm

    // 1. Header: School ID & Phone
    doc.setFont('times', 'bold');
    doc.setFontSize(10);
    doc.text(`SCHOOL ID - ${snap.schoolId || ''}`, marginLeft, y);
    doc.text(`PHONE - ${snap.phone || ''}`, pageWidth - marginRight, y, { align: 'right' });

    // 2. School Name
    y += 7;
    doc.setFontSize(14.5);
    doc.text(snap.schoolName || 'SARVODAYA VIDYALAYA', pageWidth / 2, y, { align: 'center' });

    // 3. Address
    y += 5;
    doc.setFontSize(10.5);
    doc.setFont('times', 'normal');
    doc.text(snap.address || '', pageWidth / 2, y, { align: 'center' });

    // 4. Ref. No & Date
    y += 7;
    doc.setFont('times', 'bold');
    doc.setFontSize(10);
    doc.text(`Ref. No. ${ref}`, marginLeft, y);
    doc.text(`Dated: ${snap.date || ''}`, pageWidth - marginRight, y, { align: 'right' });

    // 5. Title: SANCTION ORDER (underlined, centered)
    y += 8;
    doc.setFontSize(12.5);
    doc.setFont('times', 'bold');
    doc.text('SANCTION ORDER', pageWidth / 2, y, { align: 'center' });
    const titleWidth = doc.getTextWidth('SANCTION ORDER');
    doc.setLineWidth(0.4);
    doc.line((pageWidth / 2) - (titleWidth / 2), y + 1.5, (pageWidth / 2) + (titleWidth / 2), y + 1.5);

    // 6. Body paragraph (inline bold for amount & budget head)
    y += 8;
    doc.setFontSize(10.5);
    const bodyEndY = drawMixedText(doc, [
      { text: 'Sanction is hereby conveyed for incurring an expenditure of ', bold: false },
      { text: `Rs. ${formatMoney(total)} (Rs. ${amtWords})`, bold: true },
      { text: ' for making payment under head ', bold: false },
      { text: snap.budgetHead || '', bold: true },
      { text: ' as per details below: --', bold: false },
    ], marginLeft, y, contentWidth, 5.5);
    y = bodyEndY + 3;

    // 7. Table
    y += 2;
    const tableConfig = {
      startY: y,
      margin: { left: marginLeft, right: marginRight },
      head: tableHead,
      body: tableBody,
      theme: 'grid',
      styles: {
        font: 'times',
        fontSize: 9.5,
        cellPadding: 1.8,
        textColor: [0, 0, 0],
        lineColor: [100, 116, 139],   // slate-500
        lineWidth: 0.25,
      },
      headStyles: {
        fillColor: [226, 232, 240],   // slate-200
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'left',
      },
      columnStyles: columnStyles,
      didParseCell: (data) => {
        if (data.section === 'head') {
          if (data.column.index === 0) data.cell.styles.halign = 'center';
          if (data.column.index === amountColIndex) data.cell.styles.halign = 'right';
        }
      }
    };

    if (typeof doc.autoTable === 'function') {
      doc.autoTable(tableConfig);
    } else if (typeof window.jspdfAutoTable === 'function') {
      window.jspdfAutoTable(doc, tableConfig);
    }

    const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) || (y + 40);
    y = finalY + 4;

    // 8. Paragraph 1 (Major Head + delegated powers)
    doc.setFontSize(10);
    const p1EndY = drawMixedText(doc, [
      { text: 'Major Head: ', bold: true },
      { text: snap.budgetHead || '', bold: true },
      { text: ' This Sanction has been accorded/conveyed in exercise of the powers delegated by the finance department Govt. NCT of Delhi and in consultation with account functionaries of the Department.', bold: false },
    ], marginLeft, y, contentWidth, 5);
    y = p1EndY + 4;

    // 9. Paragraph 2 (Prior approval)
    const p2EndY = drawMixedText(doc, [
      { text: 'This issues with the prior approval of Deputy Director of Education/Regional Director of Education/Head of department/Competent Authority/Secretary of Education.', bold: false },
    ], marginLeft, y, contentWidth, 5);
    y = p2EndY + 4;

    // 10. Paragraph 3 (Expenditure + year + Major Head)
    const p3EndY = drawMixedText(doc, [
      { text: 'The expenditure involved on this account would be debatable to the under mentioned Head of Account the year ', bold: false },
      { text: fy, bold: true },
      { text: ' under demand for Grant no. 6.', bold: false },
      { text: '\nMajor Head ', bold: false },
      { text: snap.budgetHead || '', bold: true },
    ], marginLeft, y, contentWidth, 5);
    y = p3EndY + 25;

    // 11. Signature
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.text('HEAD OF SCHOOL', pageWidth - marginRight, y, { align: 'right' });
    y += 8;

    // 12. Copy To
    doc.setFont('times', 'bold');
    doc.setFontSize(10);
    doc.text('Copy to:-', marginLeft, y);
    y += 5;

    doc.setFont('times', 'normal');
    doc.setFontSize(9.5);
    const copyLines = (snap.copyTo || '').split('\n').map(l => l.trim()).filter(Boolean);
    copyLines.forEach(line => {
      doc.text(line, marginLeft, y);
      y += 4.5;
    });
  });

  const arrayBuffer = doc.output('arraybuffer');
  return new Uint8Array(arrayBuffer);
}

// ------------------------------------------------------------------
// Append to existing PDF
// ------------------------------------------------------------------
export async function appendSanctionsToExistingPdf(existingPdfBytes, newSnapshots) {
  const newPdfBytes = await generateSingleOrMultiSanctionPdfBytes(newSnapshots);
  const PDFDocument = await getPdfLibDocument();
  const existingPdfDoc = await PDFDocument.load(existingPdfBytes);
  const newPdfDoc = await PDFDocument.load(newPdfBytes);
  const copiedPages = await existingPdfDoc.copyPages(newPdfDoc, newPdfDoc.getPageIndices());
  copiedPages.forEach((page) => {
    existingPdfDoc.addPage(page);
  });
  const mergedPdfBytes = await existingPdfDoc.save();
  return mergedPdfBytes;
}

// ------------------------------------------------------------------
// Download blob
// ------------------------------------------------------------------
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