import ContentWidgetFields from './ContentWidgetFields';
import DataWidgetFields from './DataWidgetFields';
import MarketingWidgetFields from './MarketingWidgetFields';
import type { LeafBlock } from '@/models/page-builder';
import type { WidgetInspectorProps } from '@/models/page-builder-ui';

/*
  Përmbajtja tab for the richer widgets (see Widgets.tsx). Split from
  BlockInspector so neither file is a wall of switch cases; each palette
  group's widgets have their own file, and the controls they share live in
  widget-controls.tsx.
*/

export const WIDGET_TYPES = new Set<LeafBlock['type']>([
  'image',
  'iconlist',
  'alert',
  'iconbox',
  'tabs',
  'accordion',
  'toc',
  'testimonial',
  'rating',
  'pricetable',
  'pricelist',
  'cta',
  'flipbox',
  'countdown',
  'progress',
  'cards',
]);

export default function WidgetInspector(props: WidgetInspectorProps) {
  switch (props.block.type) {
    case 'image':
    case 'iconlist':
    case 'alert':
    case 'iconbox':
    case 'tabs':
    case 'accordion':
    case 'toc':
    case 'testimonial':
    case 'rating':
      return <ContentWidgetFields {...props} />;
    case 'pricetable':
    case 'pricelist':
    case 'cta':
    case 'flipbox':
    case 'countdown':
      return <MarketingWidgetFields {...props} />;
    case 'progress':
    case 'cards':
      return <DataWidgetFields {...props} />;
    default:
      return null;
  }
}
