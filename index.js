const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEYS);

//middlewares
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Melody Server is Running");
});

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "Unauthorized access" });
  }

  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
    if (error) {
      return res
        .status(401)
        .send({ error: true, message: "Unauthorized Access" });
    }
    req.decoded = decoded;
    next();
  });
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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



    // -----------------------  Collections -----------------------------

    const allUsersCollection = client.db("melodyDB").collection("allUsersCollection");
    const classesCollection = client.db("melodyDB").collection("classesCollection");
    const mySelectedClassCollection = client.db("melodyDB").collection("selectedClassCollection");
    const instructorsCollection = client.db("melodyDB").collection("instructorsCollection");
    const enrolledCollection = client.db("melodyDB").collection("enrolledCollection");
    



    //------------------------   JWT API  -------------------------
    
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

      res.send({ token });
    });




    //------------------  Verify Admin And Instructor Middlewares  ---------------------

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await allUsersCollection.findOne(query);

      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "Only Admin Can Access" });
      }
      next();
    };

    const verifyInstructor = async (req, res, next) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await allUsersCollection.findOne(query);

      if (user?.role !== "instructor") {
        return res
          .status(401)
          .send({ error: true, message: "Only Instructors can Access" });
      }
      next();
    };





    //-----------------   Admin Manage User's related API's  ---------------------------

    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await allUsersCollection.find().toArray();
      res.send(result);
    });




    //------------------- User Info save related API -----------------------

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




    //----------------- User Role change API --------------------------




    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }

      const query = { email: email };
      const user = await allUsersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });


    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ instructor: false });
      }

      const query = { email: email };
      const user = await allUsersCollection.findOne(query);
      const result = { instructor: user?.role === "instructor" };
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





    //------------------------  mySelectedClass related API  -----------------------



    app.get("/mySelectedClass", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;

      if (!email) {
        res.send([]);
      }

      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden Access" });
      }

      const query = { email: email };
      const result = await mySelectedClassCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/mySelectedClass/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await mySelectedClassCollection.findOne(query);
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






    //------------------- Stripe create-payment-intent API ------------------------


    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = Math.round( price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });




    //----------------------  Payment Related API  ----------------------------

    app.post('/payments', verifyJWT,  async(req, res)=> {
      const payment = req.body;
      const insertResult = await enrolledCollection.insertOne(payment);

      //increase enrolledStudents by 1
      const updateEnrolledQuery={_id: {$in: [new ObjectId(payment.classId)]}}
      const updateEnrolledStudents = await classesCollection.findOneAndUpdate(updateEnrolledQuery,  { $inc: { enrolledStudents: 1 } });

      //decrease availableSeats by 1
      const updateSeatsQuery={_id: {$in: [new ObjectId(payment.classId)]}}
      const updateSeats = await classesCollection.findOneAndUpdate(updateSeatsQuery,  { $inc: { available_seats: -1 } });

      const query = {_id: {$in: [new ObjectId(payment.selectedClassId)]}}
      const deleteResult = await mySelectedClassCollection.deleteOne(query)
      res.send({insertResult, updateEnrolledStudents, updateSeats,  deleteResult});
    })





    //---------------------  Enrolled API --------------------------------

    app.get('/enrolled', async(req, res) => {
      const result = await enrolledCollection.find().toArray();
      res.send(result);
    })






    //------------------------  Payment History Related API  ------------------


    app.get('/paymentHistory', async(req, res) => {
      const result = await enrolledCollection.find().sort({date: -1}).toArray();
      res.send(result);
    })






    //------------------- Classes related API  --------------------------



    // -----------------  Managing Classes By Admin API ------------------------

    app.get("/admin/manageClasses", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    });



    // --------------- Popular Class API -------------------------

    app.get("/classes", async (req, res) => {
      const result = await classesCollection.find().sort({ enrolledStudents: -1 }).toArray(); // 
      res.send(result);
    });



    //------------------  Popular Instructor API --------------------------

    app.get('/instructors', async(req, res) => {
      const result = await allUsersCollection.find().toArray();
      res.send(result);
    })



    // ------------- Instructors Class API -----------------


    app.get("/instructorClasses",verifyJWT,verifyInstructor,async (req, res) => {
        const email = req.query.email;
        const query = { instructor_email: email };
        const result = await classesCollection.find(query).toArray();
        res.send(result);
      }
    );

    app.get("/classes/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classesCollection.findOne(query);
      res.send(result);
    });

    app.post("/classes", async (req, res) => {
      const classes = req.body;
      const result = await classesCollection.insertOne(classes);
      res.send(result);
    });


    app.put("/classes/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const classInfo = req.body;
      const updateDoc = {
        $set: {
          class_name: classInfo.class_name,
          class_image: classInfo.class_image,
          available_seats: classInfo.available_seats,
          price: classInfo.price,
        },
      };
      const result = await classesCollection.updateOne(
        query,
        updateDoc,
        options
      );
      res.send(result);
    });





    // ------------- Admin Class API -----------------------

    app.patch("/admin/manageClasses/approve/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "Approved",
        },
      };
      const result = await classesCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    app.patch("/admin/manageClasses/deny/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "Denied",
        },
      };
      const result = await classesCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    app.patch("/admin/manageClasses/feedback/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const adminFeedback = req.body;
      const updateDoc = {
        $set: {
          feedback: adminFeedback.feedback,
        },
      };
      const result = await classesCollection.updateOne(query, updateDoc);
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
