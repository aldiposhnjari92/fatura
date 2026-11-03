import * as React from 'react';
import { supabase } from '@/lib/supabase';
import { flashToast } from '@/lib/toast';

/*
  Back from Dodo's checkout (?pagesa=kthim). The plan is activated by Dodo's
  webhook, not by this redirect, and the two race: the customer usually lands
  a second or two before the confirmation does. So the page says it is
  waiting and checks the latest card payment every few seconds; once it is
  confirmed, it reloads into the active plan. If it takes longer than that,
  the message says so instead of spinning forever.
*/

const EVERY_MS = 3000;
const TRIES = 20;

export type DodoReturnState = 'idle' | 'waiting' | 'slow';

export function useDodoReturn(): DodoReturnState {
  const [state, setState] = React.useState<DodoReturnState>('idle');

  React.useEffect(() => {
    if (new URLSearchParams(window.location.search).get('pagesa') !== 'kthim') return;
    setState('waiting');

    let tries = 0;
    let timer: number | undefined;
    let stopped = false;

    async function check() {
      tries += 1;
      const { data } = await supabase
        .from('payments')
        .select('status')
        .eq('method', 'card')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (stopped) return;
      if (data?.status === 'confirmed') {
        flashToast('success', 'Pagesa u krye.', 'Plani u aktivizua — faleminderit!');
        window.location.replace('/app/abonimi');
        return;
      }
      if (tries >= TRIES) {
        setState('slow');
        return;
      }
      timer = window.setTimeout(check, EVERY_MS);
    }

    check();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, []);

  return state;
}
