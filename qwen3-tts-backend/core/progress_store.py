from typing import Dict

_store: Dict[int, dict] = {}


def _ensure(project_id: int) -> dict:
    if project_id not in _store:
        _store[project_id] = {"lines": [], "done": False}
    return _store[project_id]


def reset(project_id: int) -> None:
    _store[project_id] = {"lines": [], "done": False}


def append_line(project_id: int, text: str) -> None:
    s = _ensure(project_id)
    s["lines"].append(text)


def append_token(project_id: int, token: str) -> None:
    s = _ensure(project_id)
    if s["lines"]:
        s["lines"][-1] += token
    else:
        s["lines"].append(token)


def mark_done(project_id: int) -> None:
    s = _ensure(project_id)
    s["done"] = True


def get_snapshot(project_id: int) -> dict:
    s = _store.get(project_id)
    if not s:
        return {"lines": [], "done": True}
    return {"lines": list(s["lines"]), "done": s["done"]}
