<script>
	import { supabase } from '$lib/supabaseClient';
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { getPersonen, savePersonen, getRaeume, saveRaeume, getVorlagen, saveVorlagen, renamePersonEverywhere } from '$lib/einstellungenService';
	import { isCurrentUserAdmin, getAllUsers, createUser, removeMustChangePassword, setUserAdminStatus, assignPersonToUser, deleteUser, resetUserPassword } from '$lib/userManagementService';
	import { darkMode } from '$lib/darkModeStore';
	import { modernUi } from '$lib/modernUiStore';
	import { toast } from '$lib/toastStore';
	import { initInactivityTracking, cleanup as cleanupInactivity } from '$lib/inactivityStore';
	import InactivityWarning from '$lib/components/InactivityWarning.svelte';

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

	// Passwort Reset State
	let showResetPasswordModal = false;
	let resetUser = null;
	let resetPasswordValue = '';
	let resettingPassword = false;

	// Person Rename State
	let showRenamePersonModal = false;
	let renamePersonIndex = null;
	let renamePersonNewName = '';
	let renamingPerson = false;

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

		// Inaktivitäts-Tracking starten
		initInactivityTracking();

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

	function openRenamePersonModal(index) {
		renamePersonIndex = index;
		renamePersonNewName = personen[index];
		showRenamePersonModal = true;
	}

	async function handleRenamePerson() {
		if (!renamePersonNewName.trim()) {
			toast.show('Bitte einen Namen eingeben!', 'error');
			return;
		}

		const newName = renamePersonNewName.trim();
		const oldName = personen[renamePersonIndex];

		if (newName === oldName) {
			showRenamePersonModal = false;
			return;
		}

		// Prüfen ob Name bereits existiert
		if (personen.some((p, i) => i !== renamePersonIndex && p === newName)) {
			toast.show('Dieser Name existiert bereits!', 'error');
			return;
		}

		renamingPerson = true;
		const { success, updatedPersonen, stats } = await renamePersonEverywhere(personen, renamePersonIndex, newName);

		if (success) {
			personen = updatedPersonen;
			let message = `"${oldName}" wurde zu "${newName}" umbenannt!`;
			if (stats.vorlagen > 0 || stats.protokolle > 0) {
				message += ` (${stats.vorlagen} Vorlagen, ${stats.protokolle} Protokolle aktualisiert)`;
			}
			toast.show(message, 'success');
			showRenamePersonModal = false;
			renamePersonIndex = null;
			renamePersonNewName = '';
		} else {
			toast.show('Fehler beim Umbenennen!', 'error');
		}

		renamingPerson = false;
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

	function moveRaumUp(index) {
		if (index > 0) {
			const newRaeume = [...raeume];
			[newRaeume[index - 1], newRaeume[index]] = [newRaeume[index], newRaeume[index - 1]];
			raeume = newRaeume;
		}
	}

	function moveRaumDown(index) {
		if (index < raeume.length - 1) {
			const newRaeume = [...raeume];
			[newRaeume[index], newRaeume[index + 1]] = [newRaeume[index + 1], newRaeume[index]];
			raeume = newRaeume;
		}
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

	async function copyVorlage(index) {
		const vorlage = vorlagen[index];

		// Deep-Copy der Vorlage erstellen
		const kopie = JSON.parse(JSON.stringify(vorlage));

		// Neue UUID generieren
		kopie.id = crypto.randomUUID();

		// Namen anpassen
		kopie.name = `${vorlage.name} (Kopie)`;

		// Zur Liste hinzufügen
		vorlagen = [...vorlagen, kopie];

		// Speichern
		const success = await saveVorlagen(vorlagen);
		if (success) {
			toast.show(`Vorlage "${vorlage.name}" wurde kopiert!`, 'success');
		} else {
			toast.show('Fehler beim Kopieren der Vorlage!', 'error');
		}
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

	function openResetPasswordModal(user) {
		resetUser = user;
		resetPasswordValue = '';
		showResetPasswordModal = true;
	}

	async function handleResetPassword() {
		if (!resetPasswordValue.trim()) {
			toast.show('Bitte ein neues Passwort eingeben!', 'error');
			return;
		}

		if (resetPasswordValue.length < 8) {
			toast.show('Passwort muss mindestens 8 Zeichen lang sein!', 'error');
			return;
		}

		if (!resetUser) return;

		resettingPassword = true;
		const result = await resetUserPassword(resetUser.id, resetPasswordValue);

		if (result.success) {
			toast.show(`Passwort für "${getUsernameFromEmail(resetUser.email)}" erfolgreich zurückgesetzt!`, 'success');
			// User-Liste neu laden (um Metadata Updates zu sehen)
			users = await getAllUsers();
			// Modal schließen
			showResetPasswordModal = false;
			resetUser = null;
			resetPasswordValue = '';
		} else {
			toast.show(`Fehler beim Zurücksetzen: ${result.error}`, 'error');
		}

		resettingPassword = false;
	}

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

	onDestroy(() => {
		cleanupInactivity();
	});
</script>

<InactivityWarning />

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
		<!-- MODERN UI Design-Auswahl -->
		<section class="section modern-ui-section">
			<h2 class="section-header">
				&#x2728; Design
			</h2>
			<p class="description">
				Wechsle zwischen dem klassischen und dem modernen Design.
			</p>
			<div class="modern-ui-toggle-row">
				<span class="modern-ui-toggle-label">Modern UI aktiviert</span>
				<button
					type="button"
					class="modern-ui-switch"
					class:active={$modernUi}
					on:click={() => {
						$modernUi = !$modernUi;
						if ($modernUi) {
							document.documentElement.classList.add('modern-ui');
						} else {
							document.documentElement.classList.remove('modern-ui');
						}
					}}
					role="switch"
					aria-checked={$modernUi}
				>
					<span class="modern-ui-switch-thumb"></span>
				</button>
			</div>
			{#if $modernUi}
				<div class="modern-ui-info">
					Das modernisierte Design ist aktiv.
				</div>
			{/if}
		</section>

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
									on:click={() => openResetPasswordModal(user)}
									class="action-btn"
									title="Passwort zurücksetzen"
								>
									🔑 Passwort ändern
								</button>
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
						<div class="person-actions">
							<button
								type="button"
								on:click={() => openRenamePersonModal(index)}
								class="rename-btn"
								title="Person umbenennen"
							>
								✎
							</button>
							<button
								type="button"
								on:click={() => removePerson(index)}
								class="remove-btn"
								title="Person entfernen"
							>
								✕
							</button>
						</div>
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
						<div class="raum-actions">
							<button
								type="button"
								on:click={() => moveRaumUp(index)}
								class="move-btn"
								title="Nach oben verschieben"
								disabled={index === 0}
							>
								▲
							</button>
							<button
								type="button"
								on:click={() => moveRaumDown(index)}
								class="move-btn"
								title="Nach unten verschieben"
								disabled={index === raeume.length - 1}
							>
								▼
							</button>
							<button
								type="button"
								on:click={() => removeRaum(index)}
								class="remove-btn"
								title="Raum entfernen"
							>
								✕
							</button>
						</div>
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
									on:click={() => copyVorlage(index)}
									class="copy-btn"
									title="Vorlage kopieren"
								>
									⧉
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

<!-- Modal: Passwort zurücksetzen -->
{#if showResetPasswordModal}
	<div class="modal-overlay" on:click={() => showResetPasswordModal = false}>
		<div class="modal-content" on:click|stopPropagation>
			<div class="modal-header">
				<h2>Passwort zurücksetzen</h2>
				<button
					on:click={() => showResetPasswordModal = false}
					class="modal-close"
					title="Schließen"
				>
					✕
				</button>
			</div>

			<div class="modal-body">
				<p style="margin-bottom: 20px; color: var(--text-primary);">
					Neues Passwort für <strong>{resetUser ? getUsernameFromEmail(resetUser.email) : 'User'}</strong> vergeben:
				</p>

				<div class="form-group">
					<label for="reset-password">
						Neues Passwort
						<span class="hint">(mind. 8 Zeichen)</span>
					</label>
					<input
						type="password"
						id="reset-password"
						bind:value={resetPasswordValue}
						placeholder="Neues Passwort eingeben"
						disabled={resettingPassword}
					/>
				</div>

				<p class="modal-info">
					ℹ️ Der User muss beim nächsten Login das Passwort erneut ändern.
				</p>
			</div>

			<div class="modal-footer">
				<button
					on:click={() => showResetPasswordModal = false}
					class="btn-secondary"
					disabled={resettingPassword}
				>
					Abbrechen
				</button>
				<button
					on:click={handleResetPassword}
					class="btn-primary"
					disabled={resettingPassword}
				>
					{resettingPassword ? 'Speichere...' : 'Passwort setzen'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal: Person umbenennen -->
{#if showRenamePersonModal}
	<div class="modal-overlay" on:click={() => showRenamePersonModal = false}>
		<div class="modal-content" on:click|stopPropagation>
			<div class="modal-header">
				<h2>Person umbenennen</h2>
				<button
					on:click={() => showRenamePersonModal = false}
					class="modal-close"
					title="Schließen"
				>
					✕
				</button>
			</div>

			<div class="modal-body">
				<p style="margin-bottom: 20px; color: var(--text-primary);">
					Aktueller Name: <strong>{renamePersonIndex !== null ? personen[renamePersonIndex] : ''}</strong>
				</p>

				<div class="form-group">
					<label for="rename-person">
						Neuer Name
					</label>
					<input
						type="text"
						id="rename-person"
						bind:value={renamePersonNewName}
						placeholder="Neuen Namen eingeben"
						disabled={renamingPerson}
						on:keydown={(e) => e.key === 'Enter' && handleRenamePerson()}
					/>
				</div>

				<p class="modal-info">
					Der Name wird in allen Vorlagen und bestehenden Protokollen aktualisiert.
				</p>
			</div>

			<div class="modal-footer">
				<button
					on:click={() => showRenamePersonModal = false}
					class="btn-secondary"
					disabled={renamingPerson}
				>
					Abbrechen
				</button>
				<button
					on:click={handleRenamePerson}
					class="btn-primary"
					disabled={renamingPerson}
				>
					{renamingPerson ? 'Speichere...' : 'Umbenennen'}
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

	.person-actions {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.rename-btn {
		padding: 4px 10px;
		background: var(--accent-color);
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 16px;
		line-height: 1;
	}

	.rename-btn:hover {
		background: var(--accent-hover);
	}

	.raum-actions {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.move-btn {
		padding: 4px 8px;
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
		line-height: 1;
		transition: opacity 0.2s, background 0.2s;
	}

	.move-btn:hover:not(:disabled) {
		background: var(--color-primary-dark);
	}

	.move-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
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

	.copy-btn {
		padding: 4px 10px;
		background: #17a2b8;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 16px;
		line-height: 1;
	}

	.copy-btn:hover {
		background: #138496;
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

	/* Modern UI Toggle Styles */
	.modern-ui-section {
		border-left: 4px solid var(--accent-color);
	}

	.modern-ui-toggle-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 0;
	}

	.modern-ui-toggle-label {
		font-size: 1rem;
		font-weight: 500;
		color: var(--text-primary);
	}

	.modern-ui-switch {
		position: relative;
		width: 52px;
		height: 28px;
		border-radius: 14px;
		background: var(--border-color);
		border: none;
		cursor: pointer;
		transition: background-color 0.3s;
		padding: 0;
		flex-shrink: 0;
	}

	.modern-ui-switch.active {
		background: var(--accent-color);
	}

	.modern-ui-switch-thumb {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: white;
		transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
	}

	.modern-ui-switch.active .modern-ui-switch-thumb {
		transform: translateX(24px);
	}

	.modern-ui-info {
		padding: 12px 16px;
		background: var(--accent-light, rgba(79, 109, 245, 0.08));
		border: 1px solid var(--accent-color);
		border-radius: 8px;
		font-size: 14px;
		color: var(--accent-color);
		line-height: 1.5;
	}

	/* === MODERN UI SETTINGS OVERRIDES === */
	:global(.modern-ui) .settings-container {
		background: var(--bg-primary);
	}

	:global(.modern-ui) .header {
		border-radius: var(--radius-xl);
		border: 1px solid var(--border-color);
		box-shadow: var(--shadow-md);
	}

	:global(.modern-ui) .header h1 {
		background: var(--gradient-primary);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	:global(.modern-ui) .back-btn {
		background: var(--gradient-primary);
		border-radius: var(--radius-md);
		font-weight: 500;
		box-shadow: var(--shadow-accent);
		transition: all 0.2s;
	}

	:global(.modern-ui) .back-btn:hover {
		transform: translateY(-1px);
		box-shadow: 0 6px 20px rgba(79, 109, 245, 0.3);
	}

	:global(.modern-ui) .section {
		border-radius: var(--radius-xl);
		border: 1px solid var(--border-color);
		box-shadow: var(--shadow-md);
	}

	:global(.modern-ui) .section-header {
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	:global(.modern-ui) .person-item {
		border-radius: var(--radius-md);
		border: 1.5px solid var(--border-color);
		transition: all 0.2s;
	}

	:global(.modern-ui) .person-item:hover {
		border-color: var(--accent-color);
		background: var(--accent-light);
		transform: translateX(4px);
	}

	:global(.modern-ui) .user-item {
		border-radius: var(--radius-lg);
		border: 1.5px solid var(--border-color);
		transition: all 0.2s;
	}

	:global(.modern-ui) .user-item:hover {
		border-color: var(--accent-color);
		box-shadow: var(--shadow-md);
	}

	:global(.modern-ui) .admin-badge {
		background: linear-gradient(135deg, #f59e0b, #d97706);
		border-radius: 6px;
		font-weight: 600;
	}

	:global(.modern-ui) .password-badge {
		background: linear-gradient(135deg, #ef4444, #dc2626);
		border-radius: 6px;
		font-weight: 600;
	}

	:global(.modern-ui) .add-btn {
		background: var(--gradient-primary);
		border-radius: var(--radius-md);
		font-weight: 500;
		box-shadow: var(--shadow-accent);
		transition: all 0.2s;
	}

	:global(.modern-ui) .add-btn:hover {
		transform: translateY(-1px);
		box-shadow: 0 6px 20px rgba(79, 109, 245, 0.3);
	}

	:global(.modern-ui) .save-btn {
		background: var(--gradient-primary);
		border-radius: var(--radius-md);
		font-weight: 600;
		box-shadow: var(--shadow-accent);
		padding: 16px 32px;
		transition: all 0.2s;
	}

	:global(.modern-ui) .save-btn:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 8px 24px rgba(79, 109, 245, 0.3);
	}

	:global(.modern-ui) .create-user-btn {
		background: var(--gradient-primary);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-accent);
		transition: all 0.2s;
	}

	:global(.modern-ui) .create-user-btn:hover {
		transform: translateY(-1px);
		box-shadow: 0 6px 20px rgba(79, 109, 245, 0.3);
	}

	:global(.modern-ui) .action-btn {
		border-radius: var(--radius-sm);
		transition: all 0.2s;
	}

	:global(.modern-ui) .action-btn:hover {
		background: var(--gradient-primary);
		color: white;
		border-color: transparent;
		transform: translateY(-1px);
	}

	:global(.modern-ui) .rename-btn {
		border-radius: var(--radius-sm);
		background: var(--accent-color);
	}

	:global(.modern-ui) .remove-btn {
		border-radius: var(--radius-sm);
		background: linear-gradient(135deg, #ef4444, #dc2626);
	}

	:global(.modern-ui) .modal-overlay {
		backdrop-filter: blur(8px);
		background: rgba(0, 0, 0, 0.5);
	}

	:global(.modern-ui) .modal-content {
		border-radius: var(--radius-xl);
		border: 1px solid var(--border-color);
		box-shadow: var(--shadow-lg);
	}

	:global(.modern-ui) .btn-primary {
		background: var(--gradient-primary);
		border-radius: var(--radius-md);
		font-weight: 600;
		box-shadow: var(--shadow-accent);
		transition: all 0.2s;
	}

	:global(.modern-ui) .btn-primary:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 6px 20px rgba(79, 109, 245, 0.3);
	}

	:global(.modern-ui) .btn-secondary {
		border-radius: var(--radius-md);
		transition: all 0.2s;
	}

	:global(.modern-ui) .person-select {
		border-radius: var(--radius-sm);
	}

	:global(.modern-ui) .person-select:focus {
		box-shadow: 0 0 0 3px var(--accent-glow);
	}

	:global(.modern-ui) .add-person input,
	:global(.modern-ui) .add-raum input {
		border-radius: var(--radius-md);
	}

	:global(.modern-ui) .form-group input {
		border-radius: var(--radius-md);
	}

	:global(.modern-ui) .modal-info {
		border-radius: var(--radius-sm);
		border-left: 4px solid var(--info-color, #3b82f6);
		background: var(--info-bg, rgba(59, 130, 246, 0.08));
		color: var(--info-color, #3b82f6);
	}

	:global(.modern-ui) .modern-ui-section {
		border-left: 4px solid var(--accent-color);
		background: var(--bg-secondary);
	}

	:global(.modern-ui) .modern-ui-switch.active {
		background: var(--gradient-primary);
	}

	:global(.modern-ui) .modern-ui-info {
		border-radius: var(--radius-md);
	}

	:global(.modern-ui) .copy-btn {
		border-radius: var(--radius-sm);
		background: linear-gradient(135deg, #06b6d4, #0891b2);
	}

	:global(.modern-ui) .edit-btn {
		border-radius: var(--radius-sm);
	}
	/* === END MODERN UI SETTINGS OVERRIDES === */

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