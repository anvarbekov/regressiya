import 'katex/dist/katex.min.css';
import './styles/main.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import katex from 'katex';
import { initHero } from './ui/hero3d.js';
import { initLab } from './ui/lab.js';
import { initGdLab } from './ui/gdLab.js';
import { initDeck } from './ui/deck.js';
import { sparkline } from './ui/charts.js';
import { DATASETS, CATEGORIES } from './core/datasets.js';
import { fitOLS } from './core/regression.js';
import { escapeHtml } from './core/format.js';
import { GLOSSARY } from './core/glossary.js';

gsap.registerPlugin(ScrollTrigger);
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------------- Toast ---------------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-on'), 2600);
}

/* ---------------- Matnni bo‘laklash ---------------- */
function splitChars(node) {
  const text = node.textContent;
  node.setAttribute('aria-label', text);
  node.innerHTML = [...text].map((c) => `<span class="char" aria-hidden="true">${c === ' ' ? '&nbsp;' : escapeHtml(c)}</span>`).join('');
  return $$('.char', node);
}
function splitWords(node) {
  const words = node.textContent.trim().split(/\s+/);
  node.innerHTML = words.map((w) => `<span class="word"><span>${escapeHtml(w)}</span></span>`).join(' ');
  return $$('.word > span', node);
}

/* ---------------- Hero ---------------- */
const hero = initHero($('#hero-canvas'));
$('#hero-formula').innerHTML = katex.renderToString('\\hat y = b_0 + b_1x_1 + \\dots + b_kx_k', { throwOnError: false });
// Gradient matnli qator butunligicha animatsiya qilinadi (background-clip harflarga bo‘linganda buziladi)
const heroChars = $$('.hero__title .split').flatMap((n) => (n.classList.contains('gradient-text') ? [n] : splitChars(n)));

/* ---------------- Marquee ---------------- */
const formulas = [
  'b = (XᵀX)⁻¹Xᵀy', 'R² = 1 − SSE/SST', 'F = (SSR/k)/(SSE/(n−k−1))', 't = b / SE(b)', 'DW ≈ 2',
  'VIF = 1/(1 − R²ⱼ)', 'ŷ ± t·s·√(1 + x₀ᵀ(XᵀX)⁻¹x₀)', 'b ← b − η∇J', 'E = b·x̄/ȳ',
];
$('#marquee').innerHTML = `<span>${formulas.join('</span><span>')}</span>`.repeat(2);
if (!reduce) gsap.to('#marquee', { xPercent: -50, duration: 40, ease: 'none', repeat: -1 });

/* ---------------- Masalalar kartochkalari ---------------- */
const problemsHost = $('#problems');
problemsHost.innerHTML = DATASETS.map(
  (d) => `<button class="problem" data-id="${d.id}" data-cat="${escapeHtml(d.category)}" type="button">
    <span class="problem__tag">${escapeHtml(d.category)} · ${escapeHtml(d.tag)}</span>
    <h3>${escapeHtml(d.title)}</h3>
    <p>${escapeHtml(d.problem)}</p>
    <div class="problem__spark"></div>
    <div class="problem__src">Manba: ${escapeHtml(d.source.name.length > 90 ? `${d.source.name.slice(0, 88)}…` : d.source.name)}</div>
    <div class="problem__meta"><span>n = ${d.rows.length}</span><span>${d.features.length} omil</span><span>Yechish →</span></div>
  </button>`,
).join('');
DATASETS.forEach((d) => {
  const xi = d.headers.indexOf(d.features[0]);
  const yi = d.headers.indexOf(d.target);
  sparkline($(`.problem[data-id="${d.id}"] .problem__spark`), d.rows.map((r) => r[xi]), d.rows.map((r) => r[yi]));
});
const cats = ['Barchasi', ...CATEGORIES.filter((c) => DATASETS.some((d) => d.category === c))];
const filters = $('#problem-filters');
filters.innerHTML = cats
  .map((c, i) => `<button role="tab" class="${i === 0 ? 'is-active' : ''}" data-cat="${escapeHtml(c)}">${escapeHtml(c)} <span class="muted">${i === 0 ? DATASETS.length : DATASETS.filter((d) => d.category === c).length}</span></button>`)
  .join('');
