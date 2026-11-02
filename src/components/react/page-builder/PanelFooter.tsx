import { Layers, Loader2, Monitor, Redo2, Save, Settings, Smartphone, Tablet, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/react/button';
import { FooterButton } from './BuilderButtons';
import type { PanelFooterProps } from '@/models/page-builder-ui';

/** Elementor's footer: page settings, navigator, history, devices, save. */
export default function PanelFooter({
  panel,
  onPanel,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  device,
  onDevice,
  saving,
  dirty,
  published,
  onSave,
}: PanelFooterProps) {
  return (
    <div className="bg-muted/60 flex shrink-0 items-center gap-0.5 border-t p-1.5">
      <FooterButton
        label="Cilësimet e faqes"
        active={panel === 'page'}
        onClick={() => onPanel(panel === 'page' ? 'widgets' : 'page')}
      >
        <Settings />
      </FooterButton>
      <FooterButton
        label="Navigatori"
        active={panel === 'navigator'}
        onClick={() => onPanel(panel === 'navigator' ? 'widgets' : 'navigator')}
      >
        <Layers />
      </FooterButton>
      <FooterButton label="Zhbëj (Ctrl+Z)" disabled={!canUndo} onClick={onUndo}>
        <Undo2 />
      </FooterButton>
      <FooterButton label="Ribëj (Ctrl+Y)" disabled={!canRedo} onClick={onRedo}>
        <Redo2 />
      </FooterButton>
      <span className="bg-border mx-0.5 h-5 w-px" />
      <FooterButton label="Kompjuter" active={device === 'desktop'} onClick={() => onDevice('desktop')}>
        <Monitor />
      </FooterButton>
      <FooterButton label="Tablet" active={device === 'tablet'} onClick={() => onDevice('tablet')}>
        <Tablet />
      </FooterButton>
      <FooterButton label="Telefon" active={device === 'mobile'} onClick={() => onDevice('mobile')}>
        <Smartphone />
      </FooterButton>
      <Button size="sm" className="ml-auto h-8" onClick={onSave} disabled={saving || !dirty}>
        {saving ? <Loader2 className="animate-spin" /> : <Save />}
        {dirty ? (published ? 'Përditëso' : 'Ruaj') : 'E ruajtur'}
      </Button>
    </div>
  );
}
