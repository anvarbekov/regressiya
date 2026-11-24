/**
 * CSV / jadval matnini tahlil qilish.
 * – Ajratuvchini avtomatik aniqlaydi: vergul, nuqtali vergul, tab, bo‘shliq
 * – Qo‘shtirnoqli maydonlar, o‘nlik vergul (3,14), sarlavha qatori
 * – Bo‘sh yoki noto‘g‘ri qiymatli qatorlar haqida batafsil hisobot
 */

const DELIMS = [',', ';', '\t', '|'];

function splitLine(line, delim) {
  if (delim === ' ') return line.trim().split(/\s+/);
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function detectDelimiter(lines) {
  const sample = lines.slice(0, 20);
  let best = ' ';
  let bestScore = 0;
  for (const d of DELIMS) {
    const counts = sample.map((l) => splitLine(l, d).length);
    const first = counts[0];
    if (first < 2) continue;
    const consistent = counts.filter((c) => c === first).length / counts.length;
    const score = first * consistent;
    if (consistent >= 0.8 && score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  return best;
}

/** "1 234,5" / "1234.5" / "1,5e3" → son; bo‘lmasa NaN */
export function parseNumber(raw, decimalComma = false) {
  if (raw == null) return NaN;
  let s = String(raw).trim().replace(/[\s ]/g, '');
  if (s === '' || /^(na|nan|null|-)$/i.test(s)) return NaN;
  if (decimalComma) s = s.replace(/\./g, '').replace(',', '.');
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return NaN;
  return Number(s);
}

/**
 * Matnli jadvalni tahlil qilish (CSV, TSV, nuqtali vergul, bo‘shliq bilan ajratilgan).
 * @returns {{headers:string[], labels:string[]|null, labelHeader:string|null, columns:number[][], rows:number[][],
 *            skipped:{line:number, reason:string}[], dropped:string[], delimiter:string, decimalComma:boolean}}
 */
export function parseTable(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('Matn bo‘sh');
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l, i) => ({ l, i: i + 1 }))
    .filter(({ l }) => l.trim() !== '' && !l.trim().startsWith('#'));
  if (lines.length === 0) throw new Error('Ma’lumot topilmadi');
  const delimiter = detectDelimiter(lines.map((x) => x.l));
  const cells = lines.map(({ l }) => splitLine(l, delimiter));
  return { ...parseCells(cells, { lineNumbers: lines.map((x) => x.i), allowDecimalComma: delimiter !== ',' }), delimiter };
}

/**
 * Katakchalar massivini (matn yoki Excel’dan o‘qilgan qiymatlar) tahlil qilish.
 * – sarlavha qatorini aniqlaydi;
 * – asosan matndan iborat birinchi ustunni kuzatuv yorlig‘i (masalan, mamlakat nomi) sifatida ajratadi;
 * – bo‘sh yoki noto‘g‘ri qiymatli qatorlarni sababi bilan o‘tkazib yuboradi.
 */
export function parseCells(rawCells, { lineNumbers = null, allowDecimalComma = true } = {}) {
  const cells = rawCells
    .map((r) => (Array.isArray(r) ? r : [r]).map((c) => (c === null || c === undefined ? '' : c instanceof Date ? String(c.getFullYear()) : String(c).trim())))
    .filter((r) => r.some((c) => c !== ''));
  if (cells.length === 0) throw new Error('Ma’lumot topilmadi');
  const lineNo = (idx) => (lineNumbers ? lineNumbers[idx] : idx + 1);
  const width = cells[0].length;
  const decimalComma = allowDecimalComma && cells.slice(0, 50).some((r) => r.some((c) => /^[+-]?\d+,\d+$/.test(c)));
  const num = (c) => parseNumber(c, decimalComma);

  // Ustun turlari tananing (birinchi qatordan keyingi) qiymatlari bo‘yicha aniqlanadi
  const sample = cells.slice(1, 201);
  const isText = Array.from({ length: width }, (_, j) => {
    const vals = sample.map((r) => r[j]).filter((c) => c !== undefined && c !== '');
    if (vals.length === 0) return false;
    return vals.filter((c) => !Number.isFinite(num(c))).length / vals.length > 0.5;
  });
  const numericCols = isText.map((t, j) => (t ? -1 : j)).filter((j) => j >= 0);
  if (numericCols.length < 1) throw new Error('Sonli ustunlar topilmadi');
  const headerLike = cells.length > 1 && (cells[0].some((c, j) => !isText[j] && c !== '' && !Number.isFinite(num(c))) || cells[0].every((c) => !Number.isFinite(num(c))));
  const labelCol = isText.indexOf(true);
  const dropped = [];
  const rawHeaders = headerLike ? cells[0] : [];
  const nameOf = (j, pos) => (headerLike && rawHeaders[j] ? rawHeaders[j] : numericCols.length === 2 ? ['x', 'y'][pos] : pos === numericCols.length - 1 ? 'y' : `x${pos + 1}`);
  let headers = numericCols.map((j, pos) => nameOf(j, pos));
  // Takrorlangan nomlarni farqlash
  const seen = new Map();
  headers = headers.map((h) => {
    const c = seen.get(h) ?? 0;
    seen.set(h, c + 1);
    return c ? `${h}_${c + 1}` : h;
  });
  isText.forEach((t, j) => {
    if (t && j !== labelCol) dropped.push(headerLike && rawHeaders[j] ? rawHeaders[j] : `${j + 1}-ustun`);
  });

  const body = headerLike ? cells.slice(1) : cells;
  const offset = headerLike ? 1 : 0;
  const rows = [];
  const labels = [];
  const skipped = [];
  body.forEach((r, idx) => {
    const line = lineNo(idx + offset);
    if (r.length < Math.max(...numericCols) + 1) {
      skipped.push({ line, reason: `ustunlar soni ${r.length} (kutilgan ${width})` });
      return;
    }
    const nums = numericCols.map((j) => num(r[j]));
    const bad = nums.findIndex((v) => !Number.isFinite(v));
    if (bad !== -1) {
      const raw = r[numericCols[bad]];
      skipped.push({ line, reason: raw === '' ? `“${headers[bad]}” ustunida qiymat yo‘q` : `“${headers[bad]}” ustunida son emas: “${raw}”` });
      return;
    }
    rows.push(nums);
    if (labelCol >= 0) labels.push(r[labelCol] || `№${rows.length}`);
  });
  if (rows.length === 0) throw new Error('Birorta ham to‘g‘ri sonli qator topilmadi');
  const columns = headers.map((_, j) => rows.map((r) => r[j]));
  return {
    headers,
    labels: labelCol >= 0 ? labels : null,
    labelHeader: labelCol >= 0 ? (headerLike && rawHeaders[labelCol] ? rawHeaders[labelCol] : 'yorliq') : null,
    columns,
    rows,
    skipped,
    dropped,
    decimalComma,
  };
}

/** Jadvalni CSV ga aylantirish (eksport uchun) */
export function toCSV(headers, rows) {
  const esc = (v) => {
    const s = String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
}
