
// Beginner Turbo EXACT: only Present + ser/tener; fix Level 1 click & header style
(function(){
  const $ = (s)=>document.querySelector(s);
  const $$ = (s)=>Array.from(document.querySelectorAll(s));

  const LEVELS = 10;
  const TARGET = [null, null, 125,115,105,95,85,75,65,55,45];
  const NUM_QUESTIONS = 10;
  const PENALTY_PER_MISS = 30;
  const ACTIVE_TENSE = 'Present';

  const LS_KEY = (lvl)=>`turbo_beginner_${ACTIVE_TENSE}_L${lvl}_best`;
  const getBest = (lvl)=>{
    const v = localStorage.getItem(LS_KEY(lvl));
    return v? parseInt(v,10): null;
  };
  const setBest = (lvl, s)=>{
    const prev = getBest(lvl);
    if (prev==null || s<prev) localStorage.setItem(LS_KEY(lvl), String(s));
  };
  const isUnlocked = (lvl)=>{
    if (lvl===1) return true;
    const req = TARGET[lvl];
    const prevBest = getBest(lvl-1);
    return prevBest!=null && prevBest<=req;
  };
  const fmt = (s)=>`${s}s`;
  const norm = (s)=>(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();

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
    Present: [
      { key:'ser', name:'ser',
        enBase:{'1s':'am','2s':'are','3s':'is','1p':'are','2p':'are','3p':'are'},
        esConj:{'1s':'soy','2s':'eres','3s':'es','1p':'somos','2p':'sois','3p':'son'} },
      { key:'tener', name:'tener',
        enBase:{'1s':'have','2s':'have','3s':'has','1p':'have','2p':'have','3p':'have'},
        esConj:{'1s':'tengo','2s':'tienes','3s':'tiene','1p':'tenemos','2p':'tenéis','3p':'tienen'} }
    ]
  };

  // Lock the header to Present but keep the active look
  function lockHeader(){
    $$('#tense-buttons .tense-button').forEach(btn=>{
      const on = btn.dataset.tense===ACTIVE_TENSE;
      btn.classList.toggle('active', on);
      if (on){
        btn.setAttribute('aria-disabled', 'true'); // styled via CSS to look active
      } else {
        btn.disabled = true; // grey the others as in original
      }
    });
  }

  function renderLevels(){
    const list = $('#level-list');
    list.innerHTML = '';
    for (let lvl=1; lvl<=LEVELS; lvl++){
      const unlocked = isUnlocked(lvl);
      const btn = document.createElement('button');
      btn.className = 'level-button' + (unlocked?'':' locked');
      btn.type = 'button';
      btn.innerHTML = unlocked ? `Level ${lvl}` : '🔒';
      btn.disabled = !unlocked;
      list.appendChild(btn);
    }
  }

  // Robust delegated click handler (fixes dead Level 1 button on some setups)
  function bindLevelClicks(){
    $('#level-list').addEventListener('click', (e)=>{
      const btn = e.target.closest('.level-button');
      if (!btn || btn.disabled || btn.classList.contains('locked')) return;
      const m = (btn.textContent||'').match(/Level\s+(\d+)/i);
      const lvl = m ? parseInt(m[1],10) : 1;
      startGame(lvl);
    });
  }

  function buildQuestions(){
    const verbs = DATA[ACTIVE_TENSE];
    const pool = [];
    for (const v of verbs){
      for (const subj of SUBJECTS){
        pool.push({verb:v, subj});
      }
    }
    const out = [];
    for (let i=0;i<NUM_QUESTIONS;i++){
      const pick = pool[Math.floor(Math.random()*pool.length)];
      const {verb, subj} = pick;
      const english = `${subj.en} ${verb.enBase[subj.person]}`;
      const correct = verb.esConj[subj.person];
      const optional = subj.esPronoun + ' ' + correct;
      out.push({english, correct, optional});
    }
    return out;
  }

  let t0=0, ticker=null, currentLevel=1, lastQs=[];
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

  function renderQuestions(items){
    const wrap = $('#questions');
    wrap.innerHTML='';
    items.forEach((q,i)=>{
      const row = document.createElement('div');
      row.className = 'question';
      row.innerHTML = `
        <div class="prompt"><strong>${i+1}.</strong> ${q.english} → <em>(Spanish)</em></div>
        <input type="text" class="answer" data-index="${i}" placeholder="Type answer here">
      `;
      wrap.appendChild(row);
    });
  }

  function startGame(level){
    currentLevel = level;
    $('#results').innerHTML='';
    $('#game').style.display = 'block';
    lastQs = buildQuestions();
    renderQuestions(lastQs);
    startTimer();
    $('#questions').scrollIntoView({behavior:'smooth', block:'start'});
  }

  function grade(){
    const inputs = $$('#questions .answer');
    let correct=0, misses=0, details=[];
    inputs.forEach((inp,i)=>{
      const user = norm(inp.value);
      const c = norm(lastQs[i].correct);
      const opt = norm(lastQs[i].optional);
      const ok = (user===c) || (user===opt);
      if (ok) correct++; else misses++;
      inp.classList.remove('ok','bad');
      inp.classList.add(ok?'ok':'bad');
      details.push({
        n:i+1, prompt:lastQs[i].english,
        given: inp.value || '—',
        answer: lastQs[i].correct + ' (or: ' + lastQs[i].optional + ')',
        ok
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

    let unlockMsg='';
    if (currentLevel<LEVELS){
      const req = TARGET[currentLevel+1];
      if (finalTime<=req){
        unlockMsg = `<div class="score">🎉 Level ${currentLevel+1} unlocked (target ${fmt(req)} met)!</div>`;
      } else {
        unlockMsg = `<div class="score">Target for Level ${currentLevel+1} is ${fmt(req)} — reduce by ${fmt(finalTime-req)} to unlock.</div>`;
      }
    }

    const actions = `<p>
      <button id="tryAgainBtn" type="button">TRY AGAIN</button>
      <button id="backToLevelsBtn" type="button">BACK TO LEVELS</button>
    </p>`;

    $('#results').innerHTML = header + unlockMsg + fb + actions;

    $('#tryAgainBtn')?.addEventListener('click', ()=>{
      $('#results').innerHTML='';
      lastQs = buildQuestions();
      renderQuestions(lastQs);
      startTimer();
      window.scrollTo({top:0, behavior:'smooth'});
    });
    $('#backToLevelsBtn')?.addEventListener('click', ()=>{
      $('#game').style.display='none';
      window.scrollTo({top:0, behavior:'smooth'});
      renderLevels();
    });

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

  function init(){
    lockHeader();
    renderLevels();
    bindLevelClicks();
    bindSubmit();
  }

  // Run init reliably whether the script loads head or body-bottom
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
