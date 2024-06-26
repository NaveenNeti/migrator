import sqlite3

# Connect to the SQLite database
conn = sqlite3.connect('test.db')

# Create a cursor object
c = conn.cursor()

# Execute SQL commands to create tables
c.execute('''
    CREATE TABLE items (
        id INTEGER PRIMARY KEY,
        first TEXT,
        last TEXT
    );
''')

c.execute('''
    CREATE TABLE items2 (
        id INTEGER PRIMARY_KEY,
        name TEXT
    );
''')
# Insert 200,000 rows into the items table
for i in range(1, 1000000):
    c.execute("INSERT INTO items (id, first, last) VALUES (?, ?, ?)", (f'{i}', f'First {i}', f'Last {i}'))
    #c.execute("INSERT INTO items (id, first, last) VALUES (?, ?, ?)", ({int(i)}, f'First {i}', f'Last {i}'))
        # Commit every 100 inserts
    if i % 100 == 0:
        conn.commit()

    if i % 10000 == 0:
        print(f'Finished inserting ${i} rows')

# Commit the changes and close the connection
conn.commit()
conn.close()