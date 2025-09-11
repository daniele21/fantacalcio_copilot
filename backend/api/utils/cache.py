import functools
import hashlib
import time
import sys
from functools import lru_cache
from flask import request

def cache_api_lru(maxsize=128, ttl=60*24):
    def decorator(func):
        # Create a separate cache dictionary that respects TTL
        cache_data = {}
        cache_times = {}
        
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Create a stable key from only serializable arguments
            key_parts = []
            for arg in args:
                if hasattr(arg, '__dict__'):
                    key_parts.append(f"<object:{type(arg).__name__}>")
                else:
                    key_parts.append(str(arg))
            
            for k, v in kwargs.items():
                if hasattr(v, '__dict__'):
                    key_parts.append(f"{k}=<object:{type(v).__name__}>")
                else:
                    key_parts.append(f"{k}={v}")
            
            key = "|".join(key_parts)
            key_hash = hashlib.sha256(key.encode()).hexdigest()
            now = time.time()
            
            # Check if we have cached data and it's still valid
            if key_hash in cache_data and key_hash in cache_times:
                if now - cache_times[key_hash] < ttl:
                    print(f"\033[92m[Cache HIT] {request.path} | key={key_hash[:8]}... | age={now - cache_times[key_hash]:.1f}s | params={key[:50]}...\033[0m", file=sys.stderr)
                    return cache_data[key_hash]
                else:
                    # TTL expired, remove from cache
                    print(f"\033[93m[Cache EXPIRED] {request.path} | key={key_hash[:8]}... | age={now - cache_times[key_hash]:.1f}s\033[0m", file=sys.stderr)
                    del cache_data[key_hash]
                    del cache_times[key_hash]
            
            print(f"\033[91m[Cache MISS] {request.path} | key={key_hash[:8]}... | params={key[:50]}...\033[0m", file=sys.stderr)
            
            # Call function and cache result
            result = func(*args, **kwargs)
            
            # Implement simple LRU: if cache is full, remove oldest entry
            if len(cache_data) >= maxsize:
                oldest_key = min(cache_times.keys(), key=lambda k: cache_times[k])
                del cache_data[oldest_key]
                del cache_times[oldest_key]
                print(f"\033[94m[Cache EVICT] {request.path} | evicted oldest entry\033[0m", file=sys.stderr)
            
            # Store the result
            cache_data[key_hash] = result
            cache_times[key_hash] = now
            
            return result
        
        # Expose cache info for monitoring
        def cache_info():
            return {
                'hits': len([k for k in cache_times.keys() if time.time() - cache_times[k] < ttl]),
                'misses': 0,  # We don't track misses separately
                'maxsize': maxsize,
                'currsize': len(cache_data)
            }
        
        wrapper.cache_info = cache_info
        return wrapper
    return decorator
