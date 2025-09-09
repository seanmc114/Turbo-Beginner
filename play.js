
// Play page: runs the game; random interrogative/negative; updates best & unlocks
(function(){
  const $ = (s)=>document.querySelector(s);
  const $$ = (s)=>Array.from(document.querySelectorAll(s));

  const TARGET = [null, null, 125,115,105,95,85,75,65,55,45];
  const NUM_QUESTIONS = 10;
  const PENALTY_PER_MISS = 30;
  const ACTIVE_TENSE = 'Present';
  const LS_KEY = (lvl)=>`turbo_beginner_${ACTIVE_TENSE}_L${lvl}_best`;

  const fmt = (s)=>`${s}s`;
  const norm = (s)=>(s||'').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[¿?¡!.,;:()]/g,' ')
    .replace(/\s+/g,' ').trim();

  function qsParam(name){
    const m = location.search.match(new RegExp('[?&]'+name+'=([^&]+)'));
    return m ? decodeURIComponent(m[1]) : null;
  }
  let currentLevel = Math.max(1, Math.min(10, parseInt(qsParam('level')||'1',10)||1));

  function getBest(lvl){
    const v = localStorage.getItem(LS_KEY(lvl));
    return v? parseInt(v,10): null;
  }
  function setBest(lvl, s){
    const prev = getBest(lvl);
    if (prev==null || s<prev) localStorage.setItem(LS_KEY(lvl), String(s));
  }

  function lockHeader(){
    $$('#tense-buttons .tense-button').forEach(btn=>{
      const on = btn.dataset.tense===ACTIVE_TENSE;
      btn.classList.toggle('active', on);
      if (on){ btn.setAttribute('aria-disabled','true'); }
      else { btn.disabled = true; }
    });
  }

  const SUBJECTS = [
    {en:'I',         person:'1s', esPronoun:'yo'},
    {en:'you',       person:'2s', esPronoun:'tú'},
    {en:'he',        person:'3s', esPronoun:'él'},
    {en:'she',       person:'3s', esPronoun:'ella'},
    {en:'we',        person:'1p', esPronoun:'nosotros'},
    {en:'you (pl.)', person:'2p', esPronoun:'vosotros'},
    {en:'they',      person:'3p', esPronoun:'ellos'}
  ];
  const SER = { '1s':'soy','2s':'eres','3s':'es','1p':'somos','2p':'sois','3p':'son' };
  const TENER = { '1s':'tengo','2s':'tienes','3s':'tiene','1p':'tenemos','2p':'tenéis','3p':'tienen' };

  const EN_SER = { '1s':'am','2s':'are','3s':'is','1p':'are','2p':'are','3p':'are' };
  const EN_SER_NEG = { '1s':'am not','2s':'are not','3s':'is not','1p':'are not','2p':'are not','3p':'are not' };
  const EN_SER_Q = { '1s':'Am','2s':'Are','3s':'Is','1p':'Are','2p':'Are','3p':'Are' };

  const EN_TENER = { '1s':'have','2s':'have','3s':'has','1p':'have','2p':'have','3p':'have' };
  const EN_TENER_NEG = { '1s':'do not have','2s':'do not have','3s':'does not have','1p':'do not have','2p':'do not have','3p':'do not have' };
  const EN_TENER_Q = { '1s':'Do','2s':'Do','3s':'Does','1p':'Do','2p':'Do','3p':'Do' };

  const VERBS = [
    {key:'ser', enBase:EN_SER, enNeg:EN_SER_NEG, enQ:EN_SER_Q, es:SER},
    {key:'tener', enBase:EN_TENER, enNeg:EN_TENER_NEG, enQ:EN_TENER_Q, es:TENER}
  ];

  function buildQuestions(){
    const modes = ['affirm','negative','question'];
    const pool = [];
    for (const v of VERBS){
      for (const subj of SUBJECTS){
        pool.push({v, subj});
      }
    }
    const items = [];
    for (let i=0;i<NUM_QUESTIONS;i++){
      const pick = pool[Math.floor(Math.random()*pool.length)];
      const mode = modes[Math.floor(Math.random()*modes.length)];
      const {v, subj} = pick;
      let english='', accept=[], show='';

      const conj = v.es[subj.person];
      const pron = subj.esPronoun;

      if (mode==='affirm'){
        english = `${subj.en} ${v.enBase[subj.person]}`;
        accept = [conj, `${pron} ${conj}`];
        show = `${conj} (or: ${pron} ${conj})`;
      } else if (mode==='negative'){
        english = `${subj.en} ${v.enNeg[subj.person]}`;
        accept = [`no ${conj}`, `${pron} no ${conj}`];
        show = `no ${conj} (or: ${pron} no ${conj})`;
      } else {
        english = (v.key==='ser')
          ? `${v.enQ[subj.person]} ${subj.en}?`
          : `${v.enQ[subj.person]} ${subj.en} have?`;
        accept = [conj, `${pron} ${conj}`];
        show = `${conj} (or: ${pron} ${conj})`;
      }

      items.push({english, accept, show});
    }
    return items;
  }

  let t0=0, ticker=null, lastQs=[];
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

  function startGame(){
    $('#results').innerHTML='';
    lastQs = buildQuestions();
    renderQuestions(lastQs);
    startTimer();
  }

  function grade(){
    const inputs = $$('#questions .answer');
    let correct=0, misses=0, details=[];
    inputs.forEach((inp,i)=>{
      const user = norm(inp.value);
      const acc = lastQs[i].accept.map(norm);
      const ok = acc.includes(user);
      if (ok) correct++; else misses++;
      inp.classList.remove('ok','bad');
      inp.classList.add(ok?'ok':'bad');
      details.push({
        n:i+1, prompt:lastQs[i].english,
        given: inp.value || '—',
        answer: lastQs[i].show,
        ok
      });
    });
    return {correct, misses, total: inputs.length, details};
  }

  function copyButtonStyles(src, dst){
    const cs = getComputedStyle(src);
    const props = ['backgroundColor','color','border','borderColor','borderStyle','borderWidth',
      'borderRadius','padding','fontSize','fontFamily','fontWeight','textTransform','boxShadow','letterSpacing'];
    props.forEach(p=> dst.style[p] = cs[p]);
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
    if (currentLevel<10){
      const req = TARGET[currentLevel+1];
      if (finalTime<=req){
        unlockMsg = `<div class="score">🎉 Level ${currentLevel+1} unlocked (target ${req}s met)!</div>`;
      } else {
        unlockMsg = `<div class="score">Target for Level ${currentLevel+1} is ${req}s — reduce by ${finalTime-req}s to unlock.</div>`;
      }
    }

    const resultsEl = $('#results');
    resultsEl.innerHTML = header + unlockMsg + fb +
      `<p id="actions"></p>`;

    const submitBtn = $('#submit');
    const actWrap = $('#actions');

    const tryAgain = document.createElement('button');
    tryAgain.type = 'button';
    tryAgain.textContent = 'TRY AGAIN';
    copyButtonStyles(submitBtn, tryAgain);

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.style.marginLeft = '8px';
    backBtn.textContent = 'BACK TO LEVELS';
    copyButtonStyles(submitBtn, backBtn);

    actWrap.appendChild(tryAgain);
    actWrap.appendChild(backBtn);

    tryAgain.addEventListener('click', ()=>{
      resultsEl.innerHTML='';
      startGame();
      window.scrollTo({top:0, behavior:'smooth'});
    });
    backBtn.addEventListener('click', ()=>{
      location.href = 'index.html';
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

  function init(){
    lockHeader();
    startGame();
    bindSubmit();
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
