from typing import Dict

_store: Dict[str, dict] = {}


def _ensure(key: str) -> dict:
    if key not in _store:
        _store[key] = {"lines": [], "done": False}
    return _store[key]


def reset(key: str) -> None:
    _store[key] = {"lines": [], "done": False}


def append_line(key: str, text: str) -> None:
    s = _ensure(key)
    s["lines"].append(text)


def append_token(key: str, token: str) -> None:
    s = _ensure(key)
    if s["lines"]:
        s["lines"][-1] += token
    else:
        s["lines"].append(token)


def mark_done(key: str) -> None:
    s = _ensure(key)
    s["done"] = True


def get_snapshot(key: str) -> dict:
    s = _store.get(key)
    if not s:
        return {"lines": [], "done": True}
    return {"lines": list(s["lines"]), "done": s["done"]}
