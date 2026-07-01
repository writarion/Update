/* Meetwoyou upgrade layer — non-destructive enhancements
   Loaded on every page; safely no-ops if elements aren't present.
*/
import {
  toast, sheet, confirmSheet, cachePut, cacheAll, cacheGet,
  logActivity, sendWelcome, broadcast, downscaleVideo, seedViews,
  blockUser, unblockUser, recorder, MWCall,
  applyLang, autoLangByCountry, WORDMARK, VERIFIED_UID, VERIFIED_NAME
} from './mw-core.js';

// Expose globally for inline handlers in existing HTML
window.MW = { toast, sheet, confirmSheet, cachePut, cacheAll, cacheGet, logActivity, sendWelcome, broadcast, downscaleVideo, seedViews, blockUser, unblockUser, recorder, MWCall, applyLang, VERIFIED_UID, VERIFIED_NAME };

/* ---------- Register SW (offline) ---------- */
if('serviceWorker' in navigator){ navigator.serviceWorker.register('./sw.js').catch(()=>{}); }

/* ---------- Auto language ---------- */
autoLangByCountry();

/* ---------- Replace "Meetwoyou" text headings with the gradient wordmark ---------- */
function prettifyBrand(){
  document.querySelectorAll('[data-brand], .brand-text').forEach(el=>{
    if(el.dataset.mwBrand) return;
    el.dataset.mwBrand='1';
    el.innerHTML = WORDMARK;
  });
  // Heuristic: any element whose text is exactly "Meetwoyou"
  document.querySelectorAll('h1,h2,.logo,.app-name').forEach(el=>{
    if(el.dataset.mwBrand) return;
    const t = (el.textContent||'').trim();
    if(t.toLowerCase()==='meetwoyou'){ el.dataset.mwBrand='1'; el.innerHTML = WORDMARK; }
  });
}
document.addEventListener('DOMContentLoaded', prettifyBrand);
new MutationObserver(prettifyBrand).observe(document.documentElement,{subtree:true,childList:true});

/* ---------- Skeleton + loading polish: hide native scrollbars on lists, smooth scroll ---------- */
const polish = document.createElement('style');
polish.textContent = `
  html{scroll-behavior:smooth}
  *::-webkit-scrollbar{width:6px;height:6px}
  *::-webkit-scrollbar-thumb{background:rgba(124,58,237,.4);border-radius:6px}
  .mw-skel{background:linear-gradient(90deg,#1e293b 0%,#334155 50%,#1e293b 100%);background-size:200% 100%;animation:mwSk 1.2s linear infinite;border-radius:10px}
  @keyframes mwSk{0%{background-position:200% 0}100%{background-position:-200% 0}}
  .mw-fab{position:fixed;right:16px;bottom:78px;width:54px;height:54px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;border:none;font-size:22px;display:flex;align-items:center;justify-content:center;box-shadow:0 12px 30px rgba(124,58,237,.5);cursor:pointer;z-index:1000;transition:.2s}
  .mw-fab:hover{transform:scale(1.06)}
  .mw-ring{position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:99999;display:none;flex-direction:column;align-items:center;justify-content:center;color:#fff;gap:18px}
  .mw-ring.on{display:flex}
  .mw-ring video{width:min(90vw,420px);border-radius:18px;background:#000;aspect-ratio:9/16;object-fit:cover}
  .mw-ring .acts{display:flex;gap:14px}
  .mw-ring .acts button{width:60px;height:60px;border-radius:50%;border:none;color:#fff;font-size:22px;cursor:pointer}
  .mw-rec{position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#0f172a;border:1px solid rgba(255,255,255,.1);padding:14px 22px;border-radius:30px;color:#fff;font-weight:700;z-index:9000;display:flex;align-items:center;gap:10px;font-variant-numeric:tabular-nums}
  .mw-rec .dot{width:10px;height:10px;background:#ef4444;border-radius:50%;animation:mwBlink 1s infinite}
  @keyframes mwBlink{50%{opacity:.3}}
`;
document.head.appendChild(polish);

