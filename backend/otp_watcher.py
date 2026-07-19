#!/usr/bin/env python3
"""
OTP Watcher - Displays OTP in a dedicated terminal window.
Run this in a separate terminal alongside the main backend server.
"""

import os
import time
import sys
from pathlib import Path

OTP_FILE = Path(__file__).parent / '.otp_current.txt'


def set_terminal_title(title):
    """Set the terminal window title."""
    if os.name == 'nt':  # Windows
        os.system(f'title {title}')
    else:  # Linux/Mac
        sys.stdout.write(f'\033]0;{title}\007')
        sys.stdout.flush()


def clear_screen():
    """Clear the terminal screen."""
    os.system('cls' if os.name == 'nt' else 'clear')


def display_otp():
    """Display the current OTP if it exists."""
    if OTP_FILE.exists():
        try:
            with open(OTP_FILE, 'r') as f:
                content = f.read().strip()
            if content:
                email, otp, timestamp = content.split('|')
                age = int(time.time()) - int(timestamp)
                return email, otp, age
        except:
            pass
    return None, None, None


def main():
    """Main loop to watch and display OTP."""
    set_terminal_title('OTP')  # Set terminal title to "OTP"
    clear_screen()
    last_content = None
    
    print("=" * 60)
    print("🔐 OTP WATCHER - Dedicated OTP Display Terminal 🔐")
    print("=" * 60)
    print("\nWaiting for OTP requests...\n")
    
    try:
        while True:
            email, otp, age = display_otp()
            
            if otp and (last_content != otp):
                clear_screen()
                print("=" * 60)
                print("🔐 OTP FOR LOGIN 🔐")
                print("=" * 60)
                print(f"\n📧 Email: {email}")
                print(f"\n🔑 OTP: {otp}")
                print(f"\n⏱️  Age: {age} seconds")
                print("\n" + "=" * 60)
                print("✅ Copy this OTP and enter it in the login form")
                print("=" * 60 + "\n")
                last_content = otp
            
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n\n👋 OTP Watcher stopped.")
        sys.exit(0)


if __name__ == '__main__':
    main()
