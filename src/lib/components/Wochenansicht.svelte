<script>
	import { goto } from '$app/navigation';

	export let wochenDaten = []; // Array of { datum, protokoll }
	export let raeume = [];

	const zeitslots = ['11:40-12:25', '12:25-13:10', '13:10-14:00', '14:00-14:30'];
	const wochentage = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];

	function formatDatum(datum) {
		const date = new Date(datum);
		const day = date.getDate().toString().padStart(2, '0');
		const month = (date.getMonth() + 1).toString().padStart(2, '0');
		return `${day}.${month}`;
	}

	function getWochentag(datum) {
		const date = new Date(datum);
		const dayIndex = (date.getDay() + 6) % 7; // Montag = 0
		return wochentage[dayIndex] || '';
	}

	function navigateToDay(datum) {
		goto(`/edit?date=${datum}`);
	}
</script>

<div class="wochenansicht">
	<h2>Wochenübersicht</h2>
	<p class="scroll-hint">← Horizontal scrollen um alle Tage zu sehen →</p>

	<div class="woche-scroll-container">
		<div class="woche-grid">
		{#each wochenDaten as tag}
			<div class="tag-card" class:has-protokoll={tag.protokoll} on:click={() => navigateToDay(tag.datum)}>
				<div class="tag-header">
					<h3>{getWochentag(tag.datum)}</h3>
					<span class="datum">{formatDatum(tag.datum)}</span>
				</div>

				{#if tag.protokoll}
					<div class="tag-content">
						<!-- Status-Badge -->
						<div class="status-badge">
							{#if tag.protokoll.inhalt.anwesenheit}
								<span class="badge filled">✓ Ausgefüllt</span>
							{:else}
								<span class="badge empty">⚠ Unvollständig</span>
							{/if}
						</div>

						<!-- Anwesenheit -->
						{#if tag.protokoll.inhalt.anwesenheit}
							<div class="info-row">
								<strong>Anwesend:</strong>
								<span class="personen-kurz">
									{tag.protokoll.inhalt.anwesenheit.split(',').length} Personen
								</span>
							</div>
						{/if}

						<!-- Leitung/Dienste -->
						<div class="dienste">
							{#if tag.protokoll.inhalt.leitung_im_haus}
								<div class="dienst-item">👤 {tag.protokoll.inhalt.leitung_im_haus}</div>
							{/if}
							{#if tag.protokoll.inhalt.spaetdienst}
								<div class="dienst-item">🌙 {tag.protokoll.inhalt.spaetdienst}</div>
							{/if}
						</div>

						<!-- Mini Planungsmatrix -->
						<div class="mini-matrix">
							<table>
								<thead>
									<tr>
										<th class="mini-raum">Raum</th>
										{#each zeitslots as slot}
											<th class="mini-zeit">{slot.split('-')[0]}</th>
										{/each}
									</tr>
								</thead>
								<tbody>
									{#each raeume as raum}
										<tr>
											<td class="mini-raum-label">{raum.label}</td>
											{#each zeitslots as slot}
												<td class="mini-cell">
													{#if tag.protokoll.inhalt.planung[slot]?.[raum.key]}
														<span class="cell-filled">●</span>
													{:else}
														<span class="cell-empty">○</span>
													{/if}
												</td>
											{/each}
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				{:else}
					<div class="tag-empty">
						<p>Kein Protokoll</p>
						<button type="button" on:click|stopPropagation={() => goto(`/edit?date=${tag.datum}`)}>
							+ Erstellen
						</button>
					</div>
				{/if}
			</div>
		{/each}
		</div>
	</div>
</div>

<style>
	.wochenansicht {
		max-width: 100%;
		margin: 0 auto;
	}

	h2 {
		color: var(--text-primary);
		margin-bottom: 0.5rem;
		font-size: 1.5rem;
		text-align: center;
	}

	.scroll-hint {
		text-align: center;
		color: var(--text-secondary);
		font-size: 0.9rem;
		margin-bottom: 1rem;
	}

	.woche-scroll-container {
		overflow-x: auto;
		overflow-y: hidden;
		padding: 1rem 0;
		-webkit-overflow-scrolling: touch;
	}

	.woche-grid {
		display: flex;
		gap: 1.5rem;
		padding: 0 1rem;
		min-width: min-content;
	}

	.tag-card {
		background: var(--bg-secondary);
		border-radius: 12px;
		padding: 1.5rem;
		box-shadow: 0 2px 8px var(--shadow);
		cursor: pointer;
		transition: transform 0.2s, box-shadow 0.2s;
		border: 2px solid transparent;
		min-width: 350px;
		flex-shrink: 0;
	}

	.tag-card:hover {
		transform: translateY(-4px);
		box-shadow: 0 4px 12px var(--shadow);
		border-color: var(--accent-color);
	}

	.tag-card.has-protokoll {
		border-left: 4px solid var(--accent-color);
	}

	.tag-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		padding-bottom: 0.75rem;
		border-bottom: 2px solid var(--border-color);
	}

	.tag-header h3 {
		margin: 0;
		color: var(--text-primary);
		font-size: 1.2rem;
	}

	.datum {
		color: var(--text-secondary);
		font-size: 1rem;
		font-weight: 500;
	}

	.tag-content {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.status-badge {
		display: flex;
		gap: 0.5rem;
	}

	.badge {
		padding: 0.4rem 0.8rem;
		border-radius: 6px;
		font-size: 0.85rem;
		font-weight: 600;
	}

	.badge.filled {
		background: #27ae60;
		color: white;
	}

	.badge.empty {
		background: #f39c12;
		color: white;
	}

	.info-row {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.9rem;
	}

	.info-row strong {
		color: var(--text-secondary);
	}

	.personen-kurz {
		color: var(--text-primary);
	}

	.dienste {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		font-size: 0.85rem;
	}

	.dienst-item {
		color: var(--text-primary);
		background: var(--bg-primary);
		padding: 0.4rem 0.6rem;
		border-radius: 4px;
	}

	/* Mini Matrix */
	.mini-matrix {
		margin-top: 0.5rem;
		overflow-x: auto;
	}

	.mini-matrix table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.75rem;
	}

	.mini-matrix th,
	.mini-matrix td {
		border: 1px solid var(--border-color);
		padding: 0.3rem;
		text-align: center;
	}

	.mini-matrix thead th {
		background: var(--accent-color);
		color: white;
		font-weight: 600;
	}

	.mini-raum,
	.mini-raum-label {
		text-align: left;
		font-size: 0.7rem;
	}

	.mini-raum-label {
		background: var(--bg-primary);
		color: var(--text-primary);
		font-weight: 500;
	}

	.mini-zeit {
		font-size: 0.65rem;
	}

	.mini-cell {
		color: var(--text-secondary);
	}

	.cell-filled {
		color: #27ae60;
		font-size: 1rem;
	}

	.cell-empty {
		color: var(--border-color);
		font-size: 1rem;
	}

	/* Kein Protokoll */
	.tag-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem 1rem;
		gap: 1rem;
	}

	.tag-empty p {
		color: var(--text-secondary);
		margin: 0;
		font-size: 1rem;
	}

	.tag-empty button {
		padding: 0.6rem 1.2rem;
		background: var(--accent-color);
		color: white;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.9rem;
		font-weight: 600;
	}

	.tag-empty button:hover {
		background: var(--accent-hover);
	}

	/* Responsive */
	@media (max-width: 768px) {
		.woche-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