/* ---------- Cache reads (offline-first display) ----------
   Pages can call window.MW.cachePut('posts', postObj) when they fetch.
   On load, if Firebase is offline/slow, surface cached items into [data-mw-feed], [data-mw-reels].
*/
async function hydrateFromCache(){
  for(const [store, sel] of [['posts','[data-mw-feed]'],['reels','[data-mw-reels]']]){
    const host = document.querySelector(sel);
    if(!host) continue;
    const items = await cacheAll(store);
    if(items.length && !host.dataset.mwHydrated){
      host.dataset.mwHydrated='1';
      // only render if host is currently empty (no live data yet)
      if(!host.children.length){
        items.slice(0,20).forEach(it=>{
          const card = document.createElement('div');
          card.className='mw-cache-card';
          card.style.cssText='background:#1e293b;border-radius:14px;padding:14px;margin:10px 0;color:#fff';
          card.innerHTML = `<div style="font-weight:700">${it.userName||'User'}</div><div style="color:#94a3b8;font-size:13px;margin:6px 0">${(it.text||'').slice(0,200)}</div>${it.image?`<img src="${it.image}" style="width:100%;border-radius:10px" loading="lazy">`:''}<div style="color:#475569;font-size:11px;margin-top:6px">📥 Offline</div>`;
          host.appendChild(card);
        });
      }
    }
  }
}
window.addEventListener('load', hydrateFromCache);

/* ---------- Public APIs the existing HTML can use ---------- */

// Modern post-or-reels chooser with direct camera capture
window.MW.chooseUpload = async function(){
  return sheet({
    title:'Share something',
    body:'What would you like to upload?',
    actions:[
      {label:'📷 Take photo (camera)', value:'camera-photo', variant:'primary'},
      {label:'🎬 Record reel (camera)', value:'camera-reel', variant:'primary'},
      {label:'🖼️ Photo / video from gallery (Post)', value:'gallery-post'},
      {label:'⚡ Vertical video from gallery (Reel)', value:'gallery-reel'},
      {label:'Cancel', value:null}
    ]
  });
};

window.MW.captureFromCamera = function(kind /* 'photo' | 'video' */){
  return new Promise(resolve=>{
    const inp = document.createElement('input');
    inp.type='file';
    inp.accept = kind==='photo' ? 'image/*' : 'video/*';
    inp.capture = 'environment';
    inp.onchange = ()=> resolve(inp.files[0] || null);
    inp.click();
  });
};

// Voice recorder UI with mm:ss display
window.MW.recordVoice = function(){
  return new Promise(async resolve=>{
    const bar = document.createElement('div'); bar.className='mw-rec';
    bar.innerHTML = `<span class="dot"></span><span data-t>00:00</span>
      <button data-stop style="background:#10b981;color:#fff;border:none;padding:6px 14px;border-radius:20px;font-weight:700;cursor:pointer">Send</button>
      <button data-cancel style="background:#475569;color:#fff;border:none;padding:6px 14px;border-radius:20px;font-weight:700;cursor:pointer">Cancel</button>`;
    document.body.appendChild(bar);
    const tEl = bar.querySelector('[data-t]');
    const rec = recorder(t=>tEl.textContent=t);
    try{ await rec.start(); }catch(e){ toast('Mic permission denied','error'); bar.remove(); resolve(null); return; }
    bar.querySelector('[data-stop]').onclick = async ()=>{ const blob = await rec.stop(); bar.remove(); resolve(blob); };
    bar.querySelector('[data-cancel]').onclick = ()=>{ rec.cancel(); bar.remove(); resolve(null); };
  });
};