filters.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  $$('button', filters).forEach((x) => x.classList.toggle('is-active', x === b));
  $$('.problem').forEach((p) => (p.hidden = b.dataset.cat !== 'Barchasi' && p.dataset.cat !== b.dataset.cat));
  ScrollTrigger.refresh();
});

/* ---------------- Laboratoriya va GD ---------------- */
let gd;
const lab = initLab($('#lab'), {
  toast,
  onModel: () => gd?.refresh(),
});
gd = initGdLab($('#gradient'), () => {
  const m = lab.getModel();
  if (!m) return null;
  // Gradient tushish chiziqlilashtirilgan model (ozod hadli) uchun bajariladi
  const B = m.base;
  const ols = fitOLS(B.X, B.y, { featureNames: B.featureNames, targetName: B.targetName });
  const sub = (j) => String(j).replace(/\d/g, (c) => '₀₁₂₃₄₅₆₇₈₉'[c]);
  return {
    X: B.X,
    y: B.y,
    featureNames: B.featureNames,
    targetName: B.targetName,
    olsParams: ols.coefficients,
    paramNames: ['b₀', ...B.featureNames.map((_, j) => `b${sub(j + 1)}`)],
  };
});

function selectProblem(id, { scroll = true } = {}) {
  const ds = DATASETS.find((d) => d.id === id);
  if (!ds) return;
  $$('.problem').forEach((p) => p.classList.toggle('is-active', p.dataset.id === id));
  lab.load(ds);
  lab.fit({ scroll: false });
  if (scroll) $('#lab').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
}
problemsHost.addEventListener('click', (e) => {
  const card = e.target.closest('.problem');
  if (card) selectProblem(card.dataset.id);
});
selectProblem(DATASETS[0].id, { scroll: false });

/* ---------------- Atamalar lug‘ati va “?” izohlari ---------------- */
$('#glossary').innerHTML = Object.values(GLOSSARY)
  .map((g) => `<details><summary>${escapeHtml(g.title)}</summary><p class="s">${escapeHtml(g.short)}</p><p>${escapeHtml(g.long)}</p></details>`)
  .join('');

const pop = $('#help-pop');
let popOwner = null;
function closeHelp() {
  pop.hidden = true;
  popOwner?.classList.remove('is-open');
  popOwner?.setAttribute('aria-expanded', 'false');
  popOwner = null;
}
function openHelp(btn) {
  const g = GLOSSARY[btn.dataset.help];
  if (!g) return;
  if (popOwner === btn) return closeHelp();
  closeHelp();
  pop.querySelector('b').textContent = g.title;
  pop.querySelector('.help-pop__short').textContent = g.short;
  pop.querySelector('.help-pop__long').textContent = g.long;
  pop.hidden = false;
  const r = btn.getBoundingClientRect();
  const pw = pop.offsetWidth;
  const ph = pop.offsetHeight;
  const left = Math.min(Math.max(16, r.left + r.width / 2 - pw / 2), window.innerWidth - pw - 16);
  const top = r.bottom + 10 + ph < window.innerHeight ? r.bottom + 10 : Math.max(16, r.top - ph - 10);
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;
  popOwner = btn;
  btn.classList.add('is-open');
  btn.setAttribute('aria-expanded', 'true');
  if (!reduce) gsap.fromTo(pop, { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' });
}
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.help[data-help]');
  if (btn) {
    e.preventDefault();
    e.stopPropagation();
    openHelp(btn);
  } else if (!e.target.closest('#help-pop') || e.target.closest('.help-pop__x')) closeHelp();
});
document.addEventListener('keydown', (e) => e.key === 'Escape' && closeHelp());
window.addEventListener('scroll', () => popOwner && closeHelp(), { passive: true });

