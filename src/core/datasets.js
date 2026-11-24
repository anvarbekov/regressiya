/**
 * Real ma’lumotlarga asoslangan masalalar to‘plami.
 * Ma’lumotlar `scripts/export_datasets.py` yordamida asl manbalardan (Jahon banki WDI,
 * BMT, NIST StRD, ilmiy nashrlar) olingan; har bir to‘plamda manba va iqtibos ko‘rsatilgan.
 */
import data from '../data/datasets.js';

export const CATEGORIES = ['O‘zbekiston', 'Xalqaro', 'Iqtisodiyot', 'Klassik'];

export const REAL_DATASETS = data;
/** Orqaga moslik uchun */
export const DATASETS = data;

export function getDataset(id) {
  return data.find((d) => d.id === id) ?? data[0];
}

/** To‘plamdan omillar matritsasi va natijaviy belgi vektorini ajratib olish */
export function datasetMatrix(d, features, target) {
  const fi = features.map((f) => d.headers.indexOf(f));
  const ti = d.headers.indexOf(target);
  if (fi.some((i) => i < 0) || ti < 0) throw new Error('To‘plamda bunday ustun yo‘q');
  return { X: d.rows.map((r) => fi.map((j) => r[j])), y: d.rows.map((r) => r[ti]) };
}
