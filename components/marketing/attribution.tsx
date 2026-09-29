'use client'

import { useEffect } from 'react'

// BR-L2/L3: first-touch attribution for the visit. The landing URL's UTM/click ids are remembered
// for the session, so a visitor who lands on /hotels from an ad and enquires three pages later is
// still attributed to that ad. The server keeps only the allow-listed keys (lib/services/enquiry).
const KEY = 'redux.attribution'

type Stored = { params: Record<string, string>; landingPage: string; referrer: string }

export function AttributionCapture() {
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(KEY)) return
      const params: Record<string, string> = {}
      new URLSearchParams(window.location.search).forEach((v, k) => {
        if (k.startsWith('utm_') || k === 'gclid' || k === 'fbclid') params[k] = v
      })
      const stored: Stored = {
        params,
        landingPage: window.location.pathname + window.location.search,
        referrer: document.referrer,
      }
      window.sessionStorage.setItem(KEY, JSON.stringify(stored))
    } catch {
      // storage blocked (private mode) — attribution falls back to the current page at submit
    }
  }, [])
  return null
}

export function readAttribution() {
  let stored: Partial<Stored> = {}
  try {
    stored = JSON.parse(window.sessionStorage.getItem(KEY) ?? '{}') as Partial<Stored>
  } catch {
    stored = {}
  }
  const current: Record<string, string> = {}
  new URLSearchParams(window.location.search).forEach((v, k) => {
    if (k.startsWith('utm_') || k === 'gclid' || k === 'fbclid') current[k] = v
  })
  return {
    params: { ...current, ...(stored.params ?? {}) },
    landingPage: stored.landingPage ?? window.location.pathname,
    referrer: stored.referrer ?? document.referrer,
    formPage: window.location.pathname,
  }
}
