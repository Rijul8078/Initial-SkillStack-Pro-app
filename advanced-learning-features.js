(function () {
  function escHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeSql(sql) {
    return (sql || '')
      .toLowerCase()
      .replace(/--.*$/gm, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function detectSqlType(sql) {
    const s = normalizeSql(sql);
    if (!s) return 'unknown';
    if (s.startsWith('select') || s.startsWith('with')) return 'select';
    if (s.startsWith('insert')) return 'insert';
    if (s.startsWith('update')) return 'update';
    if (s.startsWith('delete')) return 'delete';
    if (s.startsWith('create') || s.startsWith('drop') || s.startsWith('alter')) return 'ddl';
    return 'other';
  }

  function requiredClauses(solutionSql) {
    const s = normalizeSql(solutionSql);
    const checks = [
      { name: 'FROM', re: /\bfrom\b/ },
      { name: 'WHERE', re: /\bwhere\b/ },
      { name: 'GROUP BY', re: /\bgroup\s+by\b/ },
      { name: 'HAVING', re: /\bhaving\b/ },
      { name: 'ORDER BY', re: /\border\s+by\b/ },
      { name: 'JOIN', re: /\b(join|inner join|left join|right join|full join)\b/ },
      { name: 'DISTINCT', re: /\bdistinct\b/ },
      { name: 'LIMIT', re: /\blimit\b/ },
      { name: 'CASE', re: /\bcase\b/ },
      { name: 'WINDOW FUNCTION', re: /\bover\s*\(/ },
      { name: 'CTE', re: /^with\b/ }
    ];
    return checks.filter(c => c.re.test(s));
  }

  function compareColumns(actualCols, expectedCols) {
    if (actualCols.length !== expectedCols.length) return false;
    const a = actualCols.map(c => String(c).toLowerCase());
    const b = expectedCols.map(c => String(c).toLowerCase());
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  function canonicalizeRows(cols, rows) {
    const normalized = rows.map(r => {
      const obj = {};
      cols.forEach((c, i) => {
        const v = r[i];
        obj[String(c).toLowerCase()] = v === null ? null : String(v);
      });
      return JSON.stringify(obj);
    });
    normalized.sort();
    return normalized;
  }

  function compareRowSets(actualCols, actualRows, expectedCols, expectedRows) {
    if (actualRows.length !== expectedRows.length) return false;
    const a = canonicalizeRows(actualCols, actualRows);
    const b = canonicalizeRows(expectedCols, expectedRows);
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  function execLastResult(database, sql) {
    const results = database.exec(sql);
    if (!results || results.length === 0) {
      return { columns: [], values: [] };
    }
    const last = results[results.length - 1];
    return {
      columns: last.columns || [],
      values: last.values || []
    };
  }

  function robustGradeChallenge(ch, userSql) {
    const feedback = [];

    if (!db || !db.constructor) {
      return { pass: false, score: 0, feedback: ['SQL engine unavailable.'] };
    }

    if (!ch || !ch.solution) {
      return { pass: true, score: 100, feedback: [] };
    }

    const type = detectSqlType(userSql);
    const solutionType = detectSqlType(ch.solution);

    const userNorm = normalizeSql(userSql);
    const solutionNorm = normalizeSql(ch.solution);

    const required = requiredClauses(ch.solution);
    required.forEach(rule => {
      if (!rule.re.test(userNorm)) {
        feedback.push(`Missing expected clause: ${rule.name}`);
      }
    });

    if (/\bfrom\b/.test(solutionNorm) && !/\bfrom\b/.test(userNorm)) {
      feedback.push('Your query may be hardcoded (FROM clause is missing).');
    }

    if (type !== solutionType && solutionType === 'select') {
      feedback.push('Expected a SELECT query for this challenge.');
    }

    let resultMatch = true;
    let columnMatch = true;

    if (solutionType === 'select') {
      try {
        const ShadowDB = db.constructor;

        const userDB = new ShadowDB();
        userDB.run(DB_SQL);
        const expectedDB = new ShadowDB();
        expectedDB.run(DB_SQL);

        const userOut = execLastResult(userDB, userSql);
        const expectedOut = execLastResult(expectedDB, ch.solution);

        columnMatch = compareColumns(userOut.columns, expectedOut.columns);
        resultMatch = compareRowSets(userOut.columns, userOut.values, expectedOut.columns, expectedOut.values);

        if (!columnMatch) feedback.push('Selected columns/aliases do not match expected output.');
        if (!resultMatch) feedback.push('Result rows do not match expected output.');
      } catch (err) {
        feedback.push(`Robust grading check failed: ${err.message}`);
      }
    }

    let score = 100;
    if (!columnMatch) score -= 25;
    if (!resultMatch) score -= 45;
    score -= Math.min(30, feedback.length * 8);
    if (score < 0) score = 0;

    const pass = feedback.length === 0;
    return { pass, score, feedback };
  }

  function renderResultsTable(columns, rows) {
    return `<div class="result-table-wrap"><table class="rt">
      <thead><tr>${columns.map(c => `<th>${escHtml(c)}</th>`).join('')}</tr></thead>
      <tbody>${rows.slice(0, 50).map(r => `<tr>${columns.map(c => `<td>${r[c] === null ? '<span style="color:#475569">NULL</span>' : escHtml(r[c])}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>
    <div class="result-meta">${rows.length} row${rows.length !== 1 ? 's' : ''} returned ${rows.length > 50 ? '(showing first 50)' : ''}</div>`;
  }

  const originalRunChallenge = window.runChallenge;
  window.runChallenge = function (mi, li, ci) {
    const sql = document.getElementById(`sql-${mi}-${li}-${ci}`).value.trim();
    const resultEl = document.getElementById(`result-${mi}-${li}-${ci}`);
    if (!sql) return;
    if (!db) {
      resultEl.innerHTML = `<div class="msg msg-error">SQL engine not loaded. Please check internet and refresh the page.</div>`;
      return;
    }

    try {
      const results = db.exec(sql);
      const key = `${mi}-${li}-${ci}`;
      const ch = MODULES[mi].lessons[li].challenges[ci];

      if (results.length === 0) {
        const queryType = detectSqlType(sql);
        if (queryType === 'insert' || queryType === 'update' || queryType === 'delete' || queryType === 'ddl') {
          resultEl.innerHTML = `<div class="msg msg-success">Query executed successfully.</div>`;
          if (!completedChallenges[key]) markDone(mi, li, ci, ch.xp);
          return;
        }
        resultEl.innerHTML = `<div class="msg msg-error">No result returned. Expected a SELECT output for grading.</div>`;
        return;
      }

      const { columns, values } = results[results.length - 1];
      const rows = values.map(v => {
        const o = {};
        columns.forEach((c, i) => { o[c] = v[i]; });
        return o;
      });

      const basicCorrect = !!(ch.validate && ch.validate(rows));
      const robust = robustGradeChallenge(ch, sql);
      const finalCorrect = basicCorrect && robust.pass;

      let html = '';
      if (finalCorrect && !completedChallenges[key]) {
        html += `<div class="msg-correct">Correct! Robust checks passed. Score: ${robust.score}/100</div>`;
        markDone(mi, li, ci, ch.xp);
      } else if (!finalCorrect) {
        html += `<div class="msg msg-error">Not correct yet. Robust score: ${robust.score}/100</div>`;
        if (robust.feedback.length) {
          html += `<div class="msg msg-hint" style="margin-top:8px">${robust.feedback.map(f => `- ${escHtml(f)}`).join('<br>')}</div>`;
        }
      }

      html += renderResultsTable(columns, rows);
      resultEl.innerHTML = html;
    } catch (e) {
      resultEl.innerHTML = `<div class="msg msg-error">${escHtml(e.message)}</div>`;
    }
  };

  function ensureMockInterviewUi() {
    if (document.getElementById('btn-mock-interview')) return;
    const topbarRight = document.querySelector('.topbar-right');
    if (!topbarRight) return;

    const btn = document.createElement('button');
    btn.id = 'btn-mock-interview';
    btn.className = 'btn-nav btn-next-l';
    btn.style.padding = '6px 12px';
    btn.style.fontSize = '0.75rem';
    btn.textContent = 'Mock Interview';
    btn.onclick = openMockInterview;
    topbarRight.insertBefore(btn, topbarRight.firstChild);

    const style = document.createElement('style');
    style.textContent = `
      #mock-interview-modal{position:fixed;inset:0;background:#000000b0;display:none;align-items:center;justify-content:center;z-index:9100;padding:16px}
      .mim-card{width:min(860px,100%);max-height:92vh;overflow:auto;background:var(--card);border:1px solid var(--border2);border-radius:14px;padding:20px}
      .mim-top{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:14px}
      .mim-title{font-family:'Clash Display',sans-serif;font-size:1.4rem}
      .mim-timer{font-family:'IBM Plex Mono',monospace;color:var(--yellow);font-weight:700}
      .mim-q{font-size:1rem;font-weight:700;line-height:1.6;margin:8px 0 10px}
      .mim-answer{width:100%;min-height:130px;background:var(--code-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);padding:12px;font-size:0.88rem;line-height:1.6;outline:none}
      .mim-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
      .mim-note{margin-top:10px;font-size:0.84rem;color:var(--muted2);line-height:1.6}
      .mim-score{padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--code-bg);margin-top:10px;font-size:0.84rem}
    `;
    document.head.appendChild(style);

    const modal = document.createElement('div');
    modal.id = 'mock-interview-modal';
    modal.innerHTML = `<div class="mim-card" id="mim-card"></div>`;
    modal.addEventListener('click', function (e) {
      if (e.target.id === 'mock-interview-modal') closeMockInterview();
    });
    document.body.appendChild(modal);
  }

  const mockState = {
    questions: [],
    idx: 0,
    score: 0,
    startedAt: 0,
    durationSec: 15 * 60,
    timer: null,
    answers: []
  };

  const FALLBACK_MOCK_QUESTIONS = [
    { q: 'What is the difference between WHERE and HAVING?', a: 'WHERE filters rows before grouping. HAVING filters groups after GROUP BY and can use aggregates.' },
    { q: 'Explain INNER JOIN vs LEFT JOIN with a use case.', a: 'INNER JOIN returns matching rows from both tables. LEFT JOIN returns all left rows and matching right rows (or NULL). Use LEFT JOIN to keep unmatched master records.' },
    { q: 'How do you remove duplicates in SQL?', a: 'Use SELECT DISTINCT for result-level dedupe or GROUP BY. For row-level dedupe in table data use window functions + delete strategy.' },
    { q: 'What is a window function and why is it useful?', a: 'A window function computes values across a related set of rows without collapsing rows, e.g. ROW_NUMBER, RANK, SUM OVER.' },
    { q: 'How do you find top 3 products per category?', a: 'Use ROW_NUMBER() OVER(PARTITION BY category ORDER BY metric DESC) and filter row_number <= 3.' },
    { q: 'Difference between COUNT(*) and COUNT(column)?', a: 'COUNT(*) counts all rows; COUNT(column) ignores NULLs in that column.' },
    { q: 'What is normalization? Explain 1NF, 2NF, 3NF.', a: 'Normalization organizes data to reduce redundancy. 1NF atomic values, 2NF full dependency on key, 3NF no transitive dependency.' },
    { q: 'How do you handle NULL safely in calculations?', a: 'Use COALESCE/IFNULL to replace NULL defaults, and use IS NULL checks. Avoid direct arithmetic on NULL without fallback.' },
    { q: 'Write logic for month-over-month growth.', a: 'Aggregate by month, then use LAG(month_value) OVER(ORDER BY month) and compute (current - previous)/previous.' },
    { q: 'What are CTEs and when do you use them?', a: 'CTEs (WITH clauses) improve readability and modularize complex queries; useful for multi-step transformations and recursion.' },
    { q: 'How do indexes improve query performance?', a: 'Indexes speed filtering/joining/sorting by reducing scanned rows. They cost extra storage and slower writes.' },
    { q: 'What is the SQL execution order?', a: 'FROM/JOIN -> WHERE -> GROUP BY -> HAVING -> SELECT -> DISTINCT -> ORDER BY -> LIMIT.' },
    { q: 'How would you detect data quality issues in orders?', a: 'Check null keys, invalid statuses, negative amounts, orphan foreign keys, duplicate IDs, and date inconsistencies.' },
    { q: 'Difference between UNION and UNION ALL?', a: 'UNION removes duplicates (extra sort/hash cost). UNION ALL keeps all rows and is faster.' },
    { q: 'How to calculate retention cohort in SQL?', a: 'Derive signup cohort month, map user activities by month offset, then aggregate active users per cohort-period.' },
  ];

  function collectInterviewQuestions() {
    const q = [];
    const panelQuestions = (typeof PANEL_IQS !== 'undefined' && Array.isArray(PANEL_IQS)) ? PANEL_IQS : (window.PANEL_IQS || []);
    const modulesRef = (typeof MODULES !== 'undefined' && Array.isArray(MODULES)) ? MODULES : (window.MODULES || []);

    panelQuestions.forEach(item => q.push({ q: item.q, a: item.a }));
    modulesRef.forEach(m => {
      (m.lessons || []).forEach(l => {
        if (l.isInterviewLesson && Array.isArray(l.interviewQuestions)) {
          l.interviewQuestions.forEach(iq => q.push({ q: iq.q, a: iq.a }));
        }
      });
    });
    return q.length ? q : FALLBACK_MOCK_QUESTIONS.slice();
  }

  function sampleQuestions(all, n) {
    const arr = all.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr.slice(0, n);
  }

  function keywordSet(text) {
    return new Set(
      String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s_]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3)
    );
  }

  function answerScore(userAns, expectedAns) {
    const u = keywordSet(userAns);
    const e = keywordSet(expectedAns);
    if (u.size === 0) return 0;
    let hit = 0;
    e.forEach(k => { if (u.has(k)) hit++; });
    const coverage = e.size ? hit / e.size : 0;
    return Math.min(100, Math.round(coverage * 100));
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function renderMockInterview() {
    const card = document.getElementById('mim-card');
    if (!card) return;

    const q = mockState.questions[mockState.idx];
    const remaining = Math.max(0, mockState.durationSec - Math.floor((Date.now() - mockState.startedAt) / 1000));

    if (!q) {
      const max = mockState.questions.length * 100;
      const pct = max ? Math.round((mockState.score / max) * 100) : 0;
      card.innerHTML = `
        <div class="mim-top">
          <div class="mim-title">Mock Interview Result</div>
          <div class="mim-timer">Completed</div>
        </div>
        <div class="mim-score"><strong>Total Score:</strong> ${mockState.score} / ${max} (${pct}%)</div>
        <div class="mim-note">${pct >= 75 ? 'Strong performance. You are interview-ready.' : pct >= 50 ? 'Decent baseline. Revise weak areas and retry.' : 'Needs improvement. Practice more challenge modules and retry.'}</div>
        <div class="mim-actions">
          <button class="btn-nav btn-next-l" onclick="startMockInterview()">Retry</button>
          <button class="btn-nav btn-prev-l" onclick="closeMockInterview()">Close</button>
        </div>
      `;
      return;
    }

    card.innerHTML = `
      <div class="mim-top">
        <div class="mim-title">Mock SQL Interview</div>
        <div class="mim-timer">Time Left: ${formatTime(remaining)}</div>
      </div>
      <div class="mim-note">Question ${mockState.idx + 1} of ${mockState.questions.length}</div>
      <div class="mim-q">${escHtml(q.q)}</div>
      <textarea id="mim-answer" class="mim-answer" placeholder="Write your interview answer here..."></textarea>
      <div class="mim-actions">
        <button class="btn-nav btn-next-l" onclick="submitMockAnswer()">Submit & Next</button>
        <button class="btn-nav btn-prev-l" onclick="skipMockQuestion()">Skip</button>
        <button class="btn-nav btn-prev-l" onclick="endMockInterview()">End Interview</button>
      </div>
      <div class="mim-note">Tip: Explain concept, then give SQL pattern/example.</div>
    `;
  }

  function tickMockTimer() {
    const remaining = Math.max(0, mockState.durationSec - Math.floor((Date.now() - mockState.startedAt) / 1000));
    const timerEl = document.querySelector('.mim-timer');
    if (timerEl) timerEl.textContent = `Time Left: ${formatTime(remaining)}`;
    if (remaining <= 0) {
      endMockInterview();
    }
  }

  window.startMockInterview = function () {
    ensureMockInterviewUi();
    const all = collectInterviewQuestions();
    if (!all.length) {
      alert('No interview questions found. Please refresh and try again.');
      return;
    }
    mockState.questions = sampleQuestions(all, Math.min(8, all.length));
    mockState.idx = 0;
    mockState.score = 0;
    mockState.answers = [];
    mockState.startedAt = Date.now();

    if (mockState.timer) clearInterval(mockState.timer);
    mockState.timer = setInterval(tickMockTimer, 1000);

    document.getElementById('mock-interview-modal').style.display = 'flex';
    renderMockInterview();
  };

  window.openMockInterview = function () {
    startMockInterview();
  };

  window.submitMockAnswer = function () {
    const q = mockState.questions[mockState.idx];
    if (!q) return;
    const ansEl = document.getElementById('mim-answer');
    const ans = ansEl ? ansEl.value.trim() : '';
    const sc = answerScore(ans, q.a);
    mockState.score += sc;
    mockState.answers.push({ q: q.q, userAnswer: ans, expected: q.a, score: sc });
    mockState.idx++;
    renderMockInterview();
  };

  window.skipMockQuestion = function () {
    const q = mockState.questions[mockState.idx];
    if (q) mockState.answers.push({ q: q.q, userAnswer: '', expected: q.a, score: 0 });
    mockState.idx++;
    renderMockInterview();
  };

  window.endMockInterview = function () {
    if (mockState.timer) {
      clearInterval(mockState.timer);
      mockState.timer = null;
    }
    mockState.idx = mockState.questions.length;
    renderMockInterview();
  };

  window.closeMockInterview = function () {
    if (mockState.timer) {
      clearInterval(mockState.timer);
      mockState.timer = null;
    }
    const modal = document.getElementById('mock-interview-modal');
    if (modal) modal.style.display = 'none';
  };

  function initAdvancedFeatures() {
    ensureMockInterviewUi();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdvancedFeatures);
  } else {
    initAdvancedFeatures();
  }
})();
