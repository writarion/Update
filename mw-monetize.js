/* ============================================================
   Meetwoyou Monetization Module (professional)
   - Overview: balance, lifetime earnings, subscribers, tips
   - Subscriptions: create/edit tiers, view subscribers
   - Earnings: itemized income history from Firestore
   - Bank Accounts: add / list / delete payout methods
   - Transfer: withdraw balance to a saved bank account
   Firestore layout (per user):
     users/{uid}.monet = { balance, lifetime, tiers[], updatedAt }
     users/{uid}/monet_income/{id}   = { type, amount, note, at }
     users/{uid}/monet_banks/{id}    = { label, holder, country, currency, iban, swift, accountNo, routing, at }
     users/{uid}/monet_payouts/{id}  = { amount, bankId, bankLabel, status, at }
     users/{uid}/monet_subs/{id}     = { subscriberUid, tierId, priceUSD, at }
   ============================================================ */
(function(){
  'use strict';
  const $ = (id)=>document.getElementById(id);
  const esc = (s='')=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmt = (n)=> '$' + (Number(n||0)).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  const toast = (m,t='success')=> window.Swal?Swal.fire({toast:true,position:'top',icon:t,title:m,timer:1800,showConfirmButton:false,background:'#121212',color:'#fff'}):alert(m);

  // Inject styles once
  const css = document.createElement('style');
  css.textContent = `
  .mw-mz{position:fixed;inset:0;background:#0a0a0a;z-index:5000;display:none;flex-direction:column;overflow-y:auto;color:#fff;font-family:inherit}
  .mw-mz.open{display:flex}
  .mw-mz-head{position:sticky;top:0;background:rgba(10,10,10,.92);backdrop-filter:blur(12px);border-bottom:1px solid #1e1e1e;display:flex;align-items:center;gap:14px;padding:14px}
  .mw-mz-head b{font-size:17px}
  .mw-mz-head i.back{cursor:pointer;font-size:18px;padding:4px}
  .mw-mz-hero{margin:16px;padding:22px;border-radius:20px;background:linear-gradient(135deg,#1e1b4b 0%,#4c1d95 55%,#7c3aed 100%);position:relative;overflow:hidden}
  .mw-mz-hero::after{content:"";position:absolute;top:-40px;right:-40px;width:200px;height:200px;background:radial-gradient(circle,rgba(236,72,153,.35),transparent 60%)}
  .mw-mz-hero small{opacity:.7;text-transform:uppercase;letter-spacing:1.5px;font-size:11px;font-weight:600}
  .mw-mz-hero h1{margin:6px 0 0;font-size:36px;font-variant-numeric:tabular-nums}
  .mw-mz-hero .row{display:flex;gap:8px;margin-top:16px;position:relative;z-index:2}
  .mw-mz-hero button{flex:1;padding:11px 14px;border-radius:12px;border:none;font-weight:700;cursor:pointer;font-size:14px;font-family:inherit}
  .mw-mz-hero .primary{background:#fff;color:#4c1d95}
  .mw-mz-hero .ghost{background:rgba(255,255,255,.15);color:#fff;backdrop-filter:blur(6px)}
  .mw-mz-tabs{display:flex;overflow-x:auto;padding:0 12px;gap:8px;border-bottom:1px solid #1e1e1e;scrollbar-width:none}
  .mw-mz-tabs::-webkit-scrollbar{display:none}
  .mw-mz-tab{padding:12px 16px;color:#8e8e8e;cursor:pointer;font-size:14px;font-weight:600;border-bottom:2px solid transparent;white-space:nowrap}
  .mw-mz-tab.on{color:#fff;border-color:#0095f6}
  .mw-mz-body{padding:14px 16px 60px}
  .mw-mz-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:16px}
  .mw-mz-stat{background:#121212;border:1px solid #1f1f1f;border-radius:14px;padding:14px}
  .mw-mz-stat small{color:#8e8e8e;font-size:11px;text-transform:uppercase;letter-spacing:.6px}
  .mw-mz-stat h3{margin:6px 0 0;font-size:20px;font-variant-numeric:tabular-nums}
  .mw-mz-list{background:#121212;border:1px solid #1f1f1f;border-radius:14px;overflow:hidden;margin-bottom:14px}
  .mw-mz-item{display:flex;align-items:center;gap:12px;padding:14px;border-bottom:1px solid #1a1a1a}
  .mw-mz-item:last-child{border-bottom:none}
  .mw-mz-item i.lead{font-size:18px;color:#a78bfa;width:22px;text-align:center}
  .mw-mz-item .body{flex:1;min-width:0}
  .mw-mz-item .body b{display:block;font-size:14px}
  .mw-mz-item .body small{color:#8e8e8e;font-size:11px}
  .mw-mz-item .amt{font-weight:700;font-variant-numeric:tabular-nums;color:#22c55e}
  .mw-mz-item .amt.neg{color:#ef4444}
  .mw-mz-empty{padding:34px 20px;text-align:center;color:#6b7280;font-size:13px}
  .mw-mz-empty i{display:block;font-size:32px;margin-bottom:10px;opacity:.5}
  .mw-mz-btn{background:#0095f6;color:#fff;border:none;padding:12px 16px;border-radius:12px;font-weight:700;cursor:pointer;font-size:14px;width:100%;font-family:inherit}
  .mw-mz-btn.secondary{background:#262626}
  .mw-mz-btn.danger{background:#dc2626}
  .mw-mz-tier{background:#121212;border:1px solid #1f1f1f;border-radius:14px;padding:14px;margin-bottom:10px}
  .mw-mz-tier .head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
  .mw-mz-tier .name{font-weight:700}
  .mw-mz-tier .price{color:#22c55e;font-weight:800;font-size:18px;font-variant-numeric:tabular-nums}
  .mw-mz-tier p{color:#8e8e8e;font-size:13px;margin:6px 0 10px}
  .mw-mz-tier .actions{display:flex;gap:8px}
  .mw-mz-tier .actions button{flex:1;background:#1a1a1a;border:1px solid #262626;color:#fff;padding:8px;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer}
  .mw-mz-tier .actions button.del{color:#ef4444;border-color:#3f1d1d}
  .mw-mz-bank{background:#121212;border:1px solid #1f1f1f;border-radius:14px;padding:14px;margin-bottom:10px}
  .mw-mz-bank .top{display:flex;align-items:center;gap:12px}
  .mw-mz-bank .top i{width:38px;height:38px;border-radius:10px;background:linear-gradient(135deg,#1e40af,#2563eb);display:flex;align-items:center;justify-content:center;font-size:16px;color:#fff}
  .mw-mz-bank .lbl{flex:1}
  .mw-mz-bank .lbl b{display:block}
  .mw-mz-bank .lbl small{color:#8e8e8e;font-size:12px}
  .mw-mz-bank .del{background:transparent;border:none;color:#ef4444;cursor:pointer;font-size:14px;padding:6px}
  .mw-mz-note{color:#8e8e8e;font-size:11px;line-height:1.5;margin:10px 4px 0}
  `;
  document.head.appendChild(css);

  let panelBuilt=false, currentTab='overview', unsub=[];
  const state = { balance:0, lifetime:0, tiers:[], subs:0, income:[], banks:[], payouts:[] };

  async function getDB(){
    const fb = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
    return fb;
  }

  function build(){
    if(panelBuilt) return;
    const p = document.createElement('div');
    p.id='mw-mz-panel'; p.className='mw-mz';
    p.innerHTML = `
      <div class="mw-mz-head">
        <i class="fas fa-arrow-left back" id="mw-mz-close"></i>
        <b>Creator Studio</b>
      </div>
      <div class="mw-mz-hero">
        <small>Available balance</small>
        <h1 id="mw-mz-balance">$0.00</h1>
        <div class="row">
          <button class="primary" id="mw-mz-withdraw"><i class="fas fa-money-bill-transfer"></i> Transfer</button>
          <button class="ghost" id="mw-mz-add-bank"><i class="fas fa-plus"></i> Add bank</button>
        </div>
      </div>
      <div class="mw-mz-tabs">
        <div class="mw-mz-tab on" data-tab="overview">Overview</div>
        <div class="mw-mz-tab" data-tab="subs">Subscriptions</div>
        <div class="mw-mz-tab" data-tab="income">Income</div>
        <div class="mw-mz-tab" data-tab="banks">Bank Accounts</div>
        <div class="mw-mz-tab" data-tab="payouts">Transfers</div>
      </div>
      <div class="mw-mz-body" id="mw-mz-body"></div>`;
    document.body.appendChild(p);
    $('mw-mz-close').onclick = close;
    $('mw-mz-withdraw').onclick = withdrawFlow;
    $('mw-mz-add-bank').onclick = addBankFlow;
    p.querySelectorAll('.mw-mz-tab').forEach(el=>{
      el.onclick = ()=>{ p.querySelectorAll('.mw-mz-tab').forEach(x=>x.classList.remove('on')); el.classList.add('on'); currentTab=el.dataset.tab; render(); };
    });
    panelBuilt = true;
  }

  function close(){ $('mw-mz-panel')?.classList.remove('open'); unsub.forEach(u=>{try{u();}catch{}}); unsub=[]; }

  async function open(){
    build();
    $('mw-mz-panel').classList.add('open');
    await subscribe();
    render();
  }

  async function subscribe(){
    const db = window.firebaseDB, me = window.currentUser;
    if(!db||!me) return;
    const { doc, onSnapshot, collection, query, orderBy, limit } = await getDB();
    unsub.push(onSnapshot(doc(db,'users',me.uid), s=>{
      const d = s.data()||{};
      const m = d.monet||{};
      state.balance = Number(m.balance||0);
      state.lifetime = Number(m.lifetime||0);
      state.tiers = Array.isArray(m.tiers)?m.tiers:[];
      $('mw-mz-balance').textContent = fmt(state.balance);
      if(currentTab==='overview'||currentTab==='subs') render();
    }));
    unsub.push(onSnapshot(query(collection(db,'users',me.uid,'monet_income'), orderBy('at','desc'), limit(50)), s=>{
      state.income = s.docs.map(d=>({id:d.id,...d.data()}));
      if(currentTab==='overview'||currentTab==='income') render();
    }));
    unsub.push(onSnapshot(collection(db,'users',me.uid,'monet_banks'), s=>{
      state.banks = s.docs.map(d=>({id:d.id,...d.data()}));
      if(currentTab==='banks'||currentTab==='overview') render();
    }));
    unsub.push(onSnapshot(query(collection(db,'users',me.uid,'monet_payouts'), orderBy('at','desc'), limit(50)), s=>{
      state.payouts = s.docs.map(d=>({id:d.id,...d.data()}));
      if(currentTab==='payouts') render();
    }));
    unsub.push(onSnapshot(collection(db,'users',me.uid,'monet_subs'), s=>{
      state.subs = s.size;
      if(currentTab==='overview'||currentTab==='subs') render();
    }));
  }

  function render(){
    const b = $('mw-mz-body'); if(!b) return;
    if(currentTab==='overview') b.innerHTML = renderOverview();
    else if(currentTab==='subs') b.innerHTML = renderSubs();
    else if(currentTab==='income') b.innerHTML = renderIncome();
    else if(currentTab==='banks') b.innerHTML = renderBanks();
    else if(currentTab==='payouts') b.innerHTML = renderPayouts();
    b.querySelectorAll('[data-act]').forEach(el=>{
      el.onclick = ()=> handleAct(el.dataset.act, el.dataset.id);
    });
  }

  function renderOverview(){
    const monthly = state.income.filter(x=>{
      const t = x.at?.toDate?x.at.toDate():new Date(x.at||0);
      return (Date.now()-t.getTime())<30*24*3600*1000;
    }).reduce((a,x)=>a+Number(x.amount||0),0);
    return `
      <div class="mw-mz-stats">
        <div class="mw-mz-stat"><small>Lifetime earnings</small><h3>${fmt(state.lifetime)}</h3></div>
        <div class="mw-mz-stat"><small>Last 30 days</small><h3>${fmt(monthly)}</h3></div>
        <div class="mw-mz-stat"><small>Subscribers</small><h3>${state.subs}</h3></div>
        <div class="mw-mz-stat"><small>Bank accounts</small><h3>${state.banks.length}</h3></div>
      </div>
      <div class="mw-mz-list">
        <div class="mw-mz-item"><i class="fas fa-crown lead"></i><div class="body"><b>Subscription tiers</b><small>${state.tiers.length} active</small></div><button class="mw-mz-btn secondary" style="width:auto;padding:8px 14px" data-act="goto-subs">Manage</button></div>
        <div class="mw-mz-item"><i class="fas fa-credit-card lead"></i><div class="body"><b>Payout methods</b><small>${state.banks.length} bank account${state.banks.length===1?'':'s'} saved</small></div><button class="mw-mz-btn secondary" style="width:auto;padding:8px 14px" data-act="goto-banks">Manage</button></div>
        <div class="mw-mz-item"><i class="fas fa-clock-rotate-left lead"></i><div class="body"><b>Recent transfers</b><small>${state.payouts.length} total</small></div><button class="mw-mz-btn secondary" style="width:auto;padding:8px 14px" data-act="goto-payouts">View</button></div>
      </div>
      <p class="mw-mz-note">Earnings from subscriptions, tips, and ad revenue are credited to your available balance. Transfer to any saved bank account. Payouts are processed within 3–5 business days.</p>`;
  }

  function renderSubs(){
    const list = state.tiers.length ? state.tiers.map(t=>`
      <div class="mw-mz-tier">
        <div class="head"><div class="name">${esc(t.name)}</div><div class="price">${fmt(t.price)}<small style="color:#8e8e8e;font-size:11px">/mo</small></div></div>
        <p>${esc(t.desc||'No description')}</p>
        <div class="actions">
          <button data-act="edit-tier" data-id="${t.id}"><i class="fas fa-pen"></i> Edit</button>
          <button class="del" data-act="del-tier" data-id="${t.id}"><i class="fas fa-trash"></i> Delete</button>
        </div>
      </div>`).join('') : `<div class="mw-mz-empty"><i class="fas fa-crown"></i>No tiers yet. Create your first subscription tier and let followers support you monthly.</div>`;
    return `${list}<button class="mw-mz-btn" data-act="add-tier"><i class="fas fa-plus"></i> New subscription tier</button>
    <p class="mw-mz-note">Subscribers get access to exclusive posts, badges next to their name in comments, and direct-message priority.</p>`;
  }

  function renderIncome(){
    if(!state.income.length) return `<div class="mw-mz-empty"><i class="fas fa-sack-dollar"></i>No earnings yet. Enable subscriptions or tips to start earning.</div>`;
    const icon = t=> t==='subscription'?'fa-crown':t==='tip'?'fa-star':t==='ad'?'fa-tv':t==='gift'?'fa-gift':'fa-coins';
    return `<div class="mw-mz-list">${state.income.map(x=>{
      const d = x.at?.toDate?x.at.toDate():new Date(x.at||0);
      return `<div class="mw-mz-item">
        <i class="fas ${icon(x.type)} lead"></i>
        <div class="body"><b>${esc(x.note||x.type||'Earning')}</b><small>${d.toLocaleDateString()} · ${d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</small></div>
        <div class="amt">+${fmt(x.amount)}</div>
      </div>`;}).join('')}</div>`;
  }

  function renderBanks(){
    const list = state.banks.length ? state.banks.map(b=>`
      <div class="mw-mz-bank">
        <div class="top">
          <i class="fas fa-university"></i>
          <div class="lbl"><b>${esc(b.label||'Bank')}</b><small>${esc(b.holder||'')} · ${esc(b.country||'')} ${b.currency?'· '+esc(b.currency):''}</small><br><small style="font-family:monospace">•••• ${esc(String(b.accountNo||'').slice(-4)||'••••')}</small></div>
          <button class="del" data-act="del-bank" data-id="${b.id}" title="Remove"><i class="fas fa-trash"></i></button>
        </div>
      </div>`).join('') : `<div class="mw-mz-empty"><i class="fas fa-university"></i>No bank accounts yet. Add one to receive transfers.</div>`;
    return `${list}<button class="mw-mz-btn" data-act="add-bank"><i class="fas fa-plus"></i> Add bank account</button>
    <p class="mw-mz-note">Bank details are stored securely in your account. Only the last 4 digits of your account number are shown.</p>`;
  }

  function renderPayouts(){
    if(!state.payouts.length) return `<div class="mw-mz-empty"><i class="fas fa-money-bill-transfer"></i>No transfers yet.</div>`;
    return `<div class="mw-mz-list">${state.payouts.map(p=>{
      const d = p.at?.toDate?p.at.toDate():new Date(p.at||0);
      const stColor = p.status==='completed'?'#22c55e':p.status==='failed'?'#ef4444':'#f59e0b';
      return `<div class="mw-mz-item">
        <i class="fas fa-money-bill-transfer lead"></i>
        <div class="body"><b>${esc(p.bankLabel||'Bank transfer')}</b><small>${d.toLocaleDateString()} · <span style="color:${stColor};text-transform:capitalize">${esc(p.status||'pending')}</span></small></div>
        <div class="amt neg">-${fmt(p.amount)}</div>
      </div>`;}).join('')}</div>`;
  }

  async function handleAct(act, id){
    if(act==='goto-subs'){ switchTab('subs'); }
    else if(act==='goto-banks'){ switchTab('banks'); }
    else if(act==='goto-payouts'){ switchTab('payouts'); }
    else if(act==='add-tier') tierForm();
    else if(act==='edit-tier') tierForm(state.tiers.find(t=>t.id===id));
    else if(act==='del-tier') delTier(id);
    else if(act==='add-bank') addBankFlow();
    else if(act==='del-bank') delBank(id);
  }
  function switchTab(t){
    currentTab=t;
    document.querySelectorAll('#mw-mz-panel .mw-mz-tab').forEach(x=>x.classList.toggle('on', x.dataset.tab===t));
    render();
  }

  async function tierForm(existing){
    if(!window.Swal) return;
    const r = await Swal.fire({
      title: existing?'Edit tier':'New subscription tier',
      html:`
        <input id="tf-name" class="swal2-input" placeholder="Tier name (e.g. Supporter)" value="${esc(existing?.name||'')}">
        <input id="tf-price" class="swal2-input" type="number" min="1" step="0.5" placeholder="Monthly price (USD)" value="${existing?.price||''}">
        <textarea id="tf-desc" class="swal2-textarea" placeholder="Perks / description">${esc(existing?.desc||'')}</textarea>`,
      showCancelButton:true, confirmButtonText: existing?'Save':'Create',
      background:'#121212', color:'#fff',
      preConfirm: ()=>{
        const name=document.getElementById('tf-name').value.trim();
        const price=parseFloat(document.getElementById('tf-price').value);
        const desc=document.getElementById('tf-desc').value.trim();
        if(!name||!(price>0)){ Swal.showValidationMessage('Name and a valid price are required'); return false; }
        return {name,price,desc};
      }
    });
    if(!r.isConfirmed) return;
    const db = window.firebaseDB, me = window.currentUser; if(!db||!me) return;
    const { doc, updateDoc, setDoc, serverTimestamp } = await getDB();
    const tiers = state.tiers.slice();
    if(existing){
      const i = tiers.findIndex(t=>t.id===existing.id);
      if(i>-1) tiers[i] = {...tiers[i], ...r.value};
    } else {
      tiers.push({id:'t_'+Date.now().toString(36), ...r.value});
    }
    await setDoc(doc(db,'users',me.uid), { monet:{ tiers, balance:state.balance, lifetime:state.lifetime, updatedAt:serverTimestamp() } }, {merge:true});
    toast(existing?'Tier updated':'Tier created');
  }

  async function delTier(id){
    if(!window.Swal) return;
    const r = await Swal.fire({title:'Delete tier?',text:'Existing subscribers keep access until their term ends.',icon:'warning',showCancelButton:true,confirmButtonText:'Delete',confirmButtonColor:'#dc2626',background:'#121212',color:'#fff'});
    if(!r.isConfirmed) return;
    const db = window.firebaseDB, me = window.currentUser;
    const { doc, setDoc, serverTimestamp } = await getDB();
    const tiers = state.tiers.filter(t=>t.id!==id);
    await setDoc(doc(db,'users',me.uid), { monet:{ tiers, balance:state.balance, lifetime:state.lifetime, updatedAt:serverTimestamp() } }, {merge:true});
    toast('Tier deleted','success');
  }

  async function addBankFlow(){
    if(!window.Swal) return;
    const r = await Swal.fire({
      title:'Add bank account',
      html:`
        <input id="bk-label" class="swal2-input" placeholder="Nickname (e.g. Personal Checking)">
        <input id="bk-holder" class="swal2-input" placeholder="Account holder full name">
        <input id="bk-country" class="swal2-input" placeholder="Country (e.g. BD, US)">
        <input id="bk-currency" class="swal2-input" placeholder="Currency (e.g. USD, BDT)">
        <input id="bk-account" class="swal2-input" placeholder="Account number / IBAN">
        <input id="bk-routing" class="swal2-input" placeholder="Routing / SWIFT / BIC (optional)">`,
      showCancelButton:true, confirmButtonText:'Add bank',
      background:'#121212', color:'#fff',
      preConfirm: ()=>{
        const v = id=>document.getElementById(id).value.trim();
        const data = { label:v('bk-label'), holder:v('bk-holder'), country:v('bk-country').toUpperCase(), currency:v('bk-currency').toUpperCase(), accountNo:v('bk-account'), routing:v('bk-routing') };
        if(!data.label||!data.holder||!data.accountNo){ Swal.showValidationMessage('Nickname, holder and account number are required'); return false; }
        return data;
      }
    });
    if(!r.isConfirmed) return;
    const db = window.firebaseDB, me = window.currentUser;
    const { collection, addDoc, serverTimestamp } = await getDB();
    await addDoc(collection(db,'users',me.uid,'monet_banks'), {...r.value, at:serverTimestamp()});
    toast('Bank account added');
  }

  async function delBank(id){
    const r = await Swal.fire({title:'Remove bank?',icon:'warning',showCancelButton:true,confirmButtonText:'Remove',confirmButtonColor:'#dc2626',background:'#121212',color:'#fff'});
    if(!r.isConfirmed) return;
    const db = window.firebaseDB, me = window.currentUser;
    const { doc, deleteDoc } = await getDB();
    await deleteDoc(doc(db,'users',me.uid,'monet_banks',id));
    toast('Bank removed');
  }

  async function withdrawFlow(){
    if(!window.Swal) return;
    if(state.balance<=0){ return toast('No balance available to transfer','info'); }
    if(!state.banks.length){ const r = await Swal.fire({title:'No bank on file',text:'Add a bank account first.',icon:'info',showCancelButton:true,confirmButtonText:'Add bank',background:'#121212',color:'#fff'}); if(r.isConfirmed) addBankFlow(); return; }
    const opts = {};
    state.banks.forEach(b=> opts[b.id] = `${b.label} · •••• ${String(b.accountNo||'').slice(-4)}`);
    const r = await Swal.fire({
      title:'Transfer to bank',
      html:`<p style="color:#8e8e8e;font-size:13px;margin:0 0 8px">Available: <b style="color:#22c55e">${fmt(state.balance)}</b></p>
        <input id="wd-amount" type="number" class="swal2-input" min="1" step="0.01" placeholder="Amount (USD)">
        <select id="wd-bank" class="swal2-select">${Object.entries(opts).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join('')}</select>`,
      showCancelButton:true, confirmButtonText:'Request transfer',
      background:'#121212', color:'#fff',
      preConfirm: ()=>{
        const amount = parseFloat(document.getElementById('wd-amount').value);
        const bankId = document.getElementById('wd-bank').value;
        if(!(amount>0)){ Swal.showValidationMessage('Enter a valid amount'); return false; }
        if(amount>state.balance){ Swal.showValidationMessage('Amount exceeds available balance'); return false; }
        return {amount, bankId};
      }
    });
    if(!r.isConfirmed) return;
    const {amount, bankId} = r.value;
    const bank = state.banks.find(b=>b.id===bankId);
    const db = window.firebaseDB, me = window.currentUser;
    const { doc, setDoc, collection, addDoc, serverTimestamp } = await getDB();
    await addDoc(collection(db,'users',me.uid,'monet_payouts'), {
      amount, bankId, bankLabel:bank?.label||'Bank', status:'pending', at:serverTimestamp()
    });
    await setDoc(doc(db,'users',me.uid), { monet:{ balance: Math.max(0,state.balance-amount), lifetime:state.lifetime, tiers:state.tiers, updatedAt:serverTimestamp() } }, {merge:true});
    toast('Transfer requested · processing in 3–5 business days');
  }

  // Public API: override the older Creator Studio panel
  window.MWOpenMonet = open;

  // If the older #mw-monet-panel exists (from mw-enhancements.js), hide it — we replace it.
  const kill = ()=>{ document.getElementById('mw-monet-panel')?.remove(); };
  if(document.readyState==='complete') kill(); else window.addEventListener('load', kill);
})();