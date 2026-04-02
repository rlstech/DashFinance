import pymssql
from contextlib import contextmanager
from app.config import settings


def get_connection():
    return pymssql.connect(
        server=settings.DB_HOST,
        port=settings.DB_PORT,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        database=settings.DB_NAME,
        charset="utf8",
        as_dict=True,
        login_timeout=10,
        timeout=120,
    )


@contextmanager
def get_db():
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()


def execute_query(query: str, params: tuple | None = None) -> list[dict]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        return cursor.fetchall()
