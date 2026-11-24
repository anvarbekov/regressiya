"""
Real ma'lumotlar to'plamlarini ilova uchun JSON ga eksport qiladi.
Manbalar: statsmodels.datasets va Rdatasets (rdatasets PyPI paketi) — ikkalasi ham
asl nashrlardan olingan, hujjatlashtirilgan ochiq ma'lumotlar.
Ishga tushirish:  pip install statsmodels rdatasets && python3 scripts/export_datasets.py
"""
import json, io, contextlib, math
import numpy as np
import statsmodels.api as sm
import rdatasets

def R(pkg, item):
    with contextlib.redirect_stdout(io.StringIO()):
        return rdatasets.data(pkg, item)

def rnd(v, d=4):
    return None if v is None or (isinstance(v, float) and math.isnan(v)) else round(float(v), d)

DS = []
def add(**kw):
    DS.append(kw)

# 1. O'zbekiston aholisi 1991–2020 (Jahon banki, SP.POP.TOTL)
wp = R('openintro', 'world_pop'); uz = wp[wp.country == 'Uzbekistan'].iloc[0]
rows = [[y, rnd(uz[f'year_{y}'] / 1e6, 4)] for y in range(1991, 2021)]
add(id='uz_aholi', title='O‘zbekiston aholisi soni dinamikasi', category='O‘zbekiston', tag='Trend · ko‘rsatkichli model',
    problem='Mustaqillik yillarida (1991–2020) O‘zbekiston aholisi soni (mln kishi, yil o‘rtasiga) berilgan. Aholi o‘sishining trend modelini quring: chiziqli, ko‘rsatkichli (eksponensial) va parabolik modellarni solishtiring, o‘rtacha yillik o‘sish sur’atini aniqlang va 2025, 2030 yillar uchun prognoz qiling. Trend modellarida Darbin–Uotson statistikasining past bo‘lishini izohlang.',
    source={'name': 'Jahon banki — World Development Indicators (SP.POP.TOTL)', 'via': 'openintro R paketi, world_pop to‘plami', 'url': 'https://data.worldbank.org/indicator/SP.POP.TOTL?locations=UZ'},
    headers=['yil', 'aholi'], units={'aholi': 'mln kishi'}, rows=rows, target='aholi', features=['yil'], modelType='exponential', predictAt=[[2025], [2030]])

# 2. O'zbekiston: YaIM per capita va umr davomiyligi 2000–2020
wb = R('stevedata', 'wbd_example'); u = wb[wb.country == 'Uzbekistan'].sort_values('year')
rows = [[int(r.year), rnd(r.rgdppc, 1), rnd(r.lifeexp, 3)] for r in u.itertuples()]
add(id='uz_yaim_umr', title='O‘zbekiston: daromad va umr davomiyligi', category='O‘zbekiston', tag='Juft · logarifmik model',
    problem='2000–2020 yillarda O‘zbekistonda aholi jon boshiga real YaIM (2015-yil o‘zgarmas narxlarida, AQSh dollari) va kutilayotgan umr davomiyligi (yil) berilgan. Umr davomiyligining daromadga bog‘liqligini chiziqli va logarifmik modellar bilan baholang. 2020-yil (COVID-19 pandemiyasi) kuzatuvining modelga ta’sirini diagnostika yordamida tahlil qiling.',
    source={'name': 'Jahon banki — World Development Indicators (NY.GDP.PCAP.KD, SP.DYN.LE00.IN)', 'via': 'stevedata R paketi, wbd_example to‘plami', 'url': 'https://data.worldbank.org/country/uzbekistan'},
    headers=['yil', 'yaim_pc', 'umr'], units={'yaim_pc': 'AQSh $ (2015 narxlarida)', 'umr': 'yil'}, rows=rows, target='umr', features=['yaim_pc'], modelType='logarithmic', predictAt=[[3500]])

