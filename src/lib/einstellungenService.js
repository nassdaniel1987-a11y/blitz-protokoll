// src/lib/einstellungenService.js
import { supabase } from './supabaseClient';

/**
 * Personenliste laden
 * @returns {Promise<Array<string>>} Liste der Personen
 */
export async function getPersonen() {
	const { data, error } = await supabase
		.from('einstellungen')
		.select('value')
		.eq('key', 'personen')
		.single();

	if (error) {
		console.error('Fehler beim Laden der Personen:', error);
		return [];
	}

	return data?.value || [];
}

/**
 * Personenliste speichern
 * @param {Array<string>} personen - Liste der Personen
 * @returns {Promise<boolean>} Erfolg
 */
export async function savePersonen(personen) {
	const { error } = await supabase
		.from('einstellungen')
		.upsert({
			key: 'personen',
			value: personen,
			updated_at: new Date().toISOString()
		}, {
			onConflict: 'key'
		});

	if (error) {
		console.error('Fehler beim Speichern der Personen:', error);
		return false;
	}

	return true;
}

/**
 * Standard-Räume für Initialisierung
 */
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

/**
 * Raumliste laden
 * @returns {Promise<Array<{id: string, label: string}>>} Liste der Räume
 */
export async function getRaeume() {
	const { data, error } = await supabase
		.from('einstellungen')
		.select('value')
		.eq('key', 'raeume')
		.single();

	if (error) {
		console.error('Fehler beim Laden der Räume:', error);
		// Wenn keine Räume vorhanden, verwende Default-Räume
		return DEFAULT_RAEUME;
	}

	return data?.value || DEFAULT_RAEUME;
}

/**
 * Raumliste speichern
 * @param {Array<{id: string, label: string}>} raeume - Liste der Räume
 * @returns {Promise<boolean>} Erfolg
 */
export async function saveRaeume(raeume) {
	const { error } = await supabase
		.from('einstellungen')
		.upsert({
			key: 'raeume',
			value: raeume,
			updated_at: new Date().toISOString()
		}, {
			onConflict: 'key'
		});

	if (error) {
		console.error('Fehler beim Speichern der Räume:', error);
		return false;
	}

	return true;
}

/**
 * Vorlagen laden
 * @returns {Promise<Array<{id: string, name: string, inhalt: object}>>} Liste der Vorlagen
 */
export async function getVorlagen() {
	const { data, error } = await supabase
		.from('einstellungen')
		.select('value')
		.eq('key', 'vorlagen')
		.single();

	if (error) {
		console.error('Fehler beim Laden der Vorlagen:', error);
		return [];
	}

	return data?.value || [];
}

/**
 * Vorlagen speichern
 * @param {Array<{id: string, name: string, inhalt: object}>} vorlagen - Liste der Vorlagen
 * @returns {Promise<boolean>} Erfolg
 */
export async function saveVorlagen(vorlagen) {
	const { error } = await supabase
		.from('einstellungen')
		.upsert({
			key: 'vorlagen',
			value: vorlagen,
			updated_at: new Date().toISOString()
		}, {
			onConflict: 'key'
		});

	if (error) {
		console.error('Fehler beim Speichern der Vorlagen:', error);
		return false;
	}

	return true;
}