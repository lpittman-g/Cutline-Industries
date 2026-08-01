import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

type Props = {
  slot?: string
  format?: string
  fullWidth?: boolean
}

/**
 * Renders a Google AdSense unit when VITE_ADSENSE_CLIENT + VITE_ADSENSE_SLOT are set.
 * Safe no-op in local/dev until publisher IDs exist.
 */
export function AdSlot({ slot, format = 'auto', fullWidth = true }: Props) {
  const client = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined
  const resolvedSlot = slot || (import.meta.env.VITE_ADSENSE_SLOT as string | undefined)
  const pushed = useRef(false)

  useEffect(() => {
    if (!client || !resolvedSlot || pushed.current) return
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
      pushed.current = true
    } catch {
      // ignore until AdSense script/ids are live
    }
  }, [client, resolvedSlot])

  if (!client || !resolvedSlot) {
    return (
      <div className="ad-placeholder">
        AdSense slot ready — set <code>VITE_ADSENSE_CLIENT</code> + <code>VITE_ADSENSE_SLOT</code>
      </div>
    )
  }

  return (
    <ins
      className="adsbygoogle"
      style={{ display: 'block' }}
      data-ad-client={client}
      data-ad-slot={resolvedSlot}
      data-ad-format={format}
      data-full-width-responsive={fullWidth ? 'true' : 'false'}
    />
  )
}