# 3. O'zbekiston: tug'ilish koeffitsiyenti 1960–2011
f = sm.datasets.fertility.load_pandas().data; fu = f[f['Country Name'] == 'Uzbekistan'].iloc[0]
rows = [[y, rnd(fu[str(y)], 3)] for y in range(1960, 2012) if not (isinstance(fu[str(y)], float) and math.isnan(fu[str(y)]))]
add(id='uz_tugilish', title='O‘zbekistonda tug‘ilish koeffitsiyenti', category='O‘zbekiston', tag='Trend · parabolik model',
    problem='1960–2011 yillarda O‘zbekistonda jami tug‘ilish koeffitsiyenti (bir ayolga to‘g‘ri keladigan tug‘ilishlar soni) berilgan. Chiziqli va parabolik trend modellarini quring, ularni R², o‘rtacha nisbiy xato va qoldiqlar grafigi bo‘yicha solishtiring. Parabolik modelda ekstremum nuqtasini toping.',
    source={'name': 'Jahon banki — World Development Indicators (SP.DYN.TFRT.IN)', 'via': 'statsmodels.datasets.fertility', 'url': 'https://data.worldbank.org/indicator/SP.DYN.TFRT.IN?locations=UZ'},
    headers=['yil', 'tugilish'], units={'tugilish': 'bola / ayol'}, rows=rows, target='tugilish', features=['yil'], modelType='quadratic', predictAt=[[2015]])

# 4. BMT: mamlakatlar statistikasi (2009–2011)
un = R('carData', 'UN').dropna(subset=['ppgdp', 'lifeExpF', 'fertility', 'pctUrban']).sort_values('rownames')
rows = [[rnd(r.ppgdp, 1), rnd(r.fertility, 3), rnd(r.pctUrban, 1), rnd(r.lifeExpF, 2)] for r in un.itertuples()]
add(id='bmt_mamlakatlar', title='Dunyo mamlakatlari: ayollar umr davomiyligi', category='Xalqaro', tag='Ko‘p omilli · 199 mamlakat',
    problem='BMTning 2009–2011 yillardagi ma’lumotlari bo‘yicha 199 ta mamlakat (jumladan O‘zbekiston) uchun ayollarning kutilayotgan umr davomiyligi (yil), aholi jon boshiga YaIM (AQSh $), tug‘ilish koeffitsiyenti va shahar aholisi ulushi (%) berilgan. Umr davomiyligiga ta’sir qiluvchi omillarni aniqlang. Logarifmik model (ln YaIM) chiziqli modeldan yaxshiroq ekanini tekshiring. O‘zbekiston uchun qoldiqni talqin qiling.',
    source={'name': 'United Nations (2011). Social indicators. National statistics, 2009–2011', 'via': 'carData R paketi, UN to‘plami (Fox & Weisberg, 2019)', 'url': 'https://unstats.un.org/unsd/demographic/products/socind/'},
    headers=['yaim_pc', 'tugilish', 'shahar', 'umr_ayol'], units={'yaim_pc': 'AQSh $', 'tugilish': 'bola / ayol', 'shahar': '%', 'umr_ayol': 'yil'},
    labels=[str(r.rownames) for r in un.itertuples()], labelHeader='mamlakat', rows=rows, target='umr_ayol', features=['yaim_pc', 'tugilish'], modelType='logarithmic', predictAt=[[1427.3, 2.264]])

# 5. Longley (NIST StRD) — multikollinearlik
lg = sm.datasets.longley.load_pandas().data
rows = [[rnd(v, 4) for v in r] for r in lg[['GNPDEFL', 'GNP', 'UNEMP', 'ARMED', 'POP', 'YEAR', 'TOTEMP']].values.tolist()]
add(id='longley', title='Longley: AQSh bandligi (NIST etaloni)', category='Klassik', tag='Ko‘p omilli · multikollinearlik',
    problem='AQShning 1947–1962 yillardagi makroiqtisodiy ko‘rsatkichlari: band aholi soni (ming kishi) YaIM deflyatori, YaIM, ishsizlar soni, qurolli kuchlar soni, 14 yoshdan katta aholi va yilga bog‘liqligi. Bu ma’lumotlar NIST tomonidan regressiya dasturlarining aniqligini tekshirish uchun sertifikatlangan. Modelni quring, VIF va shartlilik soni bo‘yicha multikollinearlikni tahlil qiling.',
    source={'name': 'Longley J. W. (1967). An appraisal of least squares programs for the electronic computer from the point of view of the user. JASA, 62(319), 819–841', 'via': 'NIST Statistical Reference Datasets; statsmodels.datasets.longley', 'url': 'https://www.itl.nist.gov/div898/strd/lls/data/Longley.shtml'},
    headers=['deflyator', 'yaim', 'ishsiz', 'armiya', 'aholi', 'yil', 'band'], units={'deflyator': '1954=100', 'yaim': 'mln $', 'ishsiz': 'ming', 'armiya': 'ming', 'aholi': 'ming', 'band': 'ming kishi'},
    labels=[str(int(r[5])) for r in rows], labelHeader='yil', rows=rows, target='band', features=['deflyator', 'yaim', 'ishsiz', 'armiya', 'aholi', 'yil'], modelType='linear', predictAt=None)

