import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import dayjs from "dayjs";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const mongoClient = new MongoClient(process.env.MONGO_URI);

let db;

mongoClient.connect().then(() => {
  db = mongoClient.db("batepapouol");
});

app.post("/participants", async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.sendStatus(422);
  }

  try {
    const checkUser = await db.collection("users").find({ name }).toArray();
    if (checkUser.length > 0) {
      return res.sendStatus(409);
    }
    await db.collection("users").insertOne({ name, lastStatus: Date.now() });
    await db.collection("messages").insertOne({
      from: name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs().format("HH:mm:ss"),
    });
    res.sendStatus(201);
  } catch (error) {
    return res.sendStatus(422);
  }
});

app.listen(5000, () => console.log("Magic happens on port 5000"));
