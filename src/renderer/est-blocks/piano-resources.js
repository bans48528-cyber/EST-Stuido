const EST_PIANO_PITCH_NAMES = Object.freeze([
    'C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B'
]);

const EST_PIANO_MIN_MIDI_NOTE = 60;
const EST_PIANO_MAX_MIDI_NOTE = 96;

const clampEstPianoMidiNote = value => {
    const note = Math.round(Number(value));
    if (!Number.isFinite(note)) return EST_PIANO_MIN_MIDI_NOTE;
    return Math.max(EST_PIANO_MIN_MIDI_NOTE, Math.min(EST_PIANO_MAX_MIDI_NOTE, note));
};

const estPianoResourceForMidiNote = value => {
    const note = clampEstPianoMidiNote(value);
    const pitch = EST_PIANO_PITCH_NAMES[note % 12];
    const octave = 4 + Math.floor((note - EST_PIANO_MIN_MIDI_NOTE) / 12);
    return `Piano/${pitch}${octave}`;
};

const estPianoDisplayNameForMidiNote = value => (
    estPianoResourceForMidiNote(value)
        .slice('Piano/'.length)
        .replace('s', '#')
);

// Mirrors the 37 read-only piano MP3 resources in EST firmware: C4 through C7.
const EST_PIANO_RESOURCE_VALUES = Object.freeze(Array.from(
    {length: EST_PIANO_MAX_MIDI_NOTE - EST_PIANO_MIN_MIDI_NOTE + 1},
    (unused, index) => estPianoResourceForMidiNote(EST_PIANO_MIN_MIDI_NOTE + index)
));

export {
    EST_PIANO_MAX_MIDI_NOTE,
    EST_PIANO_MIN_MIDI_NOTE,
    EST_PIANO_PITCH_NAMES,
    EST_PIANO_RESOURCE_VALUES,
    clampEstPianoMidiNote,
    estPianoDisplayNameForMidiNote,
    estPianoResourceForMidiNote
};
