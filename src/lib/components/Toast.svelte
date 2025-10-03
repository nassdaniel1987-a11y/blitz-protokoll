<script>
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';

	export let message = '';
	export let type = 'success'; // 'success', 'error', 'info'
	export let duration = 3000;
	export let onClose = () => {};

	let visible = true;

	onMount(() => {
		const timer = setTimeout(() => {
			visible = false;
			setTimeout(onClose, 300);
		}, duration);

		return () => clearTimeout(timer);
	});
</script>

{#if visible}
	<div 
		class="toast toast-{type}" 
		transition:fly={{ y: -50, duration: 300 }}
	>
		<span class="toast-icon">
			{#if type === 'success'}✓{/if}
			{#if type === 'error'}✕{/if}
			{#if type === 'info'}ℹ{/if}
		</span>
		<span class="toast-message">{message}</span>
		<button class="toast-close" on:click={() => { visible = false; onClose(); }}>
			✕
		</button>
	</div>
{/if}

<style>
	.toast {
		position: fixed;
		top: 20px;
		right: 20px;
		z-index: 10000;
		padding: 16px 20px;
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 300px;
		max-width: 500px;
		animation: slideIn 0.3s ease;
	}

	@keyframes slideIn {
		from {
			transform: translateY(-100%);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	.toast-success {
		background: #10b981;
		color: white;
	}

	.toast-error {
		background: #ef4444;
		color: white;
	}

	.toast-info {
		background: #3b82f6;
		color: white;
	}

	.toast-icon {
		font-size: 20px;
		font-weight: bold;
	}

	.toast-message {
		flex: 1;
		font-size: 15px;
	}

	.toast-close {
		background: none;
		border: none;
		color: white;
		font-size: 18px;
		cursor: pointer;
		padding: 4px;
		opacity: 0.8;
		transition: opacity 0.2s;
	}

	.toast-close:hover {
		opacity: 1;
	}

	@media (max-width: 768px) {
		.toast {
			left: 20px;
			right: 20px;
			min-width: auto;
		}
	}
</style>