<script>
	import { darkMode } from '$lib/darkModeStore';
	import { onMount } from 'svelte';
	import '../app.css';

	onMount(() => {
		// Dark Mode Klasse sofort anwenden
		if ($darkMode) {
			document.documentElement.classList.add('dark');
		}
	});
</script>

<slot />