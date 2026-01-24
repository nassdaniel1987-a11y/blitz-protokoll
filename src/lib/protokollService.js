// src/lib/protokollService.js
import { supabase } from './supabaseClient';
import { deleteChangelog } from './changelogService';

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
	// Lösche zuerst die Changelog-Einträge für dieses Protokoll
	await deleteChangelog(datum);

	// Dann lösche das Protokoll selbst
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
 * Hilfsfunktion: Berechne den letzten Donnerstag (oder heute, wenn heute Donnerstag ist)
 * Die Woche geht von Donnerstag bis Mittwoch
 * @param {string} dateStr - Datum im Format YYYY-MM-DD
 * @returns {string} Datum des letzten Donnerstags im Format YYYY-MM-DD
 */
export function getLastThursday(dateStr) {
	const date = new Date(dateStr + 'T12:00:00'); // Mittag um Timezone-Probleme zu vermeiden
	const dayOfWeek = date.getDay(); // 0=Sonntag, 1=Montag, ..., 4=Donnerstag, 6=Samstag

	// Berechne Tage zurück zum letzten Donnerstag
	// Donnerstag = 4
	let daysBack = (dayOfWeek - 4 + 7) % 7;

	// Wenn heute Donnerstag ist, bleibe bei heute (daysBack = 0)
	date.setDate(date.getDate() - daysBack);

	return date.toISOString().split('T')[0];
}

/**
 * Lade die "Beobachtung Kinder" Daten vom letzten Donnerstag
 * Diese werden wochenweise (Donnerstag bis Mittwoch) übernommen
 * @param {string} currentDate - Aktuelles Datum im Format YYYY-MM-DD
 * @returns {Promise<Object|null>} Beobachtung Kinder Felder oder null
 */
export async function getBeobachtungKinderFromThursday(currentDate) {
	const lastThursday = getLastThursday(currentDate);

	// Wenn das aktuelle Datum der Donnerstag ist, keine Übernahme nötig
	// (das wäre ja das gleiche Protokoll)
	if (lastThursday === currentDate) {
		return null;
	}

	const protokoll = await getProtokoll(lastThursday);

	if (!protokoll || !protokoll.inhalt) {
		return null;
	}

	// Nur die Beobachtung Kinder Felder zurückgeben, wenn mindestens eines gefüllt ist
	const beobachtung = {
		beobachtung_kinder_stufe_1: protokoll.inhalt.beobachtung_kinder_stufe_1 || '',
		beobachtung_kinder_stufe_2: protokoll.inhalt.beobachtung_kinder_stufe_2 || '',
		beobachtung_kinder_stufe_3: protokoll.inhalt.beobachtung_kinder_stufe_3 || '',
		beobachtung_kinder_stufe_4: protokoll.inhalt.beobachtung_kinder_stufe_4 || ''
	};

	// Prüfe ob mindestens ein Feld gefüllt ist
	const hasContent = Object.values(beobachtung).some(v => v.trim() !== '');

	return hasContent ? beobachtung : null;
}

/**
 * Hilfsfunktion: Leeres Protokoll-Template
 * @returns {Object} Leeres Protokoll
 */
export function getEmptyProtokoll() {
	return {
		anwesenheit: '',
		abwesend: '',  // NEU
		wer_geht_essen: '',
		leitung_im_haus: '',
		spaetdienst: '',
		fruehdienst_naechster_tag: '',
		beobachtung_kinder_stufe_1: '',
		beobachtung_kinder_stufe_2: '',
		beobachtung_kinder_stufe_3: '',
		beobachtung_kinder_stufe_4: '',
		sonstiges: '',
		planung: {
			'12:25-13:10': {
				treffpunkt_1: '',
				treffpunkt_2: '',
				treffpunkt_3: '',
				treffpunkt_4: '',
				treffpunkt_kurz: '',
				atelier: '',
				werkstatt: '',
				sporthalle: '',
				gymnastikhalle: '',
				computerraum: '',
				hof: ''
			},
			'13:15-14:00': {
				treffpunkt_1: '',
				treffpunkt_2: '',
				treffpunkt_3: '',
				treffpunkt_4: '',
				treffpunkt_kurz: '',
				atelier: '',
				werkstatt: '',
				sporthalle: '',
				gymnastikhalle: '',
				computerraum: '',
				hof: ''
			},
			'14:00-14:30': {
				treffpunkt_1: '',
				treffpunkt_2: '',
				treffpunkt_3: '',
				treffpunkt_4: '',
				treffpunkt_kurz: '',
				atelier: '',
				werkstatt: '',
				sporthalle: '',
				gymnastikhalle: '',
				computerraum: '',
				hof: ''
			}
		}
	};
}