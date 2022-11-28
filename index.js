const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());
const port = process.env.PORT || 5000;


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.slxro.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('Unauthorized Access')
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden Access' })
        }
        req.decoded = decoded;
        next();
    })
}

async function run() {
    try {
        const instrumentCategories = client.db('guitarBd').collection('instrumentCategories');
        const instruments = client.db('guitarBd').collection('instrument');
        const usersCollection = client.db('guitarBd').collection('users');
        const bookingsCollection = client.db('guitarBd').collection('bookings');
        const wishlistCollection = client.db('guitarBd').collection('wishlist');

        const verifyAdmin = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }

        const verifySeller = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'seller') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }

        app.get('/myproducts', verifyJWT, verifySeller, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;

            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = {
                email: email
            }
            const products = await instruments.find(query).toArray();
            res.send(products);
        });

        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ isAdmin: user?.role === 'admin' })
        })

        app.get('/users/seller/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ isSeller: user?.role === 'seller' })
        })

        // JWT
        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1d' });
                return res.send({ accessToken: token });
            }
            res.status(403).send({ accessToken: '' })
        })

        // USER Creation
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })


        // Instrument Categories Load
        app.get('/instrumentCategories', async (req, res) => {
            const query = {};
            const users = await instrumentCategories.find(query).toArray();
            res.send(users);
        })

        app.post('/instrument', verifyJWT, verifySeller, async (req, res) => {
            const instrument = req.body;
            const result = await instruments.insertOne(instrument);
            res.send(result);
        });

        // Instrument Load
        app.get('/categories/:id', async (req, res) => {
            const id = req.params.id;
            const query = { typeId: id };
            const guitars = await instruments.find(query).toArray();
            res.send(guitars);
        })

        // Product Booking
        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            const result = await bookingsCollection.insertOne(booking);
            res.send(result);
        });

        app.delete('/product/:id', verifyJWT, verifySeller, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await instruments.deleteOne(filter);
            res.send(result);
        });

        app.put('/product/:id', verifyJWT, verifySeller, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    advertise: true
                }
            }
            const result = await instruments.updateOne(filter, updatedDoc, options);
            res.send(result);
        });

        app.get('/advertiseproducts', async (req, res) => {
            const query = { advertise: true };
            const products = await instruments.find(query).toArray();
            res.send(products);
        });

        app.get('/users/buyers', verifyJWT, verifyAdmin, async (req, res) => {
            const query = { role: 'buyer' };
            const buyers = await usersCollection.find(query).toArray();
            res.send(buyers);
        });

        app.delete('/users/buyers/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await usersCollection.deleteOne(filter);
            res.send(result);
        });


        app.get('/users/sellers', verifyJWT, verifyAdmin, async (req, res) => {
            const query = { role: 'seller' };
            const buyers = await usersCollection.find(query).toArray();
            res.send(buyers);
        });

        app.delete('/users/sellers/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await usersCollection.deleteOne(filter);
            res.send(result);
        });


        app.post('/users/sellers', verifyJWT, verifyAdmin, async (req, res) => {
            const seller = req.body;
            const id = seller._id;
            const filterId = { _id: ObjectId(id) }
            const updatedDoc = {
                $set: {
                    verified: true
                }
            }
            const email = seller.email;
            const filterEmail = { email: email }
            const result = await usersCollection.updateOne(filterId, updatedDoc);
            const updatedProducts = await instruments.updateMany(filterEmail, updatedDoc)
            res.send(result);
        });

        app.get('/myorders', verifyJWT, async (req, res) => {
            const email = req.query.email;
            console.log(email);
            const decodedEmail = req.decoded.email;

            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = {
                email: email
            }
            const orders = await bookingsCollection.find(query).toArray();
            res.send(orders);
        });

        app.post('/wishlist', async (req, res) => {
            const wishlist = req.body;
            const result = await wishlistCollection.insertOne(wishlist);
            res.send(result);
        });

        app.get('/mywishlist', verifyJWT, async (req, res) => {
            const email = req.query.email;
            console.log(email);
            const decodedEmail = req.decoded.email;

            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = {
                email: email
            }
            const products = await wishlistCollection.find(query).toArray();
            res.send(products);
        });


        app.put('/productReport/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    report: true
                }
            }
            const result = await instruments.updateOne(filter, updatedDoc, options);
            res.send(result);
        });

        // app.get('/showReports', verifyJWT, verifyAdmin, async (req, res) => {
        //     const query = { report: true };
        //     const products = await instruments.find(query).toArray();
        //     res.send(products);
        // });


        // create payment intent 
        app.post("/create-payment-intent", async (req, res) => {
            const order = req.body;
            const price = order.price;
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                automatic_payment_methods: {
                    enabled: true,
                },
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });

        // update payment info 
        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const result = await paymentsCollection.insertOne(payment);
            const id = payment.orderId
            const filter = { _id: ObjectId(id) }
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const UpdatedResult = await bookingsCollection.updateOne(filter, updatedDoc);
            res.send(result)
        })

        // report product 
        app.put('/productReport/:id', verifyJWT,  async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    report: true
                }
            }
            const result = await productsCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        });

        // show reported items 
        app.get('/showReports', verifyJWT, verifyAdmin, async (req, res) => {
            const query = { report: true };
            const products = await instruments.find(query).toArray();
            res.send(products);
        });

        // delete reported items
        app.delete('/reportedproduct/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await instruments.deleteOne(filter);
            res.send(result);
        });

    }
    finally {

    }
}
run().catch(console.log());



app.get('/', (req, res) => {
    res.send('Server Running')
})

app.listen(port, () => {
    console.log(`{port}`)
})