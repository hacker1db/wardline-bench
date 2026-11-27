<script lang="ts">
	import { buildModel, axisMetrics, metricOf, pct } from '#lib/bench.ts';
	import Drill from '#lib/Drill.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	// Data is fixed per request (server load), so reading it once is intended.
	// svelte-ignore state_referenced_locally
	const { series, categories, dates, hasDemo, generated } = buildModel(data.index);

	const W = 760;
	const H = 340;
	const PAD = { l: 44, r: 16, t: 16, b: 34 };

	let metric = $state('overall');
	let hidden = $state<Set<string>>(new Set());
	let hoverX = $state<number | null>(null);
	let focusModel = $state<string | null>(null);
	let pinned = $state<string | null>(null);
	let drill = $state<{ model: string; category: string | null } | null>(null);

	const drillSeries = $derived(drill ? series.find((s) => s.model === drill!.model) : null);
	// A pinned date shows only runs from that date; a model with no run then shows "no run".
	const runAt = (s: (typeof series)[number]) => (pinned ? (s.runs.find((r) => r.date === pinned) ?? null) : (s.runs.at(-1) ?? null));
	const drillRun = $derived(drillSeries ? runAt(drillSeries) : null);

	const t0 = dates.length ? Date.parse(dates[0]) : 0;
	const t1 = dates.length > 1 ? Date.parse(dates[dates.length - 1]) : t0 + 1;
	const x = (d: string) => PAD.l + ((Date.parse(d) - t0) / (t1 - t0)) * (W - PAD.l - PAD.r);
	const y = (v: number) => PAD.t + (1 - v) * (H - PAD.t - PAD.b);
	const fmtDate = (d: string) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });

	const visible = $derived(series.filter((s) => !hidden.has(s.model)));

	const points = (runs: typeof series[number]['runs']) =>
		runs
			.map((r) => ({ d: r.date, v: metricOf(r, metric) }))
			.filter((p): p is { d: string; v: number } => p.v != null);

	const pathOf = (pts: { d: string; v: number }[]) =>
		pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.d).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');

	const latest = (s: (typeof series)[number]) => {
		const pts = points(s.runs);
		return { last: pts.at(-1)?.v ?? null, first: pts[0]?.v ?? null };
	};

	const ranked = $derived(
		[...series].sort((a, b) => (latest(b).last ?? -1) - (latest(a).last ?? -1))
	);

	const hoverDate = $derived.by(() => {
		if (hoverX == null || !dates.length) return null;
		return dates.reduce((best, d) => (Math.abs(x(d) - hoverX!) < Math.abs(x(best) - hoverX!) ? d : best));
	});

	const readDate = $derived(hoverDate ?? pinned);

	function toggle(model: string) {
		const next = new Set(hidden);
		next.has(model) ? next.delete(model) : next.add(model);
		hidden = next;
	}

	function onKey(e: KeyboardEvent) {
		const i = pinned ? dates.indexOf(pinned) : dates.length;
		if (e.key === 'ArrowLeft') pinned = dates[Math.max(0, i - 1)];
		else if (e.key === 'ArrowRight') pinned = i + 1 >= dates.length ? null : dates[i + 1];
		else if (e.key === 'Escape') pinned = null;
		else return;
		e.preventDefault();
	}

	function onMove(e: PointerEvent) {
		const svg = e.currentTarget as SVGSVGElement;
		const rect = svg.getBoundingClientRect();
		hoverX = ((e.clientX - rect.left) / rect.width) * W;
	}

	const cellTone = (v: number | null) =>
		v == null ? 'transparent' : `color-mix(in srgb, var(--signal) ${Math.round(v * 70)}%, var(--panel))`;
</script>

