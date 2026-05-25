import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import routes from "./routes/index.js";
import { errorHandler, notFound } from "./middleware/errors.js";

dotenv.config();

const app = express();

const envOrigins = (process.env.FRONTEND_URL || "http://localhost:3000,http://localhost:3001")
  .split(",")
  .map((origin) => origin.trim())
  .map((origin) => origin.replace(/\/+$/, ""))
  .filter(Boolean);

const defaultOrigins = [
  "https://app.zaodirect.com",
  "https://zaodirect.com",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:4001",
];

const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

const corsOptions = {
  origin(origin, callback) {
    // Allow browser-less tools and server-to-server requests.
    if (!origin) return callback(null, true);
    const normalizedOrigin = origin.replace(/\/+$/, "");

    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    // Reject quietly instead of throwing a 500 in middleware.
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
};

app.use(helmet());
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "15mb" }));
app.use(morgan("dev"));

app.use("/api", routes);
app.use(notFound);
app.use(errorHandler);

export default app;
