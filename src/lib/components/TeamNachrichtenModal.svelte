<script>
	import { onMount } from 'svelte';
	import { getNachrichten, createNachricht, updateNachricht, deleteNachricht, getAllLogs } from '$lib/teamNachrichtenService';
	import { toast } from '$lib/toastStore';
	import { supabase } from '$lib/supabaseClient';

	export let show = false;
	export let currentUsername = ''; // Aktuell eingeloggter User

	let nachrichten = [];
	let newMessage = '';
	let loading = false;
	let editingId = null;
	let editingMessage = '';
	let showLog = false;
	let logEntries = [];

	$: if (show) {
		loadNachrichten();
	}

	async function loadNachrichten() {
		nachrichten = await getNachrichten();
	}

	async function handleCreate() {
		if (!newMessage.trim()) return;

		loading = true;
		const success = await createNachricht(newMessage.trim(), currentUsername);

		if (success) {
			toast.show('Nachricht erstellt', 'success');
			newMessage = '';
			await loadNachrichten();
		} else {
			toast.show('Fehler beim Erstellen', 'error');
		}
		loading = false;
	}

	function startEdit(nachricht) {
		editingId = nachricht.id;
		editingMessage = nachricht.message;
	}

	function cancelEdit() {
		editingId = null;
		editingMessage = '';
	}

	async function saveEdit(nachricht) {
		if (!editingMessage.trim()) return;

		loading = true;
		const success = await updateNachricht(
			nachricht.id,
			editingMessage.trim(),
			currentUsername,
			nachricht.message
		);

		if (success) {
			toast.show('Nachricht aktualisiert', 'success');
			editingId = null;
			editingMessage = '';
			await loadNachrichten();
		} else {
			toast.show('Fehler beim Aktualisieren', 'error');
		}
		loading = false;
	}

	async function handleDelete(nachricht) {
		if (!confirm(`Nachricht wirklich löschen?\n\n"${nachricht.message}"`)) return;

		loading = true;
		const success = await deleteNachricht(nachricht.id, currentUsername, nachricht.message);

		if (success) {
			toast.show('Nachricht gelöscht', 'success');
			await loadNachrichten();
		} else {
			toast.show('Fehler beim Löschen', 'error');
		}
		loading = false;
	}

	async function showLogModal() {
		showLog = true;
		logEntries = await getAllLogs();
	}

	function closeLogModal() {
		showLog = false;
		logEntries = [];
	}

	function formatDate(dateString) {
		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now - date;
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'Gerade eben';
		if (diffMins < 60) return `vor ${diffMins} Min`;
		if (diffHours < 24) return `vor ${diffHours} Std`;
		if (diffDays < 7) return `vor ${diffDays} Tag${diffDays > 1 ? 'en' : ''}`;

		return date.toLocaleDateString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function getActionText(action) {
		switch(action) {
			case 'created': return '✨ Erstellt';
			case 'edited': return '✏️ Bearbeitet';
			case 'deleted': return '🗑️ Gelöscht';
			default: return action;
		}
	}

	function close() {
		show = false;
	}
</script>

{#if show}
	<div class="modal-overlay" on:click={close} role="button" tabindex="0" on:keydown={(e) => e.key === 'Escape' && close()}>
		<div class="modal-content" on:click|stopPropagation role="dialog" tabindex="-1">
			<div class="modal-header">
				<h2>📝 Team-Notizen</h2>
				<div class="header-actions">
					<button type="button" on:click={showLogModal} class="log-btn" title="Historie anzeigen">
						📋 Log
					</button>
					<button type="button" on:click={close} class="close-btn" title="Schließen">
						✕
					</button>
				</div>
			</div>

			<div class="modal-body">
				<!-- Neue Nachricht erstellen -->
				<div class="create-section">
					<textarea
						bind:value={newMessage}
						placeholder="Neue Nachricht schreiben... (z.B. 'Komme morgen erst um 12 Uhr')"
						rows="3"
						on:keydown={(e) => e.key === 'Enter' && e.ctrlKey && handleCreate()}
					></textarea>
					<button
						type="button"
						on:click={handleCreate}
						disabled={loading || !newMessage.trim()}
						class="create-btn"
					>
						{loading ? 'Wird gesendet...' : 'Senden'}
					</button>
					<p class="hint">Tipp: Strg+Enter zum Senden</p>
				</div>

				<!-- Nachrichten-Liste -->
				<div class="messages-list">
					{#if nachrichten.length === 0}
						<p class="no-messages">Noch keine Nachrichten vorhanden.</p>
					{:else}
						{#each nachrichten as nachricht}
							<div class="message-item">
								<div class="message-header">
									<span class="message-author">{nachricht.created_by}</span>
									<span class="message-time">{formatDate(nachricht.created_at)}</span>
									{#if nachricht.edited_by}
										<span class="edited-badge" title="Bearbeitet von {nachricht.edited_by}">
											(bearbeitet)
										</span>
									{/if}
								</div>

								{#if editingId === nachricht.id}
									<!-- Edit-Modus -->
									<textarea
										bind:value={editingMessage}
										rows="3"
										class="edit-textarea"
									></textarea>
									<div class="message-actions">
										<button type="button" on:click={() => saveEdit(nachricht)} class="save-btn">
											💾 Speichern
										</button>
										<button type="button" on:click={cancelEdit} class="cancel-btn">
											Abbrechen
										</button>
									</div>
								{:else}
									<!-- Anzeige-Modus -->
									<p class="message-text">{nachricht.message}</p>
									<div class="message-actions">
										{#if nachricht.created_by === currentUsername}
											<button type="button" on:click={() => startEdit(nachricht)} class="edit-btn">
												✏️ Bearbeiten
											</button>
										{/if}
										<button type="button" on:click={() => handleDelete(nachricht)} class="delete-btn">
											🗑️ Löschen
										</button>
									</div>
								{/if}
							</div>
						{/each}
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Log Modal -->
{#if showLog}
	<div class="modal-overlay" on:click={closeLogModal} role="button" tabindex="0" on:keydown={(e) => e.key === 'Escape' && closeLogModal()}>
		<div class="modal-content log-modal" on:click|stopPropagation role="dialog" tabindex="-1">
			<div class="modal-header">
				<h2>📋 Nachrichten-Log</h2>
				<button type="button" on:click={closeLogModal} class="close-btn">
					✕
				</button>
			</div>

			<div class="modal-body">
				<div class="log-list">
					{#if logEntries.length === 0}
						<p class="no-messages">Keine Log-Einträge vorhanden.</p>
					{:else}
						{#each logEntries as entry}
							<div class="log-entry">
								<div class="log-header">
									<span class="log-action">{getActionText(entry.action)}</span>
									<span class="log-user">von {entry.performed_by}</span>
									<span class="log-time">{formatDate(entry.performed_at)}</span>
								</div>
								{#if entry.old_message}
									<p class="log-message old">Alt: {entry.old_message}</p>
								{/if}
								{#if entry.new_message}
									<p class="log-message new">Neu: {entry.new_message}</p>
								{/if}
							</div>
						{/each}
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
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
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
		width: 100%;
		max-width: 700px;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
	}

	.log-modal {
		max-width: 800px;
	}

	.modal-header {
		padding: 20px 24px;
		border-bottom: 1px solid var(--border-color);
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.modal-header h2 {
		margin: 0;
		color: var(--text-primary);
		font-size: 1.5rem;
	}

	.header-actions {
		display: flex;
		gap: 10px;
	}

	.log-btn {
		padding: 8px 16px;
		background: var(--accent-color);
		color: white;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
	}

	.log-btn:hover {
		background: var(--accent-hover);
	}

	.close-btn {
		padding: 4px 12px;
		background: transparent;
		color: var(--text-secondary);
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-size: 24px;
		line-height: 1;
	}

	.close-btn:hover {
		background: var(--border-color);
	}

	.modal-body {
		padding: 20px 24px;
		overflow-y: auto;
		flex: 1;
	}

	.create-section {
		margin-bottom: 24px;
		padding-bottom: 24px;
		border-bottom: 2px solid var(--border-color);
	}

	.create-section textarea {
		width: 100%;
		padding: 12px;
		border: 2px solid var(--border-color);
		border-radius: 8px;
		font-size: 14px;
		font-family: inherit;
		background: var(--bg-primary);
		color: var(--text-primary);
		resize: vertical;
		margin-bottom: 10px;
	}

	.create-section textarea:focus {
		outline: none;
		border-color: var(--accent-color);
	}

	.create-btn {
		width: 100%;
		padding: 12px;
		background: var(--accent-color);
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-size: 16px;
		font-weight: 600;
	}

	.create-btn:hover:not(:disabled) {
		background: var(--accent-hover);
	}

	.create-btn:disabled {
		background: #ccc;
		cursor: not-allowed;
	}

	.hint {
		margin-top: 8px;
		font-size: 12px;
		color: var(--text-secondary);
		text-align: center;
	}

	.messages-list {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.no-messages {
		text-align: center;
		color: var(--text-secondary);
		padding: 40px 20px;
		font-style: italic;
	}

	.message-item {
		padding: 16px;
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		border-radius: 8px;
	}

	.message-header {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 12px;
	}

	.message-author {
		font-weight: 600;
		color: var(--accent-color);
	}

	.message-time {
		font-size: 12px;
		color: var(--text-secondary);
	}

	.edited-badge {
		font-size: 11px;
		color: var(--text-secondary);
		font-style: italic;
	}

	.message-text {
		margin: 0 0 12px 0;
		color: var(--text-primary);
		white-space: pre-wrap;
		line-height: 1.5;
	}

	.edit-textarea {
		width: 100%;
		padding: 12px;
		border: 2px solid var(--accent-color);
		border-radius: 8px;
		font-size: 14px;
		font-family: inherit;
		background: var(--bg-secondary);
		color: var(--text-primary);
		resize: vertical;
		margin-bottom: 10px;
	}

	.message-actions {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.message-actions button {
		padding: 6px 12px;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-size: 13px;
		font-weight: 500;
	}

	.edit-btn {
		background: var(--accent-color);
		color: white;
	}

	.edit-btn:hover {
		background: var(--accent-hover);
	}

	.delete-btn {
		background: #dc3545;
		color: white;
	}

	.delete-btn:hover {
		background: #c82333;
	}

	.save-btn {
		background: #28a745;
		color: white;
	}

	.save-btn:hover {
		background: #218838;
	}

	.cancel-btn {
		background: var(--border-color);
		color: var(--text-primary);
	}

	.cancel-btn:hover {
		background: var(--text-secondary);
		color: white;
	}

	/* Log-Styles */
	.log-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.log-entry {
		padding: 12px;
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		border-radius: 8px;
	}

	.log-header {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 8px;
		flex-wrap: wrap;
	}

	.log-action {
		font-weight: 600;
		font-size: 14px;
	}

	.log-user {
		color: var(--accent-color);
		font-size: 13px;
	}

	.log-time {
		font-size: 12px;
		color: var(--text-secondary);
	}

	.log-message {
		margin: 4px 0;
		font-size: 13px;
		padding: 8px;
		border-radius: 4px;
	}

	.log-message.old {
		background: rgba(220, 53, 69, 0.1);
		color: var(--text-primary);
	}

	.log-message.new {
		background: rgba(40, 167, 69, 0.1);
		color: var(--text-primary);
	}

	@media (max-width: 768px) {
		.modal-content {
			max-height: 90vh;
		}

		.modal-header h2 {
			font-size: 1.2rem;
		}

		.header-actions {
			flex-direction: column;
			gap: 6px;
		}

		.message-actions button {
			font-size: 14px;
			padding: 8px 14px;
		}
	}
</style>
