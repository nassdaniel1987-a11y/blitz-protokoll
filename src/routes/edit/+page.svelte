<script>
	import { supabase } from '$lib/supabaseClient';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { getProtokoll, saveProtokoll, getToday, getEmptyProtokoll } from '$lib/protokollService';
	import { darkMode } from '$lib/darkModeStore';

	// Datum aus URL-Parameter lesen, oder heutiges Datum verwenden
	let currentDate = getToday();
	let formData = getEmptyProtokoll();
	let loading = true;
	let saving = false;

	// Raumliste - HOF HINZUGEFÜGT
	const raeume = [
		'treffpunkt_1',
		'treffpunkt_2',
		'treffpunkt_3',
		'treffpunkt_4',
		'treffpunkt_kurz',
		'atelier',
		'werkstatt',
		'sporthalle',
		'gymnastikhalle',
		'computerraum',
		'hof'
	];

	// Zeitslots
	const zeitslots = ['12:25-13:10', '13:15-14:00', '14:00-14:30'];

	// Raum-Labels (schöner formatiert) - HOF HINZUGEFÜGT
	const raumLabels = {
		treffpunkt_1: 'Treffpunkt 1',
		treffpunkt_2: 'Treffpunkt 2',
		treffpunkt_3: 'Treffpunkt 3',
		treffpunkt_4: 'Treffpunkt 4',
		treffpunkt_kurz: 'Treffpunkt kurz',
		atelier: 'Atelier',
		werkstatt: 'Werkstatt',
		sporthalle: 'Sporthalle',
		gymnastikhalle: 'Gymnastikhalle',
		computerraum: 'Computerraum',
		hof: 'Hof'
	};

	onMount(async () => {
		// Auth-Check
		const { data } = await supabase.auth.getSession();
		if (!data.session) {
			goto('/');
			return;
		}

		// Datum aus URL-Parameter lesen
		const urlParams = new URLSearchParams(window.location.search);
		const dateParam = urlParams.get('date');
		if (dateParam) {
			currentDate = dateParam;
		}

		// Protokoll laden (falls vorhanden)
		const protokoll = await getProtokoll(currentDate);
		if (protokoll) {
			formData = protokoll.inhalt;
		} else {
			// Sicherstellen dass "hof" in leeren Protokollen existiert
			formData = getEmptyProtokoll();
		}
		loading = false;
	});

	// Auto-resize für Textareas
	function autoResize(event) {
		const textarea = event.target;
		textarea.style.height = 'auto';
		textarea.style.height = textarea.scrollHeight + 'px';
	}

	async function handleSave() {
		saving = true;
		const result = await saveProtokoll(currentDate, formData);
		
		if (result) {
			alert('Protokoll gespeichert!');
			goto('/dashboard');
		} else {
			alert('Fehler beim Speichern!');
		}
		saving = false;
	}

	function handleCancel() {
		goto('/dashboard');
	}
</script>

