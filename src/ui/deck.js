/**
 * Reveal.js asosidagi interaktiv nazariy ma’ruza (KaTeX formulalari bilan).
 */
import Reveal from 'reveal.js';
import 'reveal.js/dist/reveal.css';
import katex from 'katex';

const m = (tex, display = true) => katex.renderToString(tex, { displayMode: display, throwOnError: false, output: 'html' });
const i = (tex) => m(tex, false);

const SLIDES = [
  `<section data-auto-animate>
     <p class="eyebrow">Ma’ruza · 12 slayd</p>
     <h2>Chiziqli regressiya</h2>
     <p>Bir yoki bir nechta omil <b>x</b> natijaviy belgi <b>y</b> ga qanday ta’sir qilishini miqdoriy baholash usuli.</p>
     <div class="box">${m('y = \\beta_0 + \\beta_1 x_1 + \\dots + \\beta_k x_k + \\varepsilon')}</div>
     <small>β — noma’lum parametrlar, ε — tasodifiy xato (hisobga olinmagan omillar)</small>
   </section>`,
  `<section>
     <h2>Gauss–Markov shartlari</h2>
     <ol>
       <li class="fragment">${i('E(\\varepsilon_i) = 0')} — xatolarning o‘rtachasi nol</li>
       <li class="fragment">${i('D(\\varepsilon_i) = \\sigma^2')} — gomoskedastiklik (dispersiya o‘zgarmas)</li>
       <li class="fragment">${i('\\mathrm{cov}(\\varepsilon_i, \\varepsilon_j) = 0')} — avtokorrelyatsiya yo‘q</li>
       <li class="fragment">Omillar chiziqli bog‘liq emas (multikollinearlik yo‘q)</li>
       <li class="fragment">${i('\\varepsilon \\sim N(0, \\sigma^2)')} — testlar uchun normallik</li>
     </ol>
     <p class="fragment">Shartlar bajarilsa, EKKU baholari <b>chiziqli, siljimagan va eng samarali</b> (BLUE) bo‘ladi.</p>
   </section>`,
  `<section>
     <h2>Eng kichik kvadratlar usuli</h2>
     <p>Qoldiqlar kvadratlari yig‘indisini minimallashtiramiz:</p>
     ${m('S(b_0, b_1) = \\sum_{i=1}^{n} \\left(y_i - b_0 - b_1 x_i\\right)^2 \\to \\min')}
     <div class="fragment">
       <p>Xususiy hosilalarni nolga tenglab, normal tenglamalar sistemasi:</p>
       ${m('\\begin{cases} n\\,b_0 + b_1 \\sum x_i = \\sum y_i \\\\ b_0 \\sum x_i + b_1 \\sum x_i^2 = \\sum x_i y_i \\end{cases}')}
     </div>
   </section>`,
  `<section>
     <h2>Juft regressiya formulalari</h2>
     <div class="cols">
       <div class="box">${m('b_1 = \\frac{\\sum (x_i-\\bar x)(y_i-\\bar y)}{\\sum (x_i-\\bar x)^2} = \\frac{S_{xy}}{S_{xx}}')}</div>
       <div class="box">${m('b_0 = \\bar y - b_1 \\bar x')}</div>
     </div>
     <div class="box fragment">${m('r_{xy} = \\frac{S_{xy}}{\\sqrt{S_{xx} S_{yy}}}, \\qquad -1 \\le r_{xy} \\le 1')}</div>
     <p class="fragment">b₁ — x bir birlikka oshganda y ning o‘rtacha o‘zgarishi. r — chiziqli bog‘lanish zichligi va yo‘nalishi.</p>
   </section>`,
  `<section>
     <h2>Matritsa ko‘rinishi va QR</h2>
     ${m('\\mathbf{y} = X\\boldsymbol\\beta + \\boldsymbol\\varepsilon \\quad\\Rightarrow\\quad \\mathbf{b} = (X^{\\mathsf T}X)^{-1}X^{\\mathsf T}\\mathbf{y}')}
     <div class="fragment">
       <p>Amalda (XᵀX)⁻¹ ni bevosita hisoblash sonli beqaror. Majmua <b>Householder QR</b> yoyilmasidan foydalanadi:</p>
       ${m('X = QR, \\quad Q^{\\mathsf T}Q = I \\quad\\Rightarrow\\quad R\\,\\mathbf b = Q^{\\mathsf T}\\mathbf y')}
       <small>R — yuqori uchburchak; tenglama teskari o‘rniga qo‘yish bilan yechiladi. Shartlilik soni kvadratga oshmaydi.</small>
     </div>
   </section>`,
  `<section>
     <h2>Dispersiya tahlili va R²</h2>
     ${m('\\underbrace{\\sum (y_i-\\bar y)^2}_{SST} = \\underbrace{\\sum (\\hat y_i-\\bar y)^2}_{SSR} + \\underbrace{\\sum (y_i-\\hat y_i)^2}_{SSE}')}
     <div class="cols fragment">
       <div class="box">${m('R^2 = 1 - \\frac{SSE}{SST}')}</div>
       <div class="box">${m('\\bar R^2 = 1 - (1-R^2)\\frac{n-1}{n-k-1}')}</div>
     </div>
     <p class="fragment">R² — y variatsiyasining model izohlagan ulushi. Tuzatilgan R̄² ortiqcha omil qo‘shishni “jarimalaydi”.</p>
   </section>`,
  `<section>
     <h2>Fisher F-mezoni</h2>
     <p>${i('H_0: \\beta_1 = \\dots = \\beta_k = 0')} — model ahamiyatsiz.</p>
     ${m('F = \\frac{SSR / k}{SSE / (n-k-1)} \\sim F(k,\\; n-k-1)')}
     <p class="fragment">Agar ${i('F > F_{\\text{jadval}}(\\alpha; k; n-k-1)')}, ya’ni p-qiymat < α bo‘lsa, H₀ rad etiladi — regressiya tenglamasi statistik ahamiyatli.</p>
   </section>`,
  `<section>
     <h2>Student t-mezoni va ishonch oraliqlari</h2>
     ${m('t_j = \\frac{b_j}{SE(b_j)}, \\qquad SE(b_j) = s\\sqrt{\\left[(X^{\\mathsf T}X)^{-1}\\right]_{jj}}, \\qquad s^2 = \\frac{SSE}{n-k-1}')}
     <div class="box fragment">${m('b_j - t_{\\alpha/2}\\,SE(b_j) \\;\\le\\; \\beta_j \\;\\le\\; b_j + t_{\\alpha/2}\\,SE(b_j)')}</div>
     <p class="fragment">Oraliq nolni o‘z ichiga olsa — omil ta’siri ahamiyatsiz.</p>
   </section>`,
  `<section>
     <h2>Bashorat</h2>
     <p>Yangi nuqta ${i('\\mathbf x_0')} uchun ${i('\\hat y_0 = \\mathbf x_0^{\\mathsf T}\\mathbf b')}.</p>
     <div class="box fragment"><p>O‘rtacha qiymat uchun ishonch oralig‘i:</p>${m('\\hat y_0 \\pm t_{\\alpha/2}\\, s\\sqrt{\\mathbf x_0^{\\mathsf T}(X^{\\mathsf T}X)^{-1}\\mathbf x_0}')}</div>
     <div class="box fragment"><p>Individual qiymat uchun bashorat oralig‘i (kengroq):</p>${m('\\hat y_0 \\pm t_{\\alpha/2}\\, s\\sqrt{1 + \\mathbf x_0^{\\mathsf T}(X^{\\mathsf T}X)^{-1}\\mathbf x_0}')}</div>
   </section>`,
  `<section>
     <h2>Qoldiqlar diagnostikasi</h2>
     <div class="cols">
       <div class="box fragment"><b>Darbin–Uotson</b>${m('DW = \\frac{\\sum_{t=2}^n (e_t - e_{t-1})^2}{\\sum e_t^2} \\approx 2')}</div>
       <div class="box fragment"><b>Jark–Bera</b>${m('JB = \\frac{n}{6}\\left(S^2 + \\frac{(K-3)^2}{4}\\right)')}</div>
       <div class="box fragment"><b>VIF</b>${m('VIF_j = \\frac{1}{1 - R_j^2} < 5')}</div>
       <div class="box fragment"><b>Kuk masofasi</b>${m('D_i = \\frac{r_i^2}{p}\\cdot\\frac{h_{ii}}{1-h_{ii}}')}</div>
     </div>
   </section>`,
  `<section>
     <h2>Gradient tushish</h2>
     ${m('J(\\mathbf b) = \\frac{1}{2n}\\sum_{i=1}^n (\\hat y_i - y_i)^2, \\qquad \\mathbf b^{(t+1)} = \\mathbf b^{(t)} - \\eta\\, \\nabla J(\\mathbf b^{(t)})')}
     ${m('\\nabla J = \\frac{1}{n} X^{\\mathsf T}(X\\mathbf b - \\mathbf y)')}
     <p class="fragment">η katta bo‘lsa — algoritm uzoqlashadi, kichik bo‘lsa — sekin yaqinlashadi. Omillarni standartlashtirish xarajat sirtini “dumaloq” qiladi va yaqinlashishni tezlashtiradi.</p>
   </section>`,
  `<section>
     <h2>Masala yechish algoritmi</h2>
     <ol>
       <li class="fragment">Ma’lumotlarni yig‘ish va tozalash, korrelyatsiya tahlili</li>
       <li class="fragment">Parametrlarni EKKU bilan baholash, tenglamani yozish</li>
       <li class="fragment">R², F-mezon — modelning umumiy sifati</li>
       <li class="fragment">t-mezon — har bir omilning ahamiyatliligi</li>
       <li class="fragment">Qoldiqlar diagnostikasi (DW, JB, BP, VIF, Kuk)</li>
       <li class="fragment">Iqtisodiy talqin: elastiklik, β-koeffitsiyentlar</li>
       <li class="fragment">Bashorat va uning ishonch oraliqlari</li>
     </ol>
     <p class="fragment"><b class="gradient-text">Bularning barchasi — laboratoriyada bir tugma bilan.</b></p>
   </section>`,
];

export function initDeck(host, slidesHost) {
  slidesHost.innerHTML = SLIDES.join('');
  const deck = new Reveal(host, {
    embedded: true,
    hash: false,
    respondToHashChanges: false,
    history: false,
    keyboardCondition: 'focused',
    controls: true,
    progress: true,
    center: true,
    slideNumber: 'c/t',
    transition: 'slide',
    backgroundTransition: 'fade',
    width: 1060,
    height: 640,
    margin: 0.06,
  });
  deck.initialize();
  // Klaviatura boshqaruvi uchun fokus
  host.setAttribute('tabindex', '0');
  host.addEventListener('pointerdown', () => host.focus({ preventScroll: true }));
  return deck;
}
