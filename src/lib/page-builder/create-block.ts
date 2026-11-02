import { DEFAULT_FORM, newId } from './blocks';
import type { Block, BlockType, CollectionSource, FieldType } from '@/models/page-builder';

/** A new block of the given type, filled with placeholder content the admin then edits. */

export function createBlock(
  type: BlockType,
  collectionId: string | null = null,
  fieldKind: FieldType = 'text'
): Block {
  const id = newId();
  const source: CollectionSource = { kind: 'collection', collectionId };
  switch (type) {
    case 'heading':
      return { id, type, text: 'Titull i ri', level: 2 };
    case 'text':
      return { id, type, text: 'Shkruaj tekstin këtu.', tone: 'default' };
    case 'form':
      return { id, type, title: 'Shto të dhëna', source, fieldIds: [], submitLabel: 'Ruaj' };
    case 'table':
      return {
        id,
        type,
        title: 'Të dhënat',
        source,
        columnIds: [],
        allowEdit: true,
        emptyText: 'Nuk ka ende vlera në këtë tabelë.',
      };
    case 'stat':
      return { id, type, label: 'Gjithsej', source, op: 'count', fieldId: null };
    case 'button':
      return { id, type, label: 'Hap', href: '/app', variant: 'default' };
    case 'divider':
      return { id, type };
    case 'spacer':
      return { id, type, size: 'md' };
    case 'columns':
      return { id, type, layout: '1-1', columns: [[], []] };
    case 'image':
      return { id, type, src: '', alt: '', caption: '', ratio: 'auto', fit: 'cover', rounded: true };
    case 'iconbox':
      return { id, type, icon: 'star', title: 'Pse ne', text: 'Një përshkrim i shkurtër.', layout: 'top' };
    case 'alert':
      return { id, type, variant: 'info', title: 'Kujdes', text: 'Një mesazh i rëndësishëm.' };
    case 'iconlist':
      return {
        id,
        type,
        icon: 'check',
        items: [
          { id: newId(), text: 'Pika e parë' },
          { id: newId(), text: 'Pika e dytë' },
        ],
      };
    case 'tabs':
      return {
        id,
        type,
        items: [
          { id: newId(), title: 'Skeda 1', text: 'Përmbajtja e skedës së parë.' },
          { id: newId(), title: 'Skeda 2', text: 'Përmbajtja e skedës së dytë.' },
        ],
      };
    case 'accordion':
      return {
        id,
        type,
        multiple: false,
        firstOpen: true,
        items: [
          { id: newId(), title: 'Pyetja e parë?', text: 'Përgjigjja këtu.' },
          { id: newId(), title: 'Pyetja e dytë?', text: 'Përgjigjja këtu.' },
        ],
      };
    case 'toc':
      return { id, type, title: 'Në këtë faqe', depth: 3 };
    case 'testimonial':
      return {
        id,
        type,
        quote: 'Shërbim i shpejtë dhe korrekt.',
        author: 'Emri Mbiemri',
        role: 'Klient',
        rating: 5,
      };
    case 'rating':
      return { id, type, label: 'Vlerësimi', value: 4.5 };
    case 'pricetable':
      return {
        id,
        type,
        title: 'Paketa Standard',
        price: '2 500 Lekë',
        period: 'në muaj',
        features: [
          { id: newId(), text: 'Veçoria e parë', included: true },
          { id: newId(), text: 'Veçoria e dytë', included: true },
          { id: newId(), text: 'Veçoria e tretë', included: false },
        ],
        buttonLabel: 'Zgjidh',
        buttonHref: '/app',
        featured: false,
        badge: '',
      };
    case 'pricelist':
      return {
        id,
        type,
        items: [
          { id: newId(), text: 'Shërbimi i parë', description: 'Përshkrim i shkurtër', price: '1 000 Lekë' },
          { id: newId(), text: 'Shërbimi i dytë', description: 'Përshkrim i shkurtër', price: '1 500 Lekë' },
        ],
      };
    case 'cta':
      return {
        id,
        type,
        title: 'Gati për hapin tjetër?',
        text: 'Një fjali që të bind të veprosh.',
        buttonLabel: 'Fillo tani',
        buttonHref: '/app',
        tone: 'brand',
      };
    case 'flipbox':
      return {
        id,
        type,
        icon: 'zap',
        frontTitle: 'Shpejt',
        frontText: 'Kalo miun për më shumë.',
        backTitle: 'Si funksionon',
        backText: 'Shpjegimi në anën e pasme.',
        buttonLabel: 'Më shumë',
        buttonHref: '/app',
      };
    case 'countdown': {
      const inAWeek = new Date(Date.now() + 7 * 86_400_000);
      const pad = (n: number) => String(n).padStart(2, '0');
      const target = `${inAWeek.getFullYear()}-${pad(inAWeek.getMonth() + 1)}-${pad(inAWeek.getDate())}T09:00`;
      return { id, type, title: 'Afati', target, doneText: 'Afati ka kaluar.' };
    }
    case 'progress':
      return { id, type, label: 'Progresi', mode: 'static', value: 60, source, fieldId: null, target: 100000 };
    case 'field':
      return {
        id,
        type,
        source,
        fieldId: null,
        kind: fieldKind,
        form: DEFAULT_FORM,
        label: '',
        placeholder: '',
        hint: '',
      };
    case 'submit':
      return {
        id,
        type,
        source,
        form: DEFAULT_FORM,
        label: 'Dërgo',
        successText: 'U ruajt me sukses.',
        resetAfter: true,
        fullWidth: false,
      };
    case 'cards':
      return {
        id,
        type,
        title: '',
        source,
        titleFieldId: null,
        subtitleFieldId: null,
        valueFieldId: null,
        badgeFieldId: null,
        perRow: 3,
        emptyText: 'Nuk ka ende të dhëna.',
      };
  }
}
