<script>
	import { supabase } from '$lib/supabaseClient';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { getProtokoll, getToday, deleteProtokoll } from '$lib/protokollService';
	import { darkMode } from '$lib/darkModeStore';

	let currentDate = getToday();
	let protokoll = null;
	let loading = true;

	// Raumliste
	const raeume = [
		{ key: 'treffpunkt_1', label: 'Treffpunkt 1' },
		{ key: 'treffpunkt_2', label: 'Treffpunkt 2' },
		{ key: 'treffpunkt_3', label: 'Treffpunkt 3' },
		{ key: 'treffpunkt_4', label: 'Treffpunkt 4' },
		{ key: 'treffpunkt_kurz', label: 'Treffpunkt kurz' },
		{ key: 'atelier', label: 'Atelier' },
		{ key: 'werkstatt', label: 'Werkstatt' },
		{ key: 'sporthalle', label: 'Sporthalle' },
		{ key: 'gymnastikhalle', label: 'Gymnastikhalle' },
		{ key: 'computerraum', label: 'Computerraum' },
		{ key: 'hof', label: 'Hof' }
	];

	const zeitslots = ['12:25-13:10', '13:15-14:00', '14:00-14:30'];

	onMount(async () => {
		// Prüfen ob Benutzer eingeloggt ist
		const { data } = await supabase.auth.getSession();
		if (!data.session) {
			goto('/');
			return;
		}

		await loadProtokoll();
	});

	async function loadProtokoll() {
		loading = true;
		protokoll = await getProtokoll(currentDate);
		loading = false;
	}

	function changeDate(days) {
		const date = new Date(currentDate);
		date.setDate(date.getDate() + days);
		currentDate = date.toISOString().split('T')[0];
		loadProtokoll();
	}

	function goToToday() {
		currentDate = getToday();
		loadProtokoll();
	}

	function formatDate(dateString) {
		const date = new Date(dateString);
		const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
		return date.toLocaleDateString('de-DE', options);
	}

	async function handleDelete() {
		const confirmed = confirm(
			`Möchtest du das Protokoll vom ${formatDate(currentDate)} wirklich löschen?\n\nDieser Vorgang kann nicht rückgängig gemacht werden!`
		);
		
		if (!confirmed) return;

		const success = await deleteProtokoll(currentDate);
		if (success) {
			alert('Protokoll gelöscht!');
			await loadProtokoll();
		} else {
			alert('Fehler beim Löschen!');
		}
	}

	async function handleLogout() {
		await supabase.auth.signOut();
		goto('/');
	}
</script>

