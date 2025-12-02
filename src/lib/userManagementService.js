// src/lib/userManagementService.js
import { supabase } from './supabaseClient';

/**
 * Prüft ob der aktuelle User ein Admin ist
 * @returns {Promise<boolean>}
 */
export async function isCurrentUserAdmin() {
	const { data } = await supabase.auth.getSession();
	if (!data.session) return false;

	return data.session.user?.user_metadata?.is_admin === true;
}

/**
 * Lädt alle User (nur für Admins)
 * @returns {Promise<Array>}
 */
export async function getAllUsers() {
	const { data, error } = await supabase.rpc('get_all_users');

	if (error) {
		console.error('Fehler beim Laden der User:', error);
		return [];
	}

	return data || [];
}

/**
 * Erstellt einen neuen User (nur für Admins)
 * @param {string} username - Benutzername (ohne @blitz-protokoll.local)
 * @param {string} password - Initial-Passwort
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function createUser(username, password) {
	try {
		// Supabase URL ermitteln
		const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || supabase.supabaseUrl;

		// Edge Function aufrufen
		const { data: sessionData } = await supabase.auth.getSession();
		const token = sessionData.session?.access_token;

		if (!token) {
			return { success: false, error: 'Nicht authentifiziert' };
		}

		const response = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${token}`
			},
			body: JSON.stringify({ username, password })
		});

		const result = await response.json();
		return result;

	} catch (error) {
		console.error('Fehler beim Erstellen des Users:', error);
		return { success: false, error: error.message };
	}
}

/**
 * Aktualisiert die Metadata eines Users (nur für Admins)
 * @param {string} userId - User-ID
 * @param {object} metadata - Neue Metadata
 * @returns {Promise<boolean>}
 */
export async function updateUserMetadata(userId, metadata) {
	const { error } = await supabase.rpc('update_user_metadata', {
		user_id: userId,
		new_metadata: metadata
	});

	if (error) {
		console.error('Fehler beim Aktualisieren der User-Metadata:', error);
		return false;
	}

	return true;
}

/**
 * Entfernt das must_change_password Flag von einem User
 * @param {string} userId - User-ID
 * @param {object} currentMetadata - Aktuelle Metadata des Users
 * @returns {Promise<boolean>}
 */
export async function removeMustChangePassword(userId, currentMetadata) {
	const newMetadata = { ...currentMetadata, must_change_password: false };
	return await updateUserMetadata(userId, newMetadata);
}

/**
 * Setzt einen User als Admin oder entfernt Admin-Rechte
 * @param {string} userId - User-ID
 * @param {object} currentMetadata - Aktuelle Metadata des Users
 * @param {boolean} isAdmin - true für Admin, false für normalen User
 * @returns {Promise<boolean>}
 */
export async function setUserAdminStatus(userId, currentMetadata, isAdmin) {
	const newMetadata = { ...currentMetadata, is_admin: isAdmin };
	return await updateUserMetadata(userId, newMetadata);
}
