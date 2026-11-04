import sys, wave, numpy as np
from scipy.signal import resample_poly
from faster_whisper import WhisperModel
m=WhisperModel('small',device='cpu',compute_type='int8')
for f in sys.argv[1:]:
  w=wave.open(f); sr=w.getframerate(); x=np.frombuffer(w.readframes(w.getnframes()),np.int16).reshape(-1,w.getnchannels()).mean(1)/32768
  x=resample_poly(x,16000,sr).astype(np.float32); x/=max(1e-6,np.abs(x).max())
  seg,_=m.transcribe(x,language='en',beam_size=5)
  print(f, '|', ' '.join(s.text.strip() for s in seg))
