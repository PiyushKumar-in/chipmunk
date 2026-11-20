import argparse
import json
import os
from pathlib import Path
import subprocess
import time
from bert_score import BERTScorer
import numpy as np
import requests
from rouge_score import rouge_scorer

BASE_DIR = Path(__file__).parent.parent
DB_DIR = BASE_DIR / "database"
TESTS_DIR = BASE_DIR / "tests"
PDF_V1_DIR = TESTS_DIR / "data" / "pdf" / "v1"
PDF_V2_DIR = TESTS_DIR / "data" / "pdf" / "v2"
PERF_DIR = TESTS_DIR / "tests" / "performance"
RESULTS_ROOT = TESTS_DIR / "results"

CONTAINER_NAME = "chipmunk-backend-eval"
BACKEND_URL = "http://127.0.0.1:8000"
ADMIN_PASSWORD = "eval_admin_pw"
SECRET_KEY = "eval_secret_key_at_least_32_bytes_long"
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://100.70.198.100:11434")


def stopContainer():
    print(f"Stopping container '{CONTAINER_NAME}' if running...")
    subprocess.run(["podman", "rm", "-f", CONTAINER_NAME], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def cleanDatabase():
    stopContainer()
    print("[1] Cleaning database folder (preserving .gitadd)...")
    DB_DIR.mkdir(parents=True, exist_ok=True)
    for item in DB_DIR.iterdir():
        if item.name == ".gitadd":
            continue
        if item.is_dir():
            subprocess.run(["rm", "-rf", str(item)], check=True)
        else:
            item.unlink(missing_ok=True)


def startContainer():
    print("[2] Starting backend container with Podman...")
    cmd = [
        "podman", "run", "-d",
        "--name", CONTAINER_NAME,
        "-p", "8000:8000",
        "-v", f"{DB_DIR}:/app/database:Z",
        "-e", f"ADMIN_PASSWORD={ADMIN_PASSWORD}",
        "-e", f"SECRET_KEY={SECRET_KEY}",
        "-e", f"OLLAMA_HOST={OLLAMA_HOST}",
        "localhost/chipmunk-backend:latest",
    ]
    subprocess.run(cmd, check=True)

    print("Waiting for backend container to be healthy...")
    for _ in range(30):
        try:
            r = requests.get(f"{BACKEND_URL}/", timeout=2)
            if r.status_code == 200:
                print("Backend is ready.")
                return
        except Exception:
            pass
        time.sleep(1)
    raise RuntimeError("Backend failed to start")


def login(org: str, username: str, password: str) -> str:
    r = requests.post(f"{BACKEND_URL}/login", json={
        "organisation": org,
        "userName": username,
        "password": password,
    }, timeout=10)
    r.raise_for_status()
    return r.json()["accessToken"]


def createUser(rootToken: str, org: str, username: str, password: str):
    r = requests.post(f"{BACKEND_URL}/createUser",
                      headers={"Authorization": f"Bearer {rootToken}"},
                      json={"organisation": org, "userName": username, "password": password},
                      timeout=10)
    r.raise_for_status()


def uploadFile(token: str, filePath: Path):
    with open(filePath, "rb") as f:
        r = requests.post(f"{BACKEND_URL}/upload",
                          headers={"Authorization": f"Bearer {token}"},
                          files={"file": (filePath.name, f, "application/pdf")},
                          timeout=30)
    r.raise_for_status()


def warmup(token: str, useHyde: bool = False):
    print(f"Running warmup query (useHyde={useHyde}) to force loading of LLM weights to GPU...")
    try:
        t0 = time.time()
        requests.post(f"{BACKEND_URL}/app",
                      headers={"Authorization": f"Bearer {token}"},
                      json={"prompt": "Warmup question: Are transport facilities provided?", "useHyde": useHyde},
                      timeout=120)
        print(f"Warmup completed in {round(time.time() - t0, 2)}s.")
    except Exception as e:
        print(f"Warmup notice: {e}")


def runEvaluation(token: str, testJsonl: Path, outputFile: Path, useHyde: bool = False, limit: int | None = None) -> list[dict]:
    print(f"Evaluating {testJsonl.name} -> {outputFile.name} (useHyde={useHyde})...")
    records = []
    with open(testJsonl, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                records.append(json.loads(line))

    if limit is not None:
        records = records[:limit]

    results = []
    with open(outputFile, "w", encoding="utf-8") as outF:
        for idx, item in enumerate(records, 1):
            question = item.get("question") or item.get("input")
            expected = item.get("expected_answer") or item.get("expected")

            t0 = time.time()
            respData = {}
            try:
                r = requests.post(f"{BACKEND_URL}/app",
                                  headers={"Authorization": f"Bearer {token}"},
                                  json={"prompt": question, "useHyde": useHyde},
                                  timeout=120)
                r.raise_for_status()
                respData = r.json()
                modelAnswer = respData.get("response", "")
                totalTime = respData.get("timeMetrics", {}).get("totalTime", round(time.time() - t0, 3))
            except Exception as e:
                modelAnswer = f"ERROR: {e}"
                totalTime = round(time.time() - t0, 3)

            entry = {
                "question": question,
                "expected": expected,
                "actual": modelAnswer,
                "totalTime": totalTime,
                "timeMetrics": respData.get("timeMetrics", {}),
            }
            results.append(entry)
            outF.write(json.dumps(entry) + "\n")
            print(f"  [{idx}/{len(records)}] Time: {totalTime}s | Q: {question[:55]}...")
    return results


def evaluateResultsFile(resultJsonl: Path, rougeScorerInstance=None, bertScorerInstance=None) -> dict:
    records = []
    with open(resultJsonl, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                records.append(json.loads(line))

    valid = [r for r in records if not r["actual"].startswith("ERROR:")]
    if not valid:
        return {"error": "No valid results to compute metrics"}

    predictions = [r["actual"] for r in valid]
    references = [r["expected"] for r in valid]

    # ROUGE
    scorer = rougeScorerInstance or rouge_scorer.RougeScorer(["rouge1", "rouge2", "rougeL"], use_stemmer=True)
    r1, r2, rl = [], [], []
    for pred, ref in zip(predictions, references):
        sc = scorer.score(ref, pred)
        r1.append(sc["rouge1"].fmeasure)
        r2.append(sc["rouge2"].fmeasure)
        rl.append(sc["rougeL"].fmeasure)

    # BERTScore
    bScorer = bertScorerInstance or BERTScorer(lang="en")
    P, R, F1 = bScorer.score(predictions, references, verbose=False)

    times = [r["totalTime"] for r in valid]
    p95Time = round(float(np.percentile(times, 95)), 3) if times else 0.0

    metrics = {
        "count": len(valid),
        "avgTime": round(sum(times) / len(times), 3),
        "p95Time": p95Time,
        "rouge1": round(sum(r1) / len(r1), 4),
        "rouge2": round(sum(r2) / len(r2), 4),
        "rougeL": round(sum(rl) / len(rl), 4),
        "bertScoreP": round(P.mean().item(), 4),
        "bertScoreR": round(R.mean().item(), 4),
        "bertScoreF1": round(F1.mean().item(), 4),
    }
    return metrics


def computeAllMetrics(targetDir: Path):
    allResultFiles = {
        "aethertech_v1": targetDir / "aethertech_v1_results.jsonl",
        "nexacore_v1": targetDir / "nexacore_v1_results.jsonl",
        "vanguard_v1": targetDir / "vanguard_v1_results.jsonl",
        "aethertech_v2": targetDir / "aethertech_v2_results.jsonl",
    }

    print("\n" + "=" * 50)
    print(f"Computing ROUGE, BERTScore, and p95 metrics for {targetDir}...")
    print("=" * 50)

    rougeScorerInstance = rouge_scorer.RougeScorer(["rouge1", "rouge2", "rougeL"], use_stemmer=True)
    bertScorerInstance = BERTScorer(lang="en")

    allSummary = {}
    for suiteName, resultFile in allResultFiles.items():
        if not resultFile.exists():
            continue
        print(f"Scoring {suiteName} ({resultFile.name})...")
        metrics = evaluateResultsFile(resultFile, rougeScorerInstance, bertScorerInstance)
        allSummary[suiteName] = metrics
        print(f"Results for {suiteName}:")
        print(json.dumps(metrics, indent=2))

    summaryPath = targetDir / "evaluation_summary.json"
    with open(summaryPath, "w", encoding="utf-8") as f:
        json.dump(allSummary, f, indent=2)

    print("\n" + "=" * 50)
    print("FINAL EVALUATION SUMMARY:")
    print(json.dumps(allSummary, indent=2))
    print(f"Summary saved to: {summaryPath}")
    print("=" * 50)
    return allSummary


def main():
    parser = argparse.ArgumentParser(description="Evaluate backend performance")
    parser.add_argument("--use-hyde", "--hyde", action="store_true", help="Enable HyDE pseudo-answer generation in RAG")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of queries per test")
    parser.add_argument("--score-only", action="store_true", help="Only compute metrics from existing result files")
    args = parser.parse_args()

    mode = "hyde" if args.use_hyde else "baseline"
    targetDir = RESULTS_ROOT / mode
    targetDir.mkdir(parents=True, exist_ok=True)

    if args.score_only:
        computeAllMetrics(targetDir)
        return

    try:
        # Step 1: Clean DB and Start Container
        cleanDatabase()
        startContainer()

        rootToken = login("root", "admin", ADMIN_PASSWORD)

        # Step 2: Create organisations with dummy admin users and upload policies
        orgConfigs = {
            "aethertech": PDF_V1_DIR / "aethertech_policy.pdf",
            "nexacore": PDF_V1_DIR / "nexacore_policy.pdf",
            "vanguard": PDF_V1_DIR / "vanguard_policy.pdf",
        }

        print(f"\n[3] Creating organisations, admin users, and uploading v1 policies ({mode})...")
        for org, pdfPath in orgConfigs.items():
            adminUser = f"{org}_admin"
            adminPass = "pw123"
            createUser(rootToken, org, adminUser, adminPass)
            tok = login(org, adminUser, adminPass)
            uploadFile(tok, pdfPath)
            print(f"Uploaded {pdfPath.name} for {org}")

        # Additional warmup user
        createUser(rootToken, "warmup_org", "warmup_admin", "pw123")
        warmupToken = login("warmup_org", "warmup_admin", "pw123")
        uploadFile(warmupToken, PDF_V1_DIR / "aethertech_policy.pdf")
        print("Uploaded policy for warmup_org")

        print("Waiting 3s for background vector indexing...")
        time.sleep(3)

        # Step 3: Warmup run
        warmup(warmupToken, useHyde=args.use_hyde)

        # Step 4: Login as different users and run respective performance tests
        testSuites = [
            ("aethertech_v1", "aethertech", PERF_DIR / "aethertech_v1_eval.jsonl", targetDir / "aethertech_v1_results.jsonl"),
            ("nexacore_v1", "nexacore", PERF_DIR / "nexacore_v1_eval.jsonl", targetDir / "nexacore_v1_results.jsonl"),
            ("vanguard_v1", "vanguard", PERF_DIR / "vanguard_v1_eval.jsonl", targetDir / "vanguard_v1_results.jsonl"),
        ]

        print(f"\n[4] Running evaluation tests for v1 organisations ({mode})...")
        for suiteName, org, testFile, outFile in testSuites:
            print(f"\n--- Running evaluation for {suiteName} ({org}, useHyde={args.use_hyde}) ---")
            userToken = login(org, f"{org}_admin", "pw123")
            runEvaluation(userToken, testFile, outFile, useHyde=args.use_hyde, limit=args.limit)

        # Step 5: Update aethertech policy to v2, warmup on other user, and run v2 test
        print("\n[5] Updating aethertech policy to v2...")
        aethertechToken = login("aethertech", "aethertech_admin", "pw123")
        uploadFile(aethertechToken, PDF_V2_DIR / "aethertech_policy.pdf")
        print("Waiting 3s for background vector indexing...")
        time.sleep(3)

        print(f"\nRunning warmup run on warmup user (useHyde={args.use_hyde})...")
        warmup(warmupToken, useHyde=args.use_hyde)

        v2TestFile = TESTS_DIR / "tests" / "aethertech_v2_comparison_eval.jsonl"
        if not v2TestFile.exists():
            v2TestFile = PERF_DIR / "aethertech_v1_eval.jsonl"

        print(f"\n--- Running evaluation for aethertech (v2) with {v2TestFile.name} (useHyde={args.use_hyde}) ---")
        outV2File = targetDir / "aethertech_v2_results.jsonl"
        runEvaluation(aethertechToken, v2TestFile, outV2File, useHyde=args.use_hyde, limit=args.limit)

        # Step 6: Post-pipeline scoring (compare all model outputs with ground truth)
        computeAllMetrics(targetDir)

    finally:
        stopContainer()


if __name__ == "__main__":
    main()
