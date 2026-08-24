import {
  todayStr,
  isValidDate,
  currentFinancialYear,
  refNoFull,
  formatMoney,
  numberToWordsIndian,
  pad2,
} from './utils/numberToWords.js';
import {
  generateSingleOrMultiSanctionPdfBytes,
  appendSanctionsToExistingPdf,
  downloadBlob,
} from './utils/pdfGenerator.js';

const BUDGET_HEADS = {
  'Normal Sanction': [
  '2202 02 109 96 00 28-GSS-Professional Services',
  '2202 02 101 94 00 01-Pre Primary-Salaries',
  '2202 02 101 94 00 05-Pre Primary-Rewards',
  '2202 02 101 94 00 06-Pre Primary-Medical Treatm.',
  '2202 02 101 94 00 07-Pre Primary-Allowances',
  '2202 01 101 94 00 21-Pre Primary-Supplies & Material',
  '2202 02 109 85 00 13-Improvement and expansion of teaching of Science at school stage-Office Expenses',
  '2202 02 109 87 00 01-Additional Schooling Facilities-Sal.',
  '2202 02 109 87 00 02-Additional Schooling Facilities-Wages',
  '2202 02 109 87 00 05-Additional Schooling Facilities-Rewards',
  '2202 02 109 87 00 06-Additional Schooling Facilities-Medical Treatment',
  '2202 02 109 87 00 07-Additional Schooling Facilities-Allowances',
  '2202 02 109 87 00 08-ASF (LTC)',
  '2202 02 109 87 00 11-ASF (DTE)',
  '2202 02 109 96 00 01-Govt. Sec. Schooling Salaries',
  '2202 02 109 96 00 05-Govt. Sec. Schooling Rewards',
  '2202 02 109 96 00 06-Govt. Sec. Schooling Medical',
  '2202 02 109 96 00 07-Govt. Sec. Schooling Allowances',
  '2202 02 109 96 00 08-Govt. Sec. Schooling-LTC',
  '2202 02 109 96 00 11-Govt. Sec. Schooling-DTE',
  '2202 02 109 96 00 13-GSS OE (i)-Elecricity,water',
  '2202 02 109 96 00 13-GSS OE (ii)-Office Exp.',
  '2202 02 109 96 00 13-GSS (iii)-Salary of Estate Manag',
  '2202 02 109 96 00 13-GSS (iv)-Security',
  '2202 02 109 96 00 13-GSS (vi)-aaya'
],
  'Vendor Sanction': [
  '2202 02 109 96 00 49-GSS-Other Revenue Expenditure',
  '2204 00 104 98 00 13-Promotion of Sports-Act. OE',
  '2202 02 052 95 00 21-School Extn. Prog. -S & Matls',
  '2202 02 053 97 00 27-VKS/SMC Minor Works',
  '2202 02 106 89 00 21-Free Supply of Text Book-S&M',
  '2202 02 108 99 00 21-Examination Reforms Branch',
  '2202 02 109 39 00 49-Science Of Living-OE',
  '2202 02 109 40 00 49-Rashtra Neeti-ORE',
  '2202 02 109 41 00 49-NIPUN: Sankalp Scheme',
  '2202 02 109 42 00 49-NEEV: New Era of Entrepreneurship',
  '2202 02 109 55 00 01-Inclusive Education (Salaries)',
  '2202 02 109 55 00 05-Inclusive Education (Bonus)',
  '2202 02 109 55 00 07-Inclusive Education (Allowances)',
  '2202 02 109 55 00 11-Inclusive Education(DTE)',
  '2202 02 109 89 00 21-Menstral Hygiene in Girls-S&M',
  '2202 02 109 90 00 13-YUVA-OE',
  '2202 02 109 90 00 21-YUVA Supplies and Material',
  '2202 80 789 97 00 21-Menstral Hygiene in Girls-SCSP-S&M',
  'GPF-8009 GPF'
],
};

const DEFAULT_COPY_TO = `1. PAO-19, Prasad Nagar
2. DDO SV, East Punjabi Bagh
3. AAO Audit cell, Dte. Of Edn.
4. Guard File`;

const HISTORY_KEY = 'som_history_v2_pdf';
const AUTOSAVE_KEY = 'som_autosave_v2_pdf';




class SanctionApp {
  constructor() {
    this.schoolId = '1515004';
    this.phone = '28313597';
    this.schoolName = 'SARVODAYA VIDYALAYA';
    this.address = 'EAST PUNJABI BAGH NEW DELHI - 26';
    this.refNo = '324';
    this.sanctionDate = todayStr();
    this.sanctionType = 'Vendor Sanction';
    this.budgetHead = '2202 02 053 97 00 27-VKS';
    this.copyTo = DEFAULT_COPY_TO;
    this.dateError = '';

    this.billRows = [
      { id: 1, firm: 'TOP SHOP TRADING', bill: 'INVOICE NO. 67 Dated 18/04/2026', amt: '6463.00' },
      { id: 2, firm: 'ENTERPRISES', bill: 'INVOICE NO. 80 Dated 20/04/2026', amt: '3399.00' },
      { id: 3, firm: 'AR ENTERPRISES', bill: 'INVOICE NO. 60 Dated 13/04/2026', amt: '1500.00' },
    ];
    this.rowSeq = 10;

    this.outputMode = 'new';
    this.appendedSnapshots = [];
    this.attachedPdfBytes = null;
    this.attachedPdfName = null;

    this.history = [];
    this.continueModalSelectedIds = [];
    this.toastTimeout = null;

    this.loadHistory();
    this.loadAutosave();
  }

