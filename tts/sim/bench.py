# Benchmark tts voice variants: intelligibility (faster_whisper small WER) + render speed + in-game speaker cost.
#   python bench.py            full run -> bench.md table + out/<variant>.wav (first sentence, for ears)
#   python bench.py --speed    render timing only (no whisper)
#   python bench.py sine16 saw16   only these variants
import sys, re, time, wave, os, numpy as np
from sim import synth, additive

# name: (renderer, kwargs, in-game speakers incl. noise)
VARIANTS = {
  'sine16':       (additive, {'saw_from': 0, 'tween': 0.35}, 17),   # pre-2026-11-05 voice
  'sine16_tw5':   (additive, {'saw_from': 0}, 17),
  'saw16':        (additive, {'wave': 'saw', 'tween': 0.35}, 17),
  'sawtop9':      (additive, {'tween': 0.35}, 17),            # sines 1-8, saws 9-16 (overtones past the 1760 cap)
  'sawtop13':     (additive, {'saw_from': 13, 'tween': 0.35}, 17),
  'sawtop9_k1':   (additive, {'K': 1.0, 'tween': 0.35}, 17),  # no spectrum squeeze; saws carry F2/F3
  'sawtop9_tw5':  (additive, {}, 17),                          # LIVE since 2026-11-05
  'formant3_sine': (synth, {'dur': 1.3}, 4),                  # the old 3 formant oscillators
  'formant3_saw':  (synth, {'dur': 1.3, 'wave': 'saw'}, 4),
}
SENTENCES = ['hello there', 'this is a sound test', 'open the door', 'where is the bathroom', 'give me all your money',
  'the cat sat on the mat', 'i like to eat pizza', 'good morning everyone', 'im gonna poop on you', 'fuck you',
  'nice house', 'what time is it']
SR = 16000

def wer(ref, hyp):
  r = ref.split(); h = re.sub(r"[^a-z' ]", '', hyp.lower()).replace("'", '').split()
  r = [w.replace("'", '') for w in r]
  d = list(range(len(h) + 1))
  for i, a in enumerate(r, 1):
    p = d[:]; d[0] = i
    for j, b in enumerate(h, 1): d[j] = min(p[j] + 1, d[j - 1] + 1, p[j - 1] + (a != b))
  return d[-1] / len(r)

def render(name, s):
  fn, kw, _ = VARIANTS[name]; return fn(s, **kw)

def speed(name, reps=3):
  t = time.perf_counter(); n = 0
  for _ in range(reps):
    for s in SENTENCES: n += len(render(name, s))
  return (time.perf_counter() - t) * 1000 / (n / SR)   # ms of CPU per second of speech

def save_wav(path, x):
  os.makedirs(os.path.dirname(path), exist_ok=True)
  with wave.open(path, 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x * 32000).astype(np.int16).tobytes())

def main(argv):
  only = [a for a in argv if not a.startswith('-')] or list(VARIANTS)
  rows = []
  if '--speed' in argv:
    for v in only: print(f'{v:15s} {speed(v):7.1f} ms/s', flush=True)
    return
  from faster_whisper import WhisperModel
  m = WhisperModel('small', device='cpu', compute_type='int8')
  here = os.path.dirname(os.path.abspath(__file__))
  for v in only:
    errs, hyps = [], []
    for s in SENTENCES:
      x = render(v, s); pad = np.zeros(4000, np.float32)
      seg, _ = m.transcribe(np.concatenate([pad, x, pad]), language='en', beam_size=5, condition_on_previous_text=False)
      h = ' '.join(z.text for z in seg).strip(); hyps.append(h); errs.append(wer(s, h))
    save_wav(os.path.join(here, 'out', v + '.wav'), np.concatenate([render(v, s) for s in SENTENCES[:4]]))
    e = np.array(errs); exact = int((e == 0).sum())
    rows.append((v, e.mean(), np.median(e), exact, speed(v, 1), VARIANTS[v][2], ' / '.join(hyps[:3]), hyps))
    print(f'{v}: WER {e.mean():.2f} exact {exact}/{len(e)} | ' + ' / '.join(hyps), flush=True)
  rows.sort(key=lambda r: r[1])
  md = ['| variant | mean WER | median | exact | ms/s render | speakers | heard (first 3) |', '|---|---|---|---|---|---|---|']
  md += [f'| {v} | {a:.2f} | {b:.2f} | {c}/{len(SENTENCES)} | {d:.0f} | {s} | {h} |' for v, a, b, c, d, s, h, _ in rows]
  md += ['', 'Sentences: ' + ' / '.join(SENTENCES), '', 'All transcripts:', '']
  md += [f'- **{v}**: ' + ' / '.join(hs) for v, *_, hs in rows]
  open(os.path.join(here, 'bench.md'), 'w', encoding='utf-8').write('\n'.join(md) + '\n')
  print('\n'.join(md[:len(rows) + 2]))

if __name__ == '__main__': main(sys.argv[1:])
