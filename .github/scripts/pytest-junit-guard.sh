#!/usr/bin/env bash
# Fail a CI job when a pytest JUnit report shows skipped tests, zero tests,
# failures or errors. A green check must mean the tests actually ran.
#
# Usage: bash .github/scripts/pytest-junit-guard.sh <junit.xml> [label]
set -euo pipefail

report="${1:?usage: pytest-junit-guard.sh <junit.xml> [label]}"
label="${2:-pytest}"

if [[ ! -s "$report" ]]; then
  echo "::error title=pytest guard (${label})::JUnit report '${report}' is missing or empty; pytest did not produce results"
  exit 1
fi

python3 - "$report" "$label" << 'PY'
import sys
import xml.etree.ElementTree as ET

report, label = sys.argv[1], sys.argv[2]
root = ET.parse(report).getroot()
suites = [root] if root.tag == "testsuite" else list(root.iter("testsuite"))

def total(attr):
    return sum(int(s.attrib.get(attr, 0) or 0) for s in suites)

tests, skipped = total("tests"), total("skipped")
failures, errors = total("failures"), total("errors")
passed = tests - skipped - failures - errors
print(f"pytest guard ({label}): tests={tests} passed={passed} "
      f"skipped={skipped} failures={failures} errors={errors}")

skipped_cases = []
for case in root.iter("testcase"):
    skip = case.find("skipped")
    if skip is not None:
        name = f"{case.attrib.get('classname', '')}::{case.attrib.get('name', '')}"
        skipped_cases.append(f"{name} ({skip.attrib.get('message', '').strip()})")

problems = []
if tests == 0:
    problems.append("no tests were collected (tests=0)")
if skipped:
    problems.append(f"{skipped} test(s) were skipped (skipped>0)")
if failures or errors:
    problems.append(f"{failures} failure(s) and {errors} error(s)")

for case in skipped_cases:
    print(f"  SKIPPED {case}")

if problems:
    msg = "; ".join(problems)
    print(f"::error title=pytest guard ({label})::{msg}. "
          "A green check requires tests>0 and skipped=0.")
    sys.exit(1)
PY
