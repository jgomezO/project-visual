"use client";

import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import {
  Calendar,
  DateField,
  DatePicker,
  Label as HeroLabel,
} from "@heroui/react";
import { parseDate, type DateValue } from "@internationalized/date";
import { Trash2 } from "lucide-react";

// Shared field primitives for the narrative editor (iter 4h R3). All
// editor forms render through these so the input chrome (radius,
// padding, border, focus ring) and the label / helper / error
// typography stay identical across NarrativeForm, PhaseForm,
// WorkstreamForm, DependencyForm, RiskForm. Native <input> /
// <textarea> under the hood — no HeroUI compound — to guarantee the
// Prism palette wins without fighting library internals.

const INPUT_BASE =
  "w-full rounded-md border border-border bg-surface px-4 py-2.5 text-base text-text-primary placeholder:text-text-muted transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60";

export const TextInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function TextInput({ className, type = "text", ...rest }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      className={[INPUT_BASE, className ?? ""].join(" ").trim()}
      {...rest}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={[INPUT_BASE, "resize-y", className ?? ""].join(" ").trim()}
      {...rest}
    />
  );
});

// Implicit label association via wrapping <label> — same pattern the
// editor used pre-R3 for textareas. Avoids the useId+htmlFor dance for
// what is, by editor convention, a one-control-per-label form.
export function Field({
  label,
  helper,
  error,
  children,
}: {
  label: string;
  helper?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">
        {label}
      </span>
      {children}
      {error ? (
        <span className="text-sm text-error" role="alert">
          {error}
        </span>
      ) : helper ? (
        <span className="text-sm text-text-secondary">{helper}</span>
      ) : null}
    </label>
  );
}

// Section heading inside a form ("Narrativa", "Fase", "Workstream"…).
// Matches the caption-style labels but rendered as an h2 for screen
// readers; the form below it is one logical region per heading.
export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xs font-medium uppercase tracking-wide text-text-muted">
      {children}
    </h2>
  );
}

// Date field that wraps HeroUI's verbose DatePicker compound so the
// editor forms can render `<DateInputField label="Inicio" value={iso}
// onChange={setIso} />` without repeating the 20-line composition. The
// boundary stays an ISO yyyy-mm-dd string (matching the DB column type
// and the rest of our data layer); CalendarDate <-> string conversion
// happens here via parseDate / value.toString(). Empty string maps to
// HeroUI's `null` value (no date selected).
//
// Memory rule (iter 4h R2 R2): never use native <input type="date">.
// All date / time inputs across the product flow through HeroUI's
// DatePicker / DateRangePicker so the chrome stays on-brand.
export function DateInputField({
  label,
  value,
  onChange,
  helper,
  error,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  helper?: string;
  error?: string | null;
}) {
  const calendarValue: DateValue | null = value ? parseDate(value) : null;
  return (
    <div className="flex flex-col gap-1.5">
      <DatePicker
        className="w-full"
        value={calendarValue}
        onChange={(next) => onChange(next ? next.toString() : "")}
      >
        <HeroLabel className="text-xs font-medium uppercase tracking-wide text-text-secondary">
          {label}
        </HeroLabel>
        <DateField.Group fullWidth>
          <DateField.Input>
            {(segment) => <DateField.Segment segment={segment} />}
          </DateField.Input>
          <DateField.Suffix>
            <DatePicker.Trigger>
              <DatePicker.TriggerIndicator />
            </DatePicker.Trigger>
          </DateField.Suffix>
        </DateField.Group>
        <DatePicker.Popover>
          <Calendar aria-label={label}>
            <Calendar.Header>
              <Calendar.YearPickerTrigger>
                <Calendar.YearPickerTriggerHeading />
                <Calendar.YearPickerTriggerIndicator />
              </Calendar.YearPickerTrigger>
              <Calendar.NavButton slot="previous" />
              <Calendar.NavButton slot="next" />
            </Calendar.Header>
            <Calendar.Grid>
              <Calendar.GridHeader>
                {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
              </Calendar.GridHeader>
              <Calendar.GridBody>
                {(date) => <Calendar.Cell date={date} />}
              </Calendar.GridBody>
            </Calendar.Grid>
            <Calendar.YearPickerGrid>
              <Calendar.YearPickerGridBody>
                {({ year }) => <Calendar.YearPickerCell year={year} />}
              </Calendar.YearPickerGridBody>
            </Calendar.YearPickerGrid>
          </Calendar>
        </DatePicker.Popover>
      </DatePicker>
      {error ? (
        <span className="text-sm text-error" role="alert">
          {error}
        </span>
      ) : helper ? (
        <span className="text-sm text-text-secondary">{helper}</span>
      ) : null}
    </div>
  );
}

// Destructive "Eliminar" button at the foot of edit forms. Ghost shell
// painted with the error palette so the destructive intent reads at
// hover without needing a saturated red surface in idle. Divider above
// keeps it visually separate from the rest of the form.
export function FormDeleteButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <div className="mt-4 border-t border-border pt-4">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-error transition-colors hover:bg-error-bg disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Trash2 className="size-4" aria-hidden="true" />
        {children}
      </button>
    </div>
  );
}
