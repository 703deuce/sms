import json, os, sys
sys.path.insert(0, "/opt/agent/tools"); os.environ.setdefault("RUNS_DB", "/opt/agent/workspace/runs/runs.db")
import runlib as R
P = """This is a tooling check, do it yourself (no helper jobs, no web), step by step, and keep it short.
1. Copy /workspace/testdata/hard5_nov25/more_itertools_repo into your job folder as out/mi and cd into it.
2. Run `repomap` there and save its output to out/repomap.txt (`repomap > ../repomap.txt`). Tell me the first 3 files it lists.
3. Run these three searches with `codesearch` and give the top hit (file:lines and function) for each:
   a) "negative index handling when picking the nth combination"
   b) "break an iterable into lists of length n"
   c) "yield items while recording how many were consumed"
4. Use the grep tool (not the terminal) to find which files contain the regex `def nth_combination`, and the glob tool to list `tests/test_*.py` files under out/mi.
5. With the file editor, make this deliberate mistake in out/mi/more_itertools/recipes.py: in function `take`, replace `return list(islice(iterable, n))` with `return list(islice(iterabel, n))`. Then run `ls` in the terminal. Report exactly what message you got back, then undo the mistake (undo_edit) and run `ls` again.
6. Run the full test suite twice: once plainly with `python -m unittest discover -s tests -t . -v` and once as `qrun -- python -m unittest discover -s tests -t . -v`. Say where the full output of each ended up (a file path, or that it was cut), and how many lines that file has.
Final reply: a short numbered list with the result of each step."""
db = R.connect(); rid, cid = R.enqueue(db, P, "user", title="cursor-eff proof: codesearch/repomap/grep/glob/autocheck/qrun", model="lab-anthropic")
json.dump([{"id": "proof-1", "run": rid, "cid": cid}], open("/opt/agent/tests/cursor_eff/batch_proof.json", "w"), indent=1); print(rid, cid)
