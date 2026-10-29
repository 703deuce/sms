'use client'

export function FollowStickerPreview({
  text,
  platform,
  x,
  y,
  boxWidth,
  boxHeight,
}: {
  text: string
  platform?: 'twitch' | 'kick'
  x: number
  y: number
  boxWidth: number
  boxHeight: number
}) {
  const color = platform === 'kick' ? '#53FC18' : '#9146FF'
  const w = Math.max(80, boxWidth * 0.22)
  const h = Math.max(28, boxHeight * 0.04)
  return (
    <div
      className="pointer-events-none absolute rounded px-2 py-1 text-center font-bold text-white shadow"
      style={{
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        width: w,
        height: h,
        backgroundColor: color,
        fontSize: Math.max(10, h / 3),
        transform: 'translate(-50%, -50%)',
      }}
    >
      {(text || 'FOLLOW').slice(0, 32)}
    </div>
  )
}
