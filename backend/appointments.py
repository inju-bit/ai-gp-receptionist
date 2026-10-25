import sqlite3
from pathlib import Path
from datetime import date, timedelta

DB_PATH = Path(__file__).resolve().parent / "appointments.db"


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_database():
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS appointments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                appointment_date TEXT NOT NULL,
                appointment_time TEXT NOT NULL,
                doctor TEXT NOT NULL,
                available INTEGER NOT NULL DEFAULT 1
            )
        """)

        count = conn.execute(
            "SELECT COUNT(*) FROM appointments"
        ).fetchone()[0]

        if count == 0:
            doctors = ["Dr Smith", "Dr Patel", "Dr Brown"]
            times = ["09:30", "11:15", "14:00"]

            day = date.today()
            created = 0

            while created < 9:
                day += timedelta(days=1)

                # Monday to Friday only
                if day.weekday() >= 5:
                    continue

                for time, doctor in zip(times, doctors):
                    conn.execute("""
                        INSERT INTO appointments
                        (appointment_date, appointment_time, doctor)
                        VALUES (?, ?, ?)
                    """, (day.isoformat(), time, doctor))

                created += 1


def get_available_appointments():
    today = date.today().isoformat()

    with get_connection() as conn:
        rows = conn.execute("""
            SELECT id, appointment_date, appointment_time, doctor
            FROM appointments
            WHERE available = 1
              AND appointment_date >= ?
            ORDER BY appointment_date, appointment_time
        """, (today,)).fetchall()

    return [dict(row) for row in rows]


if __name__ == "__main__":
    init_database()
    print("Demo appointment database created.")
    print(get_available_appointments()[:3])
