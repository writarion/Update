/* Meetwoyou final professional polish
   - Install prompts for main app, Messenger and Admin
   - Functional block / unblock manager
   - Modern action sheets for comments, messages and settings helpers
   - Responsive polish and offline-first caching helpers
*/

const FS_URL = 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const injectFinalStyle = () => {
  if (document.getElementById('mw-final-style')) return;
  const css = document.createElement('style');
  css.id = 'mw-final-style';
  css.textContent = `
    :root{--mw-radius:18px;--mw-soft:rgba(255,255,255,.06);--mw-line:rgba(255,255,255,.1)}
    .mw-install-chip{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--mw-line);background:linear-gradient(135deg,rgba(124,58,237,.18),rgba(14,165,233,.12));color:#fff;border-radius:999px;padding:9px 13px;font-weight:800;font-size:12px;cursor:pointer;backdrop-filter:blur(14px)}
    .mw-install-chip i{color:#a78bfa}.mw-install-chip:active{transform:scale(.97)}
    .mw-pro-card{background:linear-gradient(180deg,rgba(255,255,255,.075),rgba(255,255,255,.035));border:1px solid var(--mw-line);border-radius:var(--mw-radius);padding:14px;color:#fff;box-shadow:0 18px 45px rgba(0,0,0,.2)}
    .mw-pro-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.07)}.mw-pro-row:last-child{border-bottom:0}
    .mw-pill-btn{border:0;border-radius:999px;padding:8px 12px;font-weight:800;cursor:pointer;color:#fff;background:#334155}.mw-pill-btn.primary{background:#2563eb}.mw-pill-btn.danger{background:#dc2626}.mw-pill-btn.ok{background:#059669}
    .mw-bottom-note{font-size:12px;color:#94a3b8;line-height:1.45;margin-top:10px}
    .mw-brand-word{font-weight:900;letter-spacing:0;background:linear-gradient(90deg,#fff,#93c5fd 45%,#f0abfc);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
    @media (min-width:900px){
      body.mw-dashboard{background:radial-gradient(circle at 20% 0,rgba(37,99,235,.14),transparent 30%),#050505!important}.mw-dashboard .section{max-width:680px!important}.mw-dashboard .header{max-width:680px;margin:auto;left:0;right:0;border-left:1px solid #1f1f1f;border-right:1px solid #1f1f1f}.mw-dashboard .nav{width:680px;left:50%;transform:translateX(-50%);border-left:1px solid #1f1f1f;border-right:1px solid #1f1f1f;border-radius:22px 22px 0 0}.mw-dashboard #chat-screen,.mw-dashboard #settings-view,.mw-dashboard #notif-view,.mw-dashboard #user-profile-view,.mw-dashboard #post-detail-view,.mw-dashboard #insights-view{max-width:680px;left:50%;transform:translateX(-50%);border-left:1px solid #1f1f1f;border-right:1px solid #1f1f1f}
    }
    @media (max-width:520px){.mw-install-chip span{display:none}.mw-install-chip{padding:10px}.swal2-popup{border-radius:22px!important}.swal2-actions{gap:8px!important}.swal2-confirm,.swal2-cancel,.swal2-deny{border-radius:14px!important}}
  `;
  document.head.appendChild(css);
  if (/dashboard\.html/.test(location.pathname)) document.body.classList.add('mw-dashboard');
};

injectFinalStyle();

let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  document.querySelectorAll('[data-mw-install]').forEach((el) => (el.style.display = 'inline-flex'));
});

window.MWInstall = async function MWInstall(label = 'Meetwoyou') {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice.catch(() => null);
    deferredInstallPrompt = null;
    window.MW?.toast?.(`${label} install started`, 'success');
    return;
  }
  const body = `<div class="mw-pro-card"><b>${label} install</b><div class="mw-bottom-note">If the install popup does not appear, open your browser menu and choose <b>Add to Home Screen</b> / <b>Install app</b>. Chrome, Edge and Android show the install button when the site is opened from HTTPS.</div></div>`;
  if (window.MW?.sheet) await window.MW.sheet({ title: 'Install app', body, actions: [{ label: 'OK', value: true, variant: 'primary' }] });
  else alert('Use browser menu → Add to Home Screen / Install app.');
};

function addInstallButton(target, label) {
  const host = document.querySelector(target);
  if (!host || document.getElementById(`mw-install-${label.toLowerCase()}`)) return;
  const btn = document.createElement('button');
  btn.id = `mw-install-${label.toLowerCase()}`;
  btn.className = 'mw-install-chip';
  btn.dataset.mwInstall = label;
  btn.innerHTML = `<i class="fas fa-download"></i><span>Install ${label}</span>`;
  btn.onclick = () => window.MWInstall(label);
  host.appendChild(btn);
}

window.addEventListener('load', () => {
  if (/messenger\.html/.test(location.pathname)) addInstallButton('.head', 'Messenger');
  if (/admin\.html/.test(location.pathname)) addInstallButton('.header', 'Admin');
  if (/dashboard\.html/.test(location.pathname)) {
    document.querySelectorAll('.header h2,h1,h2.logo,.logo span').forEach((el) => {
      if ((el.textContent || '').trim().toLowerCase() === 'meetwoyou') el.classList.add('mw-brand-word');
    });
  }
});

async function fs() { return import(FS_URL); }

