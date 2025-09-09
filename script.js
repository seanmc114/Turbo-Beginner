
(function(){
  const $ = (s)=>document.querySelector(s);
  const $$ = (s)=>Array.from(document.querySelectorAll(s));

  // ===== CONFIG: level targets & rules (same as full game) =====
  const LEVELS = 10;
  const UNLOCK_TARGETS = [null, null, 125,115,105,95,85,75,65,55,45]; // L2=125 then -10
  const NUM_QUESTIONS = 10;
  const PENALTY_PER_MISS = 30; // +30s per incorrect/blank
  const ACTIVE_TENSE = 'Present'; // locked for now

  // ===== Data: Present only, ser & tener =====
  const SUBJECTS = [
    {en:'I',         person:'1s', esPronoun:'yo'},
    {en:'you',       person:'2s', esPronoun:'tú'},
    {en:'he',        person:'3s', esPronoun:'él'},
    {en:'she',       person:'3s', esPronoun:'ella'},
    {en:'we',        person:'1p', esPronoun:'nosotros'},
    {en:'you (pl.)', person:'2p', esPronoun:'vosotros'},
    {en:'they',      person:'3p', esPronoun:'ellos'}
  ];
  const DATA = {
    Present: {
      verbs: [
        { key:'ser', name:'ser', enBase:{'1s':'am','2s':'are','3s':'is','1p':'are','2p':'are','3p':'are'},
          esConj:{'1s':'soy','2s':'eres','3s':'es','1p':'somos','2p':'sois','3p':'son'} },
        { key:'tener', name:'tener', enBase:{'1s':'have','2s':'have','3s':'has','1p':'have','2p':'have','3p':'have'},
          esConj:{'1s':'tengo','2s':'tienes','3s':'tiene','1p':'tenemos','2p':'tenéis','3p':'tienen'} }
      ]
    }
  };

  // ===== Storage & helpers =====
  const LS_KEY = (lvl)=>`tb_begin_${ACTIVE_TENSE}_L${lvl}_best`;
  const getBest = (lvl)=>{
    const v = localStorage.getItem(LS_KEY(lvl));
    return v? parseInt(v,10): null;
  };
  const setBest = (lvl, seconds)=>{
    const prev = getBest(lvl);
    if (prev==null || seconds<prev) localStorage.setItem(LS_KEY(lvl), String(seconds));
  };
  const levelPassed = (lvl)=>{
    const best = getBest(lvl);
    if (best==null) return false;
    if (lvl===LEVELS) return true; // last level: any best counts as passed
    const req = UNLOCK_TARGETS[lvl+1];
    return best <= req;
  };
  const isUnlocked = (lvl)=>{
    if (lvl===1) return true;
    const prevBest = getBest(lvl-1);
    const req = UNLOCK_TARGETS[lvl];
    return prevBest!=null && prevBest<=req;
  };
  const fmt = (s)=>`${s}s`;
  const norm = (s)=>(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();

  // ===== UI: lock to Present only =====
  function lockToPresentOnly(){
    $$('#tense-buttons .tense-btn').forEach(btn=>{
      const on = btn.dataset.tense==='Present';
      btn.disabled = !on;
      btn.classList.toggle('active', on);
      if (!on) btn.style.display = 'none';
    });
  }

  // ===== Levels list (vertical) =====
  function renderLevels(){
    const wrap = $('#level-list');
    wrap.innerHTML = '';
    for (let lvl=1; lvl<=LEVELS; lvl++){
      const btn = document.createElement('button');
      btn.className = 'level-button';
      const best = getBest(lvl);
      const locked = !isUnlocked(lvl);
      const passed = levelPassed(lvl);
      if (locked) btn.classList.add('locked');
      if (passed) btn.classList.add('passed');

      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = `Level ${lvl}`;

      const meta = document.createElement('span');
      meta.className = 'meta';
      meta.innerHTML = [
        best!=null ? `<span class="best">Best: ${fmt(best)}</span>` : '',
        (lvl<LEVELS) ? `Target for L${lvl+1}: ${fmt(UNLOCK_TARGETS[lvl+1])}` : ''
      ].filter(Boolean).join(' • ');

      btn.appendChild(label);
      btn.appendChild(meta);

      btn.disabled = locked;
      btn.addEventListener('click', ()=> startGame(lvl));
      wrap.appendChild(btn);
    }
  }

  // ===== Build 10 questions from ser/tener (Present) =====
  function buildQuestions(){
    const verbs = DATA[ACTIVE_TENSE].verbs;
    const combos = [];
    for (const v of verbs){
      for (const subj of SUBJECTS){
        combos.push({verb:v, subj});
      }
    }
    const items=[];
    for (let i=0;i<10;i++){
      const pick = combos[Math.floor(Math.random()*combos.length)];
      const {verb, subj} = pick;
      const english = `${subj.en} ${verb.enBase[subj.person]}`;
      const correct = verb.esConj[subj.person];
      const optional = subj.esPronoun + ' ' + correct;
      items.push({english, correct, optional});
    }
    return items;
  }

  // ===== Timer =====
  let t0=0, tick=null, currentLevel=null;
  function startTimer(){
    t0 = Date.now();
    tick = setInterval(()=>{
      const s = Math.floor((Date.now()-t0)/1000);
      $('#timer').textContent = 'Time: '+s+'s';
    }, 250);
  }
  function stopTimer(){
    clearInterval(tick);
    tick = null;
    return Math.floor((Date.now()-t0)/1000);
  }

  // ===== Game flow =====
  function renderQuestions(items){
    const q = $('#questions');
    q.innerHTML='';
    items.forEach((it, i)=>{
      const row = document.createElement('div');
      row.className='question';
      row.innerHTML = `
        <div class="prompt"><strong>${i+1}.</strong> ${it.english} → <em>(Spanish)</em></div>
        <input class="answer" type="text" data-index="${i}" placeholder="Type answer here">
      `;
      q.appendChild(row);
    });
  }

  function startGame(lvl){
    currentLevel = lvl;
    $('#results').innerHTML='';
    $('#game').style.display='block';
    const qs = buildQuestions();
    $('#game').dataset.payload = JSON.stringify(qs);
    renderQuestions(qs);
    startTimer();
    window.scrollTo({top:0, behavior:'smooth'});
  }

  function grade(){
    const payload = JSON.parse($('#game').dataset.payload || '[]');
    const inputs = $$('#questions .answer');
    let correct=0, misses=0, details=[];
    inputs.forEach((inp, i)=>{
      const user = norm(inp.value);
      const c = norm(payload[i].correct);
      const opt = norm(payload[i].optional);
      const ok = (user===c) || (user===opt);
      if (ok) correct++; else misses++;
      details.push({
        n:i+1, prompt: payload[i].english,
        given: inp.value || '—',
        answer: payload[i].correct + ' (or: ' + payload[i].optional + ')',
        ok
      });
    });
    return {correct, misses, total: inputs.length, details};
  }

  function showResults(rawSeconds, result){
    const penalty = result.misses * PENALTY_PER_MISS;
    const finalTime = rawSeconds + penalty;

    const head = `<div class="score">You got ${result.correct}/${result.total} correct. Time ${fmt(rawSeconds)} + penalties ${fmt(penalty)} = <strong>${fmt(finalTime)}</strong>.</div>`;

    let fb = '<div class="feedback">';
    result.details.forEach(d=>{
      fb += `<div class="${d.ok?'correct':'incorrect'}">
        <strong>${d.n}.</strong> ${d.prompt} → <code>${d.given}</code>
        ${d.ok ? ' ✓' : ` ✗ &nbsp; <em>Answer:</em> ${d.answer}`}
      </div>`;
    });
    fb += '</div>';

    setBest(currentLevel, finalTime);

    let unlockNote='';
    if (currentLevel<LEVELS){
      const req = UNLOCK_TARGETS[currentLevel+1];
      if (finalTime<=req){
        unlockNote = `<div class="score">🎉 Level ${currentLevel+1} unlocked (target ${fmt(req)} met)!</div>`;
      }else{
        unlockNote = `<div class="score">Target for Level ${currentLevel+1} is ${fmt(req)} — reduce by ${fmt(finalTime-req)} to unlock.</div>`;
      }
    }

    const actions = `<p><a href="./">Try Again</a> &nbsp; <a href="#" id="backToMenu">Back to Menu</a></p>`;

    $('#results').innerHTML = head + unlockNote + fb + actions;
    renderLevels();
    $('#backToMenu')?.addEventListener('click', (e)=>{
      e.preventDefault();
      $('#game').style.display='none';
      window.scrollTo({top:0, behavior:'smooth'});
    });
  }

  function bindSubmit(){
    $('#submit').addEventListener('click', (e)=>{
      e.preventDefault();
      const raw = stopTimer();
      const res = grade();
      showResults(raw, res);
    });
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    lockToPresentOnly();
    renderLevels();
    bindSubmit();
  });
})();
