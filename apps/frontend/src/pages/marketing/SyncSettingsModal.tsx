import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

type SyncSettingsModalProps = {
  isOpen: boolean
  onClose: () => void
  sync: {
    id: string
    name: string
    schedule: string | null
    enabled: boolean
  }
  onSave: (data: { schedule?: string; enabled?: boolean }) => void
  isSaving?: boolean
}

const SCHEDULE_PRESETS = [
  { label: 'Daily at 6 AM', value: '0 6 * * *' },
  { label: 'Weekly (Monday 6 AM)', value: '0 6 * * 1' },
  { label: 'Weekly (Friday 6 AM)', value: '0 6 * * 5' },
  { label: 'Monthly (1st at 6 AM)', value: '0 6 1 * *' },
]

export function SyncSettingsModal({
  isOpen,
  onClose,
  sync,
  onSave,
  isSaving,
}: SyncSettingsModalProps) {
  const [schedule, setSchedule] = useState(sync.schedule ?? '')
  const [enabled, setEnabled] = useState(sync.enabled)

  useEffect(() => {
    setSchedule(sync.schedule ?? '')
    setEnabled(sync.enabled)
  }, [sync])

  if (!isOpen) return null

  const handleSave = () => {
    onSave({
      schedule: schedule || undefined,
      enabled,
    })
  }

  const currentPreset = SCHEDULE_PRESETS.find((p) => p.value === schedule)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-lg mx-4">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="mb-1 text-lg font-semibold text-foreground">
          Settings
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">{sync.name}</p>

        <div className="space-y-5">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">
              Enabled
            </label>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                enabled ? 'bg-[#DEDC00]' : 'bg-muted'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg transition-transform ${
                  enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Schedule Presets */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Schedule
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SCHEDULE_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setSchedule(preset.value)}
                  className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                    schedule === preset.value
                      ? 'border-[#DEDC00] bg-[#DEDC00]/10 text-[#DEDC00]'
                      : 'border-border text-muted-foreground hover:border-foreground/30'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Cron */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Custom cron expression
            </label>
            <input
              type="text"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              placeholder="e.g. 0 6 * * 1"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#DEDC00] focus:outline-none focus:ring-1 focus:ring-[#DEDC00]"
            />
            {currentPreset && (
              <p className="text-xs text-muted-foreground">
                {currentPreset.label}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-[#DEDC00] text-[#1C2533] hover:bg-[#F8AB08]"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}
