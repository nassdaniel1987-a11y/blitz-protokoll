<script>
	import { supabase } from '$lib/supabaseClient';
	import { onMount } from 'svelte';
	import { darkMode } from '$lib/darkModeStore';

	export let show = false;

	let startDate = '';
	let endDate = '';
	let loading = false;
	let statistiken = null;
	let error = null;
	let currentUser = null;
	let assignedPersonName = null; // Der zugeordnete Name des aktuellen Users
	let showAllPersonen = false; // Toggle für alle Personen anzeigen

	// Standard: Letzter Monat
	onMount(async () => {
		const heute = new Date();
		const vorMonat = new Date();
		vorMonat.setMonth(vorMonat.getMonth() - 1);

		endDate = heute.toISOString().split('T')[0];
		startDate = vorMonat.toISOString().split('T')[0];

		// Lade aktuellen User und zugeordneten Namen
		const { data } = await supabase.auth.getSession();
		if (data.session) {
			currentUser = data.session.user;
			assignedPersonName = currentUser.user_metadata?.assigned_person_name || null;
		}
	});

	function close() {
		show = false;
	}

	async function loadStatistiken() {
		if (!startDate || !endDate) {
			error = 'Bitte beide Datumsfelder ausfüllen';
			return;
		}

		loading = true;
		error = null;

		try {
			// Lade alle Protokolle im Zeitraum
			const { data: protokolle, error: fetchError } = await supabase
				.from('protokolle')
				.select('*')
				.gte('datum', startDate)
				.lte('datum', endDate)
				.order('datum', { ascending: true });

			if (fetchError) throw fetchError;

			// Statistiken berechnen
			const personenStats = {};
			const raumStats = {};
			let gesamtTage = 0;
			let gesamtAnwesenheit = 0;
			let persoenlicheStats = null;

			protokolle.forEach(protokoll => {
				gesamtTage++;

				// Anwesenheit
				const anwesenheit = protokoll.inhalt.anwesenheit?.split(',').map(p => p.trim()).filter(p => p) || [];
				gesamtAnwesenheit += anwesenheit.length;

				// Planung durchgehen
				const planung = protokoll.inhalt.planung || {};
				Object.entries(planung).forEach(([zeitslot, raeume]) => {
					Object.entries(raeume).forEach(([raum, personen]) => {
						const personenListe = personen.split(',').map(p => p.trim()).filter(p => p);

						personenListe.forEach(person => {
							if (!personenStats[person]) {
								personenStats[person] = {
									gesamt: 0,
									raeume: {},
									zeitslots: {}
								};
							}
							personenStats[person].gesamt++;
							personenStats[person].raeume[raum] = (personenStats[person].raeume[raum] || 0) + 1;
							personenStats[person].zeitslots[zeitslot] = (personenStats[person].zeitslots[zeitslot] || 0) + 1;

							if (!raumStats[raum]) {
								raumStats[raum] = {
									gesamt: 0,
									personen: {}
								};
							}
							raumStats[raum].gesamt++;
							raumStats[raum].personen[person] = (raumStats[raum].personen[person] || 0) + 1;
						});
					});
				});
			});

			// Persönliche Statistiken wenn Name zugeordnet
			if (assignedPersonName && personenStats[assignedPersonName]) {
				persoenlicheStats = {
					name: assignedPersonName,
					...personenStats[assignedPersonName]
				};
			}

			// Sortiere Personen nach Anzahl Einteilungen
			const personenArray = Object.entries(personenStats)
				.map(([name, stats]) => ({ name, ...stats }))
				.sort((a, b) => b.gesamt - a.gesamt);

			const raumArray = Object.entries(raumStats)
				.map(([name, stats]) => ({ name, ...stats }))
				.sort((a, b) => b.gesamt - a.gesamt);

			statistiken = {
				personenStats: personenArray,
				raumStats: raumArray,
				persoenlicheStats,
				gesamtTage,
				durchschnittAnwesenheit: gesamtTage > 0 ? (gesamtAnwesenheit / gesamtTage).toFixed(1) : 0,
				zeitraum: { start: startDate, end: endDate }
			};
		} catch (err) {
			console.error('Fehler beim Laden der Statistiken:', err);
			error = 'Fehler beim Laden der Statistiken';
		} finally {
			loading = false;
		}
	}

	function handleClickOutside(event) {
		if (event.target.classList.contains('modal-overlay')) {
			close();
		}
	}
