const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.buwy59t.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const userCollection = client.db("staffsphereDB").collection("users");

    const taskCollection = client.db("staffsphereDB").collection("tasks");

    // jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    })

    // middlewares 
    const verifyToken = (req, res, next) => {
      // console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
      })
    }

    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }
    // use verify employee after verifyToken
    const verifyEmployee = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isEmployee = user?.role === 'employee';
      if (!isEmployee) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }
    // use verify hr after verifyToken
    const verifyHr = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isHr = user?.role === 'hr';
      if (!isHr) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }

    // users related api
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });
    })

    app.get('/users/employee/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let employee = false;
      if (user) {
        employee = user?.role === 'employee';
      }
      res.send({ employee });
    })


    app.get('/users/hr/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let hr = false;
      if (user) {
        hr = user?.role === 'hr';
      }
      res.send({ hr });
    })

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null })
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })


    app.post("/tasks", verifyToken,verifyEmployee, async (req, res) => {
      const newQuery = req.body;
      const result = await taskCollection.insertOne(newQuery);
      res.send(result);
    });

    app.get('/tasks', async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const options = {
        sort: { date: -1 }
      };
      const result = await taskCollection.find(query,options).toArray();
      res.send(result);
    });

    app.get('/employees', verifyToken, verifyHr, async (req, res) => {
      
      const query = { role: "employee" };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });


    app.patch('/employees/verify', verifyToken, verifyHr, async (req, res) => {
      const email = req.query.email;
      const isVerified = req.query.isVerified;
      const filter = { email: email };
      const updatedDoc = {
        $set: {
          verified: isVerified,
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    app.patch('/employees/makeHr', verifyToken, verifyAdmin, async (req, res) => {
      const email = req.query.email;
      const filter = { email: email };
      const updatedDoc = {
        $set: {
          role: "hr",
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })


    app.patch('/updateSalary', verifyToken, verifyAdmin, async (req, res) => {
      const email = req.query.email;
      const newSalary = req.query.newSalary;
      console.log(newSalary);

      const filter = { email: email };
      const user = await userCollection.findOne(filter);
      console.log(user.salary, newSalary);
      let result;
      if(user.salary <= newSalary)
        {
          const updatedDoc = {
            $set: {
              salary: newSalary,
          }
        };
        result = await userCollection.updateOne(filter, updatedDoc);
      }
      
      
      res.send(result);
    });


    app.get('/verifiedList', verifyToken, verifyAdmin, async (req, res) => {
      
      const query = { role: { $in: ["employee", "hr"] }, verified:"true" };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });






    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('StaffSphere is sitting')
})

app.listen(port, () => {
  console.log(`StaffSphere is sitting on port ${port}`);
})

