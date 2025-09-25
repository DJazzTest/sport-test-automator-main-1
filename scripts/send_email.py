#!/usr/bin/env python3
import os
import sys
import smtplib
import xml.etree.ElementTree as ET
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
import json

# Configuration - Update these with your email settings
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SENDER_EMAIL = os.getenv('SMTP_USER', 'your-email@gmail.com')
SENDER_PASSWORD = os.getenv('SMTP_PASSWORD', 'your-app-password')
# Comma-separated recipients via env or default list
RECIPIENTS = [e.strip() for e in os.getenv('RECIPIENTS', 'your-email@example.com').split(',') if e.strip()]

# Environment variables from GitLab CI
CI_PROJECT_NAME = os.getenv('CI_PROJECT_NAME', 'Playwright Tests')
CI_PIPELINE_URL = os.getenv('CI_PIPELINE_URL', '#')
CI_COMMIT_MESSAGE = os.getenv('CI_COMMIT_MESSAGE', 'No commit message')
CI_COMMIT_AUTHOR = os.getenv('CI_COMMIT_AUTHOR', 'Unknown')

def parse_junit_xml(xml_file):
    """Parse JUnit XML and return test results."""
    try:
        tree = ET.parse(xml_file)
        root = tree.getroot()
        
        results = {
            'total': int(root.attrib.get('tests', 0)),
            'passed': 0,
            'failed': 0,
            'skipped': 0,
            'errors': 0,
            'test_cases': []
        }
        
        for testcase in root.findall('.//testcase'):
            test_name = f"{testcase.attrib.get('classname', '')} - {testcase.attrib.get('name', '')}"
            status = 'passed'
            
            if testcase.find('failure') is not None:
                status = 'failed'
                results['failed'] += 1
            elif testcase.find('skipped') is not None:
                status = 'skipped'
                results['skipped'] += 1
            else:
                results['passed'] += 1
                
            results['test_cases'].append({
                'name': test_name,
                'status': status,
                'time': float(testcase.attrib.get('time', 0))
            })
            
        return results
    except Exception as e:
        print(f"Error parsing JUnit XML: {e}")
        return None

def send_email(results, job_status):
    """Send email with test results."""
    if not results:
        print("No test results to send")
        return False

    # Create the email message
    subject = f"{CI_PROJECT_NAME} - Test Results: {job_status.upper()}"
    
    # Format the email body
    body = f"""
    <h2>🚀 Test Execution Report</h2>
    <p><strong>Project:</strong> {CI_PROJECT_NAME}</p>
    <p><strong>Status:</strong> <span style="color: {'green' if job_status == 'success' else 'red'}">{job_status.upper()}</span></p>
    <p><strong>Pipeline:</strong> <a href="{CI_PIPELINE_URL}">View Pipeline</a></p>
    <p><strong>Commit:</strong> {CI_COMMIT_MESSAGE}</p>
    <p><strong>Author:</strong> {CI_COMMIT_AUTHOR}</p>
    <p><strong>Timestamp:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
    
    <h3>📊 Test Summary</h3>
    <ul>
        <li>✅ Passed: {results['passed']}</li>
        <li>❌ Failed: {results['failed']}</li>
        <li>⏩ Skipped: {results['skipped']}</li>
        <li>📊 Total: {results['total']}</li>
        <li>🎯 Success Rate: {int((results['passed'] / results['total']) * 100 if results['total'] > 0 else 100)}%</li>
    </ul>
    
    <h3>🔍 Detailed Results</h3>
    <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;">
        <tr>
            <th>Test Case</th>
            <th>Status</th>
            <th>Duration (s)</th>
        </tr>
    """
    
    # Add test cases to the table
    for test in results['test_cases']:
        status_emoji = '✅' if test['status'] == 'passed' else '❌' if test['status'] == 'failed' else '⏩'
        body += f"""
        <tr>
            <td>{test['name']}</td>
            <td>{status_emoji} {test['status'].upper()}</td>
            <td>{test['time']:.2f}s</td>
        </tr>
        """
    
    # Optional details section (e.g., Passed/Failed lists)
    extra_details = os.getenv('EMAIL_DETAILS_HTML')
    if extra_details:
        body += f"""
    <h3>📝 Details</h3>
    {extra_details}
        """

    body += """
    </table>
    
    <p>This is an automated message. Please do not reply.</p>
    """
    
    # Create message container
    msg = MIMEMultipart()
    msg['From'] = SENDER_EMAIL
    msg['To'] = ", ".join(RECIPIENTS)
    msg['Subject'] = subject
    
    # Attach the HTML body
    msg.attach(MIMEText(body, 'html'))
    
    try:
        # Send the email
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.send_message(msg)
        print("Email notification sent successfully")
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False

