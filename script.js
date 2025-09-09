
// Classic beginner Turbo — Present only (ser & tener) with level locks
(function(){
  const $ = (s)=>document.querySelector(s);
  const $$ = (s)=>Array.from(document.querySelectorAll(s));

  // ===== CONFIG =====
  const LEVELS = 10;
  const UNLOCK_TARGETS = [null, null, 125,115,105,95,85,75,65,55,45]; // L2=125 then -10
  const NUM_QUESTIONS = 10;
  const PENALTY_PER_MISS = 30;
  const ACTIVE_TENSE = 'Present';

  // Fresh storage namespace so Level 1 is the only unlocked on first run
  const STORAGE_PREFIX = 'tb_begin_classic_working_';
  const LS_KEY = (lvl)=>`${STORAGE_PREFIX}${ACTIVE_TENSE}_L${lvl}_best`;

  const getBest = (lvl)=>{
    const v = localStorage.getItem(LS_KEY(lvl));
    return v? parseInt(v,10): null;
  };
  const setBest = (lvl, seconds)=>{
    const prev = getBest(lvl);
    if (prev==null || seconds<prev) localStorage.setItem(LS_KEY(lvl), String(seconds));
  };
  const isUnlocked = (lvl)=>{
    if (lvl===1) return true;
    const req = UNLOCK_TARGETS[lvl];
    const prevBest = getBest(lvl-1);
    return prevBest!=null && prevBest<=req;
  };
  const fmt = (s)=>`${s}s`;
  const norm = (s)=>(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();

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

  // ===== UI helpers =====
  function lockToPresentOnly(){
    $$('#tense-buttons .tense-btn').forEach(btn=>{
      const on = btn.dataset.tense==='Present';
      btn.disabled = !on;
      btn.classList.toggle('active', on);
      if (!on) btn.style.display = 'none';
    });
  }

  function renderLevels(){
    const wrap = $('#level-list');
    wrap.innerHTML='';
    for (let lvl=1; lvl<=LEVELS; lvl++){
      const unlocked = isUnlocked(lvl);
      const btn = document.createElement('button');
      btn.className = 'level-button ' + (unlocked ? 'unlocked' : 'locked');
      btn.type = 'button';
      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = unlocked ? `Level ${lvl}` : '🔒';
      btn.appendChild(label);
      btn.disabled = !unlocked;
      if (unlocked){
        btn.addEventListener('click', ()=> startGame(lvl));
      }
      wrap.appendChild(btn);
    }
  }

  // ===== Questions =====
  function buildQuestions(){
    const verbs = DATA[ACTIVE_TENSE].verbs;
    const combos = [];
    for (const v of verbs){
      for (const subj of SUBJECTS){
        combos.push({verb:v, subj});
      }
    }
    const items=[];
    for (let i=0;i<NUM_QUESTIONS;i++){
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
  let t0=0, tick=null, currentLevel=null, lastPayload=null;
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
    lastPayload = qs;
    renderQuestions(qs);
    startTimer();
    window.scrollTo({top:0, behavior:'smooth'});
  }

  function grade(){
    const inputs = $$('#questions .answer');
    let correct=0, misses=0, details=[];
    inputs.forEach((inp, i)=>{
      const user = norm(inp.value);
      const c = norm(lastPayload[i].correct);
      const opt = norm(lastPayload[i].optional);
      const ok = (user===c) || (user===opt);
      if (ok) correct++; else misses++;
      // highlight the input
      inp.classList.remove('ok','bad');
      inp.classList.add(ok ? 'ok' : 'bad');
      details.push({
        n:i+1, prompt: lastPayload[i].english,
        given: inp.value || '—',
        answer: lastPayload[i].correct + ' (or: ' + lastPayload[i].optional + ')',
        ok
      });
    });
    return {correct, misses, total: inputs.length, details};
  }

  function showResults(rawSeconds, result){
    const penalty = result.misses * PENALTY_PER_MISS;
    const finalTime = rawSeconds + penalty;

    const head = `<div class="score">You got ${result.correct}/${result.total} correct. Time ${fmt(rawSeconds)} + penalties ${fmt(penalty)} = <strong>${fmt(finalTime)}</strong>.</div>`;

    // Simple, original-style feedback list (no big cards)
    let fb = '<div class="feedback">';
    result.details.forEach(d=>{
      fb += `<div class="line ${d.ok?'correct':'incorrect'}">
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

    // Action buttons: TRY AGAIN (restart same level) & BACK TO LEVELS
    const actions = `<div class="actions">
      <button id="tryAgainBtn" class="btn" type="button">TRY AGAIN</button>
      <button id="backToLevelsBtn" class="btn" type="button">BACK TO LEVELS</button>
    </div>`;

    $('#results').innerHTML = head + unlockNote + fb + actions;

    // Wire actions
    $('#tryAgainBtn')?.addEventListener('click', ()=>{
      $('#results').innerHTML='';
      const qs = buildQuestions(); // new set but same level
      lastPayload = qs;
      renderQuestions(qs);
      startTimer();
      window.scrollTo({top:0, behavior:'smooth'});
    });
    $('#backToLevelsBtn')?.addEventListener('click', ()=>{
      $('#game').style.display='none';
      window.scrollTo({top:0, behavior:'smooth'});
      renderLevels(); // reflect unlocks
    });

    // Reflect unlocks immediately
    renderLevels();
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
