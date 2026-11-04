import sys, wave, pyaudiowpatch as pa
secs=float(sys.argv[2]); p=pa.PyAudio()
d=p.get_default_wasapi_loopback()
s=p.open(format=pa.paInt16,channels=d['maxInputChannels'],rate=int(d['defaultSampleRate']),input=True,input_device_index=d['index'],frames_per_buffer=1024)
fr=[s.read(1024) for _ in range(int(d['defaultSampleRate']/1024*secs))]
w=wave.open(sys.argv[1],'wb'); w.setnchannels(d['maxInputChannels']); w.setsampwidth(2); w.setframerate(int(d['defaultSampleRate'])); w.writeframes(b''.join(fr)); w.close()
print('ok',d['name'])
