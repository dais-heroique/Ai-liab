/* AI Liability Gateway — interaction layer for the quiet enterprise control plane. */
(() => {
  const nav = [
    ['overview','Overview'],['agents','Agents'],['policies','Policies'],['escalations','Reviews'],['incidents','Incidents'],['audit','Audit'],['sandbox','Sandbox'],['passport','AI Passport'],['settings','Settings']
  ];

  function installCommandPalette(){
    if(document.getElementById('commandPalette')) return;
    const el=document.createElement('div');
    el.id='commandPalette';
    el.className='ux-command-backdrop hidden';
    el.innerHTML=`<div class="ux-command" role="dialog" aria-modal="true" aria-label="Command palette">
      <div class="ux-command-search"><span>⌘</span><input id="uxCommandInput" autocomplete="off" placeholder="Jump to a control, agent, policy…" /></div>
      <div class="ux-command-list" id="uxCommandList"></div>
      <div class="ux-command-footer"><span>Navigate</span><kbd>↑↓</kbd><span>Select</span><kbd>↵</kbd><span>Close</span><kbd>esc</kbd></div>
    </div>`;
    document.body.appendChild(el);
    const input=el.querySelector('#uxCommandInput');
    const list=el.querySelector('#uxCommandList');
    let index=0;
    const render=()=>{
      const q=input.value.trim().toLowerCase();
      const matches=nav.filter(([,label])=>label.toLowerCase().includes(q));
      if(!matches.length){list.innerHTML='<div class="ux-command-empty">No destination matches your search.</div>';return;}
      index=Math.min(index,matches.length-1);
      list.innerHTML=matches.map(([id,label],i)=>`<button class="ux-command-item ${i===index?'is-selected':''}" data-command="${id}"><span class="ux-command-icon">${i===index?'→':'·'}</span><span>${label}</span><span class="ux-command-key">${i+1}</span></button>`).join('');
      list.querySelectorAll('[data-command]').forEach(b=>b.onclick=()=>{navigateTo(b.dataset.command);close();});
    };
    const open=()=>{el.classList.remove('hidden');input.value='';index=0;render();requestAnimationFrame(()=>input.focus());};
    const close=()=>el.classList.add('hidden');
    window.__openCommandPalette=open; window.__closeCommandPalette=close;
    input.addEventListener('input',()=>{index=0;render();});
    input.addEventListener('keydown',e=>{const items=list.querySelectorAll('[data-command]');if(e.key==='ArrowDown'){e.preventDefault();index=Math.min(index+1,items.length-1);render();}else if(e.key==='ArrowUp'){e.preventDefault();index=Math.max(index-1,0);render();}else if(e.key==='Enter'){e.preventDefault();items[index]?.click();}else if(e.key==='Escape'){e.preventDefault();close();}});
    el.addEventListener('click',e=>{if(e.target===el)close();});
  }

  function installCustomSelects(){
    document.querySelectorAll('select').forEach(select=>{
      if(select.dataset.uxReady) return;
      select.dataset.uxReady='1';
      select.addEventListener('focus',()=>select.closest('.form-group')?.classList.add('ux-field-focus'));
      select.addEventListener('blur',()=>select.closest('.form-group')?.classList.remove('ux-field-focus'));
    });
  }

  function installKeyboardShortcuts(){
    document.addEventListener('keydown',e=>{
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();window.__openCommandPalette?.();return;}
      if(e.key==='Escape') window.__closeCommandPalette?.();
    });
  }

  function installSearchButton(){
    const bar=document.getElementById('globalSearchBar');
    if(!bar||bar.dataset.uxReady) return;
    bar.dataset.uxReady='1';
    bar.setAttribute('role','button');bar.setAttribute('tabindex','0');bar.setAttribute('aria-label','Open command palette');
    const open=()=>window.__openCommandPalette?.();
    bar.addEventListener('click',open);bar.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
  }

  function improveCopy(){
    const title=document.querySelector('#view-overview .page-title');
    const sub=document.querySelector('#view-overview .page-subtitle');
    if(title) title.textContent='Fleet';
    if(sub) sub.textContent='Operational control across your AI agents.';
    const overviewActions=document.querySelector('#view-overview .page-actions');
    if(overviewActions){
      const primary=overviewActions.querySelector('.btn-primary span');
      if(primary) primary.textContent='Deploy agent';
      const secondary=overviewActions.querySelector('.btn-secondary span');
      if(secondary) secondary.textContent='Evaluate action';
    }
  }

  document.addEventListener('DOMContentLoaded',()=>{
    installCommandPalette();
    installSearchButton();
    installKeyboardShortcuts();
    installCustomSelects();
    improveCopy();
    const observer=new MutationObserver(()=>installCustomSelects());
    observer.observe(document.body,{subtree:true,childList:true});
  });
})();