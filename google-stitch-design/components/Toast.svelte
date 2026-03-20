<script>
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';

	export let message = '';
	export let type = 'success'; // 'success', 'error', 'info'
	export let duration = 3000;
	export let onClose = () => {};

	let visible = true;
	let isModernUi = false;

	onMount(() => {
		isModernUi = document.documentElement.classList.contains('modern-ui');

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
		class:modern={isModernUi}
		transition:fly={{ x: isModernUi ? 400 : 0, y: isModernUi ? 0 : -50, duration: 300 }}
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
		{#if isModernUi}
			<div class="toast-progress" style="animation-duration: {duration}ms"></div>
		{/if}
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

	/* === MODERN UI TOAST OVERRIDES === */
	.toast.modern {
		border-radius: 14px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
		padding: 16px 20px 20px;
		animation: slideInRight 0.35s cubic-bezier(0.4, 0, 0.2, 1);
		overflow: hidden;
		backdrop-filter: blur(12px);
		border: 1px solid rgba(255, 255, 255, 0.15);
	}

	.toast.modern.toast-success {
		background: linear-gradient(135deg, #10b981, #059669);
	}

	.toast.modern.toast-error {
		background: linear-gradient(135deg, #ef4444, #dc2626);
	}

	.toast.modern.toast-info {
		background: linear-gradient(135deg, #3b82f6, #2563eb);
	}

	@keyframes slideInRight {
		from {
			transform: translateX(120%);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}

	.toast.modern .toast-icon {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.2);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 16px;
		flex-shrink: 0;
	}

	.toast.modern .toast-close {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 14px;
		transition: all 0.2s;
	}

	.toast.modern .toast-close:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	/* Progress Bar */
	.toast-progress {
		position: absolute;
		bottom: 0;
		left: 0;
		height: 3px;
		background: rgba(255, 255, 255, 0.5);
		border-radius: 0 0 14px 14px;
		animation: progressShrink linear forwards;
		width: 100%;
	}

	@keyframes progressShrink {
		from {
			width: 100%;
		}
		to {
			width: 0%;
		}
	}
	/* === END MODERN UI TOAST OVERRIDES === */

	@media (max-width: 768px) {
		.toast {
			left: 20px;
			right: 20px;
			min-width: auto;
		}
	}
</style>
