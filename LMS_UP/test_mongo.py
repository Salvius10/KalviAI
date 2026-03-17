from app.db.mongodb import quiz_collection

result = quiz_collection.insert_one({
    "status": "MongoDB connection successful"
})

print("Inserted document ID:", result.inserted_id)