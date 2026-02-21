"""
Generate Excel file with multiple sheets containing 50,000 rows each
Following the schemas defined in schemas.py
"""

import pandas as pd
from faker import Faker
import random
from datetime import datetime, timedelta
import openpyxl
from openpyxl.utils import get_column_letter

fake = Faker()
Faker.seed(42)
random.seed(42)

# Number of rows per sheet
ROWS_PER_SHEET = 1000000

def generate_contacts(n=ROWS_PER_SHEET):
    """Generate contact data"""
    print(f"Generating {n} contacts...")
    contacts = []
    statuses = ["Active", "Inactive"]
    
    for i in range(n):
        contact = {
            "name": fake.name(),
            "email": fake.email(),
            "phone": fake.phone_number(),
            "company": fake.company(),
            "position": fake.job(),
            "location": f"{fake.city()}, {fake.state_abbr()}",
            "status": random.choice(statuses),
            "last_contact": (datetime.now() - timedelta(days=random.randint(0, 365))).strftime("%Y-%m-%d")
        }
        contacts.append(contact)
    
    return pd.DataFrame(contacts)


def generate_leads(n=ROWS_PER_SHEET):
    """Generate lead data"""
    print(f"Generating {n} leads...")
    leads = []
    sources = ["Website", "Referral", "Cold Call", "Email Campaign", "Social Media", "Trade Show", "Partner"]
    statuses = ["New", "Contacted", "Qualified", "Nurturing", "Lost"]
    
    for i in range(n):
        lead = {
            "name": fake.name(),
            "company": fake.company(),
            "email": fake.email(),
            "phone": fake.phone_number(),
            "source": random.choice(sources),
            "status": random.choice(statuses),
            "score": random.randint(0, 100),
            "value": f"${random.randint(1000, 100000):,}",
            "assigned_to": fake.name()
        }
        leads.append(lead)
    
    return pd.DataFrame(leads)


def generate_opportunities(n=ROWS_PER_SHEET):
    """Generate opportunity data"""
    print(f"Generating {n} opportunities...")
    opportunities = []
    stages = ["Prospecting", "Qualification", "Proposal", "Negotiation", "Closed Won", "Closed Lost"]
    probability_map = {
        "Prospecting": 10,
        "Qualification": 25,
        "Proposal": 50,
        "Negotiation": 75,
        "Closed Won": 100,
        "Closed Lost": 0
    }
    
    for i in range(n):
        stage = random.choice(stages)
        base_prob = probability_map[stage] + random.randint(-5, 5)
        probability = min(max(base_prob, 0), 100)  # Clamp between 0 and 100
        opportunity = {
            "name": f"{fake.company()} - {fake.catch_phrase()}",
            "account": fake.company(),
            "value": round(random.uniform(5000, 10000000), 2),
            "stage": stage,
            "probability": probability,
            "close_date": (datetime.now() + timedelta(days=random.randint(30, 365))).strftime("%Y-%m-%d"),
            "owner": fake.name(),
        }
        opportunities.append(opportunity)
    
    return pd.DataFrame(opportunities)


def generate_accounts(n=ROWS_PER_SHEET):
    """Generate account data"""
    print(f"Generating {n} accounts...")
    accounts = []
    industries = ["Technology", "Healthcare", "Finance", "Manufacturing", "Retail", "Education", "Real Estate", "Consulting"]
    revenue_ranges = ["$1M-$5M", "$5M-$10M", "$10M-$50M", "$50M-$100M", "$100M-$500M", "$500M+"]
    statuses = ["Active", "Inactive", "Prospect"]
    
    for i in range(n):
        account = {
            "name": fake.company(),
            "industry": random.choice(industries),
            "revenue": random.choice(revenue_ranges),
            "employees": random.randint(10, 10000),
            "location": f"{fake.city()}, {fake.state()}",
            "phone": fake.phone_number(),
            "website": fake.url(),
            "account_owner": fake.name(),
            "status": random.choice(statuses)
        }
        accounts.append(account)
    
    return pd.DataFrame(accounts)


def generate_tasks(n=ROWS_PER_SHEET):
    """Generate task data"""
    print(f"Generating {n} tasks...")
    tasks = []
    priorities = ["Low", "Medium", "High", "Urgent"]
    statuses = ["To Do", "In Progress", "Completed", "Cancelled"]
    task_types = ["Call", "Email", "Meeting", "Follow-up", "Demo", "Proposal", "Contract Review"]
    
    for i in range(n):
        task = {
            "title": f"{random.choice(task_types)} - {fake.company()}",
            "description": fake.sentence(nb_words=10),
            "priority": random.choice(priorities),
            "status": random.choice(statuses),
            "due_date": (datetime.now() + timedelta(days=random.randint(-30, 60))).strftime("%Y-%m-%d"),
            "assigned_to": fake.name(),
            "related_to": fake.company(),
        }
        tasks.append(task)
    
    return pd.DataFrame(tasks)