/* ---------------- Nazariya ---------------- */
try {
  initDeck($('#deck'), $('#deck-slides'));
} catch (e) {
  console.error('Reveal.js ishga tushmadi', e);
}

/* ---------------- Navigatsiya ---------------- */
const nav = $('#nav');
$('.nav__burger').addEventListener('click', () => {
  const open = nav.classList.toggle('is-open');
  $('.nav__burger').setAttribute('aria-expanded', String(open));
});
$$('.nav__links a').forEach((a) => a.addEventListener('click', () => nav.classList.remove('is-open')));
let lastY = window.scrollY;
window.addEventListener(
  'scroll',
  () => {
    const y = window.scrollY;
    nav.classList.toggle('is-hidden', y > lastY && y > 400 && !nav.classList.contains('is-open'));
    lastY = y;
  },
  { passive: true },
);
$$('.nav__links a').forEach((a) => {
  const sec = $(a.getAttribute('href'));
  if (!sec) return;
  ScrollTrigger.create({
    trigger: sec,
    start: 'top 50%',
    end: 'bottom 50%',
    onToggle: (self) => self.isActive && $$('.nav__links a').forEach((x) => x.classList.toggle('is-active', x === a)),
  });
});
gsap.to('.scroll-progress span', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });

/* ---------------- Kursor va magnit tugmalar ---------------- */
if (finePointer && !reduce) {
  const dot = $('.cursor__dot');
  const ring = $('.cursor__ring');
  const dx = gsap.quickTo(dot, 'x', { duration: 0.1 });
  const dy = gsap.quickTo(dot, 'y', { duration: 0.1 });
  const rx = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3' });
  const ry = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3' });
  window.addEventListener('pointermove', (e) => {
    $('.cursor').classList.add('is-on');
    dx(e.clientX);
    dy(e.clientY);
    rx(e.clientX);
    ry(e.clientY);
  });
  document.addEventListener('pointerover', (e) => $('.cursor').classList.toggle('is-hover', !!e.target.closest('a, button, .chip, label.switch, select, .problem')));

  $$('.magnetic').forEach((b) => {
    const mx = gsap.quickTo(b, 'x', { duration: 0.5, ease: 'elastic.out(1, 0.4)' });
    const my = gsap.quickTo(b, 'y', { duration: 0.5, ease: 'elastic.out(1, 0.4)' });
    b.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect();
      mx((e.clientX - r.left - r.width / 2) * 0.25);
      my((e.clientY - r.top - r.height / 2) * 0.35);
    });
    b.addEventListener('pointerleave', () => {
      mx(0);
      my(0);
    });
  });

  $$('.tilt').forEach((card) => {
    const rX = gsap.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power3' });
    const rY = gsap.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power3' });
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      rY((px - 0.5) * 14);
      rX((0.5 - py) * 14);
      card.style.setProperty('--mx', `${px * 100}%`);
      card.style.setProperty('--my', `${py * 100}%`);
    });
    card.addEventListener('pointerleave', () => {
      rX(0);
      rY(0);
    });
  });
}

