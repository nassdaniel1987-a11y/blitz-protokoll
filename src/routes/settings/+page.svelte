<script>
	import { supabase } from '$lib/supabaseClient';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { getPersonen, savePersonen, getRaeume, saveRaeume, getVorlagen, saveVorlagen } from '$lib/einstellungenService';
	import { darkMode } from '$lib/darkModeStore';
	import { toast } from '$lib/toastStore';

	let personen = [];
	let neuerName = '';
	let raeume = [];
	let neuerRaumId = '';
	let neuerRaumLabel = '';
	let vorlagen = [];
	let loading = true;
	let saving = false;

	onMount(async () => {
		// Auth-Check
		const { data } = await supabase.auth.getSession();
		if (!data.session) {
			goto('/');
			return;
		}

		// Personen, Räume und Vorlagen laden
		personen = await getPersonen();
		raeume = await getRaeume();
		vorlagen = await getVorlagen();
		loading = false;
	});

	function addPerson() {
		if (neuerName.trim()) {
			personen = [...personen, neuerName.trim()];
			neuerName = '';
		}
	}

	function removePerson(index) {
		personen = personen.filter((_, i) => i !== index);
	}

	function addRaum() {
		if (neuerRaumLabel.trim()) {
			// Erstelle ID aus Label (lowercase, Umlaute ersetzen, Leerzeichen durch _ ersetzen)
			const id = neuerRaumId.trim() || neuerRaumLabel.trim()
				.toLowerCase()
				.replace(/ä/g, 'ae')
				.replace(/ö/g, 'oe')
				.replace(/ü/g, 'ue')
				.replace(/ß/g, 'ss')
				.replace(/\s+/g, '_')
				.replace(/[^a-z0-9_]/g, '');

			// Prüfe ob ID bereits existiert
			if (raeume.some(r => r.id === id)) {
				toast.show('Ein Raum mit dieser ID existiert bereits!', 'error');
				return;
			}

			raeume = [...raeume, { id, label: neuerRaumLabel.trim() }];
			neuerRaumId = '';
			neuerRaumLabel = '';
		}
	}

	function removeRaum(index) {
		raeume = raeume.filter((_, i) => i !== index);
	}

	async function removeVorlage(index) {
		const vorlage = vorlagen[index];
		if (confirm(`Vorlage "${vorlage.name}" wirklich löschen?`)) {
			vorlagen = vorlagen.filter((_, i) => i !== index);
			const success = await saveVorlagen(vorlagen);
			if (success) {
				toast.show('Vorlage erfolgreich gelöscht!', 'success');
			} else {
				toast.show('Fehler beim Löschen der Vorlage!', 'error');
			}
		}
	}

	function createVorlage() {
		goto('/vorlagen/edit');
	}

	function editVorlage(id) {
		goto(`/vorlagen/edit?id=${id}`);
	}

	async function handleSave() {
		saving = true;
		const successPersonen = await savePersonen(personen);
		const successRaeume = await saveRaeume(raeume);

		if (successPersonen && successRaeume) {
			toast.show('Einstellungen erfolgreich gespeichert!', 'success');
		} else {
			toast.show('Fehler beim Speichern der Einstellungen!', 'error');
		}
		saving = false;
	}
</script>

