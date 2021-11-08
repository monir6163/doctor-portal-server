const express = require('express');
const app = express();
require('dotenv').config();
const cors = require('cors');
const MongoClient = require("mongodb").MongoClient;
const admin = require("firebase-admin");
const ObjectId = require("mongodb").ObjectId;
const port = process.env.PORT || 5000;
// middleware
app.use(cors());
app.use(express.json());

// database
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.r1nyd.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });


// firebase user authorization 

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1];
        const decodedUser = await admin.auth().verifyToken(token);
        req.decodedEmail = decodedUser.email;
    }
    next();
}

// backend work 
async function run() {
    try {
        await client.connect();
        const database = client.db('doctor-portal');
        const appoinmentCollection = database.collection('appoinment');
        const usersCollection = database.collection('users');

        // user api 
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.json(result)
        });
        // upsert api 
        app.put('/users', async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const options = { upsert: true };
            const update = { $set: user };
            const result = await usersCollection.updateOne(filter, update, options);
            res.json(result)
        })
        //appoint post api
        app.post('/appointments', verifyToken, async (req, res) => {
            const appoinment = req.body;
            const result = await appoinmentCollection.insertOne(appoinment)
            res.json(result)
        });
        //appoint get api
        app.get('/appointments', async (req, res) => {
            const email = req.query.email;
            const date = req.query.date;
            const query = { email: email, date: date };
            const cursor = appoinmentCollection.find(query);
            const result = await cursor.toArray();
            res.json(result)
        });
        //make admin role api
        app.put('/users/admin', verifyToken, async (req, res) => {
            const user = req.body;
            const requester = req.decodedEmail;
            if (requester) {
                const requesterAccount = await usersCollection.findOne({ email: requester });
                if (requesterAccount.role === 'admin') {
                    const filter = { email: user.email };
                    const setRole = { $set: { role: 'admin' } };
                    const result = await usersCollection.updateOne(filter, setRole);
                    res.json(result);
                }
            }
            else {
                res.status(401).json({ message: 'user not authorized' })
            }
        });
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true;
            };
            res.json({ admin: isAdmin })
        })

    }
    finally {
        // await client.close();
    }
}
run().catch(console.dir);

// default api check run server
app.get('/', (req, res) => {
    res.send('Running Node Servers')
});
app.listen(port, () => {
    console.log('Doctor Portal port', port)
})