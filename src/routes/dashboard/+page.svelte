<script>
	import { supabase } from '$lib/supabaseClient';
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { getProtokoll, getToday, deleteProtokoll } from '$lib/protokollService';
	import { getRaeume } from '$lib/einstellungenService';
	import { getNachrichten } from '$lib/teamNachrichtenService';
	import { darkMode } from '$lib/darkModeStore';
	import { modernUi } from '$lib/modernUiStore';
	import { toast } from '$lib/toastStore';
	import { initInactivityTracking, cleanup as cleanupInactivity } from '$lib/inactivityStore';
	import { isCurrentUserAdmin } from '$lib/userManagementService';
	import Wochenansicht from '$lib/components/Wochenansicht.svelte';
	import TeamNachrichtenModal from '$lib/components/TeamNachrichtenModal.svelte';
	import StatistikModal from '$lib/components/StatistikModal.svelte';
	import SkeletonLoader from '$lib/components/SkeletonLoader.svelte';
	import InactivityWarning from '$lib/components/InactivityWarning.svelte';

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
	let isAdmin = false; // Für Modern UI Banner

	// Raumliste - wird dynamisch geladen
	let raeume = [];

	const zeitslots = ['11:40-12:25', '12:25-13:10', '13:10-14:00', '14:00-14:30'];

	onMount(async () => {
		// Prüfen ob Benutzer eingeloggt ist
		const { data } = await supabase.auth.getSession();
		if (!data.session) {
			goto('/');
			return;
		}

		// Inaktivitäts-Tracking starten
		initInactivityTracking();

		// Username extrahieren (von email)
		const email = data.session.user.email;
		currentUsername = email.split('@')[0];

		// Admin-Status für Modern UI Banner
		isAdmin = await isCurrentUserAdmin();

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
		cleanupInactivity();
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

<InactivityWarning />

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
	<!-- Modern UI Admin-Preview Banner -->
	{#if isAdmin && $modernUi}
		<div class="modern-ui-banner no-print">
			<span class="modern-ui-banner-icon">&#x2728;</span>
			<span>Modern UI Preview - Nur fuer Admins sichtbar</span>
		</div>
	{/if}

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
			{#if $modernUi && isAdmin}
				<SkeletonLoader variant="dashboard" />
			{:else}
				<div class="loading">Lade Protokoll...</div>
			{/if}
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
					{#if protokoll.inhalt.beobachtung_kinder_stufe_1 || protokoll.inhalt.beobachtung_kinder_stufe_2 || protokoll.inhalt.beobachtung_kinder_stufe_3 || protokoll.inhalt.beobachtung_kinder_stufe_4}
						<div class="info-item full-width beobachtung-section">
							<strong>Beobachtung Kinder:</strong>
							<div class="beobachtung-grid">
								{#if protokoll.inhalt.beobachtung_kinder_stufe_1}
									<div class="beobachtung-item">
										<span class="stufe-label">Stufe 1:</span>
										<span>{protokoll.inhalt.beobachtung_kinder_stufe_1}</span>
									</div>
								{/if}
								{#if protokoll.inhalt.beobachtung_kinder_stufe_2}
									<div class="beobachtung-item">
										<span class="stufe-label">Stufe 2:</span>
										<span>{protokoll.inhalt.beobachtung_kinder_stufe_2}</span>
									</div>
								{/if}
								{#if protokoll.inhalt.beobachtung_kinder_stufe_3}
									<div class="beobachtung-item">
										<span class="stufe-label">Stufe 3:</span>
										<span>{protokoll.inhalt.beobachtung_kinder_stufe_3}</span>
									</div>
								{/if}
								{#if protokoll.inhalt.beobachtung_kinder_stufe_4}
									<div class="beobachtung-item">
										<span class="stufe-label">Stufe 4:</span>
										<span>{protokoll.inhalt.beobachtung_kinder_stufe_4}</span>
									</div>
								{/if}
							</div>
						</div>
					{/if}
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
			{#if $modernUi && isAdmin}
				<div class="empty-state-modern">
					<div class="empty-state-illustration">
						<svg width="180" height="160" viewBox="0 0 180 160" fill="none" xmlns="http://www.w3.org/2000/svg">
							<!-- Clipboard body -->
							<rect x="40" y="25" width="100" height="120" rx="8" fill="var(--bg-secondary)" stroke="var(--border-color)" stroke-width="2"/>
							<!-- Clipboard clip -->
							<rect x="65" y="15" width="50" height="20" rx="4" fill="var(--accent-color)" opacity="0.8"/>
							<circle cx="90" cy="25" r="4" fill="var(--bg-secondary)"/>
							<!-- Lines on clipboard -->
							<rect x="55" y="50" width="70" height="6" rx="3" fill="var(--border-color)" opacity="0.5"/>
							<rect x="55" y="65" width="55" height="6" rx="3" fill="var(--border-color)" opacity="0.4"/>
							<rect x="55" y="80" width="60" height="6" rx="3" fill="var(--border-color)" opacity="0.3"/>
							<rect x="55" y="95" width="40" height="6" rx="3" fill="var(--border-color)" opacity="0.2"/>
							<!-- Pencil -->
							<g transform="translate(125, 90) rotate(25)">
								<rect x="0" y="0" width="8" height="45" rx="2" fill="var(--accent-color)" opacity="0.7"/>
								<polygon points="0,45 8,45 4,55" fill="var(--accent-color)" opacity="0.9"/>
							</g>
						</svg>
					</div>
					<h3 class="empty-state-title">Noch kein Protokoll vorhanden</h3>
					<p class="empty-state-text">
						Für den {currentDate} wurde noch kein Protokoll erstellt. Starten Sie jetzt!
					</p>
					<button on:click={() => goto(`/edit?date=${currentDate}`)} class="empty-state-btn">
						Neues Protokoll erstellen
					</button>
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
	{/if}

	<!-- Wochenansicht -->
	{#if viewMode === 'week'}
		{#if loading}
			{#if $modernUi && isAdmin}
				<SkeletonLoader variant="table" />
			{:else}
				<div class="loading">Lade Wochendaten...</div>
			{/if}
		{:else}
			<Wochenansicht {wochenDaten} {raeume} />
		{/if}
	{/if}

	<!-- Floating Action Button (Modern UI only) -->
	{#if $modernUi && isAdmin && !protokoll && viewMode === 'day' && !loading}
		<button
			class="fab"
			on:click={() => goto(`/edit?date=${currentDate}`)}
			title="Neues Protokoll erstellen"
		>
			<span class="fab-icon">+</span>
		</button>
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
		border-radius: var(--radius-lg, 12px);
		box-shadow: 0 2px 8px var(--shadow);
	}

	/* === MODERN UI DASHBOARD OVERRIDES === */
	:global(.modern-ui) .header {
		border: 1px solid var(--border-color);
		box-shadow: var(--shadow-md);
		border-radius: var(--radius-xl);
		padding: 16px 28px;
		backdrop-filter: blur(8px);
		background: var(--bg-secondary);
	}

	:global(.modern-ui) .header h1 {
		background: var(--gradient-primary);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		font-weight: 700;
		font-size: 1.6rem;
		letter-spacing: -0.02em;
	}

	:global(.modern-ui) .nachrichten-btn,
	:global(.modern-ui) .statistik-btn,
	:global(.modern-ui) .settings-btn,
	:global(.modern-ui) .dark-mode-toggle {
		border-radius: var(--radius-md);
		border: 1.5px solid var(--border-color);
		background: var(--bg-primary);
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	}

	:global(.modern-ui) .nachrichten-btn:hover,
	:global(.modern-ui) .statistik-btn:hover,
	:global(.modern-ui) .settings-btn:hover,
	:global(.modern-ui) .dark-mode-toggle:hover {
		border-color: var(--accent-color);
		background: var(--accent-light);
		transform: translateY(-2px);
		box-shadow: var(--shadow-accent);
	}

	:global(.modern-ui) .logout-btn {
		background: var(--bg-primary);
		color: var(--text-secondary);
		border: 1.5px solid var(--border-color);
		border-radius: var(--radius-md);
		font-weight: 500;
		transition: all 0.2s;
	}

	:global(.modern-ui) .logout-btn:hover {
		background: var(--danger-bg, rgba(239, 68, 68, 0.08));
		color: var(--danger-color, #ef4444);
		border-color: var(--danger-color, #ef4444);
	}

	:global(.modern-ui) .view-toggle {
		border-radius: var(--radius-xl);
		border: 1px solid var(--border-color);
		box-shadow: var(--shadow-md);
		padding: 12px;
		gap: 8px;
	}

	:global(.modern-ui) .toggle-btn {
		border-radius: var(--radius-md);
		border: 1.5px solid transparent;
		font-weight: 500;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	}

	:global(.modern-ui) .toggle-btn:hover {
		background: var(--accent-light);
		border-color: var(--accent-color);
	}

	:global(.modern-ui) .toggle-btn.active {
		background: var(--gradient-primary);
		border-color: transparent;
		box-shadow: var(--shadow-accent);
	}

	:global(.modern-ui) .toggle-btn.test-mode-btn {
		background: linear-gradient(135deg, #ec4899 0%, #f43f5e 100%);
		border-color: transparent;
		box-shadow: 0 4px 12px rgba(236, 72, 153, 0.25);
	}

	:global(.modern-ui) .toggle-btn.test-mode-btn:hover {
		box-shadow: 0 6px 20px rgba(236, 72, 153, 0.35);
		transform: translateY(-2px);
	}

	:global(.modern-ui) .date-nav {
		border-radius: var(--radius-xl);
		border: 1px solid var(--border-color);
		box-shadow: var(--shadow-md);
	}

	:global(.modern-ui) .nav-btn {
		border-radius: var(--radius-md);
		background: var(--gradient-primary);
		font-weight: 500;
		transition: all 0.2s;
		box-shadow: var(--shadow-accent);
	}

	:global(.modern-ui) .nav-btn:hover {
		transform: translateY(-1px);
		box-shadow: 0 6px 20px rgba(79, 109, 245, 0.3);
	}

	:global(.modern-ui) .section {
		border-radius: var(--radius-xl);
		border: 1px solid var(--border-color);
		box-shadow: var(--shadow-md);
		padding: 28px;
	}

	:global(.modern-ui) .section h3 {
		border-bottom: 2px solid transparent;
		border-image: var(--gradient-primary) 1;
		padding-bottom: 12px;
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	:global(.modern-ui) .stat-card {
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-md);
		transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s;
	}

	:global(.modern-ui) .stat-card:hover {
		transform: translateY(-4px);
		box-shadow: var(--shadow-lg);
	}

	:global(.modern-ui) .stat-card.stat-primary {
		background: var(--gradient-primary);
	}

	:global(.modern-ui) .stat-card.stat-info {
		background: linear-gradient(135deg, #38bdf8 0%, #3b82f6 100%);
	}

	:global(.modern-ui) .stat-card.stat-warning {
		background: linear-gradient(135deg, #ec4899 0%, #f43f5e 100%);
	}

	:global(.modern-ui) .stat-card.stat-info-light {
		border: 1.5px solid var(--warning-color, #f59e0b);
		background: var(--warning-bg, rgba(245, 158, 11, 0.08));
		border-radius: var(--radius-xl);
	}

	:global(.modern-ui) .edit-btn {
		background: var(--gradient-primary);
		border-radius: var(--radius-md);
		font-weight: 500;
		box-shadow: var(--shadow-accent);
		transition: all 0.2s;
	}

	:global(.modern-ui) .edit-btn:hover {
		transform: translateY(-1px);
		box-shadow: 0 6px 20px rgba(79, 109, 245, 0.3);
	}

	:global(.modern-ui) .delete-btn {
		border-radius: var(--radius-md);
		transition: all 0.2s;
	}

	:global(.modern-ui) .print-btn {
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		border-radius: var(--radius-md);
		transition: all 0.2s;
	}

	:global(.modern-ui) .print-btn:hover {
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
	}

	:global(.modern-ui) .planung-table {
		border-radius: var(--radius-md);
		overflow: hidden;
		border: 1px solid var(--border-color);
	}

	:global(.modern-ui) .planung-table thead th {
		background: var(--gradient-primary);
		font-weight: 600;
		letter-spacing: 0.01em;
		padding: 14px 12px;
	}

	:global(.modern-ui) .planung-table tbody tr {
		transition: background-color 0.15s;
	}

	:global(.modern-ui) .planung-table tbody tr:hover {
		background: var(--accent-light);
	}

	:global(.modern-ui) .no-protokoll {
		border-radius: var(--radius-xl);
		border: 1px solid var(--border-color);
		box-shadow: var(--shadow-md);
	}

	:global(.modern-ui) .create-btn {
		background: var(--gradient-primary);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-accent);
		transition: all 0.2s;
	}

	:global(.modern-ui) .create-btn:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(79, 109, 245, 0.3);
	}

	:global(.modern-ui) .nachrichten-btn .badge {
		background: linear-gradient(135deg, #ef4444, #dc2626);
		box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);
	}

	:global(.modern-ui) .onboarding-header {
		background: var(--gradient-header);
	}

	:global(.modern-ui) .onboarding-modal {
		border-radius: var(--radius-xl);
		border: 1px solid var(--border-color);
		box-shadow: var(--shadow-lg);
	}

	:global(.modern-ui) .tip-box {
		border-radius: var(--radius-md);
		border-left: 4px solid var(--accent-color);
		transition: transform 0.2s;
	}

	:global(.modern-ui) .tip-box:hover {
		transform: translateX(4px);
	}

	:global(.modern-ui) .btn-test {
		background: linear-gradient(135deg, #ec4899 0%, #f43f5e 100%);
		border-radius: var(--radius-md);
		box-shadow: 0 4px 12px rgba(236, 72, 153, 0.3);
	}

	:global(.modern-ui) .help-btn-header {
		background: var(--gradient-primary);
		box-shadow: 0 2px 6px rgba(79, 109, 245, 0.3);
	}

	:global(.modern-ui) .tooltip-box-header {
		border: 1.5px solid var(--accent-color);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg);
		background: var(--bg-secondary);
	}

	:global(.modern-ui) .beobachtung-section {
		border: 1.5px solid var(--accent-color);
		border-radius: var(--radius-md);
		background: var(--accent-light);
	}

	:global(.modern-ui) .today-btn {
		border-radius: var(--radius-sm);
		transition: all 0.2s;
	}

	:global(.modern-ui) .today-btn:hover {
		border-color: var(--accent-color);
		background: var(--accent-light);
	}
	/* === END MODERN UI DASHBOARD OVERRIDES === */

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

	/* Beobachtung Kinder */
	.beobachtung-section {
		border: 1px solid var(--accent-color);
		border-radius: 8px;
		padding: 12px;
		background: var(--bg-primary);
	}

	.beobachtung-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 10px;
		margin-top: 8px;
	}

	.beobachtung-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.stufe-label {
		font-weight: 500;
		color: var(--accent-color);
		font-size: 0.85rem;
	}

	@media (max-width: 600px) {
		.beobachtung-grid {
			grid-template-columns: 1fr;
		}
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
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: var(--accent-color);
		color: white;
		border: none;
		font-size: 14px;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.2s;
		flex-shrink: 0;
	}

	.help-btn-header:hover {
		background: var(--accent-hover);
		transform: scale(1.1);
	}

	.tooltip-box-header {
		position: absolute;
		top: 100%;
		left: 0;
		margin-top: 10px;
		padding: 12px 16px;
		background: var(--bg-primary);
		border: 2px solid var(--accent-color);
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		z-index: 1000;
		max-width: 400px;
		font-size: 0.9rem;
		line-height: 1.5;
		color: var(--text-primary);
		animation: tooltipFadeIn 0.2s ease;
	}

	@keyframes tooltipFadeIn {
		from {
			opacity: 0;
			transform: translateY(-5px);
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
			max-width: 300px;
			font-size: 0.85rem;
			padding: 10px 12px;
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

	/* === Empty State Modern === */
	.empty-state-modern {
		max-width: 480px;
		margin: 60px auto;
		text-align: center;
		padding: 48px 32px;
		background: var(--bg-secondary);
		border-radius: var(--radius-xl, 20px);
		border: 1px solid var(--border-color);
		box-shadow: var(--shadow-md);
	}

	.empty-state-illustration {
		margin-bottom: 24px;
		animation: floatAnim 3s ease-in-out infinite;
	}

	@keyframes floatAnim {
		0%, 100% { transform: translateY(0); }
		50% { transform: translateY(-8px); }
	}

	.empty-state-title {
		font-size: 1.4rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0 0 12px 0;
		letter-spacing: -0.01em;
	}

	.empty-state-text {
		font-size: 0.95rem;
		color: var(--text-secondary);
		margin: 0 0 28px 0;
		line-height: 1.6;
	}

	.empty-state-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 14px 32px;
		background: var(--gradient-primary);
		color: white;
		border: none;
		border-radius: var(--radius-md, 12px);
		font-size: 16px;
		font-weight: 600;
		cursor: pointer;
		box-shadow: var(--shadow-accent);
		transition: all 0.2s;
	}

	.empty-state-btn:hover {
		transform: translateY(-2px);
		box-shadow: 0 8px 24px rgba(79, 109, 245, 0.3);
	}

	/* === Floating Action Button === */
	.fab {
		position: fixed;
		bottom: 32px;
		right: 32px;
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background: var(--gradient-primary);
		color: white;
		border: none;
		font-size: 32px;
		font-weight: 300;
		cursor: pointer;
		box-shadow: 0 6px 24px rgba(79, 109, 245, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		z-index: 100;
		padding: 0;
	}

	.fab:hover {
		transform: scale(1.1) rotate(90deg);
		box-shadow: 0 8px 32px rgba(79, 109, 245, 0.5);
	}

	.fab:active {
		transform: scale(0.95);
	}

	.fab-icon {
		line-height: 1;
		display: block;
	}

	@media (max-width: 768px) {
		.fab {
			bottom: 80px; /* Platz für Bottom Nav */
			right: 20px;
			width: 56px;
			height: 56px;
			font-size: 28px;
		}
	}
</style>