<script>
	import { darkMode } from '$lib/darkModeStore';
	import { onMount } from 'svelte';
	import { toast } from '$lib/toastStore';
	import Toast from '$lib/components/Toast.svelte';
	import '../app.css';

	let toasts = [];

	toast.subscribe(value => {
		toasts = value;
	});

	onMount(() => {
		if ($darkMode) {
			document.documentElement.classList.add('dark');
		}
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