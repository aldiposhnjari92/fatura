import * as React from 'react';
import type { BlockContext } from '@/models/page-builder-ui';

/*
  What a block on the page can reach: its collection, the page's rows, the
  shared values of element-built forms, and whether writes are switched off
  (the editor canvas and the admin's preview).
*/
const Ctx = React.createContext<BlockContext | null>(null);
export const BlockContextProvider = Ctx.Provider;

export function useBlockContext(): BlockContext {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error('BlockView rendered outside a BlockContextProvider');
  return ctx;
}
