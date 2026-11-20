from pathlib import Path
import sqlite3
from typing import Annotated
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
try:
    from backend.auth import databaseDir, dbPath, LoginRequest, User, createToken, getCurrentUser
    from backend.processing import processFileAsync
    from backend.rag import executeRag
except ModuleNotFoundError:
    from auth import databaseDir, dbPath, LoginRequest, User, createToken, getCurrentUser
    from processing import processFileAsync
    from rag import executeRag


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CreateUserRequest(BaseModel):
    userName: str
    password: str
    organisation: str | None = None


class AppRequest(BaseModel):
    prompt: str


@app.get("/")
def root():
    return {"message": "FastAPI server running"}


@app.post("/createUser")
def createUser(userData: CreateUserRequest, currentUser: Annotated[User, Depends(getCurrentUser)]):
    if currentUser.organisation == "root" and currentUser.userName == "admin":
        if not userData.organisation:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Organisation is required")
        targetOrg = userData.organisation
        targetRole = "admin"
    elif currentUser.role == "admin":
        targetOrg = currentUser.organisation
        targetRole = "user"
    else:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Admin access required")

    try:
        with sqlite3.connect(dbPath, timeout=10) as conn:
            conn.execute(
                "INSERT INTO users (organisation, userName, password, role) VALUES (?, ?, ?, ?)",
                (targetOrg, userData.userName, userData.password, targetRole),
            )
        if targetRole == "admin" and targetOrg != "root":
            (databaseDir / targetOrg).mkdir(parents=True, exist_ok=True)
        return {"message": f"{targetRole.capitalize()} user '{userData.userName}' created for organisation '{targetOrg}'"}
    except sqlite3.IntegrityError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="User already exists")


@app.post("/login")
def login(loginData: LoginRequest):
    with sqlite3.connect(dbPath, timeout=10) as conn:
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


@app.post("/upload")
def uploadFile(
    file: UploadFile,
    currentUser: Annotated[User, Depends(getCurrentUser)],
):
    if currentUser.organisation == "root" or currentUser.role != "admin":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Only organisation admins (non-root) can upload files",
        )

    orgDir = databaseDir / currentUser.organisation
    orgDir.mkdir(parents=True, exist_ok=True)

    fileName = Path(file.filename or "upload.bin").name
    destPath = orgDir / fileName

    with open(destPath, "wb") as f:
        while chunk := file.file.read(1024 * 1024):
            f.write(chunk)

    processFileAsync(destPath, currentUser.organisation)

    return {
        "message": f"File '{fileName}' uploaded successfully for organisation '{currentUser.organisation}'",
        "fileName": fileName,
        "organisation": currentUser.organisation,
    }


@app.post("/app")
def appEndpoint(
    appData: AppRequest,
    currentUser: Annotated[User, Depends(getCurrentUser)],
):
    return executeRag(appData.prompt, currentUser.organisation)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
