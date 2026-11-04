"""IUCEE + Stuart & Rutherford (1978) + Bunce et al. (2010) attention-decay model.

A(t) = A_floor + (A_base(t) - A_floor) * exp(-lambda0 * a_ltp * b_age * g_slot * d_speech * max(0, t - t_peak)^1.4)

Calibrated so an Applied Core (3:0:1), 2nd/3rd-year, 9 AM class crosses theta = 55% at ~20 min
and passive lecture attention bottoms out near 16% by minute 60.
"""
import math

T_PEAK = 11.0
THETA = 55.0
A_PEAK = 88.0
A_FLOOR = 16.0
LAMBDA0 = 0.0314
EXP = 1.4
ACTIVITY_MINS = 7
RESET_LEVEL = 85.0

ALPHA_LTP = {"HEAVY_THEORY": 1.30, "APPLIED_CORE": 1.00, "STUDIO_ELECTIVE": 0.75}
GAMMA_SLOT = {"MORNING_09AM": 0.90, "MIDDAY_11AM": 1.05, "POST_LUNCH_02PM": 1.35}


def stratum_from_ltp(l: int, t: int, p: int) -> str:
    if p == 0 and t >= 1:
        return "HEAVY_THEORY"
    if p >= l:
        return "STUDIO_ELECTIVE"
    return "APPLIED_CORE"


def beta_age(semester: int | None, age: int | None = None) -> float:
    if semester is None:
        semester = 3
    if semester <= 2:
        return 1.25
    if semester >= 7:
        return 0.82
    return 1.00


def delta_speech(words_per_minute: float | None) -> float:
    """Faster delivery raises cognitive load. 130 wpm is neutral."""
    if not words_per_minute:
        return 1.0
    return max(0.8, min(1.3, words_per_minute / 130.0))


def _base(t: float) -> float:
    # warm-up toward the 10-12 min concentration peak
    return A_PEAK - 28.0 * math.exp(-t / 3.5) if t < T_PEAK else A_PEAK


def passive(t: float, k: float) -> float:
    decay = math.exp(-LAMBDA0 * k * max(0.0, t - T_PEAK) ** EXP)
    return A_FLOOR + (_base(t) - A_FLOOR) * decay


def dip_minute(k: float, peak: float = T_PEAK, level: float = A_PEAK) -> float:
    """Closed-form minute where the decay crosses THETA."""
    ratio = (level - A_FLOOR) / (THETA - A_FLOOR)
    return peak + (math.log(ratio) / (LAMBDA0 * k)) ** (1 / EXP)


def multiplier(stratum: str, semester: int | None, slot: str, wpm: float | None = None) -> float:
    return ALPHA_LTP.get(stratum, 1.0) * beta_age(semester) * GAMMA_SLOT.get(slot, 1.0) * delta_speech(wpm)


