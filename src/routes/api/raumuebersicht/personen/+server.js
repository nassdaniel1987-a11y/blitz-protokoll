// src/routes/api/raumuebersicht/personen/+server.js
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { supabaseServer } from '$lib/server/supabaseServerClient.js';

function validateApiKey(request) {
	const apiKey = env.BLITZ_API_KEY;
	if (!apiKey) return false;
	const authHeader = request.headers.get('Authorization');
	if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
	return authHeader.slice(7) === apiKey;
}

function corsHeaders() {
	const allowedOrigin = env.BLITZ_API_ALLOWED_ORIGIN || '*';
	return {
		'Access-Control-Allow-Origin': allowedOrigin,
		'Access-Control-Allow-Methods': 'GET, OPTIONS',
		'Access-Control-Allow-Headers': 'Authorization, Content-Type'
	};
}

/** @type {import('./$types').RequestHandler} */
export async function GET({ request }) {
	if (!validateApiKey(request)) {
		return json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
	}

	const { data } = await supabaseServer
		.from('einstellungen')
		.select('value')
		.eq('key', 'personen')
		.single();

	const personenNamen = data?.value || [];

	const personen = personenNamen.map((name) => ({
		name,
		slug: name.toLowerCase().replace(/\s+/g, '_')
	}));

	return json({ personen }, { headers: corsHeaders() });
}

/** @type {import('./$types').RequestHandler} */
export async function OPTIONS() {
	return new Response(null, { status: 204, headers: corsHeaders() });
}
