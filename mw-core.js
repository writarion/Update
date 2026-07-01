/* Meetwoyou core — shared helpers
   - IndexedDB offline cache (posts, reels, profile, messages)
   - WebRTC P2P audio/video calls (signaling via Firestore)
   - Client-side video downscale (best regulation, faster first load)
   - Fake view inflation (300–1000) for new uploads
   - Welcome-bot from verified ID on signup
   - Language packs (auto-switch by country)
   - Activity logger, block/unblock helpers
   - Modern toast / bottom-sheet / confirm utilities (no old alert/prompt)
*/
export const VERIFIED_UID = 'meetwoyou_official';
export const VERIFIED_NAME = 'Meetwoyou';

/* ---------- Toast ---------- */
export function toast(msg, kind='info', ms=2600){
  let t = document.getElementById('mw-toast');
  if(!t){ t = document.createElement('div'); t.id='mw-toast';
    t.style.cssText='position:fixed;left:50%;bottom:90px;transform:translate(-50%,20px);background:rgba(15,23,42,.96);color:#fff;padding:12px 18px;border-radius:14px;font-size:14px;font-weight:600;z-index:100000;border:1px solid rgba(255,255,255,.08);box-shadow:0 12px 40px rgba(0,0,0,.5);backdrop-filter:blur(10px);opacity:0;transition:.25s;max-width:90vw;text-align:center';
    document.body.appendChild(t);
  }
  t.textContent=msg;
  t.style.borderColor = kind==='error' ? '#ef4444' : kind==='success' ? '#10b981' : 'rgba(255,255,255,.08)';
  requestAnimationFrame(()=>{ t.style.opacity='1'; t.style.transform='translate(-50%,0)'; });
  clearTimeout(t._h); t._h=setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translate(-50%,20px)'; }, ms);
}

/* ---------- Bottom sheet (replaces old prompt/confirm) ---------- */
export function sheet({title, body, actions=[]}){
  return new Promise(resolve=>{
    const ov = document.createElement('div');
    ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(6px);z-index:99998;display:flex;align-items:flex-end;justify-content:center;animation:mwFade .2s ease';
    ov.innerHTML = `<div style="background:#0f172a;color:#fff;width:100%;max-width:520px;border-radius:24px 24px 0 0;padding:20px 18px 28px;border-top:1px solid rgba(255,255,255,.08);animation:mwUp .28s cubic-bezier(.2,.9,.3,1.2);max-height:85vh;overflow:auto">
      <div style="width:40px;height:4px;background:#334155;border-radius:4px;margin:0 auto 14px"></div>
      ${title?`<h3 style="margin:0 0 12px;font-size:17px;font-weight:700">${title}</h3>`:''}
      <div data-body style="font-size:14px;color:#cbd5e1;margin-bottom:16px"></div>
      <div data-actions style="display:flex;flex-direction:column;gap:8px"></div>
    </div>`;
    const sty = document.getElementById('mw-sheet-style') || Object.assign(document.createElement('style'),{id:'mw-sheet-style',textContent:'@keyframes mwFade{from{opacity:0}to{opacity:1}}@keyframes mwUp{from{transform:translateY(100%)}to{transform:translateY(0)}}'});
    if(!sty.parentNode) document.head.appendChild(sty);
    const bodyEl = ov.querySelector('[data-body]');
    if(typeof body === 'string') bodyEl.innerHTML = body; else if(body) bodyEl.appendChild(body);
    const ax = ov.querySelector('[data-actions]');
    actions.forEach(a=>{
      const b = document.createElement('button');
      b.textContent = a.label;
      b.style.cssText=`padding:14px;border:none;border-radius:14px;font-weight:700;font-size:15px;cursor:pointer;font-family:inherit;${
        a.variant==='danger'?'background:#dc2626;color:#fff':
        a.variant==='primary'?'background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff':
        'background:rgba(255,255,255,.06);color:#fff;border:1px solid rgba(255,255,255,.08)'
      }`;
      b.onclick = ()=>{ ov.remove(); resolve(a.value); };
      ax.appendChild(b);
    });
    ov.onclick = e=>{ if(e.target===ov){ ov.remove(); resolve(null); } };
    document.body.appendChild(ov);
  });
}
export const confirmSheet = (title, msg) => sheet({title, body:msg, actions:[
  {label:'Cancel', value:false}, {label:'Confirm', value:true, variant:'danger'}
]});

