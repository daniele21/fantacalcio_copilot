import functools
import hashlib
import time
import sys
from functools import lru_cache
from flask import request

def cache_api_lru(maxsize=128, ttl=60*24):
    def decorator(func):
        cached_func = lru_cache(maxsize=maxsize)(func)
        cache_times = {}
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            key = str(args) + str(kwargs)
            key_hash = hashlib.sha256(key.encode()).hexdigest()
            now = time.time()
            # Check TTL
            if key_hash in cache_times and now - cache_times[key_hash] < ttl:
                print(f"\033[92m[Cache HIT] {request.path} | key={key_hash}\033[0m", file=sys.stderr)
                return cached_func(*args, **kwargs)
            else:
                print(f"\033[91m[Cache MISS] {request.path} | key={key_hash}\033[0m", file=sys.stderr)
            # Call and cache
            result = func(*args, **kwargs)
            cached_func.cache_clear()  # Clear LRU cache to avoid memory leak
            cached_func(*args, **kwargs)  # Store dummy value to keep LRU logic
            cache_times[key_hash] = now
            return result
        # Expose cache_info for monitoring
        wrapper.cache_info = cached_func.cache_info
        return wrapper
    return decorator