<div class="shell">
	<aside class="rail" aria-label="Models">
		<header class="brand">
			<span class="mark">WL/</span>
			<h1>Wardline<br /><em>Bench</em></h1>
		</header>

		<p class="rail-label">Ranked by latest {metric} · Δ since first run</p>
		<ul class="models">
			{#each ranked as s (s.model)}
				{@const l = latest(s)}
				{@const delta = l.last != null && l.first != null ? l.last - l.first : null}
				<li>
					<button
						class="model"
						class:off={hidden.has(s.model)}
						aria-pressed={!hidden.has(s.model)}
						onclick={() => toggle(s.model)}
						onpointerenter={() => (focusModel = s.model)}
						onpointerleave={() => (focusModel = null)}
						onfocus={() => (focusModel = s.model)}
						onblur={() => (focusModel = null)}
						style="--c:{s.color}"
					>
						<span class="swatch" aria-hidden="true"></span>
						<span class="who">
							<span class="name">{s.name}</span>
							<span class="prov">{s.provider} · {s.runs.length} runs</span>
						</span>
						<span class="score">{pct(l.last)}</span>
						<span class="delta" class:up={delta != null && delta > 0} class:down={delta != null && delta < 0}>
							{delta == null ? '' : `${delta > 0 ? '+' : ''}${Math.round(delta * 100)}`}
						</span>
					</button>
				</li>
			{/each}
		</ul>

		<footer class="rail-foot">
			<span>suite wardline-core</span>
			<a href="/auth/logout" data-sveltekit-reload>sign out</a>
			<span>index {fmtDate(generated)}</span>
		</footer>
	</aside>

	<main>
		{#if hasDemo}
			<p class="demo" role="note">Demo data. These scores are synthetic.</p>
		{/if}

		<section class="chart-block">
			<div class="chart-head">
				<h2>Score over time <span class="unit">/100</span></h2>
				<div class="metric-groups">
					{#each [['score', ['overall', ...axisMetrics]], ['category', categories]] as [label, list]}
						<div class="metrics" role="group" aria-label="{label} metric">
							<span class="group-label">{label}</span>
							{#each list as m}
								<button aria-pressed={metric === m} class:on={metric === m} onclick={() => (metric = m as string)}>
									{m}
								</button>
							{/each}
						</div>
					{/each}
				</div>
			</div>

			<div class="chart">
				<svg
					viewBox="0 0 {W} {H}"
					role="slider"
					tabindex="0"
					aria-label="Score over time for {visible.length} models. Arrow keys pin a run date."
					aria-valuemin={0}
					aria-valuemax={dates.length - 1}
					aria-valuenow={pinned ? dates.indexOf(pinned) : dates.length - 1}
					aria-valuetext={pinned ? fmtDate(pinned) : 'latest'}
					onpointermove={onMove}
					onpointerleave={() => (hoverX = null)}
					onclick={() => hoverDate && (pinned = pinned === hoverDate ? null : hoverDate)}
					onkeydown={onKey}
				>
					{#if pinned}
						<line class="pin" x1={x(pinned)} x2={x(pinned)} y1={PAD.t} y2={H - PAD.b} />
					{/if}
					{#each [0, 0.25, 0.5, 0.75, 1] as g}
						<line class="grid" x1={PAD.l} x2={W - PAD.r} y1={y(g)} y2={y(g)} />
						<text class="axis" x={PAD.l - 8} y={y(g) + 4} text-anchor="end">{g * 100}</text>
					{/each}
					{#each dates as d, i}
						{#if i % Math.ceil(dates.length / 6) === 0 || i === dates.length - 1}
							<text class="axis" x={x(d)} y={H - 10} text-anchor="middle">{fmtDate(d)}</text>
						{/if}
					{/each}

					{#if hoverDate}
						<line class="cursor" x1={x(hoverDate)} x2={x(hoverDate)} y1={PAD.t} y2={H - PAD.b} />
					{/if}

					{#each visible as s (s.model)}
						{@const pts = points(s.runs)}
						<path
							d={pathOf(pts)}
							class="line"
							class:dim={focusModel && focusModel !== s.model}
							style="stroke:{s.color}"
						/>
						{#each pts as p}
							{#if p.d === hoverDate}
								<circle cx={x(p.d)} cy={y(p.v)} r="4.5" fill={s.color} class="dot" />
							{/if}
						{/each}
						{#if pts.length}
							{@const end = pts[pts.length - 1]}
							<circle cx={x(end.d)} cy={y(end.v)} r="3" fill={s.color} />
							{#if focusModel === s.model}
								<text class="end-label" x={x(end.d) - 8} y={y(end.v) - 10} text-anchor="end" fill={s.color}>{s.name} {pct(end.v)}</text>
							{/if}
						{/if}
					{/each}
				</svg>

				{#if readDate}
					{@const frac = x(readDate) / W}
					<div class="readout" class:flip={frac > 0.6} style="left:{frac * 100}%" aria-live="polite">
						<strong>{fmtDate(readDate)}{readDate === pinned ? ' · pinned' : ''}</strong>
						{#each visible as s}
							{@const r = s.runs.find((r) => r.date === readDate)}
							<span style="--c:{s.color}"><i></i>{s.name}<b>{r ? pct(metricOf(r, metric)) : 'no run'}</b></span>
						{/each}
					</div>
				{/if}
			</div>
		</section>

		<section class="matrix-block">
			<div class="chart-head">
				<h2>{pinned ? `Run of ${fmtDate(pinned)}` : 'Latest run'} by category</h2>
				<p class="hint">
					{pinned ? 'Click the chart again to unpin.' : 'Click the chart to pin a date.'} Click a cell to see how the model got its answer.
				</p>
			</div>
			<div class="matrix-scroll">
				<table>
					<thead>
						<tr>
							<th scope="col">model</th>
							{#each categories as c}<th scope="col">{c}</th>{/each}
							<th scope="col">overall</th>
						</tr>
					</thead>
					<tbody>
						{#each ranked as s (s.model)}
							{@const r = runAt(s)}
							<tr class:off={hidden.has(s.model)}>
								<th scope="row"><i style="background:{s.color}"></i>{s.name}</th>
								{#each [...categories, null] as c}
									{@const v = c ? (r?.categories[c] ?? null) : (r?.overall ?? null)}
									{@const active = drill?.model === s.model && drill?.category === c}
									<td class:ov={!c} style="background:{c ? cellTone(v) : 'transparent'}">
										{#if r}
											<button
												class="cell"
												class:active
												aria-expanded={active}
												aria-controls="drill"
												aria-label="{s.name}, {c ?? 'overall'}: {pct(v)}. Show tasks."
												onclick={() => (drill = active ? null : { model: s.model, category: c })}
											>
												{pct(v)}
											</button>
										{:else}
											<span class="norun">no run</span>
										{/if}
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>

		{#if drill && drillSeries && drillRun}
			<Drill
				name={drillSeries.name}
				color={drillSeries.color}
				run={drillRun}
				category={drill.category}
				onclose={() => (drill = null)}
			/>
		{/if}
	</main>
</div>

<style>
	.shell {
		display: grid;
		grid-template-columns: 300px 1fr;
		min-height: 100vh;
	}

	.rail {
		border-right: 1px solid var(--rule);
		background: var(--panel);
		padding: 28px 0 20px;
		display: flex;
		flex-direction: column;
		position: sticky;
		top: 0;
		height: 100vh;
	}

	.brand {
		padding: 0 24px 28px;
		display: flex;
		gap: 12px;
		align-items: flex-start;
	}
	.mark {
		color: var(--signal);
		font-weight: 500;
		padding-top: 6px;
	}
	h1 {
		font-family: var(--serif);
		font-weight: 600;
		font-size: 34px;
		line-height: 0.95;
		margin: 0;
		letter-spacing: -0.02em;
	}
	h1 em {
		font-weight: 400;
		color: var(--ink-dim);
	}

	.rail-label {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink-dim);
		padding: 0 24px;
		margin: 0 0 8px;
	}

	.models {
		list-style: none;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		flex: 1;
	}

	.model {
		all: unset;
		box-sizing: border-box;
		width: 100%;
		display: grid;
		grid-template-columns: 10px 1fr auto 34px;
		gap: 12px;
		align-items: center;
		padding: 12px 24px;
		border-top: 1px solid var(--rule);
		cursor: pointer;
	}
	.model:hover {
		background: color-mix(in srgb, var(--c) 8%, transparent);
	}
	.model:focus-visible {
		outline: 2px solid var(--signal);
		outline-offset: -2px;
	}
	.swatch {
		width: 10px;
		height: 10px;
		background: var(--c);
	}
	.model.off .swatch {
		background: transparent;
		box-shadow: inset 0 0 0 1px var(--c);
	}
	.model.off .name,
	.model.off .score {
		color: var(--ink-dim);
		text-decoration: line-through;
	}
	.who {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.prov {
		font-size: 11px;
		color: var(--ink-dim);
	}
	.score {
		font-family: var(--serif);
		font-size: 22px;
		font-variant-numeric: tabular-nums;
	}
	.delta {
		font-size: 11px;
		text-align: right;
		color: var(--ink-dim);
	}
	.delta.up {
		color: var(--good);
	}
	.delta.down {
		color: var(--bad);
	}

	.rail-foot a {
		color: inherit;
	}
	.rail-foot {
		display: flex;
		justify-content: space-between;
		padding: 14px 24px 0;
		border-top: 1px solid var(--rule);
		font-size: 11px;
		color: var(--ink-dim);
	}

	main {
		padding: 32px 40px 48px;
		min-width: 0;
	}

	.demo {
		margin: 0 0 24px;
		padding: 8px 12px;
		border-left: 3px solid var(--signal);
		background: color-mix(in srgb, var(--signal) 10%, transparent);
		font-size: 12px;
	}

	h2 {
		font-family: var(--serif);
		font-weight: 400;
		font-size: 24px;
		margin: 0;
	}
	.unit {
		font-family: var(--mono);
		font-size: 12px;
		color: var(--ink-dim);
	}

	.chart-head {
		display: flex;
		justify-content: space-between;
		align-items: end;
		flex-wrap: wrap;
		gap: 12px;
		margin-bottom: 16px;
	}
	.metric-groups {
		display: flex;
		flex-direction: column;
		gap: 6px;
		align-items: flex-end;
	}
	.metrics {
		display: flex;
		flex-wrap: wrap;
		border: 1px solid var(--rule);
	}
	.group-label {
		padding: 6px 10px;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink-dim);
		border-right: 1px solid var(--rule);
	}
	.hint {
		margin: 0;
		font-size: 12px;
		color: var(--ink-dim);
	}
	.pin {
		stroke: var(--signal);
		stroke-dasharray: 4 3;
	}
	.cell {
		all: unset;
		cursor: pointer;
		display: block;
		width: 100%;
		text-align: right;
	}
	.cell:hover,
	.cell.active {
		text-decoration: underline;
		text-underline-offset: 4px;
	}
	.cell.active {
		outline: 2px solid var(--ink);
		outline-offset: 6px;
		text-decoration: none;
	}
	.norun {
		color: var(--ink-dim);
		font-size: 11px;
	}
	.end-label {
		font-family: var(--mono);
		font-size: 12px;
		paint-order: stroke;
		stroke: var(--panel);
		stroke-width: 4px;
	}
	.readout.flip {
		transform: translateX(calc(-100% - 12px));
	}
	.cell:focus-visible {
		outline: 2px solid var(--signal);
		outline-offset: 4px;
	}
	.metrics button {
		background: none;
		border: 0;
		border-right: 1px solid var(--rule);
		padding: 6px 10px;
		font-size: 12px;
		color: var(--ink-dim);
		cursor: pointer;
	}
	.metrics button:last-child {
		border-right: 0;
	}
	.metrics button.on {
		background: var(--ink);
		color: var(--bg);
	}

	.chart {
		position: relative;
		border: 1px solid var(--rule);
		background: var(--panel);
	}
	svg {
		display: block;
		width: 100%;
		height: auto;
		touch-action: none;
	}
	.grid {
		stroke: var(--rule);
		stroke-dasharray: 2 4;
	}
	.axis {
		fill: var(--ink-dim);
		font-size: 11px;
		font-family: var(--mono);
	}
	.cursor {
		stroke: var(--ink-dim);
	}
	.line {
		fill: none;
		stroke-width: 2;
		transition: opacity 150ms;
	}
	.line.dim {
		opacity: 0.15;
	}
	.dot {
		stroke: var(--panel);
		stroke-width: 2;
	}

	.readout {
		position: absolute;
		top: 12px;
		transform: translateX(12px);
		background: var(--bg);
		border: 1px solid var(--rule);
		padding: 8px 10px;
		font-size: 12px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		pointer-events: none;
		min-width: 180px;
	}
	.readout span {
		display: grid;
		grid-template-columns: 8px 1fr auto;
		gap: 8px;
		align-items: center;
	}
	.readout i {
		width: 8px;
		height: 8px;
		background: var(--c);
	}

	.matrix-block {
		margin-top: 40px;
	}
	.matrix-block h2 {
		margin-bottom: 16px;
	}
	.matrix-scroll {
		overflow-x: auto;
		border: 1px solid var(--rule);
	}
	table {
		border-collapse: collapse;
		width: 100%;
		font-variant-numeric: tabular-nums;
	}
	th,
	td {
		padding: 10px 12px;
		border-bottom: 1px solid var(--rule);
		text-align: right;
		white-space: nowrap;
	}
	thead th {
		font-weight: 400;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--ink-dim);
	}
	th[scope='row'],
	thead th:first-child {
		text-align: left;
	}
	th[scope='row'] i {
		display: inline-block;
		width: 8px;
		height: 8px;
		margin-right: 10px;
	}
	td.ov {
		font-family: var(--serif);
		font-size: 18px;
	}
	tr.off {
		opacity: 0.4;
	}

	@media (max-width: 860px) {
		.shell {
			grid-template-columns: 1fr;
		}
		.rail {
			position: static;
			height: auto;
		}
		main {
			padding: 24px 16px 40px;
		}
		.readout,
		.readout.flip {
			position: static;
			transform: none;
			border-width: 1px 0 0;
		}
		.axis {
			font-size: 22px;
		}
	}
</style>
