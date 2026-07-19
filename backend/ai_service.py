import os
import re
import requests

def _load_env():
    base = os.path.dirname(os.path.abspath(__file__))
    for name in ('.env', '../.env'):
        path = os.path.join(base, name)
        if not os.path.isfile(path):
            continue
        with open(path, encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                key, val = line.split('=', 1)
                os.environ.setdefault(key.strip(), val.strip().strip('"\''))


_load_env()

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
GROQ_API_KEY = os.getenv('GROQ_API_KEY', '')
GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-2.0-flash')
GROQ_MODEL = os.getenv('GROQ_MODEL', 'llama-3.3-70b-versatile')


def build_system_prompt(language: str, ticker: str, timeframe: str, exchange: str, context: dict | None = None) -> str:
    lang = 'Pine Script v5' if language == 'pine' else 'Python pandas'
    context_lines = []
    if context:
        selected_coin = context.get('selectedCoin') or ticker
        exchange_name = context.get('exchange') or exchange
        tf = context.get('timeframe') or timeframe
        editor_mode = context.get('editorMode') or language
        live_price = context.get('livePrice')
        market_status = context.get('marketStatus') or 'Connected'
        active_tab = context.get('activeTab') or 'Performance Summary'
        context_lines.append(f"Current trading view: symbol={selected_coin}, exchange={exchange_name}, timeframe={tf}, editor={editor_mode}, marketStatus={market_status}, activeTab={active_tab}")
        if live_price is not None:
            context_lines.append(f"Last price={live_price}")
    context_block = '\n'.join(context_lines)
    return (
        f"You are an expert trading strategy assistant for CADPRO dashboard.\n"
        f"Exchange: {exchange}. Symbol: {ticker}. Timeframe: {timeframe}.\n"
        f"{context_block}\n"
        f"Write {lang} only. For Pine use //@version=5 and strategy() or indicator().\n"
        f"For Python define strategy(df) returning list of trades with profit key.\n"
        f"When providing code, wrap it in a single ```{'pine' if language == 'pine' else 'python'} fenced block.\n"
        f"Be concise. Explain briefly then give code."
    )


def extract_code_block(text: str, language: str):
    if not text:
        return None
    fence = 'pine' if language == 'pine' else 'python'
    pattern = rf'```(?:{fence}|)\s*\n?(.*?)```'
    match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return None


def call_gemini(system: str, user: str) -> str:
    if not GEMINI_API_KEY:
        raise ValueError('GEMINI_API_KEY missing. Add it to backend/.env')
    url = (
        f'https://generativelanguage.googleapis.com/v1beta/models/'
        f'{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}'
    )
    payload = {
        'contents': [
            {
                'role': 'user',
                'parts': [{'text': f'{system}\n\n---\n\n{user}'}],
            }
        ],
        'generationConfig': {'temperature': 0.4, 'maxOutputTokens': 4096},
    }
    resp = requests.post(url, json=payload, timeout=60)
    data = resp.json()
    if not resp.ok:
        err = data.get('error', {}).get('message', resp.text)
        raise ValueError(f'Gemini error: {err}')
    candidates = data.get('candidates') or []
    if not candidates:
        raise ValueError('Gemini returned no response')
    parts = candidates[0].get('content', {}).get('parts') or []
    text = ''.join(p.get('text', '') for p in parts)
    if not text.strip():
        raise ValueError('Gemini empty response')
    return text.strip()


def call_groq(system: str, user: str) -> str:
    if not GROQ_API_KEY:
        raise ValueError('GROQ_API_KEY missing. Add it to backend/.env')
    resp = requests.post(
        'https://api.groq.com/openai/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {GROQ_API_KEY}',
            'Content-Type': 'application/json',
        },
        json={
            'model': GROQ_MODEL,
            'messages': [
                {'role': 'system', 'content': system},
                {'role': 'user', 'content': user},
            ],
            'temperature': 0.4,
            'max_tokens': 4096,
        },
        timeout=60,
    )
    data = resp.json()
    if not resp.ok:
        err = data.get('error', {}).get('message', resp.text)
        raise ValueError(f'Groq error: {err}')
    choices = data.get('choices') or []
    if not choices:
        raise ValueError('Groq returned no response')
    text = choices[0].get('message', {}).get('content', '')
    if not text.strip():
        raise ValueError('Groq empty response')
    return text.strip()


