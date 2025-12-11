<script>
	import { supabase } from '$lib/supabaseClient';
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { getProtokoll, getToday, deleteProtokoll } from '$lib/protokollService';
	import { getRaeume } from '$lib/einstellungenService';
	import { getNachrichten } from '$lib/teamNachrichtenService';
	import { darkMode } from '$lib/darkModeStore';
	import { toast } from '$lib/toastStore';
	import Wochenansicht from '$lib/components/Wochenansicht.svelte';
	import TeamNachrichtenModal from '$lib/components/TeamNachrichtenModal.svelte';
	import StatistikModal from '$lib/components/StatistikModal.svelte';

	let currentDate = getToday();
	let protokoll = null;
	let loading = true;
	let viewMode = 'day'; // 'day' oder 'week'
	let wochenDaten = [];
	let currentUsername = '';
	let showNachrichtenModal = false;
	let showStatistikModal = false;
	let messageCount = 0;
	let realtimeChannel = null; // Realtime für Badge-Counter
	let showOnboardingModal = false; // Onboarding für neue Nutzer
	let activeTooltip = null; // Für Hilfe-Tooltips

	// Raumliste - wird dynamisch geladen
	let raeume = [];

	const zeitslots = ['12:25-13:10', '13:15-14:00', '14:00-14:30'];

	onMount(async () => {
		// Prüfen ob Benutzer eingeloggt ist
		const { data } = await supabase.auth.getSession();
		if (!data.session) {
			goto('/');
			return;
		}

		// Username extrahieren (von email)
		const email = data.session.user.email;
		currentUsername = email.split('@')[0];

		// Prüfe ob Nutzer neu ist (Onboarding noch nicht gesehen)
		const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
		if (!hasSeenOnboarding) {
			// Zeige Onboarding nach kurzer Verzögerung
			setTimeout(() => {
				showOnboardingModal = true;
			}, 500);
		}

		// Räume laden
		const raumDaten = await getRaeume();
		raeume = raumDaten.map(r => ({ key: r.id, label: r.label }));

		await loadProtokoll();
		await loadMessageCount();

		// REALTIME: Badge-Counter auto-update
		subscribeToMessages();
	});

	onDestroy(() => {
		if (realtimeChannel) {
			supabase.removeChannel(realtimeChannel);
		}
	});

	// REALTIME: Subscribe zu Nachrichten für Badge-Counter
	function subscribeToMessages() {
		realtimeChannel = supabase
			.channel('dashboard-messages-badge')
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'team_nachrichten'
				},
				async () => {
					await loadMessageCount(); // Badge aktualisieren
				}
			)
			.subscribe();
	}

	async function loadMessageCount() {
		const nachrichten = await getNachrichten();
		messageCount = nachrichten.length;
	}

	async function loadProtokoll() {
		loading = true;
		protokoll = await getProtokoll(currentDate);
		loading = false;
	}

	// STATISTIKEN: Reaktive Berechnung der Dashboard-Statistiken
	$: stats = protokoll ? {
		anwesendeAnzahl: protokoll.inhalt.anwesenheit ?
			protokoll.inhalt.anwesenheit.split(',').map(p => p.trim()).filter(p => p).length : 0,
		warnungen: [
			!protokoll.inhalt.leitung_im_haus?.trim() ? 'Leitung im Haus fehlt!' : null,
			!protokoll.inhalt.spaetdienst?.trim() ? 'Spätdienst fehlt!' : null
		].filter(w => w),
		infos: [
			!protokoll.inhalt.fruehdienst_naechster_tag?.trim() ? 'Frühdienst (nächster Tag) nicht eingetragen' : null,
			!protokoll.inhalt.wer_geht_essen?.trim() ? 'Wer geht essen nicht eingetragen' : null
		].filter(i => i),
		fruehdienstNaechsterTag: protokoll.inhalt.fruehdienst_naechster_tag || null
	} : null;

	async function loadWoche() {
		loading = true;
		const date = new Date(currentDate);
		const dayOfWeek = (date.getDay() + 6) % 7; // Montag = 0
		const monday = new Date(date);
		monday.setDate(date.getDate() - dayOfWeek);

		const woche = [];
		for (let i = 0; i < 5; i++) {
			const day = new Date(monday);
			day.setDate(monday.getDate() + i);
			const datum = day.toISOString().split('T')[0];
			const protokoll = await getProtokoll(datum);
			woche.push({ datum, protokoll });
		}
		wochenDaten = woche;
		loading = false;
	}

	async function switchView(mode) {
		viewMode = mode;
		if (mode === 'week') {
			await loadWoche();
		} else {
			await loadProtokoll();
		}
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
			toast.show('Protokoll erfolgreich gelöscht!', 'success');
			await loadProtokoll();
		} else {
			toast.show('Fehler beim Löschen des Protokolls!', 'error');
		}
	}

	async function handleLogout() {
		await supabase.auth.signOut();
		goto('/');
	}

	function handlePrint() {
		window.print();
	}

	async function openNachrichtenModal() {
		showNachrichtenModal = true;
		await loadMessageCount();
	}

	function closeNachrichtenModal() {
		showNachrichtenModal = false;
		loadMessageCount();
	}

	function closeOnboarding() {
		showOnboardingModal = false;
		localStorage.setItem('hasSeenOnboarding', 'true');
	}

	function goToTestMode() {
		closeOnboarding();
		goto(`/edit?date=test-${currentUsername}`);
	}

	function toggleTooltip(tooltipId) {
		if (activeTooltip === tooltipId) {
			activeTooltip = null;
		} else {
			activeTooltip = tooltipId;
		}
	}
