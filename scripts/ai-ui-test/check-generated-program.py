"""Execute only the deterministic UI test fixtures with fake hardware modules.

This is a test harness, not a sandbox for real model replies. No device modules
are imported. The parent process also imposes a subprocess timeout.
"""
import ast
import json
import math
import sys
import types


def main():
    payload = json.load(sys.stdin)
    source = payload["source"]
    ast.parse(source)
    outputs = []
    bitmaps = []
    callbacks = []
    runtime = types.ModuleType("est_runtime")

    def on_start(callback):
        callbacks.append(callback)
        return callback

    runtime.on_start = on_start
    runtime.random_int = lambda first, last: int(min(first, last))
    runtime.boolean = bool
    runtime.display_text_line = lambda line, text: outputs.append((line, text))
    runtime.run = lambda: [callback() for callback in callbacks]
    device = types.ModuleType("est")
    device.display = types.SimpleNamespace(
        clear=lambda: None,
        bitmap=lambda x, y, width, height, data: bitmaps.append((x, y, width, height, data)),
        refresh=lambda: None,
    )
    sys.modules["est_runtime"] = runtime
    sys.modules["est"] = device
    namespace = {}
    exec(compile(source, "<trusted-ai-ui-fixture>", "exec"), namespace)
    assert len(callbacks) == 1
    assert outputs[0] == (1, "结果：2"), outputs
    assert len(bitmaps) == 1
    x, y, width, height, data = bitmaps[0]
    assert (x, y, width, height) == (58, 40, 64, 48)
    assert len(data) == 384 and any(data)
    if payload["name"] == "ai-all-native-blocks":
        expected_math = [1.0, 1, 1, 1.0, math.sin(math.radians(1)),
                         math.cos(math.radians(1)), math.tan(math.radians(1)),
                         90.0, 60.0, 45.0, 0.0, 0.0, math.e, 10.0]
        actual = [value for _, value in outputs[-14:]]
        for value, expected in zip(actual, expected_math):
            assert math.isclose(value, expected, rel_tol=1e-9, abs_tol=1e-9), (actual, expected_math)
    print(json.dumps({"executed": payload["name"], "outputs": len(outputs), "bitmaps": len(bitmaps)}))


if __name__ == "__main__":
    main()