def send_html_email(subject: str, html_body: str) -> bool:
    msg = MIMEMultipart()
    msg['From'] = SENDER_EMAIL
    msg['To'] = ", ".join(RECIPIENTS)
    msg['Subject'] = subject
    msg.attach(MIMEText(html_body, 'html'))
    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.send_message(msg)
        print("Email notification sent successfully")
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False

def main():
    # Raw HTML mode: python send_email.py --html <subject> <html>
    if len(sys.argv) >= 4 and sys.argv[1] == "--html":
        subject = sys.argv[2]
        html_body = sys.argv[3]
        send_html_email(subject, html_body)
        return
    # Simple mode: python send_email.py --simple <status> <subject> <body>
    if len(sys.argv) >= 5 and sys.argv[1] == "--simple":
        job_status = sys.argv[2]
        subject_override = sys.argv[3]
        body_override = sys.argv[4]
        # Enhanced simple mode supports counts and lists via env vars
        passed_list = [s for s in os.getenv('SIMPLE_PASSED_LIST', '').split(';') if s.strip()]
        failed_list = [s for s in os.getenv('SIMPLE_FAILED_LIST', '').split(';') if s.strip()]
        passed_count = int(os.getenv('SIMPLE_PASSED_COUNT', str(len(passed_list) if passed_list else 0)))
        failed_count = int(os.getenv('SIMPLE_FAILED_COUNT', str(len(failed_list) if failed_list else 0)))
        total = passed_count + failed_count if (passed_count + failed_count) > 0 else 1

        # Build optional details HTML from lists
        details_html = ""
        if passed_list:
            details_html += "<p><strong>✅ Passed events:</strong><br>" + "<br>".join(map(lambda x: x.strip(), passed_list)) + "</p>"
        if failed_list:
            details_html += "<p><strong>❌ Failed events:</strong><br>" + "<br>".join(map(lambda x: x.strip(), failed_list)) + "</p>"
        if details_html:
            os.environ['EMAIL_DETAILS_HTML'] = details_html

        # Wrap provided subject/body in our standard template
        results_stub = {
            'total': total,
            'passed': passed_count,
            'failed': failed_count,
            'skipped': 0,
            'errors': 0,
            'test_cases': [{ 'name': subject_override, 'status': 'passed' if failed_count == 0 else 'failed', 'time': 0.0 }]
        }
        global CI_COMMIT_MESSAGE
        CI_COMMIT_MESSAGE = subject_override + " | " + body_override
        send_email(results_stub, job_status)
        return

    if len(sys.argv) < 3:
        print("Usage: python send_email.py <junit_xml_file> <job_status>")
        sys.exit(1)
    
    xml_file = sys.argv[1]
    job_status = sys.argv[2]
    
    if not os.path.exists(xml_file):
        print(f"Error: File not found: {xml_file}")
        sys.exit(1)
    
    results = parse_junit_xml(xml_file)
    if results:
        send_email(results, job_status)
    else:
        print("No test results to process")
        
    # Also save results as JSON for debugging
    with open('test-results/summary.json', 'w') as f:
        json.dump(results, f, indent=2)

if __name__ == "__main__":
    main()
