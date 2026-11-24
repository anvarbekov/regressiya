# Regressiya.Lab — chiziqli regressiya masalalari uchun dasturiy majmua

Brauzerda ishlaydigan veb-ilova: ma’lumotlarni kiritasiz, u regressiya modelini quradi, statistik tekshiradi va natijalarni 2D/3D ko‘rinishda ko‘rsatadi. Barcha hisob-kitoblar foydalanuvchi qurilmasida bajariladi, ma’lumotlar serverga yuborilmaydi.

## Imkoniyatlar

| Modul | Nima qiladi |
|---|---|
| **EKKU (OLS)** | Juft va ko‘p omilli regressiya, ozod hadli/hadsiz. Hisoblash Householder QR orqali (sonli barqaror) |
| **6 turdagi model** | Chiziqli, parabolik, darajali, ko‘rsatkichli, logarifmik, giperbolik — chiziqlilashtirish, asl birliklardagi determinatsiya indeksi, avtomatik solishtirish va eng yaxshisini tanlash |
| **Real ma’lumotlar** | 13 ta to‘plam (1 847 kuzatuv): O‘zbekiston bo‘yicha Jahon banki WDI, BMT, NIST Longley, Galton, Engel, Keyns, Belsley va b. — manba va iqtibos bilan |
| **Statistik baholash** | b, SE, t, p, ishonch oraliqlari, R², R̄², F-mezon (F/t jadval qiymatlari bilan), ANOVA, logL, AIC, BIC, σ, RMSE, MAE, MAPE, HC3 bardoshli standart xatolar |
| **Korrelyatsiya va tavsifiy tahlil** | Juft va xususiy korrelyatsiya (t-testlari bilan), tavsifiy statistika |
| **Diagnostika** | Darbin–Uotson, Jark–Bera, Breush–Pagan (Koenker), VIF, shartlilik soni, leverage, studentlashgan qoldiqlar, Kuk masofasi |
| **Talqin** | β-koeffitsiyentlar, elastiklik, Chaddok shkalasi, o‘zbek tilida avtomatik xulosalar, har bir ko‘rsatkich uchun «?» izohi va atamalar lug‘ati |
| **Bashorat** | ŷ, ishonch va bashorat oraliqlari, ko‘p nuqtali prognoz jadvali (CSV eksport), ekstrapolyatsiya ogohlantirishi |
| **Qadamma-qadam yechim** | Juft, chiziqlilashtirilgan va parabolik modellar uchun yordamchi jadval, normal tenglamalar va formulalar (KaTeX) |
| **Gradient tushish** | Batch / mini-batch / SGD, momentum, so‘nish, standartlashtirish; kontur xaritada jonli traektoriya |
| **Vizualizatsiya** | Regressiya chizig‘i, CI/PI zonalari, 3D tekislik (Three.js), qoldiqlar grafiklari, Q–Q, gistogramma, korrelyatsiya matritsasi |
| **Ma’lumot kiritish** | Tahrirlanadigan jadval, Excel’dan joylashtirish, **.xlsx** va CSV/TXT fayllar (`,` `;` tab, o‘nlik vergul, matnli yorliq ustuni — masalan, mamlakat nomi) |
| **Eksport** | HTML hisobot (PDF ga chop etish mumkin), qoldiqlar jadvali CSV, model JSON |
| **Nazariya** | Reveal.js asosidagi 12 slaydli interaktiv ma’ruza |

## Aniqlik

87 ta avtomatik test (`npm test`):

- **NIST StRD Longley** sertifikatlangan qiymatlari — koeffitsiyentlar bo‘yicha nisbiy farq 2.6·10⁻¹³ (shartlilik soni 4.9·10⁹);
- **statsmodels / SciPy** bilan: chiziqli regressiya, diagnostika, 6 turdagi model, HC3, xususiy korrelyatsiya, taqsimotlar — asosiy ko‘rsatkichlar bo‘yicha 10⁻¹⁴ tartibida;
- xatolik holatlari, CSV/Excel tahlilchisi, gradient tushish, katta hajmdagi ma’lumotlar.

Etalon qiymatlar `scripts/make_reference.py` va `scripts/make_reference_models.py` bilan yaratiladi.

## Real ma’lumotlar

`src/data/datasets.js` fayli `scripts/export_datasets.py` yordamida statsmodels va Rdatasets orqali asl manbalardan eksport qilinadi (qo‘lda tahrirlanmaydi):

```bash
pip install statsmodels rdatasets && python3 scripts/export_datasets.py
```

## Ishga tushirish

Node.js 18 yoki undan yangi versiyasi kerak.

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

`npm run build` natijasi `dist/` katalogiga tushadi. Bu statik fayllar, ularni istalgan hostingga joylash mumkin (Netlify, Vercel, GitHub Pages, Nginx). `base: './'` sozlangani uchun ilova ichki katalogdan ham ishlaydi.

Etalon qiymatlarni qayta yaratish uchun (ixtiyoriy):

```bash
pip install numpy scipy statsmodels && python3 scripts/make_reference.py && python3 scripts/make_reference_models.py
```

## Tuzilma

```
src/
  core/                 — sof hisoblash mantiqi (DOM ga bog‘liq emas)
    distributions.js    — t, F, χ², normal taqsimotlar (to‘liqmas beta/gamma)
    matrix.js           — Householder QR, uchburchak matritsalar, Jacobi xos qiymatlari
    regression.js       — fitOLS, HC3, bashorat oraliqlari, diagnostika, korrelyatsiya, qadamlar
    models.js           — 6 turdagi chiziqlilashtiriladigan model, solishtirish
    gradientDescent.js  — GD (batch/mini-batch/SGD, momentum, so‘nish)
    parser.js           — CSV/Excel katakchalari tahlilchisi (yorliq ustunlari bilan)
    interpret.js        — avtomatik xulosalar
    datasets.js, format.js
  ui/
    hero3d.js           — Three.js hero sahnasi (shader’lar, bloom)
    plot3d.js           — 3D regressiya tekisligi (OrbitControls, CSS2D yorliqlar)
    charts.js           — SVG grafiklar kutubxonasi (GSAP animatsiyalari)
    gdLab.js            — gradient tushish vizualizatori (Canvas)
    lab.js              — laboratoriya interfeysi
    deck.js             — Reveal.js ma’ruza
    report.js           — eksport
  styles/main.css
tests/regression.test.js, tests/models.test.js
```

## Texnologiyalar

Vite · Three.js · GSAP (ScrollTrigger) · Reveal.js · KaTeX · read-excel-file · Vitest. Tizimdagi “harakatni kamaytirish” (`prefers-reduced-motion`) sozlamasi hisobga olinadi. WebGL bo‘lmagan qurilmalarda 3D bloklar o‘chiriladi, ilovaning qolgan qismi ishlayveradi.
# regressiya