</script>

<TeamNachrichtenModal
	bind:show={showNachrichtenModal}
	{currentUsername}
/>

<StatistikModal
	bind:show={showStatistikModal}
/>

<!-- Onboarding Modal für neue Nutzer -->
{#if showOnboardingModal}
	<div class="modal-overlay onboarding-overlay">
		<div class="modal-content onboarding-modal">
			<div class="onboarding-header">
				<h2>🎉 Willkommen bei Blitz-Protokoll!</h2>
			</div>
			<div class="onboarding-body">
				<p class="welcome-text">
					Schön, dass du hier bist! Bevor du loslegst, hier ein paar Tipps:
				</p>

				<div class="tip-box">
					<div class="tip-icon">🧪</div>
					<div class="tip-content">
						<h3>Probiere die Testumgebung aus!</h3>
						<p>
							Im <strong>Testmodus</strong> kannst du gefahrlos alle Funktionen ausprobieren.
							Alles was du dort machst, hat keinen Einfluss auf echte Protokolle.
						</p>
					</div>
				</div>

				<div class="tip-box">
					<div class="tip-icon">📋</div>
					<div class="tip-content">
						<h3>Schnell starten mit "Von gestern kopieren"</h3>
						<p>
							Beim Erstellen neuer Protokolle kannst du die Daten vom Vortag kopieren
							und nur die Änderungen anpassen. Spart viel Zeit!
						</p>
					</div>
				</div>

				<div class="tip-box">
					<div class="tip-icon">❓</div>
					<div class="tip-content">
						<h3>Hilfe-Buttons nutzen</h3>
						<p>
							Bei vielen Funktionen findest du kleine <strong>?</strong>-Buttons.
							Diese erklären dir, was die jeweilige Funktion macht.
						</p>
					</div>
				</div>

				<div class="onboarding-actions">
					<button on:click={closeOnboarding} class="btn-later">
						Später
					</button>
					<button on:click={goToTestMode} class="btn-test">
						🧪 Zur Testumgebung
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<div class="dashboard">
	<header class="header no-print">
		<h1>Blitz-Protokoll</h1>
		<div class="header-actions">
			<div class="btn-with-help">
				<button on:click={openNachrichtenModal} class="nachrichten-btn" title="Team-Notizen">
					<span class="btn-icon">📝</span>
					<span class="btn-text">Team-Notizen</span>
					{#if messageCount > 0}
						<span class="badge">{messageCount}</span>
					{/if}
				</button>
				<button type="button" class="help-btn-header" on:click|stopPropagation={() => toggleTooltip('notizen')} title="Hilfe">?</button>
				{#if activeTooltip === 'notizen'}
					<div class="tooltip-box-header">
						<strong>Team-Notizen:</strong>
						<br>Hier kannst du Nachrichten mit deinem Team teilen. Ideal für Ankündigungen, Erinnerungen oder wichtige Informationen zum Tagesablauf.
					</div>
				{/if}
			</div>
			<div class="btn-with-help">
				<button on:click={() => showStatistikModal = true} class="statistik-btn" title="Statistiken">
					<span class="btn-icon">📊</span>
					<span class="btn-text">Statistiken</span>
				</button>
				<button type="button" class="help-btn-header" on:click|stopPropagation={() => toggleTooltip('statistik')} title="Hilfe">?</button>
				{#if activeTooltip === 'statistik'}
					<div class="tooltip-box-header">
						<strong>Statistiken:</strong>
						<br>Analysiere Anwesenheit und Raumnutzung über einen beliebigen Zeitraum. Du siehst deine persönlichen Statistiken und die Belegung der Räume.
					</div>
				{/if}
			</div>
			<button on:click={() => goto('/settings')} class="settings-btn" title="Einstellungen">
				<span class="btn-icon">⚙️</span>
				<span class="btn-text">Einstellungen</span>
			</button>
			<button on:click={() => $darkMode = !$darkMode} class="dark-mode-toggle" title="Dark Mode umschalten">
				<span class="btn-icon">{$darkMode ? '☀️' : '🌙'}</span>
				<span class="btn-text">{$darkMode ? 'Hell' : 'Dunkel'}</span>
			</button>
			<button on:click={handleLogout} class="logout-btn">Abmelden</button>
		</div>
	</header>

	<!-- View Toggle -->
	<div class="view-toggle no-print">
		<button
			class="toggle-btn test-mode-btn"
			on:click={() => goto(`/edit?date=test-${currentUsername}`)}
			title="Öffne dein persönliches Testprotokoll zum Ausprobieren"
		>
			🧪 Testmodus
		</button>
		<button
			class="toggle-btn"
			class:active={viewMode === 'day'}
			on:click={() => switchView('day')}
		>
			📅 Tagesansicht
		</button>
		<button
			class="toggle-btn"
			class:active={viewMode === 'week'}
			on:click={() => switchView('week')}
		>
			📆 Wochenansicht
		</button>
	</div>

	<!-- Datumsnavigation (nur in Tagesansicht) -->
	{#if viewMode === 'day'}
	<div class="date-nav no-print">
		<button on:click={() => changeDate(-1)} class="nav-btn">← Vorheriger Tag</button>
		<div class="current-date">
			<h2>{formatDate(currentDate)}</h2>
			{#if currentDate !== getToday()}
				<button on:click={goToToday} class="today-btn">Zu heute springen</button>
			{/if}
		</div>
		<button on:click={() => changeDate(1)} class="nav-btn">Nächster Tag →</button>
	</div>
	{/if}

	<!-- Tagesansicht -->
	{#if viewMode === 'day'}
		{#if loading}
			<div class="loading">Lade Protokoll...</div>
		{:else if protokoll}
		<div class="protokoll-content">
			<!-- Druck-Header (nur beim Drucken sichtbar) -->
			<div class="print-header">
				<h1>Blitz-Protokoll</h1>
				<h2>{formatDate(currentDate)}</h2>
			</div>

			<!-- Bearbeiten Button -->
			<div class="action-bar no-print">
				<button on:click={handlePrint} class="print-btn">
					🖨️ Drucken / PDF
				</button>
				<button on:click={() => goto(`/edit?date=${currentDate}`)} class="edit-btn">
					✏️ Protokoll bearbeiten
				</button>
				<button on:click={handleDelete} class="delete-btn">
					🗑️ Protokoll löschen
				</button>
			</div>

			<!-- SCHNELLSTATISTIK -->
			{#if stats}
				<section class="quick-stats no-print">
					<div class="stat-card stat-primary">
						<div class="stat-icon">👥</div>
						<div class="stat-content">
							<div class="stat-value">{stats.anwesendeAnzahl}</div>
							<div class="stat-label">Personen anwesend</div>
						</div>
					</div>

					{#if stats.fruehdienstNaechsterTag}
						<div class="stat-card stat-info">
							<div class="stat-icon">🌅</div>
							<div class="stat-content">
								<div class="stat-value">{stats.fruehdienstNaechsterTag}</div>
								<div class="stat-label">Frühdienst morgen</div>
							</div>
						</div>
					{/if}

					{#if stats.warnungen.length > 0}
						<div class="stat-card stat-warning">
							<div class="stat-icon">⚠️</div>
							<div class="stat-content">
								<div class="stat-label">Wichtige Felder fehlen:</div>
								{#each stats.warnungen as warnung}
									<div class="stat-warning-item">{warnung}</div>
								{/each}
							</div>
						</div>
					{/if}

					{#if stats.infos.length > 0}
						<div class="stat-card stat-info-light">
							<div class="stat-icon">ℹ️</div>
							<div class="stat-content">
								<div class="stat-label">Hinweise:</div>
								{#each stats.infos as info}
									<div class="stat-info-item">{info}</div>
								{/each}
							</div>
						</div>
					{/if}
				</section>
			{/if}

			<!-- Allgemeine Infos -->
			<section class="section">
				<h3>Allgemeine Informationen</h3>
				<div class="info-grid">
					<div class="info-item">
						<strong>Anwesenheit:</strong>
						<span>{protokoll.inhalt.anwesenheit || '-'}</span>
					</div>
					<div class="info-item">
						<strong>Abwesend:</strong>
						<span>{protokoll.inhalt.abwesend || '-'}</span>
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
										<td>{protokoll.inhalt.planung[slot]?.[raum.key] || '-'}</td>
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
	{/if}

	<!-- Wochenansicht -->
	{#if viewMode === 'week'}
		{#if loading}
			<div class="loading">Lade Wochendaten...</div>
		{:else}
			<Wochenansicht {wochenDaten} {raeume} />
		{/if}
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

	.nachrichten-btn {
		position: relative;
		padding: 10px 16px;
		background: var(--bg-primary);
		border: 2px solid var(--border-color);
		border-radius: 8px;
		cursor: pointer;
		font-size: 14px;
		line-height: 1;
		display: flex;
		align-items: center;
		gap: 6px;
		transition: all 0.2s;
	}

	.nachrichten-btn:hover {
		background: var(--border-color);
		transform: translateY(-1px);
	}

	.btn-icon {
		font-size: 16px;
		line-height: 1;
	}

	.btn-text {
		font-size: 14px;
		font-weight: 500;
		color: var(--text-primary);
	}

	.nachrichten-btn .badge {
		position: absolute;
		top: -6px;
		right: -6px;
		background: #dc3545;
		color: white;
		font-size: 11px;
		font-weight: 600;
		padding: 2px 6px;
		border-radius: 10px;
		min-width: 18px;
		text-align: center;
	}

	.statistik-btn {
		padding: 10px 16px;
		background: var(--bg-primary);
		border: 2px solid var(--border-color);
		border-radius: 8px;
		cursor: pointer;
		font-size: 14px;
		line-height: 1;
		display: flex;
		align-items: center;
		gap: 6px;
		transition: all 0.2s;
	}

	.statistik-btn:hover {
		background: var(--border-color);
		transform: translateY(-1px);
	}

	.settings-btn {
		padding: 10px 16px;
		background: var(--bg-primary);
		border: 2px solid var(--border-color);
		border-radius: 8px;
		cursor: pointer;
		font-size: 14px;
		line-height: 1;
		display: flex;
		align-items: center;
		gap: 6px;
		transition: all 0.2s;
	}

	.settings-btn:hover {
		background: var(--border-color);
		transform: translateY(-1px);
	}

	.dark-mode-toggle {
		padding: 10px 16px;
		background: var(--bg-primary);
		border: 2px solid var(--border-color);
		border-radius: 8px;
		cursor: pointer;
		font-size: 14px;
		line-height: 1;
		display: flex;
		align-items: center;
		gap: 6px;
		transition: all 0.2s;
	}

	.dark-mode-toggle:hover {
		background: var(--border-color);
		transform: translateY(-1px);
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

	/* View Toggle */
	.view-toggle {
		max-width: 1400px;
		margin: 0 auto 20px;
		display: flex;
		justify-content: center;
		gap: 10px;
		background: var(--bg-secondary);
		padding: 15px;
		border-radius: 12px;
		box-shadow: 0 2px 8px var(--shadow);
	}

	.toggle-btn {
		padding: 10px 24px;
		background: var(--bg-primary);
		color: var(--text-primary);
		border: 2px solid var(--border-color);
		border-radius: 8px;
		cursor: pointer;
		font-size: 16px;
		font-weight: 500;
		transition: all 0.2s;
	}

	.toggle-btn:hover {
		background: var(--border-color);
	}

	.toggle-btn.active {
		background: var(--accent-color);
		color: white;
		border-color: var(--accent-color);
	}

	.toggle-btn.test-mode-btn {
		background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
		color: white;
		border-color: #f5576c;
		font-weight: 600;
	}

	.toggle-btn.test-mode-btn:hover {
		background: linear-gradient(135deg, #d87de6 0%, #d4485a 100%);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(245, 87, 108, 0.3);
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

	/* SCHNELLSTATISTIK */
	.quick-stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 16px;
		margin-bottom: 30px;
	}

	.stat-card {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 20px;
		border-radius: 12px;
		box-shadow: 0 2px 8px var(--shadow);
		transition: transform 0.2s, box-shadow 0.2s;
	}

	.stat-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px var(--shadow);
	}

	.stat-card.stat-primary {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
	}

	:global(.dark-mode) .stat-card.stat-primary {
		background: linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%);
	}

	.stat-card.stat-info {
		background: linear-gradient(135deg, #6dd5fa 0%, #2980b9 100%);
		color: white;
	}

	:global(.dark-mode) .stat-card.stat-info {
		background: linear-gradient(135deg, #5ab9e8 0%, #2567a0 100%);
	}

	.stat-card.stat-warning {
		background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
		color: white;
	}

	:global(.dark-mode) .stat-card.stat-warning {
		background: linear-gradient(135deg, #d87de6 0%, #d4485a 100%);
	}

	.stat-card.stat-info-light {
		background: var(--bg-secondary);
		border: 2px solid #ffc107;
		color: var(--text-primary);
	}

	.stat-icon {
		font-size: 40px;
		flex-shrink: 0;
	}

	.stat-content {
		flex: 1;
	}

	.stat-value {
		font-size: 32px;
		font-weight: 700;
		line-height: 1;
		margin-bottom: 4px;
	}

	.stat-label {
		font-size: 14px;
		opacity: 0.9;
		font-weight: 500;
	}

	.stat-warning-item,
	.stat-info-item {
		font-size: 13px;
		margin-top: 6px;
		padding-left: 8px;
		border-left: 2px solid currentColor;
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
			flex-wrap: wrap;
		}

		.btn-text {
			display: none;
		}

		.btn-icon {
			font-size: 18px;
		}

		.nachrichten-btn,
		.statistik-btn,
		.settings-btn,
		.dark-mode-toggle {
			padding: 12px 14px;
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
		.delete-btn,
		.print-btn {
			width: 100%;
		}
	}

	/* Druck-Styles */
	.print-header {
		display: none;
	}

	.print-btn {
		padding: 12px 24px;
		background: #28a745;
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-size: 16px;
	}

	.print-btn:hover {
		background: #218838;
	}

	/* Onboarding Modal */
	.onboarding-overlay {
		z-index: 2000;
		animation: fadeIn 0.3s ease;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.onboarding-modal {
		background: var(--bg-secondary);
		border-radius: 16px;
		max-width: 600px;
		width: 90%;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
		animation: slideUp 0.4s ease;
	}

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(30px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.onboarding-header {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		padding: 30px;
		border-radius: 16px 16px 0 0;
		text-align: center;
	}

	.onboarding-header h2 {
		margin: 0;
		font-size: 1.8rem;
	}

	.onboarding-body {
		padding: 30px;
	}

	.welcome-text {
		color: var(--text-primary);
		font-size: 1.1rem;
		margin-bottom: 25px;
		text-align: center;
	}

	.tip-box {
		display: flex;
		gap: 15px;
		align-items: flex-start;
		padding: 20px;
		background: var(--bg-primary);
		border-radius: 12px;
		margin-bottom: 15px;
		border-left: 4px solid var(--accent-color);
	}

	.tip-icon {
		font-size: 32px;
		flex-shrink: 0;
	}

	.tip-content h3 {
		margin: 0 0 8px 0;
		color: var(--text-primary);
		font-size: 1.1rem;
	}

	.tip-content p {
		margin: 0;
		color: var(--text-secondary);
		line-height: 1.5;
		font-size: 0.95rem;
	}

	.onboarding-actions {
		display: flex;
		gap: 15px;
		margin-top: 30px;
	}

	.btn-later {
		flex: 1;
		padding: 14px 24px;
		background: var(--bg-primary);
		color: var(--text-primary);
		border: 2px solid var(--border-color);
		border-radius: 10px;
		font-size: 16px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-later:hover {
		background: var(--border-color);
	}

	.btn-test {
		flex: 2;
		padding: 14px 24px;
		background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
		color: white;
		border: none;
		border-radius: 10px;
		font-size: 16px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
		box-shadow: 0 4px 12px rgba(245, 87, 108, 0.3);
	}

	.btn-test:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(245, 87, 108, 0.4);
	}

	/* Header Help Buttons */
	.btn-with-help {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}

	.help-btn-header {
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: 50%;
		width: 24px;
		height: 24px;
		font-size: 14px;
		font-weight: bold;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
		flex-shrink: 0;
	}

	.help-btn-header:hover {
		transform: scale(1.1);
		background: var(--color-primary-dark);
	}

	.tooltip-box-header {
		position: absolute;
		top: 100%;
		left: 0;
		margin-top: 8px;
		background: white;
		border: 2px solid var(--color-primary);
		border-radius: 8px;
		padding: 12px;
		min-width: 250px;
		max-width: 300px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		z-index: 1000;
		font-size: 14px;
		line-height: 1.4;
		animation: tooltipFadeIn 0.2s ease-out;
	}

	:global(body.dark-mode) .tooltip-box-header {
		background: var(--bg-secondary);
		color: var(--text-primary);
		border-color: var(--color-primary);
	}

	@keyframes tooltipFadeIn {
		from {
			opacity: 0;
			transform: translateY(-8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (max-width: 768px) {
		.help-btn-header {
			width: 20px;
			height: 20px;
			font-size: 12px;
		}

		.tooltip-box-header {
			min-width: 200px;
			max-width: 250px;
			font-size: 13px;
			padding: 10px;
		}
	}

	@media print {
		/* A4 Querformat mit minimalen Rändern für maximale Nutzung */
		@page {
			size: A4 landscape;
			margin: 0.5cm;
		}

		/* Verstecke Elemente, die nicht gedruckt werden sollen */
		.no-print {
			display: none !important;
		}

		/* Zeige Druck-Header - extrem kompakt */
		.print-header {
			display: block;
			text-align: center;
			margin-bottom: 0.4rem;
			padding-bottom: 0.3rem;
			border-bottom: 1px solid #3498db;
		}

		.print-header h1 {
			margin: 0 0 0.2rem 0;
			color: #2c3e50;
			font-size: 1.2rem;
		}

		.print-header h2 {
			margin: 0;
			color: #555;
			font-size: 0.85rem;
			font-weight: normal;
		}

		/* Dashboard Anpassungen */
		.dashboard {
			background: white;
			padding: 0;
			min-height: auto;
		}

		.protokoll-content {
			max-width: none;
			margin: 0;
			display: flex;
			flex-direction: column;
			height: auto;
		}

		/* Sections - extrem kompakt */
		.section {
			background: white;
			box-shadow: none;
			padding: 0.5rem;
			margin-bottom: 0.5rem;
			border: 1px solid #ccc;
			border-radius: 2px;
			page-break-inside: avoid;
		}

		/* Erste Section (Allgemeine Infos) noch kompakter */
		.section:first-of-type {
			margin-bottom: 0.4rem;
		}

		h3 {
			color: #2c3e50;
			font-size: 0.8rem;
			margin: 0 0 0.4rem 0;
			border-bottom: 1px solid #3498db;
			padding-bottom: 0.2rem;
		}

		/* Info Grid - ultra kompakt mit 4 Spalten */
		.info-grid {
			display: grid;
			grid-template-columns: repeat(4, 1fr);
			gap: 0.3rem 0.5rem;
		}

		.info-item {
			break-inside: avoid;
			display: flex;
			flex-direction: column;
			gap: 0.1rem;
		}

		.info-item strong {
			color: #555;
			font-size: 0.6rem;
		}

		.info-item span {
			color: #000;
			font-size: 0.65rem;
			line-height: 1.1;
		}

		.info-item.full-width {
			grid-column: 1 / -1;
		}

		/* Tabelle - ultra kompakt für eine Seite */
		.table-container {
			overflow: visible;
		}

		.planung-table {
			width: 100%;
			border-collapse: collapse;
			font-size: 0.55rem;
		}

		.planung-table th,
		.planung-table td {
			border: 1px solid #333;
			padding: 0.2rem 0.3rem;
			text-align: left;
			line-height: 1.1;
			vertical-align: top;
		}

		.planung-table thead th {
			background: #3498db !important;
			color: white !important;
			font-weight: 600;
			font-size: 0.6rem;
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}

		.raum-label {
			background: #f0f0f0 !important;
			font-weight: 600;
			color: #000 !important;
			font-size: 0.6rem;
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}

		.planung-table td {
			color: #000;
		}

		/* KRITISCH: Verhindere Seitenumbrüche */
		.dashboard {
			page-break-inside: avoid !important;
			page-break-after: avoid !important;
			page-break-before: avoid !important;
		}

		.protokoll-content {
			page-break-inside: avoid !important;
			page-break-after: avoid !important;
			page-break-before: avoid !important;
		}

		.section {
			page-break-inside: avoid !important;
			page-break-after: avoid !important;
		}

		.planung-table {
			page-break-inside: avoid !important;
			page-break-after: avoid !important;
			page-break-before: avoid !important;
		}

		/* Fallback für WebKit */
		* {
			-webkit-column-break-inside: avoid;
		}

		.planung-table tr {
			page-break-inside: avoid;
		}

		/* Falls es doch zu groß wird, skalieren */
		body {
			zoom: 0.95;
		}
	}
</style>