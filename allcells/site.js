/* AllCells shared behaviour: header + mega menu, mobile drawer, quote form (saved to the artifact database when available), filters, calculator. */
(function(){
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store={get(k){try{return localStorage.getItem(k)}catch(_){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(_){}} ,del(k){try{localStorage.removeItem(k)}catch(_){}}};

  /* ── Header ── */
  const sh=$('.sh');
  if(sh){
    const onScroll=()=>sh.classList.toggle('solid',scrollY>30); addEventListener('scroll',onScroll,{passive:true}); onScroll();
    const triggers=$$('[data-mega]',sh); let closeT;
    const closeAll=()=>{triggers.forEach(t=>{t.setAttribute('aria-expanded','false'); $('#'+t.dataset.mega).classList.remove('open');}); sh.classList.remove('menu-open');};
    const open=t=>{clearTimeout(closeT); triggers.forEach(o=>{if(o!==t){o.setAttribute('aria-expanded','false'); $('#'+o.dataset.mega).classList.remove('open');}}); t.setAttribute('aria-expanded','true'); $('#'+t.dataset.mega).classList.add('open'); sh.classList.add('menu-open');};
    triggers.forEach(t=>{
      const panel=$('#'+t.dataset.mega);
      t.addEventListener('click',()=>t.getAttribute('aria-expanded')==='true'?closeAll():open(t));
      if(matchMedia('(hover:hover)').matches){
        t.addEventListener('mouseenter',()=>open(t));
        [t,panel].forEach(el=>el.addEventListener('mouseleave',()=>{closeT=setTimeout(closeAll,180)}));
        panel.addEventListener('mouseenter',()=>clearTimeout(closeT));
      }
    });
    addEventListener('keydown',e=>{if(e.key==='Escape')closeAll()});
    document.addEventListener('click',e=>{if(!sh.contains(e.target))closeAll()});
    const burger=$('.sh-burger'), drawer=$('#drawerNav');
    if(burger&&drawer){
      burger.addEventListener('click',()=>{const o=drawer.hidden; drawer.hidden=!o; burger.setAttribute('aria-expanded',String(o)); burger.textContent=o?'Close':'Menu'; document.body.style.overflow=o?'hidden':''; sh.classList.toggle('menu-open',o);});
      $$('a',drawer).forEach(a=>a.addEventListener('click',()=>{drawer.hidden=true; burger.textContent='Menu'; burger.setAttribute('aria-expanded','false'); document.body.style.overflow=''; sh.classList.remove('menu-open');}));
    }
  }

  /* ── Filter lists (blog, webinars) ── */
  $$('[data-filter-list]').forEach(box=>{
    const input=$('input',box), chips=$$('.fchip',box), list=$(box.dataset.filterList), items=$$('[data-tags]',list), count=$('[data-count]',box);
    let tag='all';
    const apply=()=>{const q=(input?input.value:'').trim().toLowerCase(); let n=0;
      items.forEach(it=>{const ok=(tag==='all'||it.dataset.tags.split(' ').includes(tag))&&(!q||it.textContent.toLowerCase().includes(q)); it.hidden=!ok; if(ok)n++;});
      if(count) count.textContent=n+' of '+items.length;};
    input&&input.addEventListener('input',apply);
    chips.forEach(c=>c.addEventListener('click',()=>{chips.forEach(x=>x.setAttribute('aria-pressed',String(x===c))); tag=c.dataset.tag; apply();}));
    apply();
  });

  /* ── Hemacytometer calculator ── */
  const calc=$('#calc');
  if(calc){
    const f=id=>parseFloat($('#'+id,calc).value)||0;
    const run=()=>{const live=f('cLive'),dead=f('cDead'),q=Math.max(1,f('cQuad')),dil=Math.max(1,f('cDil')),vol=f('cVol');
      const conc=(live/q)*dil*1e4, via=live+dead?live/(live+dead)*100:0, total=conc*vol;
      const fmt=n=>n>=1e9?(n/1e9).toFixed(2)+' B':n>=1e6?(n/1e6).toFixed(2)+' M':n>=1e3?(n/1e3).toFixed(1)+' K':n.toFixed(0);
      $('#oConc',calc).textContent=fmt(conc)+' /mL'; $('#oVia',calc).textContent=via.toFixed(1)+' %'; $('#oTot',calc).textContent=vol?fmt(total)+' cells':'—';
      $('#oWarn',calc).hidden=live>=100;};
    $$('input',calc).forEach(i=>i.addEventListener('input',run)); run();
  }

  /* ── Quote form ── */
  const QKEY='ac-quote-pending';
  async function getDb(){
    if(!window.claude||typeof window.claude.use!=='function') return null;
    try{ const [db,user]=await Promise.all([window.claude.use('db'),window.claude.use('user')]); if(!db||!user) return null; const id=await user.id(); if(!id) return null; return {db,id,user}; }catch(_){return null}
  }
  async function saveQuote(rec){
    const h=await getDb(); if(!h) return {ok:false,reason:'unavailable'};
    try{
      await h.db.collection('quotes/'+h.id+'/requests').doc(rec.ref).set(rec);
      await h.db.doc('quotes/'+h.id).set({lastRef:rec.ref,lastAt:rec.submittedAt,name:rec.firstName+' '+rec.lastName,org:rec.organization});
      return {ok:true};
    }catch(e){return {ok:false,reason:(e&&e.code)||'error'}}
  }
  function summary(r){
    return ['AllCells quote request '+r.ref,'',
      'Name: '+r.firstName+' '+r.lastName,'Email: '+r.email,'Organization: '+r.organization,'Country: '+r.country,(r.phone?'Phone: '+r.phone:null),'',
      'Product: '+r.product,'Grade: '+r.grade,'Format: '+r.format,'Quantity: '+(r.quantity||'—'),'Needed by: '+(r.neededBy||'Flexible'),
      'Donor requirements: '+(r.donor.length?r.donor.join(', '):'None'),'',
      'Project details:',r.details||'—'].filter(x=>x!==null).join('\n');
  }
  function showDone(form,rec,saved){
    const box=document.createElement('div'); box.className='qf-done'; box.setAttribute('role','status'); box.tabIndex=-1;
    box.innerHTML=saved
      ? `<span class="ref">${rec.ref}</span><h3>Request received.</h3><p>A CGT specialist will reply to <b></b> within one business day with pricing and lead time. Keep the reference above for follow-up.</p><div><button class="btn btn-ghost btn-sm" type="button" data-again>Send another request</button></div>`
      : `<span class="ref">${rec.ref}</span><h3>Almost there: send it by email.</h3><p>This view can't save requests directly. Copy the request below and email it to <b>support@dls.com</b>, or open this site from the AllCells link while signed in.</p><pre></pre><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-primary btn-sm" type="button" data-copy>Copy request</button><button class="btn btn-ghost btn-sm" type="button" data-again>Edit request</button></div>`;
    if(saved) $('b',box).textContent=rec.email; else $('pre',box).textContent=summary(rec);
    form.hidden=true; form.after(box); box.focus();
    const cp=$('[data-copy]',box); cp&&cp.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(summary(rec)); cp.textContent='Copied';}catch(_){const r=document.createRange(); r.selectNodeContents($('pre',box)); const s=getSelection(); s.removeAllRanges(); s.addRange(r); cp.textContent='Selected, press Copy';}});
    $('[data-again]',box).addEventListener('click',()=>{box.remove(); form.hidden=false; if(saved) form.reset(); });
  }
  function collect(form){
    const v=n=>{const el=form.elements[n]; return el?String(el.value||'').trim():''};
    return {ref:'AC-'+Date.now().toString(36).toUpperCase().slice(-6)+'-'+Math.random().toString(36).slice(2,5).toUpperCase(),
      submittedAt:new Date().toISOString(),page:document.title,
      firstName:v('firstName'),lastName:v('lastName'),email:v('email'),organization:v('organization'),country:v('country'),phone:v('phone'),
      product:v('product'),grade:(form.querySelector('input[name=grade]:checked')||{}).value||'',format:(form.querySelector('input[name=format]:checked')||{}).value||'',
      quantity:v('quantity'),neededBy:v('neededBy'),donor:$$('input[name=donor]:checked',form).map(i=>i.value),details:v('details')};
  }
  function validate(form){
    let ok=true, first=null;
    $$('[required]',form).forEach(el=>{
      const err=el.closest('label')&&el.closest('label').querySelector('.err');
      let msg='';
      if(el.type==='checkbox'){ if(!el.checked) msg='Please confirm to continue.'; }
      else if(!el.value.trim()) msg='Required.';
      else if(el.type==='email'&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.value.trim())) msg='Enter a work email like name@company.com.';
      el.setAttribute('aria-invalid',msg?'true':'false'); if(err) err.textContent=msg;
      if(msg){ok=false; first=first||el;}
    });
    if(first) first.focus();
    return ok;
  }
  $$('form.qf').forEach(form=>{
    const pre=form.dataset.product; if(pre&&form.elements.product) form.elements.product.value=pre;
    const g=form.dataset.grade; if(g){const r=form.querySelector('input[name=grade][value="'+g+'"]'); if(r) r.checked=true;}
    $$('input,select,textarea',form).forEach(el=>el.addEventListener('input',()=>{ if(el.getAttribute('aria-invalid')==='true'){el.setAttribute('aria-invalid','false'); const e=el.closest('label')&&el.closest('label').querySelector('.err'); if(e) e.textContent='';}}));
    form.addEventListener('submit',async e=>{
      e.preventDefault(); if(!validate(form)) return;
      const btn=$('button[type=submit]',form), label=btn.textContent; btn.disabled=true; btn.textContent='Sending…';
      const rec=collect(form); const res=await saveQuote(rec);
      btn.disabled=false; btn.textContent=label;
      if(res.ok){ showDone(form,rec,true); return; }
      // Subpages may not carry the runtime: hand the request to the home page, which saves it.
      if(res.reason==='unavailable' && !document.body.classList.contains('home')){ store.set(QKEY,JSON.stringify(rec)); location.href='./#quote'; return; }
      showDone(form,rec,false);
    });
  });
  // Home page: finish a request handed over from an inner page.
  if(document.body.classList.contains('home')){
    const raw=store.get(QKEY);
    if(raw){ let rec=null; try{rec=JSON.parse(raw)}catch(_){}
      store.del(QKEY);
      const form=$('#quote form.qf');
      if(rec&&form){ (async()=>{ const res=await saveQuote(rec); showDone(form,rec,res.ok); const q=$('#quote'); q&&q.scrollIntoView({behavior:reduce?'auto':'smooth'}); })(); }
    }
  }

  /* ── Owner inbox on the quote page ── */
  const inbox=$('#inbox');
  if(inbox){ (async()=>{
    const h=await getDb(); if(!h) return;
    let owner=false; try{owner=await h.user.isOwner()}catch(_){}
    if(!owner) return;
    inbox.hidden=false; const list=$('.list',inbox);
    try{
      const people=await h.db.collection('quotes').orderBy('lastAt','desc').limit(50).get();
      if(people.empty){ list.innerHTML='<p>No requests yet. New submissions appear here for you only.</p>'; return; }
      const rows=[];
      for(const p of people.docs){ const reqs=await h.db.collection('quotes/'+p.id+'/requests').orderBy('submittedAt','desc').limit(20).get(); reqs.docs.forEach(d=>rows.push(d.data())); }
      rows.sort((a,b)=>String(b.submittedAt).localeCompare(String(a.submittedAt)));
      list.innerHTML=''; rows.forEach(r=>{ const el=document.createElement('div'); el.className='item';
        el.innerHTML='<div class="top"><b></b><span></span></div><div class="mono" style="color:var(--amber)"></div><p></p>';
        $('b',el).textContent=(r.firstName||'')+' '+(r.lastName||'')+' · '+(r.organization||''); $('span',el).textContent=(r.ref||'')+' · '+new Date(r.submittedAt).toLocaleString();
        $('.mono',el).textContent=[r.product,r.grade,r.format,r.quantity].filter(Boolean).join(' · ');
        $('p',el).textContent=(r.email||'')+(r.details?' — '+r.details:''); list.appendChild(el); });
    }catch(_){ list.innerHTML='<p>Couldn\'t load requests right now. Reload the page to try again.</p>'; }
  })(); }
})();
