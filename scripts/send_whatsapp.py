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
    
    log_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'temp', 'whatsapp_log.txt')
    def log(msg):
        with open(log_file, 'a') as f:
            f.write(f"{time.strftime('%X')} - {msg}\n")
        print(msg)

    # 3. Press Enter to send text message
    log("Pressing Enter to send text...")
    pyautogui.press('enter')
    
    # 4. If attachment_path is provided, attach it
    log(f"Attachment path provided: {attachment_path}")
    if attachment_path:
        log(f"Path exists: {os.path.exists(attachment_path)}")
    
    if attachment_path and os.path.exists(attachment_path):
        import subprocess
        log(f"Attaching file: {attachment_path}")
        time.sleep(1) # wait a moment before attaching
        
        # Copy file to clipboard using PowerShell with proper CF_HDROP format
        ps_script = f"""
Add-Type -AssemblyName System.Windows.Forms
$col = New-Object System.Collections.Specialized.StringCollection
$col.Add('{attachment_path}')
[System.Windows.Forms.Clipboard]::SetFileDropList($col)
"""
        log(f"Running powershell clipboard injection...")
        subprocess.run(["powershell", "-command", ps_script])
        time.sleep(1.5)
        
        # Paste file
        log("Pasting file with Ctrl+V...")
        pyautogui.hotkey('ctrl', 'v')
        time.sleep(3.5) # Wait for attachment preview to load
        
        # Press Enter to send attachment
        log("Pressing Enter to send attachment...")
        pyautogui.press('enter')
        time.sleep(4) # Wait for file to send
    else:
        # Wait 3 seconds for text message to send
        log("Waiting 3 seconds (no valid attachment)...")
        time.sleep(3)
        
    # Close tab
    log("Closing tab...")
    pyautogui.hotkey('ctrl', 'w')
    
    log("Success: Message sent")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Error: Missing arguments", file=sys.stderr)
        sys.exit(1)
        
    phone = sys.argv[1]
    msg = sys.argv[2]
    attachment_path = sys.argv[3] if len(sys.argv) > 3 else None
    
    send_whatsapp(phone, msg, attachment_path)

