// src/lib/modernUiStore.js
// Modern UI Store - aktiviert das modernisierte Design nur für Admin-Nutzer
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

function getInitialModernUi() {
	if (!browser) return false;
	const saved = localStorage.getItem('modernUi');
	// Standardmäßig aktiviert für Admins (kann in Settings deaktiviert werden)
	return saved !== null ? saved === 'true' : true;
}

export const modernUi = writable(getInitialModernUi());

// Modern UI State in localStorage speichern und CSS-Klasse anwenden
if (browser) {
	modernUi.subscribe(value => {
		localStorage.setItem('modernUi', value.toString());
		if (value) {
			document.documentElement.classList.add('modern-ui');
		} else {
			document.documentElement.classList.remove('modern-ui');
		}
	});
}
