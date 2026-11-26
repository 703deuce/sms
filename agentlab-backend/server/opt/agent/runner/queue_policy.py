"""Queue admission: front-desk jobs skip the helper cap; helpers stay FIFO-capped.

Classification uses only structured fields (source, kind, parent_conversation_id).
Never prompt text.
"""


def _get(run, key, default=None):
    if isinstance(run, dict):
        return run.get(key, default)
    keys = run.keys() if hasattr(run, 'keys') else ()
    if key in keys:
        return run[key]
    try:
        return run[key]
    except Exception:
        return default


def is_frontdesk(run):
    """Top-level customer job (page chat or POST /runs with source=user). Not a helper."""
    source = _get(run, 'source')
    parent = _get(run, 'parent_conversation_id')
    return source == 'user' and not parent


def is_capped(run):
    """Helpers (including visual-owner and vision), routines, webhooks, reminders, and any child run.

    These count toward max_concurrent. Anything that is not a top-level customer job is capped.
    """
    return not is_frontdesk(run)


def is_nested_child(run, running):
    """A queued run whose parent conversation is itself a running capped run (a helper's own helper or visual owner).

    The parent usually waits on it (`helper result --wait`, `visual-owner result --wait`) while holding its slot,
    so without a reserve a full cap of waiting parents can never start their children (deadlock)."""
    parent = _get(run, 'parent_conversation_id')
    if not parent:
        return False
    return any(_get(x, 'conversation_id') == parent and is_capped(x) for x in running)


def select_queued_to_start(queued, running, helper_limit, frontdesk_limit, nested_reserve=0):
    """Pick which queued runs should start now, preserving FIFO within each class.

    queued must already be in created_at order. Front-desk runs are never blocked by
    the helper cap; a front-desk flood is limited by frontdesk_limit. Helpers and
    other background work are limited by helper_limit (max_concurrent). Children of a
    running helper may also use up to nested_reserve extra slots, so a helper waiting
    on its own child can never freeze the queue.
    """
    helper_busy = sum(1 for r in running if is_capped(r))
    frontdesk_busy = sum(1 for r in running if is_frontdesk(r))
    front_slots = max(0, int(frontdesk_limit) - frontdesk_busy)
    helper_slots = max(0, int(helper_limit) - helper_busy)
    reserve_slots = max(0, int(helper_limit) + int(nested_reserve or 0) - max(helper_busy, int(helper_limit)))

    # children of running helpers first (stable: FIFO within each group)
    queued = sorted(queued, key=lambda r: 0 if (not is_frontdesk(r) and is_nested_child(r, running)) else 1)
    chosen = []
    for r in queued:
        if is_frontdesk(r):
            if front_slots > 0:
                chosen.append(r)
                front_slots -= 1
        elif is_nested_child(r, running) and (helper_slots > 0 or reserve_slots > 0):
            # a parent waiting on this child already holds a slot: let the child jump the FIFO line
            chosen.append(r)
            if helper_slots > 0:
                helper_slots -= 1
            else:
                reserve_slots -= 1
        elif helper_slots > 0:
            chosen.append(r)
            helper_slots -= 1
    return chosen
