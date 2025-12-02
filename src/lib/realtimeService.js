// src/lib/realtimeService.js
import { supabase } from './supabaseClient';

/**
 * Registriert einen Editor für ein bestimmtes Protokoll-Datum
 * @param {string} date - Datum im Format YYYY-MM-DD
 * @param {string} username - Benutzername
 * @returns {Promise<boolean>}
 */
export async function registerEditor(date, username) {
	// Erst alte inaktive Editoren aufräumen
	await supabase.rpc('cleanup_inactive_editors');

	// Editor eintragen (UPSERT für den Fall dass schon vorhanden)
	const { error } = await supabase
		.from('active_editors')
		.upsert({
			protokoll_date: date,
			username: username,
			last_heartbeat: new Date().toISOString()
		}, {
			onConflict: 'protokoll_date,username'
		});

	if (error) {
		console.error('Fehler beim Registrieren des Editors:', error);
		return false;
	}

	return true;
}

/**
 * Meldet einen Editor ab
 * @param {string} date - Datum im Format YYYY-MM-DD
 * @param {string} username - Benutzername
 * @returns {Promise<boolean>}
 */
export async function unregisterEditor(date, username) {
	const { error } = await supabase
		.from('active_editors')
		.delete()
		.eq('protokoll_date', date)
		.eq('username', username);

	if (error) {
		console.error('Fehler beim Abmelden des Editors:', error);
		return false;
	}

	return true;
}

/**
 * Aktualisiert den Heartbeat eines Editors (zeigt Aktivität)
 * @param {string} date - Datum im Format YYYY-MM-DD
 * @param {string} username - Benutzername
 * @returns {Promise<boolean>}
 */
export async function updateHeartbeat(date, username) {
	const { error } = await supabase
		.from('active_editors')
		.update({
			last_heartbeat: new Date().toISOString()
		})
		.eq('protokoll_date', date)
		.eq('username', username);

	if (error) {
		console.error('Fehler beim Aktualisieren des Heartbeats:', error);
		return false;
	}

	return true;
}

/**
 * Lädt alle aktiven Editoren für ein bestimmtes Datum
 * @param {string} date - Datum im Format YYYY-MM-DD
 * @returns {Promise<Array>}
 */
export async function getActiveEditors(date) {
	// Erst alte inaktive Editoren aufräumen
	await supabase.rpc('cleanup_inactive_editors');

	const { data, error } = await supabase
		.from('active_editors')
		.select('*')
		.eq('protokoll_date', date)
		.order('last_heartbeat', { ascending: false });

	if (error) {
		console.error('Fehler beim Laden der aktiven Editoren:', error);
		return [];
	}

	return data || [];
}

/**
 * Erstellt eine Realtime-Subscription für ein bestimmtes Protokoll
 * @param {string} date - Datum im Format YYYY-MM-DD
 * @param {Function} onUpdate - Callback für Updates
 * @returns {Object} Subscription-Objekt (zum Unsubscribe)
 */
export function subscribeToProtokoll(date, onUpdate) {
	const subscription = supabase
		.channel(`protokoll-${date}`)
		.on(
			'postgres_changes',
			{
				event: '*',
				schema: 'public',
				table: 'protokolle',
				filter: `datum=eq.${date}`
			},
			(payload) => {
				console.log('Protokoll-Update empfangen:', payload);
				onUpdate(payload);
			}
		)
		.subscribe();

	return subscription;
}

/**
 * Erstellt eine Realtime-Subscription für aktive Editoren eines Protokolls
 * @param {string} date - Datum im Format YYYY-MM-DD
 * @param {Function} onEditorsChange - Callback für Änderungen der Editor-Liste
 * @returns {Object} Subscription-Objekt (zum Unsubscribe)
 */
export function subscribeToActiveEditors(date, onEditorsChange) {
	const subscription = supabase
		.channel(`active-editors-${date}`)
		.on(
			'postgres_changes',
			{
				event: '*',
				schema: 'public',
				table: 'active_editors',
				filter: `protokoll_date=eq.${date}`
			},
			async (payload) => {
				console.log('Editor-Update empfangen:', payload);
				// Neue Editor-Liste laden und Callback aufrufen
				const editors = await getActiveEditors(date);
				onEditorsChange(editors);
			}
		)
		.subscribe();

	return subscription;
}
