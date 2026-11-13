/**
 * @file Source layout views: accordion sections and horizontal page containers.
 * @remarks Page state is local presentation state; it never changes source values.
 */
import { useState } from 'react';
import { RenderView, type RenderContext } from './renderer';
import { textValue, viewColor } from './view-support';
import { it } from './it';

/** Render source children, preserving their own ids and failures. */
function children(items: unknown, context: RenderContext) {
	if (!Array.isArray(items)) throw new Error('Lista di componenti non valida');
	return items.map((v, i) => <RenderView key={String((v as { id?: string }).id ?? i)} input={v} context={context} />);
}

/** Source `collapsible`: accordion with a title, optional subtitle and subviews. */
export function SourceCollapsible({ node: v, context, evaluate }: {
	node: Record<string, unknown>; context: RenderContext; evaluate: (value: unknown) => unknown;
}) {
	const title = v.title == null ? '' : textValue(evaluate(v.title));
	const subtitle = v.subtitle == null ? '' : textValue(evaluate(v.subtitle));
	return <details className="source-collapsible" open={v.start_expanded === true}>
		<summary>
			<strong>{title}</strong>
			{subtitle && <span className="muted">{subtitle}</span>}
		</summary>
		<div className="view-list">{children(v.subviews, context)}</div>
	</details>;
}

/** Source `viewPager`: one visible page at a time with source page names. */
export function SourceViewPager({ node: v, context, evaluate }: {
	node: Record<string, unknown>; context: RenderContext; evaluate: (value: unknown) => unknown;
}) {
	const [page, setPage] = useState(0);
	if (!Array.isArray(v.subviews)) throw new Error('Viste delle pagine richieste');
	const rawNames = evaluate(v.names);
	if (!Array.isArray(rawNames) || rawNames.some(name => typeof name !== 'string'))
		throw new Error('I nomi delle pagine devono essere una lista di testi');
	if (rawNames.length !== v.subviews.length) throw new Error('Nomi e pagine non coincidono');
	const names = rawNames as string[];
	const color = viewColor(v.color, evaluate);
	const index = Math.min(page, names.length - 1);
	return <div className="source-pager">
		<div role="tablist" aria-label={it.pages} className="source-pager-tabs" style={{ borderColor: color }}>
			{names.map((name, i) => <button key={`${name}:${i}`} type="button" role="tab" aria-selected={i === index}
				className="source-pager-tab" style={{ borderColor: i === index ? color : undefined }}
				onClick={() => setPage(i)}>{name}</button>)}
		</div>
		<div role="tabpanel" className="view-list">
			{index >= 0 && <RenderView input={(v.subviews as unknown[])[index]} context={context} />}
		</div>
	</div>;
}
