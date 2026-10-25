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


letter_grade_from_final = letter_grade
