(() => {
  const nav=[['overview','Overview'],['agents','Agents'],['policies','Policies'],['escalations','Reviews'],['incidents','Incidents'],['audit','Audit'],['sandbox','Sandbox'],['passport','AI Passport'],['settings','Settings']];
  const style=document.createElement('style');
  style.textContent=`
    .ux-command-backdrop{position:fixed;inset:0;z-index:300;display:grid;place-items:start center;padding-top:13vh;background:rgba(16,20,26,.34);backdrop-filter:blur(6px)}
    .ux-command-backdrop.hidden{display:none!important}.ux-command{width:min(560px,calc(100vw - 28px));background:#fff;border:1px solid #dfe3e9;border-radius:12px;box-shadow:0 30px 90px rgba(16,24,40,.22);overflow:hidden}
    .ux-command-search{height:52px;display:flex;align-items:center;gap:10px;padding:0 16px;border-bottom:1px solid #e8ebef;color:#7d8692}.ux-command-search span{font:14px ui-monospace,monospace}.ux-command-search input{border:0!important;box-shadow:none!important;outline:0;width:100%;height:100%;font-size:13px;background:transparent}.ux-command-list{padding:7px;max-height:360px;overflow:auto}.ux-command-item{width:100%;display:flex;align-items:center;gap:10px;border:0;background:transparent;border-radius:7px;padding:9px 10px;color:#3f4752;text-align:left;font-size:11px}.ux-command-item:hover,.ux-command-item.is-selected{background:#f2f5f8;color:#171a1f}.ux-command-icon{width:17px;color:#7d8793;font-family:ui-monospace,monospace}.ux-command-key{margin-left:auto;color:#a0a7b1;font:9px ui-monospace,monospace}.ux-command-empty{padding:28px 12px;text-align:center;color:#8a929d;font-size:10px}.ux-command-footer{display:flex;align-items:center;gap:7px;padding:9px 12px;border-top:1px solid #e8ebef;color:#8b939e;font-size:8px}.ux-command-footer kbd{font:8px ui-monospace,monospace;border:1px solid #dfe3e9;border-radius:4px;padding:2px 5px;background:#fafbfc}
    .global-search-bar[role=button]{cursor:pointer}.global-search-bar[role=button] input{pointer-events:none}.form-group.ux-field-focus label{color:#1d4ed8}.nav-item[data-view=actions],.nav-item[data-view=risk]{display:none}
  `;
  document.documentElement.appendChild(style);

  function installPalette(){
    if(document.getElementById('commandPalette')) return;
    const el=document.createElement('div');el.id='commandPalette';el.className='ux-command-backdrop hidden';
    el.innerHTML='<div class="ux-command" role="dialog" aria-modal="true" aria-label="Command palette"><div class="ux-command-search"><span>⌘</span><input id="uxCommandInput" autocomplete="off" placeholder="Jump to a control, agent, policy…"></div><div class="ux-command-list" id="uxCommandList"></div><div class="ux-command-footer"><span>Navigate</span><kbd>↑↓</kbd><span>Select</span><kbd>↵</kbd><span>Close</span><kbd>Esc</kbd></div></div>';
    document.body.appendChild(el);
    const input=el.querySelector('#uxCommandInput'),list=el.querySelector('#uxCommandList');let index=0;
    const render=()=>{const q=input.value.trim().toLowerCase();const matches=nav.filter(([,label])=>label.toLowerCase().includes(q));index=Math.max(0,Math.min(index,matches.length-1));list.innerHTML=matches.length?matches.map(([id,label],i)=>`<button class="ux-command-item ${i===index?'is-selected':''}" data-command="${id}"><span class="ux-command-icon">${i===index?'→':'·'}</span><span>${label}</span><span class="ux-command-key">${i+1}</span></button>`).join(''):'<div class="ux-command-empty">No destination matches your search.</div>';list.querySelectorAll('[data-command]').forEach(b=>b.onclick=()=>{navigateTo(b.dataset.command);close();});};
    const open=()=>{el.classList.remove('hidden');input.value='';index=0;render();requestAnimationFrame(()=>input.focus());};const close=()=>el.classList.add('hidden');window.__openCommandPalette=open;window.__closeCommandPalette=close;
    input.oninput=()=>{index=0;render()};input.onkeydown=e=>{const items=list.querySelectorAll('[data-command]');if(e.key==='ArrowDown'){e.preventDefault();index=Math.min(index+1,items.length-1);render()}else if(e.key==='ArrowUp'){e.preventDefault();index=Math.max(index-1,0);render()}else if(e.key==='Enter'){e.preventDefault();items[index]?.click()}else if(e.key==='Escape')close()};el.onclick=e=>{if(e.target===el)close()};
  }
  function install(){
    installPalette();
    const bar=document.getElementById('globalSearchBar');if(bar&&!bar.dataset.ux){bar.dataset.ux='1';bar.setAttribute('role','button');bar.setAttribute('tabindex','0');bar.setAttribute('aria-label','Open command palette');bar.onclick=()=>window.__openCommandPalette?.();bar.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();window.__openCommandPalette?.()}}}
    document.querySelectorAll('select').forEach(s=>{if(s.dataset.ux)return;s.dataset.ux='1';s.onfocus=()=>s.closest('.form-group')?.classList.add('ux-field-focus');s.onblur=()=>s.closest('.form-group')?.classList.remove('ux-field-focus')});
    const title=document.querySelector('#view-overview .page-title'),sub=document.querySelector('#view-overview .page-subtitle');if(title)title.textContent='Fleet';if(sub)sub.textContent='Operational control across your AI agents.';
  }
  document.addEventListener('DOMContentLoaded',()=>{install();document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();window.__openCommandPalette?.()}if(e.key==='Escape')window.__closeCommandPalette?.()});new MutationObserver(install).observe(document.body,{subtree:true,childList:true})});
})();