// src/lib/protokollService.js
import { supabase } from './supabaseClient';

/**
 * Protokoll für ein bestimmtes Datum laden
 * @param {string} datum - Format: 'YYYY-MM-DD'
 * @returns {Object|null} Protokoll-Daten oder null
 */
export async function getProtokoll(datum) {
	const { data, error } = await supabase
		.from('protokolle')
		.select('*')
		.eq('datum', datum)
		.single();

	if (error) {
		// Kein Protokoll gefunden ist ok (404)
		if (error.code === 'PGRST116') {
			return null;
		}
		console.error('Fehler beim Laden:', error);
		return null;
	}

	return data;
}

/**
 * Neues Protokoll erstellen
 * @param {string} datum - Format: 'YYYY-MM-DD'
 * @param {Object} inhalt - Protokoll-Daten
 * @returns {Object|null} Erstelltes Protokoll oder null bei Fehler
 */
export async function createProtokoll(datum, inhalt) {
	const { data, error } = await supabase
		.from('protokolle')
		.insert([
			{
				datum: datum,
				inhalt: inhalt
			}
		])
		.select()
		.single();

	if (error) {
		console.error('Fehler beim Erstellen:', error);
		return null;
	}

	return data;
}

/**
 * Bestehendes Protokoll aktualisieren
 * @param {string} datum - Format: 'YYYY-MM-DD'
 * @param {Object} inhalt - Aktualisierte Protokoll-Daten
 * @returns {Object|null} Aktualisiertes Protokoll oder null bei Fehler
 */
export async function updateProtokoll(datum, inhalt) {
	const { data, error } = await supabase
		.from('protokolle')
		.update({ inhalt: inhalt })
		.eq('datum', datum)
		.select()
		.single();

	if (error) {
		console.error('Fehler beim Aktualisieren:', error);
		return null;
	}

	return data;
}

/**
 * Protokoll speichern (erstellen oder aktualisieren)
 * @param {string} datum - Format: 'YYYY-MM-DD'
 * @param {Object} inhalt - Protokoll-Daten
 * @returns {Object|null} Gespeichertes Protokoll oder null bei Fehler
 */
export async function saveProtokoll(datum, inhalt) {
	// Erst prüfen ob Protokoll existiert
	const existing = await getProtokoll(datum);

	if (existing) {
		// Aktualisieren
		return await updateProtokoll(datum, inhalt);
	} else {
		// Neu erstellen
		return await createProtokoll(datum, inhalt);
	}
}

/**
 * Protokoll löschen
 * @param {string} datum - Format: 'YYYY-MM-DD'
 * @returns {boolean} true bei Erfolg, false bei Fehler
 */
export async function deleteProtokoll(datum) {
	const { error } = await supabase
		.from('protokolle')
		.delete()
		.eq('datum', datum);

	if (error) {
		console.error('Fehler beim Löschen:', error);
		return false;
	}

	return true;
}

/**
 * Hilfsfunktion: Heutiges Datum im Format YYYY-MM-DD
 * @returns {string} Heutiges Datum
 */
export function getToday() {
	const today = new Date();
	return today.toISOString().split('T')[0];
}

/**
 * Hilfsfunktion: Leeres Protokoll-Template
 * @returns {Object} Leeres Protokoll
 */
export function getEmptyProtokoll() {
	return {
		anwesenheit: '',
		wer_geht_essen: '',
		leitung_im_haus: '',
		spaetdienst: '',
		fruehdienst_naechster_tag: '',
		sonstiges: '',
		planung: {
			'12:25-13:10': {
				treffpunkt_1: '',
				treffpunkt_2: '',
				treffpunkt_3: '',
				treffpunkt_4: '',
				treffpunkt_kurz: '',
				atelier: '',
				hof: '',
				werkstatt: '',
				sporthalle: '',
				gymnastikhalle: '',
				computerraum: ''
			},
			'13:15-14:00': {
				treffpunkt_1: '',
				treffpunkt_2: '',
				treffpunkt_3: '',
				treffpunkt_4: '',
				treffpunkt_kurz: '',
				atelier: '',
				hof: '',
				werkstatt: '',
				sporthalle: '',
				gymnastikhalle: '',
				computerraum: ''
			},
			'14:00-14:30': {
				treffpunkt_1: '',
				treffpunkt_2: '',
				treffpunkt_3: '',
				treffpunkt_4: '',
				treffpunkt_kurz: '',
				atelier: '',
				hof: '',
				werkstatt: '',
				sporthalle: '',
				gymnastikhalle: '',
				computerraum: ''
			}
		}
	};
}