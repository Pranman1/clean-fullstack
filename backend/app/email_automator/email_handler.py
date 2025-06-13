import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from datetime import datetime
from typing import Dict, Any

class EmailHandler:
    def __init__(self):
        # Email config - should be moved to environment variables in production
        self.sender_email = os.getenv("EMAIL_SENDER", "example@gmail.com")
        self.sender_password = os.getenv("EMAIL_PASSWORD", "xxxx xxxx xxxx xxxx")
        self.receiver_email = os.getenv("EMAIL_RECEIVER", "ronit@cinesis.ai")

    def format_load_for_email(self, load_data: Dict[str, Any]) -> str:
        """
        Format load data into a readable email format
        """
        if not load_data or 'list' not in load_data:
            return "No loads found matching criteria."

        email_content = "New Load Opportunities Found:\n\n"
        
        for load in load_data['list']:
            email_content += f"Load ID: {load.get('entry_id', 'N/A')}\n"
            email_content += f"Origin: {load.get('origin_city', 'N/A')}, {load.get('origin_state', 'N/A')}\n"
            email_content += f"Destination: {load.get('destination_city', 'N/A')}, {load.get('destination_state', 'N/A')}\n"
            email_content += f"Equipment Type: {', '.join(load.get('trailer_type', ['N/A']))}\n"
            
            # Handle pay_rate specifically
            pay_rate = load.get('pay_rate')
            if pay_rate is not None:
                email_content += f"Rate: ${pay_rate:,.2f}\n"
            else:
                email_content += "Rate: Not Available\n"
                
            email_content += f"Pickup Date: {load.get('ship_date', 'N/A')}\n"
            
            # Handle trip_miles specifically
            trip_miles = load.get('trip_miles')
            if trip_miles is not None:
                email_content += f"Distance: {trip_miles:,} miles\n"
            else:
                email_content += "Distance: Not Available\n"
                
            # Handle weight specifically
            weight = load.get('weight')
            if weight is not None:
                email_content += f"Weight: {weight:,} lbs\n"
            else:
                email_content += "Weight: Not Available\n"
                
            email_content += "-" * 50 + "\n\n"

        email_content += f"\nTotal Loads Found: {len(load_data['list'])}\n"
        email_content += f"Page {load_data.get('page_number', 1)} of {load_data.get('total_pages', 1)}\n"

        return email_content

    def save_and_send_email(self, load_data: Dict[str, Any]) -> bool:
        """
        Save load data to a file and send it via email
        """
        if not load_data:
            print("No load data to process")
            return False

        try:
            # Format the email content
            email_content = self.format_load_for_email(load_data)
            
            # Create email message
            message = MIMEMultipart()
            message['From'] = self.sender_email
            message['To'] = self.receiver_email
            
            # Add timestamp to subject to prevent email threading
            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            message['Subject'] = f"New Load Opportunities Found! - {current_time}"
            
            # Add body
            message.attach(MIMEText(email_content, 'plain'))
            print("Message created successfully")
            
            # Start SMTP session
            print("Connecting to SMTP server...")
            server = smtplib.SMTP('smtp.gmail.com', 587)
            server.starttls()
            print("Connected to SMTP server")
            
            # Login with credentials
            server.login(self.sender_email, self.sender_password)
            print("Login successful")
            
            # Send email
            text = message.as_string()
            server.sendmail(self.sender_email, self.receiver_email, text)
            print("Email sent successfully!")
            
            return True
            
        except Exception as e:
            print(f"Error sending email: {str(e)}")
            return False
            
        finally:
            try:
                server.quit()
                print("SMTP connection closed")
            except:
                pass 