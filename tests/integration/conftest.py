"""Cross-system integration tests against the real, pinned specialist packages.

They are collected only when ``MAKMA_INTEGRATION=1`` (the CI ``integration`` and
``media`` jobs install the eight packages from ``backend-lock.json`` first). When the
variable is set, a missing specialist package is an import error, i.e. a failing job,
never a skip.
"""

import os

collect_ignore_glob = [] if os.environ.get("MAKMA_INTEGRATION") == "1" else ["test_*.py"]