def generate_calendar_events(n=ROWS_PER_SHEET):
    """Generate calendar event data"""
    print(f"Generating {n} calendar events...")
    events = []
    event_types = ["Meeting", "Call", "Demo", "Conference", "Other"]
    statuses = ["Completed", "Scheduled", "Cancelled", "Rescheduled"]
    
    for i in range(n):
        start_time = datetime.now() + timedelta(days=random.randint(-60, 60), hours=random.randint(8, 17))
        end_time = start_time + timedelta(hours=random.randint(1, 3))
        
        event = {
            "title": f"{random.choice(event_types)} with {fake.company()}",
            "description": fake.sentence(nb_words=15),
            "event_type": random.choice(event_types),
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "location": random.choice([fake.address(), "Virtual", f"Conference Room {random.randint(1, 10)}"]),
            "attendees": ", ".join([fake.name() for _ in range(random.randint(2, 6))]),
            "status": random.choice(statuses)
        }
        events.append(event)
    
    return pd.DataFrame(events)


def generate_email_campaigns(n=ROWS_PER_SHEET):
    """Generate email campaign data"""
    print(f"Generating {n} email campaigns...")
    campaigns = []
    statuses = ["Draft", "Scheduled", "Sent", "Paused"]
    
    for i in range(n):
        status = random.choice(statuses)
        sent = status in ["Sent", "Completed"]
        
        campaign = {
            "name": f"{fake.catch_phrase()} Campaign {i+1}",
            "subject": fake.sentence(nb_words=8),
            "status": status,
            "sent_count": random.randint(100, 10000) if sent else 0,
            "open_rate": round(random.uniform(15, 45), 2) if sent else 0.0,
            "click_rate": round(random.uniform(2, 15), 2) if sent else 0.0,
            "conversion_rate": round(random.uniform(0.5, 5), 2) if sent else 0.0,
            "scheduled_date": (datetime.now() + timedelta(days=random.randint(-30, 30))).strftime("%Y-%m-%d")
        }
        campaigns.append(campaign)
    
    return pd.DataFrame(campaigns)


def generate_reports(n=ROWS_PER_SHEET):
    """Generate report data"""
    print(f"Generating {n} reports...")
    reports = []
    report_types = ["Sales", "Pipeline", "Activity", "Forecast", "Performance", "Revenue", "Customer"]
    
    for i in range(n):
        report = {
            "name": f"{random.choice(report_types)} Report - {fake.date_between(start_date='-1y', end_date='today')}",
            "report_type": random.choice(report_types),
            "description": fake.sentence(nb_words=12),
            "data": f"{{\"total\": {random.randint(1000, 100000)}, \"trend\": \"{random.choice(['up', 'down', 'stable'])}\", \"metrics\": {random.randint(10, 100)}}}",
            "created_by": fake.name(),
            "is_public": random.choice([True, False])
        }
        reports.append(report)
    
    return pd.DataFrame(reports)


def main():
    """Generate all data and save to separate Excel files"""
    print("Starting data generation...")
    print(f"Each file will contain {ROWS_PER_SHEET:,} rows\n")
    
    # Generate all dataframes
    contacts_df = generate_contacts()
    leads_df = generate_leads()
    opportunities_df = generate_opportunities()
    accounts_df = generate_accounts()
    tasks_df = generate_tasks()
    calendar_df = generate_calendar_events()
    campaigns_df = generate_email_campaigns()
    reports_df = generate_reports()

    # Define output files
    output_files = {
        'Contacts': ('Contacts.xlsx', contacts_df),
        'Leads': ('Leads.xlsx', leads_df),
        'Opportunities': ('Opportunities.xlsx', opportunities_df),
        'Accounts': ('Accounts.xlsx', accounts_df),
        'Tasks': ('Tasks.xlsx', tasks_df),
        'Calendar Events': ('Calendar_Events.xlsx', calendar_df),
        'Email Campaigns': ('Email_Campaigns.xlsx', campaigns_df),
        'Reports': ('Reports.xlsx', reports_df),
    }

    # Write each DataFrame to its own Excel file
    for name, (filename, df) in output_files.items():
        print(f"Writing {name} to {filename} ...")
        df.to_excel(filename, index=False)
        print(f"  - {filename} generated with {len(df):,} rows.")

    print("\n✅ Successfully generated all Excel files.")
    print("\nSummary:")
    for name, (filename, df) in output_files.items():
        print(f"  - {name}: {len(df):,} rows in {filename}")
    print(f"\nTotal rows: {sum(len(df) for _, (_, df) in output_files.items()):,}")


if __name__ == "__main__":
    main()