<div class="settings-container">
	<header class="header">
		<h1>Einstellungen</h1>
		<button on:click={() => goto('/dashboard')} class="back-btn">
			← Zurück zum Dashboard
		</button>
	</header>

	{#if loading}
		<p class="loading-text">Lade Einstellungen...</p>
	{:else}
		<section class="section">
			<h2>Personenliste</h2>
			<p class="description">
				Verwalte die Liste der Kolleg*innen für die Anwesenheitsauswahl.
			</p>

			<div class="person-list">
				{#each personen as person, index}
					<div class="person-item">
						<span class="person-name">{person}</span>
						<button 
							type="button" 
							on:click={() => removePerson(index)} 
							class="remove-btn"
							title="Person entfernen"
						>
							✕
						</button>
					</div>
				{/each}
			</div>

			<div class="add-person">
				<input 
					type="text" 
					bind:value={neuerName}
					placeholder="Neuer Name..."
					on:keydown={(e) => e.key === 'Enter' && addPerson()}
				/>
				<button type="button" on:click={addPerson} class="add-btn">
					+ Hinzufügen
				</button>
			</div>

		</section>

		<section class="section">
			<h2>Raumliste</h2>
			<p class="description">
				Verwalte die Liste der Räume für die Planungsmatrix.
			</p>

			<div class="person-list">
				{#each raeume as raum, index}
					<div class="person-item">
						<div class="raum-info">
							<span class="person-name">{raum.label}</span>
							<span class="raum-id">({raum.id})</span>
						</div>
						<button
							type="button"
							on:click={() => removeRaum(index)}
							class="remove-btn"
							title="Raum entfernen"
						>
							✕
						</button>
					</div>
				{/each}
			</div>

			<div class="add-raum">
				<input
					type="text"
					bind:value={neuerRaumLabel}
					placeholder="Raumname (z.B. Turnhalle)..."
					on:keydown={(e) => e.key === 'Enter' && addRaum()}
					class="raum-label-input"
				/>
				<button type="button" on:click={addRaum} class="add-btn">
					+ Hinzufügen
				</button>
			</div>
		</section>

		<section class="section">
			<h2>Tagesvorlagen</h2>
			<p class="description">
				Erstelle Vorlagen für wiederkehrende Tagesstrukturen (z.B. "Montag", "Freitag Kurz").
				Diese Vorlagen können beim Erstellen neuer Protokolle als Ausgangspunkt verwendet werden.
			</p>

			{#if vorlagen.length === 0}
				<p class="no-vorlagen">Noch keine Vorlagen vorhanden.</p>
			{:else}
				<div class="person-list">
					{#each vorlagen as vorlage, index}
						<div class="person-item">
							<span class="person-name">{vorlage.name}</span>
							<div class="vorlage-actions">
								<button
									type="button"
									on:click={() => editVorlage(vorlage.id)}
									class="edit-btn"
									title="Vorlage bearbeiten"
								>
									✎
								</button>
								<button
									type="button"
									on:click={() => removeVorlage(index)}
									class="remove-btn"
									title="Vorlage löschen"
								>
									✕
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}

			<div class="add-vorlage">
				<button type="button" on:click={createVorlage} class="add-btn vorlage-add-btn">
					+ Neue Vorlage erstellen
				</button>
			</div>
		</section>

		<div class="save-container">
			<button type="button" on:click={handleSave} disabled={saving} class="save-btn">
				{saving ? 'Speichert...' : 'Alle Einstellungen speichern'}
			</button>
		</div>
	{/if}
</div>

<style>
	.settings-container {
		min-height: 100vh;
		background: var(--bg-primary);
		padding: 20px;
	}

	.header {
		max-width: 800px;
		margin: 0 auto 30px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: var(--bg-secondary);
		padding: 20px 30px;
		border-radius: 12px;
		box-shadow: 0 2px 8px var(--shadow);
	}

	h1 {
		margin: 0;
		color: var(--text-primary);
		font-size: 1.8rem;
	}

	.back-btn {
		padding: 10px 20px;
		background: var(--accent-color);
		color: white;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-size: 14px;
	}

	.back-btn:hover {
		background: var(--accent-hover);
	}

	.loading-text {
		max-width: 800px;
		margin: 60px auto;
		text-align: center;
		font-size: 1.2rem;
		color: var(--text-secondary);
	}

	.section {
		max-width: 800px;
		margin: 0 auto;
		background: var(--bg-secondary);
		padding: 30px;
		border-radius: 12px;
		box-shadow: 0 2px 8px var(--shadow);
	}

	h2 {
		margin: 0 0 10px 0;
		color: var(--text-primary);
		font-size: 1.3rem;
	}

	.description {
		color: var(--text-secondary);
		margin-bottom: 30px;
		font-size: 0.95rem;
	}

	.person-list {
		margin-bottom: 20px;
	}

	.person-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		border-radius: 8px;
		margin-bottom: 10px;
	}

	.person-name {
		color: var(--text-primary);
		font-size: 1rem;
	}

	.remove-btn {
		padding: 4px 10px;
		background: #dc3545;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 16px;
		line-height: 1;
	}

	.remove-btn:hover {
		background: #c82333;
	}

	.add-person {
		display: flex;
		gap: 10px;
		margin-bottom: 30px;
	}

	.add-person input {
		flex: 1;
		padding: 12px;
		border: 2px solid var(--border-color);
		border-radius: 8px;
		font-size: 16px;
		background: var(--bg-primary);
		color: var(--text-primary);
	}

	.add-person input:focus {
		outline: none;
		border-color: var(--accent-color);
	}

	.add-btn {
		padding: 12px 24px;
		background: var(--accent-color);
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-size: 16px;
		font-weight: 600;
		white-space: nowrap;
	}

	.add-btn:hover {
		background: var(--accent-hover);
	}

	.save-container {
		max-width: 800px;
		margin: 30px auto 0;
		display: flex;
		justify-content: flex-end;
	}

	.add-raum {
		display: flex;
		gap: 10px;
		margin-bottom: 20px;
	}

	.add-raum input {
		flex: 1;
		padding: 12px;
		border: 2px solid var(--border-color);
		border-radius: 8px;
		font-size: 16px;
		background: var(--bg-primary);
		color: var(--text-primary);
	}

	.add-raum input:focus {
		outline: none;
		border-color: var(--accent-color);
	}

	.raum-info {
		display: flex;
		align-items: baseline;
		gap: 8px;
	}

	.raum-id {
		font-size: 0.85rem;
		color: var(--text-secondary);
		font-family: monospace;
	}

	.section + .section {
		margin-top: 30px;
	}

	.save-btn {
		padding: 14px 28px;
		background: var(--accent-color);
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-size: 16px;
		font-weight: 600;
	}

	.save-btn:hover:not(:disabled) {
		background: var(--accent-hover);
	}

	.save-btn:disabled {
		background: #ccc;
		cursor: not-allowed;
	}

	.no-vorlagen {
		color: var(--text-secondary);
		font-style: italic;
		margin-bottom: 20px;
	}

	.vorlage-actions {
		display: flex;
		gap: 8px;
	}

	.edit-btn {
		padding: 4px 10px;
		background: var(--accent-color);
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 16px;
		line-height: 1;
	}

	.edit-btn:hover {
		background: var(--accent-hover);
	}

	.add-vorlage {
		margin-top: 20px;
	}

	.vorlage-add-btn {
		width: 100%;
	}

	/* iPad-Optimierung */
	@media (max-width: 768px) {
		.header {
			flex-direction: column;
			gap: 15px;
			text-align: center;
		}

		.back-btn {
			width: 100%;
		}

		.add-person {
			flex-direction: column;
		}

		.add-btn {
			width: 100%;
		}

		.add-raum {
			flex-direction: column;
		}

		.save-container {
			padding: 0 20px;
		}

		.save-btn {
			width: 100%;
		}
	}
</style>