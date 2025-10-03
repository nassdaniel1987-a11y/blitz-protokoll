// src/lib/darkModeStore.js
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Dark Mode aus localStorage laden (oder System-Präferenz)
function getInitialDarkMode() {
	if (!browser) return false;
	
	const saved = localStorage.getItem('darkMode');
	if (saved !== null) {
		return saved === 'true';
	}
	
	// System-Präferenz prüfen
	return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export const darkMode = writable(getInitialDarkMode());

// Dark Mode in localStorage speichern
if (browser) {
	darkMode.subscribe(value => {
		localStorage.setItem('darkMode', value.toString());
		if (value) {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
	});
}