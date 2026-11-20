import os
from pathlib import Path
import threading
import chromadb
from chromadb.utils import embedding_functions
import pymupdf4llm

chromaClient = chromadb.PersistentClient(path=str(Path(__file__).parent.parent / "database" / "chroma_db"))
embeddingFunction = embedding_functions.ONNXMiniLM_L6_V2()


def processFile(filePath: str | Path, organisation: str):
    filePath = Path(filePath)
    fileName = filePath.name
    collection = chromaClient.get_or_create_collection(
        name=organisation,
        embedding_function=embeddingFunction,
    )

    documents = []
    metadatas = []
    ids = []

    pages = pymupdf4llm.to_markdown(str(filePath), page_chunks=True)
    for p in pages:
        pageNo = p["metadata"].get("page_number", 1)
        paras = [x.strip() for x in p.get("text", "").split("\n\n") if x.strip()]
        for idx, para in enumerate(paras):
            paragraphNo = idx + 1
            chunkId = f"{fileName}_p{pageNo}_para{paragraphNo}"
            documents.append(para)
            metadatas.append({
                "fileName": fileName,
                "pageNo": pageNo,
                "paragraphNo": paragraphNo,
                "organisation": organisation,
            })
            ids.append(chunkId)

    if documents:
        collection.upsert(documents=documents, metadatas=metadatas, ids=ids)
    print(f"Processed and indexed {len(documents)} chunks from '{fileName}' for '{organisation}'")


def deleteFileChunks(fileName: str, organisation: str):
    try:
        collection = chromaClient.get_collection(
            name=organisation,
            embedding_function=embeddingFunction,
        )
        collection.delete(where={"fileName": fileName})
        print(f"Removed previous chunks for '{fileName}' in '{organisation}'")
    except Exception as e:
        print(f"Error removing chunks for '{fileName}' in '{organisation}': {e}")


def handleFileUpload(tmpPath: Path, destPath: Path, organisation: str):
    fileName = destPath.name
    if destPath.exists():
        deleteFileChunks(fileName, organisation)

    tmpPath.replace(destPath)
    processFile(destPath, organisation)


def handleFileUploadAsync(tmpPath: Path, destPath: Path, organisation: str):
    thread = threading.Thread(
        target=handleFileUpload,
        args=(tmpPath, destPath, organisation),
        daemon=True,
    )
    thread.start()
    return thread
