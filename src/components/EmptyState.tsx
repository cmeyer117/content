type Props = { message: string; icon?: string }

export default function EmptyState({ message, icon }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      {icon && <span className="text-2xl">{icon}</span>}
      <p className="text-xs text-gray-500">{message}</p>
    </div>
  )
}
