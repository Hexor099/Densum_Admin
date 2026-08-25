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
        
    encoded_msg = urllib.parse.quote(message)
    url = f"https://web.whatsapp.com/send?phone={phone}&text={encoded_msg}"
    
    # 1. Open URL in default browser on Windows
    print("Opening WhatsApp Web...")
    os.system(f'start "" "{url}"')
    
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