window.MWBlockUser = async function MWBlockUser(uid, name = 'this user') {
  const db = window.firebaseDB, me = window.currentUser || window.MWme;
  if (!db || !me || !uid) return window.MW?.toast?.('Sign in first', 'error');
  const yes = window.MW?.confirmSheet
    ? await window.MW.confirmSheet(`Block ${name}?`, 'They will no longer be able to message you, and you can unblock them from Settings.')
    : confirm(`Block ${name}?`);
  if (!yes) return;
  const { doc, updateDoc, arrayUnion } = await fs();
  await updateDoc(doc(db, 'users', me.uid), { blocked: arrayUnion(uid) });
  window.MW?.toast?.('User blocked', 'success');
  setTimeout(() => location.reload(), 600);
};

window.MWUnblockUser = async function MWUnblockUser(uid, row) {
  const db = window.firebaseDB, me = window.currentUser || window.MWme;
  if (!db || !me || !uid) return;
  const { doc, updateDoc, arrayRemove } = await fs();
  await updateDoc(doc(db, 'users', me.uid), { blocked: arrayRemove(uid) });
  row?.remove?.();
  window.MW?.toast?.('User unblocked', 'success');
};

window.MWOpenBlocked = async function MWOpenBlocked() {
  const db = window.firebaseDB, me = window.currentUser || window.MWme;
  if (!db || !me) return window.MW?.toast?.('Sign in first', 'error');
  const { doc, getDoc } = await fs();
  const mine = (await getDoc(doc(db, 'users', me.uid))).data() || {};
  const ids = mine.blocked || [];
  if (!ids.length) {
    return window.MW?.sheet?.({ title: 'Blocked users', body: '<div class="mw-pro-card">No blocked users yet.</div>', actions: [{ label: 'Close', value: null }] }) || alert('No blocked users');
  }
  const body = document.createElement('div'); body.className = 'mw-pro-card';
  for (const uid of ids) {
    let user = { displayName: uid, photoURL: './web-app-manifest-192x192.png' };
    try { user = { ...user, ...(await getDoc(doc(db, 'users', uid))).data() }; } catch {}
    const row = document.createElement('div'); row.className = 'mw-pro-row';
    row.innerHTML = `<div style="display:flex;align-items:center;gap:10px;min-width:0"><img src="${user.photoURL || './web-app-manifest-192x192.png'}" style="width:38px;height:38px;border-radius:50%;object-fit:cover"><b style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${(user.displayName || uid).replace(/[&<>"']/g, '')}</b></div>`;
    const btn = document.createElement('button'); btn.className = 'mw-pill-btn ok'; btn.textContent = 'Unblock'; btn.onclick = () => window.MWUnblockUser(uid, row);
    row.appendChild(btn); body.appendChild(row);
  }
  if (window.MW?.sheet) await window.MW.sheet({ title: 'Blocked users', body, actions: [{ label: 'Close', value: null }] });
};

// Override broken / incomplete blocked manager when dashboard defines it.
window.addEventListener('load', () => { window.manageBlocked = window.MWOpenBlocked; });

window.MWOpenActivity = async function MWOpenActivity(uid) {
  const db = window.firebaseDB, me = window.currentUser || window.MWme;
  if (!db || !me) return window.MW?.toast?.('Sign in first', 'error');
  const { collection, query, where, orderBy, limit, getDocs } = await fs();
  const target = uid || me.uid;
  let html = '<div class="mw-pro-card">No activity yet.</div>';
  try {
    const snap = await getDocs(query(collection(db, 'activity'), where('uid', '==', target), orderBy('at', 'desc'), limit(40)));
    if (!snap.empty) html = `<div class="mw-pro-card">${snap.docs.map((d) => { const a = d.data(); return `<div class="mw-pro-row"><div><b>${a.action || 'activity'}</b><div class="mw-bottom-note">${a.city || ''} ${a.country || ''} · ${a.at?.toDate?.().toLocaleString?.() || ''}</div></div></div>`; }).join('')}</div>`;
  } catch {}
  if (window.MW?.sheet) await window.MW.sheet({ title: 'Activity', body: html, actions: [{ label: 'Close', value: null }] });
};

window.MWModernMessageMenu = async function MWModernMessageMenu(mid, mine, currentText = '') {
  const db = window.firebaseDB;
  if (!db || !mid) return;
  const { doc, updateDoc, deleteDoc } = await fs();
  const choice = await window.MW.sheet({ title: 'Message options', actions: [
    { label: '❤️ React heart', value: '❤️' }, { label: '😂 React laugh', value: '😂' }, { label: '🔥 React fire', value: '🔥' },
    ...(mine ? [{ label: '✏️ Edit message', value: 'edit', variant: 'primary' }] : []),
    { label: '🗑️ Delete message', value: 'delete', variant: 'danger' }, { label: 'Cancel', value: null }
  ] });
  if (!choice) return;
  if (['❤️', '😂', '🔥'].includes(choice)) await updateDoc(doc(db, 'messages', mid), { reaction: choice });
  if (choice === 'edit') {
    const nt = prompt('Edit message', currentText || '');
    if (nt) await updateDoc(doc(db, 'messages', mid), { text: `${nt} (edited)` });
  }
  if (choice === 'delete') {
    const yes = await window.MW.confirmSheet('Delete message?', 'This message will be removed from the conversation.');
    if (yes) await deleteDoc(doc(db, 'messages', mid));
  }
};

window.MWSendOfficialBroadcast = async function MWSendOfficialBroadcast(message) {
  if (!message || !window.MW?.broadcast || !window.firebaseDB) return 0;
  try { return await window.MW.broadcast(window.firebaseDB, message); } catch { return 0; }
};

window.MWCachePost = async function MWCachePost(id, post) {
  try { await window.MW?.cachePut?.('posts', { id, ...post, text: post.text || '', image: post.img || post.image || '', video: post.video || '' }); } catch {}
};
