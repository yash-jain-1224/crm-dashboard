"""Seed realistic, relational data for the CRM database."""

import argparse
import json
import random
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.models import (
    Account,
    CalendarEvent,
    Contact,
    EmailCampaign,
    Lead,
    Opportunity,
    Report,
    Task,
)


def _random_choice_weighted(choices):
    total = sum(w for _, w in choices)
    r = random.uniform(0, total)
    upto = 0
    for item, weight in choices:
        if upto + weight >= r:
            return item
        upto += weight
    return choices[-1][0]


def _dt_in_last_days(days: int) -> datetime:
    return datetime.utcnow() - timedelta(days=random.randint(0, max(days, 1)))


def wipe_all(db: Session):
    """Delete all rows in dependency-safe order."""
    db.query(Opportunity).delete(synchronize_session=False)
    db.query(Task).delete(synchronize_session=False)
    db.query(Contact).delete(synchronize_session=False)
    db.query(Lead).delete(synchronize_session=False)
    db.query(Account).delete(synchronize_session=False)
    db.query(CalendarEvent).delete(synchronize_session=False)
    db.query(EmailCampaign).delete(synchronize_session=False)
    db.query(Report).delete(synchronize_session=False)
    db.commit()


def seed_database(
    db: Session,
    accounts_count: int,
    contacts_per_account: int,
    leads_count: int,
    opportunities_per_account: int,
    tasks_per_contact: int,
    events_count: int,
    campaigns_count: int,
    reports_count: int,
):
    from faker import Faker

    fake = Faker()
    Faker.seed(42)
    random.seed(42)

    industries = [
        'Software', 'FinTech', 'Healthcare', 'Retail', 'Manufacturing', 'Logistics',
        'Education', 'Real Estate', 'Media', 'Telecommunications'
    ]
    lead_sources = ['Website', 'Referral', 'LinkedIn', 'Trade Show', 'Outbound', 'Partner', 'Other']
    lead_statuses = [
        ('New', 35),
        ('Contacted', 20),
        ('Qualified', 20),
        ('Proposal', 10),
        ('Negotiation', 8),
        ('Closed Won', 5),
        ('Closed Lost', 2),
    ]
    opp_stages = [
        ('Prospecting', 25),
        ('Qualification', 20),
        ('Proposal', 20),
        ('Negotiation', 15),
        ('Closed Won', 15),
        ('Closed Lost', 5),
    ]
    task_statuses = [('To Do', 45), ('In Progress', 30), ('Done', 25)]
    task_priorities = [('Low', 20), ('Medium', 55), ('High', 25)]

    owners = [fake.name() for _ in range(8)]

    print('🌱 Seeding CRM data...')

    # Accounts
    accounts = []
    used_account_names = set()
    for _ in range(accounts_count):
        name = fake.company()
        while name in used_account_names:
            name = fake.company()
        used_account_names.add(name)

        acc = Account(
            name=name,
            industry=random.choice(industries),
            revenue=random.choice(['$1M - $10M', '$10M - $50M', '$50M - $100M', '$100M+']),
            employees=random.randint(20, 5000),
            location=f"{fake.city()}, {fake.state_abbr()}",
            phone=fake.phone_number(),
            website=f"www.{''.join(ch for ch in name.lower() if ch.isalnum())[:18]}.com",
            account_owner=random.choice(owners),
            status=_random_choice_weighted([('Active', 90), ('Inactive', 10)]),
            created_at=_dt_in_last_days(365),
            updated_at=_dt_in_last_days(90),
        )
        accounts.append(acc)
        db.add(acc)
    db.commit()

    # Contacts (linked to accounts by company name)
    contacts = []
    used_emails = set()
    for acc in accounts:
        for _ in range(contacts_per_account):
            email = fake.unique.email()
            while email in used_emails:
                email = fake.unique.email()
            used_emails.add(email)

            created_at = _dt_in_last_days(365)
            c = Contact(
                name=fake.name(),
                email=email,
                phone=fake.phone_number(),
                company=acc.name,
                position=fake.job()[:80],
                location=acc.location,
                status=_random_choice_weighted([('Active', 85), ('Inactive', 15)]),
                last_contact=f"{random.randint(1, 30)} days ago",
                created_at=created_at,
                updated_at=created_at + timedelta(days=random.randint(0, 30)),
            )
            contacts.append(c)
            db.add(c)
    db.commit()

    # Leads (some associated with existing accounts; some new)
    leads = []
    for _ in range(leads_count):
        company = random.choice(accounts).name if random.random() < 0.7 else fake.company()
        status = _random_choice_weighted(lead_statuses)
        created_at = _dt_in_last_days(365)
        l = Lead(
            name=fake.name(),
            company=company,
            email=fake.unique.email(),
            phone=fake.phone_number(),
            source=random.choice(lead_sources),
            status=status,
            score=random.randint(0, 100),
            value=f"${random.randint(5_000, 250_000):,}",
            assigned_to=random.choice(owners),
            created_at=created_at,
            updated_at=created_at + timedelta(days=random.randint(0, 30)),
        )
        leads.append(l)
        db.add(l)
    db.commit()

    # Opportunities (linked to accounts and sometimes to a contact)
    opportunities = []
    for acc in accounts:
        acc_contacts = [c for c in contacts if c.company == acc.name]
        for _ in range(opportunities_per_account):
            stage = _random_choice_weighted(opp_stages)
            probability = {
                'Prospecting': 10,
                'Qualification': 30,
                'Proposal': 55,
                'Negotiation': 75,
                'Closed Won': 100,
                'Closed Lost': 0,
            }.get(stage, random.randint(10, 90))
            created_at = _dt_in_last_days(365)
            close_dt = (created_at + timedelta(days=random.randint(7, 120))).date().isoformat()
            contact = random.choice(acc_contacts) if acc_contacts and random.random() < 0.8 else None

            opp = Opportunity(
                name=f"{fake.bs().title()} - {fake.catch_phrase()[:60]}",
                account=acc.name,
                value=float(random.randint(5_000, 400_000)),
                stage=stage,
                probability=probability,
                close_date=close_dt,
                owner=acc.account_owner or random.choice(owners),
                contact_id=contact.id if contact else None,
                created_at=created_at,
                updated_at=created_at + timedelta(days=random.randint(0, 45)),
            )
            opportunities.append(opp)
            db.add(opp)
    db.commit()

    # Tasks (linked to contacts)
    for c in contacts:
        for _ in range(tasks_per_contact):
            status = _random_choice_weighted(task_statuses)
            created_at = _dt_in_last_days(120)
            due_dt = (created_at + timedelta(days=random.randint(1, 30))).date().isoformat()

            related = None
            if random.random() < 0.6:
                related = f"Contact: {c.name}"
            elif opportunities:
                opp = random.choice(opportunities)
                related = f"Opportunity: {opp.name}"

            t = Task(
                title=fake.sentence(nb_words=6)[:180],
                description=fake.paragraph(nb_sentences=3),
                priority=_random_choice_weighted(task_priorities),
                status=status,
                due_date=due_dt,
                assigned_to=random.choice(owners),
                related_to=related,
                contact_id=c.id,
                created_at=created_at,
                updated_at=created_at + timedelta(days=random.randint(0, 20)),
            )
            db.add(t)
    db.commit()

    # Calendar events
    for _ in range(events_count):
        start_dt = datetime.utcnow() + timedelta(days=random.randint(-30, 60), hours=random.randint(8, 17))
        end_dt = start_dt + timedelta(minutes=random.choice([30, 45, 60, 90]))
        attendees = ', '.join({fake.name() for _ in range(random.randint(2, 5))})
        ev = CalendarEvent(
            title=f"{random.choice(['Intro Call', 'Product Demo', 'QBR', 'Negotiation Meeting', 'Implementation Kickoff'])} - {fake.company()}",
            description=fake.paragraph(nb_sentences=4),
            event_type=random.choice(['Meeting', 'Call', 'Demo']),
            start_time=start_dt.strftime('%Y-%m-%d %H:%M'),
            end_time=end_dt.strftime('%Y-%m-%d %H:%M'),
            location=random.choice(['Zoom', 'Google Meet', 'Teams', fake.address().split('\n')[0]]),
            attendees=attendees,
            status=_random_choice_weighted([('Scheduled', 80), ('Completed', 15), ('Cancelled', 5)]),
            created_at=_dt_in_last_days(120),
            updated_at=_dt_in_last_days(30),
        )
        db.add(ev)
    db.commit()

    # Email campaigns
    for _ in range(campaigns_count):
        sent_count = random.randint(0, 50_000)
        open_rate = round(random.uniform(10, 60), 1) if sent_count > 0 else 0.0
        click_rate = round(random.uniform(1, 15), 1) if sent_count > 0 else 0.0
        conversion_rate = round(random.uniform(0.2, 5.0), 1) if sent_count > 0 else 0.0
        status = _random_choice_weighted([('Draft', 25), ('Scheduled', 25), ('Active', 20), ('Completed', 30)])
        sched = (datetime.utcnow() + timedelta(days=random.randint(-60, 30))).date().isoformat()
        camp = EmailCampaign(
            name=f"{fake.catch_phrase()[:70]}",
            subject=f"{fake.sentence(nb_words=8)[:120]}",
            status=status,
            sent_count=sent_count if status in {'Active', 'Completed'} else 0,
            open_rate=open_rate,
            click_rate=click_rate,
            conversion_rate=conversion_rate,
            scheduled_date=sched,
            created_at=_dt_in_last_days(180),
            updated_at=_dt_in_last_days(30),
        )
        db.add(camp)
    db.commit()

    # Reports (store snapshots as JSON text)
    for _ in range(reports_count):
        report_payload = {
            'generated_at': datetime.utcnow().isoformat(),
            'kpis': {
                'accounts': len(accounts),
                'contacts': len(contacts),
                'leads': len(leads),
                'opportunities': len(opportunities),
            },
        }
        r = Report(
            name=f"{fake.word().title()} {fake.word().title()} Report",
            report_type=random.choice(['Performance', 'Pipeline', 'Lead', 'Email']),
            description=fake.sentence(nb_words=12),
            data=json.dumps(report_payload),
            created_by=random.choice(owners),
            is_public=random.random() < 0.3,
            created_at=_dt_in_last_days(180),
            updated_at=_dt_in_last_days(30),
        )
        db.add(r)
    db.commit()

    print('🎉 Seeding complete!')


