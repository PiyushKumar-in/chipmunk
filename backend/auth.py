from datetime import datetime, timedelta, timezone
import os
from pathlib import Path
import sqlite3
from typing import Annotated
from uuid import uuid4

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

secretKey = os.getenv("SECRET_KEY", uuid4().hex)
algorithm = "HS256"
databaseDir = Path(__file__).parent.parent / "database"
dbPath = str(databaseDir / "app.db")

security = HTTPBearer()


def initDb():
    with sqlite3.connect(dbPath) as conn:
        cursor = conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                organisation TEXT,
                userName TEXT,
                password TEXT,
                role TEXT,
                PRIMARY KEY (organisation, userName)
            )
        """)
        cursor.execute(
            "INSERT OR IGNORE INTO users (organisation, userName, password, role) VALUES (?, ?, ?, ?)",
            ("root", "admin", os.getenv("ADMIN_PASSWORD", uuid4().hex[:6]), "admin"),
        )
        cursor.execute("SELECT password FROM users WHERE organisation = 'root' AND userName = 'admin'")
        userRow = cursor.fetchone()
    print(f"Admin Password: {userRow[0]}")


initDb()


class User(BaseModel):
    userName: str
    organisation: str
    role: str


class LoginRequest(BaseModel):
    organisation: str = "root"
    userName: str
    password: str


def createToken(userName: str, organisation: str) -> str:
    expireTime = datetime.now(timezone.utc) + timedelta(hours=1)
    return jwt.encode({"sub": userName, "org": organisation, "exp": expireTime}, secretKey, algorithm=algorithm)


def getCurrentUser(credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]) -> User:
    try:
        payload = jwt.decode(credentials.credentials, secretKey, algorithms=[algorithm])
        userName: str | None = payload.get("sub")
        organisation: str | None = payload.get("org")
        if not userName or not organisation:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    with sqlite3.connect(dbPath, timeout=10) as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT role FROM users WHERE organisation = ? AND userName = ?",
            (organisation, userName),
        )
        row = cursor.fetchone()

    if not row:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return User(userName=userName, organisation=organisation, role=row[0])
