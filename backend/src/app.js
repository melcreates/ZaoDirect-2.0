import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import routes from "./routes/index.js";
import { errorHandler, notFound } from "./middleware/errors.js";

dotenv.config();

const app = express();

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000,http://localhost:3001")
  .split(",")
  .map((origin) => origin.trim())
  .map((origin) => origin.replace(/\/+$/, ""))
  .filter(Boolean);

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // Allow browser-less tools and server-to-server requests.
      if (!origin) return callback(null, true);
      const normalizedOrigin = origin.replace(/\/+$/, "");

      // Allow local frontend/backend hosts used during development.
      if (
        allowedOrigins.includes(normalizedOrigin) ||
        normalizedOrigin === "http://localhost:4001"
      ) {
        return callback(null, true);
      }

      // Reject quietly instead of throwing a 500 in middleware.
      return callback(null, false);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "15mb" }));
app.use(morgan("dev"));

app.use("/api", routes);
app.use(notFound);
app.use(errorHandler);

export default app;
