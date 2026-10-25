GENRE_HINTS = {
    "podcast": "Genre: podcast/interview — favor personal stories, hot takes, candid advice, and memorable one-liners.",
    "interview": "Genre: podcast/interview — favor personal stories, hot takes, candid advice, and memorable one-liners.",
    "education": "Genre: education — favor clear explanations, step-by-step insights, and 'aha' lines a viewer can apply immediately.",
    "comedy": "Genre: comedy — favor setups with punchlines, callbacks, and moments tagged laugh? or high energy.",
    "marketing": "Genre: marketing — favor pain point → solution arcs, specific outcomes, and credible proof (numbers, names).",
}


def genre_paragraph(genre: str) -> str:
    g = (genre or "podcast").strip().lower()
    for key, hint in GENRE_HINTS.items():
        if key in g:
            return hint
    return GENRE_HINTS["podcast"]
