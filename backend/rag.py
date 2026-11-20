import os
import time
import ollama

try:
    from backend.processing import chromaClient, embeddingFunction
except ModuleNotFoundError:
    from processing import chromaClient, embeddingFunction

TOP_K = 3
DISTANCE_THRESHOLD = 0.8
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://100.70.198.100:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma4:12b")

ollamaClient = ollama.Client(host=OLLAMA_HOST)


def querySections(prompt: str, organisation: str) -> dict:
    try:
        collection = chromaClient.get_collection(
            name=organisation,
            embedding_function=embeddingFunction,
        )
    except Exception:
        return {}

    results = collection.query(
        query_texts=[prompt],
        n_results=TOP_K,
    )

    if not results or not results.get("distances") or not results["distances"][0]:
        return {}

    validIndices = [i for i, d in enumerate(results["distances"][0]) if d <= DISTANCE_THRESHOLD]
    filteredResults = {
        k: [v[0][i] for i in validIndices] if (isinstance(v, list) and v and isinstance(v[0], list)) else v
        for k, v in results.items()
    }
    return filteredResults


def generatePseudoAnswer(prompt: str) -> str:
    systemPrompt = (
        "You are an expert corporate knowledge assistant. "
        "Write a clear, factual, and detailed hypothetical document passage answering the user query. "
        "Assume you know the exact factual details and policies."
    )
    res = ollamaClient.generate(
        model=OLLAMA_MODEL,
        system=systemPrompt,
        prompt=prompt,
        think=False,
    )
    return res.response


def generateAnswerFromContext(prompt: str, contextText: str) -> str:
    systemPrompt = (
        "You are an assistant answering questions strictly based on the provided context sections. "
        "Do not assume or extrapolate anything not mentioned. "
        "Include proper citations at the end of relevant statements referencing the source in the format [Source: <fileName>, Page <pageNo>, Paragraph <paragraphNo>]. "
        "If you cannot answer the question strictly based on the context, output 'Not Covered.'."
    )
    ragPrompt = f"Context sections:\n```{contextText}```\n\nUser Question: ```{prompt}```\n\nAnswer:"
    res = ollamaClient.generate(
        model=OLLAMA_MODEL,
        system=systemPrompt,
        prompt=ragPrompt,
        think=False,
    )
    return res.response


def executeRag(prompt: str, organisation: str, useHyde: bool = False) -> dict:
    t0 = time.time()
    if useHyde:
        pseudoAnswer = generatePseudoAnswer(prompt)
        searchQuery = f"{prompt}\n{pseudoAnswer}"
    else:
        searchQuery = prompt
    t1 = time.time()
    
    results = querySections(searchQuery, organisation)
    t2 = time.time()

    metadatas = results.get("metadatas", [])
    distances = results.get("distances", [])
    documents = results.get("documents", [])

    citations = [
        {
            "fileName": meta.get("fileName"),
            "pageNo": meta.get("pageNo"),
            "paragraphNo": meta.get("paragraphNo"),
            "distance": dist,
        }
        for meta, dist in zip(metadatas, distances)
    ]

    contextText = "\n\n".join(
        f"[Source: {meta.get('fileName')}, Page: {meta.get('pageNo')}, Paragraph: {meta.get('paragraphNo')}]\n{doc}"
        for meta, doc in zip(metadatas, documents)
    )

    t3 = time.time()
    answer = generateAnswerFromContext(prompt, contextText)
    t4 = time.time()

    return {
        "citations": citations,
        "response": answer,
        "timeMetrics": {
            "pseudoAnswerTime": round(t1 - t0, 3),
            "queryingTime": round(t2 - t1, 3),
            "mainAnswerTime": round(t4 - t3, 3),
            "totalTime": round(t4 - t0, 3),
        },
    }
