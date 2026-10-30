"""Exercise the bundled EST updater with an in-memory HID transport only."""
from collections import deque
from pathlib import Path
import sys
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "resources/est-firmware/tools"))
from est_hid_sender import updater
from est_hid_sender.constants import DEVICE_DIRECTION, FRAME_END, FRAME_START, UPDATE_COMMAND
from est_hid_sender.errors import AckRejectedError, AckTimeoutError
from est_hid_sender.protocol import checksum


class FakeHid:
    def __init__(self, output_len, mode="success"):
        self.output_len = output_len
        self.mode = mode
        self.frames = []
        self.pending = b""
        self.replies = deque()

    def write_payload(self, frame):
        self.frames.append(frame)
        total = int.from_bytes(frame[5:7], "little")
        index = int.from_bytes(frame[7:9], "little")
        if self.mode == "timeout":
            return
        def ack(packet_index, flag=1):
            data = bytes([FRAME_START, DEVICE_DIRECTION, UPDATE_COMMAND, 5, 0])
            data += total.to_bytes(2, "little") + packet_index.to_bytes(2, "little") + bytes([flag])
            return data + bytes([checksum(data), FRAME_END])
        # Unrelated/stale packets must not complete the current write.
        self.replies.extend([b"not an update ACK", ack(index + 1), ack(index, 0 if self.mode == "reject" else 1)])

    def write_report(self, report):
        self.pending += report
        if len(self.pending) >= 5:
            size = int.from_bytes(self.pending[3:5], "little") + 7
            if len(self.pending) >= size:
                frame, self.pending = self.pending[:size], b""
                self.write_payload(frame)

    def read_report(self):
        return self.replies.popleft() if self.replies else b""


payload = bytes(range(256)) * 10
for size in [64, 2048]:
    transport = FakeHid(size)
    progress = []
    updater.FirmwareUpdater(transport).flash(payload, progress.append)
    assert len(transport.frames) == 3
    assert b"".join(frame[9:-2] for frame in transport.frames) == payload
    assert [item.phase for item in progress] == ["sending", "acked"] * 3
    assert [int.from_bytes(frame[7:9], "little") for frame in transport.frames] == [0, 1, 2]
for mode, expected in [("reject", AckRejectedError), ("timeout", AckTimeoutError)]:
    transport = FakeHid(2048, mode)
    with patch.object(updater, "FIRST_PACKET_ACK_TIMEOUT_SECONDS", 0.005):
        try:
            updater.FirmwareUpdater(transport).flash(payload)
            raise AssertionError("failure must stop the update")
        except expected:
            assert len(transport.frames) == 1
print("EST offline firmware passed: 64-byte and high-speed HID, matched ACKs, stale reports, reject/timeout stops.")
