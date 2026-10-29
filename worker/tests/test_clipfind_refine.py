from clips_worker.clipfind.refine import RefineInputs, refine_window, validate_window, fit_max, ClipBeats, snap_start_to_word, reaction_end

def W(text, t0, step=0.3):
    out, t = [], t0
    for tok in text.split():
        out.append({"w": tok, "s": round(t, 3), "e": round(t + step - 0.05, 3)}); t += step
    return out

def flat(n, v=0.2):
    return [v] * n

def inp(**kw):
    base = dict(range_start_ms=0, range_end_ms=900_000, min_ms=15_000, max_ms=60_000)
    base.update(kw); return RefineInputs(**base)

# 1 badge -> streak
def test_badge_backs_up_to_streak_start():
    vis = flat(900); 
    for t in list(range(572, 580)) + list(range(584, 601)): vis[t] = 0.9   # 4s gap inside the streak
    en = flat(900, 0.1)
    for t in range(598, 606): en[t] = 0.9
    r = refine_window(inp(start_ms=590_000, end_ms=610_000, peak_ms=598_000, visual=vis, energy=en,
                          text="Fury badge pops after a 5 kill streak", gemini_payoff_ms=598_000))
    assert r.beats.indicator == "action"
    assert 568_000 <= r.start_ms <= 572_000          # streak start minus lead, not the badge
    assert r.end_ms >= 606_000                       # reaction kept

# 2 plan -> execution
def test_execution_not_plan_and_plan_in_extended():
    words = W("okay we flank left then push the compound on my call", 400) + W("ready? go go go", 428)
    vis = flat(900)
    for t in range(441, 469): vis[t] = 0.9
    r = refine_window(inp(start_ms=450_000, end_ms=470_000, peak_ms=465_000, visual=vis, words=words,
                          text="pushes the compound and wipes the squad", gemini_payoff_ms=465_000))
    assert 437_000 <= r.start_ms <= 441_000
    assert r.variants["extended"]["startMs"] <= 430_000

# 3 answer after question
def test_starts_at_question_not_closing_line():
    words = (W("So why did you quit the team?", 200.0) + W("Honestly the travel was brutal and nobody told me.", 203.2)
             + W("We lost three in a row.", 206.6) + W("And that's why I left.", 222.0))
    en = flat(900, 0.1)
    for t in range(224, 228): en[t] = 0.8
    r = refine_window(inp(start_ms=215_000, end_ms=224_000, peak_ms=223_000, words=words, energy=en,
                          text="closing line: why he left the team"))
    assert r.start_ms == 200_000
    assert r.end_ms >= 227_000

# 4 quiet joke (no shouting)
def test_quiet_joke_keeps_setup_and_reaction():
    words = W("I told my mom I'm a professional gamer.", 100.0) + W("She asked when I'm getting a real job.", 103.0)
    chat = flat(900, 0.0)
    for t in range(108 + 6, 114 + 6): chat[t] = 0.9      # LUL wall, unshifted (lags ~6s)
    en = flat(900, 0.1)
    for t in range(106, 109): en[t] = 0.3                 # soft chuckle
    r = refine_window(inp(start_ms=101_000, end_ms=105_500, peak_ms=105_000, words=words, energy=en, chat=chat,
                          text="deadpan joke about his mom, chat laughs"))
    assert r.start_ms == 100_000
    assert r.end_ms >= 109_000 and r.end_ms <= 105_000 + 15_000

# 5 quiet kill, aftermath-only window
def test_aftermath_window_widened_and_validated():
    vis = flat(900)
    for t in range(285, 298): vis[t] = 0.9
    r = refine_window(inp(start_ms=300_000, end_ms=320_000, peak_ms=296_000, visual=vis,
                          text="silent 1v3 clutch, final kill", gemini_payoff_ms=296_000))
    assert r.start_ms <= 285_000 and r.end_ms >= 297_000
    assert validate_window(300_000, 320_000, r.beats, 60_000)["status"] in ("repaired",)
    assert validate_window(r.start_ms, r.end_ms, r.beats, 60_000)["status"] == "ok"

def test_validation_demotes_never_deletes():
    b = ClipBeats(setup_start_ms=200_000, event_ms=250_000, payoff_ms=296_000, reaction_end_ms=300_000, indicator="action")
    assert validate_window(290_000, 305_000, b, 30_000)["status"] == "demote"

# 6 loud false alarm
def test_loud_false_alarm_not_inflated():
    en = flat(900, 0.1); chat = flat(900, 0.1)
    for t in range(500, 520): en[t] = 0.95; chat[t + 6] = 0.95
    r = refine_window(inp(start_ms=500_000, end_ms=525_000, peak_ms=506_000, energy=en, chat=chat,
                          words=W("AAAAH LET'S GO", 505.0), text="streamer yelling at chat"))
    assert (r.start_ms, r.end_ms) == (500_000, 525_000) and r.beats is None and r.chosen == "unchanged"

def test_over_max_trims_setup_first_keeps_payoff():
    b = ClipBeats(100_000, 150_000, 200_000, 220_000, "action")
    s, e = fit_max(100_000, 250_000, b, 60_000)
    assert e - s <= 60_000 and s <= 147_000          # setup trimmed, not below event-3s
    assert e >= 201_000

def test_tail_capped_15s():
    en = [0.1] * 900
    for x in range(10, 60): en[x] = 0.9               # reaction never decays inside the cap
    i = inp(start_ms=0, end_ms=20_000, energy=en)
    end, src = reaction_end(i, 10_000, 900_000)
    assert end == 25_000 and src == "cap"

def test_never_starts_mid_word():
    words = W("hello there friend", 10.0)
    assert snap_start_to_word(10_400, words) == 10_300

def test_respects_padding_clamp():
    vis = flat(900)
    for t in range(560, 601): vis[t] = 0.9
    r = refine_window(inp(start_ms=590_000, end_ms=610_000, peak_ms=598_000, visual=vis, text="ace", pad_lo_ms=580_000))
    assert r.start_ms >= 580_000
