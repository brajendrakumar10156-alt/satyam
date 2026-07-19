#!/usr/bin/env python3
"""
Auto-generate OTPs for testing without needing to request from login form.
Run this in a separate terminal while your app is running.
"""

import sys
import time
sys.path.insert(0, '.')

from auth_store import create_session

def auto_generate_otps(email='saty@gmail.com', interval=65):
    """
    Generate a new OTP every N seconds automatically.
    
    Args:
        email: Email to generate OTP for
        interval: Seconds between each OTP generation (default 65, must respect 60s rate limit)
    """
    print(f"\n{'='*60}")
    print(f"🚀 AUTO OTP GENERATOR")
    print(f"{'='*60}")
    print(f"📧 Email: {email}")
    print(f"⏱️  Interval: {interval} seconds (rate limit: 60s)")
    print(f"👀 Watch OTP in another terminal: npm run otp-watcher")
    print(f"❌ Press Ctrl+C to stop\n")
    
    count = 0
    try:
        while True:
            try:
                result = create_session(email)
                session_id = result['sessionId']
                delivery = result['delivery']
                
                count += 1
                print(f"\n[{count}] ✅ NEW OTP GENERATED")
                print(f"    Session: {session_id[:20]}...")
                print(f"    Delivery: {delivery['channel']}")
                print(f"    ⏳ Next OTP in {interval} seconds...\n")
                
                # Wait before next generation (must be > 60 seconds for rate limit)
                for remaining in range(interval, 0, -1):
                    print(f"\r    Waiting... {remaining}s", end='', flush=True)
                    time.sleep(1)
                print("\n")
                
            except Exception as e:
                error_msg = str(e)
                if 'wait' in error_msg.lower():
                    # Extract wait time from error message
                    try:
                        wait_sec = int(''.join(filter(str.isdigit, error_msg.split('wait')[1].split('s')[0])))
                        print(f"\r    Rate limited! Waiting {wait_sec}s...         ", end='', flush=True)
                        time.sleep(wait_sec + 1)
                        print("\n")
                    except:
                        time.sleep(interval)
                else:
                    print(f"\n❌ Error: {error_msg}")
                    time.sleep(interval)
    
    except KeyboardInterrupt:
        print(f"\n\n{'='*60}")
        print(f"⏹️  Stopped. Generated {count} OTPs total.")
        print(f"{'='*60}\n")

if __name__ == '__main__':
    # Customize these:
    EMAIL = 'saty@gmail.com'
    INTERVAL_SECONDS = 65  # Must be > 60 (rate limit cooldown)
    
    auto_generate_otps(email=EMAIL, interval=INTERVAL_SECONDS)

