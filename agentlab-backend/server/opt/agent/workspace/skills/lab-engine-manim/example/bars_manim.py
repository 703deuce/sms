from manim import *
class Bars(Scene):
    def construct(self):
        vals = [3, 7, 5]
        bars = VGroup(*[Rectangle(width=1, height=v * 0.5, fill_opacity=1, color=GOLD).align_to(DOWN * 2, DOWN) for v in vals]).arrange(RIGHT, buff=0.6, aligned_edge=DOWN)
        labels = VGroup(*[Text(str(v), font_size=36).next_to(b, UP) for v, b in zip(vals, bars)])
        self.play(LaggedStart(*[GrowFromEdge(b, DOWN) for b in bars], lag_ratio=0.2), run_time=1)
        self.play(FadeIn(labels), run_time=0.4)
