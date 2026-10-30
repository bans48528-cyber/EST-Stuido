"""Run curated Blockly regression fixtures against a strict model of NEW AI List APIs.

This is host-side semantic simulation, not execution on the controller. No device APIs are opened.
Only the two named local fixtures below are accepted; a subprocess timeout bounds execution.
"""
import ast
import json
import math
import re
import sys
import types


class PikaList(list):
    def __getitem__(self, index):
        if not isinstance(index, int) or index < 0 or index >= len(self):
            raise IndexError("index out of range")
        return super().__getitem__(index)

    def set(self, index, value):
        self[index]  # Enforce the same bounds as the supplied firmware source.
        self[index] = value

    def insert(self, index, value):
        if index < 0 or index > len(self):
            raise IndexError("insert index out of range")
        super().insert(index, value)

    def remove_index(self, index):
        self[index]
        self.pop(index)

    def remove_all(self):
        self.clear()

    def dataToindex(self, value):
        return float(self.index(value)) if value in self else -1.0

    def if_data(self, value):
        return value in self

    def num(self):
        return float(len(self))


class SummaryComplete(Exception):
    pass


class SparkList(PikaList):
    def __getattribute__(self, name):
        if name in ("remove_index", "remove_all", "dataToindex", "if_data", "num", "list_if_data"):
            raise AttributeError("Spark firmware has no " + name)
        return super().__getattribute__(name)


def main():
    payload = json.load(sys.stdin)
    name, source = payload["name"], payload["source"]
    assert name in ("new-ai-statistics", "new-ai-list-boundaries", "new-ai-operators",
                    "spark-ai-statistics", "spark-ai-list-boundaries", "spark-ai-operators")
    ast.parse(source)
    displays = []
    ticks = 0

    def sleep_s(_seconds):
        nonlocal ticks
        ticks += 1
        assert ticks < 500, "Generated loop did not reach the expected results"

    def show_roll(value):
        text = str(value)
        assert len(text) <= 31, text
        assert re.fullmatch(r"[A-Z0-9?.+*/=\-]*", text), text
        displays.append(text)
        if text == "SPECIAL=2":
            raise SummaryComplete()

    data_module = types.ModuleType("PikaStdData")
    data_module.List = SparkList if name.startswith("spark-") else PikaList
    sys.modules["PikaStdData"] = data_module
    strict_math = types.SimpleNamespace(pi=math.pi, e=math.e)
    for method in ("fabs", "floor", "ceil", "sqrt", "sin", "cos", "tan", "asin", "acos", "atan",
                   "exp", "log10", "pow", "fmod"):
        setattr(strict_math, method, getattr(math, method))
    strict_math.log = lambda value: math.log(value)
    namespace = {
        "PikaStdData": data_module,
        "_os": types.SimpleNamespace(sleep_s=sleep_s, clear_thread=lambda: None),
        "_thread": types.SimpleNamespace(start_new_thread=lambda callback, args: callback(*args)),
        "_math": strict_math,
        "_matrix": types.SimpleNamespace(show_roll=show_roll),
    }
    try:
        exec(compile(source, "<curated-new-ai-regression>", "exec"), namespace)
    except IndexError:
        if payload.get("expectOriginalIndexBug"):
            print(json.dumps({"name": name, "originalIndexBugReproduced": True}))
            return
        raise
    except AttributeError as error:
        if payload.get("expectLegacyListFailure") and "remove_all" in str(error):
            print(json.dumps({"name": name, "legacyListFailureReproduced": True}))
            return
        raise
    except SummaryComplete:
        assert name.endswith("-statistics")
    assert not payload.get("expectOriginalIndexBug"), "The negative control must expose an IndexError"
    assert not payload.get("expectLegacyListFailure"), "Legacy Spark list API must fail in the strict model"
    if name.endswith("-statistics"):
        expected = {"results": [7, 18, 13, 28, 19, 14], "total_score": 99, "average": 16.5,
                    "maximum": 28, "qualified": 4, "special": 2, "countdown": 0}
        for key, value in expected.items():
            assert namespace[key] == value, (key, namespace[key], value)
        assert displays == ["OUT=7", "PASS=18", "PASS=13", "OUT=28", "PASS=19", "PASS=14",
                            "COUNT=3", "COUNT=2", "COUNT=1", "SUM=99", "AVG=16.5", "MAX=28",
                            "QUALIFIED=4", "SPECIAL=2"], displays
        report = {"name": name, "values": expected, "displaySequence": displays}
    elif name.endswith("-operators"):
        actual, expected = namespace["observations"], payload["expected"]
        assert len(actual) == len(expected), (len(actual), len(expected))
        for index, (value, reference) in enumerate(zip(actual, expected)):
            if isinstance(reference, (int, float)):
                assert math.isclose(value, reference, rel_tol=1e-8, abs_tol=1e-8), (index, value, reference)
            else:
                assert value == reference, (index, value, reference)
        report = {"name": name, "operatorCases": len(expected), "observations": list(actual)}
    else:
        expected = [10, 30, "", "", 15, 30, 1, 3, 0, 4, 1, 0]
        assert namespace["observations"] == expected, namespace["observations"]
        assert namespace["items"] == [], namespace["items"]
        report = {"name": name, "observations": expected, "emptyAfterClear": True}
    report.update({"passed": True, "hostSimulation": True, "deviceCommands": 0})
    print(json.dumps(report))


if __name__ == "__main__":
    main()