</script>

{#if show}
	<div class="modal-overlay" on:click={handleClickOutside}>
		<div class="modal-content">
			<div class="modal-header">
				<h2>📊 Statistiken</h2>
				<button class="close-btn" on:click={close}>✕</button>
			</div>

			<div class="modal-body">
				<!-- Zeitraum-Auswahl -->
				<div class="zeitraum-auswahl">
					<div class="date-input-group">
						<label for="start-date">Von:</label>
						<input type="date" id="start-date" bind:value={startDate} />
					</div>
					<div class="date-input-group">
						<label for="end-date">Bis:</label>
						<input type="date" id="end-date" bind:value={endDate} />
					</div>
					<button class="btn-load" on:click={loadStatistiken} disabled={loading}>
						{loading ? 'Lade...' : 'Statistiken laden'}
					</button>
				</div>

				{#if error}
					<div class="error-message">{error}</div>
				{/if}

				{#if statistiken}
					<div class="stats-container">
						<!-- Persönliche Statistik (wenn Name zugeordnet) -->
						{#if statistiken.persoenlicheStats}
							<section class="stats-section personal-stats">
								<h3>👤 Meine Statistiken</h3>
								<div class="stats-grid">
									<div class="stat-card highlight">
										<div class="stat-label">Meine Einteilungen</div>
										<div class="stat-value">{statistiken.persoenlicheStats.gesamt}</div>
									</div>
									<div class="stat-card">
										<div class="stat-label">Häufigster Raum</div>
										<div class="stat-value-small">
											{Object.entries(statistiken.persoenlicheStats.raeume).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'}
										</div>
									</div>
									<div class="stat-card">
										<div class="stat-label">Häufigster Zeitslot</div>
										<div class="stat-value-small">
											{Object.entries(statistiken.persoenlicheStats.zeitslots).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'}
										</div>
									</div>
								</div>

								<!-- Meine Raumverteilung -->
								<div class="chart-section">
									<h4>Meine Raumverteilung</h4>
									<div class="bar-chart">
										{#each Object.entries(statistiken.persoenlicheStats.raeume).sort((a, b) => b[1] - a[1]) as [raum, anzahl]}
											<div class="bar-row">
												<div class="bar-label">{raum}</div>
												<div class="bar-container">
													<div
														class="bar bar-personal"
														style="width: {(anzahl / statistiken.persoenlicheStats.gesamt * 100)}%"
													>
														<span class="bar-value">{anzahl}</span>
													</div>
												</div>
											</div>
										{/each}
									</div>
								</div>
							</section>
						{/if}

						<!-- Übersicht -->
						<section class="stats-section">
							<h3>📅 Übersicht</h3>
							<div class="stats-grid">
								<div class="stat-card">
									<div class="stat-label">Tage im Zeitraum</div>
									<div class="stat-value">{statistiken.gesamtTage}</div>
								</div>
								<div class="stat-card">
									<div class="stat-label">Ø Anwesenheit</div>
									<div class="stat-value">{statistiken.durchschnittAnwesenheit}</div>
								</div>
							</div>
						</section>

						<!-- Personen-Statistiken -->
						<section class="stats-section">
							<h3>👥 Einteilungen pro Person</h3>
							<div class="chart-section">
								<div class="bar-chart">
									{#each (showAllPersonen ? statistiken.personenStats : statistiken.personenStats.slice(0, 10)) as person}
										<div class="bar-row">
											<div class="bar-label">{person.name}</div>
											<div class="bar-container">
												<div
													class="bar bar-primary"
													style="width: {(person.gesamt / statistiken.personenStats[0].gesamt * 100)}%"
												>
													<span class="bar-value">{person.gesamt}</span>
												</div>
											</div>
											<div class="bar-details">
												{Object.entries(person.raeume).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'}
											</div>
										</div>
									{/each}
								</div>
								{#if statistiken.personenStats.length > 10}
									<button class="toggle-all-btn" on:click={() => showAllPersonen = !showAllPersonen}>
										{showAllPersonen ? '▲' : '▼'} {showAllPersonen ? 'Top 10 anzeigen' : `Alle ${statistiken.personenStats.length} Personen anzeigen`}
									</button>
								{/if}
							</div>
						</section>

						<!-- Raum-Statistiken -->
						<section class="stats-section">
							<h3>🏠 Belegung pro Raum</h3>
							<div class="chart-section">
								<div class="bar-chart">
									{#each statistiken.raumStats as raum}
										<div class="bar-row">
											<div class="bar-label">{raum.name}</div>
											<div class="bar-container">
												<div
													class="bar bar-secondary"
													style="width: {(raum.gesamt / statistiken.raumStats[0].gesamt * 100)}%"
												>
													<span class="bar-value">{raum.gesamt}</span>
												</div>
											</div>
											<div class="bar-details">
												{Object.entries(raum.personen).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'}
											</div>
										</div>
									{/each}
								</div>
							</div>
						</section>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1000;
		padding: 20px;
	}

	.modal-content {
		background: var(--bg-secondary);
		border-radius: 12px;
		width: 100%;
		max-width: 900px;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 20px 24px;
		border-bottom: 2px solid var(--border-color);
	}

	.modal-header h2 {
		margin: 0;
		color: var(--text-primary);
		font-size: 1.5rem;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 24px;
		color: var(--text-secondary);
		cursor: pointer;
		padding: 0;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: all 0.2s;
	}

	.close-btn:hover {
		background: var(--border-color);
		color: var(--text-primary);
	}

	.modal-body {
		padding: 24px;
		overflow-y: auto;
	}

	.zeitraum-auswahl {
		display: flex;
		gap: 15px;
		align-items: flex-end;
		margin-bottom: 24px;
		flex-wrap: wrap;
	}

	.date-input-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.date-input-group label {
		font-size: 0.9rem;
		color: var(--text-secondary);
		font-weight: 500;
	}

	.date-input-group input {
		padding: 10px 12px;
		border: 2px solid var(--border-color);
		border-radius: 8px;
		font-size: 14px;
		background: var(--bg-primary);
		color: var(--text-primary);
	}

	.date-input-group input:focus {
		outline: none;
		border-color: var(--accent-color);
	}

	.btn-load {
		padding: 10px 20px;
		background: var(--accent-color);
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-weight: 600;
		font-size: 14px;
		transition: all 0.2s;
	}

	.btn-load:hover:not(:disabled) {
		background: var(--accent-hover);
	}

	.btn-load:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.error-message {
		padding: 12px;
		background: rgba(231, 76, 60, 0.1);
		border-left: 4px solid #e74c3c;
		border-radius: 4px;
		color: #e74c3c;
		margin-bottom: 20px;
	}

	.stats-container {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.stats-section {
		background: var(--bg-primary);
		padding: 20px;
		border-radius: 8px;
		border: 1px solid var(--border-color);
	}

	.stats-section h3 {
		margin: 0 0 16px 0;
		color: var(--text-primary);
		font-size: 1.2rem;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 16px;
	}

	.stat-card {
		background: var(--bg-secondary);
		padding: 16px;
		border-radius: 8px;
		text-align: center;
		border: 2px solid var(--border-color);
	}

	.stat-label {
		font-size: 0.9rem;
		color: var(--text-secondary);
		margin-bottom: 8px;
	}

	.stat-value {
		font-size: 2rem;
		font-weight: 700;
		color: var(--accent-color);
	}

	.stat-value-small {
		font-size: 1.2rem;
		font-weight: 600;
		color: var(--accent-color);
	}

	.stat-card.highlight {
		background: linear-gradient(135deg, var(--accent-color) 0%, #764ba2 100%);
		border-color: var(--accent-color);
	}

	.stat-card.highlight .stat-label,
	.stat-card.highlight .stat-value {
		color: white;
	}

	.personal-stats {
		background: linear-gradient(135deg, #f5f7fa 0%, #e8f4f8 100%);
		border-left: 4px solid var(--accent-color);
	}

	:global(.dark-mode) .personal-stats {
		background: linear-gradient(135deg, #1a2332 0%, #2d3b4f 100%);
	}

	/* Balkendiagramme */
	.chart-section {
		margin-top: 16px;
	}

	.chart-section h4 {
		margin: 0 0 12px 0;
		font-size: 1rem;
		color: var(--text-secondary);
	}

	.bar-chart {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.bar-row {
		display: grid;
		grid-template-columns: 150px 1fr 150px;
		gap: 12px;
		align-items: center;
	}

	.bar-label {
		font-weight: 600;
		color: var(--text-primary);
		font-size: 0.9rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.bar-container {
		position: relative;
		height: 32px;
		background: var(--border-color);
		border-radius: 6px;
		overflow: hidden;
	}

	.bar {
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		padding-right: 8px;
		border-radius: 6px;
		transition: width 0.5s ease;
		min-width: 30px;
	}

	.bar-primary {
		background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
	}

	.bar-secondary {
		background: linear-gradient(90deg, #f39c12 0%, #e67e22 100%);
	}

	.bar-personal {
		background: linear-gradient(90deg, #27ae60 0%, #2ecc71 100%);
	}

	.bar-value {
		font-weight: 700;
		color: white;
		font-size: 0.85rem;
	}

	.bar-details {
		font-size: 0.85rem;
		color: var(--text-secondary);
		text-align: right;
	}

	.chart-note {
		margin-top: 12px;
		text-align: center;
		font-size: 0.85rem;
		color: var(--text-secondary);
		font-style: italic;
	}

	.toggle-all-btn {
		margin-top: 16px;
		padding: 10px 16px;
		background: var(--bg-secondary);
		color: var(--text-primary);
		border: 2px solid var(--border-color);
		border-radius: 8px;
		cursor: pointer;
		font-size: 0.9rem;
		font-weight: 600;
		width: 100%;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}

	.toggle-all-btn:hover {
		background: var(--bg-primary);
		border-color: var(--accent-color);
		color: var(--accent-color);
	}

	.table-wrapper {
		overflow-x: auto;
	}

	.stats-table {
		width: 100%;
		border-collapse: collapse;
	}

	.stats-table thead th {
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-weight: 600;
		padding: 12px;
		text-align: left;
		border-bottom: 2px solid var(--border-color);
	}

	.stats-table tbody td {
		padding: 12px;
		border-bottom: 1px solid var(--border-color);
		color: var(--text-primary);
	}

	.stats-table tbody tr:hover {
		background: var(--bg-secondary);
	}

	.person-name,
	.raum-name {
		font-weight: 600;
		color: var(--accent-color);
	}

	.centered {
		text-align: center;
	}

	@media (max-width: 768px) {
		.modal-content {
			max-width: 100%;
			max-height: 100vh;
			border-radius: 0;
		}

		.zeitraum-auswahl {
			flex-direction: column;
			align-items: stretch;
		}

		.btn-load {
			width: 100%;
		}

		.stats-grid {
			grid-template-columns: 1fr;
		}

		.bar-row {
			grid-template-columns: 1fr;
			gap: 6px;
		}

		.bar-details {
			text-align: left;
			font-size: 0.8rem;
		}
	}
</style>
