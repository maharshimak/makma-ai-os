"""Post-deployment HTTP verification of the release and all nine stable product URLs."""

import json
import os
import time
import urllib.request

base = (
    os.environ.get("LIVE_BASE_URL", "https://maharshimak.github.io/makma-ai-os/").rstrip("/") + "/"
)
commit = os.environ.get("GITHUB_SHA")
paths = [
    "",
    "projects/",
    *[
        "projects/" + slug + "/"
        for slug in (
            "agentic-rag-engine",
            "multimodal-ai-studio",
            "knowledge-twin",
            "clinical-document-intelligence",
            "secure-data-copilot",
            "llm-eval-observability",
            "mlops-control-plane",
            "mlops-production-pipeline",
        )
    ],
]
for attempt in range(12):
    try:
        with urllib.request.urlopen(
            base + "release.json?verify=" + str(time.time_ns()), timeout=20
        ) as response:
            release = json.load(response)
        if commit and release["commit"] != commit:
            raise ValueError("Release SHA has not propagated yet")
        for path in paths:
            with urllib.request.urlopen(base + path, timeout=20) as response:
                html = response.read().decode()
            if (
                "<title>" not in html
                or "MAK" not in html
                or (path not in ("", "projects/") and "tool-root" not in html)
            ):
                raise ValueError("Missing application marker: " + path)
            print("HTTP PASS", base + path)
        print("Release verified:", release["commit"])
        break
    except (OSError, ValueError) as error:
        if attempt == 11:
            raise
        print("Waiting for Pages propagation:", error, flush=True)
        time.sleep(10)
