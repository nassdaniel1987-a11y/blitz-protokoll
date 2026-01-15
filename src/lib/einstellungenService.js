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
	// Lade alte Personenliste für Vergleich
	const oldPersonen = await getPersonen();

	// Finde gelöschte Personen
	const deletedPersons = oldPersonen.filter(p => !personen.includes(p));

	if (deletedPersons.length > 0) {
		console.log('Gelöschte Personen gefunden:', deletedPersons);
		await cleanupDeletedPersonsFromVorlagen(deletedPersons);
	}

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
 * Entfernt gelöschte Personen aus allen Vorlagen
 * @param {Array<string>} deletedPersons - Liste der gelöschten Personen
 */
async function cleanupDeletedPersonsFromVorlagen(deletedPersons) {
	try {
		const vorlagen = await getVorlagen();

		const { updatedVorlagen, changed } = removePersonsFromTemplates(vorlagen, deletedPersons);

		if (changed) {
			console.log('Bereinige Vorlagen von gelöschten Personen...');
			await saveVorlagen(updatedVorlagen);
			console.log('Vorlagen erfolgreich bereinigt.');
		}
	} catch (error) {
		console.error('Fehler beim Bereinigen der Vorlagen:', error);
	}
}

/**
 * Reine Funktion zum Entfernen von Personen aus Vorlagen (für Tests exportiert)
 * @param {Array} vorlagen - Liste der Vorlagen
 * @param {Array<string>} deletedPersons - Liste der zu löschenden Personen
 * @returns {object} { updatedVorlagen, changed }
 */
export function removePersonsFromTemplates(vorlagen, deletedPersons) {
	let changed = false;

	const updatedVorlagen = vorlagen.map(vorlage => {
		let vorlageChanged = false;
		// Deep copy von inhalt
		const inhalt = JSON.parse(JSON.stringify(vorlage.inhalt));

		// Helper function to remove persons from comma-separated string
		const removePersonsFromString = (str) => {
			if (!str) return str;
			let parts = str.split(',').map(s => s.trim()).filter(s => s);
			const originalLength = parts.length;
			parts = parts.filter(p => !deletedPersons.includes(p));
			if (parts.length !== originalLength) {
				vorlageChanged = true;
				changed = true;
			}
			return parts.join(', ');
		};

		// 1. Anwesenheit
		if (inhalt.anwesenheit) {
			inhalt.anwesenheit = removePersonsFromString(inhalt.anwesenheit);
		}

		// 2. Abwesend
		if (inhalt.abwesend) {
			inhalt.abwesend = removePersonsFromString(inhalt.abwesend);
		}

		// 3. Wer geht essen
		if (inhalt.wer_geht_essen) {
			inhalt.wer_geht_essen = removePersonsFromString(inhalt.wer_geht_essen);
		}

		// 4. Planung (Raumzuweisungen)
		if (inhalt.planung) {
			Object.keys(inhalt.planung).forEach(slot => {
				Object.keys(inhalt.planung[slot]).forEach(raum => {
					const oldVal = inhalt.planung[slot][raum];
					const newVal = removePersonsFromString(oldVal);
					if (oldVal !== newVal) {
						inhalt.planung[slot][raum] = newVal;
					}
				});
			});
		}

		if (vorlageChanged) {
			return { ...vorlage, inhalt };
		}
		return vorlage;
	});

	return { updatedVorlagen, changed };
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