<script>
	import { supabase } from '$lib/supabaseClient';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { getPersonen, savePersonen, getRaeume, saveRaeume, getVorlagen, saveVorlagen } from '$lib/einstellungenService';
	import { isCurrentUserAdmin, getAllUsers, createUser, removeMustChangePassword, setUserAdminStatus, assignPersonToUser, deleteUser } from '$lib/userManagementService';
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

	// User-Management (nur für Admins)
	let isAdmin = false;
	let users = [];
	let showCreateUserModal = false;
	let newUsername = '';
	let newUserPassword = '';
	let creatingUser = false;

	// Collapse/Expand States für Bereiche
	let expandedSections = {
		benutzerverwaltung: false,
		personen: false,
		raeume: false,
		vorlagen: false
	};

	onMount(async () => {
		// Auth-Check
		const { data } = await supabase.auth.getSession();
		if (!data.session) {
			goto('/');
			return;
		}

		// Prüfen ob User Admin ist
		isAdmin = await isCurrentUserAdmin();

		// Personen, Räume und Vorlagen laden
		personen = await getPersonen();
		raeume = await getRaeume();
		vorlagen = await getVorlagen();

		// Wenn Admin: User-Liste laden
		if (isAdmin) {
			users = await getAllUsers();
		}

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

	// USER-MANAGEMENT Funktionen (nur für Admins)

	async function handleCreateUser() {
		if (!newUsername.trim() || !newUserPassword.trim()) {
			toast.show('Bitte Username und Passwort eingeben!', 'error');
			return;
		}

		if (newUserPassword.length < 8) {
			toast.show('Passwort muss mindestens 8 Zeichen lang sein!', 'error');
			return;
		}

		creatingUser = true;
		const result = await createUser(newUsername.trim(), newUserPassword);

		if (result.success) {
			toast.show(`User "${newUsername}" erfolgreich erstellt!`, 'success');
			// User-Liste neu laden
			users = await getAllUsers();
			// Modal schließen und Felder leeren
			showCreateUserModal = false;
			newUsername = '';
			newUserPassword = '';
		} else {
			toast.show(`Fehler beim Erstellen: ${result.error}`, 'error');
		}

		creatingUser = false;
	}

	async function handleRemoveMustChangePassword(user) {
		const currentMetadata = {
			is_admin: user.is_admin,
			must_change_password: user.must_change_password
		};

		const success = await removeMustChangePassword(user.id, currentMetadata);

		if (success) {
			toast.show('Passwort-Änderungspflicht entfernt!', 'success');
			users = await getAllUsers();
		} else {
			toast.show('Fehler beim Aktualisieren!', 'error');
		}
	}

	async function handleToggleAdmin(user) {
		const currentMetadata = {
			is_admin: user.is_admin,
			must_change_password: user.must_change_password,
			assigned_person_name: user.assigned_person_name
		};

		const newAdminStatus = !user.is_admin;
		const success = await setUserAdminStatus(user.id, currentMetadata, newAdminStatus);

		if (success) {
			toast.show(
				newAdminStatus ? 'Admin-Rechte erteilt!' : 'Admin-Rechte entfernt!',
				'success'
			);
			users = await getAllUsers();
		} else {
			toast.show('Fehler beim Aktualisieren!', 'error');
		}
	}

	async function handleAssignPerson(user, personName) {
		const currentMetadata = {
			is_admin: user.is_admin,
			must_change_password: user.must_change_password,
			assigned_person_name: user.assigned_person_name
		};

		const success = await assignPersonToUser(user.id, currentMetadata, personName || null);

		if (success) {
			toast.show(
				personName ? `Person "${personName}" zugeordnet!` : 'Zuordnung entfernt!',
				'success'
			);
			users = await getAllUsers();
		} else {
			toast.show('Fehler beim Zuordnen!', 'error');
		}
	}

	async function handleDeleteUser(user) {
		const username = getUsernameFromEmail(user.email);

		if (!confirm(`Möchtest du den Benutzer "${username}" wirklich löschen?\n\nDiese Aktion kann nicht rückgängig gemacht werden!`)) {
			return;
		}

		const result = await deleteUser(user.id);

		if (result.success) {
			toast.show(`Benutzer "${username}" erfolgreich gelöscht!`, 'success');
			users = await getAllUsers();
		} else {
			toast.show(`Fehler beim Löschen: ${result.error}`, 'error');
		}
	}

	function formatTimestamp(timestamp) {
		if (!timestamp) return 'Nie';
		const date = new Date(timestamp);
		return date.toLocaleString('de-DE');
	}

	function getUsernameFromEmail(email) {
		return email.split('@')[0];
	}

	function toggleSection(sectionName) {
		expandedSections[sectionName] = !expandedSections[sectionName];
		expandedSections = { ...expandedSections }; // Trigger reactivity
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
		<!-- USER-VERWALTUNG (nur für Admins) -->
		{#if isAdmin}
			<section class="section admin-section">
				<h2 class="section-header clickable" on:click={() => toggleSection('benutzerverwaltung')}>
					<span class="expand-icon">{expandedSections.benutzerverwaltung ? '▼' : '▶'}</span>
					🔐 Benutzerverwaltung
				</h2>

				{#if expandedSections.benutzerverwaltung}
					<p class="description">
						Erstelle und verwalte Benutzer-Accounts. Neue User müssen beim ersten Login ihr Passwort ändern.
					</p>

					<button on:click={() => showCreateUserModal = true} class="create-user-btn">
						+ Neuer Benutzer
					</button>

					<div class="user-list">
					{#each users as user}
						<div class="user-item">
							<div class="user-info">
								<div class="user-header">
									<span class="user-name">{getUsernameFromEmail(user.email)}</span>
									{#if user.is_admin}
										<span class="admin-badge">Admin</span>
									{/if}
									{#if user.must_change_password}
										<span class="password-badge">Passwort ändern</span>
									{/if}
								</div>
								<div class="user-details">
									<span class="user-email">{user.email}</span>
									<span class="user-date">Erstellt: {formatTimestamp(user.created_at)}</span>
									{#if user.last_sign_in_at}
										<span class="user-date">Letzter Login: {formatTimestamp(user.last_sign_in_at)}</span>
									{:else}
										<span class="user-date user-never-logged-in">Noch nie eingeloggt</span>
									{/if}
									<!-- Zugeordnete Person -->
									<div class="person-assignment">
										<label for="person-{user.id}">Zugeordnete Person:</label>
										<select
											id="person-{user.id}"
											value={user.assigned_person_name || ''}
											on:change={(e) => handleAssignPerson(user, e.target.value)}
											class="person-select"
										>
											<option value="">-- Keine Zuordnung --</option>
											{#each personen as person}
												<option value={person}>{person}</option>
											{/each}
										</select>
									</div>
								</div>
							</div>
							<div class="user-actions">
								{#if user.must_change_password}
									<button
										on:click={() => handleRemoveMustChangePassword(user)}
										class="action-btn"
										title="Passwort-Änderungspflicht entfernen"
									>
										🔓 Pflicht entfernen
									</button>
								{/if}
								<button
									on:click={() => handleToggleAdmin(user)}
									class="action-btn"
									title={user.is_admin ? 'Admin-Rechte entziehen' : 'Zum Admin machen'}
								>
									{user.is_admin ? '👤 Admin entfernen' : '👑 Zum Admin machen'}
								</button>
								<button
									on:click={() => handleDeleteUser(user)}
									class="action-btn delete-btn"
									title="Benutzer löschen"
								>
									🗑️ Benutzer löschen
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
			</section>
		{/if}

		<section class="section">
			<h2 class="section-header clickable" on:click={() => toggleSection('personen')}>
				<span class="expand-icon">{expandedSections.personen ? '▼' : '▶'}</span>
				Personenliste
			</h2>

			{#if expandedSections.personen}
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
			{/if}

		</section>

		<section class="section">
			<h2 class="section-header clickable" on:click={() => toggleSection('raeume')}>
				<span class="expand-icon">{expandedSections.raeume ? '▼' : '▶'}</span>
				Raumliste
			</h2>

			{#if expandedSections.raeume}
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
			{/if}
		</section>

		<section class="section">
			<h2 class="section-header clickable" on:click={() => toggleSection('vorlagen')}>
				<span class="expand-icon">{expandedSections.vorlagen ? '▼' : '▶'}</span>
				Tagesvorlagen
			</h2>

			{#if expandedSections.vorlagen}
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
			{/if}
		</section>

		<div class="save-container">
			<button type="button" on:click={handleSave} disabled={saving} class="save-btn">
				{saving ? 'Speichert...' : 'Alle Einstellungen speichern'}
			</button>
		</div>
	{/if}
</div>

<!-- Modal: Neuer Benutzer erstellen -->
{#if showCreateUserModal}
	<div class="modal-overlay" on:click={() => showCreateUserModal = false}>
		<div class="modal-content" on:click|stopPropagation>
			<div class="modal-header">
				<h2>Neuer Benutzer</h2>
				<button
					on:click={() => showCreateUserModal = false}
					class="modal-close"
					title="Schließen"
				>
					✕
				</button>
			</div>

			<div class="modal-body">
				<div class="form-group">
					<label for="username">
						Username
						<span class="hint">(ohne @blitz-protokoll.local)</span>
					</label>
					<input
						type="text"
						id="username"
						bind:value={newUsername}
						placeholder="z.B. mueller"
						disabled={creatingUser}
					/>
				</div>

				<div class="form-group">
					<label for="password">
						Initial-Passwort
						<span class="hint">(mind. 8 Zeichen)</span>
					</label>
					<input
						type="password"
						id="password"
						bind:value={newUserPassword}
						placeholder="Temporäres Passwort"
						disabled={creatingUser}
					/>
				</div>

				<p class="modal-info">
					ℹ️ Der neue User muss beim ersten Login das Passwort ändern.
				</p>
			</div>

			<div class="modal-footer">
				<button
					on:click={() => showCreateUserModal = false}
					class="btn-secondary"
					disabled={creatingUser}
				>
					Abbrechen
				</button>
				<button
					on:click={handleCreateUser}
					class="btn-primary"
					disabled={creatingUser}
				>
					{creatingUser ? 'Erstelle...' : 'Benutzer erstellen'}
				</button>
			</div>
		</div>
	</div>
{/if}

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

	/* Collapsible Section Headers */
	.section-header {
		cursor: pointer;
		user-select: none;
		transition: color 0.2s;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.section-header:hover {
		color: var(--color-primary);
	}

	.section-header.clickable {
		cursor: pointer;
	}

	.expand-icon {
		display: inline-block;
		font-size: 0.9em;
		transition: transform 0.2s;
		width: 20px;
		text-align: center;
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
	/* USER-MANAGEMENT Styles */

	.create-user-btn {
		padding: 12px 24px;
		background: #2196f3;
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-size: 16px;
		font-weight: 600;
		margin-bottom: 20px;
	}

	.create-user-btn:hover {
		background: #1976d2;
	}

	.user-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.user-item {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 16px;
		padding: 16px;
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		border-radius: 8px;
	}

	.user-info {
		flex: 1;
	}

	.user-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
	}

	.user-name {
		font-weight: 600;
		font-size: 18px;
		color: var(--text-primary);
	}

	.admin-badge {
		padding: 4px 8px;
		background: #ff9800;
		color: white;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 600;
	}

	.password-badge {
		padding: 4px 8px;
		background: #f44336;
		color: white;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 600;
	}

	.user-details {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.user-email {
		color: var(--text-secondary);
		font-size: 14px;
	}

	.user-date {
		color: var(--text-secondary);
		font-size: 13px;
	}

	.user-never-logged-in {
		color: #f44336;
		font-weight: 500;
	}

	.person-assignment {
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid var(--border-color);
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.person-assignment label {
		font-size: 13px;
		color: var(--text-secondary);
		font-weight: 500;
	}

	.person-select {
		padding: 8px 12px;
		border: 2px solid var(--border-color);
		border-radius: 6px;
		font-size: 14px;
		background: var(--bg-primary);
		color: var(--text-primary);
		cursor: pointer;
		transition: border-color 0.2s;
	}

	.person-select:focus {
		outline: none;
		border-color: var(--accent-color);
	}

	.person-select:hover {
		border-color: var(--accent-color);
	}

	.user-actions {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.action-btn {
		padding: 8px 16px;
		background: var(--bg-secondary);
		color: var(--text-primary);
		border: 1px solid var(--border-color);
		border-radius: 6px;
		cursor: pointer;
		font-size: 14px;
		white-space: nowrap;
	}

	.action-btn:hover {
		background: var(--accent-color);
		color: white;
		border-color: var(--accent-color);
	}

	.delete-btn {
		background: #fff5f5;
		color: #dc3545;
		border-color: #dc3545;
	}

	.delete-btn:hover {
		background: #dc3545;
		color: white;
		border-color: #dc3545;
	}

	:global(.dark-mode) .delete-btn {
		background: #2d1f1f;
		color: #ff6b6b;
		border-color: #dc3545;
	}

	:global(.dark-mode) .delete-btn:hover {
		background: #dc3545;
		color: white;
	}

	/* Modal Styles */

	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		backdrop-filter: blur(2px);
	}

	.modal-content {
		background: var(--bg-primary);
		border-radius: 12px;
		width: 90%;
		max-width: 500px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 20px;
		border-bottom: 1px solid var(--border-color);
	}

	.modal-header h2 {
		margin: 0;
		color: var(--text-primary);
	}

	.modal-close {
		background: none;
		border: none;
		font-size: 24px;
		cursor: pointer;
		color: var(--text-secondary);
		padding: 0;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
	}

	.modal-close:hover {
		background: var(--bg-secondary);
		color: var(--text-primary);
	}

	.modal-body {
		padding: 20px;
	}

	.form-group {
		margin-bottom: 20px;
	}

	.form-group label {
		display: block;
		margin-bottom: 8px;
		color: var(--text-primary);
		font-weight: 500;
	}

	.form-group .hint {
		color: var(--text-secondary);
		font-size: 13px;
		font-weight: normal;
	}

	.form-group input {
		width: 100%;
		padding: 12px;
		border: 2px solid var(--border-color);
		border-radius: 8px;
		font-size: 16px;
		background: var(--bg-primary);
		color: var(--text-primary);
	}

	.form-group input:focus {
		outline: none;
		border-color: var(--accent-color);
	}

	.form-group input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.modal-info {
		padding: 12px;
		background: #e3f2fd;
		border-left: 4px solid #2196f3;
		border-radius: 4px;
		margin: 0;
		font-size: 14px;
		color: #1565c0;
	}

	:global(.dark-mode) .modal-info {
		background: #1a2a3a;
		color: #64b5f6;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 12px;
		padding: 20px;
		border-top: 1px solid var(--border-color);
	}

	.btn-secondary {
		padding: 12px 24px;
		background: var(--bg-secondary);
		color: var(--text-primary);
		border: 1px solid var(--border-color);
		border-radius: 8px;
		cursor: pointer;
		font-size: 16px;
	}

	.btn-secondary:hover {
		background: var(--border-color);
	}

	.btn-secondary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-primary {
		padding: 12px 24px;
		background: #2196f3;
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-size: 16px;
		font-weight: 600;
	}

	.btn-primary:hover {
		background: #1976d2;
	}

	.btn-primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

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