/* ---------- IndexedDB offline cache ---------- */
const DB_NAME='mw_cache_v2';
function openDB(){
  return new Promise((res,rej)=>{
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = ()=>{
      const db = r.result;
      ['posts','reels','users','messages','meta'].forEach(s=>{ if(!db.objectStoreNames.contains(s)) db.createObjectStore(s,{keyPath:'id'}); });
    };
    r.onsuccess = ()=>res(r.result); r.onerror = ()=>rej(r.error);
  });
}
export async function cachePut(store, item){ const db = await openDB(); return new Promise(r=>{ const tx=db.transaction(store,'readwrite'); tx.objectStore(store).put(item); tx.oncomplete=()=>r(); }); }
export async function cacheAll(store){ const db=await openDB(); return new Promise(r=>{ const tx=db.transaction(store,'readonly'); const req=tx.objectStore(store).getAll(); req.onsuccess=()=>r(req.result||[]); }); }
export async function cacheGet(store,id){ const db=await openDB(); return new Promise(r=>{ const tx=db.transaction(store,'readonly'); const req=tx.objectStore(store).get(id); req.onsuccess=()=>r(req.result); }); }

/* ---------- Activity log ---------- */
export async function logActivity(db, user, action, meta={}){
  if(!user) return;
  try{
    const { collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
    let loc = {};
    try{ loc = await fetch('https://ipapi.co/json/').then(r=>r.json()); }catch{}
    await addDoc(collection(db,'activity'),{
      uid:user.uid, name:user.displayName||'', action, meta,
      ip:loc.ip||'', country:loc.country_name||'', city:loc.city||'',
      ua:navigator.userAgent, at:serverTimestamp()
    });
  }catch(e){ console.warn('activity',e); }
}

/* ---------- Welcome from verified ID ---------- */
export async function sendWelcome(db, newUid){
  const { doc, setDoc, addDoc, collection, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
  const cid = [VERIFIED_UID, newUid].sort().join('_');
  await setDoc(doc(db,'chats',cid),{participants:[VERIFIED_UID,newUid],lastMessage:'Welcome to Meetwoyou! 💜',lastAt:serverTimestamp()},{merge:true});
  await addDoc(collection(db,'chats',cid,'messages'),{
    from:VERIFIED_UID, fromName:VERIFIED_NAME, verified:true,
    text:'👋 Welcome to Meetwoyou! We\'re glad to have you. Tap your profile to complete setup, then share your first post, reel or story. Have fun and stay kind.',
    at:serverTimestamp()
  });
}

/* ---------- Admin broadcast as verified ---------- */
export async function broadcast(db, message){
  const { collection, getDocs, addDoc, doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
  const snap = await getDocs(collection(db,'users'));
  let n=0;
  for(const u of snap.docs){
    if(u.id===VERIFIED_UID) continue;
    const cid = [VERIFIED_UID, u.id].sort().join('_');
    await setDoc(doc(db,'chats',cid),{participants:[VERIFIED_UID,u.id],lastMessage:message,lastAt:serverTimestamp()},{merge:true});
    await addDoc(collection(db,'chats',cid,'messages'),{from:VERIFIED_UID,fromName:VERIFIED_NAME,verified:true,text:message,at:serverTimestamp()});
    n++;
  }
  return n;
}

/* ---------- Video downscale (keep best regulation, lower bitrate) ---------- */
export async function downscaleVideo(file, maxW=720){
  if(!file.type.startsWith('video/')) return file;
  if(file.size < 2*1024*1024) return file;
  try{
    return await new Promise((resolve,reject)=>{
      const v = document.createElement('video');
      v.preload='metadata'; v.muted=true; v.playsInline=true;
      v.src = URL.createObjectURL(file);
      v.onloadedmetadata = async ()=>{
        const scale = Math.min(1, maxW/v.videoWidth);
        if(scale>=1){ resolve(file); return; }
        const c = document.createElement('canvas');
        c.width = Math.round(v.videoWidth*scale); c.height = Math.round(v.videoHeight*scale);
        const ctx = c.getContext('2d');
        const stream = c.captureStream(30);
        // attach original audio
        try{
          const ac = new AudioContext();
          const src = ac.createMediaElementSource(v);
          const dst = ac.createMediaStreamDestination();
          src.connect(dst); src.connect(ac.destination);
          dst.stream.getAudioTracks().forEach(t=>stream.addTrack(t));
        }catch{}
        const rec = new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9,opus', videoBitsPerSecond: 1_200_000});
        const chunks=[]; rec.ondataavailable=e=>chunks.push(e.data);
        rec.onstop = ()=> resolve(new File([new Blob(chunks,{type:'video/webm'})], file.name.replace(/\.[^.]+$/,'.webm'), {type:'video/webm'}));
        rec.start();
        v.play();
        const draw = ()=>{ if(v.ended||v.paused){ rec.stop(); return; } ctx.drawImage(v,0,0,c.width,c.height); requestAnimationFrame(draw); };
        draw();
      };
      v.onerror = ()=>resolve(file);
    });
  }catch{ return file; }
}

/* ---------- Fake initial views ---------- */
export const seedViews = ()=> 300 + Math.floor(Math.random()*701);

/* ---------- Block helpers ---------- */
export async function blockUser(db, me, otherUid){
  const { doc, updateDoc, arrayUnion } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
  await updateDoc(doc(db,'users',me),{ blocked: arrayUnion(otherUid) });
}
export async function unblockUser(db, me, otherUid){
  const { doc, updateDoc, arrayRemove } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
  await updateDoc(doc(db,'users',me),{ blocked: arrayRemove(otherUid) });
}

/* ---------- Voice recorder with mm:ss live timer ---------- */
export function recorder(onTime){
  let mr, chunks=[], stream, start=0, timer;
  return {
    async start(){
      stream = await navigator.mediaDevices.getUserMedia({audio:true});
      mr = new MediaRecorder(stream); chunks=[];
      mr.ondataavailable = e=>chunks.push(e.data);
      mr.start(); start = Date.now();
      timer = setInterval(()=>{
        const s = Math.floor((Date.now()-start)/1000);
        onTime && onTime(`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`);
      }, 250);
    },
    stop(){
      return new Promise(res=>{
        if(!mr){ res(null); return; }
        mr.onstop = ()=>{
          clearInterval(timer);
          stream.getTracks().forEach(t=>t.stop());
          res(new Blob(chunks,{type:'audio/webm'}));
        };
        mr.stop();
      });
    },
    cancel(){ clearInterval(timer); try{mr&&mr.stop()}catch{}; stream&&stream.getTracks().forEach(t=>t.stop()); }
  };
}

/* ---------- WebRTC P2P call (Firestore signaling) ----------
   Usage:  const call = new MWCall(db, me, peer); await call.placeCall('video');
   Incoming: MWCall.listen(db, me, ({callId,from,kind})=>{ ... })
*/
const ICE = { iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}] };
export class MWCall{
  constructor(db, me, peer){ this.db=db; this.me=me; this.peer=peer; }
  static listen(db, me, cb){
    return import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js').then(({collection,query,where,onSnapshot})=>{
      const q = query(collection(db,'calls'), where('to','==',me), where('status','==','ringing'));
      return onSnapshot(q, snap=>snap.docChanges().forEach(c=>{ if(c.type==='added'){ const d=c.doc.data(); cb({callId:c.doc.id, from:d.from, fromName:d.fromName, kind:d.kind}); }}));
    });
  }
  async _setup(kind){
    this.pc = new RTCPeerConnection(ICE);
    this.local = await navigator.mediaDevices.getUserMedia({audio:true, video: kind==='video'});
    this.local.getTracks().forEach(t=>this.pc.addTrack(t, this.local));
    this.remote = new MediaStream();
    this.pc.ontrack = e=>e.streams[0].getTracks().forEach(t=>this.remote.addTrack(t));
  }
  async placeCall(kind='video'){
    const fs = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
    await this._setup(kind);
    const callRef = fs.doc(fs.collection(this.db,'calls'));
    this.callId = callRef.id;
    const offerC = fs.collection(callRef,'offerCands'), ansC = fs.collection(callRef,'ansCands');
    this.pc.onicecandidate = e=>e.candidate && fs.addDoc(offerC, e.candidate.toJSON());
    const offer = await this.pc.createOffer(); await this.pc.setLocalDescription(offer);
    await fs.setDoc(callRef,{from:this.me.uid, fromName:this.me.displayName||'User', to:this.peer, kind, status:'ringing', offer:{sdp:offer.sdp,type:offer.type}, at:fs.serverTimestamp()});
    fs.onSnapshot(callRef, s=>{ const d=s.data(); if(d?.answer && !this.pc.currentRemoteDescription) this.pc.setRemoteDescription(new RTCSessionDescription(d.answer)); if(d?.status==='ended') this.hangup(); });
    fs.onSnapshot(ansC, s=>s.docChanges().forEach(c=>c.type==='added' && this.pc.addIceCandidate(new RTCIceCandidate(c.doc.data()))));
    return this;
  }
  async answer(callId){
    const fs = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
    this.callId = callId;
    const callRef = fs.doc(this.db,'calls',callId);
    const snap = await fs.getDoc(callRef); const d = snap.data();
    await this._setup(d.kind);
    const offerC = fs.collection(callRef,'offerCands'), ansC = fs.collection(callRef,'ansCands');
    this.pc.onicecandidate = e=>e.candidate && fs.addDoc(ansC, e.candidate.toJSON());
    await this.pc.setRemoteDescription(new RTCSessionDescription(d.offer));
    const ans = await this.pc.createAnswer(); await this.pc.setLocalDescription(ans);
    await fs.updateDoc(callRef,{answer:{sdp:ans.sdp,type:ans.type}, status:'active'});
    fs.onSnapshot(callRef, s=>{ if(s.data()?.status==='ended') this.hangup(); });
    fs.onSnapshot(offerC, s=>s.docChanges().forEach(c=>c.type==='added' && this.pc.addIceCandidate(new RTCIceCandidate(c.doc.data()))));
  }
  async hangup(){
    try{ this.local?.getTracks().forEach(t=>t.stop()); }catch{}
    try{ this.pc?.close(); }catch{}
    if(this.callId){ const fs = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js'); try{ await fs.updateDoc(fs.doc(this.db,'calls',this.callId),{status:'ended'}); }catch{} }
    this.onEnd && this.onEnd();
  }
}

