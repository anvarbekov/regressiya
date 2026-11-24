/**
 * Atamalar lug‘ati: har bir statistik ko‘rsatkichning oddiy tildagi izohi.
 * Interfeysdagi “?” tugmalari va “Qo‘llanma” bo‘limi shu ma’lumotdan foydalanadi.
 */
export const GLOSSARY = {
  linearize: {
    title: 'Chiziqlilashtirish (nochiziqli modellar)',
    short: 'Egri chiziqli bog‘lanishni o‘zgaruvchilarni almashtirib chiziqli ko‘rinishga keltirish.',
    long: 'Masalan, darajali model y = a·xᵇ logarifmlanganda ln y = ln a + b·ln x bo‘ladi — bu X = ln x, Y = ln y o‘zgaruvchilar uchun oddiy chiziqli regressiya. Ko‘rsatkichli (y = a·eᵇˣ), logarifmik (y = a + b·ln x), giperbolik (y = a + b/x) va parabolik (y = a + bx + cx²) modellar ham shunday baholanadi; natija so‘ng asl birliklarga qaytariladi.',
  },
  index: {
    title: 'Determinatsiya indeksi',
    short: 'Nochiziqli model uchun R² ning asl birliklardagi analogi.',
    long: 'R² = 1 − Σ(y − ŷ)²/Σ(y − ȳ)², bu yerda ŷ asl birliklarga qaytarilgan bashorat. Logarifmlangan modelning R² i ln y bo‘yicha hisoblangani uchun uni chiziqli model bilan solishtirib bo‘lmaydi; determinatsiya indeksi esa barcha model turlarini bir xil mezon bilan solishtirish imkonini beradi.',
  },
  hc3: {
    title: 'Bardoshli standart xatolar (HC3)',
    short: 'Geteroskedastiklik bo‘lganda ham to‘g‘ri bo‘lib qoladigan standart xatolar.',
    long: 'MacKinnon–White HC3 bahosi: V = (XᵀX)⁻¹·Σ xᵢxᵢᵀ·eᵢ²/(1 − hᵢᵢ)²·(XᵀX)⁻¹. Breush–Pagan testi geteroskedastiklikni aniqlasa, koeffitsiyentlarning ahamiyatliligini aynan shu standart xatolar bo‘yicha baholash tavsiya etiladi.',
  },
  partial: {
    title: 'Xususiy korrelyatsiya koeffitsiyenti',
    short: 'Boshqa omillar ta’siri chiqarib tashlangandagi ikki o‘zgaruvchi bog‘lanishi.',
    long: 'r(y, xⱼ | qolganlari) — y va xⱼ ning qolgan omillar ta’siridan “tozalangan” korrelyatsiyasi. Juft korrelyatsiya yuqori, lekin xususiy korrelyatsiya past bo‘lsa, bog‘lanish asosan boshqa omil orqali yuzaga kelgan. Uning t-testi ko‘p omilli modeldagi koeffitsiyent t-testi bilan aynan bir xil.',
  },
  fcrit: {
    title: 'Jadval (kritik) qiymat',
    short: 'Statistikaning H₀ rad etiladigan chegarasi.',
    long: 'F_jadval = F(1 − α; k; n − k − 1) va t_jadval = t(1 − α/2; n − k − 1) — Fisher va Student taqsimotlari kvantillari. Hisoblangan (haqiqiy) qiymat jadval qiymatidan katta bo‘lsa, H₀ rad etiladi. Bu p < α shartiga teng kuchli.',
  },
  growth: {
    title: 'O‘sish sur’ati (ko‘rsatkichli trend)',
    short: 'Ko‘rsatkich har bir davrda necha foizga o‘zgarishi.',
    long: 'y = a·eᵇᵗ modelida bir davrdagi o‘sish sur’ati e^b − 1 ga teng (masalan, b = 0.02 → 2.02% yiliga). Ikki baravar oshish davri ln 2 / b ga teng.',
  },
  ekku: {
    title: 'EKKU — eng kichik kvadratlar usuli',
    short: 'Nuqtalarga eng yaqin o‘tadigan chiziqni (tekislikni) topish usuli.',
    long: 'Har bir kuzatuv uchun haqiqiy y va chiziq bergan ŷ orasidagi farq (qoldiq) hisoblanadi. Qoldiqlar kvadratga oshirilib qo‘shiladi. EKKU shu yig‘indi eng kichik bo‘ladigan koeffitsiyentlarni tanlaydi. Kvadrat olinadi, chunki musbat va manfiy xatolar bir-birini yo‘qotmasligi kerak.',
  },
  coef: {
    title: 'Regressiya koeffitsiyenti b',
    short: 'Omil 1 birlikka oshganda natija o‘rtacha qanchaga o‘zgarishi.',
    long: 'b₀ (ozod had) — barcha omillar nolga teng bo‘lgandagi ŷ qiymati. b₁, b₂, … — tegishli omil 1 birlikka oshganda (boshqalari o‘zgarmaganda) natijaning o‘rtacha o‘zgarishi. Ishorasi bog‘lanish yo‘nalishini ko‘rsatadi: “+” — to‘g‘ri, “−” — teskari bog‘lanish.',
  },
  r2: {
    title: 'Determinatsiya koeffitsiyenti R²',
    short: 'Natija o‘zgarishining qancha qismini model tushuntiradi (0 dan 1 gacha).',
    long: 'R² = 1 − SSE/SST. Masalan, R² = 0.85 bo‘lsa, y ning o‘zgaruvchanligining 85% i modeldagi omillar bilan izohlanadi, 15% i esa hisobga olinmagan omillar va tasodif ta’siri. R² 1 ga qanchalik yaqin bo‘lsa, model ma’lumotlarga shunchalik yaxshi mos keladi.',
  },
  adjR2: {
    title: 'Tuzatilgan R²',
    short: 'Omillar sonini hisobga oluvchi R².',
    long: 'Oddiy R² modelga har qanday (hatto foydasiz) omil qo‘shilganda ham kamaymaydi. Tuzatilgan R² esa ortiqcha omil uchun “jarima” beradi, shuning uchun turli sondagi omillarga ega modellarni solishtirishda aynan undan foydalaniladi.',
  },
  f: {
    title: 'Fisher F-mezoni',
    short: 'Model umuman olganda statistik ishonchlimi — shuni tekshiradi.',
    long: 'Nol gipoteza H₀: barcha koeffitsiyentlar (ozod haddan tashqari) nolga teng, ya’ni omillar natijaga ta’sir qilmaydi. Agar p-qiymat < α (odatda 0.05) bo‘lsa, H₀ rad etiladi va regressiya tenglamasi statistik ahamiyatli deb topiladi.',
  },
  t: {
    title: 'Student t-mezoni',
    short: 'Har bir koeffitsiyent alohida ahamiyatlimi — shuni tekshiradi.',
    long: 't = b / SE(b). |t| kritik qiymatdan katta bo‘lsa (yoki p < α), koeffitsiyent noldan ishonchli farq qiladi, ya’ni tegishli omil natijaga haqiqatan ta’sir qiladi.',
  },
  p: {
    title: 'p-qiymat',
    short: 'Natija tasodifan chiqqan bo‘lishi ehtimoli.',
    long: 'Agar haqiqatda ta’sir bo‘lmasa (H₀ to‘g‘ri bo‘lsa), shunday yoki undan ham kuchli natija tasodifan kuzatilish ehtimoli. p < 0.05 bo‘lsa, natija “statistik ahamiyatli” deyiladi. Yulduzchalar: * p<0.05, ** p<0.01, *** p<0.001.',
  },
  se: {
    title: 'Standart xato SE',
    short: 'Koeffitsiyent bahosining aniqligi (qanchalik “tebranishi”).',
    long: 'Agar tajriba boshqa tanlamada takrorlansa, b qiymati qanchalik o‘zgarishi mumkinligini ko‘rsatadi. SE qanchalik kichik bo‘lsa, baho shunchalik aniq.',
  },
  ci: {
    title: 'Ishonch oralig‘i',
    short: 'Haqiqiy koeffitsiyent yotishi mumkin bo‘lgan oraliq.',
    long: '95% ishonch oralig‘i: b ± t·SE. Agar oraliq nolni o‘z ichiga olsa, omil ta’siri statistik ahamiyatsiz.',
  },
  sigma: {
    title: 'Standart xato σ (regressiyaning)',
    short: 'Kuzatuvlarning regressiya chizig‘idan o‘rtacha chetlanishi.',
    long: 'σ = √(SSE/(n − k − 1)). Natija birligida o‘lchanadi. Masalan, σ = 0.7 mln so‘m bo‘lsa, haqiqiy qiymatlar odatda chiziqdan ±0.7 mln atrofida chetlanadi.',
  },
  mape: {
    title: 'MAPE — o‘rtacha nisbiy xato',
    short: 'Bashoratlar o‘rtacha necha foizga xato.',
    long: 'Ā = (100/n)·Σ|eᵢ/yᵢ|. Amaliyotda 10% dan kam — yuqori aniqlik, 10–20% — qoniqarli, 20% dan ko‘p — past aniqlik deb hisoblanadi. y da nol qiymat bo‘lsa hisoblanmaydi.',
  },
  dw: {
    title: 'Darbin–Uotson statistikasi',
    short: 'Qoldiqlar o‘zaro bog‘liq emasligini tekshiradi (ideal ≈ 2).',
    long: 'DW 0 dan 4 gacha qiymat oladi. ≈ 2 — avtokorrelyatsiya yo‘q; 2 dan ancha kichik — musbat, 2 dan ancha katta — manfiy avtokorrelyatsiya. Asosan vaqt qatorlari (oylar, yillar) uchun muhim.',
  },
  jb: {
    title: 'Jark–Bera testi',
    short: 'Qoldiqlar normal taqsimotga bo‘ysunishini tekshiradi.',
    long: 'Asimmetriya (S) va ekstsess (K) asosida hisoblanadi. p > α bo‘lsa, normallik gipotezasi rad etilmaydi — bu t va F testlarining to‘g‘ri ishlashi uchun muhim (ayniqsa kichik tanlamada).',
  },
  bp: {
    title: 'Breush–Pagan testi',
    short: 'Qoldiqlar dispersiyasi o‘zgarmasligini (gomoskedastiklik) tekshiradi.',
    long: 'Agar xatolarning tarqoqligi omil qiymatiga qarab o‘zgarsa (masalan, katta x larda xatolar ham katta), bu geteroskedastiklik deyiladi. p < α bo‘lsa, geteroskedastiklik mavjud va standart xatolarga ehtiyot bo‘lish kerak.',
  },
  vif: {
    title: 'VIF — dispersiya inflyatsiyasi omili',
    short: 'Omillar bir-biri bilan kuchli bog‘langanmi (multikollinearlik).',
    long: 'VIFⱼ = 1/(1 − Rⱼ²), bu yerda Rⱼ² — j-omilni boshqa omillar orqali tushuntirish darajasi. VIF < 5 — me’yorda, 5–10 — e’tibor talab qiladi, > 10 — kuchli multikollinearlik (koeffitsiyentlar ishonchsiz).',
  },
  cond: {
    title: 'Shartlilik soni',
    short: 'Hisoblashning sonli barqarorligi ko‘rsatkichi.',
    long: 'XᵀX matritsasining eng katta va eng kichik xos qiymatlari nisbatining ildizi. Juda katta bo‘lsa (> 1000), omillar orasida kuchli bog‘liqlik yoki masshtablar katta farq qiladi.',
  },
  cook: {
    title: 'Kuk masofasi',
    short: 'Bitta kuzatuv modelga qanchalik kuchli ta’sir qilishi.',
    long: 'Kuzatuv olib tashlansa koeffitsiyentlar qanchalik o‘zgarishini o‘lchaydi. D > 4/n bo‘lgan nuqtalar “ta’sirchan” — ularni ma’lumot xatosi yoki alohida holat sifatida tekshirish kerak.',
  },
  beta: {
    title: 'Standartlashgan β-koeffitsiyent',
    short: 'Omillarning ta’sir kuchini solishtirish uchun.',
    long: 'βⱼ = bⱼ·sₓⱼ/s_y. Omil 1 standart chetlanishga oshsa, natija necha standart chetlanishga o‘zgarishini ko‘rsatadi. O‘lchov birliklariga bog‘liq emas, shuning uchun qaysi omil kuchliroq ekanini aniqlashda qo‘llaniladi.',
  },
  elast: {
    title: 'Elastiklik koeffitsiyenti',
    short: 'Omil 1% ga o‘zgarsa, natija necha foizga o‘zgaradi.',
    long: 'Eⱼ = bⱼ·x̄ⱼ/ȳ (o‘rtacha nuqtada). |E| > 1 — natija omilga kuchli sezgir (elastik), |E| < 1 — kuchsiz sezgir.',
  },
  pred: {
    title: 'Bashorat va uning oraliqlari',
    short: 'Yangi x uchun y ning taxminiy qiymati va chegaralari.',
    long: 'Ishonch oralig‘i — shu x dagi o‘rtacha y qayerda bo‘lishini, bashorat oralig‘i — bitta yangi kuzatuv qayerda bo‘lishini ko‘rsatadi; ikkinchisi doim kengroq. Nuqta ma’lumotlar diapazonidan tashqarida bo‘lsa (ekstrapolyatsiya), bashorat ishonchliligi pasayadi.',
  },
  gd: {
    title: 'Gradient tushish',
    short: 'Minimumni qadamma-qadam izlovchi iterativ usul.',
    long: 'Koeffitsiyentlar har qadamda xarajat funksiyasi eng tez kamayadigan yo‘nalishda (antigradient bo‘yicha) η qadam bilan o‘zgartiriladi. Chiziqli regressiyada natija EKKU yechimiga yaqinlashadi; katta ma’lumotlar va murakkab modellarda asosiy usul hisoblanadi.',
  },
};
