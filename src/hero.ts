import { heroui } from '@heroui/react'

export default heroui({
  layout: {
    radius: { small: '6px', medium: '10px', large: '14px' },
  },
  themes: {
    dark: {
      colors: {
        background: '#1C2026',
        foreground: '#E6E8EB',
        content1: '#242932',
        content2: '#2D333D',
        content3: '#363D49',
        divider: '#E6E8EB1A',
        primary: { DEFAULT: '#7C9CBF', foreground: '#14181D' },
        focus: '#7C9CBF',
      },
    },
    light: {
      colors: {
        background: '#EEF0F2',
        foreground: '#1F242B',
        content1: '#FFFFFF',
        content2: '#F3F4F6',
        content3: '#E5E8EC',
        divider: '#1F242B1A',
        primary: { DEFAULT: '#46698F', foreground: '#FFFFFF' },
        focus: '#46698F',
      },
    },
  },
})