// Call UI (video/audio) — caller side
window.MW.startCall = async function(db, me, peerUid, peerName, kind='video'){
  const ring = document.createElement('div'); ring.className='mw-ring on';
  ring.innerHTML = `
    <div style="font-weight:700;font-size:18px">📞 Calling ${peerName||'...'}</div>
    <video data-remote autoplay playsinline></video>
    <video data-local autoplay playsinline muted style="position:absolute;right:18px;top:18px;width:110px;height:160px;border-radius:14px;object-fit:cover;border:2px solid #fff"></video>
    <div class="acts">
      <button data-mute style="background:#475569">🎙</button>
      <button data-cam style="background:#475569">📷</button>
      <button data-end style="background:#dc2626">📵</button>
    </div>`;
  document.body.appendChild(ring);
  const call = new MWCall(db, me, peerUid);
  await call.placeCall(kind);
  ring.querySelector('[data-local]').srcObject = call.local;
  ring.querySelector('[data-remote]').srcObject = call.remote;
  call.onEnd = ()=>ring.remove();
  ring.querySelector('[data-end]').onclick = ()=>call.hangup();
  ring.querySelector('[data-mute]').onclick = e=>{ call.local.getAudioTracks().forEach(t=>t.enabled=!t.enabled); e.currentTarget.style.background = call.local.getAudioTracks()[0].enabled?'#475569':'#dc2626'; };
  ring.querySelector('[data-cam]').onclick = e=>{ call.local.getVideoTracks().forEach(t=>t.enabled=!t.enabled); e.currentTarget.style.background = call.local.getVideoTracks()[0]?.enabled?'#475569':'#dc2626'; };
};

// Incoming call listener (call after sign-in)
window.MW.watchIncomingCalls = async function(db, me){
  MWCall.listen(db, me.uid, async ({callId, fromName, kind})=>{
    const accept = await sheet({title:'📞 Incoming '+kind+' call', body:`From <b>${fromName}</b>`, actions:[
      {label:'Decline', value:false}, {label:'Answer', value:true, variant:'primary'}
    ]});
    if(!accept) return;
    const ring = document.createElement('div'); ring.className='mw-ring on';
    ring.innerHTML = `<video data-remote autoplay playsinline></video>
      <video data-local autoplay playsinline muted style="position:absolute;right:18px;top:18px;width:110px;height:160px;border-radius:14px;object-fit:cover;border:2px solid #fff"></video>
      <div class="acts"><button data-end style="background:#dc2626">📵</button></div>`;
    document.body.appendChild(ring);
    const call = new MWCall(db, me, null);
    await call.answer(callId);
    ring.querySelector('[data-local]').srcObject = call.local;
    ring.querySelector('[data-remote]').srcObject = call.remote;
    call.onEnd = ()=>ring.remove();
    ring.querySelector('[data-end]').onclick = ()=>call.hangup();
  });
};

