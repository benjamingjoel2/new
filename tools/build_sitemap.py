#!/usr/bin/env python3
"""Regenerate sitemap.xml and robots.txt from the pages in this folder.

Run from the site root (the folder that holds index.html):  python3 tools/build_sitemap.py
Every folder with an index.html is a page. A page is listed when its own
<link rel="canonical"> points at itself, which skips duplicates and aliases
(e.g. /explore -> /destination, /home -> /). Cart, search, 404 and the blog's
category/tag filter pages are never listed.
"""
import os, re, sys, subprocess, html, datetime
from urllib.parse import urljoin

SITE = 'https://www.persocal.com/'
ROOT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
SKIP_DIRS = {'.git', '.github', '_assets', 'search', 'theme', 'tools', 'node_modules'}
SKIP_PAGES = {'cart', 'searchbox', 'search', 'login', 'log-in', '404'}
SKIP_PREFIXES = ('newsroom/category/', 'newsroom/tag/', 'safari/parks/tag/')
NOINDEX_RE = re.compile(r'<meta\s+name="robots"\s+content="[^"]*noindex', re.I)

def page_dirs():
    for d, dirs, files in os.walk(ROOT):
        dirs[:] = sorted(x for x in dirs if x not in SKIP_DIRS)
        if 'index.html' in files:
            yield os.path.relpath(d, ROOT).replace(os.sep, '/').strip('.').strip('/')

def canonical_self(rel):
    path = os.path.join(ROOT, rel, 'index.html') if rel else os.path.join(ROOT, 'index.html')
    h = open(path, encoding='utf-8', errors='replace').read(200000)
    if NOINDEX_RE.search(h): return False        # hidden from search engines on purpose
    m = re.search(r'<link[^>]+rel="canonical"[^>]+href="([^"]*)"', h) or re.search(r'<link[^>]+href="([^"]*)"[^>]+rel="canonical"', h)
    if not m: return True                       # no canonical: treat as its own page
    href = html.unescape(m.group(1))
    base = SITE + (rel + '/' if rel else '')
    target = urljoin(base, href)
    target = re.sub(r'index\.html$', '', target)
    if not target.endswith('/'): target += '/'
    return target == base

def lastmods():
    """Last commit date per page folder, from git (one pass). Empty if no git."""
    out = {}
    try:
        log = subprocess.run(['git', 'log', '--format=%x00%cs', '--name-only', '--', '.'], cwd=ROOT,
                             capture_output=True, text=True, check=True).stdout
    except Exception:
        return out
    date = None
    for line in log.splitlines():
        if line.startswith('\x00'): date = line[1:]; continue
        line = line.strip()
        if line.endswith('index.html') and date:
            rel = line[:-len('index.html')].strip('/')
            out.setdefault(rel, date)
    return out

def main():
    urls = []
    for rel in page_dirs():
        top = rel.split('/')[0] if rel else ''
        if top in SKIP_PAGES or rel.startswith(SKIP_PREFIXES): continue
        if not canonical_self(rel): continue
        urls.append(rel)
    urls.sort(key=lambda r: (r != '', r))
    lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for rel in urls:
        loc = SITE + (rel + '/' if rel else '')
        lines.append('  <url><loc>%s</loc></url>' % html.escape(loc, quote=True))
    lines.append('</urlset>')
    open(os.path.join(ROOT, 'sitemap.xml'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    open(os.path.join(ROOT, 'robots.txt'), 'w', encoding='utf-8').write('User-agent: *\nAllow: /\n\nSitemap: %ssitemap.xml\n' % SITE)
    print('sitemap.xml: %d urls' % len(urls))

if __name__ == '__main__':
    main()
