// src/lib/inactivityStore.js
// Automatischer Logout bei Inaktivität
import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { supabase } from './supabaseClient';

// Konfiguration
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 Minuten in Millisekunden
const WARNING_BEFORE_LOGOUT = 60 * 1000; // 60 Sekunden Warnung vor Logout

// Store für Warnung-Countdown
export const inactivityWarning = writable({
	show: false,
	secondsLeft: 0
});

let inactivityTimer = null;
let warningTimer = null;
let countdownInterval = null;
let isInitialized = false;

// Events die als Aktivität zählen
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart', 'touchmove'];

// Alle Timer zurücksetzen und neu starten
function resetTimers() {
	// Warnung ausblenden
	inactivityWarning.set({ show: false, secondsLeft: 0 });

	// Bestehende Timer löschen
	if (inactivityTimer) clearTimeout(inactivityTimer);
	if (warningTimer) clearTimeout(warningTimer);
	if (countdownInterval) clearInterval(countdownInterval);

	// Timer für Warnung (30 Min - 60 Sek = 29 Min)
	warningTimer = setTimeout(() => {
		showWarning();
	}, INACTIVITY_TIMEOUT - WARNING_BEFORE_LOGOUT);

	// Timer für automatischen Logout (30 Min)
	inactivityTimer = setTimeout(() => {
		performLogout();
	}, INACTIVITY_TIMEOUT);
}

// Warnung anzeigen mit Countdown
function showWarning() {
	let secondsLeft = Math.floor(WARNING_BEFORE_LOGOUT / 1000);

	inactivityWarning.set({ show: true, secondsLeft });

	// Countdown starten
	countdownInterval = setInterval(() => {
		secondsLeft--;
		if (secondsLeft <= 0) {
			clearInterval(countdownInterval);
		} else {
			inactivityWarning.set({ show: true, secondsLeft });
		}
	}, 1000);
}

// Logout durchführen
async function performLogout() {
	if (!browser) return;
	cleanup();
	await supabase.auth.signOut();
	// Verwende window.location statt goto, da goto im Timer-Kontext nicht zuverlässig funktioniert
	window.location.href = '/?reason=inactivity';
}

// Session verlängern (bei Benutzer-Aktivität oder Button-Klick)
export function extendSession() {
	resetTimers();
}

// Event Handler für Aktivität
function handleActivity() {
	const warning = get(inactivityWarning);
	// Nur zurücksetzen wenn KEINE Warnung angezeigt wird
	// (Bei Warnung muss der Benutzer explizit auf "Weiter arbeiten" klicken)
	if (!warning.show) {
		resetTimers();
	}
}

// Initialisierung - einmal pro Session aufrufen
export function initInactivityTracking() {
	if (!browser) return;
	if (isInitialized) return;
	isInitialized = true;

	// Event Listener hinzufügen
	ACTIVITY_EVENTS.forEach(event => {
		window.addEventListener(event, handleActivity, { passive: true });
	});

	// Timer starten
	resetTimers();
}

// Aufräumen - beim Logout oder Seitenwechsel
export function cleanup() {
	if (!browser) return;
	isInitialized = false;

	// Event Listener entfernen
	ACTIVITY_EVENTS.forEach(event => {
		window.removeEventListener(event, handleActivity);
	});

	// Timer löschen
	if (inactivityTimer) clearTimeout(inactivityTimer);
	if (warningTimer) clearTimeout(warningTimer);
	if (countdownInterval) clearInterval(countdownInterval);

	// Store zurücksetzen
	inactivityWarning.set({ show: false, secondsLeft: 0 });
}
