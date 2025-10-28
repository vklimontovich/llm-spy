'use client'

import { useState } from 'react'
import { Dropdown, DatePicker, Button } from 'antd'
import { XCircle } from 'lucide-react'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)

interface TimeRangePickerProps {
  rangeValue: [Dayjs, Dayjs] | null
  presetValue: string
  defaultPresetInterval: string
  onChange: (dates: [Dayjs, Dayjs] | null, preset: string) => void
}

const PRESET_LABELS: Record<string, string> = {
  last15m: 'Past 15 Minutes',
  last1h: 'Past 1 Hour',
  last4h: 'Past 4 Hours',
  last1d: 'Past 1 Day',
  last2d: 'Past 2 Days',
  last3d: 'Past 3 Days',
  last1w: 'Past 7 Days',
  last15d: 'Past 15 Days',
  last1m: 'Past 1 Month',
}

const PRESETS = [
  { key: 'last15m', label: 'Past 15 Minutes', minutes: 15 },
  { key: 'last1h', label: 'Past 1 Hour', hours: 1 },
  { key: 'last4h', label: 'Past 4 Hours', hours: 4 },
  { key: 'last1d', label: 'Past 1 Day', days: 1 },
  { key: 'last2d', label: 'Past 2 Days', days: 2 },
  { key: 'last3d', label: 'Past 3 Days', days: 3 },
  { key: 'last1w', label: 'Past 7 Days', days: 7 },
  { key: 'last15d', label: 'Past 15 Days', days: 15 },
  { key: 'last1m', label: 'Past 1 Month', months: 1 },
]

export default function TimeRangePicker({
  rangeValue,
  presetValue,
  defaultPresetInterval,
  onChange,
}: TimeRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [tempStartDate, setTempStartDate] = useState<Dayjs | null>(
    rangeValue?.[0] || null
  )
  const [tempEndDate, setTempEndDate] = useState<Dayjs | null>(
    rangeValue?.[1] || null
  )
  const [selectionMade, setSelectionMade] = useState(false)

  const handlePresetClick = (preset: any) => {
    const now = dayjs()
    let start = now
    if (preset.minutes) start = now.subtract(preset.minutes, 'minute')
    if (preset.hours) start = now.subtract(preset.hours, 'hour')
    if (preset.days) start = now.subtract(preset.days, 'day')
    if (preset.months) start = now.subtract(preset.months, 'month')

    setSelectionMade(true)
    onChange([start, now], preset.key)
    setOpen(false)
  }

  const handleRecentDayClick = (date: Dayjs) => {
    const start = date.startOf('day')
    const end = date.endOf('day')
    setSelectionMade(true)
    onChange([start, end], 'custom')
    setOpen(false)
  }

  const handleCustomOk = () => {
    if (tempStartDate && tempEndDate) {
      setSelectionMade(true)
      onChange([tempStartDate, tempEndDate], 'custom')
      setOpen(false)
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectionMade(true)
    onChange(null, '')
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      // Opening dropdown - reset selection flag
      setSelectionMade(false)
    } else {
      // Closing dropdown - check if selection was made
      if (!selectionMade && defaultPresetInterval) {
        // Rollback to default preset
        const defaultPreset = PRESETS.find(p => p.key === defaultPresetInterval)
        if (defaultPreset) {
          const now = dayjs()
          let start = now
          if (defaultPreset.minutes)
            start = now.subtract(defaultPreset.minutes, 'minute')
          if (defaultPreset.hours)
            start = now.subtract(defaultPreset.hours, 'hour')
          if (defaultPreset.days)
            start = now.subtract(defaultPreset.days, 'day')
          if (defaultPreset.months)
            start = now.subtract(defaultPreset.months, 'month')

          onChange([start, now], defaultPreset.key)
        }
      }
    }
    setOpen(isOpen)
  }

  const getRecentDays = () => {
    const days: Dayjs[] = []
    for (let i = 0; i < 5; i++) {
      days.push(dayjs().subtract(i, 'day'))
    }
    return days
  }

  const formatDisplayValue = () => {
    if (!rangeValue) return 'Select time range'

    if (presetValue !== 'custom' && PRESET_LABELS[presetValue]) {
      return PRESET_LABELS[presetValue]
    }

    const format = 'MMM D HH:mm:ss'
    return `${rangeValue[0].format(format)} - ${rangeValue[1].format(format)}`
  }

  const dropdownContent = (
    <div className="flex bg-white border border-gray-300 rounded-lg shadow-lg">
      {/* Left Panel */}
      <div className="w-[300px] p-4 border-r border-gray-200">
        {/* Recent Days */}
        <div className="mb-5">
          <div className="text-xs font-semibold text-gray-500 mb-2">
            Recent days
          </div>
          <div className="flex flex-col gap-1">
            {getRecentDays().map(day => (
              <div
                key={day.format('YYYY-MM-DD')}
                onClick={() => handleRecentDayClick(day)}
                className="px-3 py-1.5 cursor-pointer rounded text-sm hover:bg-gray-100 transition-colors"
              >
                {day.format('MMM DD')}
              </div>
            ))}
          </div>
        </div>

        {/* Exact Interval */}
        <div>
          <div className="text-xs font-semibold text-gray-500 mb-2">
            Exact interval
          </div>
          <div className="flex flex-col gap-2">
            <DatePicker
              value={tempStartDate}
              onChange={setTempStartDate}
              showTime
              format="MMM DD HH:mm:ss"
              className="w-full"
            />
            <DatePicker
              value={tempEndDate}
              onChange={setTempEndDate}
              showTime
              format="MMM DD HH:mm:ss"
              className="w-full"
            />
            <Button type="primary" onClick={handleCustomOk} className="w-full">
              OK
            </Button>
          </div>
        </div>
      </div>

      {/* Right Panel - Presets */}
      <div className="w-[200px] p-4">
        <div className="flex flex-col gap-1">
          {PRESETS.map(preset => (
            <div
              key={preset.key}
              onClick={() => handlePresetClick(preset)}
              className={`px-3 py-1.5 cursor-pointer rounded text-sm transition-colors ${
                presetValue === preset.key
                  ? 'bg-blue-50 text-blue-600'
                  : 'hover:bg-gray-100'
              }`}
            >
              {preset.label}
            </div>
          ))}
        </div>
        <div className="text-xs text-gray-600 pl-2.5 mt-2">
          Time is counted from the most recent event
        </div>
      </div>
    </div>
  )

  return (
    <Dropdown
      open={open}
      onOpenChange={handleOpenChange}
      popupRender={() => dropdownContent}
      trigger={['click']}
    >
      <div className="px-3 py-1.5 border border-gray-300 rounded-md cursor-pointer text-sm bg-white min-w-[300px] transition-colors hover:border-blue-400 flex items-center justify-between gap-2">
        <span className="flex-1">{formatDisplayValue()}</span>
        {presetValue === 'custom' && rangeValue && (
          <XCircle
            className="w-4 h-4 text-gray-400 hover:text-gray-600 flex-shrink-0"
            onClick={handleClear}
          />
        )}
      </div>
    </Dropdown>
  )
}
