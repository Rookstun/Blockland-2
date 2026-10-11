"""Audio (or .mid) -> MIDI notes as JSON on stdout, for /playaudio.

    venv/bin/python tomidi.py <file> [out.mid]

Audio is transcribed with Spotify's basic-pitch (polyphonic, ONNX model).
Prints {"notes": [[start_s, end_s, midi_pitch, velocity], ...]}.
"""
import contextlib
import json
import logging
import sys
import warnings

logging.disable(logging.WARNING)
warnings.filterwarnings("ignore")

import pretty_midi  # noqa: E402


def main():
    src = sys.argv[1]
    try:
        midi = pretty_midi.PrettyMIDI(src)
    except Exception:
        from basic_pitch import ICASSP_2022_MODEL_PATH
        from basic_pitch.inference import predict

        with contextlib.redirect_stdout(sys.stderr):
            _, midi, _ = predict(
                src,
                ICASSP_2022_MODEL_PATH,
                onset_threshold=0.6,
                frame_threshold=0.35,
                minimum_note_length=80,
                minimum_frequency=55,
                maximum_frequency=2000,
            )
        # basic-pitch gives one piano track; split it by range so the device
        # can give each part its own wave (General MIDI program -> wave in
        # heightmap): bass -> Synth Bass 1 (sawtooth), middle -> Acoustic
        # Grand (sine), high -> Lead 1 square (square)
        notes_all = [n for inst in midi.instruments if not inst.is_drum for n in inst.notes]
        parts = [(38, "bass", lambda p: p < 48), (0, "piano", lambda p: 48 <= p < 72), (80, "lead", lambda p: p >= 72)]
        midi.instruments = []
        for program, name, fits in parts:
            inst = pretty_midi.Instrument(program=program, name=name)
            inst.notes = [n for n in notes_all if fits(n.pitch)]
            if inst.notes:
                midi.instruments.append(inst)
    if len(sys.argv) > 2:
        midi.write(sys.argv[2])
    notes = [
        [round(float(n.start), 3), round(float(n.end), 3), int(n.pitch), int(n.velocity)]
        for inst in midi.instruments
        if not inst.is_drum
        for n in inst.notes
    ]
    notes.sort()
    json.dump({"notes": notes}, sys.stdout)


main()