def _jarvis_candidate_urls() -> list[str]:
    urls = []
    for raw in [os.getenv('JARVIS_API_URL', ''), 'http://127.0.0.1:8000/api/chat', 'http://localhost:8000/api/chat', 'http://127.0.0.1:5000/api/chat', 'http://localhost:5000/api/chat']:
        url = (raw or '').strip()
        if url and url not in urls:
            urls.append(url)
    return urls


def call_jarvis(system: str, user: str) -> str:
    timeout_seconds = float(os.getenv('JARVIS_TIMEOUT_SECONDS', '60'))
    candidate_urls = _jarvis_candidate_urls()
    if not candidate_urls:
        raise ValueError('JARVIS_API_URL missing')

    last_error = None
    for jarvis_api_url in candidate_urls:
        try:
            payload = {
                'messages': [
                    {'role': 'user', 'content': f'{system}\n\n---\n\n{user}'},
                ]
            }
            resp = requests.post(jarvis_api_url, json=payload, timeout=timeout_seconds)
            data = resp.json() if resp.content else {}
            if not resp.ok:
                last_error = data.get('detail') or data.get('message') or resp.text
                continue
            message = data.get('message') or {}
            text = message.get('content', '')
            if not str(text).strip():
                last_error = 'Jarvis empty response'
                continue
            return str(text).strip()
        except Exception as exc:
            last_error = str(exc)
    raise ValueError(f'Jarvis error: {last_error or "No local AI endpoint replied"}')



def run_ai_assist(
    provider: str,
    prompt: str,
    language: str,
    ticker: str,
    timeframe: str,
    exchange: str,
    code: str = '',
    mode: str = 'chat',
    context: dict | None = None,
) -> dict:
    system = build_system_prompt(language, ticker, timeframe, exchange, context)

    mode_hints = {
        'generate': 'Generate a complete trading strategy from scratch.',
        'fix': 'Fix bugs and improve this strategy. Return the full corrected code.',
        'explain': 'Explain what this strategy does in simple terms. No code unless asked.',
        'optimize': 'Optimize this strategy for better risk/reward. Return improved full code.',
    }
    mode_text = mode_hints.get(mode, '')

    user_parts = []
    if mode_text:
        user_parts.append(mode_text)
    if prompt.strip():
        user_parts.append(prompt.strip())
    if code.strip() and mode in ('fix', 'optimize', 'explain', 'chat'):
        user_parts.append(f'Current code:\n```{language}\n{code.strip()}\n```')

    user_message = '\n\n'.join(user_parts) or 'Help me with a trading strategy.'

    provider = (provider or 'groq').lower()
    if provider == 'gemini':
        reply = call_gemini(system, user_message)
    elif provider == 'jarvis':
        # Jarvis adapter uses an OpenAI-like chat format for system+user.
        reply = call_jarvis(system, user_message)
    else:
        reply = call_groq(system, user_message)

    extracted = extract_code_block(reply, language)

    # Always return normalized response so frontend can rely on {reply, code}.
    return {
        'reply': reply,
        'code': extracted,
        'provider': provider,
    }



def ai_status() -> dict:
    jarvis_urls = _jarvis_candidate_urls()
    return {
        'gemini': bool(GEMINI_API_KEY),
        'groq': bool(GROQ_API_KEY),
        'jarvis': bool(jarvis_urls),
        'gemini_model': GEMINI_MODEL,
        'groq_model': GROQ_MODEL,
        'jarvis_api_url': jarvis_urls[0] if jarvis_urls else '',
    }

