import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import onboardRoutes from "./routes/onboard.js";

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:5173", 
    credentials: true,
  })
);

app.use("/auth", authRoutes);
app.use("/onboard", onboardRoutes);

// Health check
app.get("/", (req, res) => {
  res.send("Supabase Express API is running 🚀");
});

// Start server
const PORT = process.env.PORT || 4005;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});