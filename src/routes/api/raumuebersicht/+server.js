// src/routes/api/raumuebersicht/+server.js
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

const ZEITSLOTS = ['12:25-13:10', '13:15-14:00', '14:00-14:30'];

/**
 * Prüft den API-Key aus dem Authorization-Header.
 */
function validateApiKey(request) {
	const apiKey = env.BLITZ_API_KEY;
	if (!apiKey) {
		return false;
	}

	const authHeader = request.headers.get('Authorization');
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return false;
	}

	return authHeader.slice(7) === apiKey;
}

/**
 * CORS-Headers für Cross-Origin-Zugriff.
 */
function corsHeaders() {
	const allowedOrigin = env.BLITZ_API_ALLOWED_ORIGIN || '*';
	return {
		'Access-Control-Allow-Origin': allowedOrigin,
		'Access-Control-Allow-Methods': 'GET, OPTIONS',
		'Access-Control-Allow-Headers': 'Authorization, Content-Type'
	};
}

/**
 * Parst einen comma-separated String in ein Array von {name, slug} Objekten.
 */
function parsePersonenString(str) {
	if (!str) return [];
	return str
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s)
		.map((name) => ({
			name,
			slug: name.toLowerCase().replace(/\s+/g, '_')
		}));
}

/**
 * Heutiges Datum als YYYY-MM-DD.
 */
function getToday() {
	return new Date().toISOString().split('T')[0];
}

/** @type {import('./$types').RequestHandler} */
export async function GET({ request, url }) {
	if (!validateApiKey(request)) {
		return json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
	}

	const datum = url.searchParams.get('datum') || getToday();

	// Räume laden
	const { data: raeumeData } = await supabaseServer
		.from('einstellungen')
		.select('value')
		.eq('key', 'raeume')
		.single();

	const raeume = raeumeData?.value || DEFAULT_RAEUME;

	// Protokoll für das Datum laden
	const { data: protokoll } = await supabaseServer
		.from('protokolle')
		.select('*')
		.eq('datum', datum)
		.single();

	const inhalt = protokoll?.inhalt || {};
	const planung = inhalt.planung || {};

	// Planung pro Zeitslot aufbereiten (mit name+slug Objekten)
	const planungFormatiert = {};
	for (const slot of ZEITSLOTS) {
		planungFormatiert[slot] = {};
		const slotData = planung[slot] || {};
		for (const raum of raeume) {
			planungFormatiert[slot][raum.id] = parsePersonenString(slotData[raum.id]);
		}
	}

	// Zuweisungen gesamt: alle Zeitslots zusammengefasst, dedupliziert pro Raum
	const zuweisungenGesamt = {};
	for (const raum of raeume) {
		const allePersonen = new Map();
		for (const slot of ZEITSLOTS) {
			const personen = planungFormatiert[slot][raum.id] || [];
			for (const person of personen) {
				allePersonen.set(person.slug, person);
			}
		}
		zuweisungenGesamt[raum.id] = Array.from(allePersonen.values());
	}

	// Anwesenheit & Abwesend
	const anwesenheit = inhalt.anwesenheit
		? inhalt.anwesenheit
				.split(',')
				.map((s) => s.trim())
				.filter((s) => s)
		: [];

	const abwesend = inhalt.abwesend
		? inhalt.abwesend
				.split(',')
				.map((s) => s.trim())
				.filter((s) => s)
		: [];

	const response = {
		datum,
		raeume,
		zeitslots: ZEITSLOTS,
		zuweisungen_gesamt: zuweisungenGesamt,
		planung: planungFormatiert,
		anwesenheit,
		abwesend
	};

	return json(response, { headers: corsHeaders() });
}

/** @type {import('./$types').RequestHandler} */
export async function OPTIONS() {
	return new Response(null, { status: 204, headers: corsHeaders() });
}
