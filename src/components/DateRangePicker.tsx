'use client';

import { useRef, useEffect, useState } from 'react';
import { DayPicker, DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import 'react-day-picker/style.css';

interface DateRangePickerProps {
  dateFrom: string;
  dateTo: string;
  isActive: boolean;
  onApply: (from: string, to: string) => void;
}

export default function DateRangePicker({ dateFrom, dateTo, isActive, onApply }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function handleOpen() {
    if (!open) {
      setRange(
        dateFrom
          ? { from: new Date(dateFrom), to: dateTo ? new Date(dateTo) : undefined }
          : undefined
      );
    }
    setOpen(!open);
  }

  function handleApply() {
    if (!range?.from) return;
    onApply(
      format(range.from, 'yyyy-MM-dd'),
      range.to ? format(range.to, 'yyyy-MM-dd') : ''
    );
    setOpen(false);
  }

  const label = isActive && dateFrom
    ? `${dateFrom.slice(5).replace('-', '/')} ~ ${dateTo ? dateTo.slice(5).replace('-', '/') : '?'}`
    : '날짜 범위';

  return (
    <div className="relative" ref={ref}>
      {/* 트리거 버튼 */}
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200"
        style={
          isActive
            ? {
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                color: '#fff',
                boxShadow: '0 0 10px rgba(34,197,94,0.35)',
              }
            : {
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
              }
        }
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        {label}
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* 팝오버 */}
      {open && (
        <div
          className="absolute top-full left-0 mt-2 z-50 rounded-2xl p-4"
          style={{
            background: 'var(--sidebar)',
            border: '1px solid var(--border)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
          }}
        >
          <style>{`
            .rdp-root {
              --rdp-accent-color: #22c55e;
              --rdp-accent-background-color: rgba(34, 197, 94, 0.15);
              --rdp-range_middle-background-color: rgba(34, 197, 94, 0.1);
              --rdp-range_start-background: linear-gradient(135deg, #22c55e, #16a34a);
              --rdp-range_end-background: linear-gradient(135deg, #22c55e, #16a34a);
              --rdp-selected-border: none;
              --rdp-day-width: 36px;
              --rdp-day-height: 36px;
              --rdp-day_button-border-radius: 8px;
              --rdp-day_button-width: 34px;
              --rdp-day_button-height: 34px;
              --rdp-font-family: inherit;
              color: var(--text);
            }
            .rdp-day_button:hover:not([disabled]) {
              background: rgba(34,197,94,0.12) !important;
              color: #22c55e !important;
            }
            .rdp-selected .rdp-day_button {
              box-shadow: 0 0 10px rgba(34,197,94,0.35);
            }
            .rdp-nav button {
              color: var(--text-muted);
            }
            .rdp-nav button:hover {
              color: #22c55e;
              background: rgba(34,197,94,0.1);
            }
            .rdp-month_caption {
              color: var(--text);
              font-size: 13px;
              font-weight: 600;
            }
            .rdp-weekday {
              color: var(--text-faint);
              font-size: 11px;
            }
            .rdp-day {
              color: var(--text-muted);
              font-size: 12px;
            }
            .rdp-outside {
              opacity: 0.3;
            }
            .rdp-today:not(.rdp-selected) .rdp-day_button {
              color: #22c55e;
              font-weight: 700;
            }
          `}</style>

          <DayPicker
            mode="range"
            selected={range}
            onSelect={setRange}
            locale={ko}
            numberOfMonths={1}
          />

          {/* 선택된 범위 표시 */}
          <div
            className="flex items-center justify-between mt-1 mb-3 px-1 text-xs"
            style={{ color: 'var(--text-faint)' }}
          >
            <span>
              {range?.from ? format(range.from, 'yyyy.MM.dd') : '시작일 선택'}
            </span>
            <span className="mx-2">→</span>
            <span>
              {range?.to ? format(range.to, 'yyyy.MM.dd') : '종료일 선택'}
            </span>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => { setOpen(false); setRange(undefined); }}
              className="px-3 py-1.5 rounded-lg text-xs transition-colors"
              style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}
            >
              취소
            </button>
            <button
              disabled={!range?.from}
              onClick={handleApply}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
              style={{
                background: range?.from ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'var(--hover-bg)',
                color: range?.from ? '#fff' : 'var(--text-faint)',
                boxShadow: range?.from ? '0 0 10px rgba(34,197,94,0.3)' : 'none',
              }}
            >
              적용
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
