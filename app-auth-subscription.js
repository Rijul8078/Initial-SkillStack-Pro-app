(function () {
  const API_BASE = '/api';
  const AUTH_KEY = 'skillstack_auth_v1';
  const SUB_KEY = 'skillstack_subscription_v1';

  let appConfig = {
    freeModuleCount: 2,
    subscriptionAmountInr: 1499,
    razorpayKeyId: '',
  };
  const FREE_MODULE_INDEX = 0; // Module 1 (0-based index)
  const FREE_LESSON_COUNT = 3; // First 3 lessons only
  const localFallback = {
    doLogin: window.doLogin,
    doRegister: window.doRegister,
    saveUserProgress: window.saveUserProgress,
    loadUserProgress: window.loadUserProgress,
    getAllUsers: window.getAllUsers,
    deleteUser: window.deleteUser,
    loadLearnerCount: window.loadLearnerCount,
  };

  let authSession = null;
  let subscriptionState = { status: 'free', plan: 'free' };
  let appliedPromoCode = '';
  let promoPricing = {
    originalAmount: Math.round(Number(appConfig.subscriptionAmountInr || 1499) * 100),
    discountAmount: 0,
    finalAmount: Math.round(Number(appConfig.subscriptionAmountInr || 1499) * 100),
    currency: 'INR',
  };

  function parseJsonSafe(value, fallback) {
    try {
      return JSON.parse(value);
    } catch (_) {
      return fallback;
    }
  }

  function loadLocalSession() {
    authSession = parseJsonSafe(localStorage.getItem(AUTH_KEY), null);
    subscriptionState = parseJsonSafe(localStorage.getItem(SUB_KEY), { status: 'free', plan: 'free' });
  }

  function saveLocalSession(session, subscription) {
    authSession = session || null;
    subscriptionState = subscription || { status: 'free', plan: 'free' };
    if (authSession) localStorage.setItem(AUTH_KEY, JSON.stringify(authSession));
    else localStorage.removeItem(AUTH_KEY);
    localStorage.setItem(SUB_KEY, JSON.stringify(subscriptionState));
  }

  function getAccessToken() {
    return authSession && authSession.access_token ? authSession.access_token : null;
  }

  function formatInrFromPaise(paise) {
    return Math.round(Number(paise || 0) / 100);
  }

  async function api(path, options) {
    const opts = Object.assign({ method: 'GET', auth: true, body: null }, options || {});
    const headers = { 'Content-Type': 'application/json' };
    if (opts.auth && getAccessToken()) {
      headers.Authorization = `Bearer ${getAccessToken()}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
      method: opts.method,
      headers,
      body: opts.body ? JSON.stringify(opts.body) : null,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Request failed.');
    }

    return data;
  }

  function hasActiveSubscription() {
    if (currentUser && currentUser.role === 'admin') return true;
    if (!subscriptionState || subscriptionState.status !== 'active') return false;
    if (!subscriptionState.ends_at) return true;
    return new Date(subscriptionState.ends_at).getTime() > Date.now();
  }

  function isLessonLocked(moduleIndex, lessonIndex) {
    if (hasActiveSubscription()) return false;
    if (moduleIndex !== FREE_MODULE_INDEX) return true;
    return lessonIndex >= FREE_LESSON_COUNT;
  }

  function isModuleLocked(moduleIndex) {
    if (hasActiveSubscription()) return false;
    return moduleIndex !== FREE_MODULE_INDEX;
  }

  function ensureTopbarSubscriptionCta() {
    if (document.getElementById('sub-cta-btn')) return;
    const target = document.querySelector('.topbar-right');
    if (!target) return;

    const btn = document.createElement('button');
    btn.id = 'sub-cta-btn';
    btn.className = 'btn-subscribe-top';
    btn.onclick = openSubscriptionModal;
    target.insertBefore(btn, target.firstChild);
  }

  function updateSubscriptionUi() {
    ensureTopbarSubscriptionCta();
    const btn = document.getElementById('sub-cta-btn');
    if (!btn) return;

    if (currentUser && currentUser.role === 'admin') {
      btn.textContent = 'Admin Access';
      btn.classList.add('active');
      return;
    }

    if (hasActiveSubscription()) {
      btn.textContent = 'Pro Active';
      btn.classList.add('active');
    } else {
      btn.textContent = `Upgrade INR ${Number(appConfig.subscriptionAmountInr || 1499)}`;
      btn.classList.remove('active');
    }
  }

  function ensureSubscriptionModal() {
    if (document.getElementById('subscription-modal')) return;

    const wrap = document.createElement('div');
    wrap.id = 'subscription-modal';
    wrap.className = 'sub-overlay';
    wrap.innerHTML = `
      <div class="sub-card">
        <div class="sub-title">Unlock Full SkillStack Pro</div>
        <div class="sub-price">INR <span id="sub-price-value">${Number(appConfig.subscriptionAmountInr || 1499)}</span> / year</div>
        <div class="sub-list">Free access: only Module 1, first ${FREE_LESSON_COUNT} lessons. Upgrade to unlock all remaining lessons, projects, and interview prep.</div>
        <div class="sub-methods">Payment methods: UPI, Cards, Netbanking, Wallets</div>
        <div class="promo-row">
          <input id="promo-code-input" class="promo-input" placeholder="Have a promo code? (example: SAVE1000)" />
          <button class="promo-apply" onclick="applyPromoCode()">Apply</button>
          <button class="promo-clear" onclick="clearPromoCode()">Clear</button>
        </div>
        <div class="promo-msg" id="promo-msg"></div>
        <div class="promo-breakdown" id="promo-breakdown">
          <div>Original: <b id="promo-original">INR ${Number(appConfig.subscriptionAmountInr || 1499)}</b></div>
          <div>Discount: <b id="promo-discount">INR 0</b></div>
          <div>Payable: <b id="promo-final">INR ${Number(appConfig.subscriptionAmountInr || 1499)}</b></div>
        </div>
        <div class="sub-actions">
          <button class="btn-sub btn-sub-cancel" onclick="closeSubscriptionModal()">Maybe Later</button>
          <button class="btn-sub btn-sub-pay" id="sub-pay-btn" onclick="startSubscriptionCheckout()">Pay & Unlock</button>
        </div>
      </div>
    `;

    wrap.addEventListener('click', function (e) {
      if (e.target === wrap) closeSubscriptionModal();
    });

    document.body.appendChild(wrap);
  }

  function updatePromoBreakdownUi() {
    const o = document.getElementById('promo-original');
    const d = document.getElementById('promo-discount');
    const f = document.getElementById('promo-final');
    const p = document.getElementById('sub-price-value');
    if (o) o.textContent = `INR ${formatInrFromPaise(promoPricing.originalAmount)}`;
    if (d) d.textContent = `INR ${formatInrFromPaise(promoPricing.discountAmount)}`;
    if (f) f.textContent = `INR ${formatInrFromPaise(promoPricing.finalAmount)}`;
    if (p) p.textContent = String(formatInrFromPaise(promoPricing.finalAmount));
  }

  function setPromoMessage(text, ok) {
    const el = document.getElementById('promo-msg');
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('ok', !!ok);
    el.classList.toggle('err', !!text && !ok);
  }

  function showInlineMessage(containerId, text, type) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `<div class="msg ${type}">${text}</div>`;
  }

  window.openSubscriptionModal = function () {
    if (currentUser && currentUser.role === 'admin') return;
    if (!currentUser) {
      showAuthScreen();
      switchAuthTab('login');
      showAuthMsg('info', 'login-msg', 'Please sign in to upgrade your subscription.');
      return;
    }
    ensureSubscriptionModal();
    const overlay = document.getElementById('subscription-modal');
    promoPricing = {
      originalAmount: Math.round(Number(appConfig.subscriptionAmountInr || 1499) * 100),
      discountAmount: 0,
      finalAmount: Math.round(Number(appConfig.subscriptionAmountInr || 1499) * 100),
      currency: 'INR',
    };
    appliedPromoCode = '';
    const input = document.getElementById('promo-code-input');
    if (input) input.value = '';
    setPromoMessage('', true);
    updatePromoBreakdownUi();
    overlay.style.display = 'flex';
  };

  window.closeSubscriptionModal = function () {
    const overlay = document.getElementById('subscription-modal');
    if (overlay) overlay.style.display = 'none';
  };

  window.applyPromoCode = async function () {
    const input = document.getElementById('promo-code-input');
    const code = (input && input.value ? input.value : '').trim();
    if (!code) {
      setPromoMessage('Enter a promo code first.', false);
      return;
    }
    try {
      setPromoMessage('Validating promo code...', true);
      const data = await api('/validate-promo', { method: 'POST', body: { promoCode: code }, auth: true });
      appliedPromoCode = data.promoCodeApplied || '';
      promoPricing = {
        originalAmount: data.originalAmount,
        discountAmount: data.discountAmount,
        finalAmount: data.finalAmount,
        currency: data.currency || 'INR',
      };
      updatePromoBreakdownUi();
      setPromoMessage(`Promo applied: ${appliedPromoCode} (INR ${formatInrFromPaise(promoPricing.discountAmount)} off)`, true);
    } catch (err) {
      appliedPromoCode = '';
      promoPricing = {
        originalAmount: Math.round(Number(appConfig.subscriptionAmountInr || 1499) * 100),
        discountAmount: 0,
        finalAmount: Math.round(Number(appConfig.subscriptionAmountInr || 1499) * 100),
        currency: 'INR',
      };
      updatePromoBreakdownUi();
      setPromoMessage(err.message || 'Invalid promo code.', false);
    }
  };

  window.clearPromoCode = function () {
    appliedPromoCode = '';
    promoPricing = {
      originalAmount: Math.round(Number(appConfig.subscriptionAmountInr || 1499) * 100),
      discountAmount: 0,
      finalAmount: Math.round(Number(appConfig.subscriptionAmountInr || 1499) * 100),
      currency: 'INR',
    };
    const input = document.getElementById('promo-code-input');
    if (input) input.value = '';
    updatePromoBreakdownUi();
    setPromoMessage('Promo code removed.', true);
  };

  window.startSubscriptionCheckout = async function () {
    const btn = document.getElementById('sub-pay-btn');
    if (!btn) return;

    try {
      btn.disabled = true;
      btn.textContent = 'Preparing payment...';

      const order = await api('/create-subscription-order', {
        method: 'POST',
        body: { plan: 'pro', promoCode: appliedPromoCode || '' },
        auth: true,
      });
      promoPricing = {
        originalAmount: order.originalAmount || Math.round(Number(appConfig.subscriptionAmountInr || 1499) * 100),
        discountAmount: order.discountAmount || 0,
        finalAmount: order.amount || Math.round(Number(appConfig.subscriptionAmountInr || 1499) * 100),
        currency: order.currency || 'INR',
      };
      appliedPromoCode = order.promoCodeApplied || '';
      updatePromoBreakdownUi();

      if (!window.Razorpay) throw new Error('Razorpay SDK not loaded.');
      if (!appConfig.razorpayKeyId) throw new Error('Missing Razorpay key id in env.');

      const options = {
        key: appConfig.razorpayKeyId,
        amount: order.amount,
        currency: order.currency,
        name: 'SkillStack Pro',
        description: 'Pro Subscription',
        order_id: order.orderId,
        prefill: {
          name: order.user.name || currentUser.name,
          email: order.user.email || currentUser.email,
        },
        theme: {
          color: '#00d4ff',
        },
        method: {
          upi: true,
          card: true,
          netbanking: true,
          wallet: true,
        },
        handler: async function (payment) {
          try {
            const verify = await api('/verify-subscription-payment', {
              method: 'POST',
              body: {
                razorpay_order_id: payment.razorpay_order_id,
                razorpay_payment_id: payment.razorpay_payment_id,
                razorpay_signature: payment.razorpay_signature,
                plan: 'pro',
                promoCode: appliedPromoCode || '',
              },
              auth: true,
            });

            subscriptionState = verify.subscription;
            localStorage.setItem(SUB_KEY, JSON.stringify(subscriptionState));
            closeSubscriptionModal();
            updateSubscriptionUi();
            renderSidebar(document.getElementById('search-input').value || '');
            showInlineMessage('lesson-content', 'Subscription active. All modules unlocked.', 'msg-success');
          } catch (err) {
            alert(err.message || 'Payment verification failed.');
          }
        },
      };

      const rz = new Razorpay(options);
      rz.open();
    } catch (err) {
      alert(err.message || 'Could not start payment.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Pay & Unlock';
    }
  };

  async function loadAppConfig() {
    try {
      const data = await api('/public-config', { method: 'GET', auth: false });
      appConfig = Object.assign(appConfig, data || {});
    } catch (_) {}
  }

  const _origRenderSidebar = window.renderSidebar;
  window.renderSidebar = function (filter = '') {
    const el = document.getElementById('sidebar-list');
    let html = '';
    const selectedTrack = window.__activeTrackId || 'sql';

    MODULES.forEach((mod, mi) => {
      const modTrack = mod.track || 'sql';
      if (modTrack !== selectedTrack) return;
      const matchLessons = mod.lessons.filter((l) => !filter || l.title.toLowerCase().includes(filter.toLowerCase()));
      if (filter && matchLessons.length === 0) return;

      const locked = isModuleLocked(mi);

      html += `<div class="module-header" onclick="toggleModule(${mi})">
        <span class="module-icon">${mod.icon}</span>
        <span class="module-name">${mod.name}</span>
        <span class="module-count">${mod.lessons.length}</span>
        ${locked ? '<span class="module-lock">LOCKED</span>' : ''}
        <span class="module-arrow open" id="marr-${mi}">?</span>
      </div><div id="mlessons-${mi}">`;

      matchLessons.forEach((l) => {
        const li = mod.lessons.indexOf(l);
        const done = isChallengesDone(mi, li);
        const active = currentLessonPath && currentLessonPath.mi === mi && currentLessonPath.li === li;
        const lessonLocked = isLessonLocked(mi, li);

        html += `<div class="lesson-btn ${done ? 'completed' : ''} ${active ? 'active' : ''} ${lessonLocked ? 'locked' : ''}" onclick="loadLesson(${mi},${li})" id="lb-${mi}-${li}">
          <div class="l-num">${done ? '?' : (mi * 10 + li + 1)}</div>
          <div class="l-info">
            <div class="l-name">${l.title}</div>
            <div class="l-sub">${l.sub}</div>
          </div>
          ${lessonLocked ? '<span class="l-lock">PRO</span>' : `<span class="l-diff diff-${l.diff}">${l.diff}</span>`}
        </div>`;
      });

      html += '</div>';
    });

    el.innerHTML = html;
  };

  const _origLoadLesson = window.loadLesson;
  window.loadLesson = function (mi, li) {
    if (isLessonLocked(mi, li)) {
      openSubscriptionModal();
      return;
    }
    _origLoadLesson(mi, li);
  };

  const _origSwitchPanel = window.switchPanel;
  window.switchPanel = function (panel, el) {
    if (panel === 'iq' && !hasActiveSubscription()) {
      openSubscriptionModal();
      return;
    }
    _origSwitchPanel(panel, el);
  };

  const _origStartLearning = window.startLearning;
  window.startLearning = function () {
    if (_origStartLearning) _origStartLearning();
  };

  const _origShowAuthScreen = window.showAuthScreen;
  window.showAuthScreen = function () {
    if (currentUser) return;
    _origShowAuthScreen();
  };

  window.saveUserProgress = async function () {
    if (!currentUser || !getAccessToken()) return;
    try {
      await api('/progress', {
        method: 'POST',
        body: {
          completedChallenges,
          xp,
        },
        auth: true,
      });
    } catch (_) {
      if (typeof localFallback.saveUserProgress === 'function') {
        return localFallback.saveUserProgress();
      }
    }
  };

  window.loadUserProgress = async function () {
    if (!currentUser || !getAccessToken()) {
      if (typeof localFallback.loadUserProgress === 'function') {
        return localFallback.loadUserProgress();
      }
      return;
    }
    try {
      const data = await api('/progress', { method: 'GET', auth: true });
      completedChallenges = data.completedChallenges || {};
      xp = data.xp || 0;
      document.getElementById('xp-val').textContent = xp;
      document.getElementById('lv-val').textContent = Math.floor(xp / 500) + 1;
      const done = MODULES.reduce((s, m, mi) => s + m.lessons.filter((_, li) => isChallengesDone(mi, li)).length, 0);
      document.getElementById('streak-val').textContent = done;
      const pct = Math.round((done / totalLessons) * 100);
      document.getElementById('prog-fill').style.width = `${pct}%`;
      document.getElementById('prog-text').textContent = `${done} / ${totalLessons}`;
    } catch (_) {
      if (typeof localFallback.loadUserProgress === 'function') {
        return localFallback.loadUserProgress();
      }
    }
  };

  window.getAllUsers = async function () {
    try {
      const data = await api('/admin-users', { method: 'GET', auth: true });
      return data.users || [];
    } catch (_) {
      if (typeof localFallback.getAllUsers === 'function') return localFallback.getAllUsers();
      return [];
    }
  };

  window.deleteUser = async function (userId) {
    if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) return;
    try {
      await api('/admin-action', { method: 'POST', body: { action: 'delete_user', userId }, auth: true });
      await loadAdminData();
    } catch (err) {
      alert(err.message || 'Error deleting user.');
    }
  };

  window.setUserRole = async function (userId, role) {
    try {
      await api('/admin-action', { method: 'POST', body: { action: 'update_role', userId, role }, auth: true });
      await loadAdminData();
    } catch (err) {
      alert(err.message || 'Failed to update role.');
    }
  };

  window.setUserSuspension = async function (userId, isSuspended) {
    try {
      await api('/admin-action', { method: 'POST', body: { action: 'set_suspension', userId, isSuspended }, auth: true });
      await loadAdminData();
    } catch (err) {
      alert(err.message || 'Failed to update suspension.');
    }
  };

  window.updateUserSubscription = async function (userId, status) {
    try {
      await api('/admin-action', { method: 'POST', body: { action: 'update_subscription', userId, status, plan: 'pro', months: 12 }, auth: true });
      await loadAdminData();
    } catch (err) {
      alert(err.message || 'Failed to update subscription.');
    }
  };

  window.grantFullAccess = async function (userId) {
    try {
      await api('/admin-action', {
        method: 'POST',
        body: { action: 'update_subscription', userId, status: 'active', plan: 'pro', months: 12 },
        auth: true,
      });
      await loadAdminData();
    } catch (err) {
      alert(err.message || 'Failed to grant full access.');
    }
  };

  window.revokeFullAccess = async function (userId) {
    try {
      await api('/admin-action', {
        method: 'POST',
        body: { action: 'update_subscription', userId, status: 'free', plan: 'free', months: 0 },
        auth: true,
      });
      await loadAdminData();
    } catch (err) {
      alert(err.message || 'Failed to revoke access.');
    }
  };

  window.resetUserProgress = async function (userId) {
    if (!confirm('Reset this user progress to zero?')) return;
    try {
      await api('/admin-action', { method: 'POST', body: { action: 'reset_progress', userId }, auth: true });
      await loadAdminData();
    } catch (err) {
      alert(err.message || 'Failed to reset progress.');
    }
  };

  function toCsvValue(v) {
    const s = String(v ?? '');
    return `"${s.replace(/"/g, '""')}"`;
  }

  window.exportUsersCsv = async function () {
    const users = await getAllUsers();
    const header = ['Name', 'Email', 'Role', 'Suspended', 'Subscription', 'Plan', 'XP', 'Challenges', 'Joined', 'LastActive'];
    const rows = users.map(u => [
      u.name, u.email, u.role, u.isSuspended ? 'yes' : 'no', u.subscriptionStatus || 'free',
      u.subscriptionPlan || 'free', u.xp || 0, u.challengeCount || 0, u.joinedAt || '', u.lastActive || ''
    ]);
    const csv = [header, ...rows].map(r => r.map(toCsvValue).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skillstack-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  function ensurePromoAdminUi() {
    const adminContent = document.querySelector('#admin-screen .admin-content');
    if (!adminContent || document.getElementById('promo-admin-wrap')) return;
    const stats = adminContent.querySelector('.admin-stats-row');
    const wrap = document.createElement('div');
    wrap.id = 'promo-admin-wrap';
    wrap.className = 'admin-table-wrap';
    wrap.style.marginBottom = '18px';
    wrap.innerHTML = `
      <div class="admin-table-title">
        <span>Promo Codes</span>
        <button class="admin-refresh" onclick="loadPromoCodes()">Refresh Promos</button>
      </div>
      <div style="padding:14px;border-bottom:1px solid var(--border);display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <input id="promo-new-code" class="promo-admin-input" placeholder="CODE (e.g. SAVE1000)" />
        <select id="promo-new-type" class="admin-mini-select">
          <option value="flat">flat INR</option>
          <option value="percent">percent</option>
        </select>
        <input id="promo-new-value" class="promo-admin-input short" type="number" min="1" placeholder="Discount" />
        <input id="promo-new-max-uses" class="promo-admin-input short" type="number" min="1" placeholder="Max uses (optional)" />
        <button class="admin-refresh" onclick="createPromoCode()">Create Promo</button>
        <span id="promo-admin-msg" style="font-size:0.72rem;color:var(--muted2)"></span>
      </div>
      <div style="overflow:auto">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Code</th><th>Type</th><th>Discount</th><th>Usage</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody id="promo-admin-tbody">
            <tr><td colspan="6" style="color:var(--muted);padding:14px">Loading promo codes...</td></tr>
          </tbody>
        </table>
      </div>
    `;
    if (stats && stats.nextSibling) adminContent.insertBefore(wrap, stats.nextSibling);
    else adminContent.appendChild(wrap);
  }

  function setPromoAdminMsg(text, ok) {
    const el = document.getElementById('promo-admin-msg');
    if (!el) return;
    el.textContent = text || '';
    el.style.color = ok ? '#10e078' : '#f43f5e';
  }

  window.loadPromoCodes = async function () {
    const tbody = document.getElementById('promo-admin-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="color:var(--muted);padding:14px">Loading...</td></tr>';
    try {
      const data = await api('/admin-action', { method: 'POST', body: { action: 'list_promos' }, auth: true });
      const promos = data.promos || [];
      if (promos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="color:var(--muted);padding:14px">No promo codes yet.</td></tr>';
        return;
      }
      tbody.innerHTML = promos.map((p) => `
        <tr>
          <td><strong>${p.code}</strong></td>
          <td>${p.discount_type}</td>
          <td>
            <input class="promo-admin-input short" type="number" min="1" value="${p.discount_value}" id="promo-disc-${p.id}" />
            ${p.discount_type === 'percent' ? '<span style="font-size:0.7rem;color:var(--muted)">%</span>' : '<span style="font-size:0.7rem;color:var(--muted)">INR</span>'}
          </td>
          <td>${p.used_count || 0}${p.max_uses ? ` / ${p.max_uses}` : ''}</td>
          <td>${p.is_active ? '<span class="admin-badge badge-active">active</span>' : '<span class="admin-badge" style="background:#64748b20;color:#94a3b8">inactive</span>'}</td>
          <td style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="admin-refresh" onclick="updatePromoDiscount('${p.id}')">Save Discount</button>
            <button class="btn-admin-del" style="border-color:${p.is_active ? '#f59e0b40' : '#10e07840'};color:${p.is_active ? '#f59e0b' : '#10e078'}" onclick="togglePromoCode('${p.id}', ${!p.is_active})">${p.is_active ? 'Deactivate' : 'Activate'}</button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" style="color:var(--red);padding:14px">${err.message || 'Failed to load promo codes.'}</td></tr>`;
    }
  };

  window.createPromoCode = async function () {
    const code = (document.getElementById('promo-new-code')?.value || '').trim();
    const discountType = document.getElementById('promo-new-type')?.value || 'flat';
    const discountValue = Number(document.getElementById('promo-new-value')?.value || 0);
    const maxUsesRaw = document.getElementById('promo-new-max-uses')?.value || '';
    const maxUses = maxUsesRaw ? Number(maxUsesRaw) : null;
    if (!code || discountValue <= 0) {
      setPromoAdminMsg('Enter valid code and discount.', false);
      return;
    }
    try {
      await api('/admin-action', {
        method: 'POST',
        body: { action: 'create_promo', code, discountType, discountValue, maxUses },
        auth: true,
      });
      setPromoAdminMsg('Promo code created.', true);
      document.getElementById('promo-new-code').value = '';
      document.getElementById('promo-new-value').value = '';
      document.getElementById('promo-new-max-uses').value = '';
      await loadPromoCodes();
    } catch (err) {
      setPromoAdminMsg(err.message || 'Failed to create promo.', false);
    }
  };

  window.togglePromoCode = async function (promoId, isActive) {
    try {
      await api('/admin-action', { method: 'POST', body: { action: 'update_promo', promoId, isActive }, auth: true });
      setPromoAdminMsg(`Promo ${isActive ? 'activated' : 'deactivated'}.`, true);
      await loadPromoCodes();
    } catch (err) {
      setPromoAdminMsg(err.message || 'Failed to update promo.', false);
    }
  };

  window.updatePromoDiscount = async function (promoId) {
    const el = document.getElementById(`promo-disc-${promoId}`);
    const discountValue = Number(el?.value || 0);
    if (discountValue <= 0) {
      setPromoAdminMsg('Discount must be greater than 0.', false);
      return;
    }
    try {
      await api('/admin-action', { method: 'POST', body: { action: 'update_promo', promoId, discountValue }, auth: true });
      setPromoAdminMsg('Promo discount updated.', true);
      await loadPromoCodes();
    } catch (err) {
      setPromoAdminMsg(err.message || 'Failed to update discount.', false);
    }
  };

  window.loadAdminData = async function () {
    const tbody = document.getElementById('admin-user-tbody');
    if (!tbody) return;
    ensurePromoAdminUi();
    await loadPromoCodes();

    tbody.innerHTML = '<tr><td colspan="8" style="color:var(--muted);padding:20px;text-align:center">Loading...</td></tr>';
    const users = await getAllUsers();
    const countLabel = document.getElementById('admin-user-count-label');
    if (countLabel) countLabel.textContent = `${users.length} users`;

    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const active = users.filter(u => u.lastActive && (now - new Date(u.lastActive).getTime()) < sevenDays).length;
    const avgXp = users.length ? Math.round(users.reduce((s, u) => s + (u.xp || 0), 0) / users.length) : 0;
    const avgCh = users.length ? Math.round(users.reduce((s, u) => s + (u.challengeCount || 0), 0) / users.length) : 0;

    const elTotal = document.getElementById('as-total');
    const elActive = document.getElementById('as-active');
    const elXp = document.getElementById('as-xp');
    const elComplete = document.getElementById('as-complete');
    if (elTotal) elTotal.textContent = users.length;
    if (elActive) elActive.textContent = active;
    if (elXp) elXp.textContent = avgXp;
    if (elComplete) elComplete.textContent = avgCh;

    const tableTitle = document.querySelector('.admin-table-title');
    if (tableTitle && !document.getElementById('admin-export-btn')) {
      const btn = document.createElement('button');
      btn.id = 'admin-export-btn';
      btn.className = 'admin-refresh';
      btn.style.marginLeft = '8px';
      btn.textContent = 'Export CSV';
      btn.onclick = exportUsersCsv;
      tableTitle.appendChild(btn);
    }

    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="color:var(--muted);padding:20px;text-align:center">No users registered yet.</td></tr>';
      return;
    }

    users.sort((a, b) => new Date(b.joinedAt) - new Date(a.joinedAt));

    tbody.innerHTML = users.map(u => {
      const joined = u.joinedAt ? new Date(u.joinedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
      const lastActive = u.lastActive ? new Date(u.lastActive).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '-';
      const roleBadge = u.role === 'admin'
        ? '<span class="admin-badge badge-admin">Admin</span>'
        : (u.isSuspended ? '<span class="admin-badge" style="background:#f43f5e20;color:#f43f5e">Suspended</span>' : '<span class="admin-badge badge-active">Active</span>');
      const subBadge = `<span class="admin-badge" style="background:${u.subscriptionStatus === 'active' ? '#10e07820' : '#33415540'};color:${u.subscriptionStatus === 'active' ? '#10e078' : '#94a3b8'}">${u.subscriptionStatus || 'free'}</span>`;

      const roleSelect = `<select class="admin-mini-select" onchange="setUserRole('${u.id}', this.value)" ${u.id === currentUser?.id ? 'disabled' : ''}>
        <option value="user" ${u.role === 'user' ? 'selected' : ''}>user</option>
        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>admin</option>
      </select>`;

      const subSelect = `<select class="admin-mini-select" onchange="updateUserSubscription('${u.id}', this.value)">
        <option value="free" ${u.subscriptionStatus === 'free' ? 'selected' : ''}>free</option>
        <option value="active" ${u.subscriptionStatus === 'active' ? 'selected' : ''}>active</option>
        <option value="cancelled" ${u.subscriptionStatus === 'cancelled' ? 'selected' : ''}>cancelled</option>
        <option value="expired" ${u.subscriptionStatus === 'expired' ? 'selected' : ''}>expired</option>
      </select>`;

      const suspendBtn = `<button class="btn-admin-del" style="border-color:#334155;color:#94a3b8" onclick="setUserSuspension('${u.id}', ${!u.isSuspended})">${u.isSuspended ? 'Unsuspend' : 'Suspend'}</button>`;
      const resetBtn = `<button class="btn-admin-del" style="border-color:#fbbf2440;color:#fbbf24" onclick="resetUserProgress('${u.id}')">Reset XP</button>`;
      const grantBtn = `<button class="btn-admin-del" style="border-color:#10e07840;color:#10e078" onclick="grantFullAccess('${u.id}')">Grant Full</button>`;
      const revokeBtn = `<button class="btn-admin-del" style="border-color:#64748b40;color:#94a3b8" onclick="revokeFullAccess('${u.id}')">Revoke Full</button>`;
      const delBtn = u.role !== 'admin' ? `<button class="btn-admin-del" onclick="deleteUser('${u.id}')">Delete</button>` : '—';

      return `<tr>
        <td><strong>${u.name || 'User'}</strong></td>
        <td style="color:var(--muted2)">${u.email || '-'}</td>
        <td style="color:var(--muted2)">${joined}</td>
        <td><strong style="color:var(--yellow)">⭐ ${u.xp || 0}</strong><div style="font-size:0.66rem;color:var(--muted)">${u.challengeCount || 0} solved</div></td>
        <td>${roleBadge}<div style="margin-top:6px">${roleSelect}</div></td>
        <td>${subBadge}<div style="margin-top:6px">${subSelect}</div></td>
        <td style="color:var(--muted2)">${lastActive}</td>
        <td style="display:flex;gap:6px;flex-wrap:wrap">${grantBtn}${revokeBtn}${suspendBtn}${resetBtn}${delBtn}</td>
      </tr>`;
    }).join('');
  };

  window.loadLearnerCount = async function () {
    const el = document.getElementById('auth-user-count');
    if (el) el.textContent = 'Private';
  };

  window.doRegister = async function () {
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim().toLowerCase();
    const pw = document.getElementById('reg-password').value;

    if (!name || !email || !pw) {
      showAuthMsg('error', 'register-msg', 'Please fill in all fields.');
      return;
    }
    if (pw.length < 6) {
      showAuthMsg('error', 'register-msg', 'Password must be at least 6 characters.');
      return;
    }

    const btn = document.getElementById('btn-register');
    btn.disabled = true;
    btn.textContent = 'Creating account...';

    try {
      const data = await api('/register', { method: 'POST', auth: false, body: { name, email, password: pw } });

      if (data.emailConfirmationRequired) {
        showAuthMsg('success', 'register-msg', 'Account created. Please confirm email, then sign in.');
        switchAuthTab('login');
        document.getElementById('login-email').value = email;
      } else {
        currentUser = data.user;
        saveLocalSession(data.session, { status: 'free', plan: 'free' });
        onLoginSuccess();
      }
    } catch (err) {
      if (typeof localFallback.doRegister === 'function') return localFallback.doRegister();
      showAuthMsg('error', 'register-msg', err.message || 'Error creating account.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create Account ->';
    }
  };

  window.doLogin = async function () {
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const pw = document.getElementById('login-password').value;

    if (!email || !pw) {
      showAuthMsg('error', 'login-msg', 'Please fill in all fields.');
      return;
    }

    const btn = document.getElementById('btn-login');
    btn.disabled = true;
    btn.textContent = 'Signing in...';

    try {
      const data = await api('/login', { method: 'POST', auth: false, body: { email, password: pw } });
      currentUser = data.user;
      saveLocalSession(data.session, data.subscription || { status: 'free', plan: 'free' });
      await onLoginSuccess();
    } catch (err) {
      if (typeof localFallback.doLogin === 'function') return localFallback.doLogin();
      showAuthMsg('error', 'login-msg', err.message || 'Invalid email or password.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign In ->';
    }
  };

  const _origOnLoginSuccess = window.onLoginSuccess;
  window.onLoginSuccess = async function () {
    await _origOnLoginSuccess();
    updateSubscriptionUi();
    renderSidebar(document.getElementById('search-input').value || '');
  };

  const _origDoLogout = window.doLogout;
  window.doLogout = async function () {
    try {
      await api('/logout', { method: 'POST', auth: true });
    } catch (_) {}

    await _origDoLogout();
    saveLocalSession(null, { status: 'free', plan: 'free' });
    updateSubscriptionUi();
  };

  function injectStyles() {
    if (document.getElementById('subscription-style')) return;
    const style = document.createElement('style');
    style.id = 'subscription-style';
    style.textContent = `
      .btn-subscribe-top{background:linear-gradient(135deg,#ffb703,#fb8500);color:#160800;border:none;border-radius:10px;padding:8px 14px;font-family:'Cabinet Grotesk',sans-serif;font-size:12px;font-weight:800;cursor:pointer;box-shadow:0 6px 20px #fb850040;transition:transform .2s ease}
      .btn-subscribe-top:hover{transform:translateY(-1px)}
      .btn-subscribe-top.active{background:linear-gradient(135deg,#06d6a0,#00b4d8);color:#032221;box-shadow:0 6px 20px #00b4d840}
      .module-lock{font-size:10px;font-weight:800;color:#fb8500;background:#fb850020;border:1px solid #fb850055;padding:2px 6px;border-radius:999px}
      .lesson-btn.locked{opacity:.84}
      .l-lock{font-size:10px;font-weight:800;color:#fbbf24;background:#fbbf2420;border:1px solid #fbbf2440;padding:2px 6px;border-radius:999px}
      .sub-overlay{display:none;position:fixed;inset:0;background:#020617cc;z-index:9000;align-items:center;justify-content:center;padding:20px}
      .sub-card{width:min(520px,100%);background:linear-gradient(145deg,#0c1325,#1a213a);border:1px solid #2f3d5e;border-radius:18px;padding:26px;box-shadow:0 30px 80px #00000080}
      .sub-title{font-family:'Clash Display',sans-serif;font-size:28px;line-height:1.2;color:#f8fafc;margin-bottom:8px}
      .sub-price{font-family:'IBM Plex Mono',monospace;font-size:22px;color:#00d4ff;margin-bottom:12px}
      .sub-list{font-size:14px;line-height:1.7;color:#cbd5e1;margin-bottom:8px}
      .sub-methods{font-size:13px;color:#fbbf24;margin-bottom:18px}
      .promo-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px}
      .promo-input{flex:1;min-width:220px;background:#0b1220;border:1px solid #334155;border-radius:8px;padding:9px 10px;color:#e2e8f0;font-size:13px;font-family:'Cabinet Grotesk',sans-serif}
      .promo-apply,.promo-clear{border:1px solid #334155;background:#1e293b;color:#cbd5e1;border-radius:8px;padding:8px 10px;cursor:pointer;font-size:12px;font-weight:700}
      .promo-apply{background:#0f766e;border-color:#14b8a6;color:#ecfeff}
      .promo-msg{font-size:12px;min-height:16px;margin-bottom:8px}
      .promo-msg.ok{color:#10e078}
      .promo-msg.err{color:#f43f5e}
      .promo-breakdown{border:1px dashed #334155;border-radius:8px;padding:8px 10px;font-size:12px;color:#cbd5e1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:12px}
      .sub-actions{display:flex;gap:10px;justify-content:flex-end}
      .btn-sub{border-radius:10px;padding:10px 14px;font-size:13px;font-weight:800;cursor:pointer;font-family:'Cabinet Grotesk',sans-serif;border:none}
      .btn-sub-cancel{background:#1f2937;color:#cbd5e1;border:1px solid #334155}
      .btn-sub-pay{background:linear-gradient(135deg,#00d4ff,#3a86ff);color:#031322}
      .admin-mini-select{background:var(--card2);border:1px solid var(--border2);color:var(--text);border-radius:6px;padding:3px 8px;font-size:0.72rem;font-family:'Cabinet Grotesk',sans-serif}
      .promo-admin-input{background:var(--card2);border:1px solid var(--border2);color:var(--text);border-radius:6px;padding:6px 8px;font-size:0.72rem;font-family:'Cabinet Grotesk',sans-serif;min-width:170px}
      .promo-admin-input.short{min-width:110px;max-width:130px}
      @media (max-width: 640px){.sub-title{font-size:22px}.sub-card{padding:20px}.sub-actions{flex-direction:column}.btn-sub{width:100%}.promo-breakdown{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  async function restoreSessionIfAvailable() {
    loadLocalSession();
    if (!getAccessToken()) {
      updateSubscriptionUi();
      try {
        if (!currentUser) {
          document.getElementById('auth-screen').style.display = 'flex';
        }
      } catch (_) {}
      return;
    }

    try {
      const data = await api('/me', { method: 'GET', auth: true });
      currentUser = data.user;
      subscriptionState = data.subscription || { status: 'free', plan: 'free' };
      localStorage.setItem(SUB_KEY, JSON.stringify(subscriptionState));
      await onLoginSuccess();
    } catch (_) {
      saveLocalSession(null, { status: 'free', plan: 'free' });
      try {
        document.getElementById('auth-screen').style.display = 'flex';
      } catch (_) {}
    }

    updateSubscriptionUi();
  }

  async function bootstrap() {
    injectStyles();
    ensureSubscriptionModal();
    await loadAppConfig();
    updateSubscriptionUi();
    await restoreSessionIfAvailable();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
