/*
  The JavaScript side of <NavigationProgress />.

  Link clicks and form submits are picked up by delegation, so nothing has to
  call this for them. What the delegate cannot see is a navigation started from
  code — `window.location.assign(...)` after a save, a reload after a delete —
  and those are exactly the slow ones, because they follow a request the user
  has already waited on. Calling `startNavProgress()` immediately before the
  assignment gives that wait the same bar every other navigation gets.

  The bar itself lives in the document, not in React: it has to survive the
  island that raised it being torn down by the page load.
*/

/**
 * Raise the navigation indicator. Pass the control that triggered it — the
 * button that was pressed — to have that control show a pending state too.
 */
export function startNavProgress(el?: Element | null) {
  window.__navProgress?.start(el ?? null);
}

