import sys
import time
import urllib.parse
import os

def send_whatsapp(phone, message, attachment_path=None):
    try:
        import pyautogui
    except ImportError:
        print("Error: pyautogui is not installed. Run 'pip install pyautogui'", file=sys.stderr)
        sys.exit(1)

    if not phone.startswith("+"):
        phone = "+91" + phone
        
    pyautogui.FAILSAFE = False
    
    # 2. Wait 15 seconds for WhatsApp Web to load
    print("Waiting 15 seconds for page to load...")
    time.sleep(15)
    
    # 3. Press Enter to send text message
    print("Pressing Enter to send text...")
    pyautogui.press('enter')
    
    # 4. If attachment_path is provided, attach it
    if attachment_path and os.path.exists(attachment_path):
        import subprocess
        print(f"Attaching file: {attachment_path}")
        time.sleep(1) # wait a moment before attaching
        
        # Copy file to clipboard using PowerShell
        subprocess.run(["powershell", "-command", f"Set-Clipboard -Path '{attachment_path}'"])
        time.sleep(1.5)
        
        # Paste file
        pyautogui.hotkey('ctrl', 'v')
        time.sleep(3.5) # Wait for attachment preview to load
        
        # Press Enter to send attachment
        pyautogui.press('enter')
        time.sleep(4) # Wait for file to send
    else:
        # Wait 3 seconds for text message to send
        time.sleep(3)
        
    # Close tab
    pyautogui.hotkey('ctrl', 'w')
    
    print("Success: Message sent")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Error: Missing arguments", file=sys.stderr)
        sys.exit(1)
        
    phone = sys.argv[1]
    msg = sys.argv[2]
    attachment_path = sys.argv[3] if len(sys.argv) > 3 else None
    
    send_whatsapp(phone, msg, attachment_path)