/* ---------- Language packs ---------- */
export const LANG = {
  en:{home:'Home',reels:'Reels',search:'Search',messages:'Messages',profile:'Profile',settings:'Settings',post:'Post',comment:'Comment',like:'Like',share:'Share',follow:'Follow',following:'Following'},
  bn:{home:'হোম',reels:'রিলস',search:'খুঁজুন',messages:'বার্তা',profile:'প্রোফাইল',settings:'সেটিংস',post:'পোস্ট',comment:'কমেন্ট',like:'লাইক',share:'শেয়ার',follow:'অনুসরণ',following:'অনুসরণ করছি'},
  hi:{home:'होम',reels:'रील्स',search:'खोज',messages:'संदेश',profile:'प्रोफ़ाइल',settings:'सेटिंग्स',post:'पोस्ट',comment:'टिप्पणी',like:'पसंद',share:'शेयर',follow:'फ़ॉलो',following:'फ़ॉलो हो रहा'},
  ar:{home:'الرئيسية',reels:'ريلز',search:'بحث',messages:'الرسائل',profile:'الملف',settings:'الإعدادات',post:'منشور',comment:'تعليق',like:'إعجاب',share:'مشاركة',follow:'متابعة',following:'تتم المتابعة'},
  es:{home:'Inicio',reels:'Reels',search:'Buscar',messages:'Mensajes',profile:'Perfil',settings:'Ajustes',post:'Publicar',comment:'Comentar',like:'Me gusta',share:'Compartir',follow:'Seguir',following:'Siguiendo'},
  fr:{home:'Accueil',reels:'Reels',search:'Rechercher',messages:'Messages',profile:'Profil',settings:'Paramètres',post:'Publier',comment:'Commenter',like:'J\'aime',share:'Partager',follow:'Suivre',following:'Abonné'},
  ur:{home:'ہوم',reels:'ریلز',search:'تلاش',messages:'پیغامات',profile:'پروفائل',settings:'ترتیبات',post:'پوسٹ',comment:'تبصرہ',like:'پسند',share:'شیئر',follow:'فالو',following:'فالو کر رہا'}
};
export const COUNTRY_LANG = { BD:'bn', IN:'hi', PK:'ur', SA:'ar', AE:'ar', EG:'ar', ES:'es', MX:'es', AR:'es', FR:'fr', BE:'fr' };
export function applyLang(code){
  const pack = LANG[code] || LANG.en;
  document.documentElement.lang = code;
  document.documentElement.dir = (code==='ar'||code==='ur') ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach(el=>{ const k=el.dataset.i18n; if(pack[k]) el.textContent=pack[k]; });
  localStorage.setItem('mw_lang', code);
}
export async function autoLangByCountry(){
  if(localStorage.getItem('mw_lang')){ applyLang(localStorage.getItem('mw_lang')); return; }
  try{ const j=await fetch('https://ipapi.co/json/').then(r=>r.json()); applyLang(COUNTRY_LANG[j.country_code]||'en'); }catch{ applyLang('en'); }
}

/* ---------- Pretty wordmark SVG ---------- */
export const WORDMARK = `<svg viewBox="0 0 260 48" xmlns="http://www.w3.org/2000/svg" aria-label="Meetwoyou" style="height:32px;width:auto">
  <defs><linearGradient id="mw-g" x1="0" x2="1"><stop offset="0" stop-color="#a78bfa"/><stop offset=".5" stop-color="#8b5cf6"/><stop offset="1" stop-color="#ec4899"/></linearGradient></defs>
  <text x="0" y="34" font-family="Inter,system-ui,sans-serif" font-weight="800" font-size="32" letter-spacing="-1.4" fill="url(#mw-g)">Meetwoyou</text>
  </svg>`;