  loadHistory() {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) {
        this.history = JSON.parse(stored);
      }
    } catch {
      this.history = [];
    }
  }

  saveHistoryToStorage() {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(this.history));
    } catch {
      // ignore
    }
    this.updateHistoryCountUI();
  }

  loadAutosave() {
    try {
      const stored = localStorage.getItem(AUTOSAVE_KEY);
      if (stored) {
        const snap = JSON.parse(stored);
        if (snap && typeof snap === 'object') {
          if (snap.schoolId !== undefined) this.schoolId = snap.schoolId;
          if (snap.phone !== undefined) this.phone = snap.phone;
          if (snap.schoolName !== undefined) this.schoolName = snap.schoolName;
          if (snap.address !== undefined) this.address = snap.address;
          if (snap.refNo !== undefined) this.refNo = snap.refNo;
          if (snap.date !== undefined) this.sanctionDate = snap.date;
          if (snap.sanctionType) this.sanctionType = snap.sanctionType;
          if (snap.budgetHead) this.budgetHead = snap.budgetHead;
          if (snap.copyTo !== undefined) this.copyTo = snap.copyTo;
          if (snap.billRows && snap.billRows.length > 0) {
            this.billRows = snap.billRows.map((r) => ({
              id: ++this.rowSeq,
              firm: r.firm || '',
              bill: r.bill || '',
              amt: r.amt || '',
            }));
          }
        }
      }
    } catch {
      // ignore
    }
  }

  saveAutosave() {
    try {
      const snap = this.getSnapshot();
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(snap));
    } catch {
      // ignore
    }
  }

  getSnapshot() {
    return {
      schoolId: (this.schoolId || '').trim(),
      phone: (this.phone || '').trim(),
      schoolName: (this.schoolName || '').trim(),
      address: (this.address || '').trim(),
      refNo: (this.refNo || '').trim(),
      date: (this.sanctionDate || '').trim(),
      sanctionType: this.sanctionType,
      budgetHead: this.budgetHead,
      copyTo: this.copyTo,
      billRows: this.billRows.map((r) => ({ firm: r.firm, bill: r.bill, amt: r.amt })),
    };
  }

  applySnapshot(snap, notify = true) {
    if (snap.schoolId !== undefined) this.schoolId = snap.schoolId;
    if (snap.phone !== undefined) this.phone = snap.phone;
    if (snap.schoolName !== undefined) this.schoolName = snap.schoolName;
    if (snap.address !== undefined) this.address = snap.address;
    if (snap.refNo !== undefined) this.refNo = snap.refNo;
    if (snap.date !== undefined) this.sanctionDate = snap.date;
    if (snap.sanctionType) this.sanctionType = snap.sanctionType;
    if (snap.budgetHead) this.budgetHead = snap.budgetHead;
    if (snap.copyTo !== undefined) this.copyTo = snap.copyTo;

    if (snap.billRows && snap.billRows.length > 0) {
      this.billRows = snap.billRows.map((r) => ({
        id: ++this.rowSeq,
        firm: r.firm || '',
        bill: r.bill || '',
        amt: r.amt || '',
      }));
    } else {
      this.billRows = [{ id: ++this.rowSeq, firm: '', bill: '', amt: '' }];
    }

    this.populateFormInputs();
    this.renderBudgetHeads();
    this.renderBillTableRows();
    this.updatePreview();
    this.saveAutosave();

    if (notify) {
      this.showToast('Draft loaded into editor.');
      this.updateStatus(`Loaded Ref No. ${snap.refNo || 'Draft'}`);
    }
  }

  calculateTotal() {
    return this.billRows.reduce((sum, r) => {
      const v = parseFloat(r.amt);
      return sum + (isNaN(v) ? 0 : v);
    }, 0);
  }

  validateDateInput(val) {
    const errorEl = document.getElementById('date-error-msg');
    const errorTextEl = document.getElementById('date-error-text');
    if (!isValidDate(val)) {
      this.dateError = val ? 'Invalid date format (DD/MM/YYYY)' : 'Date is required';
      if (errorEl && errorTextEl) {
        errorTextEl.textContent = this.dateError;
        errorEl.classList.remove('hidden');
      }
      return false;
    }
    this.dateError = '';
    if (errorEl) errorEl.classList.add('hidden');
    return true;
  }

  validateForm() {
    if (!this.schoolName.trim()) {
      this.showToast('School Name is required.', true);
      return false;
    }
    if (!this.budgetHead.trim()) {
      this.showToast('Budget Head must be selected.', true);
      return false;
    }
    if (!this.billRows.some((r) => r.firm.trim())) {
      this.showToast('At least one Firm name is required.', true);
      return false;
    }
    if (this.calculateTotal() <= 0) {
      this.showToast('Total amount must be greater than zero.', true);
      return false;
    }
    if (!this.validateDateInput(this.sanctionDate)) {
      this.showToast('Date must be valid DD/MM/YYYY.', true);
      return false;
    }
    return true;
  }

  showToast(message, isError = false) {
    const toastEl = document.getElementById('app-toast');
    if (!toastEl) return;

    if (this.toastTimeout) clearTimeout(this.toastTimeout);

    toastEl.className = `fixed bottom-12 right-6 z-50 px-4 py-2.5 rounded-lg shadow-xl text-xs font-semibold flex items-center gap-2 border transition-all duration-200 ${
      isError
        ? 'bg-red-50 text-red-900 border-red-300'
        : 'bg-slate-900 text-white border-slate-700'
    }`;
    toastEl.innerHTML = `
      <span class="inline-block w-2 h-2 rounded-full ${isError ? 'bg-red-500' : 'bg-blue-400'}"></span>
      <span>${message}</span>
    `;
    toastEl.classList.remove('hidden');

    this.toastTimeout = setTimeout(() => {
      toastEl.classList.add('hidden');
    }, 3200);
  }

  updateStatus(msg) {
    const el = document.getElementById('app-status-text');
    if (el) {
      el.innerHTML = `
        <span class="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
        <span>Status: ${msg}</span>
      `;
    }
  }

  updateHistoryCountUI() {
    const countEl = document.getElementById('history-nav-count');
    if (countEl) {
      countEl.textContent = `History (${this.history.length})`;
    }
  }

  populateFormInputs() {
    const fy = currentFinancialYear();

    const headerFyDate = document.getElementById('header-fy-date');
    if (headerFyDate) {
      headerFyDate.innerHTML = `<span class="text-slate-300 font-medium">FY ${fy}</span> &middot; ${todayStr()}`;
    }

    const prefixFy = document.getElementById('prefix-fy');
    if (prefixFy) {
      prefixFy.textContent = `SV/EPB/${fy.split('-')[0]}/`;
    }

    const refInput = document.getElementById('input-refNo');
    if (refInput) refInput.value = this.refNo;

    const dateInput = document.getElementById('input-sanctionDate');
    if (dateInput) dateInput.value = this.sanctionDate;

    const schoolIdInput = document.getElementById('input-schoolId');
    if (schoolIdInput) schoolIdInput.value = this.schoolId;

    const phoneInput = document.getElementById('input-phone');
    if (phoneInput) phoneInput.value = this.phone;

    const schoolNameInput = document.getElementById('input-schoolName');
    if (schoolNameInput) schoolNameInput.value = this.schoolName;

    const addressInput = document.getElementById('input-address');
    if (addressInput) addressInput.value = this.address;

    const copyToTextarea = document.getElementById('textarea-copyTo');
    if (copyToTextarea) copyToTextarea.value = this.copyTo;

    const sanctionTypeSelect = document.getElementById('select-sanctionType');
    if (sanctionTypeSelect) sanctionTypeSelect.value = this.sanctionType;

    this.validateDateInput(this.sanctionDate);
    this.updateHistoryCountUI();
  }
