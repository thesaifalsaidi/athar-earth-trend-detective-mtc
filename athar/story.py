"""Deterministic bilingual (English / Arabic) 'case file' generator.

No AI-generated numbers: every sentence is a template filled from the statistics,
so the text can never invent a result.
"""
from __future__ import annotations

from .stats_engine import TrendResult

EN_DIR = {"increasing": "increasing", "decreasing": "decreasing"}
AR_DIR = {"increasing": "يرتفع", "decreasing": "ينخفض"}


def _p(p: float) -> str:
    return "< 0.0001" if p < 1e-4 else f"= {p:.4f}"


def _fmt(x: float, nd: int = 3) -> str:
    if x != x:
        return "n/a"
    return f"{x:+.{nd}f}"


def case_file_en(res: TrendResult, var: str, unit: str, place: str, y0: int, y1: int) -> str:
    dec = res.slope_per_year * 10
    lo, hi = res.slope_low * 10, res.slope_high * 10
    what = (f"**WHAT** - {var} at {place} is **{EN_DIR[res.direction]}**."
            if res.significant else
            f"**WHAT** - No statistically significant trend was found in {var} at {place}.")
    how = (f"**HOW MUCH** - Theil-Sen slope {_fmt(dec)} {unit}/decade "
           f"(95% CI {_fmt(lo)} to {_fmt(hi)}); total change over {y0}-{y1}: {_fmt(res.total_change)} {unit} "
           f"({_fmt(res.pct_change_per_decade, 1)} %/decade).")
    sig = (f"**SIGNIFICANT?** - Mann-Kendall (autocorrelation-corrected) Z = {res.z:+.2f}, "
           f"p {_p(res.p_value)} -> {'significant' if res.significant else 'NOT significant'} at the 5 % level. "
           f"Signal-to-noise = {res.snr:.1f}.")
    chg = ""
    if res.change_p < 0.05 and res.change_year:
        chg = f" A step change is statistically detected around {res.change_year:.0f} (Pettitt p = {res.change_p:.3f})."
    if res.step_suspected:
        chg += (" **WARNING:** one abrupt jump explains most of this change - this pattern is typical of an "
                "instrument or data-product change rather than climate. Verify the data provenance before concluding.")
    cav = ("**CAUTION** - 'Not significant' means 'not proven', not 'no change'. "
           f"The record is {res.n} years; short records have low statistical power.")
    return "\n\n".join([what, f"**WHERE** - {place}.", how, sig + chg, cav])


def case_file_ar(res: TrendResult, var_ar: str, unit: str, place: str, y0: int, y1: int) -> str:
    dec = res.slope_per_year * 10
    lo, hi = res.slope_low * 10, res.slope_high * 10
    what = (f"**ماذا يتغيّر؟** - {var_ar} في {place} **{AR_DIR[res.direction]}** بشكل ذي دلالة إحصائية."
            if res.significant else
            f"**ماذا يتغيّر؟** - لم يظهر اتجاه ذو دلالة إحصائية في {var_ar} في {place}.")
    how = (f"**كم يتغيّر؟** - ميل ثيل-سن {_fmt(dec)} {unit} لكل عقد "
           f"(فاصل الثقة 95%: من {_fmt(lo)} إلى {_fmt(hi)})، والتغيّر الكلي خلال {y0}-{y1}: "
           f"{_fmt(res.total_change)} {unit} ({_fmt(res.pct_change_per_decade, 1)}% لكل عقد).")
    sig = (f"**هل هو معنوي؟** - اختبار مان-كندال (مع تصحيح الارتباط الذاتي): Z = {res.z:+.2f}، "
           f"القيمة الاحتمالية p {_p(res.p_value)} ← "
           f"{'معنوي' if res.significant else 'غير معنوي'} عند مستوى 5%. نسبة الإشارة إلى الضجيج = {res.snr:.1f}.")
    chg = ""
    if res.change_p < 0.05 and res.change_year:
        chg = f" رُصد تغيّر مفاجئ تقريباً عام {res.change_year:.0f} (اختبار بيتيت p = {res.change_p:.3f})."
    if res.step_suspected:
        chg += (" **تحذير:** قفزة مفاجئة واحدة تفسّر معظم هذا التغيّر، وهذا النمط شائع عند تغيّر الجهاز أو "
                "منتج البيانات وليس بسبب المناخ. تحقّق من مصدر البيانات قبل الاستنتاج.")
    cav = (f"**تنبيه علمي** - عبارة «غير معنوي» تعني «لم يثبت» وليس «لا يوجد تغيّر». "
           f"طول السجل {res.n} سنة، والسجلات القصيرة تمتلك قدرة إحصائية محدودة.")
    return "\n\n".join([what, f"**أين؟** - {place}.", how, sig + chg, cav])


def opposite_story_text(info: dict, var: str, var_ar: str, lang: str = "en") -> str:
    if lang == "ar":
        if info["opposite"]:
            return (f"**قصة متعاكسة:** {var_ar} يرتفع في {info['n_increasing']} خلية "
                    f"({info['share_increasing']:.0%}) وينخفض في {info['n_decreasing']} خلية "
                    f"({info['share_decreasing']:.0%}) داخل المنطقة نفسها، بعد ضبط الاكتشافات الزائفة (FDR).")
        return (f"{var_ar}: {info['n_increasing']} خلية ترتفع و{info['n_decreasing']} خلية تنخفض "
                f"(معنوية بعد ضبط FDR) من أصل {info['n_valid_cells']} خلية؛ لا يوجد تعاكس واضح.")
    if info["opposite"]:
        return (f"**Opposite story:** {var} rises in {info['n_increasing']} cells "
                f"({info['share_increasing']:.0%}) and falls in {info['n_decreasing']} cells "
                f"({info['share_decreasing']:.0%}) of the same region (FDR-controlled).")
    return (f"{var}: {info['n_increasing']} cells rising, {info['n_decreasing']} falling "
            f"(FDR-significant) out of {info['n_valid_cells']}; no clear opposing pattern.")
