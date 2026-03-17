// src/routes/api/raumuebersicht/raeume/+server.js
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { supabaseServer } from '$lib/server/supabaseServerClient.js';

const DEFAULT_RAEUME = [
	{ id: 'treffpunkt_1', label: 'Treffpunkt 1' },
	{ id: 'treffpunkt_2', label: 'Treffpunkt 2' },
	{ id: 'treffpunkt_3', label: 'Treffpunkt 3' },
	{ id: 'treffpunkt_4', label: 'Treffpunkt 4' },
	{ id: 'treffpunkt_kurz', label: 'Treffpunkt kurz' },
	{ id: 'atelier', label: 'Atelier' },
	{ id: 'werkstatt', label: 'Werkstatt' },
	{ id: 'sporthalle', label: 'Sporthalle' },
	{ id: 'gymnastikhalle', label: 'Gymnastikhalle' },
	{ id: 'computerraum', label: 'Computerraum' },
	{ id: 'hof', label: 'Hof' }
];

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
		.eq('key', 'raeume')
		.single();

	const raeume = data?.value || DEFAULT_RAEUME;

	return json({ raeume }, { headers: corsHeaders() });
}

/** @type {import('./$types').RequestHandler} */
export async function OPTIONS() {
	return new Response(null, { status: 204, headers: corsHeaders() });
}
