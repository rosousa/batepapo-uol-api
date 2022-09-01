import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import Joi from "joi";
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

app.get("/participants", async (req, res) => {
  try {
    const users = await db.collection("users").find().toArray();
    return res.send(users);
  } catch (error) {
    res.sendStatus(500);
  }
});

app.post("/messages", async (req, res) => {
  const { to: recipient } = req.body;
  const { user: sender } = req.headers;

  try {
    const checkUser = await db.collection("users").findOne({ name: sender });

    if (!checkUser) {
      return res.sendStatus(422);
    }
  } catch (error) {
    return res.sendStatus(422);
  }

  const userSchema = Joi.object({
    from: Joi.string().alphanum().min(1).required(),
  });

  const messageSchema = Joi.object({
    to: Joi.string().alphanum().min(1).required(),
    text: Joi.string().min(1).required(),
    type: Joi.string().valid("message", "private_message").required(),
  });

  try {
    await userSchema.validateAsync({ from: recipient });
    await messageSchema.validateAsync(req.body);
    await db
      .collection("messages")
      .insertOne({ ...req.body, time: dayjs().format("HH:mm:ss") });
    res.sendStatus(201);
  } catch (error) {
    return res.sendStatus(422);
  }
});

app.listen(5000, () => console.log("Server running on port 5000"));
