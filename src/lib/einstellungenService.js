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