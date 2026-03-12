const { createClient } = require('@supabase/supabase-js');

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

function getSupabaseAnon() {
  return createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_ANON_KEY'));
}

function getSupabaseService() {
  return createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'));
}

module.exports = {
  getSupabaseAnon,
  getSupabaseService,
};
