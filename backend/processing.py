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


def processFileAsync(filePath: str | Path, organisation: str):
    thread = threading.Thread(target=processFile, args=(filePath, organisation), daemon=True)
    thread.start()
    return thread
