# Python mirror of tts/tts.ws (rules + 20 ms tween + synth) for whisper scoring of variants
import re, numpy as np
SRC=open(r'C:/Users/pooper/Documents/claudeBS/brickadia/tts/voice.ws',encoding='utf-8').read()
def arr(n): return [int(v) for v in re.search(r'var '+n+r': int\[\] = \[([^\]]*)\]',SRC,re.S).group(1).replace('\n',' ').split(',')]
T={n:arr(n) for n in ['F1','F2','F3','AMP','NOI','NP','DUR']}
L=set('ABCDEFGHIJKLMNOPQRSTUVWXYZ'); V=set('AEIOU')
def phonemes(text):
  text=text.upper().strip()+'.'; pos=0; out=[]; vs=False
  g=lambda i: text[i] if i<len(text) else ''
  while pos<len(text):
    q=[]; c,n,n2,n3=g(pos),g(pos+1),g(pos+2),g(pos+3); two=c+n; p=0; step=1
    if c not in L:
      vs=False; p=0
      if c in ',.!?': q=[0,0]
    elif two=='TH': p,step=33,2
    elif two=='SH': p,step=29,2
    elif two=='CH': p,q,step=23,[29],2
    elif two=='PH': p,step=31,2
    elif two=='WH': p,step=16,2
    elif two=='CK': p,step=25,2
    elif two=='NG': p,step=20,2
    elif two=='QU': p,q,step=25,[16],2
    elif two in('EE','EA'): p,step,vs=1,2,True
    elif two=='OO': p,step,vs=8,2,True
    elif two=='OU' and n2 not in L: p,step,vs=8,2,True
    elif two in('OU','OW'): p,q,step,vs=5,[7],2,True
    elif two in('AI','AY'): p,q,step,vs=12,[2],2,True
    elif two=='OA': p,q,step,vs=13,[7],2,True
    elif two in('OI','OY'): p,q,step,vs=6,[2],2,True
    elif two in('AU','AW'): p,step,vs=6,2,True
    elif two in('ER','IR','UR'): p,step,vs=10,2,True
    elif two=='AR': p,q,step,vs=5,[15],2,True
    elif two=='OR': p,q,step,vs=6,[15],2,True
    elif c in V:
      magic= n in L and n not in V and n2=='E' and n3 not in L
      if c=='E' and n not in L and vs: p=-1
      elif magic: p,q={'A':(12,[2]),'E':(1,[]),'I':(4,[2]),'O':(13,[7]),'U':(17,[8])}[c]
      elif n not in L and c in 'EOI': p,q={'E':(1,[]),'O':(13,[7]),'I':(4,[2])}[c]
      else: p={'A':4,'E':3,'I':2,'O':5,'U':9}[c]
      vs=True
    elif c=='Y':
      if n in L and not vs: p=17
      else: p,vs=1,True
    elif c=='C': p=27 if n in 'EIY' and n else 25
    elif c=='G':
      if n and n in 'EIY': p,q=24,[30]
      else: p=26
    elif c=='X': p,q=25,[27]
    elif c=='J': p,q=24,[30]
    else: p=dict(B=22,D=24,F=31,H=35,K=25,L=14,M=18,N=19,P=21,Q=25,R=15,S=27,T=23,V=32,W=16,Z=28)[c]
    pos+=step
    if 21<=p<=26: q=[36]+q
    if p>=0: out.append(p)
    out+=q
  return out
def synth(text,K=0.72,dur=1.0,buzz=0.0,f0=120,sr=16000,cap=4.0,v2=0.7,v3=0.25,f3=True,tween=0.35):
  ph=phonemes(text); c=[500.,1500.,2500.]; t=[500.,1500.,2500.]; lev=nlev=0.; npit=1.
  frames=[]
  for p in ph:
    if 1<=p<=20: t=[T['F1'][p],T['F2'][p],T['F3'][p]]
    elif 21<=p<=26: t=[c[0]*.6,(c[1]+T['F2'][p])*.5,t[2]]
    for _ in range(max(1,round(T['DUR'][p]*dur))):
      c=[c[i]+(t[i]-c[i])*tween for i in range(3)]
      lev+=(T['AMP'][p]*.01-lev)*.6; nlev+=(T['NOI'][p]*.01-nlev)*.7; npit=T['NP'][p]*.01
      frames.append((list(c),lev,nlev,npit))
  hop=int(sr*.02); n=len(frames)*hop; out=np.zeros(n); ph3=np.zeros(4); rng=np.random.default_rng(0)
  for k,(cc,lv,nl,np_) in enumerate(frames):
    i0=k*hop; tt=np.arange(hop)/sr
    amps=[lv,lv*v2,lv*v3 if f3 else 0]
    for j in range(3):
      f=min(cc[j]*K/440,cap)*440
      out[i0:i0+hop]+=amps[j]*np.sin(ph3[j]+2*np.pi*f*tt); ph3[j]+=2*np.pi*f*hop/sr
    if buzz:
      f=f0*(1-0.15*k/len(frames))
      out[i0:i0+hop]+=buzz*lv*np.sign(np.sin(ph3[3]+2*np.pi*f*tt)); ph3[3]+=2*np.pi*f*hop/sr
    out[i0:i0+hop]+=nl*rng.standard_normal(hop)*0.5
  return (out/max(1e-6,np.abs(out).max())).astype(np.float32)
def additive(text,K=0.72,dur=1.3,f0=110,nh=16,cap=4.0,bw=(90,110,170),sr=16000,tween=0.35,noise=0.5):
  ph=phonemes(text); c=[500.,1500.,2500.]; t=list(c); lev=nlev=0.; fr=[]
  for p in ph:
    if 1<=p<=20: t=[T['F1'][p],T['F2'][p],T['F3'][p]]
    elif 21<=p<=26: t=[c[0]*.6,(c[1]+T['F2'][p])*.5,t[2]]
    for _ in range(max(1,round(T['DUR'][p]*dur))):
      c=[c[i]+(t[i]-c[i])*tween for i in range(3)]
      lev+=(T['AMP'][p]*.01-lev)*.6; nlev+=(T['NOI'][p]*.01-nlev)*.7; fr.append((list(c),lev,nlev))
  hop=int(sr*.02); out=np.zeros(len(fr)*hop); ph_=np.zeros(nh); rng=np.random.default_rng(0)
  for k,(cc,lv,nl) in enumerate(fr):
    i0=k*hop; tt=np.arange(hop)/sr; F0=f0*(1.1-0.2*k/len(fr))
    for h in range(1,nh+1):
      f=h*F0   # harmonic in the scaled domain; envelope evaluated at f/K (real speech freq)
      if f/440>cap: continue
      g=sum(1/(1+((f/K-cc[j])/bw[j])**2)*[1,.6,.3][j] for j in range(3))
      out[i0:i0+hop]+=lv*g*np.sin(ph_[h-1]+2*np.pi*f*tt); ph_[h-1]+=2*np.pi*f*hop/sr
    out[i0:i0+hop]+=nl*noise*rng.standard_normal(hop)
  return (out/max(1e-6,np.abs(out).max())).astype(np.float32)
