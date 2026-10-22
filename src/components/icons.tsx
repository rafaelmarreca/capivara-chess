import type { SVGProps } from 'react'

const base = (props: SVGProps<SVGSVGElement>) => ({
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...props,
})

export const IconFirst = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M18 6l-6 6 6 6M7 6v12" /></svg>
)
export const IconPrev = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M15 6l-6 6 6 6" /></svg>
)
export const IconNext = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M9 6l6 6-6 6" /></svg>
)
export const IconLast = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M6 6l6 6-6 6M17 6v12" /></svg>
)
export const IconFlip = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" /></svg>
)
export const IconSun = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
)
export const IconMoon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>
)
export const IconUpload = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
)
export const IconSettings = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>
)
export const IconMore = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 6h.01M12 12h.01M12 18h.01" strokeWidth={3} /></svg>
)
export const IconChart = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 19h16M7 15l4-5 3 3 5-7" /></svg>
)
