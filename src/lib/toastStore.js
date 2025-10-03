// src/lib/toastStore.js
import { writable } from 'svelte/store';

function createToastStore() {
	const { subscribe, update } = writable([]);

	let nextId = 0;

	return {
		subscribe,
		show: (message, type = 'success', duration = 3000) => {
			const id = nextId++;
			update(toasts => [...toasts, { id, message, type, duration }]);
			
			// Toast nach Ablauf entfernen
			setTimeout(() => {
				update(toasts => toasts.filter(t => t.id !== id));
			}, duration + 500);
		},
		success: (message, duration) => {
			return createToastStore().show(message, 'success', duration);
		},
		error: (message, duration) => {
			return createToastStore().show(message, 'error', duration);
		},
		info: (message, duration) => {
			return createToastStore().show(message, 'info', duration);
		},
		remove: (id) => {
			update(toasts => toasts.filter(t => t.id !== id));
		}
	};
}

export const toast = createToastStore();