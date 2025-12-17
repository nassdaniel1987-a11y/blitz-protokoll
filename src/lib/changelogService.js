// src/lib/changelogService.js
import { supabase } from './supabaseClient';

/**
 * Loggt eine Änderung im Protokoll-Changelog
 * @param {string} protokollDate - Datum des Protokolls (YYYY-MM-DD)
 * @param {string} username - Username des Ändernden
 * @param {string} changeType - Art der Änderung ('create', 'update', 'delete')
 * @param {Object} options - Optionen: { fieldName, oldValue, newValue, description }
 * @returns {Promise<boolean>}
 */
export async function logChange(protokollDate, username, changeType, options = {}) {
	const { fieldName, oldValue, newValue, description } = options;

	const { error } = await supabase
		.from('protocol_changelog')
		.insert({
			protokoll_date: protokollDate,
			username: username,
			change_type: changeType,
			field_name: fieldName || null,
			old_value: oldValue || null,
			new_value: newValue || null,
			description: description || null
		});

	if (error) {
		console.error('Fehler beim Loggen der Änderung:', error);
		return false;
	}

	return true;
}

/**
 * Lädt das Changelog für ein bestimmtes Protokoll
 * @param {string} protokollDate - Datum des Protokolls (YYYY-MM-DD)
 * @param {number} limit - Maximale Anzahl Einträge (default: 50)
 * @returns {Promise<Array>}
 */
export async function getChangelog(protokollDate, limit = 50) {
	const { data, error } = await supabase
		.from('protocol_changelog')
		.select('*')
		.eq('protokoll_date', protokollDate)
		.order('timestamp', { ascending: false })
		.limit(limit);

	if (error) {
		console.error('Fehler beim Laden des Changelogs:', error);
		return [];
	}

	return data || [];
}

/**
 * Löscht alle Changelog-Einträge für ein bestimmtes Protokoll
 * @param {string} protokollDate - Datum des Protokolls (YYYY-MM-DD)
 * @returns {Promise<boolean>}
 */
export async function deleteChangelog(protokollDate) {
	const { error } = await supabase
		.from('protocol_changelog')
		.delete()
		.eq('protokoll_date', protokollDate);

	if (error) {
		console.error('Fehler beim Löschen des Changelogs:', error);
		return false;
	}

	return true;
}

/**
 * Vergleicht zwei Protokoll-Objekte und erstellt eine Liste von Änderungen
 * @param {Object} oldData - Alte Protokoll-Daten
 * @param {Object} newData - Neue Protokoll-Daten
 * @param {Array} zeitslots - Array der Zeitslots
 * @param {Array} raeume - Array der Räume
 * @returns {Array} Liste von Änderungen
 */
export function compareProtocols(oldData, newData, zeitslots, raeume) {
	const changes = [];

	// Vergleiche einfache Felder
	const simpleFields = [
		{ key: 'anwesenheit', name: 'Anwesenheit' },
		{ key: 'abwesend', name: 'Abwesend' },
		{ key: 'wer_geht_essen', name: 'Wer geht essen' },
		{ key: 'leitung_im_haus', name: 'Leitung im Haus' },
		{ key: 'spaetdienst', name: 'Spätdienst' },
		{ key: 'fruehdienst_naechster_tag', name: 'Frühdienst (nächster Tag)' },
		{ key: 'sonstiges', name: 'Sonstiges' }
	];

	simpleFields.forEach(field => {
		const oldValue = oldData.inhalt[field.key] || '';
		const newValue = newData[field.key] || '';

		if (oldValue !== newValue) {
			changes.push({
				fieldName: field.name,
				oldValue: oldValue,
				newValue: newValue
			});
		}
	});

	// Vergleiche Planungs-Matrix
	zeitslots.forEach(slot => {
		raeume.forEach(raum => {
			const oldValue = oldData.inhalt.planung[slot]?.[raum] || '';
			const newValue = newData.planung[slot]?.[raum] || '';

			if (oldValue !== newValue) {
				changes.push({
					fieldName: `${raum}, ${slot}`,
					oldValue: oldValue,
					newValue: newValue
				});
			}
		});
	});

	return changes;
}

/**
 * Formatiert einen Changelog-Eintrag für die Anzeige
 * @param {Object} entry - Changelog-Eintrag
 * @returns {string} Formatierter Text
 */
export function formatChangelogEntry(entry) {
	const date = new Date(entry.timestamp);
	const timeStr = date.toLocaleString('de-DE', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});

	if (entry.change_type === 'create') {
		return `${timeStr} - ${entry.username}: ${entry.description || 'Protokoll erstellt'}`;
	}

	if (entry.description) {
		return `${timeStr} - ${entry.username}: ${entry.description}`;
	}

	const oldVal = entry.old_value || '(leer)';
	const newVal = entry.new_value || '(leer)';

	return `${timeStr} - ${entry.username}: ${entry.field_name}: "${oldVal}" → "${newVal}"`;
}
