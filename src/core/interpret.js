/**
 * Model natijalarini o‘zbek tilida avtomatik talqin qilish.
 * Kirish: fitModel() natijasi (asl birliklardagi model + `base` — chiziqlilashtirilgan OLS).
 * Har bir xulosa: { level: 'good'|'warn'|'bad'|'info', title, text }
 */
import { fmt, pText, fmtPct } from './format.js';

/** Chaddok shkalasi bo‘yicha bog‘lanish zichligi */
export function chaddock(r) {
  const a = Math.abs(r);
  if (a < 0.1) return 'deyarli yo‘q';
  if (a < 0.3) return 'kuchsiz';
  if (a < 0.5) return 'o‘rtacha';
  if (a < 0.7) return 'sezilarli';
  if (a < 0.9) return 'yuqori';
  return 'juda yuqori';
}

const dirWord = (v, up = 'oshadi', down = 'kamayadi') => (v >= 0 ? up : down);

/** Bitta omil koeffitsiyentining model turiga mos talqini */
function coefficientMeaning(M, j) {
  const B = M.base;
  const off = M.intercept ? 1 : 0;
  const name = M.featureNames[j];
  const y = M.targetName;
  const others = M.k > 1 ? ' (boshqa omillar o‘zgarmaganda)' : '';
  switch (M.type) {
    case 'linear': {
      const b = B.coefficients[off + j];
      return `“${name}” 1 birlikka oshganda${others} “${y}” o‘rtacha ${fmt(Math.abs(b), 4)} birlikka ${dirWord(b)}.`;
    }
    case 'quadratic': {
      const b = B.coefficients[off + 2 * j];
      const c = B.coefficients[off + 2 * j + 1];
      const ex = M.extrema[j];
      const [lo, hi] = M.ranges[j];
      const inside = ex.x >= lo && ex.x <= hi;
      return (
        `Bog‘lanish parabolik: chegaraviy ta’sir dŷ/d${name} = ${fmt(b, 4)} + ${fmt(2 * c, 4)}·${name}, ya’ni “${name}” ortgan sari ta’sir ${c >= 0 ? 'kuchayadi' : 'susayadi'}. ` +
        `Parabola ${ex.kind} nuqtasi: ${name}* = ${fmt(ex.x, 4)}${inside ? ' — kuzatilgan diapazon ichida' : ' (kuzatilgan diapazondan tashqarida)'}.`
      );
    }
    case 'power': {
      const b = B.coefficients[off + j];
      return `Darajali modelda koeffitsiyent elastiklikka teng: “${name}” 1% ga oshganda${others} “${y}” o‘rtacha ${fmt(Math.abs(b), 4)}% ga ${dirWord(b)}.`;
    }
    case 'exponential': {
      const b = B.coefficients[off + j];
      const pct = (Math.exp(b) - 1) * 100;
      return `“${name}” 1 birlikka oshganda${others} “${y}” o‘rtacha ${fmt(Math.abs(pct), 4)}% ga ${dirWord(pct)} (koeffitsiyent e^b = ${fmt(Math.exp(b), 6)}).`;
    }
    case 'logarithmic': {
      const b = B.coefficients[off + j];
      return `“${name}” 1% ga oshganda${others} “${y}” o‘rtacha ${fmt(Math.abs(b) / 100, 4)} birlikka ${dirWord(b)}; “${name}” 2 baravar oshsa — ${fmt(Math.abs(b) * Math.LN2, 4)} birlikka.`;
    }
    case 'hyperbolic': {
      const b = B.coefficients[off + j];
      return `Giperbolik bog‘lanish: “${name}” ortgan sari “${y}” ${b > 0 ? 'kamayib' : 'oshib'}, asimptotik ravishda ${fmt(B.coefficients[0], 4)} ga yaqinlashadi.`;
    }
    default:
      return '';
  }
}

