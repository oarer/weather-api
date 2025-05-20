import { Elysia } from "elysia";
import cors from "@elysiajs/cors";
import { logger } from "@chneau/elysia-logger";
import weather from "./v1/weather";

const PORT = Number(process.env.PORT) || 3000;

const app = new Elysia();

// Middleware
app.use(cors());
app.use(logger());

// Register routes
app.use(weather);

// Default route
app.get(
    "/",
    () =>
        `Hi!\nThis API was created by: https://github.com/oarer\n\nDocs: https://github.com/oarer/weatherapi`
);

// Error handling
app.onError(({ error, code }) => {
    if (code === "NOT_FOUND") return "Oops...\nRoute not found";
    if (code === "INTERNAL_SERVER_ERROR")
        return "Oops...\nInternal server error";
    console.error(error);
});

// Start API
try {
    await app.listen({ port: PORT, hostname: "0.0.0.0" });
    const url = `http://${app.server?.hostname}:${app.server?.port}`;
    console.log(`WeatherAPI is running on ${url}`);
} catch (err) {
    console.error("Failed to start server:", err);
}
