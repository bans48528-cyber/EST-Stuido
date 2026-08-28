"""Validate generated EST Python programs without importing the EST runtime."""

import ast
import json
import sys


def main():
    payload = json.load(sys.stdin)
    failures = []

    for case in payload.get("cases", []):
        name = case.get("name", "generated")
        source = case.get("source", "")
        try:
            ast.parse(source, filename=f"<{name}>", mode="exec")
        except SyntaxError as error:
            failures.append({
                "name": name,
                "line": error.lineno,
                "offset": error.offset,
                "message": error.msg,
                "sourceLine": error.text.rstrip("\n") if error.text else "",
            })

    if failures:
        json.dump({"failures": failures}, sys.stdout, ensure_ascii=False, indent=2)
        sys.stdout.write("\n")
        return 1

    json.dump({"checked": len(payload.get("cases", []))}, sys.stdout)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
