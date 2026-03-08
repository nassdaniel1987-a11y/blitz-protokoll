<script>
	export let variant = 'dashboard'; // 'dashboard', 'edit', 'table'
</script>

<div class="skeleton-container">
	{#if variant === 'dashboard'}
		<!-- Dashboard Skeleton -->
		<div class="skeleton-header">
			<div class="skeleton-line skeleton-title"></div>
			<div class="skeleton-line skeleton-subtitle"></div>
		</div>
		<div class="skeleton-actions">
			<div class="skeleton-btn"></div>
			<div class="skeleton-btn"></div>
			<div class="skeleton-btn short"></div>
		</div>
		<div class="skeleton-cards">
			<div class="skeleton-card"></div>
			<div class="skeleton-card"></div>
			<div class="skeleton-card"></div>
		</div>
		<div class="skeleton-section">
			<div class="skeleton-line skeleton-section-title"></div>
			<div class="skeleton-line full"></div>
			<div class="skeleton-line full"></div>
			<div class="skeleton-line medium"></div>
		</div>
		<div class="skeleton-table">
			<div class="skeleton-table-header"></div>
			<div class="skeleton-table-row"></div>
			<div class="skeleton-table-row"></div>
			<div class="skeleton-table-row"></div>
			<div class="skeleton-table-row"></div>
		</div>
	{:else if variant === 'edit'}
		<!-- Edit Page Skeleton -->
		<div class="skeleton-header">
			<div class="skeleton-line skeleton-title"></div>
			<div class="skeleton-line skeleton-subtitle"></div>
		</div>
		<div class="skeleton-form-section">
			<div class="skeleton-line skeleton-label"></div>
			<div class="skeleton-input"></div>
			<div class="skeleton-line skeleton-label"></div>
			<div class="skeleton-input"></div>
		</div>
		<div class="skeleton-table">
			<div class="skeleton-table-header"></div>
			<div class="skeleton-table-row tall"></div>
			<div class="skeleton-table-row tall"></div>
			<div class="skeleton-table-row tall"></div>
		</div>
	{:else if variant === 'table'}
		<!-- Table Skeleton -->
		<div class="skeleton-table">
			<div class="skeleton-table-header"></div>
			<div class="skeleton-table-row"></div>
			<div class="skeleton-table-row"></div>
			<div class="skeleton-table-row"></div>
			<div class="skeleton-table-row"></div>
			<div class="skeleton-table-row"></div>
		</div>
	{/if}
</div>

<style>
	.skeleton-container {
		padding: 20px;
	}

	/* Shimmer Animation */
	@keyframes shimmer {
		0% {
			background-position: -400px 0;
		}
		100% {
			background-position: 400px 0;
		}
	}

	/* Base skeleton element */
	.skeleton-line,
	.skeleton-btn,
	.skeleton-card,
	.skeleton-input,
	.skeleton-table-header,
	.skeleton-table-row {
		background: linear-gradient(
			90deg,
			var(--border-color) 25%,
			var(--bg-primary) 37%,
			var(--border-color) 63%
		);
		background-size: 800px 100%;
		animation: shimmer 1.5s ease-in-out infinite;
		border-radius: var(--radius-sm, 6px);
	}

	/* Header */
	.skeleton-header {
		margin-bottom: 24px;
	}

	.skeleton-title {
		height: 32px;
		width: 280px;
		margin-bottom: 12px;
		border-radius: var(--radius-md, 8px);
	}

	.skeleton-subtitle {
		height: 18px;
		width: 180px;
	}

	/* Actions */
	.skeleton-actions {
		display: flex;
		gap: 12px;
		margin-bottom: 24px;
	}

	.skeleton-btn {
		height: 42px;
		width: 140px;
		border-radius: var(--radius-md, 8px);
	}

	.skeleton-btn.short {
		width: 100px;
	}

	/* Cards */
	.skeleton-cards {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 16px;
		margin-bottom: 28px;
	}

	.skeleton-card {
		height: 80px;
		border-radius: var(--radius-lg, 12px);
	}

	/* Section */
	.skeleton-section {
		margin-bottom: 28px;
	}

	.skeleton-section-title {
		height: 24px;
		width: 200px;
		margin-bottom: 16px;
	}

	.skeleton-line.full {
		height: 16px;
		width: 100%;
		margin-bottom: 10px;
	}

	.skeleton-line.medium {
		height: 16px;
		width: 65%;
		margin-bottom: 10px;
	}

	/* Labels & Inputs */
	.skeleton-label {
		height: 16px;
		width: 120px;
		margin-bottom: 8px;
	}

	.skeleton-input {
		height: 46px;
		width: 100%;
		margin-bottom: 20px;
		border-radius: var(--radius-md, 8px);
	}

	/* Form Section */
	.skeleton-form-section {
		margin-bottom: 28px;
	}

	/* Table */
	.skeleton-table {
		margin-bottom: 20px;
	}

	.skeleton-table-header {
		height: 48px;
		width: 100%;
		margin-bottom: 4px;
		border-radius: var(--radius-md, 8px) var(--radius-md, 8px) 0 0;
	}

	.skeleton-table-row {
		height: 52px;
		width: 100%;
		margin-bottom: 2px;
		border-radius: 0;
	}

	.skeleton-table-row.tall {
		height: 72px;
	}

	.skeleton-table-row:last-child {
		border-radius: 0 0 var(--radius-md, 8px) var(--radius-md, 8px);
	}

	@media (max-width: 768px) {
		.skeleton-cards {
			grid-template-columns: 1fr;
		}

		.skeleton-actions {
			flex-wrap: wrap;
		}
	}
</style>