renderBudgetHeads() {
  const select = document.getElementById('select-budgetHead');
  if (!select) return;

  const heads = BUDGET_HEADS[this.sanctionType] || [];

  // Destroy existing Tom Select instance
  if (select.tomselect) {
    select.tomselect.destroy();
  }

  // IMPORTANT: clear the application's current budget head
  this.budgetHead = '';

  // Prepare options
  const options = heads.map((head) => {
    const dashIndex = head.indexOf('-');

    const code = dashIndex !== -1
      ? head.substring(0, dashIndex)
      : head;

    const compactCode = code.replace(/\s+/g, '');

    return {
      value: head,
      text: head,
      code: code,
      compactCode: compactCode
    };
  });

  // Clear the original select
  select.innerHTML = '';

  // Initialize Tom Select
  const ts = new TomSelect(select, {
    options: options,

    valueField: 'value',
    labelField: 'text',

    searchField: [
      'text',
      'code',
      'compactCode'
    ],

    create: false,
    maxOptions: null,

    placeholder: 'Search Budget Head...',

    // Explicitly start with NO selection
    items: []
  });

  // Make absolutely sure nothing is selected
  ts.clear(true);
}
  
 renderBillTableRows() {
    const tbody = document.getElementById('bill-table-body');
    const rowsCount = document.getElementById('bill-rows-count');
    if (rowsCount) {
      rowsCount.textContent = `${this.billRows.length} item${this.billRows.length === 1 ? '' : 's'}`;
    }

    if (!tbody) return;
    tbody.innerHTML = '';

    this.billRows.forEach((row, index) => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition-colors';
      tr.innerHTML = `
        <td class="p-2 text-center text-slate-400 font-mono text-[11px]">${pad2(index + 1)}</td>
        <td class="p-1.5">
          <input
            type="text"
            placeholder="Firm Name"
            value="${row.firm || ''}"
            data-row-id="${row.id}"
            data-field="firm"
            class="bill-input w-full px-2 py-1 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none uppercase"
          />
        </td>
        <td class="p-1.5">
          <input
            type="text"
            placeholder="e.g. INV-12 Dt. 12/04/26"
            value="${row.bill || ''}"
            data-row-id="${row.id}"
            data-field="bill"
            class="bill-input w-full px-2 py-1 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </td>
        <td class="p-1.5 text-right">
          <input
            type="number"
            step="0.01"
            placeholder="0.00"
            value="${row.amt || ''}"
            data-row-id="${row.id}"
            data-field="amt"
            class="bill-input w-full px-2 py-1 border border-slate-200 rounded text-xs font-mono text-right focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </td>
        <td class="p-1.5 text-center">
          <div class="flex items-center justify-center gap-1">
            <button
              type="button"
              data-duplicate-row-id="${row.id}"
              class="btn-duplicate-row text-slate-400 hover:text-blue-600 transition-colors p-1 cursor-pointer"
              title="Duplicate row"
            >
              <i data-lucide="copy"  width="16" height="16" color="#000"></i>  
            </button>
            <button
              type="button"
              data-delete-row-id="${row.id}"
              class="btn-delete-row text-slate-400 hover:text-red-600 transition-colors p-1 cursor-pointer"
              title="Delete row"
            >
              <i data-lucide="trash" width="16" height="16" color="#000"></i> 
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    const total = this.calculateTotal();
    const formattedTotal = formatMoney(total);
    const words = numberToWordsIndian(total);

    const formTotalAmt = document.getElementById('form-total-amt');
    if (formTotalAmt) formTotalAmt.textContent = `Rs. ${formattedTotal}`;

    const formTotalWords = document.getElementById('form-total-words');
    if (formTotalWords) formTotalWords.textContent = words;

if (window.lucide && tbody) {
  lucide.createIcons({
    root: tbody
  });
}
    
  }

  generatePageHtml(snap, pageIndex = 1, totalPages = 1) {
    const rows = snap.billRows || [];
    const total = rows.reduce((sum, r) => {
      const v = parseFloat(r.amt);
      return sum + (isNaN(v) ? 0 : v);
    }, 0);
    const formattedTotal = formatMoney(total);
    const amtWords = numberToWordsIndian(total);
    const fy = currentFinancialYear();
    const fullRef = refNoFull(snap.refNo);
    const copyLines = (snap.copyTo || '').split('\n').map((l) => l.trim()).filter(Boolean);

    const billRowsHtml = rows.map((r, idx) => {
      const amtVal = parseFloat(r.amt);
      return `
        <tr>
          <td class="border border-slate-500 px-2 py-1 text-center font-bold">${pad2(idx + 1)}</td>
          <td class="border border-slate-500 px-2 py-1 font-bold uppercase">${r.firm || ''}</td>
          <td class="border border-slate-500 px-2 py-1">${r.bill || ''}</td>
          <td class="border border-slate-500 px-2 py-1 text-right">${formatMoney(isNaN(amtVal) ? 0 : amtVal)}</td>
        </tr>
      `;
    }).join('');

    const copyToHtml = copyLines.map((line) => `<li>${line}</li>`).join('');

    const badgeHtml = totalPages > 1 ? `
      <div class="doc-page-sep mb-3 flex items-center justify-between pb-2 border-b border-slate-200 text-xs font-sans text-slate-500 font-medium print:hidden">
        <span class="bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded text-[11px]">
          Order ${pageIndex} of ${totalPages}
        </span>
        <span class="font-mono text-[11px] text-slate-400">Ref: ${fullRef}</span>
      </div>
    ` : '';

    return `
      <div
        class="doc-page-block w-full max-w-[210mm] min-h-[297mm] bg-white shadow-xl rounded-sm p-[18mm] text-black border border-slate-300/80 box-border relative"
        style="font-family: 'Tinos', 'Times New Roman', Times, serif;"
      >
        ${badgeHtml}
        <div class="flex justify-between items-center text-[13px] font-bold tracking-tight">
          <div>SCHOOL ID - <span>${snap.schoolId || ''}</span></div>
          <div>PHONE - <span>${snap.phone || ''}</span></div>
        </div>

        <div class="text-center mt-2.5">
          <h2 class="text-[19px] font-bold uppercase tracking-wide leading-tight">
            ${snap.schoolName || 'SARVODAYA VIDYALAYA'}
          </h2>
        </div>

        <div class="text-center mt-1">
          <p class="text-[14px] leading-tight">
            ${snap.address || ''}
          </p>
        </div>

        <div class="flex justify-between items-center mt-3 text-[13px] font-bold">
          <div>Ref. No. <span>${fullRef}</span></div>
          <div>Dated: <span>${snap.date || todayStr()}</span></div>
        </div>

        <div class="text-center mt-3.5">
          <span class="text-[16px] font-bold uppercase underline tracking-wider inline-block">
            SANCTION ORDER
          </span>
        </div>

        <p class="mt-3 text-[13.5px] leading-relaxed text-justify">
          Sanction is hereby conveyed for incurring an expenditure of 
          <strong class="font-bold">Rs. <span>${formattedTotal}</span></strong> 
          (<strong class="font-bold">Rs. <span>${amtWords}</span></strong>) 
          for making payment under head 
          <strong class="font-bold"><span>${snap.budgetHead || ''}</span></strong> 
          as per details below: --
        </p>

        <table class="w-full mt-3 border-collapse border border-slate-500 text-[12.5px]">
          <thead>
            <tr class="bg-slate-200 text-black font-bold">
              <th class="border border-slate-500 px-2 py-1 text-center w-14">SL. NO.</th>
              <th class="border border-slate-500 px-2 py-1 text-left">NAME OF FIRM</th>
              <th class="border border-slate-500 px-2 py-1 text-left">BILL NO &amp; DATE</th>
              <th class="border border-slate-500 px-2 py-1 text-right w-28">AMOUNT (Rs.)</th>
            </tr>
          </thead>
          <tbody>
            ${billRowsHtml}
          </tbody>
          <tfoot>
            <tr class="font-bold">
              <td colspan="3" class="border border-slate-500 px-2 py-1 text-right">TOTAL</td>
              <td class="border border-slate-500 px-2 py-1 text-right">${formattedTotal}</td>
            </tr>
          </tfoot>
        </table>

        <p class="mt-4 text-[12.5px] leading-relaxed text-justify">
          <strong class="font-bold">Major Head: <span>${snap.budgetHead || ''}</span></strong> 
          This Sanction has been accorded/conveyed in exercise of the powers delegated by the finance department Govt. NCT of Delhi and in consultation with account functionaries of the Department.
        </p>

        <p class="mt-2 text-[12.5px] leading-relaxed text-justify">
          This issues with the prior approval of Deputy Director of Education/Regional Director of Education/Head of department/Competent Authority/Secretary of Education.
        </p>

        <p class="mt-2 text-[12.5px] leading-relaxed text-justify">
          The expenditure involved on this account would be debatable to the under mentioned Head of Account the year <span>${fy}</span> under demand for Grant no. 6.<br>
          <strong class="font-bold">Major Head <span>${snap.budgetHead || ''}</span></strong>
        </p>

        <div class="mt-8 flex justify-end">
          <div class="text-right font-bold text-[13.5px]">
            HEAD OF SCHOOL
          </div>
        </div>

        <div class="mt-4 text-[12.5px]">
          <div class="font-bold">Copy to:-</div>
          <ol class="list-none pl-0 mt-1 space-y-0.5 leading-snug">
            ${copyToHtml}
          </ol>
        </div>
      </div>
    `;
  }

  updatePreview() {
    const container = document.getElementById('doc-pages-container');
    if (!container) return;

    const currentSnap = this.getSnapshot();
    let snapshots = [currentSnap];

    if (this.outputMode === 'continue' && this.appendedSnapshots.length > 0) {
      snapshots = [...this.appendedSnapshots, currentSnap];
    }

    container.innerHTML = snapshots
      .map((snap, idx) => this.generatePageHtml(snap, idx + 1, snapshots.length))
      .join('');
  }

  saveCurrentToHistory() {
    const total = this.calculateTotal();
    const snap = this.getSnapshot();
    const historyItem = {
      id: Date.now().toString(),
      savedAt: new Date().toISOString(),
      refNo: snap.refNo,
      date: snap.date,
      schoolName: snap.schoolName,
      budgetHead: snap.budgetHead,
      totalAmount: total,
      itemCount: snap.billRows.length,
      snapshot: snap,
    };

    this.history.unshift(historyItem);
    if (this.history.length > 50) this.history.pop();
    this.saveHistoryToStorage();
    this.showToast(`Sanction Ref. ${snap.refNo || 'Draft'} saved to history.`);
  }

  renderHistoryList() {
    const container = document.getElementById('history-list-container');
    if (!container) return;

    if (this.history.length === 0) {
      container.innerHTML = `
        <div class="py-12 text-center text-slate-400 text-xs">
          No saved sanction orders yet.<br>Save a draft or generate a PDF to see it here.
        </div>
      `;
      return;
    }

    container.innerHTML = this.history
      .map((item) => {
        const fullRef = refNoFull(item.refNo);
        return `
          <div class="py-3 flex items-center justify-between group">
            <div class="space-y-0.5">
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-slate-900">Ref. ${fullRef}</span>
                <span class="text-[10px] text-slate-400 font-mono">${item.date || ''}</span>
              </div>
              <div class="text-[11px] text-slate-600">
                <span class="font-semibold text-slate-800">Rs. ${formatMoney(item.totalAmount)}</span> &middot; ${item.itemCount} items &middot; <span class="font-mono text-slate-500">${item.budgetHead || ''}</span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button
                type="button"
                data-load-history-id="${item.id}"
                class="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs rounded transition-colors cursor-pointer"
              >
                Load
              </button>
              <button
                type="button"
                data-delete-history-id="${item.id}"
                class="text-slate-400 hover:text-red-600 p-1 transition-colors cursor-pointer"
                title="Delete item"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
              </button>
            </div>
          </div>
        `;
      })
      .join('');
  }

  renderContinueModalList() {
    const list = document.getElementById('continue-drafts-list');
    if (!list) return;

    if (this.history.length === 0) {
      list.innerHTML = `
        <div class="py-8 text-center text-slate-400 text-xs">
          No history items available to chain. Save orders to history first.
        </div>
      `;
      return;
    }

    list.innerHTML = this.history
      .map((item) => {
        const isChecked = this.continueModalSelectedIds.includes(item.id);
        const fullRef = refNoFull(item.refNo);
        return `
          <label class="flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
            isChecked ? 'bg-blue-50/70 border-blue-300' : 'bg-white border-slate-200 hover:bg-slate-50'
          }">
            <div class="flex items-center gap-3">
              <input
                type="checkbox"
                value="${item.id}"
                class="continue-item-checkbox accent-blue-600 w-4 h-4"
                ${isChecked ? 'checked' : ''}
              />
              <div>
                <div class="text-xs font-bold text-slate-800">Ref: ${fullRef}</div>
                <div class="text-[11px] text-slate-500">${item.date} &middot; Rs. ${formatMoney(item.totalAmount)}</div>
              </div>
            </div>
            <span class="text-[10px] font-mono text-slate-400">${item.itemCount} items</span>
          </label>
        `;
      })
      .join('');
  }

  async handleExportPdf() {
    if (!this.validateForm()) return;

    const btn = document.getElementById('btn-export-pdf');
    const label = document.getElementById('export-btn-label');
    if (btn) btn.disabled = true;
    if (label) label.textContent = 'Generating PDF...';

    try {
      const currentSnap = this.getSnapshot();
      let pdfBytes;
      let filename = `Sanction_Order_${this.refNo || 'Draft'}_${todayStr().replace(/\//g, '-')}.pdf`;

      if (this.attachedPdfBytes) {
        this.updateStatus('Appending to existing PDF...');
        pdfBytes = await appendSanctionsToExistingPdf(this.attachedPdfBytes, [currentSnap]);
        filename = `Appended_${this.attachedPdfName || 'Document.pdf'}`;
      } else if (this.outputMode === 'continue' && this.appendedSnapshots.length > 0) {
        this.updateStatus('Generating multi-page combined PDF...');
        pdfBytes = await generateSingleOrMultiSanctionPdfBytes([...this.appendedSnapshots, currentSnap]);
        filename = `Combined_Sanction_Orders_${todayStr().replace(/\//g, '-')}.pdf`;
      } else {
        this.updateStatus('Generating single sanction PDF...');
        pdfBytes = await generateSingleOrMultiSanctionPdfBytes([currentSnap]);
      }

      downloadBlob(pdfBytes, filename);
      this.saveCurrentToHistory();
      this.showToast('PDF generated and downloaded successfully!');
      this.updateStatus(`Downloaded: ${filename}`);
    } catch (err) {
      console.error('PDF export error:', err);
      this.showToast(`Error creating PDF: ${err.message || 'Check console'}`, true);
      this.updateStatus('PDF export failed');
    } finally {
      if (btn) btn.disabled = false;
      this.updateExportBtnLabel();
    }
  }

  updateExportBtnLabel() {
    const label = document.getElementById('export-btn-label');
    if (!label) return;

    if (this.attachedPdfBytes) {
      label.textContent = 'Append Sanction to Existing PDF & Download';
    } else if (this.outputMode === 'continue' && this.appendedSnapshots.length > 0) {
      label.textContent = `Generate Combined (${this.appendedSnapshots.length + 1} Orders) PDF`;
    } else {
      label.textContent = 'Generate & Download PDF';
    }
  }

  bindEvents() {
    // Reference Number
    const inputRef = document.getElementById('input-refNo');
    if (inputRef) {
      inputRef.addEventListener('input', (e) => {
        this.refNo = e.target.value;
        this.updatePreview();
        this.saveAutosave();
      });
    }

    // Sanction Date
    const inputDate = document.getElementById('input-sanctionDate');
    if (inputDate) {
      inputDate.addEventListener('input', (e) => {
        this.sanctionDate = e.target.value;
        this.validateDateInput(this.sanctionDate);
        this.updatePreview();
        this.saveAutosave();
      });
    }

    // Today Button
    const btnToday = document.getElementById('btn-set-today');
    if (btnToday) {
      btnToday.addEventListener('click', () => {
        this.sanctionDate = todayStr();
        if (inputDate) inputDate.value = this.sanctionDate;
        this.validateDateInput(this.sanctionDate);
        this.updatePreview();
        this.saveAutosave();
      });
    }

    // Sanction Type
    const selectType = document.getElementById('select-sanctionType');
    if (selectType) {
      selectType.addEventListener('change', (e) => {
        this.sanctionType = e.target.value;
        this.renderBudgetHeads();
        this.updatePreview();
        this.saveAutosave();
      });
    }

    // Budget Head
    const selectHead = document.getElementById('select-budgetHead');
    if (selectHead) {
      selectHead.addEventListener('change', (e) => {
        this.budgetHead = e.target.value;
        this.updatePreview();
        this.saveAutosave();
      });
    }

    // School Profile inputs
    const inputSchoolId = document.getElementById('input-schoolId');
    if (inputSchoolId) {
      inputSchoolId.addEventListener('input', (e) => {
        this.schoolId = e.target.value;
        this.updatePreview();
        this.saveAutosave();
      });
    }

    const inputPhone = document.getElementById('input-phone');
    if (inputPhone) {
      inputPhone.addEventListener('input', (e) => {
        this.phone = e.target.value;
        this.updatePreview();
        this.saveAutosave();
      });
    }

    const inputSchoolName = document.getElementById('input-schoolName');
    if (inputSchoolName) {
      inputSchoolName.addEventListener('input', (e) => {
        this.schoolName = e.target.value;
        this.updatePreview();
        this.saveAutosave();
      });
    }

    const inputAddress = document.getElementById('input-address');
    if (inputAddress) {
      inputAddress.addEventListener('input', (e) => {
        this.address = e.target.value;
        this.updatePreview();
        this.saveAutosave();
      });
    }

    // Copy To Textarea
    const textareaCopyTo = document.getElementById('textarea-copyTo');
    if (textareaCopyTo) {
      textareaCopyTo.addEventListener('input', (e) => {
        this.copyTo = e.target.value;
        this.updatePreview();
        this.saveAutosave();
      });
    }

    // Add Bill Row
    const btnAddRow = document.getElementById('btn-add-bill-row');
    if (btnAddRow) {
      btnAddRow.addEventListener('click', () => {
        this.billRows.push({ id: ++this.rowSeq, firm: '', bill: '', amt: '' });
        this.renderBillTableRows();
        this.updatePreview();
        this.saveAutosave();
      });
    }

    // Bill Table Input & Delete Event Delegation
    const billTableBody = document.getElementById('bill-table-body');
    if (billTableBody) {
      billTableBody.addEventListener('input', (e) => {
        if (e.target.classList.contains('bill-input')) {
          const rowId = parseInt(e.target.dataset.rowId, 10);
          const field = e.target.dataset.field;
          const row = this.billRows.find((r) => r.id === rowId);
          if (row) {
            row[field] = e.target.value;
            const total = this.calculateTotal();
            const formTotalAmt = document.getElementById('form-total-amt');
            if (formTotalAmt) formTotalAmt.textContent = `Rs. ${formatMoney(total)}`;
            const formTotalWords = document.getElementById('form-total-words');
            if (formTotalWords) formTotalWords.textContent = numberToWordsIndian(total);
            this.updatePreview();
            this.saveAutosave();
          }
        }
      });

      billTableBody.addEventListener('click', (e) => {
        const duplicateBtn = e.target.closest('.btn-duplicate-row');
        if (duplicateBtn) {
          const rowId = parseInt(duplicateBtn.dataset.duplicateRowId, 10);
          const index = this.billRows.findIndex((r) => r.id === rowId);
          if (index !== -1) {
            const source = this.billRows[index];
            const copy = { id: ++this.rowSeq, firm: source.firm, bill: source.bill, amt: source.amt };
            this.billRows.splice(index + 1, 0, copy);
            this.renderBillTableRows();
            this.updatePreview();
            this.saveAutosave();
          }
          return;
        }

        const deleteBtn = e.target.closest('.btn-delete-row');
        if (deleteBtn) {
          const rowId = parseInt(deleteBtn.dataset.deleteRowId, 10);
          if (this.billRows.length <= 1) {
            this.showToast('At least one bill row is required.', true);
            return;
          }
          this.billRows = this.billRows.filter((r) => r.id !== rowId);
          this.renderBillTableRows();
          this.updatePreview();
          this.saveAutosave();
        }
      });
    }

    // Output Mode Radios
    const radioNew = document.getElementById('radio-mode-new');
    const radioContinue = document.getElementById('radio-mode-continue');
    const labelNew = document.getElementById('label-mode-new');
    const labelContinue = document.getElementById('label-mode-continue');
    const continueConfigWrap = document.getElementById('continue-config-btn-wrap');

    const updateModeUI = (mode) => {
      this.outputMode = mode;
      if (mode === 'new') {
        if (labelNew) labelNew.className = 'flex items-center gap-3 cursor-pointer p-3 rounded-lg border transition-all bg-blue-50 border-blue-200 shadow-2xs';
        if (labelContinue) labelContinue.className = 'flex items-center gap-3 cursor-pointer p-3 rounded-lg border transition-all border-slate-200 hover:bg-slate-50';
        if (continueConfigWrap) continueConfigWrap.classList.add('hidden');
      } else {
        if (labelNew) labelNew.className = 'flex items-center gap-3 cursor-pointer p-3 rounded-lg border transition-all border-slate-200 hover:bg-slate-50';
        if (labelContinue) labelContinue.className = 'flex items-center gap-3 cursor-pointer p-3 rounded-lg border transition-all bg-blue-50 border-blue-200 shadow-2xs';
        if (continueConfigWrap) continueConfigWrap.classList.remove('hidden');
      }
      this.updateExportBtnLabel();
      this.updatePreview();
    };

    if (radioNew) radioNew.addEventListener('change', () => updateModeUI('new'));
    if (radioContinue) radioContinue.addEventListener('change', () => updateModeUI('continue'));

    // Append Existing PDF File Picker
    const btnChoosePdf = document.getElementById('btn-choose-append-pdf');
    const inputFilePdf = document.getElementById('input-file-append-pdf');
    const attachedWrap = document.getElementById('attached-pdf-name-wrap');
    const attachedFilename = document.getElementById('attached-pdf-filename');
    const btnReplacePdf = document.getElementById('btn-replace-attached-pdf');
    const btnRemovePdf = document.getElementById('btn-remove-attached-pdf');

    if (btnChoosePdf && inputFilePdf) {
      btnChoosePdf.addEventListener('click', () => inputFilePdf.click());
    }
    if (btnReplacePdf && inputFilePdf) {
      btnReplacePdf.addEventListener('click', () => inputFilePdf.click());
    }

    if (inputFilePdf) {
      inputFilePdf.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
          this.attachedPdfBytes = new Uint8Array(reader.result);
          this.attachedPdfName = file.name;
          if (attachedFilename) attachedFilename.textContent = file.name;
          if (attachedWrap) attachedWrap.classList.remove('hidden');
          if (btnChoosePdf) btnChoosePdf.classList.add('hidden');
          if (btnRemovePdf) btnRemovePdf.classList.remove('hidden');
          this.updateExportBtnLabel();
          this.showToast(`Loaded "${file.name}" for appending.`);
          this.updateStatus(`Target PDF attached: ${file.name}`);
        };
        reader.readAsArrayBuffer(file);
      });
    }

    if (btnRemovePdf) {
      btnRemovePdf.addEventListener('click', () => {
        this.attachedPdfBytes = null;
        this.attachedPdfName = null;
        if (inputFilePdf) inputFilePdf.value = '';
        if (attachedWrap) attachedWrap.classList.add('hidden');
        if (btnChoosePdf) btnChoosePdf.classList.remove('hidden');
        if (btnRemovePdf) btnRemovePdf.classList.add('hidden');
        this.updateExportBtnLabel();
        this.showToast('Detached existing PDF file.');
      });
    }

    // Primary Action Buttons
    const btnExportPdf = document.getElementById('btn-export-pdf');
    if (btnExportPdf) {
      btnExportPdf.addEventListener('click', () => this.handleExportPdf());
    }

    const btnPrint = document.getElementById('btn-print-sanction');
    if (btnPrint) {
      btnPrint.addEventListener('click', () => window.print());
    }

    const btnPreviewPrint = document.getElementById('btn-preview-print');
    if (btnPreviewPrint) {
      btnPreviewPrint.addEventListener('click', () => window.print());
    }

    const btnSaveDraft = document.getElementById('btn-save-draft');
    if (btnSaveDraft) {
      btnSaveDraft.addEventListener('click', () => this.saveCurrentToHistory());
    }

    const btnReset = document.getElementById('btn-reset-form');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        this.schoolId = '1515004';
        this.phone = '28313597';
        this.schoolName = 'SARVODAYA VIDYALAYA';
        this.address = 'EAST PUNJABI BAGH NEW DELHI - 26';
        this.refNo = '324';
        this.sanctionDate = todayStr();
        this.sanctionType = 'Vendor Sanction';
        this.budgetHead = '2202 02 053 97 00 27-VKS';
        this.copyTo = DEFAULT_COPY_TO;
        this.billRows = [
          { id: ++this.rowSeq, firm: 'TOP SHOP TRADING', bill: 'INVOICE NO. 67 Dated 18/04/2026', amt: '6463.00' },
          { id: ++this.rowSeq, firm: 'ENTERPRISES', bill: 'INVOICE NO. 80 Dated 20/04/2026', amt: '3399.00' },
          { id: ++this.rowSeq, firm: 'AR ENTERPRISES', bill: 'INVOICE NO. 60 Dated 13/04/2026', amt: '1500.00' },
        ];
        this.populateFormInputs();
        this.renderBudgetHeads();
        this.renderBillTableRows();
        this.updatePreview();
        this.saveAutosave();
        this.showToast('Reset form to sample Delhi template.');
      });
    }

    // History Modal
    const historyModal = document.getElementById('history-modal');
    const btnOpenHistory = document.getElementById('btn-open-history');
    const btnCloseHistory = document.getElementById('btn-close-history-modal');
    const btnClearHistory = document.getElementById('btn-clear-all-history');

    if (btnOpenHistory && historyModal) {
      btnOpenHistory.addEventListener('click', () => {
        this.renderHistoryList();
        historyModal.classList.remove('hidden');
      });
    }
    if (btnCloseHistory && historyModal) {
      btnCloseHistory.addEventListener('click', () => historyModal.classList.add('hidden'));
    }
    if (historyModal) {
      historyModal.addEventListener('click', (e) => {
        if (e.target === historyModal) historyModal.classList.add('hidden');
      });
    }
    if (btnClearHistory) {
      btnClearHistory.addEventListener('click', () => {
        this.history = [];
        this.saveHistoryToStorage();
        this.renderHistoryList();
        this.showToast('Cleared all history.');
      });
    }

    const historyListContainer = document.getElementById('history-list-container');
    if (historyListContainer) {
      historyListContainer.addEventListener('click', (e) => {
        const loadBtn = e.target.closest('[data-load-history-id]');
        if (loadBtn) {
          const id = loadBtn.dataset.loadHistoryId;
          const item = this.history.find((h) => h.id === id);
          if (item && item.snapshot) {
            this.applySnapshot(item.snapshot, true);
            if (historyModal) historyModal.classList.add('hidden');
          }
        }

        const deleteBtn = e.target.closest('[data-delete-history-id]');
        if (deleteBtn) {
          const id = deleteBtn.dataset.deleteHistoryId;
          this.history = this.history.filter((h) => h.id !== id);
          this.saveHistoryToStorage();
          this.renderHistoryList();
        }
      });
    }

    // Continue Multi-Draft Modal
    const continueModal = document.getElementById('continue-modal');
    const btnOpenContinueModal = document.getElementById('btn-open-continue-modal');
    const btnCloseContinueModal = document.getElementById('btn-close-continue-modal');
    const btnApplyContinue = document.getElementById('btn-apply-continue-selection');
    const chainedBadge = document.getElementById('chained-badge');

    if (btnOpenContinueModal && continueModal) {
      btnOpenContinueModal.addEventListener('click', () => {
        this.renderContinueModalList();
        continueModal.classList.remove('hidden');
      });
    }
    if (btnCloseContinueModal && continueModal) {
      btnCloseContinueModal.addEventListener('click', () => continueModal.classList.add('hidden'));
    }
    if (continueModal) {
      continueModal.addEventListener('click', (e) => {
        if (e.target === continueModal) continueModal.classList.add('hidden');
      });
    }
    if (btnApplyContinue) {
      btnApplyContinue.addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('.continue-item-checkbox:checked');
        this.continueModalSelectedIds = Array.from(checkboxes).map((cb) => cb.value);
        this.appendedSnapshots = this.history
          .filter((h) => this.continueModalSelectedIds.includes(h.id))
          .map((h) => h.snapshot);

        if (chainedBadge) {
          if (this.appendedSnapshots.length > 0) {
            chainedBadge.textContent = `${this.appendedSnapshots.length} chained`;
            chainedBadge.classList.remove('hidden');
          } else {
            chainedBadge.classList.add('hidden');
          }
        }
        if (continueModal) continueModal.classList.add('hidden');
        this.updateExportBtnLabel();
        this.updatePreview();
        this.showToast(`Selected ${this.appendedSnapshots.length} drafts to chain.`);
      });
    }

    // JSON Backup Modal
    const jsonModal = document.getElementById('json-modal');
    const btnOpenJson = document.getElementById('btn-open-json-modal');
    const btnCloseJson = document.getElementById('btn-close-json-modal');
    const btnExportJson = document.getElementById('btn-export-json-file');
    const btnImportJson = document.getElementById('btn-import-json-file');
    const inputImportJson = document.getElementById('input-import-json-file');

    if (btnOpenJson && jsonModal) {
      btnOpenJson.addEventListener('click', () => jsonModal.classList.remove('hidden'));
    }
    if (btnCloseJson && jsonModal) {
      btnCloseJson.addEventListener('click', () => jsonModal.classList.add('hidden'));
    }
    if (jsonModal) {
      jsonModal.addEventListener('click', (e) => {
        if (e.target === jsonModal) jsonModal.classList.add('hidden');
      });
    }

    if (btnExportJson) {
      btnExportJson.addEventListener('click', () => {
        const payload = {
          version: '2.4',
          exportedAt: new Date().toISOString(),
          currentSnapshot: this.getSnapshot(),
          history: this.history,
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Sanction_Backup_${todayStr().replace(/\//g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        this.showToast('Downloaded JSON backup file.');
      });
    }

    if (btnImportJson && inputImportJson) {
      btnImportJson.addEventListener('click', () => inputImportJson.click());
      inputImportJson.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
          try {
            const data = JSON.parse(reader.result);
            if (data.currentSnapshot) {
              this.applySnapshot(data.currentSnapshot, false);
            }
            if (Array.isArray(data.history)) {
              this.history = data.history;
              this.saveHistoryToStorage();
            }
            if (jsonModal) jsonModal.classList.add('hidden');
            this.showToast('Restored draft & history from backup file.');
          } catch (err) {
            this.showToast('Invalid backup file format.', true);
          }
        };
        reader.readAsText(file);
      });
    }
  }

  init() {
    this.populateFormInputs();
    this.renderBudgetHeads();
    this.renderBillTableRows();
    this.updatePreview();
    this.bindEvents();
    this.updateExportBtnLabel();
    this.updateStatus('Ready');
  }
}

// Bootstrap Vanilla JS App
function bootstrapSanctionApp() {
  const app = new SanctionApp();
  app.init();
  window.sanctionApp = app; // exposed for the debug-blank-page.js diagnostic script
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapSanctionApp);
} else {
  bootstrapSanctionApp();
}

if (window.lucide) {
  lucide.createIcons();
}