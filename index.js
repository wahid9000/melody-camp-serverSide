const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;
require("dotenv").config();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Melody Server is Running");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wy87kp4.mongodb.net/?retryWrites=true&w=majority`;

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

    const classesCollection = client
      .db("melodyDB")
      .collection("classesCollection");
    const instructorsCollection = client
      .db("melodyDB")
      .collection("instructorsCollection");
    const mySelectedClassCollection = client
      .db("melodyDB")
      .collection("selectedClassCollection");
    const allUsersCollection = client
      .db("melodyDB")
      .collection("allUsersCollection");

    //users related API's

    app.get("/users", async (req, res) => {
      const result = await allUsersCollection.find().toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const saveUser = req.body;

      const query = { email: saveUser.email };
      const existingUser = await allUsersCollection.findOne(query);
      console.log(existingUser);
      if (existingUser) {
        return res.send({ message: "User already exists" });
      }

      const result = await allUsersCollection.insertOne(saveUser);
      res.send(result);
    });

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await allUsersCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "instructor",
        },
      };
      const result = await allUsersCollection.updateOne(query, updateDoc);
      res.send(result);
    });




    //mySelectedClass related API
    app.get("/mySelectedClass", async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const query = { email: email };
      const result = await mySelectedClassCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/mySelectedClass", async (req, res) => {
      const selectedClass = req.body;
      const result = await mySelectedClassCollection.insertOne(selectedClass);
      res.send(result);
    });

    app.delete("/mySelectedClass/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await mySelectedClassCollection.deleteOne(query);
      res.send(result);
    });

    //classes related API
    app.get("/classes", async (req, res) => {
      const result = await classesCollection
        .find()
        .sort({ students_number: -1 })
        .toArray();
      res.send(result);
    });

    //instructors related API
    app.get("/instructors", async (req, res) => {
      const result = await instructorsCollection.find().toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
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

app.listen(port, () => {
  console.log(port);
});
