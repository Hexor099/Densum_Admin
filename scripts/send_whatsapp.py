import sys
import time
import urllib.parse
import os

def send_whatsapp(phone, message):
    try:
        import pyautogui
    except ImportError:
        print("Error: pyautogui is not installed. Run 'pip install pyautogui'", file=sys.stderr)
        sys.exit(1)

    if not phone.startswith("+"):
        phone = "+91" + phone
        
    import pyautogui
    pyautogui.FAILSAFE = False
    
    # 2. Wait 15 seconds for WhatsApp Web to load
    print("Waiting 15 seconds for page to load...")
    time.sleep(15)
    
    # 3. Press Enter to send
    print("Pressing Enter...")
    pyautogui.press('enter')
    
    # 4. Wait 3 seconds for message to send, then close tab
    time.sleep(3)
    pyautogui.hotkey('ctrl', 'w')
    
    print("Success: Message sent")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Error: Missing arguments", file=sys.stderr)
        sys.exit(1)
        
    phone = sys.argv[1]
    msg = sys.argv[2]
    
    send_whatsapp(phone, msg)

