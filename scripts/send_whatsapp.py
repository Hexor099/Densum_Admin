import sys
import pywhatkit as kit
import time

def send_whatsapp(phone_number, message):
    try:
        if not phone_number.startswith("+"):
            phone_number = "+91" + phone_number
        
        # Send message instantly and close tab after 3 seconds
        kit.sendwhatmsg_instantly(phone_number, message, wait_time=15, tab_close=True, close_time=3)
        print("Success: Message sent")
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Error: Missing arguments", file=sys.stderr)
        sys.exit(1)
        
    phone = sys.argv[1]
    msg = sys.argv[2]
    
    send_whatsapp(phone, msg)