export function interpret(M) {
  const out = [];
  const B = M.base;
  const D = B.diagnostics;
  const { alpha, n } = M;
  const conf = Math.round((1 - alpha) * 100);
  const off = M.intercept ? 1 : 0;
  const nonlinear = M.type !== 'linear';

  // 1. Model turi
  if (nonlinear) {
    out.push({
      level: 'info',
      title: `Model turi: ${M.typeLabel.toLowerCase()}`,
      text: `Model o‘zgaruvchilarni almashtirish orqali chiziqli ko‘rinishga keltirilib (${B.targetName} = f(${B.featureNames.join(', ')})), EKKU bilan baholandi. Statistik testlar chiziqlilashtirilgan model bo‘yicha, aniqlik ko‘rsatkichlari esa asl birliklarda hisoblangan.`,
    });
  }

  // 2. Bog‘lanish zichligi
  const r2 = M.metrics.r2;
  const R = M.k === 1 && M.type === 'linear' && M.intercept ? B.metrics.r : Math.sqrt(Math.max(r2, 0));
  out.push({
    level: r2 >= 0.7 ? 'good' : r2 >= 0.4 ? 'info' : 'warn',
    title: `Bog‘lanish zichligi: ${chaddock(R)}`,
    text:
      `${nonlinear ? 'Korrelyatsiya indeksi' : M.k === 1 ? 'Korrelyatsiya koeffitsiyenti' : 'Ko‘plik korrelyatsiya koeffitsiyenti'} R = ${fmt(R, 4)}. ` +
      `${nonlinear ? 'Determinatsiya indeksi' : 'Determinatsiya koeffitsiyenti'} R² = ${fmt(r2, 4)}: “${M.targetName}” variatsiyasining ${fmtPct(Math.max(r2, 0))} qismi model bilan izohlanadi, ` +
      `qolgan ${fmtPct(Math.min(1, 1 - r2))} — hisobga olinmagan omillar va tasodifiy ta’sirlar ulushi.` +
      (!M.intercept ? ' (Ozod hadsiz modelda R² markazlashmagan — uni ozod hadli model bilan bevosita solishtirib bo‘lmaydi.)' : ''),
  });

  // 3. Fisher F-mezoni
  if (B.metrics.fPValue !== null) {
    const sig = B.metrics.fPValue < alpha;
    out.push({
      level: sig ? 'good' : 'bad',
      title: sig ? 'Model statistik ahamiyatli' : 'Model statistik ahamiyatsiz',
      text: `Fisher F-mezoni: F_haq = ${fmt(B.metrics.fStat, 4)}, F_jadval(${alpha}; ${B.anova.regression.df}; ${B.anova.residual.df}) = ${fmt(B.fCritical, 4)}, ${pText(B.metrics.fPValue)}. ${
        sig
          ? `F_haq > F_jadval — H₀ (barcha koeffitsiyentlar nolga teng) ${conf}% ishonchlilik bilan rad etiladi, regressiya tenglamasi ishonchli.`
          : `F_haq ≤ F_jadval — H₀ ni rad etish uchun asos yo‘q, model ma’lumotlarni ishonchli tavsiflamaydi.`
      }`,
    });
  }

  // 4. Koeffitsiyentlar
  const perFeature = M.type === 'quadratic' ? 2 : 1;
  M.featureNames.forEach((name, j) => {
    const idx = Array.from({ length: perFeature }, (_, m) => off + j * perFeature + m);
    const ps = idx.map((i) => B.pValues[i]);
    const sig = ps.some((p) => p < alpha);
    const i0 = idx[idx.length - 1];
    const [lo, hi] = B.confidenceIntervals[i0];
    const el = M.elasticity[j];
    out.push({
      level: sig ? 'good' : 'warn',
      title: `“${name}” omili ${sig ? 'ahamiyatli' : 'ahamiyatsiz'} (${ps.map(pText).join('; ')})`,
      text:
        `${coefficientMeaning(M, j)} ` +
        `|t| ${Math.abs(B.tStats[i0]) > B.tCritical ? '>' : '≤'} t_jadval = ${fmt(B.tCritical, 4)}; ${conf}% ishonch oralig‘i (${B.paramNames[i0]}): [${fmt(lo, 4)}; ${fmt(hi, 4)}]${!sig ? ' — nolni o‘z ichiga oladi' : ''}.` +
        (el !== null && Number.isFinite(el) && M.type !== 'power'
          ? ` O‘rtacha elastiklik E = ${fmt(el, 3)}: omil 1% ga o‘zgarsa, natija o‘rtacha ${fmt(Math.abs(el), 3)}% ga ${el >= 0 ? 'oshadi' : 'kamayadi'}.`
          : ''),
    });
  });

  if (M.growthRate !== null) {
    out.push({
      level: 'info',
      title: `O‘rtacha o‘sish sur’ati: ${fmt(M.growthRate * 100, 4)}% (bir birlikka)`,
      text: `Ko‘rsatkichli model y = a·eᵇˣ bo‘yicha “${M.targetName}” “${M.featureNames[0]}” har bir birlikka oshganda o‘rtacha ${fmt(M.growthRate * 100, 4)}% ga o‘zgaradi; ikki baravar ${M.growthRate > 0 ? 'oshish' : 'kamayish'} davri ≈ ${fmt(Math.log(2) / Math.abs(Math.log(1 + M.growthRate)), 4)} birlik.`,
    });
  }

  if (M.k > 1) {
    const idx = M.type === 'linear' ? B.standardized.map((v, j) => [Math.abs(v), j]) : M.elasticity.map((v, j) => [Math.abs(v ?? 0), j]);
    idx.sort((a, b) => b[0] - a[0]);
    out.push({
      level: 'info',
      title: `Eng kuchli ta’sir: “${M.featureNames[idx[0][1]]}”`,
      text: `${M.type === 'linear' ? 'Standartlashgan β-koeffitsiyentlar' : 'Elastiklik koeffitsiyentlari'} bo‘yicha omillar ta’sir kuchi tartibi: ${idx
        .map(([v, j]) => `${M.featureNames[j]} (${M.type === 'linear' ? 'β' : 'E'} = ${fmt(M.type === 'linear' ? B.standardized[j] : M.elasticity[j], 3)})`)
        .join(' > ')}.`,
    });
  }

  // 5. Avtokorrelyatsiya
  const dw = D.durbinWatson;
  out.push({
    level: dw > 1.5 && dw < 2.5 ? 'good' : 'warn',
    title: `Qoldiqlar avtokorrelyatsiyasi: ${dw > 1.5 && dw < 2.5 ? 'yo‘q' : dw <= 1.5 ? 'musbat bo‘lishi mumkin' : 'manfiy bo‘lishi mumkin'}`,
    text: `Darbin–Uotson statistikasi DW = ${fmt(dw, 4)} (ideal ≈ 2; 1.5–2.5 qoniqarli). Ko‘rsatkich faqat kuzatuvlar vaqt bo‘yicha tartiblangan (vaqt qatori) bo‘lsa ma’noga ega; mamlakatlar yoki korxonalar kesimidagi ma’lumotlarda uni talqin qilmang.${
      dw <= 1.5 ? ' Vaqt qatorida musbat avtokorrelyatsiya ko‘pincha modelda trend yoki muhim omil yetishmasligini bildiradi.' : ''
    }`,
  });

  // 6. Normallik
  const jb = D.jarqueBera;
  out.push({
    level: jb.pValue >= alpha ? 'good' : 'warn',
    title: `Qoldiqlar taqsimoti: ${jb.pValue >= alpha ? 'normal' : 'normaldan farq qiladi'}`,
    text: `Jark–Bera testi: JB = ${fmt(jb.statistic, 4)}, ${pText(jb.pValue)}; asimmetriya = ${fmt(jb.skew, 3)}, ekstsess = ${fmt(jb.kurtosis - 3, 3)}. ${
      jb.pValue >= alpha ? 'Normallik gipotezasi rad etilmaydi — t va F testlari to‘g‘ri qo‘llaniladi.' : `Normallik buzilgan${n >= 100 ? ', lekin katta tanlamada (n ≥ 100) t va F testlari asimptotik jihatdan to‘g‘ri bo‘lib qoladi' : ': kichik tanlamada t/F testlar natijalariga ehtiyotkorlik bilan yondashing'}.`
    }`,
  });

  // 7. Geteroskedastiklik
  if (D.breuschPagan) {
    const bp = D.breuschPagan;
    const bad = bp.pValue < alpha;
    let extra = '';
    if (bad) {
      const changed = B.paramNames
        .map((nm, i) => [nm, B.pValues[i] < alpha, B.robust.pValues[i] < alpha])
        .filter(([, a, b]) => a !== b)
        .map(([nm]) => nm);
      extra = ` Bardoshli (HC3) standart xatolar bilan ${changed.length ? `quyidagi parametrlarning ahamiyatliligi o‘zgaradi: ${changed.join(', ')}` : 'barcha parametrlarning ahamiyatliligi o‘zgarmaydi — xulosalar ishonchli'}.`;
    }
    out.push({
      level: bad ? 'warn' : 'good',
      title: `Qoldiqlar dispersiyasi: ${bad ? 'geteroskedastiklik aniqlandi' : 'gomoskedastik'}`,
      text: `Breush–Pagan (Koenker) testi: LM = ${fmt(bp.statistic, 4)}, ${pText(bp.pValue)}. ${
        bad ? 'Dispersiya omillarga bog‘liq: oddiy standart xatolar siljigan bo‘lishi mumkin («Koeffitsiyentlar» jadvalidagi HC3 ustunlariga tayaning; logarifmik yoki darajali model ham yordam berishi mumkin).' : 'Qoldiqlar dispersiyasi o‘zgarmas — standart xatolar ishonchli.'
      }${extra}`,
    });
  }

  // 8. Multikollinearlik
  if (D.vif) {
    const maxV = Math.max(...D.vif);
    const worst = B.featureNames[D.vif.indexOf(maxV)];
    out.push({
      level: maxV < 5 ? 'good' : maxV < 10 ? 'warn' : 'bad',
      title: `Multikollinearlik: ${maxV < 5 ? 'sezilarli emas' : maxV < 10 ? 'o‘rtacha' : 'kuchli'}`,
      text: `Maksimal VIF = ${fmt(maxV, 4)} (“${worst}”). VIF < 5 — me’yorda, 5–10 — e’tibor talab qiladi, > 10 — omillardan birini chiqarish yoki ularni birlashtirish tavsiya etiladi.${
        M.type === 'quadratic' ? ' Parabolik modelda x va x² ning o‘zaro korrelyatsiyasi tabiiy — bu holatda VIF ni talqin qilmang.' : ''
      }`,
    });
  }

  // 9. Ta’sirchan kuzatuvlar
  const thr = 4 / n;
  const lab = (i) => (M.labels ? `${M.labels[i]}` : `№${i + 1}`);
  const infl = D.cooksD
    .map((d, i) => [d, i])
    .filter(([d]) => d > thr)
    .sort((a, b) => b[0] - a[0]);
  out.push({
    level: infl.length === 0 ? 'good' : infl.some(([d]) => d > 1) ? 'bad' : 'info',
    title: `Ta’sirchan kuzatuvlar: ${infl.length} ta`,
    text:
      infl.length === 0
        ? `Kuk masofasi bo‘yicha (D > 4/n = ${fmt(thr, 3)}) ta’sirchan nuqtalar yo‘q.`
        : `Kuk masofasi D > 4/n = ${fmt(thr, 3)} bo‘lgan kuzatuvlar: ${infl
            .slice(0, 8)
            .map(([d, i]) => `${lab(i)} (D = ${fmt(d, 3)})`)
            .join(', ')}${infl.length > 8 ? ' …' : ''}. Ularni ma’lumot xatosi yoki alohida holat (masalan, inqiroz yili) sifatida tekshiring.`,
  });

  // 10. Tanlama hajmi
  const perParam = n / B.p;
  if (perParam < 10) {
    out.push({
      level: 'warn',
      title: 'Tanlama hajmi kichik',
      text: `Har bir parametrga ${fmt(perParam, 3)} ta kuzatuv to‘g‘ri keladi. Ishonchli baholash uchun kamida 10 ta (yaxshisi 20 ta) tavsiya etiladi.`,
    });
  }

  // 11. Aproksimatsiya xatoligi
  const mape = M.metrics.mape;
  out.push({
    level: mape === null ? 'info' : mape <= 10 ? 'good' : mape <= 20 ? 'info' : 'warn',
    title: 'Aproksimatsiya xatoligi',
    text: `Asl birliklarda: σ = ${fmt(M.metrics.sigma, 4)}, RMSE = ${fmt(M.metrics.rmse, 4)}, MAE = ${fmt(M.metrics.mae, 4)}${
      mape !== null ? `, o‘rtacha nisbiy xato Ā = ${fmt(mape, 3)}% ${mape <= 10 ? '(≤ 10% — model aniqligi yaxshi)' : mape <= 20 ? '(10–20% — qoniqarli)' : '(> 20% — aniqlik past)'}` : ''
    }.`,
  });

  return out;
}
