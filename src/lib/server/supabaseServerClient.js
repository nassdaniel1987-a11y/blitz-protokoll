// src/lib/server/supabaseServerClient.js
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { env } from '$env/dynamic/private';

/**
 * Server-seitiger Supabase-Client.
 * Verwendet den Service Role Key falls vorhanden (umgeht RLS),
 * ansonsten den Anon Key.
 */
function createServerClient() {
	const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
	const key = serviceRoleKey || PUBLIC_SUPABASE_ANON_KEY;

	return createClient(PUBLIC_SUPABASE_URL, key, {
		auth: {
			autoRefreshToken: false,
			persistSession: false
		}
	});
}

export const supabaseServer = createServerClient();
