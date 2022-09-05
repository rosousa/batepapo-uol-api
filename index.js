import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
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
  let { name } = req.body;

  const nameSchema = Joi.object({
    name: Joi.string().empty().required(),
  });

  try {
    await nameSchema.validateAsync({ name });

    const userExist = await db.collection("users").findOne({ name });
    if (userExist) {
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
    console.log(error);
    return res.sendStatus(422);
  }
});

app.get("/participants", async (req, res) => {
  try {
    let users = await db.collection("users").find().toArray();
    return res.send(users);
  } catch (error) {
    return res.sendStatus(500);
  }
});

app.post("/messages", async (req, res) => {
  const { user: sender } = req.headers;
  let message = req.body;

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
    await userSchema.validateAsync({ from: sender });
    await messageSchema.validateAsync(message);
    await db.collection("messages").insertOne({
      ...message,
      from: sender,
      time: dayjs().format("HH:mm:ss"),
    });
    res.sendStatus(201);
  } catch (error) {
    return res.sendStatus(422);
  }
});

app.get("/messages", async (req, res) => {
  const { user } = req.headers;
  const { limit } = req.query;
  if (!user) {
    return res.sendStatus(400);
  }
  let messages;
  try {
    messages = await db.collection("messages").find().toArray();
    messages = messages.filter((msg) => {
      if (
        msg.from === user ||
        msg.to === user ||
        msg.type === "status" ||
        msg.type === "message"
      ) {
        return true;
      }
    });
  } catch (error) {
    console.log(error);
    return res.sendStatus(500);
  }
  if (!limit) {
    return res.send(messages);
  }
  messages = messages.slice(-limit);
  res.send(messages);
});

app.post("/status", async (req, res) => {
  const { user } = req.headers;
  let users;
  try {
    users = await db.collection("users").findOne({ name: user });
    if (!users) {
      return res.sendStatus(404);
    }
    await db
      .collection("users")
      .updateOne({ name: user }, { $set: { lastStatus: Date.now() } });
    res.sendStatus(200);
  } catch (error) {
    res.sendStatus(500);
  }
});

async function checkActiveUsers() {
  let users;
  const TIME_LIMIT = 10000;
  try {
    users = await db.collection("users").find().toArray();
    if (users.length === 0) {
      return;
    }
    users = users.filter((user) => Date.now() - user.lastStatus > TIME_LIMIT);
    if (users.length === 0) {
      return;
    }
    users = users.map((user) => user.name);
    await db.collection("users").deleteMany({ name: { $in: users } });
    const message = users.map((user) => {
      return {
        from: user,
        to: "Todos",
        text: "sai da sala...",
        type: "status",
        time: dayjs().format("HH:mm:ss"),
      };
    });
    const response = await db.collection("messages").insertMany(message);
  } catch (error) {
    console.log(error);
  }
}

app.delete("/messages/:id", async (req, res) => {
  const { user } = req.headers;
  const { id } = req.params;

  try {
    const message = await db
      .collection("messages")
      .findOne({ _id: ObjectId(id) });
    if (!message) {
      return res.sendStatus(404);
    }
    if (message.from !== user) {
      return res.sendStatus(401);
    }
    await db.collection("messages").deleteOne({ _id: ObjectId(id) });
    res.send();
  } catch (error) {
    console.log(error);
  }
});

app.put("/messages/:id", async (req, res) => {
  const { user } = req.headers;
  const { id } = req.params;
  const newMessage = req.body;

  const userSchema = Joi.object({
    to: Joi.string().empty().required(),
    text: Joi.string().empty().required(),
    type: Joi.string().valid("message", "private_message").required(),
  });

  try {
    await userSchema.validateAsync(newMessage, { abortEarly: false });
    const oldMessage = await db
      .collection("messages")
      .findOne({ _id: ObjectId(id) });
    if (!oldMessage) {
      return res.sendStatus(404);
    }
    if (oldMessage.from !== user) {
      return res.sendStatus(401);
    }
    await db
      .collection("messages")
      .updateOne({ _id: ObjectId(id) }, { $set: newMessage });
    res.send();
  } catch (error) {
    console.log(error);
    return res.sendStatus(422);
  }
});

setInterval(checkActiveUsers, 15000);

app.listen(5000, () => console.log("Server running on port 5000"));
