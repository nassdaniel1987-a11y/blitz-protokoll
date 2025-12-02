// src/lib/teamNachrichtenService.js
import { supabase } from './supabaseClient';

/**
 * Alle Nachrichten laden (neueste zuerst)
 * @returns {Promise<Array>}
 */
export async function getNachrichten() {
	const { data, error } = await supabase
		.from('team_nachrichten')
		.select('*')
		.order('created_at', { ascending: false });

	if (error) {
		console.error('Fehler beim Laden der Nachrichten:', error);
		return [];
	}

	return data || [];
}

/**
 * Neue Nachricht erstellen
 * @param {string} message - Nachrichtentext
 * @param {string} username - Benutzername des Erstellers
 * @returns {Promise<boolean>}
 */
export async function createNachricht(message, username) {
	// Nachricht erstellen
	const { data: nachricht, error: createError } = await supabase
		.from('team_nachrichten')
		.insert({
			message: message,
			created_by: username
		})
		.select()
		.single();

	if (createError) {
		console.error('Fehler beim Erstellen der Nachricht:', createError);
		return false;
	}

	// Log-Eintrag erstellen
	await supabase.from('team_nachrichten_log').insert({
		nachricht_id: nachricht.id,
		action: 'created',
		performed_by: username,
		new_message: message
	});

	return true;
}

/**
 * Nachricht bearbeiten
 * @param {string} id - Nachrichten-ID
 * @param {string} newMessage - Neuer Nachrichtentext
 * @param {string} username - Benutzername des Bearbeiters
 * @param {string} oldMessage - Alter Nachrichtentext (für Log)
 * @returns {Promise<boolean>}
 */
export async function updateNachricht(id, newMessage, username, oldMessage) {
	// Nachricht aktualisieren
	const { error: updateError } = await supabase
		.from('team_nachrichten')
		.update({
			message: newMessage,
			updated_at: new Date().toISOString(),
			edited_by: username
		})
		.eq('id', id);

	if (updateError) {
		console.error('Fehler beim Aktualisieren der Nachricht:', updateError);
		return false;
	}

	// Log-Eintrag erstellen
	await supabase.from('team_nachrichten_log').insert({
		nachricht_id: id,
		action: 'edited',
		performed_by: username,
		old_message: oldMessage,
		new_message: newMessage
	});

	return true;
}

/**
 * Nachricht löschen
 * @param {string} id - Nachrichten-ID
 * @param {string} username - Benutzername des Löschenden
 * @param {string} message - Nachrichtentext (für Log)
 * @returns {Promise<boolean>}
 */
export async function deleteNachricht(id, username, message) {
	// Log-Eintrag ZUERST erstellen (vor dem Löschen wegen Foreign Key)
	await supabase.from('team_nachrichten_log').insert({
		nachricht_id: id,
		action: 'deleted',
		performed_by: username,
		old_message: message
	});

	// Nachricht löschen
	const { error } = await supabase
		.from('team_nachrichten')
		.delete()
		.eq('id', id);

	if (error) {
		console.error('Fehler beim Löschen der Nachricht:', error);
		return false;
	}

	return true;
}

/**
 * Log/Historie für eine Nachricht laden
 * @param {string} nachrichtId - Nachrichten-ID
 * @returns {Promise<Array>}
 */
export async function getLog(nachrichtId) {
	const { data, error } = await supabase
		.from('team_nachrichten_log')
		.select('*')
		.eq('nachricht_id', nachrichtId)
		.order('performed_at', { ascending: false });

	if (error) {
		console.error('Fehler beim Laden des Logs:', error);
		return [];
	}

	return data || [];
}

/**
 * Komplettes Log aller Nachrichten laden (für Admin-Ansicht)
 * Auto-Cleanup: Löscht Einträge älter als 3 Tage
 * @returns {Promise<Array>}
 */
export async function getAllLogs() {
	// Erst alte Logs löschen (älter als 3 Tage)
	await supabase.rpc('cleanup_old_team_nachrichten_logs');

	// Dann aktuelle Logs laden
	const { data, error } = await supabase
		.from('team_nachrichten_log')
		.select('*')
		.order('performed_at', { ascending: false })
		.limit(100); // Limitiere auf letzte 100 Einträge

	if (error) {
		console.error('Fehler beim Laden aller Logs:', error);
		return [];
	}

	return data || [];
}
