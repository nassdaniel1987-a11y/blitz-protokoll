<script>
	import { darkMode } from '$lib/darkModeStore';
	import { modernUi } from '$lib/modernUiStore';
	import { onMount } from 'svelte';
	import { toast } from '$lib/toastStore';
	import { supabase } from '$lib/supabaseClient';
	import { navigating } from '$app/stores';
	import { fade } from 'svelte/transition';
	import Toast from '$lib/components/Toast.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import '../app.css';

	let toasts = [];
	let isModernUi = false;
	let isLoggedIn = false;

	toast.subscribe(value => {
		toasts = value;
	});

	// Reactive: Track modern-ui state
	$: isModernUi = document?.documentElement?.classList?.contains('modern-ui') || false;

	onMount(async () => {
		if ($darkMode) {
			document.documentElement.classList.add('dark');
		}

		// Modern UI nur für Admins aktivieren
		const { data } = await supabase.auth.getSession();
		if (data.session) {
			isLoggedIn = true;
			const isAdmin = data.session.user?.user_metadata?.is_admin === true;
			if (isAdmin && $modernUi) {
				document.documentElement.classList.add('modern-ui');
				isModernUi = true;
			} else {
				document.documentElement.classList.remove('modern-ui');
				isModernUi = false;
			}
		} else {
			// Nicht eingeloggt -> kein Modern UI
			isLoggedIn = false;
			document.documentElement.classList.remove('modern-ui');
			isModernUi = false;
		}

		// Auth-State-Changes überwachen (Login/Logout)
		supabase.auth.onAuthStateChange((event, session) => {
			if (session) {
				isLoggedIn = true;
				const isAdmin = session.user?.user_metadata?.is_admin === true;
				if (isAdmin && $modernUi) {
					document.documentElement.classList.add('modern-ui');
					isModernUi = true;
				} else {
					document.documentElement.classList.remove('modern-ui');
					isModernUi = false;
				}
			} else {
				isLoggedIn = false;
				document.documentElement.classList.remove('modern-ui');
				isModernUi = false;
			}
		});
	});
</script>

{#if $navigating && isModernUi}
	<div class="page-transition-overlay" transition:fade={{ duration: 150 }}></div>
{/if}

{#key isModernUi ? $navigating : null}
	<div class="page-wrapper" class:modern-transition={isModernUi}>
		<slot />
	</div>
{/key}

<!-- Bottom Navigation (Modern UI only, logged in only) -->
{#if isModernUi && isLoggedIn}
	<BottomNav />
{/if}

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

	/* Page Transitions (Modern UI only) */
	.page-transition-overlay {
		position: fixed;
		inset: 0;
		background: var(--bg-primary, #f0f4f8);
		opacity: 0.4;
		z-index: 9998;
		pointer-events: none;
	}

	.page-wrapper.modern-transition {
		animation: pageEnter 0.3s ease-out;
	}

	@keyframes pageEnter {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>