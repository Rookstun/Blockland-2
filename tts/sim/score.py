import sys, re, json, numpy as np
from faster_whisper import WhisperModel
from sim import synth, additive
m=WhisperModel('small',device='cpu',compute_type='int8')
S=['hello there','this is a sound test','open the door','where is the bathroom','give me all your money','the cat sat on the mat','i like to eat pizza','good morning everyone']
def wer(ref,hyp):
  r=ref.split(); h=re.sub(r'[^a-z ]','',hyp.lower()).split()
  d=list(range(len(h)+1))
  for i,a in enumerate(r,1):
    p=d[:]; d[0]=i
    for j,b in enumerate(h,1): d[j]=min(p[j]+1,d[j-1]+1,p[j-1]+(a!=b))
  return d[-1]/len(r)
V=json.loads(sys.argv[1])
for name,kw in V.items():
  tot=0; hy=[]
  for s in S:
    x=(additive if kw.pop("add",0) else synth)(s,**kw) if False else ((additive(s,**{k:v for k,v in kw.items() if k!="add"})) if kw.get("add") else synth(s,**kw)); x=np.concatenate([np.zeros(4000,np.float32),x,np.zeros(4000,np.float32)])
    seg,_=m.transcribe(x,language='en',beam_size=5,condition_on_previous_text=False); h=' '.join(z.text for z in seg)
    tot+=wer(s,h); hy.append(h.strip())
  print(f'{name}: WER {tot/len(S):.2f} | '+' / '.join(hy[:4]),flush=True)