def build_model(stratum: str, semester: int | None, slot: str, duration: int = 60, wpm: float | None = None,
                poll_dip: float | None = None) -> dict:
    k = multiplier(stratum, semester, slot, wpm)
    ts = list(range(0, duration + 1))
    passive_curve = [round(passive(t, k), 2) for t in ts]
    model_dip = dip_minute(k)

    dip = model_dip
    split_source = "IUCEE_STRATA_AI"
    if poll_dip is not None:
        dip = 0.6 * model_dip + 0.4 * poll_dip
        split_source = "STUDENT_POLL_AVG"

    # Active curve: an activity split at each predicted dip resets attention, then decay restarts.
    splits, active = [], []
    next_split = dip
    reset_end = None
    for t in ts:
        if next_split is not None and t >= next_split and (not splits or t >= splits[-1]["end"]):
            start = round(next_split)
            if start + ACTIVITY_MINS <= duration:
                splits.append({"start": start, "end": start + ACTIVITY_MINS})
                reset_end = start + ACTIVITY_MINS
                # post-reset decay starts ~3 min after the activity (short re-peak), k unchanged
                next_split = reset_end + (dip_minute(k, peak=3.0, level=RESET_LEVEL))
            else:
                next_split = None
        cur = splits[-1] if splits else None
        if cur and cur["start"] <= t < cur["end"]:
            frac = (t - cur["start"] + 1) / ACTIVITY_MINS
            val = active[-1] + (RESET_LEVEL - active[-1]) * min(1.0, frac * 1.6) if active else RESET_LEVEL
        elif reset_end is not None and t >= reset_end:
            tau = t - reset_end
            val = A_FLOOR + (RESET_LEVEL - A_FLOOR) * math.exp(-LAMBDA0 * k * max(0.0, tau - 3.0) ** EXP)
        else:
            val = passive(t, k)
        active.append(round(val, 2))

    activity_minutes = sum(s["end"] - s["start"] for s in splits)
    return {
        "t": ts,
        "passive_curve": passive_curve,
        "active_intervened_curve": active,
        "threshold": THETA,
        "dip_trigger_minute": round(dip, 1),
        "model_dip_minute": round(model_dip, 1),
        "poll_dip_minute": round(poll_dip, 1) if poll_dip is not None else None,
        "split_source": split_source,
        "activity_splits": splits,
        "lecture_minutes_split": duration - activity_minutes,
        "activity_minutes_split": activity_minutes,
        "multipliers": {
            "alpha_ltp": ALPHA_LTP.get(stratum, 1.0), "beta_age": beta_age(semester),
            "gamma_slot": GAMMA_SLOT.get(slot, 1.0), "delta_speech": round(delta_speech(wpm), 3),
            "lambda0": LAMBDA0, "t_peak": T_PEAK, "exponent": EXP, "combined_k": round(k, 4),
        },
        "stratum": stratum, "semester": semester, "time_slot": slot,
    }


STRATA_PRESETS = [
    {"key": "heavy_theory_postlunch_1st_year", "label": "Heavy Theory 3:1:0 - Post-Lunch - 1st-Year UG", "stratum": "HEAVY_THEORY", "semester": 1, "slot": "POST_LUNCH_02PM"},
    {"key": "heavy_theory_morning_2nd_year", "label": "Heavy Theory 3:1:0 - Morning - 2nd-Year UG", "stratum": "HEAVY_THEORY", "semester": 3, "slot": "MORNING_09AM"},
    {"key": "applied_core_morning", "label": "Applied Core 3:0:1 - Morning - 3rd-Year UG", "stratum": "APPLIED_CORE", "semester": 5, "slot": "MORNING_09AM"},
    {"key": "applied_core_midday", "label": "Applied Core 3:0:1 - Midday - 3rd-Year UG", "stratum": "APPLIED_CORE", "semester": 5, "slot": "MIDDAY_11AM"},
    {"key": "studio_morning_pg", "label": "Studio Elective 2:0:2 - Morning - PG/MBA", "stratum": "STUDIO_ELECTIVE", "semester": 8, "slot": "MORNING_09AM"},
    {"key": "studio_midday_3rd_year", "label": "Studio Elective 2:0:2 - Midday - 3rd-Year UG", "stratum": "STUDIO_ELECTIVE", "semester": 5, "slot": "MIDDAY_11AM"},
]


def strata_curves(duration: int = 60) -> list[dict]:
    out = []
    for p in STRATA_PRESETS:
        k = multiplier(p["stratum"], p["semester"], p["slot"])
        out.append({**p, "dip_minute": round(dip_minute(k), 1), "curve": [round(passive(t, k), 2) for t in range(duration + 1)]})
    return out


def poll_dip_from_votes(votes: list[dict]) -> tuple[float | None, int | None]:
    """Stuart & Rutherford 9-point self reports -> first minute where the class average drops below theta."""
    if not votes:
        return None, None
    by_min: dict[int, list[int]] = {}
    for v in votes:
        by_min.setdefault(v["minute_of_class"], []).append(v["reported_focus_score"])
    dip = None
    for m in sorted(by_min):
        avg_pct = (sum(by_min[m]) / len(by_min[m]) - 1) / 8 * 100
        if avg_pct < THETA:
            dip = float(m)
            break
    pref = [v.get("preferred_split_min") for v in votes if v.get("preferred_split_min")]
    return dip, (round(sum(pref) / len(pref)) if pref else None)
