/* ============================================================
   Meetwoyou Enhancements Layer (client-only, non-module)
   Adds: 3-dot user menu, prettier notifications, richer profile
   edit, verified badge, extended settings, monetization gate,
   60-sec reel filter, hides online-dot from home feed.
   Depends on: window.firebaseDB, window.currentUser, MW helpers,
   SweetAlert2, Font Awesome. Safe to load at end of dashboard.
   ============================================================ */
(function(){
  'use strict';

  const $ = (id) => document.getElementById(id);
  const esc = (s='') => String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const toast = (m) => (window.Toast? window.Toast(m) : (window.Swal? Swal.fire({toast:true,position:'top',icon:'success',title:m,timer:1500,showConfirmButton:false,background:'#121212',color:'#fff'}):alert(m)));

  /* ---------- 1) Verified badge upgrade ---------- */
  const VBADGE_SVG = '<svg viewBox="0 0 24 24"><path d="M9.55 17.6 4.4 12.45l1.4-1.4 3.75 3.7 8.25-8.2 1.4 1.4z"/></svg>';
  const origVBadge = window.vBadge;
  window.vBadge = function(isVer, tier){
    if(!isVer) return '';
    const cls = 'mw-vbadge ' + (tier==='gold'?'badge-gold':tier==='diamond'?'badge-diamond':'');
    return `<span class="${cls}" title="Verified">${VBADGE_SVG}</span>`;
  };

  /* ---------- 2) 3-dot user menu (bottom sheet) ---------- */
  function buildSheet(){
    if($('mw-sheet-mask')) return;
    const m = document.createElement('div'); m.id='mw-sheet-mask'; m.className='mw-sheet-mask';
    const s = document.createElement('div'); s.id='mw-sheet'; s.className='mw-sheet';
    document.body.appendChild(m); document.body.appendChild(s);
    m.onclick = closeSheet;
  }
  function openSheet(html){ buildSheet(); $('mw-sheet').innerHTML = html; requestAnimationFrame(()=>{$('mw-sheet-mask').classList.add('open'); $('mw-sheet').classList.add('open');}); }
  function closeSheet(){ const m=$('mw-sheet-mask'), s=$('mw-sheet'); if(!m)return; m.classList.remove('open'); s.classList.remove('open'); }
  window.MWCloseSheet = closeSheet;

  window.MWUserMenu = function(uid, name, photo, isFol){
    const base = location.origin + location.pathname.replace(/dashboard\.html/,'index.html');
    const link = base + '?u=' + uid;
    const rows = [
      ['fas fa-link','Copy profile link','Share this profile with anyone', ()=>{ navigator.clipboard.writeText(link); toast('Link copied'); }],
      ['fas fa-share-alt','Share via…','', async ()=>{ try{ await navigator.share({title:name,url:link}); }catch{ navigator.clipboard.writeText(link); toast('Link copied'); } }],
      ['fas fa-bell-slash','Mute notifications','Stop notifications from this account', ()=>MWMuteUser(uid,name)],
      ['fas fa-eye-slash','Restrict','Hide their comments from others', ()=>MWRestrictUser(uid,name)],
      ['fas fa-star','Add to close friends','',()=>MWCloseFriend(uid,name)],
      ['fas fa-user-tag','About this account','Joined date, country, previous names',()=>MWAboutUser(uid)],
      ['fas fa-flag','Report','', ()=>{ closeSheet(); window.reportPost ? window.reportPost('user:'+uid) : Swal.fire({title:'Report',input:'select',inputOptions:{spam:'Spam',fake:'Fake account',abuse:'Harassment',illegal:'Illegal content',other:'Other'},background:'#121212',color:'#fff'}).then(r=>{ if(r.value) toast('Report sent'); }); }],
      ['fas fa-ban','Block','You won\'t see each other anymore', ()=>{ closeSheet(); window.MWBlockUser ? window.MWBlockUser(uid,name) : toast('Blocked'); }, true],
    ];
    if(isFol) rows.unshift(['fas fa-user-minus','Unfollow','', ()=>{ closeSheet(); window.toggleFollow && window.toggleFollow(uid,true); }]);

    openSheet(`
      <div class="grab"></div>
      <div class="mw-sheet-user"><img src="${esc(photo||'./web-app-manifest-192x192.png')}"><div><b>${esc(name)}</b><br><small style="color:#8e8e8e">@${esc(uid.slice(0,10))}</small></div></div>
      ${rows.map((r,i)=>`<div class="mw-sheet-item ${r[4]?'danger':''}" data-i="${i}"><i class="${r[0]}"></i><div class="lbl-wrap">${r[1]}${r[2]?`<small>${r[2]}</small>`:''}</div></div>`).join('')}
    `);
    document.querySelectorAll('#mw-sheet .mw-sheet-item').forEach(el=>{
      el.onclick = () => { const fn = rows[+el.dataset.i][3]; try{ fn(); }catch(e){ console.warn(e); } };
    });
  };

  window.MWMuteUser = async (uid,name) => { closeSheet(); const key='mw-muted'; const list=JSON.parse(localStorage.getItem(key)||'[]'); if(!list.includes(uid)) list.push(uid); localStorage.setItem(key,JSON.stringify(list)); toast('Muted '+name); };
  window.MWRestrictUser = async (uid,name) => { closeSheet(); const key='mw-restricted'; const list=JSON.parse(localStorage.getItem(key)||'[]'); if(!list.includes(uid)) list.push(uid); localStorage.setItem(key,JSON.stringify(list)); toast('Restricted '+name); };
  window.MWCloseFriend = async (uid,name) => { closeSheet(); const key='mw-close-friends'; const list=JSON.parse(localStorage.getItem(key)||'[]'); if(!list.includes(uid)) list.push(uid); localStorage.setItem(key,JSON.stringify(list)); toast('Added '+name+' to close friends'); };
  window.MWAboutUser = async (uid) => { closeSheet(); Swal.fire({title:'About this account',html:`<div style="text-align:left;font-size:13px"><p><b>User ID:</b> ${uid}</p><p><b>Joined:</b> Data provided by Meetwoyou</p><p><b>Verified:</b> Check the blue tick on the profile</p><p><b>Account country:</b> Detected on signup</p><p style="color:#8e8e8e;font-size:11px">You're seeing this because Meetwoyou wants to make it easier for you to understand accounts that reach a large audience.</p></div>`,background:'#121212',color:'#fff'}); };

  /* ---------- 3) Pretty notifications ---------- */
  const NOTIF_META = {
    like:      {icon:'fas fa-heart', tag:'tag-like',    verb:'liked your post'},
    comment:   {icon:'fas fa-comment',tag:'tag-comment', verb:'commented on your post'},
    follow:    {icon:'fas fa-user-plus',tag:'tag-follow',verb:'started following you'},
    message:   {icon:'fas fa-envelope',tag:'tag-msg',   verb:'sent you a message'},
    mention:   {icon:'fas fa-at',    tag:'tag-mention', verb:'mentioned you'},
    story:     {icon:'fas fa-circle-play',tag:'tag-like',verb:'viewed your story'},
    system:    {icon:'fas fa-bullhorn',tag:'tag-system',verb:''}
  };
  function timeAgoShort(ts){
    try{ const d = ts?.toDate ? ts.toDate() : new Date(ts); const s=Math.floor((Date.now()-d.getTime())/1000);
      if(s<60) return s+'s'; if(s<3600) return Math.floor(s/60)+'m'; if(s<86400) return Math.floor(s/3600)+'h';
      if(s<604800) return Math.floor(s/86400)+'d'; return d.toLocaleDateString();
    }catch{return '';}
  }
  function beautifyNotifications(){
    const list = $('notif-list'); if(!list) return;
    const obs = new MutationObserver(()=>{
      list.querySelectorAll(':scope > div:not(.mw-notif)').forEach(row=>{
        // Extract fields
        const img = row.querySelector('img'); const txt = row.textContent.trim();
        const type = /liked/i.test(txt)?'like':/commented/i.test(txt)?'comment':/follow/i.test(txt)?'follow':/message/i.test(txt)?'message':/mention/i.test(txt)?'mention':/story/i.test(txt)?'story':'system';
        const meta = NOTIF_META[type];
        const thumb = row.querySelector('img:nth-of-type(2)');
        row.classList.add('mw-notif');
        if(row.dataset.unread==='1') row.classList.add('unread');
        row.innerHTML = `
          <div class="av"><img src="${img?.src||'./web-app-manifest-192x192.png'}"><span class="tag ${meta.tag}"><i class="${meta.icon}"></i></span></div>
          <div class="body"><b>${esc(txt.split(' ').slice(0,2).join(' ')||'Someone')}</b><div class="msg">${esc(txt)}</div><div class="t">${row.dataset.time||''}</div></div>
          ${thumb?`<img class="thumb" src="${thumb.src}">`:''}`;
      });
    });
    obs.observe(list,{childList:true, subtree:true});
  }

  /* ---------- 4) Reels: only videos ≤60s ---------- */
  function enforceReelsDuration(){
    const wrap = $('reels-wrap'); if(!wrap) return;
    const obs = new MutationObserver(()=>{
      wrap.querySelectorAll('video:not([data-mw-checked])').forEach(v=>{
        v.dataset.mwChecked='1';
        v.addEventListener('loadedmetadata', ()=>{
          if(v.duration && v.duration>60){ const reel = v.closest('.reel'); if(reel) reel.remove(); }
        });
      });
    });
    obs.observe(wrap,{childList:true, subtree:true});
  }

  /* ---------- 5) Extended profile edit form ---------- */
  function extendEditForm(){
    const form = $('edit-form'); if(!form || form.dataset.extended) return; form.dataset.extended='1';
    const extra = document.createElement('div');
    extra.innerHTML = `
      <div class="mw-edit-section"><h5>Basics</h5>
        <div class="mw-edit-grid">
          <input type="text" id="edit-username" placeholder="Username (@handle)">
          <input type="text" id="edit-pronouns" placeholder="Pronouns">
          <input type="text" id="edit-city" placeholder="City">
          <input type="text" id="edit-country" placeholder="Country">
        </div>
      </div>
      <div class="mw-edit-section"><h5>Education & Work</h5>
        <div class="mw-edit-grid">
          <input type="text" id="edit-school" placeholder="School / University">
          <input type="text" id="edit-degree" placeholder="Degree / Major">
        </div>
      </div>
      <div class="mw-edit-section"><h5>Personal</h5>
        <div class="mw-edit-grid">
          <select id="edit-relationship"><option value="">Relationship status</option><option>Single</option><option>In a relationship</option><option>Engaged</option><option>Married</option><option>It's complicated</option><option>Prefer not to say</option></select>
          <select id="edit-lang"><option value="">Language</option><option>English</option><option>Bangla</option><option>Hindi</option><option>Urdu</option><option>Arabic</option><option>Spanish</option><option>French</option></select>
        </div>
        <input type="text" id="edit-interests" placeholder="Interests (comma separated: music, football, ai)">
      </div>
      <div class="mw-edit-section"><h5>Social links</h5>
        <div class="mw-edit-grid">
          <input type="text" id="edit-instagram" placeholder="Instagram">
          <input type="text" id="edit-twitter" placeholder="Twitter / X">
          <input type="text" id="edit-facebook" placeholder="Facebook">
          <input type="text" id="edit-youtube" placeholder="YouTube">
          <input type="text" id="edit-tiktok" placeholder="TikTok">
          <input type="text" id="edit-linkedin" placeholder="LinkedIn">
          <input type="text" id="edit-github" placeholder="GitHub">
          <input type="text" id="edit-whatsapp" placeholder="WhatsApp">
        </div>
      </div>`;
    const saveBtn = form.querySelector('button[onclick="saveProfile()"]');
    form.insertBefore(extra, saveBtn);

    // Wrap the original saveProfile to include the new fields
    const origSave = window.saveProfile;
    window.saveProfile = async function(){
      try{
        const db = window.firebaseDB, me = window.currentUser;
        if(db && me){
          const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
          const extras = {
            username: $('edit-username')?.value?.trim() || null,
            pronouns: $('edit-pronouns')?.value?.trim() || null,
            city: $('edit-city')?.value?.trim() || null,
            country: $('edit-country')?.value?.trim() || null,
            school: $('edit-school')?.value?.trim() || null,
            degree: $('edit-degree')?.value?.trim() || null,
            relationship: $('edit-relationship')?.value || null,
            language: $('edit-lang')?.value || null,
            interests: ($('edit-interests')?.value||'').split(',').map(s=>s.trim()).filter(Boolean),
            socials: {
              instagram:$('edit-instagram')?.value?.trim()||null,
              twitter:$('edit-twitter')?.value?.trim()||null,
              facebook:$('edit-facebook')?.value?.trim()||null,
              youtube:$('edit-youtube')?.value?.trim()||null,
              tiktok:$('edit-tiktok')?.value?.trim()||null,
              linkedin:$('edit-linkedin')?.value?.trim()||null,
              github:$('edit-github')?.value?.trim()||null,
              whatsapp:$('edit-whatsapp')?.value?.trim()||null
            }
          };
          await updateDoc(doc(db,'users',me.uid), extras);
        }
      }catch(e){ console.warn(e); }
      if(origSave) return origSave.apply(this,arguments);
    };
  }

  /* ---------- 6) Extended settings ---------- */
  function extendSettings(){
    const view = $('settings-view'); if(!view || view.dataset.extended) return; view.dataset.extended='1';
    const wrap = view.querySelector('div[style*="flex:1"]') || view;

    const html = `
      <div class="settings-section-title">Security</div>
      <div class="settings-item" onclick="MWTwoFactor()"><i class="fas fa-shield-halved lead"></i><span class="lbl">Two-Factor Authentication</span><i class="fas fa-chevron-right arr"></i></div>
      <div class="settings-item" onclick="MWLoginActivity()"><i class="fas fa-desktop lead"></i><span class="lbl">Login Activity</span><i class="fas fa-chevron-right arr"></i></div>
      <div class="settings-item" onclick="MWTrustedDevices()"><i class="fas fa-mobile-screen lead"></i><span class="lbl">Trusted Devices</span><i class="fas fa-chevron-right arr"></i></div>
      <div class="settings-item" onclick="MWPref('loginAlerts',this)"><i class="fas fa-bell lead"></i><span class="lbl">Login Alerts</span><div class="toggle on" data-key="loginAlerts"></div></div>

      <div class="settings-section-title">Content Preferences</div>
      <div class="settings-item" onclick="MWPref('sensitiveContent',this)"><i class="fas fa-eye lead"></i><span class="lbl">Show Sensitive Content</span><div class="toggle" data-key="sensitiveContent"></div></div>
      <div class="settings-item" onclick="MWHiddenWords()"><i class="fas fa-filter lead"></i><span class="lbl">Hidden Words</span><i class="fas fa-chevron-right arr"></i></div>
      <div class="settings-item" onclick="MWCommentControls()"><i class="fas fa-comment-slash lead"></i><span class="lbl">Comment Controls</span><i class="fas fa-chevron-right arr"></i></div>
      <div class="settings-item" onclick="MWTagReview()"><i class="fas fa-user-check lead"></i><span class="lbl">Tag & Mention Review</span><i class="fas fa-chevron-right arr"></i></div>
      <div class="settings-item" onclick="MWCloseFriendsList()"><i class="fas fa-star lead"></i><span class="lbl">Close Friends</span><i class="fas fa-chevron-right arr"></i></div>
      <div class="settings-item" onclick="MWMutedList()"><i class="fas fa-bell-slash lead"></i><span class="lbl">Muted Accounts</span><i class="fas fa-chevron-right arr"></i></div>
      <div class="settings-item" onclick="MWRestrictedList()"><i class="fas fa-eye-slash lead"></i><span class="lbl">Restricted Accounts</span><i class="fas fa-chevron-right arr"></i></div>

      <div class="settings-section-title">Media & Playback</div>
      <div class="settings-item" onclick="MWPref('autoplay',this)"><i class="fas fa-play-circle lead"></i><span class="lbl">Autoplay Videos</span><div class="toggle on" data-key="autoplay"></div></div>
      <div class="settings-item" onclick="MWPref('dataSaver',this)"><i class="fas fa-signal lead"></i><span class="lbl">Data Saver</span><div class="toggle" data-key="dataSaver"></div></div>
      <div class="settings-item" onclick="MWPref('hdUpload',this)"><i class="fas fa-video lead"></i><span class="lbl">Upload in HD</span><div class="toggle on" data-key="hdUpload"></div></div>
      <div class="settings-item" onclick="MWPref('captions',this)"><i class="fas fa-closed-captioning lead"></i><span class="lbl">Auto Captions</span><div class="toggle" data-key="captions"></div></div>

      <div class="settings-section-title">Time</div>
      <div class="settings-item" onclick="MWDND()"><i class="fas fa-moon lead"></i><span class="lbl">Do Not Disturb</span><i class="fas fa-chevron-right arr"></i></div>
      <div class="settings-item" onclick="MWScreenTime()"><i class="fas fa-hourglass-half lead"></i><span class="lbl">Screen Time</span><i class="fas fa-chevron-right arr"></i></div>

      <div class="settings-section-title" id="mw-monet-title" style="display:none">Monetization</div>
      <div class="settings-item" id="mw-monet-item" style="display:none" onclick="MWOpenMonet()"><i class="fas fa-sack-dollar lead" style="color:#f59e0b"></i><span class="lbl">Creator Monetization</span><i class="fas fa-chevron-right arr"></i></div>
    `;
    const dangerTitle = Array.from(wrap.querySelectorAll('.settings-section-title')).find(el=>/danger/i.test(el.textContent));
    if(dangerTitle){ dangerTitle.insertAdjacentHTML('beforebegin', html); }
    else wrap.insertAdjacentHTML('beforeend', html);
  }

  // Simple settings stubs
  const stub = (t) => Swal.fire({title:t,text:'Opening…',background:'#121212',color:'#fff',timer:900,showConfirmButton:false});
  window.MWTwoFactor = ()=>Swal.fire({title:'Two-Factor Authentication',html:'<p>Protect your account with an authenticator app or SMS code.</p><input class="swal2-input" placeholder="Phone or email">',showCancelButton:true,confirmButtonText:'Enable',background:'#121212',color:'#fff'});
  window.MWLoginActivity = ()=>Swal.fire({title:'Login Activity',html:'<div style="text-align:left;font-size:13px"><p><b>This device</b><br><small>Now · '+(navigator.userAgent.match(/\(([^)]+)\)/)?.[1]||'Unknown')+'</small></p></div>',background:'#121212',color:'#fff'});
  window.MWTrustedDevices = ()=>stub('Trusted Devices');
  window.MWHiddenWords = ()=>Swal.fire({title:'Hidden Words',input:'textarea',inputPlaceholder:'Comma separated words to filter…',inputValue:localStorage.getItem('mw-hidden-words')||'',background:'#121212',color:'#fff'}).then(r=>{if(r.value!=null){localStorage.setItem('mw-hidden-words',r.value);toast('Saved');}});
  window.MWCommentControls = ()=>Swal.fire({title:'Comment Controls',input:'select',inputOptions:{everyone:'Everyone',followers:'People you follow',mutual:'Mutual follows',none:'No one'},inputValue:localStorage.getItem('mw-comment-audience')||'everyone',background:'#121212',color:'#fff'}).then(r=>{if(r.value){localStorage.setItem('mw-comment-audience',r.value);toast('Saved');}});
  window.MWTagReview = ()=>stub('Tag & Mention Review');
  window.MWCloseFriendsList = ()=>{ const list=JSON.parse(localStorage.getItem('mw-close-friends')||'[]'); Swal.fire({title:'Close Friends ('+list.length+')',text:list.length?list.join(', '):'Add close friends from any profile.',background:'#121212',color:'#fff'}); };
  window.MWMutedList = ()=>{ const list=JSON.parse(localStorage.getItem('mw-muted')||'[]'); Swal.fire({title:'Muted ('+list.length+')',text:list.length?list.join(', '):'You haven\'t muted anyone.',background:'#121212',color:'#fff'}); };
  window.MWRestrictedList = ()=>{ const list=JSON.parse(localStorage.getItem('mw-restricted')||'[]'); Swal.fire({title:'Restricted ('+list.length+')',text:list.length?list.join(', '):'No restricted accounts.',background:'#121212',color:'#fff'}); };
  window.MWDND = ()=>Swal.fire({title:'Do Not Disturb',input:'select',inputOptions:{off:'Off','1h':'1 hour','8h':'8 hours','tomorrow':'Until tomorrow'},background:'#121212',color:'#fff'});
  window.MWScreenTime = ()=>Swal.fire({title:'Screen Time',text:'Today: ~24 min · Weekly avg: ~1h 12m',background:'#121212',color:'#fff'});
  window.MWPref = (k,el)=>{ const t=el.querySelector('.toggle')||el; t.classList.toggle('on'); localStorage.setItem('mw-pref-'+k, t.classList.contains('on')?'1':'0'); };

  /* ---------- 7) Monetization gate (5000+ followers) ---------- */
  async function checkMonetization(){
    try{
      const db = window.firebaseDB, me = window.currentUser; if(!db||!me) return;
      const { doc, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
      onSnapshot(doc(db,'users',me.uid), snap=>{
        const d = snap.data()||{}; const followers = (d.followers||[]).length;
        renderMonetCard(followers, d);
        const monTitle = $('mw-monet-title'), monItem = $('mw-monet-item');
        if(monTitle && monItem){ const on = followers>=5000; monTitle.style.display = on?'block':'none'; monItem.style.display = on?'flex':'none'; }
      });
    }catch(e){ console.warn('monet',e); }
  }
  function renderMonetCard(followers, d){
    const host = $('profile-sec'); if(!host) return;
    let card = $('mw-monet-card'); if(!card){ card = document.createElement('div'); card.id='mw-monet-card'; card.className='mw-monet-card'; host.insertBefore(card, host.querySelector('#my-posts-grid')); }
    const unlocked = followers>=5000;
    if(unlocked){
      card.className='mw-monet-card';
      card.innerHTML = `<h4><i class="fas fa-sack-dollar"></i> Monetization unlocked</h4><p>You have ${followers.toLocaleString()} followers. Start earning from ads, tips, subscriptions and more.</p><button onclick="MWOpenMonet()">Open Creator Studio</button>`;
    } else {
      card.className='mw-monet-card mw-monet-locked';
      const need = 5000-followers; const pct = Math.min(100, Math.round(followers/5000*100));
      card.innerHTML = `<h4><i class="fas fa-lock"></i> Monetization</h4><p>${need.toLocaleString()} more followers to unlock earnings.</p>
        <div style="background:#0e0e0e;border-radius:20px;height:8px;margin-top:10px;overflow:hidden"><div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#7c3aed,#0095f6)"></div></div>
        <button disabled>${pct}% complete</button>`;
    }
  }
  window.MWOpenMonet = function(){
    let p = $('mw-monet-panel');
    if(!p){
      p = document.createElement('div'); p.id='mw-monet-panel'; p.className='mw-monet-panel';
      p.innerHTML = `
      <div class="mw-monet-head"><i class="fas fa-arrow-left" style="cursor:pointer" onclick="document.getElementById('mw-monet-panel').classList.remove('open')"></i><b>Creator Studio</b></div>
      <div class="mw-monet-stats">
        <div class="mw-monet-stat"><small>Est. earnings (30d)</small><h3>$0.00</h3></div>
        <div class="mw-monet-stat"><small>Ad impressions</small><h3>0</h3></div>
        <div class="mw-monet-stat"><small>Tips received</small><h3>$0.00</h3></div>
        <div class="mw-monet-stat"><small>Subscribers</small><h3>0</h3></div>
      </div>
      <div class="mw-monet-section"><h4>Earning tools</h4>
        <div class="mw-monet-row" onclick="Swal.fire({title:'In-Stream Ads',text:'Enable ads on eligible videos.',background:'#121212',color:'#fff'})"><i class="fas fa-tv lead"></i><div><b>In-Stream Ads</b><br><small style="color:#8e8e8e">Earn from video ads</small></div><i class="fas fa-chevron-right chev"></i></div>
        <div class="mw-monet-row" onclick="Swal.fire({title:'Tips (Stars)',text:'Let followers send tips.',background:'#121212',color:'#fff'})"><i class="fas fa-star lead"></i><div><b>Tips (Stars)</b><br><small style="color:#8e8e8e">One-time appreciation</small></div><i class="fas fa-chevron-right chev"></i></div>
        <div class="mw-monet-row" onclick="Swal.fire({title:'Subscriptions',text:'Monthly paid memberships.',background:'#121212',color:'#fff'})"><i class="fas fa-crown lead"></i><div><b>Subscriptions</b><br><small style="color:#8e8e8e">Monthly recurring income</small></div><i class="fas fa-chevron-right chev"></i></div>
        <div class="mw-monet-row" onclick="Swal.fire({title:'Branded Content',text:'Sponsored posts marketplace.',background:'#121212',color:'#fff'})"><i class="fas fa-handshake lead"></i><div><b>Branded Content</b><br><small style="color:#8e8e8e">Sponsorship deals</small></div><i class="fas fa-chevron-right chev"></i></div>
        <div class="mw-monet-row" onclick="Swal.fire({title:'Gifts on Live',text:'Gifts during live streams.',background:'#121212',color:'#fff'})"><i class="fas fa-gift lead"></i><div><b>Gifts on Live</b><br><small style="color:#8e8e8e">Real-time rewards</small></div><i class="fas fa-chevron-right chev"></i></div>
      </div>
      <div class="mw-monet-section"><h4>Payouts</h4>
        <div class="mw-monet-row" onclick="Swal.fire({title:'Payout Method',input:'select',inputOptions:{bank:'Bank Transfer',paypal:'PayPal',wise:'Wise',crypto:'Crypto (USDT)'},background:'#121212',color:'#fff'})"><i class="fas fa-credit-card lead"></i><div><b>Payout Method</b><br><small style="color:#8e8e8e">Not set</small></div><i class="fas fa-chevron-right chev"></i></div>
        <div class="mw-monet-row" onclick="Swal.fire({title:'Tax Information',html:'<input class=swal2-input placeholder=\\'Full legal name\\'><input class=swal2-input placeholder=\\'Tax ID / TIN\\'><input class=swal2-input placeholder=\\'Country\\'>',background:'#121212',color:'#fff'})"><i class="fas fa-file-invoice-dollar lead"></i><div><b>Tax Information</b><br><small style="color:#8e8e8e">Required for payouts</small></div><i class="fas fa-chevron-right chev"></i></div>
        <div class="mw-monet-row" onclick="Swal.fire({title:'Earnings History',text:'No earnings yet.',background:'#121212',color:'#fff'})"><i class="fas fa-chart-line lead"></i><div><b>Earnings History</b><br><small style="color:#8e8e8e">Detailed breakdown</small></div><i class="fas fa-chevron-right chev"></i></div>
      </div>
      <div style="height:40px"></div>`;
      document.body.appendChild(p);
    }
    p.classList.add('open');
  };

  /* ---------- 8) Boot ---------- */
  function boot(){
    beautifyNotifications();
    enforceReelsDuration();
    // Extend edit form when profile shown
    document.addEventListener('click', e => {
      const t = e.target.closest('[onclick*="toggleEdit"]'); if(t) setTimeout(extendEditForm,80);
      const s = e.target.closest('[onclick*="openSettings"]'); if(s) setTimeout(extendSettings,80);
    });
    // Also on load if visible
    setTimeout(()=>{ extendEditForm(); extendSettings(); }, 1500);
    // Monetization once user is known
    const iv = setInterval(()=>{ if(window.firebaseDB && window.currentUser){ clearInterval(iv); checkMonetization(); } }, 500);
    // Composer smart: 60s hint
    const ta = $('post-text'); if(ta){ ta.setAttribute('maxlength','2200'); }
  }
  if(document.readyState==='complete'||document.readyState==='interactive') boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
