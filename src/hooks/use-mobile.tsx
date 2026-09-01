import * as React from "react"

/*
  1024, not shadcn's 768.

  The app's rail is `lg` and up; below it the phone layout is a bottom tab bar
  and a floating compose button, which is what handles navigation there. This
  is the width at which the sidebar hands over, so it has to line up with the
  `lg` breakpoint the rest of the shell switches on.
*/
const MOBILE_BREAKPOINT = 1024

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
