from clips_worker.dub_srt import parse_srt_to_words


def test_parse_srt_even_word_spacing():
    srt = """1
00:00:00,000 --> 00:00:02,000
Hello world

2
00:00:02,000 --> 00:00:03,000
Bye
"""
    words = parse_srt_to_words(srt)
    assert len(words) == 3
    assert words[0]["w"] == "Hello"
    assert words[0]["s_ms"] == 0
    assert words[1]["w"] == "world"
    assert words[1]["e_ms"] == 2000
    assert words[2]["w"] == "Bye"
