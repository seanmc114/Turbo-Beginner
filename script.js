
// Turbo — Beginner (Present only) with level locks, extensible for future verbs/tenses
(function(){
  const $ = (s)=>document.querySelector(s);
  const $$ = (s)=>Array.from(document.querySelectorAll(s));

  // ======== CONFIG (matches your full version's progression) ========
  const LEVELS = 10;
  // Unlock targets: Level N unlocks when best time on previous level <= target (final time includes penalties)
  const UNLOCK_TARGETS = [null, null, 125,115,105,95,85,75,65,55,45]; // L2=125s, then -10s

  const NUM_QUESTIONS = 10;
  const PENALTY_PER_MISS = 30; // +30s per incorrect/blank

  // ======== DATA MODEL (easy to extend over time) ========
  // Start with Present only + verbs: ser, tener. Add more tenses/verbs later.
  const DATA = {
    Present: {
      verbs: [
        { key:'ser', name:'ser', enBase:{'1s':'am','2s':'are','3s':'is','1p':'are','2p':'are','3p':'are'},
          esConj:{'1s':'soy','2s':'eres','3s':'es','1p':'somos','2p':'sois','3p':'son'} },
        { key:'tener', name:'tener', enBase:{'1s':'have','2s':'have','3s':'has','1p':'have','2p':'have','3p':'have'},
          esConj:{'1s':'tengo','2s':'tienes','3s':'tiene','1p':'tenemos','2p':'tenéis','3p':'tienen'} }
      ]
    }
    // Example future growth:
    // , Past: { verbs:[ {key:'ser', ...past forms...}, {key:'tener', ...}, {key:'ir', ...} ] }
    // , Future: { verbs:[ ... ] }
  };

  const SUBJECTS = [
    {en:'I',         person:'1s', esPronoun:'yo'},
    {en:'you',       person:'2s', esPronoun:'tú'},
    {en:'he',        person:'3s', esPronoun:'él'},
    {en:'she',       person:'3s', esPronoun:'ella'},
    {en:'we',        person:'1p', esPronoun:'nosotros'},
    {en:'you (pl.)', person:'2p', esPronoun:'vosotros'},
    {en:'they',      person:'3p', esPronoun:'ellos'}
  ];

  // Active tense (locked to Present for now)
  const ACTIVE_TENSE = 'Present';

  // ======== Storage keys (tense + level in the key so future tenses won't clash) ========
  const LS_KEY = (lvl)=>`tb_begin_${ACTIVE_TENSE}_L${lvl}_best`;
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
  const fmt = (s)=> `${s}s`;
  const normalize = (s)=>(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();

  // ======== UI: lock to Present in the header ========
  function lockToPresentOnly(){
    $$('#tense-buttons .tense-button').forEach(btn=>{
      const present = btn.dataset.tense==='Present';
      btn.disabled = !present;
      btn.style.display = present ? '' : 'none';
      btn.classList.toggle('active', present);
    });
  }

  // ======== Levels view ========
  function renderLevels(){
    const wrap = $('#level-list');
    wrap.innerHTML = '';
    for (let lvl=1; lvl<=LEVELS; lvl++){
      const btn = document.createElement('button');
      btn.className = 'level-button';
      const best = getBest(lvl);
      const lock = !isUnlocked(lvl);
      const targetInfo = (lvl<LEVELS) ? ` • Target for L${lvl+1}: ${fmt(UNLOCK_TARGETS[lvl+1])}` : '';
      btn.innerHTML = `Level ${lvl}${best!=null ? ` <span class="best-time">(Best: ${fmt(best)})</span>`:''}${targetInfo}`;
      btn.disabled = lock;
      if (lock) btn.classList.add('locked');
      btn.addEventListener('click', ()=> startGame(lvl));
      wrap.appendChild(btn);
    }
  }

  // ======== Question generation ========
  function buildQuestions(){
    const verbs = DATA[ACTIVE_TENSE].verbs;
    const combos = [];
    for (const v of verbs){
      for (const subj of SUBJECTS){
        combos.push({verb:v, subj});
      }
    }
    const items = [];
    for (let i=0;i<NUM_QUESTIONS;i++){
      const pick = combos[Math.floor(Math.random()*combos.length)];
      const {verb, subj} = pick;
      const english = `${subj.en} ${verb.enBase[subj.person]}`;
      const correct = verb.esConj[subj.person];
      const optional = subj.esPronoun + ' ' + correct; // allow "yo soy", etc.
      items.push({english, correct, optional});
    }
    return items;
  }

  // ======== Timer ========
  let t0=0, ticker=null, currentLevel=null;
  function startTimer(){
    t0 = Date.now();
    ticker = setInterval(()=>{
      const s = Math.floor((Date.now()-t0)/1000);
      $('#timer').textContent = 'Time: ' + s + 's';
    }, 250);
  }
  function stopTimer(){
    clearInterval(ticker);
    ticker = null;
    return Math.floor((Date.now()-t0)/1000);
  }

  // ======== Game flow ========
  function renderQuestions(items){
    const qWrap = $('#questions');
    qWrap.innerHTML = '';
    items.forEach((q, i)=>{
      const row = document.createElement('div');
      row.className = 'question';
      row.innerHTML = `
        <div class="prompt"><strong>${i+1}.</strong> ${q.english} → <em>(Spanish)</em></div>
        <input type="text" class="answer" data-index="${i}" placeholder="Type answer here">
      `;
      qWrap.appendChild(row);
    });
  }

  function startGame(level){
    currentLevel = level;
    $('#results').innerHTML = '';
    $('#game').style.display = 'block';
    $('#questions').scrollIntoView({behavior:'smooth', block:'start'});
    const qs = buildQuestions();
    $('#game').dataset.payload = JSON.stringify(qs);
    renderQuestions(qs);
    startTimer();
  }

  function grade(){
    const payload = JSON.parse($('#game').dataset.payload || '[]');
    const inputs = $$('#questions .answer');
    let correct=0, misses=0, details=[];
    inputs.forEach((inp, i)=>{
      const user = normalize(inp.value);
      const c = normalize(payload[i].correct);
      const opt = normalize(payload[i].optional);
      const ok = (user===c) || (user===opt);
      if (ok) correct++; else misses++;
      details.push({
        n:i+1, prompt: payload[i].english, given: inp.value || '—',
        answer: payload[i].correct + ' (or: ' + payload[i].optional + ')', ok
      });
    });
    return {correct, misses, total: inputs.length, details};
  }

  function showResults(rawSeconds, result){
    const penalty = result.misses * PENALTY_PER_MISS;
    const finalTime = rawSeconds + penalty;

    const header = `<div class="score">You got ${result.correct}/${result.total} correct. Time ${fmt(rawSeconds)} + penalties ${fmt(penalty)} = <strong>${fmt(finalTime)}</strong>.</div>`;

    let fb = '<div class="feedback">';
    result.details.forEach(d=>{
      fb += `<div class="${d.ok?'correct':'incorrect'}">
        <strong>${d.n}.</strong> ${d.prompt} → <code>${d.given}</code>
        ${d.ok ? ' ✓' : ` ✗ &nbsp; <em>Answer:</em> ${d.answer}`}
      </div>`;
    });
    fb += '</div>';

    setBest(currentLevel, finalTime);

    let unlockMsg = '';
    if (currentLevel < LEVELS){
      const req = UNLOCK_TARGETS[currentLevel+1];
      if (finalTime <= req){
        unlockMsg = `<div class="unlocked">🎉 Level ${currentLevel+1} unlocked (target ${fmt(req)} met)!</div>`;
      } else {
        unlockMsg = `<div class="locked-note">Target for Level ${currentLevel+1} is ${fmt(req)} — reduce by ${fmt(finalTime-req)} to unlock.</div>`;
      }
    }

    const actions = `<p><a href="./">Try Again</a> &nbsp; <a href="#" id="backToMenu">Back to Menu</a></p>`;

    $('#results').innerHTML = header + unlockMsg + fb + actions;
    renderLevels();
    $('#backToMenu')?.addEventListener('click', (e)=>{
      e.preventDefault();
      $('#game').style.display = 'none';
      window.scrollTo({top:0, behavior:'smooth'});
    });
  }

  function bindSubmit(){
    $('#submit').addEventListener('click', (e)=>{
      e.preventDefault();
      const raw = stopTimer();
      const result = grade();
      showResults(raw, result);
    });
  }

  // ======== Boot ========
  document.addEventListener('DOMContentLoaded', ()=>{
    lockToPresentOnly();
    renderLevels();
    bindSubmit();
  });

  // ======== HOW TO GROW THIS OVER TIME ========
  // 1) Add a new verb to DATA[ACTIVE_TENSE].verbs with enBase + esConj maps (same keys as above).
  // 2) To add a new tense later, add DATA.Future / DATA.Past with a `verbs` array in the same shape,
  //    then enable the matching tense button, and update ACTIVE_TENSE if you want to default to it.
  //    Storage keys already include tense so best times won't clash.
})();