# 6. Engel (1857) — oziq-ovqat xarajatlari
en = sm.datasets.engel.load_pandas().data
rows = [[rnd(a, 2), rnd(b, 2)] for a, b in en[['income', 'foodexp']].values]
add(id='engel', title='Engel qonuni: daromad va oziq-ovqat xarajatlari', category='Klassik', tag='Juft · geteroskedastiklik',
    problem='E. Engel (1857) tomonidan o‘rganilgan 235 ta belgiyalik ishchi oilasining yillik daromadi va oziq-ovqatga xarajati (belgiya franki) berilgan. Oziq-ovqat xarajatlarining daromadga bog‘liqligini baholang, oziq-ovqatga chegaraviy moyillikni va elastiklikni toping (Engel qonuni: elastiklik < 1). Geteroskedastiklikni Breush–Pagan testi bilan tekshiring va bardoshli (HC3) standart xatolar bilan solishtiring.',
    source={'name': 'Engel E. (1857). Die Productions- und Consumtionsverhältnisse des Königreichs Sachsen; Koenker R., Bassett G. (1982), Econometrica 50, 43–61', 'via': 'statsmodels.datasets.engel', 'url': 'https://www.statsmodels.org/stable/datasets/generated/engel.html'},
    headers=['daromad', 'oziq_ovqat'], units={'daromad': 'BEF', 'oziq_ovqat': 'BEF'}, rows=rows, target='oziq_ovqat', features=['daromad'], modelType='linear', predictAt=[[1000]])

# 7. AQSh iste'mol funksiyasi (Keyns) 1959–2009
md = sm.datasets.macrodata.load_pandas().data
rows = [[rnd(a, 1), rnd(b, 1)] for a, b in md[['realdpi', 'realcons']].values]
add(id='keyns', title='Keyns iste’mol funksiyasi (AQSh, 1959–2009)', category='Iqtisodiyot', tag='Juft · avtokorrelyatsiya',
    problem='AQShning 1959-yil I choragidan 2009-yil III choragigacha bo‘lgan real ixtiyoriy daromadi va real shaxsiy iste’mol xarajatlari (2005-yil narxlarida, mlrd $, yillik hisobda) berilgan. Keyns iste’mol funksiyasini C = a + b·Y ko‘rinishida baholang: iste’molga chegaraviy moyillik (b) va avtonom iste’molni (a) toping. Vaqt qatori uchun Darbin–Uotson testi natijasini talqin qiling.',
    source={'name': 'U.S. Bureau of Economic Analysis; Federal Reserve Bank of St. Louis (FRED)', 'via': 'statsmodels.datasets.macrodata', 'url': 'https://www.statsmodels.org/stable/datasets/generated/macrodata.html'},
    headers=['daromad', 'istemol'], units={'daromad': 'mlrd $ (2005)', 'istemol': 'mlrd $ (2005)'},
    labels=[f'{int(a)}-Q{int(b)}' for a, b in md[['year', 'quarter']].values], labelHeader='chorak', rows=rows, target='istemol', features=['daromad'], modelType='linear', predictAt=[[10000]])

# 8. Hayot sikli jamg'armalari (Belsley, Kuh, Welsch 1980)
ls = R('datasets', 'LifeCycleSavings')
rows = [[rnd(r.pop15, 2), rnd(r.pop75, 2), rnd(r.dpi, 2), rnd(r.ddpi, 2), rnd(r.sr, 2)] for r in ls.itertuples()]
add(id='jamgarma', title='Hayot sikli gipotezasi: 50 mamlakat jamg‘armalari', category='Iqtisodiyot', tag='Ko‘p omilli · 4 omil',
    problem='1960–1970 yillardagi 50 mamlakat bo‘yicha o‘rtacha jamg‘arma normasi (% daromad) 15 yoshgacha va 75 yoshdan katta aholi ulushi (%), jon boshiga ixtiyoriy daromad ($) va uning o‘sish sur’ati (%) berilgan. Modigliani hayot sikli gipotezasini tekshiring: qaysi omillar jamg‘armaga ahamiyatli ta’sir qiladi? Ta’sirchan mamlakatlarni Kuk masofasi bo‘yicha aniqlang.',
    source={'name': 'Belsley D. A., Kuh E., Welsch R. E. (1980). Regression Diagnostics. Wiley; Sterling A. (1977)', 'via': 'R datasets paketi, LifeCycleSavings', 'url': 'https://stat.ethz.ch/R-manual/R-devel/library/datasets/html/LifeCycleSavings.html'},
    headers=['yosh15', 'yosh75', 'daromad', 'osish', 'jamgarma'], units={'yosh15': '%', 'yosh75': '%', 'daromad': '$', 'osish': '%', 'jamgarma': '%'},
    labels=[str(r.rownames) for r in ls.itertuples()], labelHeader='mamlakat', rows=rows, target='jamgarma', features=['yosh15', 'yosh75', 'daromad', 'osish'], modelType='linear', predictAt=None)

