
// Menu page: render levels; clicking a level navigates to play.html?level=N
(function(){
  const $ = (s)=>document.querySelector(s);
  const $$ = (s)=>Array.from(document.querySelectorAll(s));

  const LEVELS = 10;
  const TARGET = [null, null, 125,115,105,95,85,75,65,55,45];
  const ACTIVE_TENSE = 'Present';
  const LS_KEY = (lvl)=>`turbo_beginner_${ACTIVE_TENSE}_L${lvl}_best`;

  const getBest = (lvl)=>{
    const v = localStorage.getItem(LS_KEY(lvl));
    return v? parseInt(v,10): null;
  };
  const isUnlocked = (lvl)=>{
    if (lvl===1) return true;
    const req = TARGET[lvl];
    const prevBest = getBest(lvl-1);
    return prevBest!=null && prevBest<=req;
  };

  function lockHeader(){
    $$('#tense-buttons .tense-button').forEach(btn=>{
      const on = btn.dataset.tense===ACTIVE_TENSE;
      btn.classList.toggle('active', on);
      if (on){ btn.setAttribute('aria-disabled','true'); }
      else { btn.disabled = true; }
    });
  }

  function renderLevels(){
    const list = $('#level-list');
    list.innerHTML='';
    for (let lvl=1; lvl<=LEVELS; lvl++){
      const unlocked = isUnlocked(lvl);
      const best = getBest(lvl);
      const b = document.createElement('button');
      b.className = 'level-button' + (unlocked?'':' locked');
      b.type = 'button';
      b.innerHTML = unlocked ? (`Level ${lvl}` + (best!=null ? ` — Best: ${best}s` : '')) : '🔒';
      b.disabled = !unlocked;
      list.appendChild(b);
    }
  }

  function bindClicks(){
    $('#level-list').addEventListener('click', (e)=>{
      const btn = e.target.closest('.level-button');
      if (!btn || btn.disabled || btn.classList.contains('locked')) return;
      const m = (btn.textContent||'').match(/Level\s+(\d+)/i);
      const lvl = m ? parseInt(m[1],10) : 1;
      location.href = `play.html?level=${lvl}`;
    });
  }

  function init(){
    lockHeader();
    renderLevels();
    bindClicks();
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
