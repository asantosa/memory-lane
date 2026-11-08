/* Assemble the person's actual media into a downloadable narrated montage. */
window.MemoryMovie = (() => {
  function supportedType() {
    if(!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return null;
    return ['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp8,opus','video/webm'].find(type => MediaRecorder.isTypeSupported(type)) || null;
  }
  function eventOnce(target, name, timeout = 15000) {
    return new Promise((resolve,reject) => {
      const timer = setTimeout(() => finish(new Error('One of the media files took too long to open. Try replacing it.')),timeout);
      const fail = () => finish(new Error('This browser cannot play one of the selected clips. Try an MP4/H.264 copy.'));
      const pass = () => finish();
      function finish(error) {clearTimeout(timer);target.removeEventListener(name,pass);target.removeEventListener('error',fail);error?reject(error):resolve();}
      target.addEventListener(name,pass,{once:true});target.addEventListener('error',fail,{once:true});
    });
  }
  async function loadMedia(item) {
    const url = URL.createObjectURL(item.blob);
    const element = document.createElement(item.type === 'video' ? 'video' : 'img');
    const ready = eventOnce(element,item.type === 'video' ? 'loadeddata' : 'load');
    if(item.type === 'video') {element.muted=true;element.playsInline=true;element.loop=true;element.preload='auto';}
    element.src=url;
    try {await ready;return {element,url};} catch(error){URL.revokeObjectURL(url);throw error;}
  }
  function drawFrame(ctx, element, caption, position) {
    const {width:w,height:h}=ctx.canvas;
    ctx.fillStyle='#132e23';ctx.fillRect(0,0,w,h);
    const sourceWidth=element.videoWidth||element.naturalWidth,sourceHeight=element.videoHeight||element.naturalHeight;
    const scale=Math.min(w/sourceWidth,h/sourceHeight)*(element.tagName==='IMG'?1+position*.035:1);
    const dw=sourceWidth*scale,dh=sourceHeight*scale;
    ctx.drawImage(element,(w-dw)/2,(h-dh)/2,dw,dh);
    const gradient=ctx.createLinearGradient(0,h*.65,0,h);gradient.addColorStop(0,'#132e2300');gradient.addColorStop(1,'#132e23ee');ctx.fillStyle=gradient;ctx.fillRect(0,h*.65,w,h*.35);
    ctx.fillStyle='#fffef9';ctx.font=`500 ${Math.round(w*.033)}px sans-serif`;ctx.textAlign='center';
    const words=caption.split(/\s+/);const lines=[];let line='';
    words.forEach(word=>{const next=line?line+' '+word:word;if(ctx.measureText(next).width>w*.83&&line){lines.push(line);line=word;}else line=next;});if(line)lines.push(line);
    const visible=lines.slice(0,3),lineHeight=w*.047;
    visible.forEach((text,i)=>ctx.fillText(text,w/2,h-h*.09-(visible.length-1-i)*lineHeight,w*.88));
  }
  async function render({media,scenes,narration,portrait=false,onProgress=()=>{},signal}) {
    const mimeType=supportedType();if(!mimeType)throw new Error('Video export is unavailable in this browser. Your story and narration can still be downloaded. Try current Safari or Chrome.');
    const AudioContext=window.AudioContext||window.webkitAudioContext;
    if(!AudioContext)throw new Error('Audio mixing is unavailable in this browser.');
    const context=new AudioContext();let stream,recorder,source,animation;
    const loaded=[];
    try {
      await context.resume();
      const audio=await context.decodeAudioData(await narration.arrayBuffer());
      if(audio.duration>180||audio.duration<.1)throw new Error('Use a narration between 1 and 180 seconds.');
      for(const item of media)loaded.push(await loadMedia(item));
      const canvas=document.createElement('canvas');canvas.width=portrait?720:1280;canvas.height=portrait?1280:720;
      const ctx=canvas.getContext('2d');const destination=context.createMediaStreamDestination();
      source=context.createBufferSource();source.buffer=audio;source.connect(destination);source.connect(context.destination);
      stream=canvas.captureStream(24);destination.stream.getAudioTracks().forEach(track=>stream.addTrack(track));
      recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:4000000});
      const chunks=[];let byteCount=0;let failure;
      recorder.ondataavailable=event=>{if(event.data.size){byteCount+=event.data.size;if(byteCount>150000000){failure=new Error('The movie is too large for this device. Try a shorter narration.');recorder.stop();}else chunks.push(event.data);}};
      const complete=new Promise((resolve,reject)=>{recorder.onstop=()=>failure?reject(failure):resolve(new Blob(chunks,{type:mimeType.split(';')[0]}));recorder.onerror=()=>reject(new Error('Video recording was interrupted. Keep this window open and try again.'));});
      const weights=scenes.map(scene=>Math.max(1,scene.narration.split(/\s+/).length));const totalWeight=weights.reduce((a,b)=>a+b,0);
      const boundaries=[];let boundary=0;weights.forEach(weight=>{boundary+=audio.duration*weight/totalWeight;boundaries.push(boundary);});
      let current=-1;
      drawFrame(ctx,loaded[0].element,scenes[0].caption,0);
      const abort=()=>{failure=new Error('Video export stopped. Your story and narration are kept.');if(recorder.state!=='inactive')recorder.stop();};
      signal?.addEventListener('abort',abort,{once:true});
      const started=context.currentTime;
      recorder.start(500);source.start();
      function frame(){
        if(recorder.state==='inactive')return;
        if(signal?.aborted){abort();return;}
        const elapsed=context.currentTime-started;
        if(elapsed>=audio.duration){recorder.stop();return;}
        let index=boundaries.findIndex(end=>elapsed<end);if(index<0)index=boundaries.length-1;
        const mediaIndex=media.findIndex(item=>item.id===scenes[index].mediaId);
        if(index!==current){if(current>=0){const previous=media.findIndex(item=>item.id===scenes[current].mediaId);loaded[previous].element.pause?.();}current=index;const element=loaded[mediaIndex].element;if(element.tagName==='VIDEO'){element.currentTime=0;element.play().catch(()=>{failure=new Error('A video clip could not play during export. Try another browser or an MP4 copy.');if(recorder.state!=='inactive')recorder.stop();});}}
        const start=index?boundaries[index-1]:0;
        drawFrame(ctx,loaded[mediaIndex].element,scenes[index].caption,(elapsed-start)/(boundaries[index]-start));
        onProgress(Math.min(1,elapsed/audio.duration));animation=requestAnimationFrame(frame);
      }
      animation=requestAnimationFrame(frame);
      // A hidden tab can suspend frames on mobile; stop rather than export a frozen movie.
      const visibility=()=>{if(document.hidden)abort();};document.addEventListener('visibilitychange',visibility);
      try {const blob=await complete;onProgress(1);return blob;} finally {document.removeEventListener('visibilitychange',visibility);signal?.removeEventListener('abort',abort);}
    } finally {
      cancelAnimationFrame(animation);try{source?.stop();}catch{}if(recorder&&recorder.state!=='inactive')recorder.stop();stream?.getTracks().forEach(track=>track.stop());loaded.forEach(({element,url})=>{element.pause?.();element.removeAttribute('src');URL.revokeObjectURL(url);});await context.close();
    }
  }
  return {supportedType,eventOnce,render};
})();