# 9. Gilos daraxtlari (darajali / Kobb–Duglas tipidagi model)
tr = R('datasets', 'trees')
rows = [[rnd(r.Girth * 2.54, 2), rnd(r.Height * 0.3048, 2), rnd(r.Volume * 0.0283168, 4)] for r in tr.itertuples()]
add(id='daraxtlar', title='Daraxt yog‘ochi hajmini baholash', category='Klassik', tag='Darajali model · ln–ln',
    problem='31 ta qora gilos daraxtining diametri (sm, 1.37 m balandlikda), balandligi (m) va yog‘och hajmi (m³) berilgan. Hajmni o‘lchanadigan ko‘rsatkichlar orqali baholash modelini quring. Darajali model V = a·D^b·H^c ni logarifmlash orqali chiziqli ko‘rinishga keltiring va chiziqli model bilan solishtiring. Geometriyaga ko‘ra b ≈ 2, c ≈ 1 bo‘lishi kutiladi — tekshiring.',
    source={'name': 'Ryan T. A., Joiner B. L., Ryan B. F. (1976). The Minitab Student Handbook. Duxbury Press', 'via': 'R datasets paketi, trees (birliklar SI tizimiga o‘tkazilgan)', 'url': 'https://stat.ethz.ch/R-manual/R-devel/library/datasets/html/trees.html'},
    headers=['diametr', 'balandlik', 'hajm'], units={'diametr': 'sm', 'balandlik': 'm', 'hajm': 'm³'}, rows=rows, target='hajm', features=['diametr', 'balandlik'], modelType='power', predictAt=[[35, 23]])

# 10. Avtomobil tormoz yo'li (Ezekiel 1930)
ca = R('datasets', 'cars')
rows = [[rnd(r.speed * 1.609344, 2), rnd(r.dist * 0.3048, 2)] for r in ca.itertuples()]
add(id='tormoz', title='Avtomobil tezligi va tormoz yo‘li', category='Klassik', tag='Juft · parabolik model',
    problem='1920-yillarda o‘tkazilgan tajribada 50 ta avtomobilning tezligi (km/soat) va to‘xtash masofasi (m) qayd etilgan. Fizika qonunlariga ko‘ra tormoz yo‘li tezlikning kvadratiga proporsional. Chiziqli va parabolik modellarni solishtiring, 50 km/soat tezlikda to‘xtash masofasini bashorat oralig‘i bilan aniqlang.',
    source={'name': 'Ezekiel M. (1930). Methods of Correlation Analysis. Wiley; McNeil D. R. (1977). Interactive Data Analysis', 'via': 'R datasets paketi, cars (birliklar SI tizimiga o‘tkazilgan)', 'url': 'https://stat.ethz.ch/R-manual/R-devel/library/datasets/html/cars.html'},
    headers=['tezlik', 'masofa'], units={'tezlik': 'km/soat', 'masofa': 'm'}, rows=rows, target='masofa', features=['tezlik'], modelType='quadratic', predictAt=[[50]])

