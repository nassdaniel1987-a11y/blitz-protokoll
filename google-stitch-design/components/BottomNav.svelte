<script>
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { getToday } from '$lib/protokollService';

	$: currentPath = $page.url.pathname;

	const navItems = [
		{ path: '/dashboard', label: 'Dashboard', icon: 'home' },
		{ path: '/edit', label: 'Neu', icon: 'plus' },
		{ path: '/settings', label: 'Einstellungen', icon: 'settings' }
	];

	function navigate(item) {
		if (item.path === '/edit') {
			goto(`/edit?date=${getToday()}`);
		} else {
			goto(item.path);
		}
	}

	function isActive(itemPath) {
		if (itemPath === '/dashboard') return currentPath === '/dashboard' || currentPath === '/';
		return currentPath.startsWith(itemPath);
	}
</script>

<nav class="bottom-nav">
	{#each navItems as item}
		<button
			class="bottom-nav-item"
			class:active={isActive(item.path)}
			on:click={() => navigate(item)}
		>
			<span class="bottom-nav-icon">
				{#if item.icon === 'home'}
					<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
						<polyline points="9 22 9 12 15 12 15 22"></polyline>
					</svg>
				{:else if item.icon === 'plus'}
					<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<line x1="12" y1="5" x2="12" y2="19"></line>
						<line x1="5" y1="12" x2="19" y2="12"></line>
					</svg>
				{:else if item.icon === 'settings'}
					<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="3"></circle>
						<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
					</svg>
				{/if}
			</span>
			<span class="bottom-nav-label">{item.label}</span>
		</button>
	{/each}
</nav>

<style>
	.bottom-nav {
		display: none;
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: var(--bg-secondary);
		border-top: 1px solid var(--border-color);
		z-index: 999;
		padding: 6px 0 env(safe-area-inset-bottom, 8px);
		justify-content: space-around;
		align-items: center;
		box-shadow: 0 -2px 16px rgba(0, 0, 0, 0.08);
		backdrop-filter: blur(12px);
	}

	:global(.modern-ui) .bottom-nav {
		background: rgba(255, 255, 255, 0.9);
		border-top: 1px solid var(--border-color);
	}

	:global(.modern-ui.dark) .bottom-nav {
		background: rgba(28, 33, 40, 0.92);
	}

	@media (max-width: 768px) {
		.bottom-nav {
			display: flex;
		}
	}

	.bottom-nav-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		padding: 6px 16px;
		background: none;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.2s;
		border-radius: var(--radius-md, 8px);
		-webkit-tap-highlight-color: transparent;
	}

	.bottom-nav-item:hover {
		color: var(--accent-color);
	}

	.bottom-nav-item.active {
		color: var(--accent-color);
	}

	:global(.modern-ui) .bottom-nav-item.active {
		background: var(--accent-light);
	}

	.bottom-nav-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: var(--radius-md, 8px);
		transition: all 0.2s;
	}

	.bottom-nav-item.active .bottom-nav-icon {
		transform: scale(1.1);
	}

	:global(.modern-ui) .bottom-nav-item.active .bottom-nav-icon {
		background: var(--accent-light);
	}

	.bottom-nav-label {
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.01em;
	}

	.bottom-nav-item.active .bottom-nav-label {
		font-weight: 600;
	}

	/* Prevent content from being hidden behind bottom nav */
	@media (max-width: 768px) {
		:global(.modern-ui) :global(.dashboard),
		:global(.modern-ui) :global(.edit-container),
		:global(.modern-ui) :global(.settings-container) {
			padding-bottom: 80px !important;
		}
	}
</style>