def main():
    parser = argparse.ArgumentParser(description='Seed realistic relational CRM data')
    parser.add_argument('--force', action='store_true', help='Wipe existing data before seeding')
    parser.add_argument('--accounts', type=int, default=40)
    parser.add_argument('--contacts-per-account', type=int, default=8)
    parser.add_argument('--leads', type=int, default=250)
    parser.add_argument('--opps-per-account', type=int, default=4)
    parser.add_argument('--tasks-per-contact', type=int, default=2)
    parser.add_argument('--events', type=int, default=80)
    parser.add_argument('--campaigns', type=int, default=35)
    parser.add_argument('--reports', type=int, default=12)
    args = parser.parse_args()

    db = SessionLocal()
    try:
        if args.force:
            wipe_all(db)
        else:
            # If already seeded, avoid double seeding
            if db.query(Contact).count() > 0:
                print('⚠️  Database already contains data. Use --force to reseed.')
                return

        seed_database(
            db,
            accounts_count=args.accounts,
            contacts_per_account=args.contacts_per_account,
            leads_count=args.leads,
            opportunities_per_account=args.opps_per_account,
            tasks_per_contact=args.tasks_per_contact,
            events_count=args.events,
            campaigns_count=args.campaigns,
            reports_count=args.reports,
        )
    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == '__main__':
    main()
