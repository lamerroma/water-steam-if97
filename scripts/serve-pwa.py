"""Serve a packaged static PWA on loopback without internet or Python packages."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse


class PWAHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.wasm': 'application/wasm',
        '.webmanifest': 'application/manifest+json',
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8080)
    args = parser.parse_args()
    # The repository script serves dist/; the ZIP copy sits next to index.html.
    location = Path(__file__).resolve().parent
    directory = location if (location / 'index.html').is_file() else location.parent / 'dist'
    if not (directory / 'index.html').is_file():
        parser.error('PWA files missing. Run npm run build or unpack the complete ZIP.')
    with ThreadingHTTPServer(('127.0.0.1', args.port), partial(PWAHandler, directory=str(directory))) as server:
        print(f'PWA: http://localhost:{server.server_port}/ (Ctrl+C to stop)', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
