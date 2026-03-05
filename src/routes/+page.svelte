<script>
	import { supabase } from '$lib/supabaseClient';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { darkMode } from '$lib/darkModeStore';

	let username = '';
	let password = '';
	let errorMessage = '';
	let loading = false;
	let inactivityLogout = false;

	onMount(() => {
		// Prüfe ob Benutzer wegen Inaktivität ausgeloggt wurde
		const urlParams = new URLSearchParams(window.location.search);
		if (urlParams.get('reason') === 'inactivity') {
			inactivityLogout = true;
			// URL bereinigen (Query-Parameter entfernen)
			window.history.replaceState({}, '', '/');
		}
	});

	async function handleLogin() {
		loading = true;
		errorMessage = '';

		// Konvertiere Benutzername zu interner E-Mail
		const email = `${username.trim()}@blitz-protokoll.local`;

		const { data, error } = await supabase.auth.signInWithPassword({
			email: email,
			password: password
		});

		if (error) {
			errorMessage = 'Anmeldung fehlgeschlagen: Benutzername oder Passwort falsch';
			loading = false;
		} else {
			// Prüfe ob Passwort geändert werden muss
			const user = data.user;
			if (user?.user_metadata?.must_change_password === true) {
				goto('/change-password');
			} else {
				// Erfolgreich eingeloggt - weiter zum Dashboard
				goto('/dashboard');
			}
		}
	}
</script>

<div class="login-container">
	<div class="dark-mode-toggle-container">
		<button on:click={() => $darkMode = !$darkMode} class="dark-mode-toggle" title="Dark Mode umschalten">
			{$darkMode ? '☀️' : '🌙'}
		</button>
	</div>

	<div class="login-box">
		<h1>Blitz-Protokoll</h1>
		<p class="subtitle">Anmeldung für das Kollegium</p>

		{#if inactivityLogout}
			<div class="inactivity-notice">
				Du wurdest wegen Inaktivität automatisch abgemeldet.
			</div>
		{/if}

		<form on:submit|preventDefault={handleLogin}>
			<div class="form-group">
				<label for="username">Benutzername</label>
				<input
					type="text"
					id="username"
					bind:value={username}
					required
					placeholder="mueller"
					autocomplete="username"
				/>
			</div>

			<div class="form-group">
				<label for="password">Passwort</label>
				<input
					type="password"
					id="password"
					bind:value={password}
					required
					placeholder="••••••••"
					autocomplete="current-password"
				/>
			</div>

			{#if errorMessage}
				<div class="error-message">
					{errorMessage}
				</div>
			{/if}

			<button type="submit" disabled={loading}>
				{loading ? 'Anmeldung läuft...' : 'Anmelden'}
			</button>
		</form>
	</div>
</div>

<style>
	.login-container {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 100vh;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		padding: 20px;
		position: relative;
	}

	:global(.dark) .login-container {
		background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
	}

	.dark-mode-toggle-container {
		position: absolute;
		top: 20px;
		right: 20px;
	}

	.dark-mode-toggle {
		padding: 12px 16px;
		background: rgba(255, 255, 255, 0.2);
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-radius: 8px;
		cursor: pointer;
		font-size: 20px;
		line-height: 1;
		backdrop-filter: blur(10px);
		transition: all 0.3s;
	}

	.dark-mode-toggle:hover {
		background: rgba(255, 255, 255, 0.3);
		transform: scale(1.05);
	}

	.login-box {
		background: var(--bg-secondary);
		padding: 40px;
		border-radius: 12px;
		box-shadow: 0 10px 40px var(--shadow);
		width: 100%;
		max-width: 400px;
	}

	h1 {
		margin: 0 0 10px 0;
		color: var(--text-primary);
		text-align: center;
		font-size: 2rem;
	}

	.subtitle {
		text-align: center;
		color: var(--text-secondary);
		margin-bottom: 30px;
	}

	.form-group {
		margin-bottom: 20px;
	}

	label {
		display: block;
		margin-bottom: 8px;
		color: var(--text-primary);
		font-weight: 500;
	}

	input {
		width: 100%;
		padding: 12px;
		border: 2px solid var(--border-color);
		border-radius: 8px;
		font-size: 16px;
		transition: border-color 0.3s;
		box-sizing: border-box;
		background: var(--bg-primary);
		color: var(--text-primary);
	}

	input:focus {
		outline: none;
		border-color: var(--accent-color);
	}

	button {
		width: 100%;
		padding: 14px;
		background: var(--accent-color);
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 16px;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.3s;
	}

	button:hover:not(:disabled) {
		background: var(--accent-hover);
	}

	button:disabled {
		background: #ccc;
		cursor: not-allowed;
	}

	.error-message {
		background: #fee;
		color: #c33;
		padding: 12px;
		border-radius: 6px;
		margin-bottom: 20px;
		font-size: 14px;
	}

	:global(.dark) .error-message {
		background: #4a1a1a;
		color: #ff6b6b;
	}

	.inactivity-notice {
		background: #fff3cd;
		color: #856404;
		padding: 12px;
		border-radius: 6px;
		margin-bottom: 20px;
		font-size: 14px;
		text-align: center;
		border-left: 4px solid #ffc107;
	}

	:global(.dark) .inactivity-notice {
		background: #3d3a1a;
		color: #ffc107;
	}

	/* === MODERN UI LOGIN OVERRIDES === */
	:global(.modern-ui) .login-container {
		background: var(--gradient-header);
	}

	:global(.modern-ui.dark) .login-container {
		background: linear-gradient(135deg, #0f1419 0%, #1c1b3a 50%, #0f1419 100%);
	}

	:global(.modern-ui) .login-box {
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-lg);
		border: 1px solid var(--border-color);
		padding: 44px;
	}

	:global(.modern-ui) .login-box h1 {
		background: var(--gradient-primary);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		font-weight: 700;
		font-size: 2.2rem;
		letter-spacing: -0.03em;
	}

	:global(.modern-ui) .login-box input {
		border-radius: var(--radius-md);
		border: 1.5px solid var(--border-color);
		padding: 14px;
		transition: all 0.2s;
	}

	:global(.modern-ui) .login-box input:focus {
		border-color: var(--accent-color);
		box-shadow: 0 0 0 3px var(--accent-glow);
	}

	:global(.modern-ui) .login-box button[type="submit"] {
		background: var(--gradient-primary);
		border-radius: var(--radius-md);
		font-weight: 600;
		padding: 16px;
		box-shadow: var(--shadow-accent);
		transition: all 0.2s;
	}

	:global(.modern-ui) .login-box button[type="submit"]:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 8px 24px rgba(79, 109, 245, 0.3);
	}

	:global(.modern-ui) .dark-mode-toggle {
		border-radius: var(--radius-md);
		backdrop-filter: blur(12px);
		border: 1.5px solid rgba(255, 255, 255, 0.2);
	}

	:global(.modern-ui) .error-message {
		border-radius: var(--radius-sm);
		border-left: 4px solid #ef4444;
	}

	:global(.modern-ui) .inactivity-notice {
		border-radius: var(--radius-sm);
	}
	/* === END MODERN UI LOGIN OVERRIDES === */

	/* iPad-optimiert: Touch-freundliche Größen */
	@media (max-width: 768px) {
		input, button {
			padding: 16px;
			font-size: 18px;
		}

		.dark-mode-toggle-container {
			top: 10px;
			right: 10px;
		}
	}
</style>