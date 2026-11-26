"""Kernel-enforced write sandbox (Linux Landlock) for agent processes. No root, no chown, no ACLs.

restrict(write_roots, block_ports=(), scope_signals=True) confines the CURRENT process and every child it
starts: reads and execs stay unrestricted, but creating, writing, truncating, renaming or deleting files is
only possible beneath `write_roots`. Optionally blocks TCP connects to some ports and signals to processes
outside the sandbox. Restrictions can only be tightened later, never lifted.
"""
import ctypes, os, struct

SYS_CREATE, SYS_ADD, SYS_RESTRICT = 444, 445, 446          # x86_64 and aarch64 share these numbers
PR_SET_NO_NEW_PRIVS = 38
RULE_PATH_BENEATH, RULE_NET_PORT = 1, 2
WRITE_FILE, REMOVE_DIR, REMOVE_FILE = 1 << 1, 1 << 4, 1 << 5
MAKE_CHAR, MAKE_DIR, MAKE_REG, MAKE_SOCK, MAKE_FIFO, MAKE_BLOCK, MAKE_SYM = (1 << 6, 1 << 7, 1 << 8, 1 << 9,
                                                                            1 << 10, 1 << 11, 1 << 12)
REFER, TRUNCATE = 1 << 13, 1 << 14
NET_CONNECT_TCP = 1 << 1
SCOPE_SIGNAL = 1 << 1
FILE_ONLY = WRITE_FILE | TRUNCATE

_libc = ctypes.CDLL(None, use_errno=True)
_libc.syscall.restype = ctypes.c_long


def _sys(nr, *args):
    r = _libc.syscall(ctypes.c_long(nr), *args)
    if r < 0:
        e = ctypes.get_errno()
        raise OSError(e, os.strerror(e))
    return r


def abi():
    """Landlock ABI version supported here (0 if unavailable or blocked by seccomp)."""
    try:
        return _sys(SYS_CREATE, None, ctypes.c_size_t(0), ctypes.c_uint32(1))
    except OSError:
        return 0


def write_rights(v):
    r = WRITE_FILE | REMOVE_DIR | REMOVE_FILE | MAKE_CHAR | MAKE_DIR | MAKE_REG | MAKE_SOCK | MAKE_FIFO | MAKE_BLOCK | MAKE_SYM
    if v >= 2:
        r |= REFER
    if v >= 3:
        r |= TRUNCATE
    return r


def restrict(write_roots, block_ports=(), scope_signals=True):
    v = abi()
    if v < 1:
        raise OSError('Landlock is not available in this kernel/container')
    fs = write_rights(v)
    net = NET_CONNECT_TCP if (block_ports and v >= 4) else 0
    scoped = SCOPE_SIGNAL if (scope_signals and v >= 6) else 0
    attr = struct.pack('QQQ', fs, net, scoped)
    size = 24 if v >= 6 else 16 if v >= 4 else 8
    buf = ctypes.create_string_buffer(attr[:size], size)
    rfd = _sys(SYS_CREATE, buf, ctypes.c_size_t(size), ctypes.c_uint32(0))
    try:
        added = []
        for root in write_roots:
            try:
                fd = os.open(root, os.O_PATH | os.O_CLOEXEC)
            except OSError:
                continue  # missing paths are simply not writable
            try:
                rights = fs if os.path.isdir(root) else (FILE_ONLY & fs)
                pb = ctypes.create_string_buffer(struct.pack('=Qi', rights, fd), 12)
                _sys(SYS_ADD, ctypes.c_int(rfd), ctypes.c_int(RULE_PATH_BENEATH), pb, ctypes.c_uint32(0))
                added.append(root)
            finally:
                os.close(fd)
        if net:
            blocked = set(int(p) for p in block_ports)
            for port in range(0, 65536):  # allow-list every port except the blocked ones
                if port not in blocked:
                    np_ = ctypes.create_string_buffer(struct.pack('=QQ', NET_CONNECT_TCP, port), 16)
                    _sys(SYS_ADD, ctypes.c_int(rfd), ctypes.c_int(RULE_NET_PORT), np_, ctypes.c_uint32(0))
        if _libc.prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) != 0:
            e = ctypes.get_errno(); raise OSError(e, os.strerror(e))
        _sys(SYS_RESTRICT, ctypes.c_int(rfd), ctypes.c_uint32(0))
        return {'abi': v, 'write_roots': added, 'net_blocked': sorted(block_ports) if net else [],
                'signals_scoped': bool(scoped)}
    finally:
        os.close(rfd)


HOME_DIRS = ['.cache', '.npm', '.local', '.config', '.deno', '.cargo', '.pki', '.ipython', '.jupyter', '.matplotlib']
HOME_FILES = ['.bash_history', '.python_history', '.wget-hsts', '.lesshst']
SHARED = ['/tmp', '/var/tmp', '/dev', '/workspace/runs', '/workspace/usage', '/workspace/pages',
          '/workspace/desktop']  # desktop: browser profile, downloads, screenshots
BLOCK_PORTS = [int(p) for p in os.environ.get('JOB_SANDBOX_BLOCK_PORTS', '8000,8010').split(',') if p.strip()]


def home():
    h = os.path.expanduser('~')
    return h if h not in ('', '/') else '/home/openhands'


def job_write_roots(root):
    """Where a job's processes may write: its own folder, temp dirs, home caches and the shared append-only areas."""
    h = home()
    for d in HOME_DIRS:  # rules only attach to paths that exist, so create the cache dirs first
        try:
            os.makedirs(os.path.join(h, d), exist_ok=True)
        except OSError:
            pass
    return ([root] if root else []) + SHARED + [os.path.join(h, d) for d in HOME_DIRS + HOME_FILES]


def confine_to_job(root):
    info = restrict(job_write_roots(root), BLOCK_PORTS)
    os.environ['AGENT_SANDBOX'] = root or 'none'
    return info
