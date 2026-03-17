// src/routes/api/raumuebersicht/webhook-test/+server.js
// Test-Endpunkt um den Webhook manuell auszulösen.
// Kann auch von Supabase Database Webhooks aufgerufen werden.
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { notifyDashboard } from '$lib/server/webhookService.js';

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
		'Access-Control-Allow-Methods': 'POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Authorization, Content-Type'
	};
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	if (!validateApiKey(request)) {
		return json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
	}

	const body = await request.json().catch(() => ({}));
	const datum = body.datum || new Date().toISOString().split('T')[0];

	const success = await notifyDashboard(datum);

	return json(
		{ success, datum, message: success ? 'Webhook gesendet' : 'Webhook nicht konfiguriert oder fehlgeschlagen' },
		{ headers: corsHeaders() }
	);
}

/** @type {import('./$types').RequestHandler} */
export async function OPTIONS() {
	return new Response(null, { status: 204, headers: corsHeaders() });
}
