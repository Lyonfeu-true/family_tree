import type { BuiltinRelationshipType, RelationshipKind } from '@domain/family/Relationship';

export type LineStyle = 'solid' | 'dashed' | 'dotted' | 'dashdot';

export interface RelationshipStyle {
  readonly color: string;
  readonly lineStyle: LineStyle;
  /** SVG stroke-dasharray, or null for solid lines. */
  readonly dashArray: string | null;
}

const DASH: Readonly<Record<LineStyle, string | null>> = {
  solid: null,
  dashed: '9 5',
  dotted: '2 5',
  dashdot: '10 4 2 4',
};

const style = (color: string, lineStyle: LineStyle): RelationshipStyle => ({
  color,
  lineStyle,
  dashArray: DASH[lineStyle],
});

/**
 * Every colour has at least 4.5:1 contrast against the canvas background (#FAFAF8).
 * Within each line style, colours stay distinguishable under simulated protan, deutan
 * and tritan vision. Family = solid, romantic = dashed, other = dotted, custom = dash-dot.
 * Edge labels are the additional non-colour cue.
 */
export const BUILTIN_RELATIONSHIP_STYLES: Readonly<
  Record<BuiltinRelationshipType, RelationshipStyle>
> = {
  father: style('#08306B', 'solid'),
  son: style('#0072B2', 'solid'),
  mother: style('#8E1B52', 'solid'),
  daughter: style('#B35900', 'solid'),
  brother: style('#4A6572', 'solid'),
  sister: style('#5E35B1', 'solid'),
  married: style('#B71C1C', 'dashed'),
  engaged: style('#7B1FA2', 'dashed'),
  relationship: style('#2E7D32', 'dashed'),
  former_relationship: style('#6B6B6B', 'dashed'),
  divorced: style('#1A1A1A', 'dashed'),
  other: style('#7A4B1F', 'dotted'),
};

export const DEFAULT_CUSTOM_RELATIONSHIP_COLOR = '#1F4FBF';

export function getRelationshipStyle(kind: RelationshipKind): RelationshipStyle {
  if (kind.kind === 'builtin') return BUILTIN_RELATIONSHIP_STYLES[kind.type];
  return style(kind.colorHex ?? DEFAULT_CUSTOM_RELATIONSHIP_COLOR, 'dashdot');
}
