
(function(){
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  let startTime = 0;
  let timerId = null;
  let currentLevel = 'Beginner';
  const NUM_QUESTIONS = 10;
  const STORAGE_KEY = 'turbo_beginner_best_time_present';

  // Keep same design: buttons exist, but we disable/hide Past & Future for this build
  function lockToPresentOnly(){
    const btns = $$('#tense-buttons .tense-button');
    btns.forEach(btn => {
      if (btn.dataset.tense !== 'Present') {
        btn.disabled = true;
        btn.classList.remove('active');
        // Hide to avoid confusion; comment this line if you prefer disabled but visible
        btn.style.display = 'none';
      } else {
        btn.classList.add('active');
      }
    });
  }

  // Conjugations (Present) for SER and TENER
  // persons: 1s(I),2s(you sg),3s(he/she),1p(we),2p(you pl),3p(they)
  const SER = { '1s':'soy','2s':'eres','3s':'es','1p':'somos','2p':'sois','3p':'son' };
  const TENER = { '1s':'tengo','2s':'tienes','3s':'tiene','1p':'tenemos','2p':'tenéis','3p':'tienen' };

  const SUBJECTS = [
    {en:'I',         person:'1s', esPronoun:'yo'},
    {en:'you',       person:'2s', esPronoun:'tú'},
    {en:'he',        person:'3s', esPronoun:'él'},
    {en:'she',       person:'3s', esPronoun:'ella'},
    {en:'we',        person:'1p', esPronoun:'nosotros'},
    {en:'you (pl.)', person:'2p', esPronoun:'vosotros'},
    {en:'they',      person:'3p', esPronoun:'ellos'}
  ];

  const VERBS = [
    {name:'ser',    enBase:{'1s':'am','2s':'are','3s':'is','1p':'are','2p':'are','3p':'are'}, conj:SER},
    {name:'tener',  enBase:{'1s':'have','2s':'have','3s':'has','1p':'have','2p':'have','3p':'have'}, conj:TENER}
  ];

  // Utility: strip accents, case, and extra spaces for tolerant matching
  function normalize(s){
    return (s||'')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'') // strip accents
      .replace(/\s+/g,' ')
      .trim();
  }

  function bestTime(){
    const v = localStorage.getItem(STORAGE_KEY);
    return v ? parseInt(v,10) : null;
  }
  function setBestTime(seconds){
    const prev = bestTime();
    if (prev==null || seconds<prev) localStorage.setItem(STORAGE_KEY, String(seconds));
  }

  // Build single level (same design: a level list with one level)
  function renderLevels(){
    const levelList = $('#level-list');
    levelList.innerHTML = '';
    const btn = document.createElement('button');
    btn.className = 'level-button';
    const bt = bestTime();
    btn.innerHTML = `Beginner (Present: ser &amp; tener) ${bt!=null ? '<span class="best-time">Best: '+bt+'s</span>' : ''}`;
    btn.addEventListener('click', startGame);
    levelList.appendChild(btn);
  }

  function startTimer(){
    startTime = Date.now();
    timerId = setInterval(()=>{
      const s = Math.floor((Date.now()-startTime)/1000);
      $('#timer').textContent = 'Time: ' + s + 's';
    }, 250);
  }
  function stopTimer(){
    clearInterval(timerId);
    timerId = null;
    const s = Math.floor((Date.now()-startTime)/1000);
    return s;
  }

  // Pick 10 prompts from the 14 possible (2 verbs x 7 subjects), sampling with replacement
  function buildQuestions(){
    const combos = [];
    for (const v of VERBS){
      for (const subj of SUBJECTS){
        combos.push({verb:v, subj});
      }
    }
    const out = [];
    for (let i=0;i<NUM_QUESTIONS;i++){
      const pick = combos[Math.floor(Math.random()*combos.length)];
      const {verb, subj} = pick;
      const english = `${subj.en} ${verb.enBase[subj.person]}`; // e.g., "I am", "she has"
      const correct = verb.conj[subj.person];                    // e.g., "soy", "tiene"
      const optionalPronoun = subj.esPronoun + ' ' + correct;    // allow "yo soy", etc.
      out.push({english, correct, optionalPronoun});
    }
    return out;
  }

  function renderQuestions(items){
    const qWrap = $('#questions');
    qWrap.innerHTML = '';
    items.forEach((q, idx)=>{
      const row = document.createElement('div');
      row.className = 'question';
      row.innerHTML = `
        <div class="prompt"><strong>${idx+1}.</strong> ${q.english} → <em>(Spanish)</em></div>
        <input type="text" class="answer" data-index="${idx}" placeholder="Type answer here">
      `;
      qWrap.appendChild(row);
    });
  }

  function startGame(){
    $('#results').innerHTML = '';
    $('#game').style.display = 'block';
    $('#questions').scrollIntoView({behavior:'smooth', block:'start'});
    const qs = buildQuestions();
    renderQuestions(qs);
    // stash on DOM for submit
    $('#game').dataset.payload = JSON.stringify(qs);
    startTimer();
  }

  function grade(){
    const payload = JSON.parse($('#game').dataset.payload || '[]');
    const inputs = $$('#questions .answer');
    let correctCount = 0;
    let details = [];

    inputs.forEach((inp, i)=>{
      const user = normalize(inp.value);
      const corr = normalize(payload[i].correct);
      const opt  = normalize(payload[i].optionalPronoun);
      const isCorrect = (user===corr) || (user===opt);
      details.push({
        n: i+1,
        prompt: payload[i].english,
        expected: payload[i].correct + ' (or: ' + payload[i].optionalPronoun + ')',
        given: inp.value || '—',
        ok: isCorrect
      });
      if (isCorrect) correctCount++;
    });

    return {correctCount, details};
  }

  function showResults(finalTime){
    const {correctCount, details} = grade();
    const total = details.length;
    const scoreHtml = `<div class="score">You got ${correctCount}/${total} correct in ${finalTime}s.</div>`;
    let table = '<div class="feedback">';
    details.forEach(d=>{
      table += `<div class="${d.ok?'correct':'incorrect'}">
        <strong>${d.n}.</strong> ${d.prompt} → <code>${d.given}</code>
        ${d.ok ? ' ✓' : ` ✗ &nbsp; <em>Answer:</em> ${d.expected}`}
      </div>`;
    });
    table += '</div>';

    const tryAgain = `<p><a href="./">Try Again</a></p>`;
    $('#results').innerHTML = scoreHtml + table + tryAgain;

    // best time only if all correct
    if (correctCount === total){
      setBestTime(finalTime);
      // Update level button to show new best
      renderLevels();
    }
  }

  function bindSubmit(){
    $('#submit').addEventListener('click', (e)=>{
      e.preventDefault();
      const finalTime = stopTimer();
      showResults(finalTime);
    });
  }

  // Boot
  document.addEventListener('DOMContentLoaded', ()=>{
    lockToPresentOnly();
    renderLevels();
    bindSubmit();
  });
})();
