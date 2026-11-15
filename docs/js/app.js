/* ATHAR website — single-page app, no framework. Data: NASA POWER (MERRA-2 / CERES), annual means. */
(async () => {
const $ = s => document.querySelector(s);
const [SERIES, CATALOG] = await Promise.all([fetch('data/series.json').then(r => r.json()), fetch('data/catalog.json').then(r => r.json())]);
const PLACES = Object.keys(SERIES);
const L = { // i18n
 en: { dir:'ltr', lang:'العربية', nav:{home:'Home',platform:'Platform',method:'Method',about:'About'},
  h_eyebrow:'NASA Space Apps 2026 · Earth System Trend Detective', h_title:'Which Earth variables are really changing?',
  h_sub:'ATHAR reads 40+ years of NASA data, ranks what is changing, tests whether each trend is real, and writes the case file in plain English and Arabic.',
  cta:'Open the platform', cta2:'How it works',
  steps_t:'Four steps from raw data to a defensible story', steps_s:'No guessing which variable to look at, and no trend reported unless it survives a fair test.',
  steps:[['Triage','Ranks 11 NASA variables for any place so you know where to look first.'],['Test','Mann–Kendall with serial-correlation correction and Theil–Sen slope with a confidence interval.'],['Case file','A written summary in English and Arabic. Every number comes from the test, never invented.'],['Honesty lab','Simulates trendless data to show how often each method raises a false alarm.']],
  st:[['11','NASA variables'],['10','places, 6 in Oman'],['45','years, 1981–2025'],['2','languages']],
  pf_t:'The platform', pf_s:'Pick a place and a start year. Everything below recalculates in your browser.',
  place:'Place', start:'Start year', alpha:'Significance level', var:'Variable',
  tabs:{triage:'1 · Variable triage',case:'2 · Case file',compare:'3 · Compare places',honesty:'4 · Honesty lab',own:'5 · Your own data'},
  col:{rank:'#',variable:'Variable',unit:'Unit',trend:'Trend / decade',ci:'95% CI / decade',pct:'% / decade',p:'p-value',fdr:'FDR-safe',snr:'Signal / noise',verdict:'Verdict',score:'Score'},
  lead:{strong:'Strong lead',moderate:'Moderate lead',noise:'Noise / inconclusive'},
  tri_note:'Score = 50% significance + 30% size of change vs noise + 20% data completeness. “FDR-safe” means the result still holds after Benjamini–Hochberg control across all 11 variables. Click a row to open its case file.',
  yes:'Yes', no:'No', per:'per decade',
  chart_obs:'Annual mean', chart_trend:'Theil–Sen trend', chart_ci:'95% band', chart_cp:'Change point',
  cf:{what:'WHAT',where:'WHERE',how:'HOW MUCH',real:'IS IT REAL?',caveat:'CAVEAT'},
  story:(c)=>({what:`<b>${c.v}</b> at ${c.pl} is <b>${c.dirw}</b> ${c.span}.`,
    how:`Theil–Sen slope <b>${c.sl} ${c.u} per decade</b> (95% CI ${c.lo} to ${c.hi}), about ${c.pct}% per decade; total change ${c.tot} ${c.u} over ${c.yrs} years.`,
    real:c.sig?`Yes. The Mann–Kendall test, corrected for year-to-year memory, gives <b>p ${c.pp}</b>. The signal is ${c.snr}× the noise.`:`Not established. The corrected Mann–Kendall test gives <b>p ${c.pp}</b>, so the apparent change could be natural variability.`,
    cav:c.step?`A change point near ${c.cy} explains most of the change. That pattern often means a change in the data source or instrument, not the climate. Check before drawing conclusions.`:(c.cy?`The strongest shift in the record is around ${c.cy}, but it is not large enough to suggest an artificial step.`:'No change point detected.')}),
  dirw:{up:'rising',down:'falling',none:'showing no significant trend'},
  cmp_t:'Same variable, ten places', cmp_s:'Trend per decade with 95% confidence whiskers. Filled marks are statistically significant.',
  hon_t:'Does the method cry wolf?', hon_s:'We generate series with no real trend but with year-to-year memory, then count how often each test still reports a trend. A fair test should be near 5%.',
  phi:'Memory in data (φ)', npts:'Years in series', trials:'Simulated series', trend:'True trend (σ per decade)', run:'Run simulation',
  plain:'Plain Mann–Kendall', corr:'ATHAR (corrected)', fa:'False alarms (no real trend)', pw:'Detected (real trend)', target:'5% target',
  own_t:'Bring your own data', own_s:'Paste two columns: year and value (comma, semicolon or tab separated). Needs at least 8 years.',
  own_btn:'Analyze', dl:'Download CSV', own_file:'Or choose a CSV file', own_name:'Series name', own_unit:'Unit', own_err:'Need at least 8 valid rows of year,value.',
  method_t:'Method', method_s:'What happens inside, in plain language.',
  method:[['Annual means','NASA POWER monthly values (MERRA-2 reanalysis, CERES satellite radiation) are averaged by year; years with fewer than 10 months are dropped.'],['Mann–Kendall trend test','A rank-based test that does not assume a straight line or a bell curve. We multiply its variance by (1+r)/(1−r), where r is the lag-1 autocorrelation of the detrended series, so slowly varying data cannot fake a trend.'],['Theil–Sen slope','The median of all pairwise slopes: robust to outliers. Its confidence interval uses the same corrected variance, so interval and p-value agree.'],['Pettitt change point','Finds the most likely year the mean shifted. If it is highly significant and explains at least 60% of the total change, ATHAR flags a suspected artificial step.'],['False-discovery control','Benjamini–Hochberg at 5% across the 11 variables, so a lucky result among many tests is not reported as a finding.'],['Honesty lab','A Monte-Carlo check you can run yourself, with no trend in the data, to measure the real false-alarm rate.']],
  limits_t:'Limits we state openly', limits:['Annual reanalysis values at one grid cell, not station measurements.','Reanalysis can contain steps when observing systems change; the change-point flag is a warning, not proof.','Statistical significance is not a physical explanation. ATHAR says where to look, not why.'],
  about_t:'About', about_s:'Built by the Science Club, Military Technological College, for the NASA Space Apps Challenge 2026, Ibra local event (hosted by UTAS Ibra). Challenge: “Be an Earth System Trend Detective!”',
  team:'Team', data_t:'Data and credits', data:'Data: NASA POWER API (MERRA-2 and CERES SYN1deg), 1981–2025 annual means, bundled with this site so it works offline. Statistics: Mann (1945), Kendall (1975), Theil (1950), Sen (1968), Pettitt (1979), Benjamini and Hochberg (1995).',
  foot:'ATHAR · Science Club, Military Technological College · NASA Space Apps 2026 · Ibra' },
 ar: { dir:'rtl', lang:'English', nav:{home:'الرئيسية',platform:'المنصة',method:'المنهجية',about:'عن المشروع'},
  h_eyebrow:'تحدي ناسا لتطبيقات الفضاء 2026 · محقق اتجاهات نظام الأرض', h_title:'أي متغيرات الأرض تتغيّر فعلاً؟',
  h_sub:'أثر يقرأ أكثر من 40 سنة من بيانات ناسا، ويرتّب ما يتغيّر، ويختبر هل كل اتجاه حقيقي، ويكتب ملف الحالة بالعربية والإنجليزية.',
  cta:'افتح المنصة', cta2:'كيف تعمل',
  steps_t:'أربع خطوات من البيانات الخام إلى قصة قابلة للدفاع عنها', steps_s:'لا تخمين في اختيار المتغير، ولا اتجاه يُذكر إلا إذا نجح في اختبار عادل.',
  steps:[['الفرز','يرتّب 11 متغيراً من ناسا لأي موقع لتعرف من أين تبدأ.'],['الاختبار','اختبار مان–كندال مع تصحيح الارتباط الزمني، وميل ثيل–سين مع فاصل ثقة.'],['ملف الحالة','ملخص مكتوب بالعربية والإنجليزية. كل رقم فيه من الاختبار، لا شيء مخترع.'],['مختبر الأمانة','يحاكي بيانات بلا اتجاه ليُظهر كم مرة تُطلق كل طريقة إنذاراً كاذباً.']],
  st:[['11','متغيراً من ناسا'],['10','مواقع، 6 منها في عُمان'],['45','سنة، 1981–2025'],['2','لغتان']],
  pf_t:'المنصة', pf_s:'اختر موقعاً وسنة بداية. كل ما تحت يُعاد حسابه داخل متصفحك.',
  place:'الموقع', start:'سنة البداية', alpha:'مستوى الدلالة', var:'المتغير',
  tabs:{triage:'١ · فرز المتغيرات',case:'٢ · ملف الحالة',compare:'٣ · مقارنة المواقع',honesty:'٤ · مختبر الأمانة',own:'٥ · بياناتك'},
  col:{rank:'#',variable:'المتغير',unit:'الوحدة',trend:'الاتجاه / عقد',ci:'فاصل الثقة 95% / عقد',pct:'% / عقد',p:'القيمة الاحتمالية',fdr:'آمن من الصدفة',snr:'الإشارة / الضجيج',verdict:'الحكم',score:'الدرجة'},
  lead:{strong:'مؤشر قوي',moderate:'مؤشر متوسط',noise:'ضجيج / غير حاسم'},
  tri_note:'الدرجة = 50% دلالة + 30% حجم التغير مقابل الضجيج + 20% اكتمال البيانات. «آمن من الصدفة» يعني أن النتيجة صمدت بعد ضبط بنجامني–هوشبرغ عبر المتغيرات الـ11. اضغط على صف لفتح ملف حالته.',
  yes:'نعم', no:'لا', per:'لكل عقد',
  chart_obs:'المتوسط السنوي', chart_trend:'اتجاه ثيل–سين', chart_ci:'نطاق 95%', chart_cp:'نقطة التغير',
  cf:{what:'ماذا',where:'أين',how:'كم',real:'هل هو حقيقي؟',caveat:'تنبيه'},
  story:(c)=>({what:`<b>${c.v}</b> في ${c.pl} <b>${c.dirw}</b> ${c.span}.`,
    how:`ميل ثيل–سين <b>${c.sl} ${c.u} لكل عقد</b> (فاصل الثقة 95% من ${c.lo} إلى ${c.hi})، أي نحو ${c.pct}% لكل عقد؛ والتغير الكلي ${c.tot} ${c.u} خلال ${c.yrs} سنة.`,
    real:c.sig?`نعم. اختبار مان–كندال بعد تصحيح ذاكرة السنوات يعطي <b>p ${c.pp}</b>، والإشارة ${c.snr} أضعاف الضجيج.`:`غير مثبت. اختبار مان–كندال المصحَّح يعطي <b>p ${c.pp}</b>، فقد يكون التغير الظاهر تقلباً طبيعياً.`,
    cav:c.step?`نقطة تغير قرب ${c.cy} تفسّر معظم التغير. وهذا النمط غالباً يدل على تغيّر في مصدر البيانات أو الجهاز لا في المناخ. تحقّق قبل الاستنتاج.`:(c.cy?`أقوى تحوّل في السجل قرب ${c.cy}، لكنه ليس كبيراً بما يكفي ليدل على قفزة مصطنعة.`:'لم تُكتشف نقطة تغير.')}),
  dirw:{up:'يرتفع',down:'ينخفض',none:'بلا اتجاه معنوي'},
  cmp_t:'متغير واحد، عشرة مواقع', cmp_s:'الاتجاه لكل عقد مع أسوار ثقة 95%. العلامة الممتلئة تعني دلالة إحصائية.',
  hon_t:'هل الطريقة تُنذر كذباً؟', hon_s:'نولّد سلاسل بلا اتجاه حقيقي لكن بذاكرة من سنة لأخرى، ثم نعدّ كم مرة يعلن كل اختبار اتجاهاً. الاختبار العادل يقترب من 5%.',
  phi:'الذاكرة في البيانات (φ)', npts:'عدد السنوات', trials:'عدد السلاسل', trend:'الاتجاه الحقيقي (σ لكل عقد)', run:'شغّل المحاكاة',
  plain:'مان–كندال العادي', corr:'أثر (مصحَّح)', fa:'إنذارات كاذبة (بلا اتجاه حقيقي)', pw:'اكتشاف (اتجاه حقيقي)', target:'الهدف ٥٪',
  own_t:'أحضر بياناتك', own_s:'الصق عمودين: السنة والقيمة (مفصولين بفاصلة أو فاصلة منقوطة أو tab). الحد الأدنى 8 سنوات.',
  own_btn:'حلّل', dl:'تنزيل CSV', own_file:'أو اختر ملف CSV', own_name:'اسم السلسلة', own_unit:'الوحدة', own_err:'نحتاج 8 صفوف صالحة على الأقل بصيغة سنة،قيمة.',
  method_t:'المنهجية', method_s:'ماذا يحدث في الداخل، بلغة بسيطة.',
  method:[['المتوسطات السنوية','القيم الشهرية من ناسا باور (إعادة تحليل MERRA-2 وإشعاع CERES) تُحوَّل إلى متوسطات سنوية، وتُستبعد السنوات التي فيها أقل من 10 أشهر.'],['اختبار مان–كندال','اختبار رتبي لا يفترض خطاً مستقيماً ولا توزيعاً جرسياً. نضرب تباينه في (1+r)/(1−r) حيث r هو الارتباط الذاتي من الدرجة الأولى للسلسلة بعد إزالة الاتجاه، حتى لا تُصنع اتجاهات وهمية من بيانات بطيئة التغير.'],['ميل ثيل–سين','وسيط كل الميول الزوجية، فلا يتأثر بالقيم الشاذة. وفاصل ثقته يستخدم نفس التباين المصحَّح فيتفق مع القيمة الاحتمالية.'],['نقطة التغير لبيتيت','يجد السنة الأرجح لتحوّل المتوسط. إن كانت معنوية جداً وتفسّر 60% على الأقل من التغير الكلي، يرفع أثر علامة قفزة مصطنعة محتملة.'],['ضبط الاكتشاف الكاذب','بنجامني–هوشبرغ عند 5% عبر المتغيرات الـ11، فلا تُعلن نتيجة محظوظة وسط اختبارات كثيرة.'],['مختبر الأمانة','فحص مونت كارلو تشغّله بنفسك على بيانات بلا اتجاه لقياس معدل الإنذار الكاذب الحقيقي.']],
  limits_t:'حدود نذكرها بصراحة', limits:['قيم إعادة تحليل سنوية عند خلية شبكة واحدة، وليست قياسات محطات.','قد تحوي إعادة التحليل قفزات عند تغيّر أنظمة الرصد؛ وعلامة نقطة التغير تحذير لا إثبات.','الدلالة الإحصائية ليست تفسيراً فيزيائياً. أثر يدلّك أين تنظر لا لماذا.'],
  about_t:'عن المشروع', about_s:'من إعداد النادي العلمي - الكلية العسكرية التقنية ضمن تحدي ناسا لتطبيقات الفضاء 2026، فعالية إبراء المحلية (استضافة جامعة التقنية والعلوم التطبيقية بإبراء). التحدي: «كن محقق اتجاهات نظام الأرض!»',
  team:'الفريق', data_t:'البيانات والمراجع', data:'البيانات: واجهة <bdi dir="ltr">NASA POWER</bdi> (إعادة تحليل <bdi dir="ltr">MERRA-2</bdi> و<bdi dir="ltr">CERES SYN1deg</bdi>)، متوسطات سنوية 1981–2025، مضمَّنة في الموقع ليعمل دون إنترنت. الإحصاء: <bdi dir="ltr">Mann (1945)</bdi>، <bdi dir="ltr">Kendall (1975)</bdi>، <bdi dir="ltr">Theil (1950)</bdi>، <bdi dir="ltr">Sen (1968)</bdi>، <bdi dir="ltr">Pettitt (1979)</bdi>، <bdi dir="ltr">Benjamini</bdi> و<bdi dir="ltr">Hochberg (1995)</bdi>.',
  foot:'أثر · النادي العلمي - الكلية العسكرية التقنية · تحدي ناسا لتطبيقات الفضاء 2026 · إبراء' }
};
const TEAM = [
  { ar: 'سيف سلطان السعيدي', en: 'Saif Sultan Alsaidi' },
  { ar: 'مهند محسن العلوي', en: 'Muhannad Muhsen Alalawi' },
  { ar: 'حبيب حمد الشماخي', en: 'Habib Hamed Alshammakhi' },
  { ar: 'عمران نادر الكلباني', en: 'Omran Nadir Alkalbani' },
  { ar: 'جاسم خالد المطوع', en: 'Jassim Khalid Almuttawa' },
  { ar: 'عمار نصير البلوشي', en: 'Ammar Nasir Albalushi' }
];
const S = { lang: (localStorage.getItem('athar-lang') || 'ar'), place: PLACES[0], start: 1981, alpha: 0.05, tab: 'triage', code: 'WS10M', own: null,
  hon: { phi: .5, n: 40, trials: 1000, trend: 0, res: null } };
const T = () => L[S.lang];
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const nm = c => S.lang === 'ar' ? c.ar : c.en;
const plName = p => { const [a, b] = p.split(' / '); return S.lang === 'ar' && b ? b.replace(/\s*\(.*$/, '') : a; };
const fmt = (x, d = 3) => !isFinite(x) ? '–' : Math.abs(x) >= 100 ? x.toFixed(1) : (+x.toPrecision(d)).toString();
const fmtP = p => p < 0.0001 ? '< 0.0001' : p.toFixed(4);
const sgn = x => (x > 0 ? '+' : '') + fmt(x);
const digits = s => S.lang === 'ar' ? String(s) : String(s);

function getSeries(place, code, start) {
  const o = SERIES[place].series[code] || {}; const yrs = Object.keys(o).map(Number).filter(y => y >= start).sort((a, b) => a - b);
  return { t: yrs, y: yrs.map(y => o[y]) };
}
function triage() {
  const maxN = Math.max(...Object.keys(SERIES[S.place].series.T2M).map(Number)) - S.start + 1;
  const rows = CATALOG.map(c => { const { t, y } = getSeries(S.place, c.code, S.start); if (y.length < 8) return null;
    const r = ATHAR.analyze(y, t, S.alpha); return { c, r, comp: Math.min(1, y.length / maxN) }; }).filter(Boolean);
  const sig = ATHAR.bh(rows.map(x => x.r.p), S.alpha);
  rows.forEach((x, i) => { x.fdr = sig[i]; x.score = ATHAR.score(x.r, x.comp); x.lead = ATHAR.leadLabel(x.r.p, x.r.snr); });
  return rows.sort((a, b) => b.score - a.score);
}
/* ---------- SVG charts ---------- */
const COL = { strong: '#0B6B5D', moderate: '#E7A93A', noise: '#9AA5AE' };
function barsSVG(rows) {
  const W = 900, rh = 34, H = rows.length * rh + 24, lw = 230; const rtl = S.lang === 'ar';
  let g = ''; rows.forEach((x, i) => { const y = 12 + i * rh, w = (W - lw - 70) * x.score / 100;
    const bx = rtl ? W - lw - w : lw; const lx = rtl ? W - lw + 10 : lw - 10;
    g += `<text x="${lx}" y="${y + 21}" text-anchor="${rtl ? 'start' : 'end'}" font-size="15" fill="#0E2230">${esc(nm(x.c))}</text><rect x="${bx}" y="${y + 4}" width="${w}" height="22" rx="4" fill="${COL[x.lead]}"/><text x="${rtl ? bx - 8 : bx + w + 8}" y="${y + 21}" text-anchor="${rtl ? 'end' : 'start'}" font-size="14" fill="#44505A">${x.score.toFixed(0)}</text>`; });
  return `<svg direction="ltr" viewBox="0 0 ${W} ${H}" role="img" aria-label="${T().col.score}">${g}</svg>`;
}
function lineSVG(t, y, r, unit) {
  const W = 900, H = 380, m = { l: 62, r: 20, t: 20, b: 42 }; const ymin0 = Math.min(...y), ymax0 = Math.max(...y), pad = (ymax0 - ymin0) * .12 || 1;
  const x0 = Math.min(...t), x1 = Math.max(...t), y0 = ymin0 - pad, y1 = ymax0 + pad;
  const sx = v => m.l + (v - x0) / (x1 - x0) * (W - m.l - m.r), sy = v => H - m.b - (v - y0) / (y1 - y0) * (H - m.t - m.b);
  const tm = (x0 + x1) / 2, ym = r.icpt + r.slope * tm;
  const line = (s, v0) => `${sx(x0)},${sy(v0 + s * (x0 - tm))} ${sx(x1)},${sy(v0 + s * (x1 - tm))}`;
  const band = `${sx(x0)},${sy(ym + r.lo * (x0 - tm))} ${sx(x1)},${sy(ym + r.lo * (x1 - tm))} ${sx(x1)},${sy(ym + r.hi * (x1 - tm))} ${sx(x0)},${sy(ym + r.hi * (x0 - tm))}`;
  let g = ''; for (let i = 0; i <= 4; i++) { const v = y0 + (y1 - y0) * i / 4; g += `<line x1="${m.l}" x2="${W - m.r}" y1="${sy(v)}" y2="${sy(v)}" stroke="#E3DCCB"/><text x="${m.l - 8}" y="${sy(v) + 5}" text-anchor="end" font-size="13" fill="#5A6B77">${fmt(v, 3)}</text>`; }
  for (let yr = Math.ceil(x0 / 10) * 10; yr <= x1; yr += 10) g += `<text x="${sx(yr)}" y="${H - 14}" text-anchor="middle" font-size="13" fill="#5A6B77">${yr}</text>`;
  const pts = t.map((v, i) => `${sx(v)},${sy(y[i])}`).join(' ');
  const cp = r.changeYear ? `<line x1="${sx(r.changeYear)}" x2="${sx(r.changeYear)}" y1="${m.t}" y2="${H - m.b}" stroke="#B5483C" stroke-dasharray="6 5"/><text x="${sx(r.changeYear) + 6}" y="${m.t + 14}" font-size="13" fill="#B5483C">${T().chart_cp} ${r.changeYear}</text>` : '';
  return `<svg direction="ltr" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(unit)}">${g}<polygon points="${band}" fill="#E7A93A" opacity=".25"/>${cp}<polyline points="${pts}" fill="none" stroke="#0E2230" stroke-width="2"/>${t.map((v, i) => `<circle cx="${sx(v)}" cy="${sy(y[i])}" r="3" fill="#0E2230"/>`).join('')}<polyline points="${line(r.slope, ym)}" fill="none" stroke="#B5790A" stroke-width="3.5"/><text x="${m.l - 50}" y="${m.t + 10}" font-size="13" fill="#5A6B77">${esc(unit)}</text></svg>
  <div class="legend"><span><i style="background:#0E2230"></i>${T().chart_obs}</span><span><i style="background:#B5790A"></i>${T().chart_trend}</span><span><i style="background:#E7A93A;opacity:.4"></i>${T().chart_ci}</span>${r.changeYear ? `<span><i style="background:#B5483C"></i>${T().chart_cp}</span>` : ''}</div>`;
}
function whiskSVG(rows) {
  const W = 900, rh = 40, H = rows.length * rh + 30, lw = 190; const rtl = S.lang === 'ar';
  const ext = Math.max(...rows.map(x => Math.max(Math.abs(x.lo), Math.abs(x.hi)))) * 1.1 || 1; const cx = (rtl ? 30 : lw) + (W - lw - 30) / 2, scale = (W - lw - 30) / 2 / ext;
  const X = v => cx + v * scale; let g = `<line x1="${cx}" x2="${cx}" y1="6" y2="${H - 20}" stroke="#9AA5AE"/>`;
  rows.forEach((x, i) => { const y = 16 + i * rh; const col = x.sig ? (x.s > 0 ? '#B5483C' : '#1F6FA8') : '#9AA5AE';
    g += `<text x="${rtl ? W - 4 : 4}" y="${y + 5}" text-anchor="${rtl ? 'end' : 'start'}" font-size="15" fill="#0E2230">${esc(plName(x.p))}</text><line x1="${X(x.lo)}" x2="${X(x.hi)}" y1="${y}" y2="${y}" stroke="${col}" stroke-width="3"/><circle cx="${X(x.s)}" cy="${y}" r="7" fill="${x.sig ? col : '#fff'}" stroke="${col}" stroke-width="3"/>`; });
  return `<svg direction="ltr" viewBox="0 0 ${W} ${H}" role="img">${g}</svg>`;
}
function honSVG(res) {
  const W = 900, H = 260, base = 215, sc = 3.0; const bars = [[T().plain, res.plain, '#B5483C', 230], [T().corr, res.corr, '#0B6B5D', 560]];
  let g = `<line x1="150" x2="760" y1="${base - 5 * sc * 2 / 2 * 1}" y2="${base - 5 * sc}" stroke="#B5790A" stroke-dasharray="6 6"/><text x="${S.lang === "ar" ? 60 : 770}" y="${base - 5 * sc + 5}" font-size="13" fill="#8A5A00">${T().target}</text><line x1="150" x2="760" y1="${base}" y2="${base}" stroke="#9AA5AE"/>`;
  bars.forEach(([n, v, c, x]) => { const h = Math.min(v * 100 * sc, 190); g += `<rect x="${x}" y="${base - h}" width="120" height="${h}" rx="4" fill="${c}"/><text x="${x + 60}" y="${base - h - 8}" text-anchor="middle" font-size="22" font-weight="800" fill="#0E2230">${(v * 100).toFixed(1)}%</text><text x="${x + 60}" y="${base + 24}" text-anchor="middle" font-size="15" fill="#0E2230">${esc(n)}</text>`; });
  return `<svg direction="ltr" viewBox="0 0 ${W} ${H}" role="img">${g}</svg>`;
}
/* ---------- views ---------- */
function caseHTML(v, pl, u, t, y, r) {
  const d = (S.lang === 'ar' ? 'ar' : 'en'); const c = { v, pl, u, sl: sgn(r.slope * 10), lo: sgn(r.lo * 10), hi: sgn(r.hi * 10), pct: fmt(Math.abs(r.pctDecade), 2), tot: sgn(r.total), yrs: t[t.length - 1] - t[0],
    pp: (r.p < 0.0001 ? '< 0.0001' : '= ' + r.p.toFixed(4)), snr: fmt(r.snr, 2), sig: r.sig, step: r.step, cy: r.changeYear, dirw: T().dirw[r.dir], span: `(${t[0]}–${t[t.length - 1]})` };
  const own = pl === '—', s = T().story(c), k = T().cf; if (own) s.what = s.what.replace(/ (at|في) —/, '');
  return `<div class="metrics"><div class="metric"><small>${T().col.trend}</small><b>${sgn(r.slope * 10)} ${esc(u)}</b></div><div class="metric"><small>${T().col.ci}</small><b dir="ltr">${sgn(r.lo * 10)} … ${sgn(r.hi * 10)}</b></div><div class="metric"><small>${T().col.p}</small><b dir="ltr">${fmtP(r.p)}</b></div><div class="metric"><small>${T().col.snr}</small><b>${fmt(r.snr, 2)}</b></div></div>
  <div class="chart">${lineSVG(t, y, r, u)}</div>
  <div class="story">${[['1', k.what, s.what, ''], ['2', k.where, `${esc(plName(S.place))} <bdi dir="ltr" class="coord">${SERIES[S.place].lat}, ${SERIES[S.place].lon}</bdi>`, ''], ['3', k.how, s.how, ''], ['4', k.real, s.real, r.sig ? ' ok' : ''], ['!', k.caveat, s.cav, ' warn']].filter(x => !(own && x[0] === '2')).map(([n, h, b, cls]) => `<section class="sc${cls}${n === '!' ? ' wide' : ''}"><span class="sn">${n}</span><div><h3>${h}</h3><p>${b}</p></div></section>`).join('')}</div>`;
}
function ctrls(withVar) {
  return `<div class="ctrl"><label>${T().place}<select id="c-place">${PLACES.map(p => `<option value="${esc(p)}" ${p === S.place ? 'selected' : ''}>${esc(plName(p))}</option>`).join('')}</select></label>
  <label>${T().start}: <span id="c-sv">${S.start}</span><input id="c-start" type="range" min="1981" max="2010" value="${S.start}"></label>
  <label>${T().alpha}<select id="c-alpha">${[0.01, 0.05, 0.1].map(a => `<option ${a === S.alpha ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
  ${withVar ? `<label>${T().var}<select id="c-var">${CATALOG.map(c => `<option value="${c.code}" ${c.code === S.code ? 'selected' : ''}>${esc(nm(c))}</option>`).join('')}</select></label>` : ''}</div>`;
}
function bindCtrls() {
  const on = (id, f) => { const e = $(id); if (e) e.onchange = e.oninput = f; };
  on('#c-place', e => { S.place = e.target.value; draw(); }); on('#c-alpha', e => { S.alpha = +e.target.value; draw(); });
  on('#c-var', e => { S.code = e.target.value; draw(); });
  const st = $('#c-start'); if (st) { st.oninput = e => { $('#c-sv').textContent = e.target.value; }; st.onchange = e => { S.start = +e.target.value; draw(); }; }
}

const csvCell = v => { v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
function downloadCSV(name, header, rows) {
  const txt = '\ufeff' + [header].concat(rows).map(r => r.map(csvCell).join(',')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const dlBtn = k => `<p><button class="btn dark" type="button" data-csv="${k}">⬇ ${T().dl}</button></p>`;
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-csv]'); if (!b) return; const t = T(), slug = plName(S.place).replace(/[^\w\u0600-\u06FF]+/g, '_');
  if (b.dataset.csv === 'triage') {
    downloadCSV(`athar_triage_${slug}_${S.start}.csv`, ['rank', 'variable', 'code', 'unit', 'place', 'start_year', 'trend_per_decade', 'ci95_low_per_decade', 'ci95_high_per_decade', 'pct_per_decade', 'p_value', 'fdr_significant', 'signal_noise', 'verdict', 'score'],
      triage().map((x, i) => [i + 1, nm(x.c), x.c.code, x.c.unit, plName(S.place), S.start, x.r.slope * 10, x.r.lo * 10, x.r.hi * 10, x.r.pctDecade, x.r.p, x.fdr ? 1 : 0, x.r.snr, x.lead, x.score]));
  } else {
    const { t: yr, y } = getSeries(S.place, S.code, S.start), r = ATHAR.analyze(y, yr, S.alpha);
    downloadCSV(`athar_${S.code}_${slug}_${S.start}.csv`, ['year', 'value', 'trend_line'], yr.map((v, i) => [v, y[i], r.icpt + r.slope * v]));
  }
});
function tabTriage() {
  const rows = triage(), t = T();
  const tb = rows.map((x, i) => `<tr class="clk" data-c="${x.c.code}" tabindex="0"><td>${i + 1}</td><td><b>${esc(nm(x.c))}</b></td><td>${esc(x.c.unit)}</td><td dir="ltr">${sgn(x.r.slope * 10)}</td><td dir="ltr">${sgn(x.r.lo * 10)} … ${sgn(x.r.hi * 10)}</td><td dir="ltr">${sgn(x.r.pctDecade)}</td><td dir="ltr">${fmtP(x.r.p)}</td><td>${x.fdr ? t.yes : t.no}</td><td dir="ltr">${fmt(x.r.snr, 2)}</td><td><span class="badge b-${x.lead}">${t.lead[x.lead]}</span></td></tr>`).join('');
  return `${ctrls(false)}<div class="chart">${barsSVG(rows)}</div><div class="legend"><span><i style="background:${COL.strong}"></i>${t.lead.strong}</span><span><i style="background:${COL.moderate}"></i>${t.lead.moderate}</span><span><i style="background:${COL.noise}"></i>${t.lead.noise}</span></div>
  <div class="tablew"><table><thead><tr><th>#</th><th>${t.col.variable}</th><th>${t.col.unit}</th><th>${t.col.trend}</th><th>${t.col.ci}</th><th>${t.col.pct}</th><th>${t.col.p}</th><th>${t.col.fdr}</th><th>${t.col.snr}</th><th>${t.col.verdict}</th></tr></thead><tbody>${tb}</tbody></table></div><p class="note">${t.tri_note}</p>${dlBtn('triage')}`;
}
function tabCase() {
  const c = CATALOG.find(x => x.code === S.code), { t, y } = getSeries(S.place, S.code, S.start);
  if (y.length < 8) return ctrls(true) + `<div class="warn">${T().own_err}</div>`;
  return ctrls(true) + caseHTML(nm(c), plName(S.place), c.unit, t, y, ATHAR.analyze(y, t, S.alpha)) + dlBtn('case');
}
function tabCompare() {
  const c = CATALOG.find(x => x.code === S.code);
  const rows = PLACES.map(p => { const { t, y } = getSeries(p, S.code, S.start); const r = ATHAR.analyze(y, t, S.alpha); return { p, s: r.slope * 10, lo: r.lo * 10, hi: r.hi * 10, sig: r.sig }; });
  const bh = ATHAR.bh(PLACES.map(p => { const { t, y } = getSeries(p, S.code, S.start); return ATHAR.analyze(y, t, S.alpha).p; }), S.alpha);
  rows.forEach((x, i) => x.sig = bh[i]);
  return `<h2>${T().cmp_t}</h2><p class="note">${T().cmp_s} (${esc(nm(c))}, ${esc(c.unit)} ${T().per})</p>${ctrls(true)}<div class="chart">${whiskSVG(rows)}</div>`;
}
function tabHonesty() {
  const h = S.hon, t = T();
  const sl = (id, lab, min, max, step, v) => `<label>${lab}: <span id="${id}v">${v}</span><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${v}"></label>`;
  return `<h2>${t.hon_t}</h2><p class="lead" style="margin-bottom:10px">${t.hon_s}</p><div class="ctrl">${sl('h-phi', t.phi, 0, 0.8, 0.1, h.phi)}${sl('h-n', t.npts, 20, 60, 5, h.n)}${sl('h-tr', t.trials, 200, 2000, 200, h.trials)}${sl('h-td', t.trend, 0, 1, 0.1, h.trend)}<button class="btn dark" id="h-run" type="button">${t.run}</button></div>
  <div class="chart" id="h-out">${h.res ? honSVG(h.res) + `<p class="note">${h.trend > 0 ? t.pw : t.fa}</p>` : ''}</div>`;
}
function bindHonesty() {
  const h = S.hon; [['h-phi', 'phi'], ['h-n', 'n'], ['h-tr', 'trials'], ['h-td', 'trend']].forEach(([id, k]) => { $('#' + id).oninput = e => { h[k] = +e.target.value; $('#' + id + 'v').textContent = e.target.value; }; });
  $('#h-run').onclick = () => { $('#h-run').disabled = true; $('#h-out').innerHTML = '<p class="note">…</p>'; setTimeout(() => {
    // trend given in sigma per decade -> per year
    const tr = h.trend / 10; h.res = { plain: ATHAR.falseAlarm(h.phi, h.n, h.trials, 'none', tr), corr: ATHAR.falseAlarm(h.phi, h.n, h.trials, 'lag1', tr) };
    $('#h-out').innerHTML = honSVG(h.res) + `<p class="note">${h.trend > 0 ? T().pw : T().fa}</p>`; $('#h-run').disabled = false; }, 30); };
}
function tabOwn() {
  const t = T(); const o = S.own;
  return `<h2>${t.own_t}</h2><p class="note">${t.own_s}</p><div class="ctrl"><label>${t.own_name}<input id="o-name" type="text" value="${esc(o ? o.name : '')}" style="font:600 16px Cairo;padding:9px;border:1px solid #CFC7B3;border-radius:10px;min-height:44px"></label><label>${t.own_unit}<input id="o-unit" type="text" size="8" value="${esc(o ? o.unit : '')}" style="font:600 16px Cairo;padding:9px;border:1px solid #CFC7B3;border-radius:10px;min-height:44px"></label><label>${t.own_file}<input id="o-file" type="file" accept=".csv,.txt,.tsv"></label></div>
  <textarea id="o-text" rows="7" style="width:100%;direction:ltr" placeholder="1981,24.1&#10;1982,24.3">${esc(o ? o.text : '')}</textarea><p><button class="btn dark" id="o-go" type="button">${t.own_btn}</button></p><div id="o-out">${o && o.html ? o.html : ''}</div>`;
}
function bindOwn() {
  const go = () => { const text = $('#o-text').value, name = $('#o-name').value || '—', unit = $('#o-unit').value; const d = ATHAR.parseCSV(text).sort((a, b) => a[0] - b[0]);
    if (d.length < 8) { S.own = { text, name, unit, html: `<div class="warn">${T().own_err}</div>` }; $('#o-out').innerHTML = S.own.html; return; }
    const t = d.map(r => r[0]), y = d.map(r => r[1]); S.own = { text, name, unit, html: caseHTML(name, '—', unit, t, y, ATHAR.analyze(y, t, S.alpha)) }; $('#o-out').innerHTML = S.own.html; };
  $('#o-go').onclick = go; $('#o-file').onchange = e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { $('#o-text').value = rd.result; go(); }; rd.readAsText(f); };
}
function platform() {
  const t = T(); const tabs = Object.entries(t.tabs).map(([k, v]) => `<button role="tab" data-t="${k}" aria-selected="${k === S.tab}">${v}</button>`).join('');
  return `<div class="wrap pf"><div class="eyebrow">ATHAR</div><h1>${t.pf_t}</h1><p class="note">${t.pf_s}</p><div class="tabs" role="tablist">${tabs}</div><div class="panel" id="panel"></div></div>`;
}
function draw() {
  const p = $('#panel'); if (!p) return; const f = { triage: tabTriage, case: tabCase, compare: tabCompare, honesty: tabHonesty, own: tabOwn }[S.tab];
  p.innerHTML = f(); bindCtrls(); if (S.tab === 'honesty') bindHonesty(); if (S.tab === 'own') bindOwn();
  p.querySelectorAll('tr.clk').forEach(r => { const go = () => { S.code = r.dataset.c; S.tab = 'case'; render(); }; r.onclick = go; r.onkeydown = e => { if (e.key === 'Enter') go(); }; });
}
function home() {
  const t = T(), ex = triage().slice(0, 3);
  return `<section class="hero"><div class="wrap grid"><div><div class="eyebrow">${t.h_eyebrow}</div><h1>${t.h_title}</h1><p>${t.h_sub}</p><a class="btn" href="#/platform">${t.cta}</a><a class="btn alt" href="#/method">${t.cta2}</a></div>
  <div class="mock" aria-hidden="true"><div class="tb"></div><div class="in">${barsSVG(triage().slice(0, 6))}</div></div></div></section>
  <section class="s"><div class="wrap"><h2>${t.steps_t}</h2><p class="lead">${t.steps_s}</p><div class="cards">${t.steps.map((s, i) => `<div class="card"><div class="n">${i + 1}</div><h3>${s[0]}</h3><p>${s[1]}</p></div>`).join('')}</div></div></section>
  <section class="s band"><div class="wrap stats">${t.st.map(s => `<div><b>${s[0]}</b><span>${s[1]}</span></div>`).join('')}</div></section>`;
}
function method() {
  const t = T(); return `<div class="wrap pf"><div class="eyebrow">ATHAR</div><h1>${t.method_t}</h1><p class="lead">${t.method_s}</p><div class="cards">${t.method.map(m => `<div class="card"><h3>${m[0]}</h3><p>${m[1]}</p></div>`).join('')}</div><h2 style="margin-top:40px">${t.limits_t}</h2><ul>${t.limits.map(l => `<li>${l}</li>`).join('')}</ul></div>`;
}
function about() {
  const t = T(); return `<div class="wrap pf"><div class="eyebrow">ATHAR</div><h1>${t.about_t}</h1><p class="lead">${t.about_s}</p><h2>${t.team}</h2><div class="cards" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">${TEAM.map(n => `<div class="card" style="text-align:center"><b style="font-size:20px">${n.ar}</b><br><span style="opacity:.75" dir="ltr">${n.en}</span></div>`).join('')}</div><h2 style="margin-top:36px">${t.data_t}</h2><p class="note" style="font-size:16px">${t.data}</p></div>`;
}
function render() {
  const t = T(); document.documentElement.lang = S.lang; document.documentElement.dir = t.dir; localStorage.setItem('athar-lang', S.lang);
  const r = (location.hash.replace('#/', '') || 'home').split('?')[0];
  $('#nav').innerHTML = Object.entries(t.nav).map(([k, v]) => `<a href="#/${k === 'home' ? '' : k}" ${((r === k) || (k === 'home' && r === 'home')) ? 'aria-current="page"' : ''}>${v}</a>`).join('');
  $('#lang').textContent = t.lang; $('#foot').innerHTML = `<p>${t.foot}</p>`;
  $('#view').innerHTML = ({ home, platform, method, about }[r] || home)();
  if (r === 'platform') { draw(); document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { S.tab = b.dataset.t; render(); }); }
  window.scrollTo(0, 0);
}
$('#lang').onclick = () => { S.lang = S.lang === 'ar' ? 'en' : 'ar'; render(); };
window.addEventListener('hashchange', render); render();
window.__ATHAR = S;
})();
