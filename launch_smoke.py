"""End-to-end Gradio launch smoke test.

For a single project: import the space app, launch the Gradio server on a
local port, curl the HTTP endpoint, verify 200 response, close.

This is what HF Spaces effectively does on each build.
"""
from __future__ import annotations

import importlib.util
import socket
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


def free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def main(repo_root: Path, app_relpath: str = "space/app.py") -> int:
    app_path = repo_root / app_relpath
    if not app_path.exists():
        print(f"FAIL: {app_path} not found")
        return 1

    spec = importlib.util.spec_from_file_location("space_app_under_test", app_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules["space_app_under_test"] = module
    try:
        spec.loader.exec_module(module)
    except Exception as exc:
        print(f"FAIL: import of {app_path} raised {type(exc).__name__}: {exc}")
        return 1

    if not hasattr(module, "build_ui"):
        print("FAIL: module has no build_ui()")
        return 1

    demo = module.build_ui()
    port = free_port()
    print(f"Launching on 127.0.0.1:{port}...")

    try:
        demo.launch(
            server_name="127.0.0.1",
            server_port=port,
            prevent_thread_lock=True,
            share=False,
            quiet=True,
            inbrowser=False,
        )
    except Exception as exc:
        print(f"FAIL: launch raised {type(exc).__name__}: {exc}")
        return 1

    # Poll the server for up to 12 seconds.
    url = f"http://127.0.0.1:{port}/"
    deadline = time.time() + 12.0
    last_exc = None
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2) as resp:
                code = resp.getcode()
                body = resp.read(2048).decode("utf-8", errors="ignore")
                print(f"OK: HTTP {code}")
                # Sanity: gradio embeds 'gradio' string in HTML body.
                if "gradio" in body.lower() or "<html" in body.lower():
                    print("OK: Gradio HTML detected in response body")
                else:
                    print("WARN: response body does not look like Gradio HTML")
                demo.close()
                return 0
        except (urllib.error.URLError, ConnectionResetError, ConnectionRefusedError) as exc:
            last_exc = exc
            time.sleep(0.5)

    print(f"FAIL: server did not respond on {url} within 12s; last error: {last_exc}")
    try:
        demo.close()
    except Exception:
        pass
    return 1


if __name__ == "__main__":
    repo = Path(sys.argv[1]).resolve()
    app_rel = sys.argv[2] if len(sys.argv) > 2 else "space/app.py"
    sys.exit(main(repo, app_rel))
