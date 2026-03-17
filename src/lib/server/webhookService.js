// src/lib/server/webhookService.js
import { env } from '$env/dynamic/private';

/**
 * Sendet eine Webhook-Benachrichtigung an das Dashboard,
 * dass sich die Planung für ein bestimmtes Datum geändert hat.
 *
 * @param {string} datum - Datum im Format YYYY-MM-DD
 * @returns {Promise<boolean>} true bei Erfolg
 */
export async function notifyDashboard(datum) {
	const webhookUrl = env.BLITZ_WEBHOOK_URL;
	const apiKey = env.BLITZ_API_KEY;

	if (!webhookUrl) {
		// Kein Webhook konfiguriert — still ignorieren
		return false;
	}

	try {
		const response = await fetch(webhookUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				event: 'planung_updated',
				datum
			})
		});

		if (!response.ok) {
			console.error(`Webhook fehlgeschlagen: ${response.status} ${response.statusText}`);
			return false;
		}

		return true;
	} catch (error) {
		console.error('Webhook-Fehler:', error.message);
		return false;
	}
}
