# Unit tests for the Python mirror of tts/voice.ws:  python -m unittest tts/sim/test_sim.py  (from repo root) or  python test_sim.py
import unittest, numpy as np
from sim import phonemes, synth, additive, osc, T
from bench import wer

IY, IH, AE, AA, UH, UW, M, H = 1, 2, 4, 5, 7, 8, 18, 35

def word(w): return [p for p in phonemes(w) if p != 0]   # drop pauses

class Rules(unittest.TestCase):
  def test_you_is_oo(self): self.assertEqual(word('you'), [17, UW])
  def test_out_is_ow(self): self.assertEqual(word('out')[:2], [AA, UH])
  def test_im_is_long_i(self): self.assertEqual(word('im'), [AE, IH, M])
  def test_i_apostrophe_m(self): self.assertEqual(word("i'm"), [AE, IH, M])
  def test_him_stays_short(self): self.assertEqual(word('him'), [H, IH, M])
  def test_hi_long(self): self.assertEqual(word('hi'), [H, AE, IH])
  def test_magic_e(self): self.assertEqual(word('time')[2:4], [AE, IH])
  def test_stop_gets_burst(self): self.assertEqual(word('t'), [23, 36])
  def test_sentence_ends_in_pause(self): self.assertEqual(phonemes('a')[-2:], [0, 0])
  def test_all_phonemes_in_tables(self):
    for p in phonemes("the quick brown fox jumps over the lazy dog, i'm you!"):
      self.assertTrue(0 <= p < len(T['DUR']))

class Osc(unittest.TestCase):
  def test_sine(self):
    ph = np.linspace(0, 2 * np.pi, 100)
    np.testing.assert_allclose(osc(ph, 440, 16000, 'sine'), np.sin(ph))
  def test_saw_bandlimited_and_bounded(self):
    sr, f = 16000, 1760
    x = osc(2 * np.pi * f * np.arange(sr) / sr, f, sr, 'saw')
    self.assertLess(np.abs(x).max(), 1.3)                       # Gibbs overshoot only
    spec = np.abs(np.fft.rfft(x))
    peaks = np.flatnonzero(spec > spec.max() * 0.05)
    self.assertTrue(np.all(peaks * 1.0 <= sr / 2))              # no partial above Nyquist
    self.assertEqual(sorted({round(p / f) for p in peaks}), [1, 2, 3, 4])  # 1760, 3520, 5280, 7040
  def test_saw_harmonic_falloff(self):
    sr, f = 16000, 500
    spec = np.abs(np.fft.rfft(osc(2 * np.pi * f * np.arange(sr) / sr, f, sr, 'saw')))
    self.assertAlmostEqual(spec[2 * f] / spec[f], 0.5, places=2)

class Synth(unittest.TestCase):
  def check(self, x):
    self.assertEqual(x.dtype, np.float32)
    self.assertTrue(np.isfinite(x).all())
    self.assertAlmostEqual(float(np.abs(x).max()), 1.0, places=4)
  def test_variants_render(self):
    for kw in [{}, {'wave': 'saw'}, {'saw_from': 0}]: self.check(additive('hello there', **kw))
    for kw in [{}, {'wave': 'saw'}]: self.check(synth('hello there', **kw))
  def test_longer_text_longer_audio(self):
    self.assertGreater(len(additive('hello there friend')), len(additive('hello')))
  def test_slower_is_longer(self):
    self.assertGreater(len(additive('hello', dur=2.0)), len(additive('hello', dur=1.0)))
  def test_deterministic(self):
    np.testing.assert_array_equal(additive('sound test'), additive('sound test'))
  def test_sine_respects_pitch_cap(self):
    # sines never sound above x4 of 440 (the game's PitchMultiplier cap)
    self.assertLess(self.top(additive('mama', saw_from=0)), 0.05)   # voiced only, no noise source
  def test_saw_reaches_past_cap(self):
    self.assertGreater(self.top(additive('mama', saw_from=9)), 0.05)
  def top(self, x):
    spec = np.abs(np.fft.rfft(x)); hz = np.fft.rfftfreq(len(x), 1 / 16000)
    return spec[hz > 1900].max() / spec.max()

class Wer(unittest.TestCase):
  def test_exact(self): self.assertEqual(wer('open the door', 'Open the door.'), 0)
  def test_sub(self): self.assertAlmostEqual(wer('open the door', 'open the floor'), 1 / 3)
  def test_insertions_count(self): self.assertEqual(wer('hi', 'bam bam bam'), 3)
  def test_empty(self): self.assertEqual(wer('hello there', ''), 1)

if __name__ == '__main__': unittest.main()
