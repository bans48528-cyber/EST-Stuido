import est_runtime as rt
import est

# RAM-only verification: no motors, audio, persistent storage or firmware writes.
checks = 0
for _ in range(100):
    sample = rt.vision_snapshot()
    if sample[0]:
        if sample[1] == 1201:
            checks |= 1
        if sample[2] == 0:
            checks |= 2
        if 20 <= sample[3] <= 80 and sample[4] == 50:
            checks |= 4
        if sample[5] == 26 and sample[6] == 42:
            checks |= 8
    elif checks & 1:
        checks |= 16
    rt.sleep(0.05)
est._program_result(checks)
