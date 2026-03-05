<script>
	import { darkMode } from '$lib/darkModeStore';
	import { modernUi } from '$lib/modernUiStore';
	import { onMount } from 'svelte';
	import { toast } from '$lib/toastStore';
	import { supabase } from '$lib/supabaseClient';
	import Toast from '$lib/components/Toast.svelte';
	import '../app.css';

	let toasts = [];

	toast.subscribe(value => {
		toasts = value;
	});

	onMount(async () => {
		if ($darkMode) {
			document.documentElement.classList.add('dark');
		}

		// Modern UI nur für Admins aktivieren
		const { data } = await supabase.auth.getSession();
		if (data.session) {
			const isAdmin = data.session.user?.user_metadata?.is_admin === true;
			if (isAdmin && $modernUi) {
				document.documentElement.classList.add('modern-ui');
			} else {
				document.documentElement.classList.remove('modern-ui');
			}
		} else {
			// Nicht eingeloggt -> kein Modern UI
			document.documentElement.classList.remove('modern-ui');
		}

		// Auth-State-Changes überwachen (Login/Logout)
		supabase.auth.onAuthStateChange((event, session) => {
			if (session) {
				const isAdmin = session.user?.user_metadata?.is_admin === true;
				if (isAdmin && $modernUi) {
					document.documentElement.classList.add('modern-ui');
				} else {
					document.documentElement.classList.remove('modern-ui');
				}
			} else {
				document.documentElement.classList.remove('modern-ui');
			}
		});
	});
</script>

<slot />

<!-- Toast Container -->
<div class="toast-container">
	{#each toasts as t (t.id)}
		<Toast 
			message={t.message} 
			type={t.type} 
			duration={t.duration}
			onClose={() => toast.remove(t.id)}
		/>
	{/each}
</div>

<style>
	.toast-container {
		position: fixed;
		top: 0;
		right: 0;
		z-index: 10000;
		pointer-events: none;
	}

	.toast-container :global(.toast) {
		pointer-events: all;
	}
</style>