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

	// Standard: Letzter Monat
	onMount(() => {
		const heute = new Date();
		const vorMonat = new Date();
		vorMonat.setMonth(vorMonat.getMonth() - 1);

		endDate = heute.toISOString().split('T')[0];
		startDate = vorMonat.toISOString().split('T')[0];
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
							<div class="table-wrapper">
								<table class="stats-table">
									<thead>
										<tr>
											<th>Person</th>
											<th>Einteilungen</th>
											<th>Top Raum</th>
											<th>Top Zeitslot</th>
										</tr>
									</thead>
									<tbody>
										{#each statistiken.personenStats as person}
											<tr>
												<td class="person-name">{person.name}</td>
												<td class="centered">{person.gesamt}</td>
												<td class="centered">
													{Object.entries(person.raeume).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'}
												</td>
												<td class="centered">
													{Object.entries(person.zeitslots).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'}
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</section>

						<!-- Raum-Statistiken -->
						<section class="stats-section">
							<h3>🏠 Belegung pro Raum</h3>
							<div class="table-wrapper">
								<table class="stats-table">
									<thead>
										<tr>
											<th>Raum</th>
											<th>Belegungen</th>
											<th>Häufigste Person</th>
										</tr>
									</thead>
									<tbody>
										{#each statistiken.raumStats as raum}
											<tr>
												<td class="raum-name">{raum.name}</td>
												<td class="centered">{raum.gesamt}</td>
												<td class="centered">
													{Object.entries(raum.personen).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'}
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
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
	}
</style>
