import { supabaseConfig } from './config.js';

let clientPromise;

export function isAuthConfigured() {
  return Boolean(supabaseConfig.url && supabaseConfig.publishableKey);
}

export function getLoginUrl() {
  return new URL('login.html', window.location.href).href;
}

export async function getAuthClient() {
  if (!isAuthConfigured()) {
    throw new Error('Sign-in is not available yet. Supabase authentication still needs to be connected.');
  }

  if (!clientPromise) {
    clientPromise = import('https://esm.sh/@supabase/supabase-js@2').then(({ createClient }) => {
      return createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
    }).catch((error) => {
      clientPromise = undefined;
      throw error;
    });
  }

  return clientPromise;
}
