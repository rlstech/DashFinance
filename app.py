from flask import Flask, render_template, request, jsonify, redirect, url_for
from db import get_ap, get_receitas
from datetime import datetime
import json, os

app = Flask(__name__)

CACHE_FILE = os.path.join(os.path.dirname(__file__), 'cache.json')

# ─────────────────────────────────
# CACHE CENTRALIZADO
# ─────────────────────────────────
_cache = {
    'ap':        [],
    'receitas':  [],
    'last_sync': None,
    'de':        None,
    'ate':       None,
}

def _load_cache():
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, encoding='utf-8') as f:
                _cache.update(json.load(f))
        except Exception:
            pass

def _startup_sync():
    """Busca todos os dados do banco se o cache estiver vazio."""
    if not _cache['ap'] and not _cache['receitas']:
        de, ate = '2020-01-01', '2030-12-31'
        _cache['ap']        = get_ap(de, ate)
        _cache['receitas']  = get_receitas(de, ate)
        _cache['de']        = de
        _cache['ate']       = ate
        _cache['last_sync'] = datetime.now().strftime('%d/%m/%Y %H:%M')
        try:
            with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump(_cache, f, ensure_ascii=False)
        except Exception:
            pass

_load_cache()
_startup_sync()


# ─────────────────────────────────
# PÁGINAS
# ─────────────────────────────────
@app.route('/')
def index():
    return redirect(url_for('page_ap'))

@app.route('/ap')
def page_ap():
    return render_template('dashboard_ap.html')

@app.route('/receitas')
def page_receitas():
    return render_template('dashboard_receitas.html')

@app.route('/fluxo')
def page_fluxo():
    return render_template('dashboard_fluxo.html')


# ─────────────────────────────────
# API — SINCRONIZAÇÃO GLOBAL
# ─────────────────────────────────
@app.route('/api/sync')
def api_sync():
    """Busca AP + Receitas do banco (range completo), armazena em cache e retorna metadados."""
    de  = '2020-01-01'
    ate = '2030-12-31'
    _cache['ap']        = get_ap(de, ate)
    _cache['receitas']  = get_receitas(de, ate)
    _cache['de']        = de
    _cache['ate']       = ate
    _cache['last_sync'] = datetime.now().strftime('%d/%m/%Y %H:%M')
    try:
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(_cache, f, ensure_ascii=False)
    except Exception:
        pass
    return jsonify({
        'ok':             True,
        'last_sync':      _cache['last_sync'],
        'count_ap':       len(_cache['ap']),
        'count_receitas': len(_cache['receitas']),
    })

@app.route('/api/status')
def api_status():
    """Retorna metadados do cache atual (sem buscar no banco)."""
    return jsonify({
        'last_sync':      _cache['last_sync'],
        'de':             _cache['de'],
        'ate':            _cache['ate'],
        'count_ap':       len(_cache['ap']),
        'count_receitas': len(_cache['receitas']),
    })


# ─────────────────────────────────
# API — DADOS (apenas do cache; sync somente via /api/sync)
# ─────────────────────────────────
@app.route('/api/ap')
def api_ap():
    return jsonify(_cache['ap'])

@app.route('/api/receitas')
def api_receitas():
    return jsonify(_cache['receitas'])


if __name__ == '__main__':
    app.run(debug=True, port=5000)
