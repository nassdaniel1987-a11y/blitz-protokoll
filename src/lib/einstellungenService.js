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
 * Helper: Ersetzt einen Namen in einem comma-separated String
 * @param {string} str - Comma-separated String
 * @param {string} oldName - Alter Name
 * @param {string} newName - Neuer Name
 * @returns {object} { result: string, changed: boolean }
 */
function replaceNameInString(str, oldName, newName) {
	if (!str) return { result: str, changed: false };
	const parts = str.split(',').map(s => s.trim()).filter(s => s);
	let changed = false;
	const newParts = parts.map(p => {
		if (p === oldName) {
			changed = true;
			return newName;
		}
		return p;
	});
	return { result: newParts.join(', '), changed };
}

/**
 * Reine Funktion zum Umbenennen einer Person in Vorlagen
 * @param {Array} vorlagen - Liste der Vorlagen
 * @param {string} oldName - Alter Name
 * @param {string} newName - Neuer Name
 * @returns {object} { updatedVorlagen, changed }
 */
export function renamePersonInTemplates(vorlagen, oldName, newName) {
	let changed = false;

	const updatedVorlagen = vorlagen.map(vorlage => {
		let vorlageChanged = false;
		const inhalt = JSON.parse(JSON.stringify(vorlage.inhalt));

		// 1. Anwesenheit
		if (inhalt.anwesenheit) {
			const result = replaceNameInString(inhalt.anwesenheit, oldName, newName);
			if (result.changed) {
				inhalt.anwesenheit = result.result;
				vorlageChanged = true;
				changed = true;
			}
		}

		// 2. Abwesend
		if (inhalt.abwesend) {
			const result = replaceNameInString(inhalt.abwesend, oldName, newName);
			if (result.changed) {
				inhalt.abwesend = result.result;
				vorlageChanged = true;
				changed = true;
			}
		}

		// 3. Wer geht essen
		if (inhalt.wer_geht_essen) {
			const result = replaceNameInString(inhalt.wer_geht_essen, oldName, newName);
			if (result.changed) {
				inhalt.wer_geht_essen = result.result;
				vorlageChanged = true;
				changed = true;
			}
		}

		// 4. Planung (Raumzuweisungen)
		if (inhalt.planung) {
			Object.keys(inhalt.planung).forEach(slot => {
				Object.keys(inhalt.planung[slot]).forEach(raum => {
					const result = replaceNameInString(inhalt.planung[slot][raum], oldName, newName);
					if (result.changed) {
						inhalt.planung[slot][raum] = result.result;
						vorlageChanged = true;
						changed = true;
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

/**
 * Reine Funktion zum Umbenennen einer Person in einem Protokoll-Inhalt
 * @param {object} inhalt - Protokoll-Inhalt
 * @param {string} oldName - Alter Name
 * @param {string} newName - Neuer Name
 * @returns {object} { updatedInhalt, changed }
 */
function renamePersonInProtokollInhalt(inhalt, oldName, newName) {
	let changed = false;
	const updatedInhalt = JSON.parse(JSON.stringify(inhalt));

	// 1. Anwesenheit
	if (updatedInhalt.anwesenheit) {
		const result = replaceNameInString(updatedInhalt.anwesenheit, oldName, newName);
		if (result.changed) {
			updatedInhalt.anwesenheit = result.result;
			changed = true;
		}
	}

	// 2. Abwesend
	if (updatedInhalt.abwesend) {
		const result = replaceNameInString(updatedInhalt.abwesend, oldName, newName);
		if (result.changed) {
			updatedInhalt.abwesend = result.result;
			changed = true;
		}
	}

	// 3. Wer geht essen
	if (updatedInhalt.wer_geht_essen) {
		const result = replaceNameInString(updatedInhalt.wer_geht_essen, oldName, newName);
		if (result.changed) {
			updatedInhalt.wer_geht_essen = result.result;
			changed = true;
		}
	}

	// 4. Planung (Raumzuweisungen)
	if (updatedInhalt.planung) {
		Object.keys(updatedInhalt.planung).forEach(slot => {
			Object.keys(updatedInhalt.planung[slot]).forEach(raum => {
				const result = replaceNameInString(updatedInhalt.planung[slot][raum], oldName, newName);
				if (result.changed) {
					updatedInhalt.planung[slot][raum] = result.result;
					changed = true;
				}
			});
		});
	}

	return { updatedInhalt, changed };
}

/**
 * Person überall umbenennen (Personenliste, Vorlagen, Protokolle)
 * @param {Array<string>} personen - Aktuelle Personenliste
 * @param {number} index - Index der Person in der Liste
 * @param {string} newName - Neuer Name
 * @returns {Promise<{success: boolean, updatedPersonen: Array<string>, stats: object}>}
 */
export async function renamePersonEverywhere(personen, index, newName) {
	const oldName = personen[index];
	const stats = { vorlagen: 0, protokolle: 0 };

	try {
		// 1. Personenliste aktualisieren
		const updatedPersonen = [...personen];
		updatedPersonen[index] = newName;

		// 2. Vorlagen aktualisieren
		const vorlagen = await getVorlagen();
		const { updatedVorlagen, changed: vorlagenChanged } = renamePersonInTemplates(vorlagen, oldName, newName);
		if (vorlagenChanged) {
			await saveVorlagen(updatedVorlagen);
			stats.vorlagen = updatedVorlagen.filter((v, i) =>
				JSON.stringify(v) !== JSON.stringify(vorlagen[i])
			).length;
		}

		// 3. Alle Protokolle aktualisieren
		const { data: protokolle, error } = await supabase
			.from('protokolle')
			.select('*');

		if (!error && protokolle) {
			for (const protokoll of protokolle) {
				const { updatedInhalt, changed } = renamePersonInProtokollInhalt(protokoll.inhalt, oldName, newName);
				if (changed) {
					await supabase
						.from('protokolle')
						.update({ inhalt: updatedInhalt })
						.eq('datum', protokoll.datum);
					stats.protokolle++;
				}
			}
		}

		// 4. Personenliste speichern (ohne cleanup, da wir nur umbenennen)
		const { error: saveError } = await supabase
			.from('einstellungen')
			.upsert({
				key: 'personen',
				value: updatedPersonen,
				updated_at: new Date().toISOString()
			}, {
				onConflict: 'key'
			});

		if (saveError) {
			console.error('Fehler beim Speichern der Personen:', saveError);
			return { success: false, updatedPersonen: personen, stats };
		}

		return { success: true, updatedPersonen, stats };
	} catch (error) {
		console.error('Fehler beim Umbenennen:', error);
		return { success: false, updatedPersonen: personen, stats };
	}
}