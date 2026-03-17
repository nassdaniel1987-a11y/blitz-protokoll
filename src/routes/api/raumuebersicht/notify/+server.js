// src/routes/api/raumuebersicht/notify/+server.js
// Endpunkt für Supabase Database Webhooks.
// Supabase ruft diesen Endpunkt auf wenn sich die protokolle-Tabelle ändert.
// Dieser leitet die Benachrichtigung an das Dashboard weiter.
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { notifyDashboard } from '$lib/server/webhookService.js';

/**
 * Supabase Database Webhooks senden kein Bearer-Token,
 * daher verwenden wir einen separaten Webhook-Secret.
 */
function validateWebhookSecret(request) {
	const secret = env.SUPABASE_WEBHOOK_SECRET;
	if (!secret) return false;
	const headerSecret = request.headers.get('x-webhook-secret');
	return headerSecret === secret;
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	if (!validateWebhookSecret(request)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Supabase Webhook Payload enthält die geänderte Zeile
	const payload = await request.json().catch(() => ({}));

	// Das Datum aus dem Payload extrahieren
	// Supabase sendet: { type: "UPDATE", table: "protokolle", record: { datum: "...", inhalt: {...} }, ... }
	const datum = payload?.record?.datum || new Date().toISOString().split('T')[0];

	const success = await notifyDashboard(datum);

	return json({ success, datum });
}
