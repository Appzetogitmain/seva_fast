const { MongoClient } = require('mongodb');

const OLD_URI = 'mongodb+srv://sevafast1214_db_user:sevafast123@cluster0.ndcljo6.mongodb.net/';
const NEW_URI = 'mongodb+srv://sevafast1214_db_user:JkDgSrHXmmfZInI2@cluster0.ab4y4iw.mongodb.net/?appName=Cluster0';

async function migrate() {
    console.log('Connecting to old database...');
    const oldClient = new MongoClient(OLD_URI);
    await oldClient.connect();
    // Use 'test' if no db name is specified, as mongoose uses 'test' by default. Let's fetch all collections from default db.
    const oldDb = oldClient.db();
    const dbName = oldDb.databaseName;
    console.log(`Connected to old DB: ${dbName}`);

    console.log('Connecting to new database...');
    const newClient = new MongoClient(NEW_URI);
    await newClient.connect();
    const newDb = newClient.db(dbName);
    console.log(`Connected to new DB: ${dbName}`);

    const collections = await oldDb.listCollections().toArray();
    
    for (const collectionInfo of collections) {
        const collectionName = collectionInfo.name;
        console.log(`\nMigrating collection: ${collectionName}...`);
        
        const oldCollection = oldDb.collection(collectionName);
        const newCollection = newDb.collection(collectionName);

        const documents = await oldCollection.find({}).toArray();
        console.log(`Found ${documents.length} documents in ${collectionName}`);

        if (documents.length > 0) {
            try {
                // Clear existing data in the new collection to avoid duplicate key errors on multiple runs
                await newCollection.deleteMany({});
                await newCollection.insertMany(documents);
                console.log(`Successfully inserted ${documents.length} documents into ${collectionName}`);
            } catch (error) {
                console.error(`Error migrating collection ${collectionName}:`, error.message);
            }
        }
    }

    console.log('\nMigration completed successfully!');
    await oldClient.close();
    await newClient.close();
}

migrate().catch(console.error);
