"""Resume semantics: completed chunks are skipped on re-entry."""


def test_chunk_state_resume_filter():
    chunks_state = {"0": {"wordsKey": "a", "done": True}, "1": {"wordsKey": "b", "done": True}}
    done = {int(k) for k, v in chunks_state.items() if v.get("wordsKey")}
    assert done == {0, 1}
    ranges = [(0, 1000), (900, 2000), (1900, 3000)]
    pending = [i for i in range(len(ranges)) if i not in done]
    assert pending == [2]
