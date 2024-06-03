const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
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

    const reviewCollection = client.db('PharmaPlaza').collection('reviews');
    const advertisementCollection = client.db('PharmaPlaza').collection('advertisements');
    const productCollection = client.db('PharmaPlaza').collection('products');
    const cartCollection = client.db('PharmaPlaza').collection('carts');


    // getting data by specific category
    app.get('/category/:name',async(req, res)=>{
      const name = req.params.name;
      const query = { categoryName : name};
      const result = await productCollection.find(query).toArray();
      res.send(result)
    })

    // cart replated api
    app.post('/carts',async(req, res) => {
      const item = req.body;
      const result = await cartCollection.insertOne(item);
      res.send(result)
    })

    //products api
    app.get('/products', async(req,res)=>{
      const result = await productCollection.find().toArray();
      res.send(result)
    }) 

    // advertisement api
    app.get('/advertisements',async(req, res)=>{
      const result = await advertisementCollection.find().toArray();
      res.send(result)
    })

    // reviews api
    app.get('/reviews',async(req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result)
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

app.get('/',(req, res) => {
    res.send("PharmaPlaza is running...")
})

app.listen(port,()=>{
    console.log(`my port is running on ${port}`)
})
