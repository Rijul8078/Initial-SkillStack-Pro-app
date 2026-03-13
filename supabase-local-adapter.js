(function () {
  const host = window.location.hostname;
  const port = window.location.port;
  const isLocalStaticMode = (host === 'localhost' || host === '127.0.0.1') && (port === '5500' || port === '8000');
  if (!isLocalStaticMode) return;

  const SUPABASE_URL = "https://zukqkdttjsfcnrrmwpoy.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1a3FrZHR0anNmY25ycm13cG95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMTI1MDksImV4cCI6MjA4ODc4ODUwOX0.Gpjk3SseTsVhNfO_0TAbytbID6SmvBH_QYHPsAEg38E";

  if (!window.supabase || !window.supabase.createClient) return;

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  async function fetchProfileAndSub(userId) {
    const [{ data: profile }, { data: sub }] = await Promise.all([
      sb.from("profiles").select("full_name, role, created_at").eq("id", userId).maybeSingle(),
      sb.from("subscriptions").select("status, plan, started_at, ends_at").eq("user_id", userId).maybeSingle(),
    ]);
    return { profile, sub };
  }

  function applyProgressUI() {
    document.getElementById("xp-val").textContent = xp;
    document.getElementById("lv-val").textContent = Math.floor(xp / 500) + 1;
    const done = MODULES.reduce((s, m, mi) => s + m.lessons.filter((_, li) => isChallengesDone(mi, li)).length, 0);
    document.getElementById("streak-val").textContent = done;
    const pct = Math.round((done / totalLessons) * 100);
    document.getElementById("prog-fill").style.width = pct + "%";
    document.getElementById("prog-text").textContent = done + " / " + totalLessons;
  }

  window.loadLearnerCount = async function () {
    // RLS usually blocks global count for anon/auth users; show placeholder.
    const el = document.getElementById("auth-user-count");
    if (el) el.textContent = "Private";
  };

  window.doRegister = async function () {
    const name = document.getElementById("reg-name").value.trim();
    const email = document.getElementById("reg-email").value.trim().toLowerCase();
    const pw = document.getElementById("reg-password").value;

    if (!name || !email || !pw) {
      showAuthMsg("error", "register-msg", "Please fill in all fields.");
      return;
    }
    if (pw.length < 6) {
      showAuthMsg("error", "register-msg", "Password must be at least 6 characters.");
      return;
    }

    const btn = document.getElementById("btn-register");
    btn.disabled = true;
    btn.textContent = "Creating account...";

    try {
      const { data, error } = await sb.auth.signUp({
        email,
        password: pw,
        options: { data: { full_name: name } },
      });
      if (error) throw error;

      if (!data.session || !data.user) {
        showAuthMsg("success", "register-msg", "Account created. Confirm email, then sign in.");
        switchAuthTab("login");
        document.getElementById("login-email").value = email;
        return;
      }

      await sb.from("profiles").upsert({
        id: data.user.id,
        full_name: name,
        role: "user",
      });

      currentUser = {
        id: data.user.id,
        name,
        email: data.user.email,
        role: "user",
        joinedAt: data.user.created_at,
      };

      await onLoginSuccess();
    } catch (err) {
      showAuthMsg("error", "register-msg", err.message || "Registration failed.");
    } finally {
      btn.disabled = false;
      btn.textContent = "Create Account ->";
    }
  };

  window.doLogin = async function () {
    const email = document.getElementById("login-email").value.trim().toLowerCase();
    const pw = document.getElementById("login-password").value;

    if (!email || !pw) {
      showAuthMsg("error", "login-msg", "Please fill in all fields.");
      return;
    }

    const btn = document.getElementById("btn-login");
    btn.disabled = true;
    btn.textContent = "Signing in...";

    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });
      if (error) throw error;
      if (!data.user) throw new Error("User not found.");

      const info = await fetchProfileAndSub(data.user.id);
      currentUser = {
        id: data.user.id,
        name: info.profile?.full_name || data.user.user_metadata?.full_name || data.user.email,
        email: data.user.email,
        role: info.profile?.role || "user",
        joinedAt: info.profile?.created_at || data.user.created_at,
      };

      await onLoginSuccess();
    } catch (err) {
      showAuthMsg("error", "login-msg", err.message || "Invalid login credentials.");
    } finally {
      btn.disabled = false;
      btn.textContent = "Sign In ->";
    }
  };

  window.loadUserProgress = async function () {
    if (!currentUser) return;
    try {
      const { data } = await sb
        .from("user_progress")
        .select("completed_challenges, xp")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      completedChallenges = data?.completed_challenges || {};
      xp = data?.xp || 0;
      applyProgressUI();
    } catch (_) {}
  };

  window.saveUserProgress = async function () {
    if (!currentUser) return;
    try {
      await sb.from("user_progress").upsert({
        user_id: currentUser.id,
        completed_challenges: completedChallenges,
        xp: xp,
        last_active: new Date().toISOString(),
      });
    } catch (_) {}
  };

  const origLogout = window.doLogout;
  window.doLogout = async function () {
    try {
      await sb.auth.signOut();
    } catch (_) {}
    await origLogout();
  };

  window.getAllUsers = async function () {
    return [];
  };

  window.deleteUser = async function () {
    alert("Admin user management requires backend server mode.");
  };

  async function restoreSession() {
    try {
      const { data } = await sb.auth.getSession();
      if (!data?.session?.user) return;
      const user = data.session.user;
      const info = await fetchProfileAndSub(user.id);
      currentUser = {
        id: user.id,
        name: info.profile?.full_name || user.user_metadata?.full_name || user.email,
        email: user.email,
        role: info.profile?.role || "user",
        joinedAt: info.profile?.created_at || user.created_at,
      };
      await onLoginSuccess();
    } catch (_) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", restoreSession);
  } else {
    restoreSession();
  }
})();