/* ---------------- Scroll animatsiyalari ---------------- */
function scrollAnimations() {
  if (reduce) return;
  $$('.reveal-words').forEach((t) => {
    const words = splitWords(t);
    gsap.from(words, { yPercent: 110, duration: 1, stagger: 0.04, ease: 'power4.out', scrollTrigger: { trigger: t, start: 'top 85%' } });
  });
  $$('.eyebrow, .section__lead').forEach((e) => {
    if (e.closest('.results') || e.closest('.reveal')) return;
    gsap.from(e, { opacity: 0, y: 20, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: e, start: 'top 90%' } });
  });
  gsap.from('.feature', { opacity: 0, y: 80, rotateX: -18, duration: 1.1, stagger: 0.09, ease: 'power3.out', scrollTrigger: { trigger: '.features', start: 'top 80%' } });
  gsap.from('.guide__step', { opacity: 0, y: 50, duration: 0.9, stagger: 0.1, ease: 'power3.out', scrollTrigger: { trigger: '.guide', start: 'top 82%' } });
  gsap.from('.problem', { opacity: 0, y: 60, scale: 0.94, duration: 0.9, stagger: 0.08, ease: 'power3.out', scrollTrigger: { trigger: '.problems', start: 'top 82%' } });
  gsap.from('.lab__input', { opacity: 0, x: -60, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '.lab', start: 'top 80%' } });
  gsap.from('.gd__controls', { opacity: 0, x: -60, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '.gd', start: 'top 80%' } });
  gsap.from('.gd__viz > *', { opacity: 0, y: 60, duration: 1, stagger: 0.12, ease: 'power3.out', scrollTrigger: { trigger: '.gd', start: 'top 80%' } });
  gsap.from('.deck-frame', { opacity: 0, scale: 0.92, rotateX: 12, transformPerspective: 1200, duration: 1.3, ease: 'power3.out', scrollTrigger: { trigger: '.deck-frame', start: 'top 85%' } });
  gsap.fromTo('.footer__big', { xPercent: -8 }, { xPercent: 4, ease: 'none', scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true } });
  gsap.to('.hero__content', { yPercent: -18, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true } });
}
ScrollTrigger.create({ trigger: '#gradient', start: 'top 55%', once: true, onEnter: () => gd.playIfIdle() });

// Sahifa balandligi o‘zgarganda (masalan, yangi model natijalari chiqqanda) scroll-trigger pozitsiyalarini yangilash
let refreshTimer;
let lastHeight = document.body.scrollHeight;
new ResizeObserver(() => {
  const h = document.body.scrollHeight;
  if (Math.abs(h - lastHeight) < 2) return;
  lastHeight = h;
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 150);
}).observe(document.body);

/* ---------------- Preloader va kirish ---------------- */
function intro() {
  const tl = gsap.timeline();
  if (reduce) {
    gsap.set('#preloader', { display: 'none' });
    document.body.classList.remove('is-loading');
    return;
  }
  tl.to('#preloader', { clipPath: 'inset(0 0 100% 0)', duration: 0.9, ease: 'power4.inOut' })
    .set('#preloader', { display: 'none' })
    .add(() => document.body.classList.remove('is-loading'))
    .from(heroChars, { yPercent: 115, rotate: 8, duration: 1.1, stagger: 0.025, ease: 'power4.out' }, '-=0.3')
    .from('.hero__kicker', { opacity: 0, y: 20, duration: 0.7 }, '-=0.9')
    .from(['.hero__lead', '.hero__actions', '.hero__stats', '.hero__formula'], { opacity: 0, y: 30, duration: 0.9, stagger: 0.1, ease: 'power3.out' }, '-=0.7')
    .add(() => hero.play(), 0.5);
}

document.body.classList.add('is-loading');
const counter = { v: 0 };
const countEl = $('#preloader-count');
const fontsReady = document.fonts?.ready ?? Promise.resolve();
const minTime = new Promise((r) => setTimeout(r, reduce ? 0 : 1300));
gsap.to(counter, { v: 92, duration: 1.2, ease: 'power2.out', onUpdate: () => (countEl.textContent = Math.round(counter.v)) });
Promise.race([Promise.all([fontsReady, minTime]), new Promise((r) => setTimeout(r, 4000))]).then(() => {
  gsap.to(counter, { v: 100, duration: 0.25, onUpdate: () => (countEl.textContent = Math.round(counter.v)), onComplete: intro });
  scrollAnimations();
  ScrollTrigger.refresh();
});
