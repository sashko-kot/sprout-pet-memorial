import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./App";

const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const months = Array.from({ length: 12 }, (_, index) =>
  new Intl.DateTimeFormat("ru-RU", { month: "long" }).format(new Date(2024, index, 1)),
);

function parseDate(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default function DatePicker({ name, value, onChange, placeholder = "Выберите дату" }) {
  const wrapperRef = useRef(null);
  const selectedDate = parseDate(value);
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const initialDate = selectedDate || new Date();
    return new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);
  });
  const currentYear = new Date().getFullYear();
  const years = useMemo(
    () => Array.from({ length: currentYear - 1899 }, (_, index) => currentYear - index),
    [currentYear],
  );

  useEffect(() => {
    if (selectedDate) {
      setVisibleMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    }
  }, [value]);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const firstWeekday = (visibleMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + 1,
    0,
  ).getDate();
  const calendarDays = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  const selectDate = (day) => {
    const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day);
    onChange({ target: { name, value: toDateValue(date) } });
    setOpen(false);
  };

  const changeMonth = (offset) => {
    setVisibleMonth((currentMonth) =>
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1),
    );
  };

  return (
    <div className="date-picker" ref={wrapperRef}>
      <div className="date-picker-control">
        <input
          type="text"
          name={name}
          value={selectedDate ? formatDate(selectedDate) : ""}
          placeholder={placeholder}
          readOnly
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((isOpen) => !isOpen)}
        />
        <button
          className="date-picker-trigger"
          type="button"
          aria-label="Открыть календарь"
          aria-expanded={open}
          onClick={() => setOpen((isOpen) => !isOpen)}
        >
          <Icon name="calendar" size={19} />
        </button>
      </div>

      {open && (
        <div className="date-picker-popover" role="dialog" aria-label="Выбор даты">
          <div className="date-picker-heading">
            <select
              aria-label="Месяц"
              value={visibleMonth.getMonth()}
              onChange={(event) =>
                setVisibleMonth(new Date(visibleMonth.getFullYear(), Number(event.target.value), 1))
              }
            >
              {months.map((month, index) => (
                <option key={month} value={index}>{month}</option>
              ))}
            </select>
            <select
              aria-label="Год"
              value={visibleMonth.getFullYear()}
              onChange={(event) =>
                setVisibleMonth(new Date(Number(event.target.value), visibleMonth.getMonth(), 1))
              }
            >
              {years.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </div>

          <div className="date-picker-navigation">
            <button type="button" aria-label="Предыдущий месяц" onClick={() => changeMonth(-1)}>
              <Icon name="back" size={17} />
            </button>
            <span>{formatDate(visibleMonth).replace(/\s\d{4}$/, "")}</span>
            <button type="button" aria-label="Следующий месяц" onClick={() => changeMonth(1)}>
              <Icon name="arrow" size={17} />
            </button>
          </div>

          <div className="date-picker-grid" role="grid">
            {weekdays.map((weekday) => (
              <span className="date-picker-weekday" key={weekday} role="columnheader">{weekday}</span>
            ))}
            {calendarDays.map((day, index) => {
              if (!day) return <span className="date-picker-empty" key={`empty-${index}`} />;
              const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day);
              const isSelected = selectedDate?.getTime() === date.getTime();
              const isToday = toDateValue(date) === toDateValue(new Date());
              return (
                <button
                  className={`date-picker-day${isSelected ? " selected" : ""}${isToday ? " today" : ""}`}
                  key={day}
                  type="button"
                  role="gridcell"
                  aria-pressed={isSelected}
                  aria-label={formatDate(date)}
                  onClick={() => selectDate(day)}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <div className="date-picker-footer">
            <button type="button" onClick={() => {
              const today = new Date();
              onChange({ target: { name, value: toDateValue(today) } });
              setOpen(false);
            }}>
              Сегодня
            </button>
            {value && (
              <button type="button" onClick={() => {
                onChange({ target: { name, value: "" } });
                setOpen(false);
              }}>
                Очистить
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
