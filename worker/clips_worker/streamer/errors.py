class RetryableError(RuntimeError):
    """Transient failure — job attempts counter may retry."""


class PermanentError(RuntimeError):
    """Non-retryable stream failure — write StreamVod.error + FAILED project."""
