import sqlite3
from typing import Annotated
from fastapi import Depends, FastAPI, HTTPException, status
from pydantic import BaseModel
try:
    from backend.auth import DB_PATH, LoginRequest, User, createToken, getCurrentUser
except ModuleNotFoundError:
    from auth import DB_PATH, LoginRequest, User, createToken, getCurrentUser



app = FastAPI()

class CreateUserRequest(BaseModel):
    userName: str
    password: str
    organisation: str | None = None


@app.get("/")
def root():
    return {"message": "FastAPI server running"}


@app.post("/createUser")
def createUser(userData: CreateUserRequest, currentUser: Annotated[User, Depends(getCurrentUser)]):
    if currentUser.organisation == "root" and currentUser.userName == "admin":
        if not userData.organisation:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Organisation is required")
        target_org = userData.organisation
        target_role = "admin"
    elif currentUser.role == "admin":
        target_org = currentUser.organisation
        target_role = "user"
    else:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Admin access required")

    try:
        with sqlite3.connect(DB_PATH, timeout=10) as conn:
            conn.execute(
                "INSERT INTO users (organisation, userName, password, role) VALUES (?, ?, ?, ?)",
                (target_org, userData.userName, userData.password, target_role),
            )
        return {"message": f"{target_role.capitalize()} user '{userData.userName}' created for organisation '{target_org}'"}
    except sqlite3.IntegrityError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="User already exists")


@app.post("/login")
def login(loginData: LoginRequest):
    with sqlite3.connect(DB_PATH, timeout=10) as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT password FROM users WHERE organisation = ? AND userName = ?",
            (loginData.organisation, loginData.userName),
        )
        userRow = cursor.fetchone()

    if userRow and userRow[0] == loginData.password:
        accessToken = createToken(loginData.userName, loginData.organisation)
        return {"accessToken": accessToken, "tokenType": "bearer"}
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")


@app.get("/protected")
def protectedRoute(currentUser: Annotated[User, Depends(getCurrentUser)]):
    return {"message": f"Hello, {currentUser.userName}! Organisation: {currentUser.organisation}, Role: {currentUser.role}"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
