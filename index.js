require("dotenv").config();
const express = require("express");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
var cors = require("cors");
const port = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());

const admin = require("firebase-admin");




const serviceAccount = require("./firebase_admin_sdk.json");

const uri = `mongodb+srv://${process.env.USER_NAME}:${process.env.USER_KEY}@app.759oy5v.mongodb.net/?retryWrites=true&w=majority&appName=app`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const verifyEmail = (req, res, next) => {
  if (req.decoded.email !== req.query.email) {
    return res.status(403).send({ message: "forbidden access" });
  }
  next();
};

const verifyToken = async (req, res, next) => {
  const headersToken = req.headers?.authorization;
  if (!headersToken || !headersToken.startsWith("Bearer")) {
    return res.status(401).send({ message: "unauthorize access" });
  }
  const token = headersToken.split(" ")[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.decoded = decoded;
    next();
  } catch {
    return res.status(401).send({ message: "unauthorize" });
  }
};

async function run() {
  try {
    const database = client.db("savorly");
    const recipeCollection = database.collection("recipesCollection");
    const purchaseDataCollection = database.collection(
      "purchaseDataCollection"
    );

    app.get("/recipes", async (req, res) => {
      const { search, sortOrder, email } = req.query;
      if (email) {
        return res.status(400).send({ message: "Invalid query parameter" });
      }

      const query = search ? { name: { $regex: search, $options: "i" } } : {};

      const sortOption = sortOrder === "dsc" ? { purchaseCount: -1 } : {};

      const result = await recipeCollection
        .find(query)
        .sort(sortOption)
        .toArray();

      res.send(result);
    });

    // secure data get
    app.get("/my-recipes", verifyToken, verifyEmail, async (req, res) => {
      const query = { "addedBy.email": req.query.email };
      const result = await recipeCollection.find(query).toArray();
      res.send(result);
    });

    app.patch("/recipes/:id",verifyToken, async (req, res) => {
      const id = req.params.id;
     
      const data = req.body;
      const updateDoc = {
        $set: data,
      };
      const query = { _id: new ObjectId(id) };
      const result = await recipeCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    app.get("/recipes/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await recipeCollection.findOne(query);
      res.send(result);
    });

    app.post("/recipes",verifyToken, async (req, res) => {
      const data = req.body;

      const result = await recipeCollection.insertOne(data);
      res.send(result);
    });

    app.post("/purchaseData",verifyToken, async (req, res) => {
      const allData = req.body;
      const result = await purchaseDataCollection.insertOne(allData);
      res.send(result);
    });
    app.get("/purchaseData",verifyToken,verifyEmail, async (req, res) => {
      const email = req.query.email;

      const query = {
        buyerEmail: email,
      };
      const result = await purchaseDataCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/purchaseData/:id",verifyToken, async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };
      const result = await purchaseDataCollection.deleteOne(query);
      res.send(result);
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Savorly server is running");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
