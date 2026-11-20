try:
    from backend.processing import chromaClient, embeddingFunction
except ModuleNotFoundError:
    from processing import chromaClient, embeddingFunction

TOP_K = 3
DISTANCE_THRESHOLD = 0.8


def querySections(prompt: str, organisation: str) -> list[dict]:
    try:
        collection = chromaClient.get_collection(
            name=organisation,
            embedding_function=embeddingFunction,
        )
    except Exception:
        return []

    results = collection.query(
        query_texts=[prompt],
        n_results=TOP_K,
    )

    citations = []
    if not results or not results.get("metadatas") or not results["metadatas"][0]:
        return citations

    metadatas = results["metadatas"][0]
    distances = results["distances"][0] if results.get("distances") else []

    for meta, dist in zip(metadatas, distances):
        if dist <= DISTANCE_THRESHOLD:
            citations.append({
                "fileName": meta.get("fileName"),
                "pageNo": meta.get("pageNo"),
                "paragraphNo": meta.get("paragraphNo"),
            })

    return citations
