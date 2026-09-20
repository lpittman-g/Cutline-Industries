import { useId } from 'react'

export function ArtemisMark({ size = 36 }: { size?: number }) {
  const gradId = useId().replace(/:/g, '')
  return (
    <svg
      className="artemis-mark"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f87171" />
          <stop offset="25%" stopColor="#fbbf24" />
          <stop offset="50%" stopColor="#34d399" />
          <stop offset="75%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
      </defs>
      <path
        d="M32 4 C22 4 14 18 14 56 L24 56 C24 28 26 14 32 14 C38 14 40 28 40 56 L50 56 C50 18 42 4 32 4 Z"
        fill="#3b82f6"
      />
      <path
        d="M32 4 C26 4 22 10 20 18 C22 12 26 8 32 8 C38 8 42 12 44 18 C42 10 38 4 32 4 Z"
        fill={`url(#${gradId})`}
      />
    </svg>
  )
}