<div class="dashboard">
	<header class="header">
		<h1>Blitz-Protokoll</h1>
		<div class="header-actions">
			<button on:click={() => goto('/settings')} class="settings-btn" title="Einstellungen">
				⚙️
			</button>
			<button on:click={() => $darkMode = !$darkMode} class="dark-mode-toggle" title="Dark Mode umschalten">
				{$darkMode ? '☀️' : '🌙'}
			</button>
			<button on:click={handleLogout} class="logout-btn">Abmelden</button>
		</div>
	</header>

	<!-- Datumsnavigation -->
	<div class="date-nav">
		<button on:click={() => changeDate(-1)} class="nav-btn">← Vorheriger Tag</button>
		<div class="current-date">
			<h2>{formatDate(currentDate)}</h2>
			{#if currentDate !== getToday()}
				<button on:click={goToToday} class="today-btn">Zu heute springen</button>
			{/if}
		</div>
		<button on:click={() => changeDate(1)} class="nav-btn">Nächster Tag →</button>
	</div>

	<!-- Protokoll-Inhalt -->
	{#if loading}
		<div class="loading">Lade Protokoll...</div>
	{:else if protokoll}
		<div class="protokoll-content">
			<!-- Bearbeiten Button -->
			<div class="action-bar">
				<button on:click={() => goto(`/edit?date=${currentDate}`)} class="edit-btn">
					✏️ Protokoll bearbeiten
				</button>
				<button on:click={handleDelete} class="delete-btn">
					🗑️ Protokoll löschen
				</button>
			</div>

			<!-- Allgemeine Infos -->
			<section class="section">
				<h3>Allgemeine Informationen</h3>
				<div class="info-grid">
					<div class="info-item">
						<strong>Anwesenheit:</strong>
						<span>{protokoll.inhalt.anwesenheit || '-'}</span>
					</div>
					<div class="info-item">
						<strong>Wer geht essen:</strong>
						<span>{protokoll.inhalt.wer_geht_essen || '-'}</span>
					</div>
					<div class="info-item">
						<strong>Leitung im Haus:</strong>
						<span>{protokoll.inhalt.leitung_im_haus || '-'}</span>
					</div>
					<div class="info-item">
						<strong>Spätdienst:</strong>
						<span>{protokoll.inhalt.spaetdienst || '-'}</span>
					</div>
					<div class="info-item">
						<strong>Frühdienst (nächster Tag):</strong>
						<span>{protokoll.inhalt.fruehdienst_naechster_tag || '-'}</span>
					</div>
					{#if protokoll.inhalt.sonstiges}
						<div class="info-item full-width">
							<strong>Sonstiges:</strong>
							<span>{protokoll.inhalt.sonstiges}</span>
						</div>
					{/if}
				</div>
			</section>

			<!-- Belegungsplan -->
			<section class="section">
				<h3>Belegungsplanung</h3>
				<div class="table-container">
					<table class="planung-table">
						<thead>
							<tr>
								<th>Raum / Zeit</th>
								{#each zeitslots as slot}
									<th>{slot}</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each raeume as raum}
								<tr>
									<td class="raum-label">{raum.label}</td>
									{#each zeitslots as slot}
										<td>{protokoll.inhalt.planung[slot][raum.key] || '-'}</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</section>
		</div>
	{:else}
		<div class="no-protokoll">
			<p>📝 Für diesen Tag ist noch kein Protokoll vorhanden.</p>
			<button on:click={() => goto(`/edit?date=${currentDate}`)} class="create-btn">
				Neues Protokoll erstellen
			</button>
		</div>
	{/if}
</div>

<style>
	.dashboard {
		min-height: 100vh;
		background: var(--bg-primary);
		padding: 20px;
	}

	.header {
		max-width: 1400px;
		margin: 0 auto 30px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: var(--bg-secondary);
		padding: 20px 30px;
		border-radius: 12px;
		box-shadow: 0 2px 8px var(--shadow);
	}

	.header-actions {
		display: flex;
		gap: 10px;
		align-items: center;
	}

	h1 {
		margin: 0;
		color: var(--text-primary);
		font-size: 1.8rem;
	}

	.settings-btn {
		padding: 10px 14px;
		background: var(--bg-primary);
		border: 2px solid var(--border-color);
		border-radius: 6px;
		cursor: pointer;
		font-size: 18px;
		line-height: 1;
	}

	.settings-btn:hover {
		background: var(--border-color);
	}

	.dark-mode-toggle {
		padding: 10px 14px;
		background: var(--bg-primary);
		border: 2px solid var(--border-color);
		border-radius: 6px;
		cursor: pointer;
		font-size: 18px;
		line-height: 1;
	}

	.dark-mode-toggle:hover {
		background: var(--border-color);
	}

	.logout-btn {
		padding: 10px 20px;
		background: #666;
		color: white;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-size: 14px;
	}

	.logout-btn:hover {
		background: #555;
	}

	/* Datumsnavigation */
	.date-nav {
		max-width: 1400px;
		margin: 0 auto 30px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 20px;
		background: var(--bg-secondary);
		padding: 20px;
		border-radius: 12px;
		box-shadow: 0 2px 8px var(--shadow);
	}

	.current-date {
		text-align: center;
		flex: 1;
	}

	.current-date h2 {
		margin: 0 0 10px 0;
		color: var(--text-primary);
		font-size: 1.5rem;
	}

	.nav-btn {
		padding: 12px 20px;
		background: var(--accent-color);
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-size: 14px;
		white-space: nowrap;
	}

	.nav-btn:hover {
		background: var(--accent-hover);
	}

	.today-btn {
		padding: 8px 16px;
		background: var(--bg-primary);
		color: var(--text-primary);
		border: 2px solid var(--border-color);
		border-radius: 6px;
		cursor: pointer;
		font-size: 13px;
	}

	.today-btn:hover {
		background: var(--border-color);
	}

	/* Protokoll Content */
	.protokoll-content {
		max-width: 1400px;
		margin: 0 auto;
	}

	.action-bar {
		margin-bottom: 20px;
		text-align: right;
		display: flex;
		gap: 15px;
		justify-content: flex-end;
	}

	.edit-btn {
		padding: 12px 24px;
		background: var(--accent-color);
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-size: 16px;
	}

	.edit-btn:hover {
		background: var(--accent-hover);
	}

	.delete-btn {
		padding: 12px 24px;
		background: #dc3545;
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-size: 16px;
	}

	.delete-btn:hover {
		background: #c82333;
	}

	.section {
		background: var(--bg-secondary);
		padding: 30px;
		border-radius: 12px;
		box-shadow: 0 2px 8px var(--shadow);
		margin-bottom: 20px;
	}

	h3 {
		margin: 0 0 20px 0;
		color: var(--text-primary);
		font-size: 1.3rem;
		border-bottom: 2px solid var(--accent-color);
		padding-bottom: 10px;
	}

	.info-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 15px;
	}

	.info-item {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.info-item.full-width {
		grid-column: 1 / -1;
	}

	.info-item strong {
		color: var(--text-secondary);
		font-size: 0.9rem;
	}

	.info-item span {
		color: var(--text-primary);
		font-size: 1rem;
	}

	/* Tabelle */
	.table-container {
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
	}

	.planung-table {
		width: 100%;
		border-collapse: collapse;
		min-width: 600px;
	}

	.planung-table th,
	.planung-table td {
		border: 1px solid var(--border-color);
		padding: 12px;
		text-align: left;
	}

	.planung-table thead th {
		background: var(--accent-color);
		color: white;
		font-weight: 600;
	}

	.raum-label {
		background: var(--bg-primary);
		font-weight: 500;
		color: var(--text-primary);
	}

	.planung-table tbody tr:hover {
		background: var(--bg-primary);
	}

	.planung-table td {
		color: var(--text-primary);
	}

	/* Kein Protokoll */
	.no-protokoll {
		max-width: 600px;
		margin: 60px auto;
		text-align: center;
		background: var(--bg-secondary);
		padding: 60px 40px;
		border-radius: 12px;
		box-shadow: 0 2px 8px var(--shadow);
	}

	.no-protokoll p {
		font-size: 1.2rem;
		color: var(--text-secondary);
		margin-bottom: 30px;
	}

	.create-btn {
		padding: 14px 28px;
		background: var(--accent-color);
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-size: 16px;
		font-weight: 600;
	}

	.create-btn:hover {
		background: var(--accent-hover);
	}

	.loading {
		max-width: 1400px;
		margin: 60px auto;
		text-align: center;
		font-size: 1.2rem;
		color: var(--text-secondary);
	}

	/* iPad Optimierung */
	@media (max-width: 768px) {
		.header {
			flex-direction: column;
			gap: 15px;
			text-align: center;
		}

		.header-actions {
			width: 100%;
			justify-content: center;
		}

		.date-nav {
			flex-direction: column;
		}

		.nav-btn {
			width: 100%;
		}

		.info-grid {
			grid-template-columns: 1fr;
		}

		.section {
			padding: 20px;
		}

		.action-bar {
			flex-direction: column;
		}

		.edit-btn,
		.delete-btn {
			width: 100%;
		}
	}
</style>