#!/usr/bin/env python3
"""
TruthLens Backend — Entry Point

Usage:
    python run.py              # Start development server
    python run.py --prod       # Start production server
"""

import sys
import uvicorn


def main():
    is_prod = "--prod" in sys.argv
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=not is_prod,
        log_level="info" if not is_prod else "warning",
        workers=4 if is_prod else 1,
    )


if __name__ == "__main__":
    main()
