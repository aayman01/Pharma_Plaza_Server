const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRECT_KEY);
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xrbh57q.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection

    const reviewCollection = client.db("PharmaPlaza").collection("reviews");
    const advertisementCollection = client
      .db("PharmaPlaza")
      .collection("advertisements");
    const productCollection = client.db("PharmaPlaza").collection("products");
    const cartCollection = client.db("PharmaPlaza").collection("carts");
    const userCollection = client.db("PharmaPlaza").collection("users");
    const paymentCollection = client.db("PharmaPlaza").collection("payments");
    const invoiceCollection = client.db("PharmaPlaza").collection("invoices");

    // jwt
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // verify token
    const verifyToken = (req, res, next) => {
      // console.log('test verify token',req.headers);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // user related api
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existUser = await userCollection.findOne(query);
      if (existUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const data = req.body;
      const query = { email: email };
      const updatedDoc = {
        $set: {
          name: data.name,
          role: data.role,
        },
      };
      const result = await userCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    // getting data by specific category
    app.get("/category/:name", async (req, res) => {
      const name = req.params.name;
      const query = { categoryName: name };
      const result = await productCollection.find(query).toArray();
      res.send(result);
    });

    // cart replated api
    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/carts", async (req, res) => {
      const item = req.body;
      const result = await cartCollection.insertOne(item);
      res.send(result);
    });

    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    app.delete("/cart/:email", async (req, res) => {
      const email = req.params.email;
      const result = await cartCollection.deleteMany({ email: email });
      res.send(result);
    });

    app.put("/update-cart/:id", async (req, res) => {
      const id = req.params.id;
      const query = { productId: id };
      const data = req.body;
      const updatedDoc = {
        $set: {
          pricePerUnit: data.pricePerUnit,
          quantity: data.quantity,
        },
      };
      const result = await cartCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    //products api
    app.get("/products", async (req, res) => {
      const search = req.query.search;
      const size = parseInt(req.query.size);
      const page = parseInt(req.query.page) - 1;
      const sort = req.query.sort;
      let query = {};

      if (search) {
        query = {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { companyName: { $regex: search, $options: "i" } },
            { categoryName: { $regex: search, $options: "i" } },
          ],
        };
      }
      let options = {};
      if (sort) options = { sort: { pricePerUnit: sort === "asc" ? 1 : -1 } };

      const result = await productCollection
        .find(query, options)
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });

    // get all data for pagination
    app.get("/products-count", async (req, res) => {
      const count = await productCollection.countDocuments();
      res.send({ count });
    });

    // advertisement api
    app.get("/advertisements", async (req, res) => {
      const result = await advertisementCollection.find().toArray();
      res.send(result);
    });

    // reviews api
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    // payment intent

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
       res.send(paymentResult);
    });

    // invoice related api

    app.get('/invoice',async(req, res) =>{
      const result = await invoiceCollection.find().toArray();
      res.send(result);
    })

    app.post('/invoice',async(req, res) => {
      const invoice = req.body;
      const InvoiceResult = await invoiceCollection.insertOne(invoice);
      const query = {
        _id : {
          $in : invoice.cartIds.map(id => new ObjectId(id))
        },
      };
      const deleteResult = await cartCollection.deleteMany(query); 
      res.send({InvoiceResult, deleteResult})
    })

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("PharmaPlaza is running...");
});

app.listen(port, () => {
  console.log(`my port is running on ${port}`);
});