<div class="edit-container">
	{#if loading}
		<p class="loading-text">Lade Daten...</p>
	{:else}
		<div class="edit-header">
			<h1>Protokoll bearbeiten</h1>
			<p class="date">Datum: {currentDate}</p>
		</div>

		<form>
			<!-- Allgemeine Informationen -->
			<section class="section">
				<h2>Allgemeine Informationen</h2>
				
				<div class="form-group">
					<label for="anwesenheit">Anwesenheit</label>
					<input 
						type="text" 
						id="anwesenheit" 
						bind:value={formData.anwesenheit}
						placeholder="z.B. Max, Lisa, Thomas"
					/>
				</div>

				<div class="form-group">
					<label for="wer_geht_essen">Wer geht essen</label>
					<input 
						type="text" 
						id="wer_geht_essen" 
						bind:value={formData.wer_geht_essen}
						placeholder="z.B. Anna, Peter"
					/>
				</div>

				<div class="form-group">
					<label for="leitung_im_haus">Leitung im Haus</label>
					<input 
						type="text" 
						id="leitung_im_haus" 
						bind:value={formData.leitung_im_haus}
						placeholder="z.B. Frau Müller"
					/>
				</div>

				<div class="form-group">
					<label for="spaetdienst">Spätdienst</label>
					<input 
						type="text" 
						id="spaetdienst" 
						bind:value={formData.spaetdienst}
						placeholder="z.B. Herr Schmidt"
					/>
				</div>

				<div class="form-group">
					<label for="fruehdienst">Frühdienst nächster Tag</label>
					<input 
						type="text" 
						id="fruehdienst" 
						bind:value={formData.fruehdienst_naechster_tag}
						placeholder="z.B. Frau Weber"
					/>
				</div>

				<div class="form-group">
					<label for="sonstiges">Sonstiges</label>
					<textarea 
						id="sonstiges" 
						bind:value={formData.sonstiges}
						rows="4"
						placeholder="Weitere Anmerkungen..."
					></textarea>
				</div>
			</section>

			<!-- Belegungsplanung Matrix -->
			<section class="section">
				<h2>Belegungsplanung</h2>
				
				<div class="matrix-container">
					<div class="matrix-scroll">
						<table class="matrix">
							<thead>
								<tr>
									<th class="raum-header">Raum / Zeit</th>
									{#each zeitslots as slot}
										<th class="zeit-header">{slot}</th>
									{/each}
								</tr>
							</thead>
							<tbody>
								{#each raeume as raum}
									<tr>
										<td class="raum-label">{raumLabels[raum]}</td>
										{#each zeitslots as slot}
											<td>
												<textarea
													bind:value={formData.planung[slot][raum]}
													placeholder="..."
													class="matrix-input"
													rows="1"
													on:input={autoResize}
												></textarea>
											</td>
										{/each}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</section>

			<!-- Buttons -->
			<div class="button-group">
				<button type="button" on:click={handleCancel} class="btn-cancel">
					Abbrechen
				</button>
				<button type="button" on:click={handleSave} disabled={saving} class="btn-save">
					{saving ? 'Speichert...' : 'Speichern'}
				</button>
			</div>
		</form>
	{/if}
</div>

<style>
	.edit-container {
		padding: 20px;
		max-width: 1400px;
		margin: 0 auto;
		background: var(--bg-primary);
		min-height: 100vh;
	}

	.loading-text {
		text-align: center;
		font-size: 1.2rem;
		color: var(--text-secondary);
		padding: 60px 20px;
	}

	.edit-header {
		margin-bottom: 30px;
	}

	h1 {
		color: var(--text-primary);
		margin: 0 0 10px 0;
	}

	.date {
		color: var(--text-secondary);
		font-size: 1.1rem;
	}

	h2 {
		color: var(--text-primary);
		margin-bottom: 20px;
		font-size: 1.3rem;
	}

	.section {
		background: var(--bg-secondary);
		padding: 30px;
		border-radius: 12px;
		box-shadow: 0 2px 8px var(--shadow);
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

	input[type="text"],
	textarea {
		width: 100%;
		padding: 12px;
		border: 2px solid var(--border-color);
		border-radius: 8px;
		font-size: 16px;
		font-family: inherit;
		transition: border-color 0.3s;
		box-sizing: border-box;
		background: var(--bg-primary);
		color: var(--text-primary);
	}

	input:focus,
	textarea:focus {
		outline: none;
		border-color: var(--accent-color);
	}

	/* Matrix Styling */
	.matrix-container {
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
	}

	.matrix {
		width: 100%;
		border-collapse: collapse;
		min-width: 600px;
	}

	.matrix th,
	.matrix td {
		border: 1px solid var(--border-color);
		padding: 8px;
		text-align: center;
		vertical-align: top;
	}

	.matrix thead th {
		background: var(--accent-color);
		color: white;
		font-weight: 600;
		position: sticky;
		top: 0;
		z-index: 10;
	}

	.raum-header {
		text-align: left;
		min-width: 150px;
	}

	.zeit-header {
		min-width: 150px;
	}

	.raum-label {
		background: var(--bg-primary);
		font-weight: 500;
		text-align: left;
		padding-left: 12px;
		color: var(--text-primary);
	}

	.matrix-input {
		width: 100%;
		padding: 8px;
		border: 1px solid var(--border-color);
		border-radius: 4px;
		font-size: 14px;
		box-sizing: border-box;
		background: var(--bg-secondary);
		color: var(--text-primary);
		resize: none;
		overflow: hidden;
		min-height: 36px;
		line-height: 1.4;
	}

	.matrix-input:focus {
		border-color: var(--accent-color);
		outline: none;
	}

	/* Buttons */
	.button-group {
		display: flex;
		gap: 15px;
		justify-content: flex-end;
		margin-top: 30px;
	}

	button {
		padding: 14px 28px;
		border: none;
		border-radius: 8px;
		font-size: 16px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.3s;
	}

	.btn-save {
		background: var(--accent-color);
		color: white;
	}

	.btn-save:hover:not(:disabled) {
		background: var(--accent-hover);
	}

	.btn-save:disabled {
		background: #ccc;
		cursor: not-allowed;
	}

	.btn-cancel {
		background: var(--bg-primary);
		color: var(--text-primary);
		border: 2px solid var(--border-color);
	}

	.btn-cancel:hover {
		background: var(--border-color);
	}

	/* iPad-Optimierung */
	@media (max-width: 768px) {
		.edit-container {
			padding: 15px;
		}

		.section {
			padding: 20px;
		}

		input[type="text"],
		textarea,
		button {
			font-size: 18px;
			padding: 16px;
		}

		.matrix-input {
			font-size: 16px;
			padding: 12px;
		}

		.button-group {
			flex-direction: column;
		}

		button {
			width: 100%;
		}
	}
</style>