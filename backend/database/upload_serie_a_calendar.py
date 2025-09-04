import os
import csv
from tqdm import tqdm
from google.cloud import firestore


def upload_serie_a_calendar_to_firestore(csv_path):
    """
    Uploads Serie A calendar from a CSV file to Firestore.
    Each match is stored as a document in the 'serie_a_calendar' collection, using match_id as document ID.
    Firestore project and database are read from environment variables, with sensible defaults.
    """
    # Firestore config from env
    firestore_db = os.environ.get('FIRESTORE_DB_NAME', 'fantacopilot-db')
    firestore_project = os.environ.get('FIRESTORE_PROJECT', 'fantacalcio-project')
    db = firestore.Client(project=firestore_project, database=firestore_db)
    print(f"Using Firestore database: {firestore_db}, project: {firestore_project}")

    # Optionally: delete all docs in 'serie_a_calendar' collection first
    calendar_ref = db.collection('serie_a_calendar')
    docs = calendar_ref.stream()
    delete_count = 0
    for doc in tqdm(docs, desc='Deleting old calendar docs'):
        doc.reference.delete()
        delete_count += 1
    print(f"Deleted {delete_count} existing docs from 'serie_a_calendar' collection.")

    # Read CSV and upload
    with open(csv_path, newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile, delimiter=';')
        # Fix BOM in header if present
        if reader.fieldnames and reader.fieldnames[0].startswith('\ufeff'):
            reader.fieldnames[0] = reader.fieldnames[0].replace('\ufeff', '')
        rows = list(reader)

    # Group matches by matchday
    from collections import defaultdict
    matchdays = defaultdict(list)
    for row in rows:
        matchday = row.get('matchday')
        # Remove empty fields and trailing whitespace, ignore empty keys
        match_data = {k: v.strip() for k, v in row.items() if v and k and k != ''}
        matchdays[matchday].append(match_data)

    # Upload each matchday as a document containing all matches for that day, and the min date
    from datetime import datetime
    batch = db.batch()
    for matchday, matches in matchdays.items():
        # Find the minimum date among all matches for this matchday
        dates = []
        for m in matches:
            date_str = m.get('date') or m.get('data')
            if date_str:
                try:
                    # Try parsing with common formats (adjust as needed)
                    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y/%m/%d", "%d/%m/%y %H:%M"):  # add more if needed
                        try:
                            dt = datetime.strptime(date_str, fmt)
                            dates.append(dt)
                            break
                        except ValueError:
                            continue
                except Exception:
                    pass
        min_date = min(dates).strftime("%Y-%m-%d") if dates else None
        doc_ref = db.collection('serie_a_calendar').document(str(matchday))
        doc_data = {"matches": matches}
        if min_date:
            doc_data["date"] = min_date
        else:
            pass
        batch.set(doc_ref, doc_data, merge=True)
    batch.commit()
    print(f"Inserted {len(matchdays)} matchday docs into 'serie_a_calendar' collection.")

if __name__ == "__main__":
    # Example usage
    csv_path = os.environ.get('SERIE_A_CALENDAR_CSV',
        os.path.join(os.path.dirname(__file__), '../data/serie-a-calendar.csv'))
    upload_serie_a_calendar_to_firestore(csv_path)
