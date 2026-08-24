const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
  "Eighteen", "Nineteen"
];

const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
];

function twoDigitWords(n) {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const r = n % 10;
  return TENS[t] + (r ? " " + ONES[r] : "");
}

function threeDigitWords(n) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  let s = "";
  if (h) s += ONES[h] + " Hundred";
  if (r) s += (s ? " " : "") + twoDigitWords(r);
  return s;
}

export function numberToWordsIndian(amount) {
  amount = Math.round(amount * 100) / 100;
  let rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  if (rupees === 0 && paise === 0) return "ZERO ONLY";

  const crore = Math.floor(rupees / 10000000);
  rupees %= 10000000;
  const lakh = Math.floor(rupees / 100000);
  rupees %= 100000;
  const thousand = Math.floor(rupees / 1000);
  rupees %= 1000;
  const rest = rupees;

  const parts = [];
  if (crore) parts.push(threeDigitWords(crore) + " Crore");
  if (lakh) parts.push(threeDigitWords(lakh) + " Lakh");
  if (thousand) parts.push(threeDigitWords(thousand) + " Thousand");
  if (rest) parts.push(threeDigitWords(rest));

  let words = parts.join(" ").trim();
  words = words ? words.toUpperCase() : "ZERO";

  if (paise > 0) {
    return words + " AND " + twoDigitWords(paise).toUpperCase() + " PAISE ONLY";
  }
  return words + " ONLY";
}

export function pad2(n) {
  return n < 10 ? "0" + n : "" + n;
}

export function formatMoney(n) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function currentFinancialYear() {
  const t = new Date();
  const y = t.getFullYear();
  const m = t.getMonth() + 1;
  return m >= 4 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

export function todayStr() {
  const t = new Date();
  return `${pad2(t.getDate())}/${pad2(t.getMonth() + 1)}/${t.getFullYear()}`;
}

export function isValidDate(str) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return false;
  const parts = str.split("/");
  const dd = parseInt(parts[0], 10);
  const mm = parseInt(parts[1], 10);
  const yyyy = parseInt(parts[2], 10);
  if (mm < 1 || mm > 12) return false;
  const d = new Date(yyyy, mm - 1, dd);
  return d.getFullYear() === yyyy && d.getMonth() + 1 === mm && d.getDate() === dd;
}

export function refNoFull(refNo) {
  const raw = refNo ? refNo.trim() : "";
  if (raw.startsWith("SV/")) return raw;
  const fyYear = currentFinancialYear().split("-")[0];
  return `SV/EPB/${fyYear}/${raw}`;
}
