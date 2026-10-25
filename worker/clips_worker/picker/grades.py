def letter_grade(score_0_10: float) -> str:
    s = score_0_10 * 10
    if s >= 93:
        return "A+"
    if s >= 87:
        return "A"
    if s >= 83:
        return "A-"
    if s >= 77:
        return "B+"
    if s >= 73:
        return "B"
    if s >= 67:
        return "B-"
    if s >= 63:
        return "C+"
    if s >= 57:
        return "C"
    if s >= 50:
        return "D"
    return "D"


def badge_scores(hook: float, self_contained: float, payoff: float, energy: float, value: float) -> dict[str, str]:
    flow = (self_contained + payoff) / 2.0
    return {
        "hook": letter_grade(hook),
        "flow": letter_grade(flow),
        "value": letter_grade(value),
        "trend": letter_grade(energy),
    }


def final_score(hook: float, self_contained: float, payoff: float, energy: float, value: float) -> int:
    raw = 0.30 * hook + 0.20 * self_contained + 0.20 * payoff + 0.15 * energy + 0.15 * value
    return int(round(raw * 10))
