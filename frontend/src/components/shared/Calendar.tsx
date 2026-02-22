import React, { useState, useRef, useEffect } from "react";
import "../../styles/shared/Calendar.css";

export interface CalendarProps {
    selectedDate: string;
    onDateSelect: (dateString: string) => void;
}

const Calendar: React.FC<CalendarProps> = ({ selectedDate, onDateSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [calendarMonth, setCalendarMonth] = useState(new Date());
    const calendarRef = useRef<HTMLDivElement>(null);

    const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                calendarRef.current &&
                !calendarRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const getDaysInMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    };

    const handleCalendarDateClick = (day: number) => {
        const newDate = new Date(
            calendarMonth.getFullYear(),
            calendarMonth.getMonth(),
            day,
        );
        const year = newDate.getFullYear();
        const month = String(newDate.getMonth() + 1).padStart(2, "0");
        const dayStr = String(day).padStart(2, "0");
        const dateStr = `${year}-${month}-${dayStr}`;
        onDateSelect(dateStr);
        setIsOpen(false);
    };

    const handlePrevMonth = () => {
        setCalendarMonth(
            new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1),
        );
    };

    const handleNextMonth = () => {
        setCalendarMonth(
            new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1),
        );
    };

    return (
        <div className="calendar-wrapper" ref={calendarRef}>
            <button
                className="calendar-trigger"
                onClick={() => setIsOpen(!isOpen)}
                title="Open calendar"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path d="M3 4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4zm2 0v4h14V4H5zm0 6v10h14V10H5zm2 2h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zM7 16h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z" />
                </svg>
            </button>
            {isOpen && (
                <div className="calendar-picker">
                    <div className="calendar-header">
                        <button
                            className="calendar-nav-button"
                            onClick={handlePrevMonth}
                        >
                            {"<"}
                        </button>
                        <span className="calendar-month-year">
                            {monthNames[calendarMonth.getMonth()]}{" "}
                            {calendarMonth.getFullYear()}
                        </span>
                        <button
                            className="calendar-nav-button"
                            onClick={handleNextMonth}
                        >
                            {">"}
                        </button>
                    </div>
                    <div className="calendar-weekdays">
                        <div className="weekday">Sun</div>
                        <div className="weekday">Mon</div>
                        <div className="weekday">Tue</div>
                        <div className="weekday">Wed</div>
                        <div className="weekday">Thu</div>
                        <div className="weekday">Fri</div>
                        <div className="weekday">Sat</div>
                    </div>
                    <div className="calendar-days">
                        {Array.from(
                            {
                                length: getFirstDayOfMonth(calendarMonth),
                            },
                            () => null,
                        ).map((_, i) => (
                            <div
                                key={`empty-${i}`}
                                className="calendar-day empty"
                            ></div>
                        ))}
                        {Array.from(
                            {
                                length: getDaysInMonth(calendarMonth),
                            },
                            (_, i) => i + 1,
                        ).map((day) => (
                            <button
                                key={day}
                                className={`calendar-day ${
                                    selectedDate ===
                                    `${calendarMonth.getFullYear()}-${String(
                                        calendarMonth.getMonth() + 1,
                                    ).padStart(2, "0")}-${String(day).padStart(
                                        2,
                                        "0",
                                    )}`
                                        ? "selected"
                                        : ""
                                }`}
                                onClick={() => handleCalendarDateClick(day)}
                            >
                                {day}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Calendar;