/* ---------- Settings drawer (logout, language, blocked users, activity, install) ---------- */
window.MW.openSettings = async function(ctx={}){
  const {auth, db, user} = ctx;
  const body = document.createElement('div');
  body.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px">
      <button data-act="lang" style="text-align:left;padding:14px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);color:#fff;cursor:pointer">🌐 Language / Country</button>
      <button data-act="blocked" style="text-align:left;padding:14px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);color:#fff;cursor:pointer">🚫 Blocked users</button>
      <button data-act="activity" style="text-align:left;padding:14px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);color:#fff;cursor:pointer">📋 My activity</button>
      <button data-act="install" style="text-align:left;padding:14px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);color:#fff;cursor:pointer">📥 Install Messenger app</button>
      <button data-act="privacy" style="text-align:left;padding:14px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);color:#fff;cursor:pointer">🔒 Privacy & Terms</button>
      <button data-act="logout" style="text-align:left;padding:14px;border-radius:12px;background:#dc2626;border:none;color:#fff;cursor:pointer;font-weight:700">↪ Log out</button>
    </div>`;
  const res = await sheet({title:'Settings', body, actions:[{label:'Close', value:null}]});
  // attach handlers (the sheet already closed; reopen handlers via direct clicks before close)
};

/* Simpler always-on settings handler: intercept clicks on [data-mw-settings] */
document.addEventListener('click', async e=>{
  const t = e.target.closest('[data-mw-settings]');
  if(!t) return;
  e.preventDefault();
  const auth = window.firebaseAuth, db = window.firebaseDB, user = window.currentUser;
  const choice = await sheet({title:'⚙️ Settings', actions:[
    {label:'🌐 Change language', value:'lang'},
    {label:'🚫 Blocked users', value:'blocked'},
    {label:'📋 My activity', value:'activity'},
    {label:'📥 Install Messenger app', value:'mess'},
    {label:'🔒 Privacy policy', value:'privacy'},
    {label:'📄 Terms of service', value:'terms'},
    {label:'↪ Log out', value:'logout', variant:'danger'},
    {label:'Close', value:null}
  ]});
  if(choice==='lang'){
    const lang = await sheet({title:'Language', actions:[
      {label:'English', value:'en'},{label:'বাংলা', value:'bn'},{label:'हिन्दी', value:'hi'},
      {label:'العربية', value:'ar'},{label:'Español', value:'es'},{label:'Français', value:'fr'},{label:'اردو', value:'ur'},{label:'Cancel', value:null}
    ]});
    if(lang){ applyLang(lang); toast('Language updated','success'); }
  } else if(choice==='logout'){
    if(await confirmSheet('Log out?','You will need to sign in again.')){
      try{ const {signOut} = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js'); await signOut(auth); }catch{}
      location.href='./index.html';
    }
  } else if(choice==='privacy'){ location.href='./privacy.html'; }
   else if(choice==='terms'){ location.href='./terms.html'; }
   else if(choice==='mess'){ location.href='./messenger.html'; }
   else if(choice==='activity'){
    if(!db||!user){ toast('Sign in first','error'); return; }
    const { collection, query, where, orderBy, limit, getDocs } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
    try{
      const snap = await getDocs(query(collection(db,'activity'), where('uid','==',user.uid), orderBy('at','desc'), limit(50)));
      const html = snap.docs.length ? snap.docs.map(d=>{ const a=d.data(); return `<div style="padding:10px;border-bottom:1px solid rgba(255,255,255,.08)"><b>${a.action}</b><div style="color:#94a3b8;font-size:12px">${a.city||''} ${a.country||''} · ${a.at?.toDate?.().toLocaleString?.()||''}</div></div>`; }).join('') : '<div style="color:#94a3b8">No activity yet.</div>';
      await sheet({title:'My activity', body: html, actions:[{label:'Close', value:null}]});
    }catch(e){ toast('Could not load activity','error'); }
  } else if(choice==='blocked'){
    if(!db||!user){ toast('Sign in first','error'); return; }
    const { doc, getDoc, updateDoc, arrayRemove } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
    const me = (await getDoc(doc(db,'users',user.uid))).data() || {};
    const list = me.blocked || [];
    if(!list.length){ await sheet({title:'Blocked users', body:'You have not blocked anyone.', actions:[{label:'Close', value:null}]}); return; }
    const body = document.createElement('div');
    for(const uid of list){
      const u = (await getDoc(doc(db,'users',uid))).data() || {name:uid};
      const row = document.createElement('div');
      row.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:10px;border-bottom:1px solid rgba(255,255,255,.08)';
      row.innerHTML = `<span>${u.name||u.displayName||'User'}</span>`;
      const btn = document.createElement('button');
      btn.textContent='Unblock';
      btn.style.cssText='background:#10b981;color:#fff;border:none;padding:6px 12px;border-radius:8px;cursor:pointer';
      btn.onclick = async ()=>{ await updateDoc(doc(db,'users',user.uid),{blocked: arrayRemove(uid)}); row.remove(); toast('Unblocked','success'); };
      row.appendChild(btn); body.appendChild(row);
    }
    await sheet({title:'Blocked users', body, actions:[{label:'Close', value:null}]});
  }
});

/* ---------- Modernize old confirm/prompt for post edit/delete & comments ----------
   Existing HTML may use window.confirm / prompt — override with sheet equivalents
*/
const _confirm = window.confirm;
window.confirm = function(msg){
  // Synchronous override would block; show sheet async but still return false for safety.
  // Prefer that callers use MW.confirmSheet directly. Keep native fallback for now.
  return _confirm(msg);
};

/* ---------- Hint banner: this is the first paint helper ---------- */
console.log('%cMeetwoyou','color:#a78bfa;font-weight:bold;font-size:14px','upgrade layer v9 active');

/* Floating Settings + Upload FABs removed —
   Settings lives in the header cog, uploads live in the bottom-nav (+) button. */

/* ---------- Send welcome message on new sign-up ---------- */
window.MW.onNewUser = async (user)=>{
  try{
    if(window.firebaseDB){
      await sendWelcome(window.firebaseDB, user.uid);
      await logActivity(window.firebaseDB, user, 'signup');
    }
  }catch(e){ console.warn('welcome', e); }
};
