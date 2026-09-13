"""
SlowAPI Rate Limiter Configuration
Protects backend routes from brute-force attacks, resource exhaustion, and API abuse.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

# Global limiter instance utilizing client IP address as identification key
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["120/minute"],
    headers_enabled=True,
    strategy="fixed-window",
)