# 11. Galton (1886) — "regressiya" atamasining kelib chiqishi
ga = R('HistData', 'Galton')
rows = [[rnd(a * 2.54, 2), rnd(b * 2.54, 2)] for a, b in ga[['parent', 'child']].values]
add(id='galton', title='Galton: ota-ona va farzand bo‘yi (1886)', category='Klassik', tag='Juft · tarixiy',
    problem='F. Galton 1886-yilda 928 nafar farzand va ularning ota-onalari o‘rtacha bo‘yini (sm) o‘lchagan. Aynan shu ma’lumotlarda “o‘rtachaga qaytish” (regression) hodisasi kashf etilgan. Regressiya koeffitsiyentini toping va uning 1 dan kichikligi nimani anglatishini tushuntiring.',
    source={'name': 'Galton F. (1886). Regression towards mediocrity in hereditary stature. J. Anthropological Institute, 15, 246–263', 'via': 'HistData R paketi, Galton (birliklar sm ga o‘tkazilgan)', 'url': 'https://www.rdocumentation.org/packages/HistData/topics/Galton'},
    headers=['ota_ona', 'farzand'], units={'ota_ona': 'sm', 'farzand': 'sm'}, rows=rows, target='farzand', features=['ota_ona'], modelType='linear', predictAt=[[175]])

# 12. Stack loss (Brownlee 1965)
st = R('datasets', 'stackloss')
rows = [[int(r._2), int(r._3), int(r._4), int(r._5)] for r in st.itertuples()]
add(id='stackloss', title='Kimyo zavodi: ammiak yo‘qotilishi', category='Klassik', tag='Ko‘p omilli · ta’sirchan nuqtalar',
    problem='Ammiakni azot kislotasiga oksidlovchi zavodning 21 kunlik ish ma’lumotlari: havo oqimi, sovutish suvi harorati (°C), kislota konsentratsiyasi (kodlangan) va ammiak yo‘qotilishi (kodlangan, ×10). Yo‘qotishni omillar bilan bog‘lovchi modelni quring va ta’sirchan kuzatuvlarni (ayniqsa 21-kun) diagnostika qiling.',
    source={'name': 'Brownlee K. A. (1965). Statistical Theory and Methodology in Science and Engineering. 2nd ed. Wiley', 'via': 'R datasets paketi, stackloss', 'url': 'https://stat.ethz.ch/R-manual/R-devel/library/datasets/html/stackloss.html'},
    headers=['havo', 'harorat', 'kislota', 'yoqotish'], units={'havo': 'birlik', 'harorat': '°C', 'kislota': 'kod', 'yoqotish': 'kod'}, rows=rows, target='yoqotish', features=['havo', 'harorat', 'kislota'], modelType='linear', predictAt=None)

# 13. Anskomb kvarteti (1973)
an = R('datasets', 'anscombe')
rows = [[rnd(v, 2) for v in r] for r in an[['x1', 'y1', 'x2', 'y2', 'x3', 'y3', 'x4', 'y4']].values]
add(id='anscombe', title='Anskomb kvarteti: nega grafik muhim', category='Klassik', tag='Juft · diagnostika',
    problem='F. Anskomb (1973) to‘rtta ma’lumotlar juftligini tuzgan: ularning barchasida o‘rtacha qiymatlar, korrelyatsiya va regressiya tenglamasi (ŷ ≈ 3 + 0.5x) deyarli bir xil, lekin grafiklar butunlay farq qiladi. y1~x1, y2~x2, y3~x3, y4~x4 modellarini navbatma-navbat quring va qoldiqlar diagnostikasini solishtiring.',
    source={'name': 'Anscombe F. J. (1973). Graphs in statistical analysis. The American Statistician, 27(1), 17–21', 'via': 'R datasets paketi, anscombe', 'url': 'https://stat.ethz.ch/R-manual/R-devel/library/datasets/html/anscombe.html'},
    headers=['x1', 'y1', 'x2', 'y2', 'x3', 'y3', 'x4', 'y4'], units={}, rows=rows, target='y1', features=['x1'], modelType='linear', predictAt=[[10]])

for d in DS:
    assert all(len(r) == len(d['headers']) for r in d['rows']), d['id']
    assert all(v is not None for r in d['rows'] for v in r), d['id']
    if d.get('labels'): assert len(d['labels']) == len(d['rows']), d['id']
open('src/data/datasets.js', 'w').write('/* Avtomatik yaratilgan: scripts/export_datasets.py — qo‘lda tahrirlamang */\nexport default ' + json.dumps(DS, ensure_ascii=False, separators=(',', ':')) + ';\n')
json.dump(DS, open('src/data/datasets.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(DS), 'ta to‘plam;', sum(len(d['rows']) for d in DS), 'ta kuzatuv')
for d in DS: print(f"  {d['id']:16} n={len(d['rows']):4}  {d['title']}")
